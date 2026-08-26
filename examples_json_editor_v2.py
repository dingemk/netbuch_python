#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Examples JSON Editor (v3.1 - runtimes: python | c12 | c3)
---------------------------------------------------------
- GUI-Editor für examples.json
- Felder: file, name, optional image, runtime (python | c12 | c3)
- NEU: optionale Zusatzdateien (resources: [string, ...]) + optionales ZIP (bundleZip)
- Abwärtskompatibel: Alte JSONs ohne diese Felder lassen sich laden und wieder speichern.
"""

import json
import os
import tkinter as tk
from tkinter import ttk, filedialog, messagebox

APP_TITLE = "Examples JSON Editor (v3.1)"
DEFAULT_JSON_NAME = "examples.json"

RUNTIMES = ("python", "c12", "c3")

RUNTIME_ALIASES = {
    "python": "python",
    "py": "python",
    "turtle": "python",
    "micropython": "c12",
    "calliope": "c12",
    "c12": "c12",
    "1/2": "c12",
    "classic": "c12",
    "calliope 1/2": "c12",
    "calliope12": "c12",
    "calliope 12": "c12",
    "c3": "c3",
    "v3": "c3",
    "codal": "c3",
    "calliope 3": "c3",
    "calliope3": "c3",
}


class ExamplesEditor(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title(APP_TITLE)
        self.geometry("1024x620")
        self.minsize(820, 520)

        self.examples = []
        self.current_json_path = None

        self._build_menu()
        self._build_form()
        self._build_list()
        self._build_actions()
        self._layout()

    # ---------- macOS-sicherer Dialog-Wrapper ----------
    def _run_dialog(self, fn):
        # Dialog erst "nach" dem Button-Event öffnen, mit sauberem Fokus.
        def _go():
            try:
                self.lift()
                self.focus_force()
                self.update_idletasks()
                fn()
            except Exception as e:
                messagebox.showerror(APP_TITLE, f"Dialog-Fehler:\n{e}")
        self.after(50, _go)

    # ---------- Menü ----------
    def _build_menu(self):
        menubar = tk.Menu(self)
        filemenu = tk.Menu(menubar, tearoff=0)
        filemenu.add_command(label="Neu", command=self.cmd_new, accelerator="Ctrl+N")
        filemenu.add_command(label="Öffnen…", command=self.cmd_open, accelerator="Ctrl+O")
        filemenu.add_separator()
        filemenu.add_command(label="Speichern", command=self.cmd_save, accelerator="Ctrl+S")
        filemenu.add_command(label="Speichern unter…", command=self.cmd_save_as)
        filemenu.add_separator()
        filemenu.add_command(label="Beenden", command=self.destroy, accelerator="Ctrl+Q")
        menubar.add_cascade(label="Datei", menu=filemenu)
        self.config(menu=menubar)

        self.bind_all("<Control-n>", lambda e: self.cmd_new())
        self.bind_all("<Control-o>", lambda e: self.cmd_open())
        self.bind_all("<Control-s>", lambda e: self.cmd_save())
        self.bind_all("<Control-q>", lambda e: self.destroy())

    # ---------- Formular ----------
    def _build_form(self):
        self.frmForm = ttk.LabelFrame(self, text="Neuer/zu bearbeitender Eintrag")

        self.varName = tk.StringVar()
        self.entName = ttk.Entry(self.frmForm, textvariable=self.varName, width=48)

        self.varFile = tk.StringVar()
        self.entFile = ttk.Entry(self.frmForm, textvariable=self.varFile, width=48)
        self.btnFile = ttk.Button(self.frmForm, text="Datei wählen…", command=self.choose_file)

        self.varImage = tk.StringVar()
        self.entImage = ttk.Entry(self.frmForm, textvariable=self.varImage, width=48)
        self.btnImage = ttk.Button(self.frmForm, text="Bild wählen…", command=self.choose_image)

        self.varRuntime = tk.StringVar(value="python")
        self.frmRuntime = ttk.Frame(self.frmForm)
        self.rbPy = ttk.Radiobutton(self.frmRuntime, text="Python", variable=self.varRuntime, value="python")
        self.rbC12 = ttk.Radiobutton(self.frmRuntime, text="Calliope 1/2", variable=self.varRuntime, value="c12")
        self.rbC3 = ttk.Radiobutton(self.frmRuntime, text="Calliope 3", variable=self.varRuntime, value="c3")

        self.txtResources = tk.Text(self.frmForm, width=48, height=5, wrap="none")
        self.btnResChoose = ttk.Button(self.frmForm, text="Dateien wählen…", command=self.choose_resources)
        self.btnResClear = ttk.Button(
            self.frmForm, text="Liste leeren", command=lambda: self.txtResources.delete("1.0", "end")
        )

        self.varBundleZip = tk.StringVar()
        self.entBundleZip = ttk.Entry(self.frmForm, textvariable=self.varBundleZip, width=48)
        self.btnBundleZip = ttk.Button(self.frmForm, text="ZIP wählen…", command=self.choose_zip)

        self.btnAddUpdate = ttk.Button(self.frmForm, text="Hinzufügen/Aktualisieren", command=self.add_or_update_entry)
        self.btnClear = ttk.Button(self.frmForm, text="Felder leeren", command=self.clear_form)

    # ---------- Liste ----------
    def _build_list(self):
        self.frmList = ttk.LabelFrame(self, text="Einträge")
        self.tree = ttk.Treeview(
            self.frmList,
            columns=("name", "runtime", "file", "image", "res_count", "zip"),
            show="headings",
            selectmode="browse",
        )
        self.tree.heading("name", text="Name")
        self.tree.heading("runtime", text="Runtime")
        self.tree.heading("file", text="Datei")
        self.tree.heading("image", text="Bild (optional)")
        self.tree.heading("res_count", text="res(#)")
        self.tree.heading("zip", text="zip")

        self.tree.column("name", width=180, anchor="w")
        self.tree.column("runtime", width=110, anchor="center")
        self.tree.column("file", width=360, anchor="w")
        self.tree.column("image", width=200, anchor="w")
        self.tree.column("res_count", width=70, anchor="e")
        self.tree.column("zip", width=200, anchor="w")

        self.tree.bind("<<TreeviewSelect>>", self.on_select_row)

        vsb = ttk.Scrollbar(self.frmList, orient="vertical", command=self.tree.yview)
        hsb = ttk.Scrollbar(self.frmList, orient="horizontal", command=self.tree.xview)
        self.tree.configure(yscrollcommand=vsb.set, xscrollcommand=hsb.set)
        self.vsb = vsb
        self.hsb = hsb

    # ---------- Aktionen ----------
    def _build_actions(self):
        self.frmActions = ttk.Frame(self)
        self.btnRemove = ttk.Button(self.frmActions, text="Ausgewählten entfernen", command=self.remove_selected)
        self.btnUp = ttk.Button(self.frmActions, text="▲ Nach oben", command=lambda: self.move_selected(-1))
        self.btnDown = ttk.Button(self.frmActions, text="▼ Nach unten", command=lambda: self.move_selected(+1))

    # ---------- Layout ----------
    def _layout(self):
        pad = dict(padx=8, pady=8)
        self.frmForm.grid(row=0, column=0, sticky="nsew", **pad)
        self.frmList.grid(row=1, column=0, sticky="nsew", **pad)
        self.frmActions.grid(row=2, column=0, sticky="ew", **pad)

        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(1, weight=1)

        r = 0
        ttk.Label(self.frmForm, text="Name").grid(row=r, column=0, sticky="w")
        self.entName.grid(row=r, column=1, sticky="ew", padx=(8, 0))
        r += 1

        ttk.Label(self.frmForm, text="Datei (file)").grid(row=r, column=0, sticky="w")
        self.entFile.grid(row=r, column=1, sticky="ew", padx=(8, 0))
        self.btnFile.grid(row=r, column=2, sticky="w", padx=(8, 0))
        r += 1

        ttk.Label(self.frmForm, text="Bild (optional)").grid(row=r, column=0, sticky="w")
        self.entImage.grid(row=r, column=1, sticky="ew", padx=(8, 0))
        self.btnImage.grid(row=r, column=2, sticky="w", padx=(8, 0))
        r += 1

        ttk.Label(self.frmForm, text="Runtime").grid(row=r, column=0, sticky="w")
        self.frmRuntime.grid(row=r, column=1, sticky="w", padx=(8, 0))
        self.rbPy.grid(row=0, column=0, padx=(0, 12))
        self.rbC12.grid(row=0, column=1, padx=(0, 12))
        self.rbC3.grid(row=0, column=2)
        r += 1

        ttk.Label(self.frmForm, text="Zusatzdateien (resources)\n— eine Zeile pro Pfad —").grid(
            row=r, column=0, sticky="nw"
        )
        self.txtResources.grid(row=r, column=1, sticky="ew", padx=(8, 0))
        btns = ttk.Frame(self.frmForm)
        self.btnResChoose.pack(in_=btns, side="top", anchor="w", pady=(0, 4))
        self.btnResClear.pack(in_=btns, side="top", anchor="w")
        btns.grid(row=r, column=2, sticky="nw", padx=(8, 0))
        r += 1

        ttk.Label(self.frmForm, text="ZIP-Bundle (optional)").grid(row=r, column=0, sticky="w")
        self.entBundleZip.grid(row=r, column=1, sticky="ew", padx=(8, 0))
        self.btnBundleZip.grid(row=r, column=2, sticky="w", padx=(8, 0))
        r += 1

        self.btnAddUpdate.grid(row=r, column=1, sticky="w", padx=(8, 0))
        self.btnClear.grid(row=r, column=2, sticky="w", padx=(8, 0))

        self.frmForm.grid_columnconfigure(1, weight=1)

        self.tree.grid(row=0, column=0, sticky="nsew")
        self.vsb.grid(row=0, column=1, sticky="ns")
        self.hsb.grid(row=1, column=0, sticky="ew")
        self.frmList.grid_rowconfigure(0, weight=1)
        self.frmList.grid_columnconfigure(0, weight=1)

        self.btnRemove.grid(row=0, column=0, padx=4)
        self.btnUp.grid(row=0, column=1, padx=4)
        self.btnDown.grid(row=0, column=2, padx=4)

    # ---------- Datei-/Bild-/ZIP-Wahl ----------
    def choose_file(self):
        def _open():
            path = filedialog.askopenfilename(
                parent=self,
                title="Quelldatei auswählen",
                filetypes=[("Python", "*.py;*.txt;*.py.txt"), ("Alle Dateien", "*.*")],
            )
            if path:
                rel = self._try_make_relative(path)
                self.varFile.set(rel)
                if not self.varName.get().strip():
                    base = os.path.basename(path)
                    for ext in (".py.txt", ".py", ".txt"):
                        if base.endswith(ext):
                            base = base[: -len(ext)]
                            break
                    self.varName.set(base.replace("_", " ").title())

        self._run_dialog(_open)

    def choose_image(self):
        def _open():
            path = filedialog.askopenfilename(
                parent=self,
                title="Bild auswählen",
                filetypes=[("Bilder", "*.png;*.jpg;*.jpeg;*.gif;*.webp"), ("Alle Dateien", "*.*")],
            )
            if path:
                self.varImage.set(self._try_make_relative(path))

        self._run_dialog(_open)

    def choose_resources(self):
        def _open():
            paths = filedialog.askopenfilenames(
                parent=self,
                title="Zusatzdateien wählen… (Mehrfachauswahl)",
                filetypes=[("Alle Dateien", "*.*")],
            )
            if not paths:
                return
            existing = self._parse_resources_text(self.txtResources.get("1.0", "end"))
            for p in paths:
                rel = self._try_make_relative(p)
                if rel not in existing:
                    existing.append(rel)
            self._set_resources_text(existing)

        self._run_dialog(_open)

    def choose_zip(self):
        def _open():
            path = filedialog.askopenfilename(
                parent=self,
                title="ZIP-Bundle wählen…",
                filetypes=[("ZIP", "*.zip"), ("Alle Dateien", "*.*")],
            )
            if path:
                self.varBundleZip.set(self._try_make_relative(path))

        self._run_dialog(_open)

    # ---------- Eintrag übernehmen ----------
    def add_or_update_entry(self):
        file = self.varFile.get().strip()
        name = self.varName.get().strip()
        image = self.varImage.get().strip()
        bundle_zip = self.varBundleZip.get().strip()
        runtime = self._normalize_runtime(self.varRuntime.get())

        if not file:
            messagebox.showwarning(APP_TITLE, "Bitte eine Datei (file) auswählen/angeben.")
            return
        if runtime not in RUNTIMES:
            messagebox.showwarning(APP_TITLE, "Bitte Runtime wählen (Python, Calliope 1/2 oder Calliope 3).")
            return
        if not name:
            base = os.path.basename(file)
            for ext in (".py.txt", ".py", ".txt"):
                if base.endswith(ext):
                    base = base[: -len(ext)]
                    break
            name = base.replace("_", " ").title()

        resources = self._parse_resources_text(self.txtResources.get("1.0", "end"))

        entry = {"file": file, "name": name, "runtime": runtime}
        if image:
            entry["image"] = image
        if resources:
            entry["resources"] = resources
        if bundle_zip:
            entry["bundleZip"] = bundle_zip

        idx = self._find_index_by_file(file)
        if idx is None:
            self.examples.append(entry)
            self._tree_insert(entry)
        else:
            self.examples[idx] = entry
            self._tree_update(idx, entry)

        self.clear_form(keep_runtime=True)

    def clear_form(self, keep_runtime=False):
        self.varName.set("")
        self.varFile.set("")
        self.varImage.set("")
        self.varBundleZip.set("")
        self.txtResources.delete("1.0", "end")
        if not keep_runtime:
            self.varRuntime.set("python")

    # ---------- Listenevents ----------
    def remove_selected(self):
        sel = self.tree.selection()
        if not sel:
            return
        item_id = sel[0]
        index = self.tree.index(item_id)
        self.tree.delete(item_id)
        del self.examples[index]

    def move_selected(self, delta):
        sel = self.tree.selection()
        if not sel:
            return
        item_id = sel[0]
        index = self.tree.index(item_id)
        new_index = index + delta
        if new_index < 0 or new_index >= len(self.examples):
            return
        self.examples[index], self.examples[new_index] = self.examples[new_index], self.examples[index]
        self._rebuild_tree()
        self.tree.selection_set(self.tree.get_children()[new_index])

    def on_select_row(self, event=None):
        sel = self.tree.selection()
        if not sel:
            return
        idx = self.tree.index(sel[0])
        entry = self.examples[idx]
        self.varName.set(entry.get("name", ""))
        self.varFile.set(entry.get("file", ""))
        self.varImage.set(entry.get("image", ""))
        self.varRuntime.set(self._normalize_runtime(entry.get("runtime", "python")))
        res_list = self._normalize_resources(entry.get("resources"))
        self._set_resources_text(res_list)
        self.varBundleZip.set(entry.get("bundleZip", ""))

    # ---------- Datei-Kommandos ----------
    def cmd_new(self):
        self.examples = []
        self.current_json_path = None
        self._rebuild_tree()
        self.clear_form()
        self.title(APP_TITLE)

    def cmd_open(self):
        def _open():
            path = filedialog.askopenfilename(
                parent=self,
                title="JSON öffnen",
                filetypes=[("JSON", "*.json"), ("Alle Dateien", "*.*")],
                initialfile=DEFAULT_JSON_NAME,
            )
            if not path:
                return
            try:
                with open(path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                items = data.get("examples", [])
                if not isinstance(items, list):
                    raise ValueError("Ungültiges Format: 'examples' muss ein Array sein.")
                self.examples = self._normalize_on_load(items)
                self.current_json_path = path
                self._rebuild_tree()
                self.title(f"{APP_TITLE} — {os.path.basename(path)}")
            except Exception as e:
                messagebox.showerror(APP_TITLE, f"Konnte JSON nicht laden:\n{e}")

        self._run_dialog(_open)

    def cmd_save(self):
        if not self.current_json_path:
            return self.cmd_save_as()
        try:
            payload = {"examples": self.examples}
            with open(self.current_json_path, "w", encoding="utf-8") as f:
                json.dump(payload, f, ensure_ascii=False, indent=2)
            messagebox.showinfo(APP_TITLE, f"Gespeichert:\n{self.current_json_path}")
        except Exception as e:
            messagebox.showerror(APP_TITLE, f"Fehler beim Speichern:\n{e}")

    def cmd_save_as(self):
        def _open():
            path = filedialog.asksaveasfilename(
                parent=self,
                title="JSON speichern unter…",
                defaultextension=".json",
                filetypes=[("JSON", "*.json"), ("Alle Dateien", "*.*")],
                initialfile=DEFAULT_JSON_NAME,
            )
            if not path:
                return
            self.current_json_path = path
            self.cmd_save()

        self._run_dialog(_open)

    # ---------- Helper ----------
    @staticmethod
    def _normalize_runtime(value: str) -> str:
        v = (value or "").strip().lower()
        return RUNTIME_ALIASES.get(v, v if v in RUNTIMES else "python")

    def _find_index_by_file(self, file_path: str):
        for i, e in enumerate(self.examples):
            if e.get("file") == file_path:
                return i
        return None

    def _normalize_on_load(self, items):
        norm = []
        for it in items:
            if not isinstance(it, dict):
                continue
            file = str(it.get("file", "")).strip()
            if not file:
                continue
            name = str(it.get("name", "")).strip()
            runtime_raw = str(it.get("runtime", "")).strip()
            runtime = self._normalize_runtime(runtime_raw)
            image = str(it.get("image", "")).strip() if it.get("image") else ""
            resources = self._normalize_resources(it.get("resources"))
            bundle_zip = str(it.get("bundleZip", "")).strip() if it.get("bundleZip") else ""

            if not name:
                base = os.path.basename(file)
                for ext in (".py.txt", ".py", ".txt"):
                    if base.endswith(ext):
                        base = base[: -len(ext)]
                        break
                name = base.replace("_", " ").title()

            entry = {"file": file, "name": name, "runtime": runtime}
            if image:
                entry["image"] = image
            if resources:
                entry["resources"] = resources
            if bundle_zip:
                entry["bundleZip"] = bundle_zip
            norm.append(entry)
        return norm

    def _rebuild_tree(self):
        for iid in self.tree.get_children():
            self.tree.delete(iid)
        for e in self.examples:
            self._tree_insert(e)

    def _tree_insert(self, entry):
        vals = (
            entry.get("name", ""),
            entry.get("runtime", ""),
            entry.get("file", ""),
            entry.get("image", ""),
            len(entry.get("resources", []) or []),
            self._short_zip(entry.get("bundleZip", "")),
        )
        self.tree.insert("", "end", values=vals)

    def _tree_update(self, index, entry):
        iid = self.tree.get_children()[index]
        vals = (
            entry.get("name", ""),
            entry.get("runtime", ""),
            entry.get("file", ""),
            entry.get("image", ""),
            len(entry.get("resources", []) or []),
            self._short_zip(entry.get("bundleZip", "")),
        )
        self.tree.item(iid, values=vals)

    @staticmethod
    def _try_make_relative(path: str) -> str:
        try:
            cwd = os.path.abspath(os.getcwd())
            ap = os.path.abspath(path)
            if ap.startswith(cwd + os.sep):
                return os.path.relpath(ap, cwd)
            return path
        except Exception:
            return path

    @staticmethod
    def _normalize_resources(value):
        if not value:
            return []
        if isinstance(value, str):
            parts = []
            for chunk in value.replace(";", "\n").replace(",", "\n").splitlines():
                s = chunk.strip()
                if s:
                    parts.append(s)
            return parts
        if isinstance(value, (list, tuple)):
            out = []
            for x in value:
                s = str(x).strip()
                if s:
                    out.append(s)
            return out
        return []

    def _parse_resources_text(self, text: str):
        return self._normalize_resources(text or "")

    def _set_resources_text(self, resources):
        self.txtResources.delete("1.0", "end")
        resources = self._normalize_resources(resources)
        if resources:
            self.txtResources.insert("1.0", "\n".join(resources))

    @staticmethod
    def _short_zip(path: str) -> str:
        path = (path or "").strip()
        if not path:
            return ""
        return os.path.basename(path)


def main():
    app = ExamplesEditor()
    app.mainloop()


if __name__ == "__main__":
    main()