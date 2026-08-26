// Python-IDE Scripts (Monaco, Pyodide, Turtle, UI)
// (A) Hochgeladene Python-Module für Calliope-Bundling
// === Inline-Python Bundler (helpers + safe getBundledPy) ===
window.__uploadedPyForHex = window.__uploadedPyForHex || Object.create(null);

if (typeof window.debugListUploadedPyForHex !== 'function') {
  window.debugListUploadedPyForHex = function debugListUploadedPyForHex() {
    const k = Object.keys(window.__uploadedPyForHex || {});
    try { console.log('[Calliope-Bundle] modules:', k); } catch { }
    return k;
  };
}
if (typeof window.addUploadedPyForHex !== 'function') {
  window.addUploadedPyForHex = function addUploadedPyForHex(modName, srcText) {
    if (!modName || !srcText) return;
    const name = String(modName).replace(/\.py$/i, '');
    const txt = String(srcText).replace(/^\uFEFF/, '');
    (window.__uploadedPyForHex || (window.__uploadedPyForHex = Object.create(null)))[name] = txt;
    bag[name] = txt;
    bag[name.toLowerCase()] = txt;
    try {
      localStorage.setItem("calliope.uploadedPyForHex", JSON.stringify(bag));
      console.log('[Calliope-Bundle] uploaded .py:', Object.keys(bag));
    } catch { }
  };
}

if (typeof window.collectImportedPyModules !== 'function') {
  window.collectImportedPyModules = function collectImportedPyModules(userCode) {
    const need = new Set();
    const code = String(userCode || "");
    // import a, b as x
    code.replace(/\bimport\s+([A-Za-z_][A-Za-z0-9_]*(?:\s*,\s*[A-Za-z_][A-Za-z0-9_]*)*)/g,
      (_, grp) => grp.split(',')
        .map(s => s.trim().split(/\s+as\s+/)[0])
        .forEach(n => need.add(n)));
    // from a import ...
    code.replace(/\bfrom\s+([A-Za-z_][A-Za-z0-9_]*)\s+import\b/g,
      (_, name) => need.add(name));
    const out = Object.create(null);
    const src = (window.__uploadedPyForHex || {});
    for (const n of need) if (n in src) out[n] = src[n];
    return out; // { modulname: source }
  };
}


// ==== Inline-Modul-Bundler für Calliope-HEX ====
// Idee: Hochgeladene .py-Dateien (z.B. servo.py) werden
//       vor dem User-Code als "echte" Inline-Module eingebaut.
//       Ergebnis in main.py:
//
//       # --- auto-inlined module: servo ---
//       import sys as __sys
//       class __InlineModule(object): ...
//       __g = {"__name__": "servo"}
//       exec("<servo-quelltext>", __g)
//       __m = __InlineModule()
//       ... Attribute übertragen ...
//       __sys.modules["servo"] = __m
//       # --- end auto-inlined module: servo ---
//
//       <dein Editor-Code mit "import servo", "from servo import Servo", …>

function buildInlineUploadedModules(userCode) {
  try {
    const uploads = window.__uploadedPyForHex || {};
    const code = String(userCode || "");

    // Welche Module werden im User-Code importiert?
    const imported = window.collectImportedPyModules
      ? window.collectImportedPyModules(code)
      : {};
    const modNames = Object.keys(imported || {});
    if (!modNames.length) return code;

    const inlineParts = [];

    for (const name of modNames) {
      if (!name) continue;

      const keyExact = name;
      const keyLower = name.toLowerCase();

      const src =
        uploads[keyExact] != null ? uploads[keyExact] :
          uploads[keyLower] != null ? uploads[keyLower] :
            null;

      if (!src) continue;

      let cleanSrc = String(src).replace(/^\uFEFF/, "");
      if (!cleanSrc.trim()) continue;

      // Quelltext sicher als String-Literal einbetten
      const srcLit = JSON.stringify(cleanSrc);

      inlineParts.push(
        `# --- auto-inlined module: ${name} ---\n` +
        `import sys as __sys\n` +
        `class __InlineModule(object):\n` +
        `    pass\n` +
        `__g = {"__name__": "${name}"}\n` +
        `try:\n` +
        `    exec(${srcLit}, __g)\n` +
        `except Exception as __e:\n` +
        `    print("INLINE EXEC FAIL: ${name}", __e)\n` +
        `else:\n` +
        `    __m = __InlineModule()\n` +
        `    for __k, __v in __g.items():\n` +
        `        if __k.startswith("__") and __k not in ("__name__",):\n` +
        `            continue\n` +
        `        setattr(__m, __k, __v)\n` +
        `    __m.__name__ = "${name}"\n` +
        `    __sys.modules["${name}"] = __m\n` +
        `# --- end auto-inlined module: ${name} ---\n`
      );
    }

    if (!inlineParts.length) return code;

    const inlineBlock = inlineParts.join("\n") + "\n";
    try {
      console.log("[Bundler] inline modules:", modNames);
    } catch { }

    // WICHTIG: User-Code bleibt unverändert (inkl. "import servo", "from servo import Servo", …)
    return inlineBlock + code;
  } catch (e) {
    console.warn("[InlineBundle] Fehler beim Inlinen hochgeladener Module:", e);
    return String(userCode || "");
  }
}




if (typeof window.getBundledPy !== "function") {
  window.getBundledPy = async function getBundledPy() {
    // 1) User-Code aus dem Editor holen
    const code =
      (window.editor?.getValue?.() ||
        window.cmEditor?.getValue?.() ||
        document.querySelector('#editor, textarea[name="code"], textarea[data-role="editor"]')?.value ||
        ""
      ).toString();


    // 2) alle hochgeladenen Klassen inline einbauen (allgemein für alle .py)
    const bundled = buildInlineUploadedModules(code);

    // 3) fertigen Python-Text zurückgeben
    return bundled;
  };
}



// --- Upload-Container für HEX-Module sicherstellen ---
window.__uploadedPyForHex = window.__uploadedPyForHex || Object.create(null);

// Wiederherstellung der Upload-Module aus localStorage (überlebt Reloads)
(function restoreUploadedPyForHexFromLS() {
  try {
    const raw = localStorage.getItem("calliope.uploadedPyForHex");
    if (!raw) return;
    const bag = JSON.parse(raw);
    const dst = window.__uploadedPyForHex || (window.__uploadedPyForHex = Object.create(null));
    for (const k of Object.keys(bag)) {
      dst[k] = String(bag[k] || "");
    }
    console.log("[Calliope-Bundle] restore from LS:", Object.keys(dst));
  } catch (e) {
    console.warn("[Calliope-Bundle] restoreUploadedPyForHexFromLS failed:", e);
  }
})();

// --- Mapping: welche Upload-Module sollen als Dateien ins HEX? ---
window.getImportedModuleFiles = async function getImportedModuleFiles() {
  // aktuellen Editor-Code holen
  const raw = (
    window.editor?.getValue?.() ||
    window.cmEditor?.getValue?.() ||
    document.querySelector('#editor, textarea[name="code"], textarea[data-role="editor"]')?.value ||
    ''
  ).toString();

  // welche Module werden importiert? (z.B. "servo")
  const mods = window.collectImportedPyModules
    ? window.collectImportedPyModules(raw)
    : {};
  const modNames = Object.keys(mods || {});

  const uploads = window.__uploadedPyForHex || {};
  const out = {};

  for (const name of modNames) {
    if (!name) continue;
    const keyExact = name;
    const keyLower = name.toLowerCase();

    // passende Upload-Quelle suchen (servo vs Servo)
    const src =
      uploads[keyExact] != null ? uploads[keyExact] :
        uploads[keyLower] != null ? uploads[keyLower] :
          null;

    if (!src) continue;

    // Dateiname für das HEX: immer klein, ohne /lib-Verzeichnis
    const fname = keyLower + ".py";
    out[fname] = src;
  }

  try {
    console.log("[Bundler] extraFiles:", Object.keys(out));
  } catch { }
  return out;
};

(function wireUploadForHex() {
  const inp = document.getElementById('file-input');
  if (!inp) return;
  inp.addEventListener('change', async (ev) => {
    const files = Array.from(ev.target.files || []);
    for (const f of files) {
      const name = String(f.name || "").trim();
      if (!/\.py$/i.test(name)) continue;
      const mod = name.replace(/\.py$/i, "");
      const txt = (await f.text()).replace(/^\uFEFF/, "");
      window.__uploadedPyForHex[mod] = txt;
      window.__uploadedPyForHex[mod.toLowerCase()] = txt;
      try {
        localStorage.setItem("calliope.uploadedPyForHex", JSON.stringify(window.__uploadedPyForHex));
      } catch { }
    }
    console.log('[Calliope-Bundle] uploaded .py:', Object.keys(window.__uploadedPyForHex));
  });
})();

(function () {
  // (B) Inline-Installer und Import-Erkennung
  console.log("[IDE] scripts.js geladen");
  // ---- Browser-Tauglichkeit für Calliope prüfen ----
  function __isIOSiPadOS() {
    try {
      return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    } catch { return false; }
  }
  function __isSecureContextOk() {
    try { return location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1'; } catch { return false; }
  }
  function __isChromiumFamily() {
    try { return !!window.chrome || /Edg\//.test(navigator.userAgent) || /Chromium/i.test(navigator.userAgent); } catch { return false; }
  }
  function isSuitableCalliopeBrowser() {
    // WebUSB oder WebSerial erforderlich; nur in sicheren Kontexte; kein iOS Safari
    const hasWebUSB = !!(navigator && navigator.usb);
    const hasWebSerial = !!(navigator && navigator.serial);
    return __isSecureContextOk() && __isChromiumFamily() && !__isIOSiPadOS() && (hasWebUSB || hasWebSerial);
  }
  function explainUnsuitableBrowser(kind) {
    const why = [];
    if (!__isSecureContextOk()) why.push('• Seite muss über HTTPS oder localhost laufen');
    if (!__isChromiumFamily()) why.push('• Bitte Chrome/Edge (Chromium) verwenden');
    if (__isIOSiPadOS()) why.push('• iOS/iPadOS Safari unterstützt WebUSB/WebSerial nicht ausreichend');
    if (!(navigator && (navigator.usb || navigator.serial))) why.push('• Browser bietet weder WebUSB noch Web Serial an');
    const msg = [
      `Calliope ${kind === 'c3' ? '3' : '1/2'} benötigt einen geeigneten Browser:`,
      '  - Chrome/Edge (Chromium) auf Desktop',
      '  - HTTPS oder localhost',
      '  - WebUSB oder Web Serial',
      '',
      ...(why.length ? ['Grund:', ...why] : [])
    ].join('\n');
    try { alert(msg); } catch { }
  }
  // --- Worker-Diagnose-Logger ---
  window.__WK_DIAG = true; // zum Ausschalten auf false setzen
  function wkLog(...args) {
    if (!window.__WK_DIAG) return;
    try { console.log("[WK]", ...args); } catch { }
  }
  // --- Worker-Flags + Mini-Client ---
  window.USE_PYODIDE_WORKER = true;
  window.PY_WORKER_URL = "lib/workers/py-worker.js";// ← Pfad zu deiner Worker-Datei anpassen
  let hasUserFiles = false;

  // Falls noch nicht vorhanden: sehr kleiner Client für den Worker
  if (!window.PyClient) {
    class PyClient {
      constructor(workerUrl) {
        this.w = new Worker(workerUrl, { type: 'classic' });
        this.reqId = 0;
        this.wait = new Map();
        this.handlers = {};
        this.w.onmessage = (ev) => {
          const msg = ev.data || {};
          if ('event' in msg) {
            const list = this.handlers[msg.event] || [];
            list.forEach(fn => { try { fn(msg); } catch { } });
            return;
          }
          const { id, ok } = msg;
          if (!id || !this.wait.has(id)) return;
          const { resolve, reject } = this.wait.get(id);
          this.wait.delete(id);
          ok ? resolve(msg) : reject(new Error(msg?.error?.message || 'Worker error'));
        };
      }
      on(event, fn) { (this.handlers[event] ||= []).push(fn); }
      _call(type, payload = {}) {
        const id = ++this.reqId;
        const msg = { id, type, ...payload };
        return new Promise((resolve, reject) => {
          this.wait.set(id, { resolve, reject });
          this.w.postMessage(msg);
        });
      }
      init(packages = [], indexURL) { return this._call('init', { packages, indexURL }); }
      loadPackages(packages = []) { return this._call('loadPackages', { packages }); }
      async run(code) { const r = await this._call('run', { code }); return r.result; }
      interrupt() { return this._call('interrupt'); }
      reset(indexURL) { return this._call('reset', { indexURL }); }
    }
    window.PyClient = PyClient;
  }
  // ========== Pyodide + IO ==========
  let pyodide;
  const outEl = document.getElementById("output");

  // --- ensure shapely package (Pyodide >=0.29: loadPackage, else fallback to micropip) ---
  async function ensureShapely(py) {
    // Prefer built-in Pyodide package if available (Pyodide >= 0.29)
    try {
      await py.loadPackage("shapely");
      console.log("[pyodide] shapely via loadPackage ready");
      return true;
    } catch (e1) {
      console.warn("[pyodide] shapely loadPackage failed, trying micropip:", e1);
    }

    // Fallback: install via micropip (older / custom builds)
    try {
      await py.loadPackage("micropip");
      await py.runPythonAsync(`
import micropip
await micropip.install("shapely")
`);
      console.log("[pyodide] shapely via micropip ready");
      return true;
    } catch (e2) {
      console.warn("[pyodide] shapely install failed:", e2);
      return false;
    }
  }



  window.isWorkerMode = () => window.pyBackend?.kind === "worker";
  window.isMainMode = () => window.pyBackend?.kind === "main";
  // Zentrale Pyodide-URL (nur 1x definieren)
  window.PYODIDE_URL = "https://cdn.jsdelivr.net/pyodide/v0.29.0/full/";


  // In Main: echtes FS; im Worker: null (nicht verfügbar)
  window.getFS = () => {
    if (window.isMainMode && window.isMainMode()) return window.pyodide?.FS ?? null;
    // Worker: benutze das vorbereitete Main-Pyodide als FS-Host
    return window.__mainPy?.FS ?? null;
  };

  // Sichtbares Label (Debug)
  window.showBackendBadge = function () {
    const el = document.getElementById("backend-badge");
    if (!el) return;
    el.textContent = isWorkerMode() ? "Pyodide: Worker" : "Pyodide: Main";
  };

  function __appendOut(t) {
    if (!t) return;
    const out = document.getElementById("output");
    if (!out) return;

    // \n → <br>, dann auf genau 1 <br> zusammenfalten
    let html = String(t).replace(/\r\n|\r|\n/g, "<br>");
    html = html.replace(/(?:<br>\s*){2,}/g, "<br>");
    if (!html || html === "<br>") return; // wirklich leere Ausgaben ignorieren

    out.insertAdjacentHTML("beforeend", `<div class="out-line">${html}</div>`);
    out.scrollTop = out.scrollHeight;
  }

  // stdout / stderr global einmal fest verdrahten
  if (!window.__py_stdout__) {
    window.__py_stdout__ = (txt) => {
      if (!txt) return;
      const el = document.getElementById("output");
      if (!el) return;
      const html = String(txt).replace(/\r\n|\r|\n/g, "<br>");
      el.insertAdjacentHTML("beforeend", `<div>${html}</div>`);
      el.scrollTop = el.scrollHeight;
    };
  }
  if (!window.__py_stderr__) {
    window.__py_stderr__ = (txt) => {
      if (!txt) return;
      const el = document.getElementById("output");
      if (!el) return;
      const html = String(txt).replace(/\r\n|\r|\n/g, "<br>");
      el.insertAdjacentHTML("beforeend", `<div class="text-danger">${html}</div>`);
      el.scrollTop = el.scrollHeight;
    };
  }

  // ===== Python input()-Hook (Browser) =====
  // NOTE:
  // input() is always implemented via window.prompt().
  // DOM-based inputs (modals, output fields) are intentionally not used
  // because pygame/SDL can permanently capture keyboard focus in browsers.
  if (!window.__py_input__) {
    window.__py_input__ = function (promptText = "") {
      try {
        const v = window.prompt(String(promptText ?? ""));
        if (v === null) return "";
        return String(v);
      } catch {
        return "";
      }
    };
  }

  const __INPUT_PATCH__ = `
import builtins
from js import __py_input__

def __netbuch_input(prompt=''):
    try:
        return str(__py_input__(str(prompt)))
    except Exception:
        return ''

builtins.input = __netbuch_input
`;

  async function __ensureInputPatchedOnMain() {
    if (window.__inputPatched) return;

    // Wait until main pyodide exists (bootPyodide() may still be running)
    let py = window.pyodide || window.__mainPy;
    for (let i = 0; i < 60 && (!py || typeof py.runPythonAsync !== "function"); i++) {
      await new Promise(r => setTimeout(r, 50));
      py = window.pyodide || window.__mainPy;
    }

    if (!py || typeof py.runPythonAsync !== "function") {
      console.error("[input] patch FAILED: main pyodide not ready (window.pyodide/window.__mainPy missing)");
      throw new Error("main pyodide not ready");
    }

    await py.runPythonAsync(__INPUT_PATCH__);
    window.__inputPatched = true;
    console.log("[input] patched builtins.input (prompt)");
  }

  function needsCanvasOrDOM(src) {
    const t = String(src || "");

    // 1) Echte Grafik-Bibliotheken (mit Wortgrenzen)
    if (/(?:^|\W)(?:from\s+matplotlib\b|import\s+matplotlib\b)/i.test(t)) return true;
    if (/(?:^|\W)(?:from\s+pygame\b|import\s+pygame\b)/i.test(t)) return true;
    if (/(?:^|\W)(?:from\s+(?:turtle|jturtle|gturtle)\b|import\s+(?:turtle|jturtle|gturtle)\b)/i.test(t)) return true;
    if (/(?:^|\W)(?:from\s+PIL\b|import\s+PIL\b|Image\s*\.\s*open\s*\()/i.test(t)) return true; // Pillow
    if (/(?:^|\W)(?:from\s+wordcloud\b|import\s+wordcloud\b)/i.test(t)) return true;

    // 2) Turtle-APIs nur als Funktionsaufrufe (verhindert false positives)
    if (/\b(forward|backward|right|left|penup|pendown|bgcolor|speed)\s*\(/i.test(t)) return true;

    // KEINE JS-Bridge, KEIN plt.-Heuristik mehr (nur echter matplotlib-Import)
    return false;
  }
  // Benötigt der Code Zugriff auf Dateien? (relative open(), PIL.Image.open, np.load, plt.imread, WordCloud-Masken)
  // Wenn ja und es gibt hochgeladene Dateien, dann im Main ausführen (dort ist das FS).
  function needsFilesystem(src) {
    const t = String(src || "");
    const hintsFS = /\bopen\s*\(\s*["'][^/]["']|Image\.open\s*\(|np\.load\s*\(|plt\.imread\s*\(|WordCloud\s*\(.*mask\s*=/is;
    return hintsFS.test(t);  // <— KEIN hasUpload mehr
  }

  function needsInput(src) {
    return /\binput\s*\(/.test(String(src || ""));
  }

  function maybeAutoWrapInputSafari(userCode) {
    return String(userCode || "");
  }

  // === Pygame Async-Compat: auto-wrap top-level loops into async main ===
  // Browser/Pyodide needs periodic yielding (await asyncio.sleep(0)).
  // We only inject `await` inside an async function to avoid SyntaxError.
  function hasExplicitMain(code) {
    const t = String(code || "");
    return /^(\s*)(?:async\s+def|def)\s+main\s*\(/m.test(t) || /__name__\s*==\s*["']__main__["']/.test(t);
  }

  function looksLikeTopLevelGameLoop(code) {
    const t = String(code || "");
    const hasPygame = /(?:^|\W)(?:import\s+pygame\b|from\s+pygame\b\s+import\b)/m.test(t);
    const hasSasPygame = /(?:^|\W)(?:import\s+sas_pygame\b|from\s+sas_pygame\b\s+import\b)/m.test(t);
    // Match a truly top-level while-loop header (column 0), including dotted names like `while view.running:`
    // while erkennen (auch eingerückt, z.B. in def main())
    const hasAnyWhile = /^\s*while\s+.+:\s*$/m.test(t);
    if (!hasAnyWhile) return null;
    return (hasPygame || hasSasPygame) && hasAnyWhile;
  }

  function indentBlock(src, spaces) {
    const pad = " ".repeat(spaces);
    return String(src || "")
      .split(/\r\n|\r|\n/)
      .map(line => (line.length ? pad + line : line))
      .join("\n");
  }

  // Wraps all top-level executable statements into `async def main(): ...` and calls it.
  // Also injects `await asyncio.sleep(0)` after clock.tick(...) / pygame.display.flip() inside that main loop.
  function wrapTopLevelIntoAsyncMain(userCode) {
    const code = String(userCode || "").replace(/\r\n/g, "\n");

    // If user already has a main / __main__ guard, do NOT touch.
    if (hasExplicitMain(code)) return code;

    const lines = code.split("\n");
    const keep = [];
    const body = [];

    // Keep shebang/encoding/comments/imports/def/class blocks at top.
    let i = 0;
    while (i < lines.length) {
      const ln = lines[i];
      if (/^\s*$/.test(ln)) { keep.push(ln); i++; continue; }
      if (/^\s*#/.test(ln)) { keep.push(ln); i++; continue; }
      if (/^\s*(?:from\s+\S+\s+import\b|import\s+\S+)/.test(ln)) { keep.push(ln); i++; continue; }

      if (/^\s*(?:def|async\s+def|class)\s+/.test(ln)) {
        keep.push(ln);
        i++;
        while (i < lines.length) {
          const ln2 = lines[i];
          if (/^\s*$/.test(ln2)) { keep.push(ln2); i++; continue; }
          // Stop at next real top-level statement
          if (/^\S/.test(ln2) &&
            !/^\s*#/.test(ln2) &&
            !/^\s*(?:from\s+\S+\s+import\b|import\s+\S+)/.test(ln2) &&
            !/^\s*(?:def|async\s+def|class)\s+/.test(ln2)) break;
          keep.push(ln2);
          i++;
        }
        continue;
      }
      break;
    }

    for (; i < lines.length; i++) body.push(lines[i]);

    // Normalize body: remove ONLY leading/trailing empty lines, preserve inner spacing
    let bodyText = body.join("\n");
    bodyText = bodyText.replace(/^([ \t]*\n)+/, "");   // strip leading blank lines
    bodyText = bodyText.replace(/(\n[ \t]*)+$/, "");   // strip trailing blank lines
    // Normalize tabs to spaces to avoid mixed indentation errors after injection
    bodyText = bodyText.replace(/\t/g, "    ");
    if (!bodyText.replace(/[\s\n]+/g, "").length) return code;

    // Inject yields after tick/flip/step (we'll indent later), preserving indentation
    const injected = bodyText
      // after clock.tick(...): keep same indentation as the tick line
      .replace(/^(\s*)(\w+\s*\.\s*tick\s*\([^\)]*\)\s*)$/gm, "$1$2\n$1await asyncio.sleep(0)")
      // after pygame.display.flip(): keep same indentation as the flip line
      .replace(/^(\s*)(pygame\s*\.\s*display\s*\.\s*flip\s*\(\s*\)\s*)$/gm, "$1$2\n$1await asyncio.sleep(0)")
      // after sas_pygame view.step() (and similar): yield once per frame so the browser UI can't freeze
      .replace(/^([\t ]*)([A-Za-z_][\w]*(?:\s*\.\s*[A-Za-z_][\w]*)*\s*\.\s*step\s*\([^\)]*\)\s*)(#.*)?$/gm, "$1$2$3\n$1await asyncio.sleep(0)");

    const prelude = [
      "# --- auto-wrapped by IDE for browser pygame compatibility ---",
      "import asyncio",
      "import pygame",
      "",
      "async def main():",
      indentBlock(injected, 4),
      "",
      "await main()",
      "# --- end auto-wrapped ---",
      ""
    ].join("\n");

    let keepText = keep.join("\n");
    if (keepText && !keepText.endsWith("\n")) keepText += "\n";
    if (keepText && !/\n\s*\n$/.test(keepText)) keepText += "\n";

    return keepText + prelude;
  }

  function maybeAutoWrapPygame(code) {
    try {
      const t = String(code || "");
      if (!looksLikeTopLevelGameLoop(t)) return t;
      return wrapTopLevelIntoAsyncMain(t);
    } catch {
      return String(code || "");
    }
  }
  // === /Pygame Async-Compat ===

  // === [A1] Bekannt: KEINE lokalen .py daneben (nicht einsammeln)
  const WELL_KNOWN = new Set([
    "math", "random", "time", "sys", "os", "asyncio", "types", "json", "re", "itertools",
    "pygame", "matplotlib", "numpy", "pandas", "shapely", "PIL", "wordcloud",
    "jturtle", "gturtle"
  ]);

  // === [A2] einfache lokale Importe parsen: import foo / from foo import ...
  function parseLocalImports(code) {
    const names = new Set();
    const rx1 = /^\s*import\s+([a-zA-Z_][\w]*)/gm;
    const rx2 = /^\s*from\s+([a-zA-Z_][\w]*)\s+import\s+/gm;
    let m;
    while ((m = rx1.exec(code))) names.add(m[1]);
    while ((m = rx2.exec(code))) names.add(m[1]);
    return [...names].filter(n => !n.includes(".") && !WELL_KNOWN.has(n));
  }

  // === [A3] Sibling-Datei versuchen: <ordner>/<name>.py oder .py.txt
  async function tryFetchSibling(baseUrl, name) {
    const baseDir = baseUrl.replace(/[^/]+$/, "");
    const url = `${baseDir}${name}.py`;    // nur .py
    try {
      const r = await fetch(url, { cache: "no-store" });
      if (r.ok) return { url, code: await r.text() };
    } catch { }
    return null;
  }

  // Merke Kontext des zuletzt geladenen Beispiels (für Worker-Injektion)
  window.__lastExampleCtx = { baseUrl: null, modules: {} };

  // ==== Einfache Ein-Empfänger-Funktion für Code/Layout von extern (turtlewp etc.) ====
  (function () {
    let pendingPayload = null;

    function applyIncomingPayload(payload) {
      console.log("[Receiver] applyIncomingPayload aufgerufen:", payload);
      if (!payload || !payload.code) return;
      const code = String(payload.code || "");
      const lay = payload.layout || "canvas-output";
      console.log("[Receiver] Code-Länge:", code.length, "Layout:", lay); // Turtle = Grafik
      try {
        localStorage.setItem("ui.layout", lay);
      } catch { }
      try {
        window.applyLayoutByValue?.(lay);
      } catch { }
      // --- Hardware-Zustand wiederherstellen (Calliope 1/2/3) ---
      try {
        // Preferiere explizit mitgespeichertes Gerät; sonst letzten Zustand aus LS
        const hw =
          payload.device || localStorage.getItem("ui.device") || "none";
        if (typeof window.__setDeviceAndFire === "function") {
          window.__setDeviceAndFire(hw); // setzt Select + löst alle nötigen Events aus
        }
      } catch (e) {
        console.warn(
          "[Receiver] Gerät konnte nicht wiederhergestellt werden:",
          e
        );
      }

      // direkt setzen, oder puffern bis Monaco steht
      if (window.editor?.setValue) {
        console.log("[Receiver] Editor bereit → setValue");
        try {
          window.editor.setValue(code);
        } catch { }
      } else {
        pendingPayload = payload;
      }
    }

    // öffentlich verfügbar machen
    window.initExternalReceiver = function initExternalReceiver(opts = {}) {
      const senderOrigin = opts.senderOrigin || "https://net-schulbuch.de"; // <- deine Sender-Origin
      // (0) Neuer robuster Weg: transferKey -> sessionStorage('netbuch.pendingTransfer')
      try {
        const raw = sessionStorage.getItem("netbuch.pendingTransfer");
        if (raw) {
          const payload = JSON.parse(raw);
          sessionStorage.removeItem("netbuch.pendingTransfer");
          applyIncomingPayload(payload);
        }
      } catch (e) {
        console.warn("[Receiver] pendingTransfer parse failed:", e);
      }
      // (A) Erstöffnung: window.name auslesen
      try {
        const nm = String(window.name || "");
        if (nm.startsWith("NETBUCH_PAYLOAD:")) {
          const json = decodeURIComponent(escape(atob(nm.slice(16))));
          const payload = JSON.parse(json);
          applyIncomingPayload(payload);
          // Name zurücksetzen, damit benanntes Fenster weiter nutzbar bleibt
          window.name = opts.windowName || "NETBUCH_IDE";
        }
      } catch { }

      // (B) Laufender Tab: postMessage (PING/ACK/UPDATE)
      window.addEventListener("message", (ev) => {
        const d = ev.data || {};
        if (d.type === "PING") {
          try {
            ev.source?.postMessage?.({ type: "ACK" }, ev.origin);
          } catch { }
          return;
        }
        if (d.type === "UPDATE" && d.payload) {
          applyIncomingPayload(d.payload);
        }
      });

      // (C) Helfer zum späteren Leeren des Puffers (wenn Monaco bereit)
      window.__flushExternalPending = function () {
        if (pendingPayload) {
          const p = pendingPayload;
          pendingPayload = null;
          applyIncomingPayload(p); // setzt jetzt wirklich in den Editor
        }
      };
    };
  })();

  // --- Editor-Code setzen (Monaco oder Fallback) ---
  window.setEditorCode = function setEditorCode(txt) {
    try {
      if (window.editor && typeof window.editor.setValue === "function") {
        window.editor.setValue(txt || "");
        return true;
      }
      const ta = document.querySelector(
        '#editor textarea, textarea[name="code"]'
      );
      if (ta) {
        ta.value = txt || "";
        return true;
      }
    } catch { }
    return false; // Editor noch nicht bereit
  };

  window.setDevice = function setDevice(devKey) {
    // Guard: Calliope nur in geeigneten Browsern zulassen
    try {
      if ((devKey === 'c12' || devKey === 'c3') && !isSuitableCalliopeBrowser()) {
        explainUnsuitableBrowser(devKey);
        return; // Abbruch: nicht umschalten
      }
    } catch { }
    if (!devKey) return;
    if (typeof window.__setDeviceAndFire === 'function') {
      // Einziger Wahrheitsanker: index.html steuert Select + UI + Hooks
      window.__setDeviceAndFire(devKey);
    } else {
      // Fallback (falls jemand index.html solo benutzt)
      const sel = document.getElementById('device-select') || document.getElementById('geraet-select');
      if (!sel) return;
      const prev = sel.value;
      sel.value = devKey;
      sel.dispatchEvent(new Event('input', { bubbles: true }));
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };

  // --- Emscripten/SDL Heal (klein & defensiv) ---
  function healEmscriptenInput() {
    try {
      // Manche Builds hängen JSEvents an globalThis, andere an Module
      const JS = (globalThis.JSEvents) || (globalThis.Module && globalThis.Module.JSEvents);
      if (JS) {
        // Variante A: alles weg
        if (typeof JS.removeAllEventListeners === 'function') {
          JS.removeAllEventListeners();
        }
        // Variante B: gezielt pro Target (falls vorhanden)
        if (typeof JS.removeAllHandlersOnTarget === 'function') {
          try { JS.removeAllHandlersOnTarget(window); } catch { }
          try { JS.removeAllHandlersOnTarget(document); } catch { }
          try { JS.removeAllHandlersOnTarget(document.getElementById('canvas')); } catch { }
        }
      }
      // Canvas-Referenz für SDL/Emscripten aktualisieren (wichtig nach DOM-Replacements)
      if (globalThis.Module && document.getElementById('canvas')) {
        Module.canvas = document.getElementById('canvas');
      }
      // Empfang wieder öffnen
      const c = document.getElementById('canvas');
      if (c) {
        c.style.pointerEvents = 'auto';
        c.style.display = 'block';
        c.tabIndex = 0;
      }
    } catch (e) {
      // still friendly fail
      console.warn('[healEmscriptenInput] skipped:', e);
    }
  }
  // --- /Heal ---

  window.setLayout = function setLayout(name) {
    if (!name) return;
    const sel = document.getElementById("layout-select");
    if (sel) {
      sel.value = name;
      if (typeof window.onLayoutChange === "function")
        window.onLayoutChange(name);
      sel.dispatchEvent(new Event("input", { bubbles: true }));
      sel.dispatchEvent(new Event("change", { bubbles: true }));
      try {
        localStorage.setItem("ui.layout", name);
      } catch { }
    } else if (typeof window.onLayoutChange === "function") {
      window.onLayoutChange(name);
    }
  };


  window.__pgHandlers = window.__pgHandlers || null;

  // cleanup für pygame nach Programmende/Abbruch
  // cleanup für pygame nach Programmende/Abbruch
  async function safePygameCleanup() {
    try {
      // Canvas vom Pyodide-Backend abstöpseln, damit nichts mehr rendert
      try {
        pyodide?.canvas?.setCanvas2D?.(null);
      } catch { }
      if (!window.pyodide) return;
      await pyodide.runPythonAsync(`
import sys
if 'pygame' in sys.modules:
    try:
        import pygame
        pygame.quit()
    except Exception as e:
        print("[cleanup] pygame.quit() Fehler:", e)
    finally:
        try: del sys.modules['pygame']
        except Exception: pass
`);
    } catch (e) { }
  }
  window.safePygameCleanup = safePygameCleanup;

  function setLS(k, v) {
    try {
      localStorage.setItem(k, v);
    } catch { }
  }
  function getLS(k, dflt = null) {
    try {
      return localStorage.getItem(k) ?? dflt;
    } catch {
      return dflt;
    }
  }


  function wirePygameInputOnce(canvas) {
    if (window.__pgHandlers) return; // schon verdrahtet
    const ping = () => window.__activityPing?.();

    const handlers = {
      mousedown: (e) => {
        canvas.focus();
        if (e.button === 2) e.preventDefault();
        // "Schließen"-Hotzone (wie pygame_close_rect = (5,5,30,30))
        try {
          const r = canvas.getBoundingClientRect();
          const x = e.clientX - r.left;
          const y = e.clientY - r.top;
          if (e.button !== 2 && x >= 5 && y >= 5 && x <= 35 && y <= 35) {
            // Direkt QUIT an pygame posten (robust gegen DPR/Scaling)
            try {
              window.pyBackend?.runPython?.(
                "import pygame; pygame.event.post(pygame.event.Event(pygame.QUIT))"
              );
            } catch { }
            e.preventDefault();
            return; // nichts weiter verarbeiten
          }
        } catch { }
        // Rechtsklick unterdrücken
        ping();
      },
      mouseup: () => ping(),
      mousemove: () => ping(),
      touchstart: () => ping(),
      touchend: () => ping(),
      keydown: () => ping(),
      keyup: () => ping(),
      contextmenu: (e) => e.preventDefault(),
    };
    Object.entries(handlers).forEach(([type, fn]) => {
      canvas.addEventListener(type, fn, {
        passive: type !== "mousedown" && type !== "contextmenu",
      });
    });
    window.__pgHandlers = { canvas, handlers };
  }

  function unwirePygameInput() {
    const h = window.__pgHandlers;
    if (!h || !h.canvas) return;
    Object.entries(h.handlers).forEach(([type, fn]) => {
      h.canvas.removeEventListener(type, fn);
    });
    window.__pgHandlers = null;
  }

  function focusMonacoTextArea() {
    try {
      const root = window.editor?.getDomNode?.();
      const ta = root?.querySelector?.("textarea.inputarea");
      window.editor?.updateOptions?.({ readOnly: false });
      ta?.focus?.();
    } catch { }
  }

  // --- Pygame in Python sicher beenden (immer aufrufbar) ---
  async function pythonQuitPygame() {
    if (!pyodide) return;
    try {
      await pyodide.runPythonAsync(`
import sys
if 'pygame' in sys.modules:
    try:
        import pygame
        pygame.quit()
    except Exception:
        pass
`);
    } catch { }
  }

  window.pythonQuitPygame = pythonQuitPygame;
  // —— Pyodide FS Asset-Installer (resources + bundleZip) ——
  const PY_FS_BASE = "/home/pyodide";

  // --- SAS-Pygame (local /sas_pygame.py) ---
  // Loads /sas_pygame.py from site root into the active FS at /home/pyodide/sas_pygame.py
  // Runs only in MAIN (because pygame runs in main). No subdirectory search.
  async function ensureSasPygameInFS(py, outEl) {
    try {
      const FS = py?.FS;
      if (!FS) throw new Error("Pyodide-FS nicht verfügbar");

      try { FS.mkdir("/home"); } catch { }
      try { FS.mkdir("/home/pyodide"); } catch { }

      // Already present?
      let already = false;
      try {
        const list = FS.readdir("/home/pyodide");
        already = Array.isArray(list) && list.includes("sas_pygame.py");
      } catch { }

      if (!already) {
        const url = new URL("/sas_pygame.txt", document.baseURI).href;
        const r = await fetch(url, { cache: "no-store" });
        if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText}`);
        const code = await r.text();
        if (!String(code || "").trim()) throw new Error("sas_pygame.py ist leer");
        FS.writeFile("/home/pyodide/sas_pygame.py", new TextEncoder().encode(code));
        try { outEl?.insertAdjacentHTML?.("beforeend", `<div class="text-success">✅ sas_pygame.py geladen</div>`); } catch { }
      } else {
        try { outEl?.insertAdjacentHTML?.("beforeend", `<div class="text-muted">ℹ️ sas_pygame.py bereits vorhanden</div>`); } catch { }
      }
      return true;
    } catch (e) {
      console.warn("[sas_pygame] load failed:", e);
      try {
        outEl?.insertAdjacentHTML?.(
          "beforeend",
          `<div class="text-warning">⚠️ Konnte <code>/sas_pygame.py</code> nicht laden.<br><small>${(e && (e.message || e)) || e}</small></div>`
        );
      } catch { }
      return false;
    }
  }

  function codeNeedsSasPygame(src) {
    return /(?:^|\W)(?:import\s+sas_pygame\b|from\s+sas_pygame\b\s+import\b)/m.test(String(src || ""));
  }

  async function ensureSasPygameFileAvailable(py, outEl, code) {
    if (!codeNeedsSasPygame(code)) return;
    const targetPy = py || window.__mainPy || window.pyodide;
    if (!targetPy) return;

    let ok = await ensureSasPygameInFS(targetPy, outEl);
    if (ok) return;

    await new Promise(resolve => setTimeout(resolve, 120));
    await ensureSasPygameInFS(targetPy, outEl);
  }

  function getExampleBaseName(example) {
    try {
      return (
        example.file
          .replace(/\/[^/]+$/, "")
          .split("/")
          .pop() || "example"
      );
    } catch {
      return "example";
    }
  }
  function getExampleFileDir(example) {
    // z. B. "examples/stern/"
    return (example.file || "").replace(/[^/]+$/, "");
  }

  async function ensureDirTree(path) {
    const FS = window.getFS?.();
    if (!FS) return;
    const parts = String(path || "").split("/").filter(Boolean);
    let acc = "";
    for (let i = 0; i < parts.length - 1; i++) {
      acc += "/" + parts[i];
      try { FS.mkdir(acc); } catch (_) { /* existiert schon */ }
    }
  }

  async function fetchAsUint8(url) {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error(`HTTP ${r.status} für ${url}`);
    return new Uint8Array(await r.arrayBuffer());
  }

  function toTargetPath(example, srcPath) {
    // Nur Dateiname nehmen, keine Ordnerstruktur
    const base = srcPath.split("/").pop();
    return `/home/pyodide/${base}`;
  }

  async function installResourcesForExample(example) {
    const FS = window.getFS?.();
    const list = Array.isArray(example?.resources) ? example.resources : [];
    if (!list.length) return { files: 0, bytes: 0 };
    let files = 0,
      bytes = 0;

    for (const src of list) {
      const data = await fetchAsUint8(src);
      const target = toTargetPath(example, src);
      await ensureDirTree(target);
      FS.writeFile(target, data);
      files += 1;
      bytes += data.byteLength;
    }
    return { files, bytes };
  }

  async function installZipBundleForExample(example) {
    const FS = window.getFS?.();
    if (!FS) return { files: 0, bytes: 0 };
    const zipUrl = (example?.bundleZip || "").trim();
    if (!zipUrl) return { files: 0, bytes: 0 };

    const { default: JSZip } = await import(
      "https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm"
    );
    const buf = await (
      await fetch(zipUrl, { cache: "no-store" })
    ).arrayBuffer();
    const zip = await JSZip.loadAsync(buf);

    let files = 0,
      bytes = 0;

    const entries = Object.keys(zip.files);
    for (const name of entries) {
      const entry = zip.files[name];
      if (entry.dir) continue;
      const data = new Uint8Array(await entry.async("uint8array"));
      const target = toTargetPath(example, name.replace(/^\.?\//, ""));
      await ensureDirTree(target);
      FS.writeFile(target, data);
      files += 1;
      bytes += data.byteLength;
    }
    return { files, bytes };
  }

  async function installAllAssetsForExample(example) {
    const r1 = await installResourcesForExample(example);
    const r2 = await installZipBundleForExample(example);
    return {
      files: (r1.files || 0) + (r2.files || 0),
      bytes: (r1.bytes || 0) + (r2.bytes || 0),
      detail: { resources: r1, zip: r2 },
    };
  }

  // Schlanke, robuste Version
  async function rebuildPygameCanvasHard() {
    // 1) Pygame im Python-Runtime beenden
    try {
      const py = window.__mainPy || window.pyodide;
      if (py?.runPythonAsync) {
        await py.runPythonAsync(
          "import sys\nif 'pygame' in sys.modules:\n import pygame; pygame.quit()"
        );
      }
    } catch { }

    // 2) 2 Frames warten (wie in der Konsole)
    await new Promise(r => requestAnimationFrame(r));
    await new Promise(r => requestAnimationFrame(r));

    // 3) Emscripten/SDL-Listener lösen
    try {
      const JS = globalThis.JSEvents || globalThis.Module?.JSEvents;
      JS?.removeAllEventListeners?.();
      JS?.removeAllHandlersOnTarget?.(window);
      JS?.removeAllHandlersOnTarget?.(document);
      JS?.removeAllHandlersOnTarget?.(document.documentElement);
      JS?.removeAllHandlersOnTarget?.(document.body);
    } catch { }

    // 4) Frame/Canvas ersetzen
    const wrap = document.getElementById('canvas-wrap');
    if (wrap) {
      document.getElementById('pygame-frame')?.remove();
      document.getElementById('canvas')?.remove();
      const c = document.createElement('canvas');
      c.id = 'canvas';
      c.className = 'gfx-layer';
      Object.assign(c.style, {
        position: 'absolute', inset: '0',
        width: '100%', height: '100%',
        display: 'none', pointerEvents: 'none'
      });
      c.tabIndex = -1;
      wrap.appendChild(c);
    }

    // 5) Pyodide-Canvas-Refs lösen
    try { pyodide?.canvas?.setCanvas2D?.(null); } catch { }
    try { if (pyodide?._module) pyodide._module.canvas = null; } catch { }

    // 6) Fokus zurück in den Editor
    try {
      window.editor?.updateOptions?.({ readOnly: false });
      const ta = document.querySelector('#editor textarea.inputarea');
      (ta || document.getElementById('editor'))?.focus?.();
    } catch { }
  }

  window.rebuildPygameCanvasHard = rebuildPygameCanvasHard;

  function softResetAfterRun() {
    // 1) Canvas vom Backend entkoppeln
    try { pyodide?.canvas?.setCanvas2D?.(null); } catch { }
    try { if (pyodide?._module) pyodide._module.canvas = null; } catch { }

    // 2) Alle Canvas-Layer „zähmen“
    ["canvas", "turtleCanvas", "mplCanvas"].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.style.pointerEvents = "none";
      el.tabIndex = -1;
      try { el.blur(); } catch { }
      el.classList.remove("show");
      // CSS-Größe/Backings nicht verändern – nur Sichtbarkeit
    });

    // 3) Pygame-Frame + Titlebar GANZ SICHER ausblenden
    try {
      const frame = document.getElementById("pygame-frame");
      if (frame) {
        frame.classList.remove("show");   // evtl. von showLayer gesetzt
        frame.style.display = "none";
        frame.style.pointerEvents = "none";
      }
      const titlebar = document.getElementById("pygame-titlebar");
      if (titlebar) titlebar.style.display = "none";
    } catch { }

    // 4) Event-Listener auf dem Pygame-Canvas entfernen
    try { unwirePygameInput?.(); } catch { }

    // 5) Resize-Lock lösen (falls aktiv)
    try { window.__lockCanvasResize?.(false); } catch { }
    try { window.__canvasResizeLocked = false; } catch { }

    // 6) Editor wieder schreibbar machen + Fokus setzen
    try {
      const root = window.editor?.getDomNode?.();
      window.editor?.updateOptions?.({ readOnly: false });
      window.editor?.focus?.();
      setTimeout(() => root?.querySelector?.("textarea")?.focus?.(), 0);
    } catch { }

    // 7) Frame komplett entfernen (garantiert weg)
    try {
      const frame = document.getElementById('pygame-frame');
      if (frame && frame.parentNode) {
        frame.parentNode.removeChild(frame);
      }
    } catch { }

    // 8) Caption zurücksetzen (falls Element noch existiert)
    try {
      const cap = document.getElementById('pygame-caption');
      if (cap) cap.textContent = 'Mein Programm';
    } catch { }

    // 9) Sicherstellen, dass die alte Canvas-Node ersetzt wird (SDL-Grab lösen)
    try { window.rebuildPygameCanvasHard?.(); } catch { }
  }

  window.softResetAfterRun = softResetAfterRun;

  (function bootEditorOnce() {
    const STORAGE_KEY = "pythonide-editor-content";
    if (window.__editorBooted) return;
    window.__editorBooted = true;

    const editorEl = document.getElementById("editor");
    if (!editorEl) {
      console.error("[editor] #editor fehlt");
      return;
    }

    const startCode = sessionStorage.getItem(STORAGE_KEY) || "";

    // ---- Loader-Helfer (ohne Fallbacks) für CodeMirror 5 ----
    function loadScript(url) {
      return new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = url;
        s.async = true;
        s.onload = resolve;
        s.onerror = (e) => reject(new Error("Script-Load failed: " + url));
        document.head.appendChild(s);
      });
    }
    function loadCSS(url) {
      const l = document.createElement("link");
      l.rel = "stylesheet";
      l.href = url;
      document.head.appendChild(l);
    }

    function afterInit(commonAdapter) {
      // Gemeinsame Nach-Initialisierung für beide Editoren
      window.editor = commonAdapter;
      console.log("[Editor] initialisiert:", commonAdapter && (commonAdapter.__kind || "unknown"));

      // Puffer aus externen Transfers (falls vorhanden) übernehmen
      setTimeout(() => window.__flushExternalPending?.(), 0);
      setTimeout(() => window.__flushExternalPending?.(), 400);
      let hasUserFiles = false; // bleibt hier, damit alter Code unverändert funktioniert

      // Session-Persistenz von Uploads
      window.persistUploadsToLS = async function () {
        const bag = [];
        try {
          for (const [name, file] of (window.uploadedFiles || [])) {
            const content = await file.text();
            bag.push({ name, content, mime: file.type || "text/plain" });
          }
          try { localStorage.setItem("user.files.snapshot", JSON.stringify(bag)); } catch { }
        } catch (e) { console.warn("persistUploadsToLS failed:", e); }
      };

      // Notfall-Reset übernimmt bestehenden Code (nutzt commonAdapter.getValue)
      document
        .getElementById("emergency-reset-btn")
        ?.addEventListener("click", async () => {
          try {
            const code = commonAdapter.getValue();
            if (code && code.trim()) sessionStorage.setItem(STORAGE_KEY, code);
            else sessionStorage.removeItem(STORAGE_KEY);
          } catch { }
          try { localStorage.setItem('ui.device', document.getElementById('device-select')?.value || 'none'); } catch { }
          try {
            const FS = window.getFS();
            if (FS) {
              const files = FS.readdir("/home/pyodide").filter(f => f !== "." && f !== "..");
              for (const f of files) {
                const data = FS.readFile("/home/pyodide/" + f);
                localStorage.setItem("file_" + f, JSON.stringify(Array.from(data)));
              }
            }
          } catch { }
          await window.persistUploadsToLS?.();
          try {
            const leftEl = document.getElementById('left');
            if (leftEl) {
              const w = Math.round(leftEl.getBoundingClientRect().width);
              if (w > 0) localStorage.setItem('ui.splitX', String(w));
            }
          } catch { }
          try {
            const wrapEl = document.getElementById('canvas-wrap');
            if (wrapEl) {
              const h = Math.round(wrapEl.getBoundingClientRect().height);
              if (h > 0) localStorage.setItem('ui.canvasH', String(h));
            }
          } catch { }
          setLS("ui.wantRestore", "1");
          try {
            const wrap = document.getElementById("canvas-wrap");
            if (wrap) {
              const h = Math.max(120, Math.round((wrap.getBoundingClientRect().height || 0)));
              setLS("ui.canvasH", String(h));
            }
          } catch { }
          try { window.__abortFlag = false; } catch { }
          window.location.reload();
        });

      window.addEventListener("beforeunload", () => {
        try {
          const code = commonAdapter.getValue();
          if (code && code.trim()) sessionStorage.setItem(STORAGE_KEY, code);
        } catch { }
      });

      window.saveEditorToSession = function () {
        try {
          const code = commonAdapter.getValue();
          if (code && code.trim()) sessionStorage.setItem(STORAGE_KEY, code);
          else sessionStorage.removeItem(STORAGE_KEY);
        } catch { }
      };
      window.loadEditorFromSession = function () {
        commonAdapter.setValue(sessionStorage.getItem(STORAGE_KEY) || "");
      };
    }

    function isIOS() {
      return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    }

    async function initCodeMirror() {
      // nur das lokale ESM-Bundle (eine Datei)
      const { EditorView, basicSetup, python } =
        await import(new URL("lib/codemirror6/codemirror.js", document.baseURI).href);

      // Editor-Fläche
      editorEl.innerHTML = "";
      const cmView = new EditorView({
        doc: startCode,
        extensions: [basicSetup, python(), EditorView.lineWrapping],
        parent: editorEl,
      });

      // Adapter
      const adapter = {
        __kind: "codemirror6",
        getValue: () => cmView.state.doc.toString(),
        setValue: (v) => {
          const tx = cmView.state.update({
            changes: { from: 0, to: cmView.state.doc.length, insert: String(v || "") },
          });
          cmView.dispatch(tx);
        },
        focus: () => cmView.focus(),
        layout: () => { },
        updateOptions: () => { },
      };

      // Autosave
      const __dispatch = cmView.dispatch.bind(cmView);
      cmView.dispatch = (...args) => {
        const r = __dispatch(...args);
        try {
          const code = adapter.getValue();
          if (code && code.trim()) sessionStorage.setItem("pythonide-editor-content", code);
          else sessionStorage.removeItem("pythonide-editor-content");
        } catch { }
        return r;
      };

      // (optional) Sanity-Check – knallt sofort, wenn doch 2 Graphen vorhanden sind
      try {
        const probe = new EditorView({ extensions: [basicSetup], parent: document.createElement("div") });
        probe.destroy();
      } catch (err) {
        console.error("[Editor/CM6] Doppel-Import/Mischgraph erkannt – entferne alle weiteren CM-Script/Imports", err);
        throw err;
      }

      afterInit(adapter);
    }

    function initMonaco() {
      require.config({
        paths: { vs: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs" },
      });
      require(["vs/editor/editor.main"], function () {
        const editor = monaco.editor.create(editorEl, {
          value: startCode,
          language: "python",
          theme: "vs",
          automaticLayout: true,
          touchHandling: "auto",
          cursorBlinking: "smooth",
          wordWrap: "on",
          minimap: { enabled: false },
          fontSize: 14,
          tabSize: 4,
          insertSpaces: true,
        });
        editor.updateOptions({
          dragAndDrop: false,
          mouseWheelZoom: false,
          smoothScrolling: true,
          stickyScroll: { enabled: false },
        });

        // Autosave wie vorher
        editor.onDidChangeModelContent(function () {
          const code = editor.getValue();
          if (code && code.trim()) sessionStorage.setItem(STORAGE_KEY, code);
          else sessionStorage.removeItem(STORAGE_KEY);
        });

        const adapter = {
          __kind: "monaco",
          getValue: () => editor.getValue(),
          setValue: (v) => editor.setValue(v || ""),
          focus: () => editor.focus(),
          layout: () => editor.layout(),
          updateOptions: (opts) => editor.updateOptions(opts)
        };

        afterInit(adapter);
      });
    }

    // Desktop: Monaco, iPad/iOS: CodeMirror 6 (lokales Bundle)
    if (isIOS()) {
      console.log("[Editor] iOS erkannt → CodeMirror 6 (lokales Bundle)");
      initCodeMirror();
    } else {
      console.log("[Editor] Desktop erkannt → Monaco");
      initMonaco();
    }
  })();

  (function () {
    // --- Preset -> Device-Key ('none' | 'c12' | 'c3')
    function devKeyFromPreset(preset) {
      switch (String(preset || "").toLowerCase()) {
        case "calliope12":
          return "c12";
        case "calliope3":
          return "c3";
        case "text":
        case "grafik":
        default:
          return "none";
      }
    }



    /// --- Beim Laden nur Layout wiederherstellen (Device macht index.html/deviceWiring)
    function applyOnLoad() {
      let layout = "";
      try { layout = localStorage.getItem("ui.layout") || ""; } catch { }

      const sel = document.getElementById("layout-select");
      if (layout) {
        // zuerst Select optisch setzen …
        if (sel) sel.value = layout;
      } else {
        layout = "output";
        if (sel) sel.value = layout;
      }
      // … dann Layout anwenden
      if (typeof window.applyLayoutByValue === "function") {
        window.applyLayoutByValue(layout);
      }
    }

    // warten bis DOM + (falls vorhanden) Monaco da ist
    if (document.readyState === "loading") {
      document.addEventListener(
        "DOMContentLoaded",
        () => setTimeout(applyOnLoad, 0),
        { once: true }
      );
    } else {
      setTimeout(applyOnLoad, 0);
    }
  })();

  function restoreEditorFocusNow() {
    try {
      // 1) Canvas „zähmen“ und entkoppeln
      const c = document.getElementById("canvas");
      try {
        pyodide?.canvas?.setCanvas2D?.(null);
      } catch { }
      if (c) {
        c.style.pointerEvents = "none";
        c.tabIndex = -1;
        c.blur();
      }
      // 2) Event-Listener auf dem Canvas weg
      unwirePygameInput?.();

      // 3) Falls irgendein Element noch Focus hält → loslassen
      try {
        document.activeElement?.blur?.();
      } catch { }

      // 4) Editor wirklich fokussieren (mehrfach „anstupsen“)
      try {
        window.editor?.updateOptions?.({ readOnly: false });
        window.editor?.focus?.();
        setTimeout(() => window.editor?.focus?.(), 0);
        setTimeout(() => {
          const tn = window.editor?.getDomNode?.()?.querySelector?.("textarea");
          tn?.focus?.();
        }, 0);
      } catch { }
    } catch { }
  }
  // ---- Canvas-Layer helpers ----
  window.restoreEditorFocusNow = restoreEditorFocusNow;
  // --- Global: merken & steuern ---
  let __wrapRO = null; // dein ResizeObserver auf #canvas-wrap (falls nicht schon global)
  let __winResizeHandler = null; // dein window.resize-Handler
  let __savedCanvasCss = null; // gespeicherte CSS-Größen

  function getLayers() {
    return {
      turtle: document.getElementById("turtleCanvas"),
      pygame: document.getElementById("canvas"),
      mpl: document.getElementById("mplCanvas"),
      single: document.getElementById("mycanvas"),
    };
  }

  function showLayer(which) {
    const L = getLayers();
    const all = [L.turtle, L.pygame, L.mpl, L.single].filter(Boolean);
    all.forEach((el) => {
      if (!el) return;
      el.style.display = "none";
      el.style.pointerEvents = "none";
      el.classList.remove("show");     // <<< wichtig
    });
    const frame = document.getElementById("pygame-frame");
    const map = { turtle: L.turtle, pygame: L.pygame, mpl: L.mpl };
    const target = map[which] || L.single;

    // Alle Layer + Frame ausblenden
    [L.turtle, L.pygame, L.mpl, frame].forEach((el) => {
      if (!el) return;
      el.style.display = "none";
      el.style.pointerEvents = "none";
      el.classList?.remove("show");
    });

    // Pygame: Frame aktivieren, Canvas sichtbar machen
    if (which === "pygame" && frame) {
      frame.style.display = "flex";
      frame.style.pointerEvents = "auto";
      L.pygame.style.display = "block";
      L.pygame.style.pointerEvents = "auto";
      L.pygame.classList.add("show");
    } else if (target) {
      target.style.display = "block";
      target.style.pointerEvents = "auto";
      target.classList.add("show");
    }
    syncCanvasToWrap();
  }
  function getActiveCanvas() {
    const L = getLayers();
    const pref = [L.pygame, L.mpl, L.turtle].filter((el) =>
      el?.classList?.contains("show")
    )[0];
    return pref || L.pygame || L.turtle || L.mpl || L.single;
  }
  function clearAllCanvases() {
    const { turtle, pygame, mpl, single } = getLayers();

    // 1) Turtle-STATE löschen (wichtig!)
    if (typeof window.clearAllPaths === "function") {
      window.clearAllPaths();   // löscht paths[], setzt x/y/heading zurück, startet newPath()
    } else if (typeof window.turtleClear === "function") {
      window.turtleClear();
    }

    // 2) Pixel-Layer löschen (optional, aber ok)
    ;[turtle, /*pygame,*/ mpl, single].forEach((c) => {
      if (!c) return;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      if (ctx.setTransform) ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, c.width, c.height);
    });
  }

  const again = getLayers();
  [again.turtle, again.pygame, again.mpl].forEach(
    (cv) => cv && cv.classList.add("gfx-layer")
  );

  // --- Canvas-Stack einmalig sicherstellen ---
  window.ensureStackedCanvases = function ensureStackedCanvases() {
    const wrap = document.getElementById("canvas-wrap");
    if (!wrap) return;

    // Container vorbereiten
    if (!wrap.style.position) wrap.style.position = "relative";
    wrap.style.background = "#fff";

    // --- Basis-Canvas-Layer sicherstellen ---
    const ids = ["canvas", "turtleCanvas", "mplCanvas"];
    ids.forEach((id) => {
      let c = document.getElementById(id);
      if (!c) {
        c = document.createElement("canvas");
        c.id = id;
        wrap.appendChild(c);
      }
      c.classList.add("gfx-layer");
      // Positionierung/CSS-Größen für die Layer; der Pygame-Canvas
      // wird später im Frame auf "static" umgestellt.
      c.style.position = "absolute";
      c.style.inset = "0";
      c.style.width = "100%";
      c.style.height = "100%";
      c.style.display = "none";
      c.style.pointerEvents = "none";
    });

    // --- Pygame-Fensterrahmen (Frame mit Titelzeile + Close) ---
    let frame = document.getElementById("pygame-frame");
    if (!frame) {
      frame = document.createElement("div");
      frame.id = "pygame-frame";
      frame.classList.add("gfx-layer");
      // Anzeige wird über showLayer(...) gesteuert
      frame.style.display = "none";

      // Titlebar
      const titlebar = document.createElement("div");
      titlebar.id = "pygame-titlebar";

      const caption = document.createElement("span");
      caption.id = "pygame-caption";
      caption.textContent = "Mein Programm";
      const closeBtn = document.createElement("button");
      closeBtn.id = "pygame-close";
      closeBtn.type = "button";
      closeBtn.textContent = "×";
      closeBtn.addEventListener("click", () => {
        try {
          window.pyBackend?.runPython?.(
            "import pygame; pygame.event.post(pygame.event.Event(pygame.QUIT))"
          );
        } catch { }
        // UI sofort schließen; Python beendet sich parallel
        try { softResetAfterRun?.(); } catch { }
        window.rebuildPygameCanvasHard?.();
      });

      titlebar.appendChild(caption);
      titlebar.appendChild(closeBtn);
      frame.appendChild(titlebar);

      // Canvas in den Frame verschieben (einmalig)
      const pgCanvas = document.getElementById("canvas");
      if (pgCanvas && pgCanvas.parentNode !== frame) {
        // Im Frame soll der Canvas nicht absolut positioniert sein
        pgCanvas.style.position = "static";
        pgCanvas.style.display = "none";
        pgCanvas.style.pointerEvents = "none";
        frame.appendChild(pgCanvas);
      }

      // Frame in den Wrap einhängen (zentrieren/Optik per CSS)
      wrap.appendChild(frame);
    }

    // Nach dem Aufbau Größen/Backings synchronisieren
    if (typeof window.syncCanvasToWrap === "function") {
      window.syncCanvasToWrap();
    }
  };


  function __initUIAndBoot() {
    ensureStackedCanvases();
    syncCanvasToWrap();

    // --- Layout-Resizer initialisieren + gespeicherte Positionen anwenden ---
    (function setupLayoutResizers() {
      const work = document.getElementById("workarea");
      const left = document.getElementById("left");
      const right = document.getElementById("right");
      const resizerV = document.getElementById("resizer");     // vertikal (zwischen left/right)
      const wrap = document.getElementById("canvas-wrap");
      const resizerH = document.getElementById("resizer-h");   // horizontal (zwischen canvas/output)

      // Helpers
      const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
      const save = (k, v) => { try { localStorage.setItem(k, String(v)); } catch { } };
      const load = (k, d = 0) => {
        try { const x = parseInt(localStorage.getItem(k) || "", 10); return isNaN(x) ? d : x; }
        catch { return d; }
      };

      // Restore: vertikale Teilung (Editorbreite)
      try {
        const savedSplit = load("ui.splitX", 0);
        if (savedSplit > 0 && left) {
          left.style.flex = `0 0 ${savedSplit}px`;
          try { window.editor?.layout?.(); } catch { }
        }
      } catch { }

      // Restore: horizontale Teilung (Canvas-Höhe)
      try {
        const savedH = load("ui.canvasH", 0);
        if (savedH > 0 && wrap) {
          wrap.style.flex = `0 0 ${savedH}px`;
          try { window.syncCanvasToWrap?.(); } catch { }
        }
      } catch { }

      // Drag: vertikaler Resizer (#resizer)
      if (work && left && right && resizerV) {
        let dragging = false;

        const onMove = (ev) => {
          if (!dragging) return;
          const rect = work.getBoundingClientRect();
          const minLeft = 200;      // Mindestbreite Editor
          const minRight = 260;     // Mindestbreite rechte Seite
          const x = ev.clientX ?? (ev.touches?.[0]?.clientX || 0);
          const newW = clamp(x - rect.left, minLeft, rect.width - minRight);
          left.style.flex = `0 0 ${newW}px`;
          save("ui.splitX", newW);
          try { window.editor?.layout?.(); } catch { }
          try { window.syncCanvasToWrap?.(); } catch { }
        };

        const stop = () => {
          if (!dragging) return;
          dragging = false;
          document.removeEventListener("mousemove", onMove, true);
          document.removeEventListener("mouseup", stop, true);
          document.removeEventListener("touchmove", onMove);
          document.removeEventListener("touchend", stop);
          document.removeEventListener("touchcancel", stop)
        };

        resizerV.addEventListener("mousedown", (ev) => {
          dragging = true;
          document.addEventListener("mousemove", onMove, true);
          document.addEventListener("mouseup", stop, true);
          ev.preventDefault();
        });
        resizerV.addEventListener("touchstart", (ev) => {
          dragging = true;
          document.addEventListener("touchmove", onMove, { passive: false });
          document.addEventListener("touchend", stop, { passive: true });
          document.addEventListener("touchcancel", stop, { passive: true });
          ev.preventDefault();
        }, { passive: false });

        // Doppelklick = Reset (50%) + Speicher löschen
        resizerV.addEventListener("dblclick", () => {
          try { localStorage.removeItem("ui.splitX"); } catch { }
          left.style.flex = "0 0 50%";     // CSS-Default
          try { window.editor?.layout?.(); } catch { }
          try { window.syncCanvasToWrap?.(); } catch { }
        });
      }

      // Drag: horizontaler Resizer (#resizer-h)
      if (right && wrap && resizerH) {
        let draggingH = false;

        const onMoveH = (ev) => {
          if (!draggingH) return;
          const rect = right.getBoundingClientRect();
          const y = ev.clientY ?? (ev.touches?.[0]?.clientY || 0);
          const relY = y - rect.top;
          const minH = 120;
          const maxH = Math.max(minH, rect.height - 120);
          const newH = clamp(relY, minH, maxH);
          wrap.style.flex = `0 0 ${newH}px`;
          save("ui.canvasH", newH);
          try {
            window.syncCanvasToWrap?.();
            const r = wrap.getBoundingClientRect();
            window.applyCanvasAndPygameSize?.(Math.round(r.width), Math.round(r.height));
          } catch { }
        };

        const stopH = () => {
          if (!draggingH) return;
          draggingH = false;
          document.removeEventListener("mousemove", onMoveH, true);
          document.removeEventListener("mouseup", stopH, true);
          document.removeEventListener("touchmove", onMoveH);
          document.removeEventListener("touchend", stopH);
          document.removeEventListener("touchcancel", stopH);
        };

        resizerH.addEventListener("mousedown", (ev) => {
          draggingH = true;
          document.addEventListener("mousemove", onMoveH, true);
          document.addEventListener("mouseup", stopH, true);
          ev.preventDefault();
        });
        resizerH.addEventListener("touchstart", (ev) => {
          draggingH = true;
          document.addEventListener("touchmove", onMoveH, { passive: false });
          document.addEventListener("touchend", stopH, { passive: false });
          document.addEventListener("touchcancel", stopH, { passive: true });
          ev.preventDefault();
        }, { passive: false });

        // Doppelklick = Reset (Standard) + Speicher löschen
        resizerH.addEventListener("dblclick", () => {
          try { localStorage.removeItem("ui.canvasH"); } catch { }
          wrap.style.flex = "";            // CSS/Logik übernimmt wieder
          try { window.syncCanvasToWrap?.(); } catch { }
        });
      }
    })();


    const helpLink = document.getElementById('hilfe-btn');
    const frame = document.getElementById('helpFrame');
    const modal = document.getElementById('helpModal');
    const helpModal = new bootstrap.Modal(modal);
    // Klick-Handler
    helpLink.addEventListener('click', (e) => {
      e.preventDefault();             // keine Navigation
      frame.src = 'help/index.html';  // Seite ins iframe laden
      helpModal.show();               // Modal öffnen
    });         // Modal wirklich öffnen


    // Auto-fix: Wenn sas_pygame genutzt wird, aber `import pygame` fehlt,
    // dann `import pygame` automatisch ergänzen (robust gegen __future__-Imports).
    function autoImportPygameIfSas(code) {
      const src = String(code || "");
      const hasSas = /(?:^|\W)(?:import\s+sas_pygame\b|from\s+sas_pygame\b\s+import\b)/m.test(src);
      if (!hasSas) return src;

      const hasPygame = /(?:^|\W)(?:import\s+pygame\b|from\s+pygame\b\s+import\b)/m.test(src);
      if (hasPygame) return src;

      // Split into lines (LF normalized)
      const lines = src.replace(/\r\n/g, "\n").split("\n");

      // Keep shebang + encoding comment (first/second line) intact
      let i = 0;
      if (lines[0] && lines[0].startsWith("#!")) i = 1;
      if (lines[i] && /^#.*coding[:=]/i.test(lines[i])) i++;

      // Skip initial comments/blank lines
      while (i < lines.length && (/^\s*$/.test(lines[i]) || /^\s*#/.test(lines[i]))) i++;

      // Respect __future__ imports: they must come first in Python
      while (i < lines.length && /^\s*from\s+__future__\s+import\b/.test(lines[i])) i++;

      // Insert import pygame here
      lines.splice(i, 0, "import pygame");
      return lines.join("\n");
    }
    // ========================================
    // Hard-Freeze Schutz (Preflight-Prüfung)
    // Verhindert UI-Blockade durch Top-Level while ohne Yield
    // ========================================
    function preflightFreezeGuard(code) {
      const t = String(code || "");

      // Nur prüfen, wenn pygame oder sas_pygame benutzt wird
      const importsPygameLike =
        /(?:^|\W)(?:import\s+pygame\b|from\s+pygame\b\s+import\b|import\s+sas_pygame\b|from\s+sas_pygame\b\s+import\b)/m.test(t);

      if (!importsPygameLike) return null;

      // while-Schleifen erkennen (auch eingerückt, z.B. in def main())
      const hasAnyWhile = /^\s*while\s+.+:\s*$/m.test(t);
      if (!hasAnyWhile) return null;

      // Sichere Yield-Punkte erkennen
      const hasStepCall = /\.step\s*\(/m.test(t);
      const hasTickCall = /\.tick\s*\(/m.test(t);
      const hasFlipCall = /pygame\s*\.\s*display\s*\.\s*flip\s*\(/m.test(t);
      const hasAwait = /\bawait\b/m.test(t);

      if (hasStepCall || hasTickCall || hasFlipCall || hasAwait) {
        return null; // wahrscheinlich sicher
      }

      // Häufiger Schülerfehler: view.step ohne Klammern
      const stepWithoutCall = /\.step\b(?!\s*\()/m.test(t);
      if (stepWithoutCall) {
        return "Du hast 'view.step' ohne Klammern geschrieben.\n" +
          "Es muss 'view.step()' heißen, sonst friert der Browser ein.";
      }

      return "Endlosschleife ohne view.step(), tick(), flip() oder await erkannt.\n" +
        "Das Programm wurde NICHT gestartet, um einen Browser-Freeze zu verhindern.";
    }

    window.__pythonRunActive = window.__pythonRunActive || false;
    window.__pythonRunPromise = window.__pythonRunPromise || null;

    window.__nextRunShouldFocusCanvas = false;

    function focusRuntimeSurfaceAfterRun() {
      const canvasIds = ["canvas", "turtleCanvas", "mplCanvas"];
      let focused = false;

      for (const id of canvasIds) {
        const el = document.getElementById(id);
        if (!el) continue;
        try {
          if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "0");
          el.focus({ preventScroll: true });
          focused = (document.activeElement === el) || focused;
        } catch {
          try {
            el.focus();
            focused = (document.activeElement === el) || focused;
          } catch { }
        }
        if (focused) break;
      }

      if (!focused) {
        try { window.restoreEditorFocusNow?.(); } catch { }
      }
    }

    async function stopCurrentPythonProgramBeforeRun() {
      if (!window.__pythonRunActive && !window.__pythonRunPromise) return;

      try { window.__abortFlag = true; } catch { }

      try {
        if (window.pyBackend?.interrupt) {
          await window.pyBackend.interrupt();
        }
      } catch { }

      try { await window.pythonQuitPygame?.(); } catch { }
      try { await window.safePygameCleanup?.(); } catch { }
      try { window.softResetAfterRun?.(); } catch { }
      try { await window.rebuildPygameCanvasHard?.(); } catch { }
      try {
        if (!window.__nextRunShouldFocusCanvas) window.restoreEditorFocusNow?.();
      } catch { }

      try {
        if (window.__pythonRunPromise) {
          await Promise.race([
            window.__pythonRunPromise.catch(() => { }),
            new Promise((resolve) => setTimeout(resolve, 200))
          ]);
        }
      } catch { }

      window.__pythonRunActive = false;
      window.__pythonRunPromise = null;
      try { window.__abortFlag = false; } catch { }
    }

    document.getElementById("run-icon")?.addEventListener("click", async () => {
      const runBtn = document.getElementById("run-icon");
      window.__nextRunShouldFocusCanvas = true;

      if (window.__pythonRunActive || window.__pythonRunPromise) {
        await stopCurrentPythonProgramBeforeRun();
      }

      window.__pythonRunActive = true;
      window.__pythonRunPromise = (async () => {
        // Tooltip des Start-Buttons sofort schließen
        try {
          if (window.bootstrap && runBtn) bootstrap.Tooltip.getOrCreateInstance(runBtn).hide();
          runBtn?.blur?.();
        } catch { }

        const outEl = document.getElementById("output");
        let code = window.editor?.getValue?.() ?? "";
        outEl.innerHTML = "";
        await ensureSasPygameFileAvailable(window.__mainPy || window.pyodide, outEl, code);
        code = autoImportPygameIfSas(code);
        const freezeMsg = preflightFreezeGuard(code);
        if (freezeMsg) {
          try {
            __appendOut("\n❌ Sicherheitsabbruch:\n" + freezeMsg + "\n");
          } catch {
            try { outEl.insertAdjacentHTML("beforeend", `<div class=\"text-danger\">❌ Sicherheitsabbruch:<br>${String(freezeMsg).replace(/\n/g, '<br>')}</div>`); } catch { }
          }
          return;
        }
        try {
          // Wenn input() vorkommt, muss der Main-Patch aktiv sein (sonst druckt builtin input() den Prompt in den Output).
          if (needsInput(code)) {
            await __ensureInputPatchedOnMain();
          }
          await ensureSasPygameFileAvailable(window.__mainPy || window.pyodide, outEl, code);
          const __maybeWrapped = maybeAutoWrapPygame(code);
          await runUserCode(__maybeWrapped);
        } finally {
          // WICHTIG: identisches Timing wie beim erfolgreichen Konsolen-Test
          await window.rebuildPygameCanvasHard?.();
          setTimeout(() => {
            try { focusRuntimeSurfaceAfterRun(); } catch { }
          }, 0);
        }
      })();

      try {
        await window.__pythonRunPromise;
      } finally {
        window.__pythonRunActive = false;
        window.__pythonRunPromise = null;
        window.__nextRunShouldFocusCanvas = false;
      }
    });

    document.addEventListener("DOMContentLoaded", () => {
      document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(el => {
        new bootstrap.Tooltip(el, { container: 'body' }); // container: 'body' verhindert Clipping
      });
    });

    // --- "Alles löschen": Editor, Canvas, Output, Dateien; Resizer-Reset; Layout → Output+Dateien
    document.getElementById("clear-all-btn")?.addEventListener("click", async (ev) => {
      ev.preventDefault();
      if (!confirm("Alles löschen?\n\n- Editor-Inhalt\n- Canvas\n- Ausgabe\n- Hochgeladene Dateien\n- Resizer zurücksetzen\n- Layout: Output + Dateien")) return;

      // 1) Editor leeren (bestehende API nutzen)
      try { window.setEditorCode?.(""); } catch { }
      try { sessionStorage.removeItem("pythonide-editor-content"); } catch { }
      try { localStorage.removeItem("pythonide-editor-content"); } catch { }

      // 2) Canvas leeren (bestehende Helper)
      try { window.clearAllCanvases?.(); } catch { }
      try { window.syncCanvasToWrap?.(); } catch { }

      // 3) Output leeren
      try { const out = document.getElementById("output")?.replaceChildren() } catch { }

      // 4) Alle hochgeladenen Dateien löschen (FS benutzen + vorhandene deleteFile-Logik wo möglich)
      try {
        const FS = window.getFS?.();
        if (FS) {
          // rekursives Löschen im FS mit kurzen Hilfsfunktionen (kompakt gehalten)
          const rmrf = (path) => {
            let st; try { st = FS.stat(path); } catch { return; }
            const isDir = FS.isDir(st.mode);
            if (!isDir) { try { FS.unlink(path); } catch { } return; }
            let items = []; try { items = FS.readdir(path); } catch { }
            for (const name of items) {
              if (name === "." || name === "..") continue;
              rmrf((path.endsWith("/") ? path.slice(0, -1) : path) + "/" + name);
            }
            if (path !== "/home/pyodide") { try { FS.rmdir(path); } catch { } }
          };
          rmrf("/home/pyodide");
          try { await window.refreshFileList?.(); } catch { }
          try { if (window.uploadedFiles) window.uploadedFiles.clear(); } catch { }
        }
      } catch { }

      // 5) Resizer zurücksetzen (LS-Keys entfernen, DOM-Styles auf Start)
      try { localStorage.removeItem("ui.splitX"); } catch { }
      try { localStorage.removeItem("ui.canvasH"); } catch { }
      try {
        const left = document.getElementById("left");
        const wrap = document.getElementById("canvas-wrap");
        if (left) left.style.flex = "0 0 50%";
        if (wrap) wrap.style.flex = "";
        window.editor?.layout?.();
        syncCanvasToWrap?.();
      } catch { }

      // 6) Layout setzen: Output + Dateien (bestehende Funktion)
      try { window.setLayout?.("output-files"); } catch { }
      try { window.editor?.focus?.(); } catch { }
    });

    window.addEventListener(
      "resize",
      () => {
        if (window.__canvasResizeLocked) return;
        syncCanvasToWrap();
        const wrap = document.getElementById("canvas-wrap");
        if (!wrap) return;
        const r = wrap.getBoundingClientRect();
        const W = Math.max(1, Math.round(r.width));
        const H = Math.max(1, Math.round(r.height));
        window.applyCanvasAndPygameSize?.(W, H);
      },
      { passive: true }
    );


    // Bootstrap Dropdown
    const hbBtn = document.getElementById("hamburger-btn");
    if (window.bootstrap && hbBtn) {
      bootstrap.Dropdown.getOrCreateInstance(hbBtn, {
        autoClose: "outside",
        display: "static",
        container: "body",
        popperConfig: { strategy: "fixed" },
      });
    }

    // Beispiele-Button
    const loadExampleBtn = document.getElementById("load-example-btn");
    const examplesModalElement = document.getElementById("examplesModal");


    function setupSavePng() {
      const saveBtn = document.getElementById("save-png-btn");
      if (!saveBtn) return;

      saveBtn.disabled = false;

      saveBtn.addEventListener("click", async () => {
        try {
          const wrap = document.getElementById("canvas-wrap");
          if (!wrap) throw new Error("Canvas-Container nicht gefunden");

          // 1) erst sichtbare Canvas-Layer, sonst alle
          let layers = Array.from(
            wrap.querySelectorAll("canvas.gfx-layer.show")
          );
          if (!layers.length)
            layers = Array.from(wrap.querySelectorAll("canvas.gfx-layer"));

          // 2) nur gültige, in stabiler Reihenfolge
          const prefOrder = ["turtleCanvas", "canvas", "mplCanvas"];
          layers = layers
            .filter((c) => c && c.width > 0 && c.height > 0)
            .sort((a, b) => prefOrder.indexOf(a.id) - prefOrder.indexOf(b.id));

          if (!layers.length) throw new Error("Kein aktiver Canvas gefunden");

          // 3) größte Backing-Size
          const W = Math.max(...layers.map((c) => c.width));
          const H = Math.max(...layers.map((c) => c.height));

          const temp = document.createElement("canvas");
          temp.width = W;
          temp.height = H;
          const tctx = temp.getContext("2d");

          // 4) Layer rendern
          for (const c of layers) tctx.drawImage(c, 0, 0, W, H);

          // 5) PNG erzeugen
          const blob = await new Promise((res) =>
            temp.toBlob(res, "image/png")
          );
          if (!blob) throw new Error("Fehler beim Erzeugen des PNG");

          // 6) in Zwischenablage (Fallback: Download)
          try {
            await navigator.clipboard.write([
              new ClipboardItem({ "image/png": blob }),
            ]);
            console.log("✅ Bild in Zwischenablage kopiert");
          } catch (clipErr) {
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = "canvas.png";
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(a.href), 3000);
            console.warn(
              "Zwischenablage blockiert – PNG heruntergeladen.",
              clipErr
            );
            alert(
              "Zwischenablage blockiert – das PNG wurde stattdessen heruntergeladen."
            );
          }
        } catch (e) {
          console.error("❌ Kopieren fehlgeschlagen:", e);
          alert("Bild konnte nicht kopiert werden: " + (e?.message || e));
        }
      });
    }
    setupSavePng();
    // Pyodide zuletzt starten
    window.__stderrBuffer = [];

    window.wireSerialToOutput = function wireSerialToOutput() {
      const out = document.getElementById("output");
      if (!out || !window.CalliopeSerial) return;

      // Alle alten Listener und Auto-Writer abschalten
      try {
        window.__CalliopeSerialState?.listeners?.clear?.();
        window.CalliopeSerial.bindOutput(null);
      } catch { }
      let buf = "";            // gesamter Rohpuffer (CR entfernt)
      let emitted = 0;         // wieviel "bereinigter" Text schon ausgegeben wurde
      let debTimer = null;
      let suppress = false; // NEU: Fallback-Timer
      let headerStripped = false;
      // Nur: was ankommt → direkt anzeigen

      function flushClean() {
        // Normalize CRLF → LF
        const current = buf.replace(/\r/g, "");

        // Strip MicroPython banner *non-greedily* and only once.
        let processed = current;
        //if (!headerStripped) {
        // Lösche nur exakt die eine Bannerzeile
        // processed = processed.replace(/^MicroPython[^\n]*\n/i, "");
        //headerStripped = true;
        // }

        // Emit only the newly appended portion
        if (processed.length > emitted) {
          const piece = processed.slice(emitted);
          const html = piece.replace(/\n/g, "<br>");
          out.insertAdjacentHTML("beforeend", html);
          out.scrollTop = out.scrollHeight;
          emitted = processed.length;
        }
      }

      const onChunk = (chunk) => {
        const s = String(chunk || "");
        buf += s.replace(/\r/g, "");        // CR raus, LF bleiben
        clearTimeout(debTimer);
        debTimer = setTimeout(flushClean, 60); // wartet kurz, dann flushClean()
      };

      try { window.CalliopeSerial.onLine(onChunk); } catch { }
    };
    // Legacy prompt-based input() patch (DISABLED):
    /*
    // def custom_input(prompt=''):
    //     try:
    //         from js import window
    //         v = window.prompt(prompt)
    //         if v is None:
    //             raise EOFError("input() aborted")
    //         return str(v)
    //     except Exception:
    //         return ''
    // import builtins; builtins.input = custom_input
    */
    bootPyodide();
    window.wireSerialToOutput?.();
  }



  // Ready-Check: sofort ausführen, wenn das DOM bereits fertig ist
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", __initUIAndBoot, { once: true });
  } else {
    __initUIAndBoot();
  }

  // --- Pyodide boot ---
  async function bootPyodide() {
    if (window.pyodide) return window.pyodide;
    // Use global PYODIDE_URL if set
    const indexURL = window.PYODIDE_URL || "https://cdn.jsdelivr.net/pyodide/v0.29.0/full/";
    // Dynamically import pyodide.js
    if (!window.loadPyodide) {
      await import("https://cdn.jsdelivr.net/pyodide/v0.29.0/full/pyodide.js");
    }
    pyodide = await window.loadPyodide({ indexURL });
    // Load at least one package to initialize
    await pyodide.loadPackage(["numpy"]);
    // Ensure micropip + shapely
    await ensureShapely(pyodide);
    window.pyodide = pyodide;
    return pyodide;
  }

  window.addEventListener(
    "keydown",
    (e) => {
      const c = document.getElementById("canvas");
      if (!c) return;

      // Wenn Pygame aktiv ist (Canvas sichtbar/"show"), dann Tastatur-Ereignisse NICHT abfangen.
      // Sonst verliert der Canvas nach einem Keydown Fokus/PointerEvents und Maus-Events kommen nicht mehr an.
      if (c.classList?.contains("show")) return;

      if (document.activeElement === c) {
        // Canvas hält noch Fokus → zum Editor umleiten (nur außerhalb von aktivem Pygame)
        e.preventDefault();
        restoreEditorFocusNow();
      }
    },
    true
  ); // capture


  // UI-Elemente / Layout
  const layoutSelect = document.getElementById("layout-select");
  // gespeichertes Layout holen (Fallback: aktueller Select-Wert oder 'canvas-output')
  const savedLayout = getLS(
    "ui.layout",
    "output-files"
  );

  // Select optisch setzen, dann anwenden

  const hamburgerBtn = document.getElementById("hamburger-btn");
  const filesPanel = document.getElementById("files-panel");
  const canvasWrap = document.getElementById("canvas-wrap");

  // --- UX: Hamburger-Menü nach Auswahl schließen ---
  function closeHamburger() {
    try {
      if (window.bootstrap && hamburgerBtn) {
        bootstrap.Dropdown.getOrCreateInstance(hamburgerBtn).hide();
      }
    } catch { }
  }

  ['hilfe-btn', 'licenses-btn', 'impressum-btn', 'load-example-btn', 'load-program-btn', 'save-program-btn']
    .forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('click', () => closeHamburger());
      }
    });
  const outputElBox = document.getElementById("output"); // umbenannt, um Schatten zu vermeiden

  function closeHamburger() {
    try {
      if (window.bootstrap && hamburgerBtn) {
        bootstrap.Dropdown.getOrCreateInstance(hamburgerBtn).hide();
      }
    } catch { }
  }

  function applyLayout({ showCanvas, showFiles, outputFilesClass }) {
    if (canvasWrap) canvasWrap.style.display = showCanvas ? "flex" : "none";
    if (filesPanel) {
      filesPanel.style.display = showFiles ? "block" : "none";
      filesPanel.classList.toggle("layout-output-files", !!outputFilesClass);
    }
    if (outputElBox)
      outputElBox.classList.toggle("layout-output-files", !!outputFilesClass);

    try {
      window.editor?.layout?.();
    } catch { }
    try {
      window.syncCanvasToWrap?.();
    } catch { }
  }

  function setupUpload() {
    const input = document.getElementById("file-input");
    if (!input) return console.error("[upload] #file-input fehlt");
    input.addEventListener("change", async (e) => {
      try {
        const FS = window.getFS();
        if (!FS) { alert("Pyodide-Filesystem nicht verfügbar."); return; }
        try { FS.mkdir("/home"); } catch { }
        try { FS.mkdir("/home/pyodide"); } catch { }
        const files = e.target.files || [];
        for (const f of files) {
          const data = new Uint8Array(await f.arrayBuffer());
          FS.writeFile("/home/pyodide/" + f.name, data);
          try { localStorage.setItem("file_" + f.name, JSON.stringify(Array.from(data))); }
          catch (e) { console.warn("Speichern in localStorage fehlgeschlagen:", e); }
          (window.uploadedFiles ??= new Set()).add(f.name);
        }

        input.value = "";
        await window.refreshFileList?.();
        //// Nach Upload: Dateien einblenden, Canvas-Status respektieren – Resizer erhalten
        const sel = document.getElementById("layout-select");
        const prev = sel?.value || getLS("ui.layout", "output-files");

        // Layout beibehalten – nur falls ein "-files" Layout sinnvoll ist, ergänzen
        let next = prev;
        if (prev === "output") next = "output-files";
        if (prev === "canvas-output") next = "canvas-output-files";

        // Wichtig: NICHT anhand von __canvasActive umschalten
        window.__setLayoutPreservingResizers?.(next);

      } catch (err) {
        console.error("[upload] Fehler:", err);
        alert("Fehler beim Hochladen: " + err.message);
      }
    });
  }
  try { setupUpload(); } catch { }

  // Datei löschen (Main)
  window.deleteFile = function (filename) {
    const FS = window.getFS();
    if (!FS) return alert("Dateisystem nicht verfügbar (nur im Main-Modus).");
    if (confirm(`Möchtest du die Datei "${filename}" wirklich löschen?`)) {
      try {
        FS.unlink("/home/pyodide/" + filename);
        const base = String(filename).split("/").pop();
        try { localStorage.removeItem(`file_${base}`); } catch { }
        try {
          const tomb = JSON.parse(sessionStorage.getItem("deleted_files") || "[]");
          if (!tomb.includes(base)) tomb.push(base);
          sessionStorage.setItem("deleted_files", JSON.stringify(tomb));
        } catch { }
        if (window.uploadedFiles) window.uploadedFiles.delete(base);
        window.refreshFileList?.();
      } catch (err) {
        console.error(`[delete] Fehler beim Löschen von "${filename}":`, err);
        alert(`Fehler beim Löschen: ${err.message}`);
      }
    }
  };

  // Dateien-Panel aktualisieren (Main)
  window.refreshFileList = function () {
    const panel = document.getElementById("files-panel");
    const tbody = document.getElementById("files-tbody");
    const FS = window.getFS();
    if (!panel || !tbody || !FS) return;

    function listDir(dir, acc = []) {
      let entries = [];
      try { entries = FS.readdir(dir).filter((x) => x !== "." && x !== ".."); }
      catch { return acc; }
      for (const name of entries) {
        const p = dir + "/" + name;
        let st;
        try { st = FS.stat(p); } catch { continue; }
        if (FS.isDir(st.mode)) listDir(p, acc);
        else acc.push({ path: p.replace("/home/pyodide/", ""), size: st.size });
      }
      return acc;
    }

    const files = listDir("/home/pyodide").sort((a, b) => a.path.localeCompare(b.path));
    tbody.innerHTML = files.length
      ? files.map(f => `
        <tr>
          <td><code>${f.path}</code></td>
          <td class="text-end">${f.size}</td>
          <td>Datei</td>
          <td class="text-center">
            <button class="btn btn-sm btn-outline-danger"
                    onclick="window.deleteFile('${f.path.replace(/'/g, "\\'")}')">
              Löschen
            </button>
          </td>
        </tr>`).join("")
      : `<tr><td colspan="4"><em>(leer)</em></td></tr>`;

    // uploadedFiles aktualisieren
    window.uploadedFiles = new Set(files.map(f => f.path));

    panel.style.display = files.length ? "block" : panel.style.display;

    // Wenn Dateien vorhanden sind und das Layout noch auf "output" oder "canvas-output" steht,
    // automatisch auf die entsprechende files-Variante umschalten (Menü + LocalStorage synchron).
    try {
      const sel = document.getElementById("layout-select");
      const cur = sel?.value || getLS("ui.layout", "output");
      if (files.length > 0) {
        if (cur === "output") {
          setLayout("output-files");
        } else if (cur === "canvas-output") {
          setLayout("canvas-output-files");
        }
      }
    } catch { }
  }

  window.applyLayoutByValue = function applyLayoutByValue(val) {
    console.log("[Layout] applyLayoutByValue:", val);
    switch (val) {
      case "output":
        console.log("[Layout] → Nur Output");
        applyLayout({
          showCanvas: false,
          showFiles: false,
          outputFilesClass: false,
        });
        break;
      case "canvas-output":
        console.log("[Layout] → Canvas + Output");
        applyLayout({
          showCanvas: true,
          showFiles: false,
          outputFilesClass: false,
        });
        break;
      case "output-files":
        console.log("[Layout] → Output + Dateien");
        applyLayout({
          showCanvas: false,
          showFiles: true,
          outputFilesClass: true,
        });
        break;
      case "canvas-output-files":
        console.log("[Layout] → Canvas + Output + Dateien");
        applyLayout({
          showCanvas: true,
          showFiles: true,
          outputFilesClass: false,
        });
        break;
      default:
        console.log("[Layout] → Default (Output)");
        applyLayout({
          showCanvas: false,
          showFiles: false,
          outputFilesClass: false,
        });
    }
  };
  window.onLayoutChange = window.applyLayoutByValue; // Alias für Kompatibilität
  function setLayout(val) {
    if (layoutSelect) layoutSelect.value = val;
    applyLayoutByValue(val);
    setLS("ui.layout", val);
    try {
      const savedSplit = parseInt(getLS("ui.splitX", "0"), 10);
      if (savedSplit > 0) {
        const left = document.getElementById("left");
        if (left) {
          left.style.flex = `0 0 ${savedSplit}px`;
          try { window.editor?.layout?.(); } catch { }
        }
      }
    } catch { }
  }

  if (layoutSelect) layoutSelect.value = savedLayout;
  applyLayoutByValue(savedLayout);
  // gespeicherte Canvas-Höhe nach Reload anwenden
  const savedH = parseInt(getLS("ui.canvasH", "0"), 10);
  if (savedH > 0 && (savedLayout === "canvas-output" || savedLayout === "canvas-output-files")) {
    const wrap = document.getElementById("canvas-wrap");
    if (wrap) { wrap.style.flex = `0 0 ${savedH}px`; try { window.syncCanvasToWrap?.(); } catch { } }
  }

  // ===== Layout Helpers (preserve resizers) =====
  window.getCurrentLayout = function getCurrentLayout() {
    try { return document.getElementById('layout-select')?.value || getLS('ui.layout', 'output-files'); }

    catch { return 'output-files'; }
  };
  window.__applySavedResizers = function __applySavedResizers() {
    // Editorbreite (ui.splitX)
    try {
      const savedSplit = parseInt(localStorage.getItem('ui.splitX') || '0', 10);
      if (savedSplit > 0) {
        const left = document.getElementById('left');
        if (left) {
          left.style.flex = `0 0 ${savedSplit}px`;
          try { window.editor?.layout?.(); } catch { }
        }
      }
    } catch { }
    // Canvas-Höhe (ui.canvasH)
    try {
      const savedH = parseInt(localStorage.getItem('ui.canvasH') || '0', 10);
      if (savedH > 0) {
        const wrap = document.getElementById('canvas-wrap');
        if (wrap) {
          wrap.style.flex = `0 0 ${savedH}px`;
          try { window.syncCanvasToWrap?.(); } catch { }
        }
      }
    } catch { }
  };
  window.__setLayoutPreservingResizers = function __setLayoutPreservingResizers(val) {
    const sel = document.getElementById('layout-select');
    if (sel) sel.value = val;
    applyLayoutByValue(val);
    setLS('ui.layout', val);
    window.__applySavedResizers?.();
  };

  try {
    const devSel = document.getElementById("device-select");
    const devNow = devSel?.value || localStorage.getItem("ui.device") || "none";
    if (devNow === "c12" || devNow === "c3") {
      setLayout("output-files");
    }
  } catch { }

  // Wechsel auf Calliope im Auswahl-Menü nur erlauben, wenn Browser geeignet ist
  (function guardDeviceSelect() {
    const sel = document.getElementById('device-select');
    if (!sel) return;
    let __reverting = false;
    let __prev = sel.value || 'none';
    sel.addEventListener('change', function (ev) {
      if (__reverting) return; // Revert läuft → nichts tun
      const val = sel.value;
      if ((val === 'c12' || val === 'c3') && !isSuitableCalliopeBrowser()) {
        try { ev.preventDefault(); ev.stopImmediatePropagation(); } catch { }
        explainUnsuitableBrowser(val);
        // revert
        __reverting = true;
        sel.value = __prev;
        // optional: Events feuern, falls UI darauf hört
        try {
          sel.dispatchEvent(new Event('input', { bubbles: true }));
          sel.dispatchEvent(new Event('change', { bubbles: true }));
        } catch { }
        __reverting = false;
        return;
      }
      __prev = val;
    }, { capture: true });
  })();

  // === Externen Receiver jetzt erst aktivieren (wenn alles verdrahtet ist) ===
  initExternalReceiver({
    senderOrigin: "https://net-schulbuch.de", // exakt die Origin des Senders
    windowName: "NETBUCH_IDE",
  });

  layoutSelect?.addEventListener("change", (e) => {
    closeHamburger();
    const val = e.target.value;
    applyLayoutByValue(val);
    setLS("ui.layout", val); // <— neu: persistieren
  });


  // --- Canvas Sizing Helfer ---
  function measureWrapSize() {
    const wrap = document.getElementById("canvas-wrap");
    const r = wrap?.getBoundingClientRect();
    let w = Math.max(1, Math.floor(r?.width || 0));
    let h = Math.max(1, Math.floor(r?.height || 0));
    return { w, h };
  }

  function sizeCanvasForSDL(c, w, h) {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const W = Math.max(1, Math.round(w));
    const H = Math.max(1, Math.round(h));

    // Backing-Size (device pixels)
    c.width = Math.round(W * dpr);
    c.height = Math.round(H * dpr);
    // CSS-Size (logical)
    c.style.width = W + "px";
    c.style.height = H + "px";

    // WICHTIG:
    // - Für den Pygame-Canvas (#canvas) KEIN getContext() und KEIN setTransform().
    // - SDL/Pygame steuert den Kontext selbst.
    if (c.id !== "canvas") {
      const ctx = c.getContext("2d");
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }
  function syncCanvasToWrap() {
    const wrap = document.getElementById("canvas-wrap");
    if (!wrap) return;

    const rect = wrap.getBoundingClientRect();
    let W = Math.max(1, Math.floor(wrap.clientWidth));
    let H = Math.max(1, Math.floor(wrap.clientHeight));
    const dpr = Math.max(1, window.devicePixelRatio || 1);

    ["turtleCanvas", "canvas", "mplCanvas"].forEach((id) => {
      const c = document.getElementById(id);
      if (!c) return;

      // CSS-Size
      //c.style.width = W + 'px';
      //c.style.height = H + 'px';

      if (id === "mplCanvas") {
        // Matplotlib-Canvas bleibt 1:1
        c.width = W;
        c.height = H;
        const ctx = c.getContext("2d");
        try { ctx.setTransform(1, 0, 0, 1, 0, 0); } catch { }
        ctx.clearRect(0, 0, c.width, c.height);
        // Entwertet alle noch ausstehenden onload()s älterer Shows
        window.__mplGen = (window.__mplGen || 0) + 1;
      } else if (id === "turtleCanvas") {
        // Turtle: DPR anwenden inkl. Transform
        c.width = Math.round(W * dpr);
        c.height = Math.round(H * dpr);
        const ctx = c.getContext("2d");
        if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      } else if (id === "canvas") {
        // Einheitlich ohne DPR: Backing == CSS-Logikgröße
        c.width = W;
        c.height = H;
      }
    });
  }

  function buildWorkerModulePrelude() {
    const ctx = window.__lastExampleCtx || {};
    const mods = ctx.modules || {};
    const names = Object.keys(mods);
    if (!names.length) return "";
    const lines = [
      "import sys, types, json",
      "# ---- injected local modules (worker, no-FS) ----"
    ];
    for (const name of names) {
      const src = JSON.stringify(mods[name].code); // JS→Python sicher via JSON
      lines.push(
        `__src = json.loads(${JSON.stringify(src)})`,
        `__m = types.ModuleType(${JSON.stringify(name)})`,
        `exec(__src, __m.__dict__)`,
        `sys.modules[${JSON.stringify(name)}] = __m`
      );
    }
    lines.push("");
    return lines.join("\n");
  }

  window.measureWrapSize = measureWrapSize;
  window.sizeCanvasForSDL = sizeCanvasForSDL;
  window.syncCanvasToWrap = syncCanvasToWrap;

  // Wrapper: führt runUserCode aus und räumt danach pygame/Canvas/UI auf
  // Wrapper: führt runUserCode aus und räumt danach pygame/Canvas/UI auf
  // Wrapper: führt runUserCode aus und räumt danach pygame/Canvas/UI auf
  window.runUserCode = async function (rawFromEditor) {
    try {
      rawFromEditor = maybeAutoWrapPygame(rawFromEditor);
      return await runUserCode(rawFromEditor);
    } finally {
      try { await pythonQuitPygame?.(); } catch { }
      try { softResetAfterRun?.(); } catch { }
      try { window.rebuildPygameCanvasHard?.(); } catch { }
      try { restoreEditorFocusNow?.(); } catch { }
    }
  };
  window.run = async (code) => window.runUserCode(code); // Legacy-Alias

  // ===== Neu: einheitlicher Run-Einstieg mit alter Logik (pygame, mpl, repeat, Mapping, Timeout) =====
  async function runUserCode(rawFromEditor) {
    let totalPrefixOffset = 0;          // <-- DAS ist die doppelte Deklaration
    window.__lastPrefixOffset = 0;      // <-- Fallback für reportPythonError

    console.log("[DIAG] active backend:", window.pyBackend?.kind, "mainPy?", !!window.__mainPy, "pyodide?", !!window.pyodide);
    if (!window.pyBackend) await bootPyodide();
    try {
      const fs = (window.__mainPy?.FS || window.pyodide?.FS);
      if (fs) console.log("[DIAG] files before run:", fs.readdir("/home/pyodide"));
      else console.warn("[DIAG] kein FS sichtbar!");
    } catch (e) {
      console.warn("[DIAG] FS check failed:", e);
    }

    healEmscriptenInput?.();
    const _c = getActiveCanvas?.();
    if (_c) _c.getContext("2d")?.clearRect(0, 0, _c.width, _c.height);
    const outEl = document.getElementById("output");
    outEl.innerHTML = "";
    try { window.__abortFlag = false; } catch { }
    clearAllCanvases?.();
    await new Promise((r) => setTimeout(r, 120));
    ensureStackedCanvases?.();
    try { window.turtleReset?.(); } catch { };

    let __userCodeRaw = String(rawFromEditor ?? window.editor?.getValue?.() ?? "");

    if (!__userCodeRaw.trim()) {
      __userCodeRaw = (sessionStorage.getItem("pythonide-editor-content") || "").trim();
    }
    if (!__userCodeRaw.trim()) {
      outEl.innerHTML = "ℹ️ Kein Programmtext im Editor.";
      return;
    }
    let userCode = __userCodeRaw;

    // Grafik nur, wenn wirklich pygame/matplotlib/turtle erkannt wurden
    if (needsCanvasOrDOM(__userCodeRaw)) {
      const cur = (window.getCurrentLayout?.() || getLS('ui.layout', 'output'));
      if (cur === 'output') {
        window.__setLayoutPreservingResizers?.('canvas-output');
      }
      // Canvas gilt als aktiv (für spätere Upload-Entscheidung)
      window.__canvasActive = true;
      try { window.syncCanvasToWrap?.(); } catch { }
    } else {
      // Merken, ob Canvas ohnehin sichtbar ist (falls vorher so eingestellt)
      const cur = (window.getCurrentLayout?.() || getLS('ui.layout', 'output'));
      window.__canvasActive = /^canvas-/.test(cur);
    }

    // 🩹 Fix: auch Ressourcen-Dateien berücksichtigen
    try {
      const FS = window.__mainPy?.FS || window.pyodide?.FS;
      if (FS) {
        const files = FS.readdir("/home/pyodide").filter(f => f !== "." && f !== "..");
        if (files.length > 0) {
          hasUserFiles = true; // Ressourcen gelten als Benutzerdateien
          console.log("[RUN] Ressourcen erkannt:", files);
        }
      }
    } catch (e) {
      console.warn("[RUN] FS check fehlgeschlagen:", e);
    }
    // --- wie Pygame/Turtle: bei Canvas/DOM -> Main, sonst Worker ---

    // --- NEU: wenn über die Upload-UI Dateien bekannt sind, Main-Modus verlangen
    try {
      if (window.uploadedFiles && window.uploadedFiles.size > 0) {
        hasUserFiles = true;                         // <- nur Flag setzen, NICHT pyBackend überschreiben
        console.log("→ will MAIN because uploaded files are present (uploadedFiles size:", window.uploadedFiles.size, ")");
      }
    } catch (e) {
      console.warn("Upload-Check für Main-Switch fehlgeschlagen:", e);
    }

    // --- SAS-Pygame: if imported, force MAIN and load local /sas_pygame.py into FS ---
    const wantsSasPygame = /(^|\n)\s*(import\s+sas_pygame\b|from\s+sas_pygame\b)/m.test(__userCodeRaw);
    if (wantsSasPygame) {
      hasUserFiles = true;              // forces MAIN backend
      window.__sasPygameNeed = true;    // triggers loader after MAIN is ready
    }
    const needsInputFlag = needsInput(__userCodeRaw);

    console.log("[RUN] feature-detect", {
      hasUserFiles,
      needsCanvas: needsCanvasOrDOM(__userCodeRaw),
      needsFS: needsFilesystem(__userCodeRaw),
      needsInput: needsInputFlag,
    });

    // input() braucht Main-Thread (Browser-Prompt statt stdin)
    const wantMain = hasUserFiles || needsCanvasOrDOM(__userCodeRaw) || needsFilesystem(__userCodeRaw) || needsInputFlag;
    console.log("[RUN] backend decision", { wantMain, workerActive: window.isWorkerMode && window.isWorkerMode() });
    if (wantMain && (!window.isMainMode || !window.isMainMode())) {
      // Main-Pyodide beim ersten Mal laden (einmalig)
      if (!window.__mainPy) {
        window.__mainPyLoaded = true;
        window.__mainPy = await loadPyodide({
          indexURL: window.PYODIDE_URL,
          toJsLiteralMap: true,      // 0.29: dict -> Map-ähnlich wie früher
          convertNullToNone: true    // 0.28: JS null wieder als None
        });
        (function patchSilentPackages(py) {
          const __origLP = py.loadPackage.bind(py);
          py.loadPackage = (names, opts = {}) =>
            __origLP(names, { ...opts, messageCallback: () => { } });

          if (py.loadPackagesFromImports) {
            const __origLPI = py.loadPackagesFromImports.bind(py);
            py.loadPackagesFromImports = (code, opts = {}) =>
              __origLPI(code, { ...opts, messageCallback: () => { } });
          }
        })(window.__mainPy);
        await window.__mainPy.runPythonAsync('import os; os.chdir("/home/pyodide")');
        try {
          await window.registerTurtleInPython?.(window.__mainPy);
        } catch { /* ok, Hook optional */ }

        try { window.__mainPy.FS.mkdir("/home"); } catch { }
        try { window.__mainPy.FS.mkdir("/home/pyodide"); } catch { }
        // gespeicherte Dateien (file_*) aus localStorage ins Main-FS zurückspielen
        try {
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key || !key.startsWith("file_")) continue;
            const name = key.slice(5);
            try {
              const data = JSON.parse(localStorage.getItem(key));
              window.__mainPy.FS.writeFile("/home/pyodide/" + name, new Uint8Array(data));
              (window.uploadedFiles ??= new Set()).add(name);
            } catch { }
          }
          window.refreshFileList?.();
        } catch (e) { }
      }

      // Backend für diesen Run auf Main-Pyodide umbiegen
      window.pyBackend = {
        kind: "main",
        runPython: (code) => window.__mainPy.runPython(code),
        runPythonAsync: (code) => window.__mainPy.runPythonAsync(code),
        interrupt: () => { },
        reset: () => { },
      };
      // If sas_pygame was requested, make sure /home/pyodide/sas_pygame.py exists now.
      if (window.__sasPygameNeed) {
        try {
          await ensureSasPygameInFS(window.__mainPy, outEl);
        } finally {
          window.__sasPygameNeed = false;
        }
      }

      await window.__mainPy.runPythonAsync('import os; os.makedirs("/home/pyodide", exist_ok=True); os.chdir("/home/pyodide")');

      window.__py_stdout__ ??= __appendOut;
      window.__py_stderr__ ??= (t) => {
        if (!t) return;
        const msg = String(t);

        // Fehlermeldung schön ausgeben (deine Funktion)
        try {
          window.reportPythonError?.(msg, {
            userCode: window.__lastUserCodeRaw || window.editor?.getValue?.() || "",
            prefixLines: window.__lastPrefixOffset || 0
          });
        } catch { }

        // Zusätzlich die rohe stderr-Nachricht unten im Output anzeigen
        try {
          const el = document.getElementById("output");
          if (el) {
            const html = msg.replace(/\r\n|\r|\n/g, "<br>");
            el.insertAdjacentHTML("beforeend", `<div class="text-danger">${html}</div>`);
            el.scrollTop = el.scrollHeight;
          }
        } catch { }
      };

      window.__mainPy.setStdout({ batched: (txt) => window.__py_stdout__?.(txt) });
      window.__mainPy.setStderr({ batched: (txt) => window.__py_stderr__?.(txt) });
      // Python-Seite: stdout/stderr getrennt auf die beiden JS-Funktionen mappen
      window.pyodide = window.__mainPy;

    }

    // --- kleine Helfer ---
    // Zählt logische Zeilen OHNE die künstliche Extra-Zeile bei trailing "\n"
    const countLines = (s) => {
      if (!s) return 0;
      const parts = String(s).split(/\r?\n/);
      // Wenn der String auf \n endet, erzeugt split() am Ende ein leeres Element – das nicht als echte Zeile zählen.
      if (parts.length && parts[parts.length - 1] === "") return parts.length - 1;
      return parts.length;
    };
    const mapTracebackLines = (msg, offset) =>
      offset
        ? msg.replace(/File\s+"<exec>",\s+line\s+(\d+)/g, (_, n) =>
          `File "<exec>", line ${Math.max(1, parseInt(n, 10) - offset)}`
        )
        : msg;

    // --- Paket-Autoload anhand des *Rohcodes* (wie vorher) ---
    const raw = __userCodeRaw;

    if (isWorkerMode()) {
      // Worker: automatisch alle Imports erkennen und vorkonfigurieren
      // 1) Alle Import-Wurzeln aus dem User-Code sammeln
      const importRoots = Array.from(new Set(
        Array.from(raw.matchAll(/^\s*from\s+([A-Za-z_][\w\.]*)\s+import|^\s*import\s+([A-Za-z_][\w\.]*)/gm))
          .map(m => (m[1] || m[2] || "").split(".")[0])
          .filter(Boolean)
      ));

      // 2) Alias-Mapping: Modulname → Pyodide-Paketname
      const alias = {
        pygame: "pygame-ce",
        PIL: "pillow",
      };

      // 3) Auf Paketnamen mappen (Unikate)
      const pkgs = Array.from(new Set(importRoots.map(r => alias[r] || r)));

      // 4) An den Worker übergeben (idempotent)
      if (pkgs.length) {
        await window.pyWorkerClient?.init(pkgs);
      }
    } else {
      try {
        await window.pyodide.loadPackagesFromImports(raw, {
          messageCallback: () => { }, // Statusmeldungen stummschalten
        });

        // Sonderfall: pygame → pygame-ce (Alias)
        if (/\b(import\s+pygame|from\s+pygame\b)/i.test(raw)) {
          await window.pyodide.loadPackage("pygame-ce", { messageCallback: () => { } });
        }
        // Sonderfall: sas_pygame importiert shapely intern; Autoload sieht das nicht.
        if (/\b(import\s+sas_pygame\b|from\s+sas_pygame3\b)/i.test(raw)) {
          await window.pyodide.loadPackage("shapely", { messageCallback: () => { } });
        }
      } catch (e) {
        console.warn("[RUN] Autoload-Pakete fehlgeschlagen:", e);
      }

      // .py-Hilfsdateien vorab importierbar machen (nur im Main mit FS)
      try {
        if (raw.includes("import ") && raw.includes(".py")) {
          const files = window.pyodide.FS.readdir("/home/pyodide");
          const pyFiles = files.filter((f) => f.endsWith(".py"));
          for (const file of pyFiles) {
            try {
              const content = window.pyodide.FS.readFile("/home/pyodide/" + file, { encoding: "utf8" });
              await window.pyBackend.runPythonAsync(content);
            } catch { }
          }
        }
      } catch { }
    }

    // --- Usercode transformieren (DEIN DSL + pygame-Async) ---
    // 1) deine „extended“ Python-Syntax (repeat etc.)
    if (typeof extendPythonCode === "function") {
      userCode = extendPythonCode(userCode);
    }

    // 2) pygame erkennen & asynchronisieren + Canvas verdrahten
    const wantsPygame =
      /\bimport\s+[^#\n]*\bpygame\b/i.test(raw) || /\bfrom\s+pygame\b/i.test(raw);
    const wantsMpl =
      /\b(from\s+matplotlib\b|import\s+matplotlib(\.pyplot)?\b)/.test(raw) || // import matplotlib / import matplotlib.pyplot as plt
      /\bplt\./.test(raw);                                                    // reines plt.* im Code
    if (wantsPygame || wantsMpl || needsCanvasOrDOM(raw)) {
      ensureCanvasVisibleForCode?.(raw);
    }
    if (wantsPygame) {
      showLayer?.("pygame");
      // Canvas vorbereiten (wie vorher)
      const L = getLayers?.() || {};
      const wrap = document.getElementById("canvas-wrap");
      let pgCanvas =
        document.getElementById("canvas") || L.pygame || L.single || document.getElementById("pygamecanvas");
      if (pgCanvas && pgCanvas.id !== "canvas") {
        pgCanvas.setAttribute("data-old-id", pgCanvas.id);
        pgCanvas.id = "canvas";
      }
      // Canvas liegt im Frame unter der Titelzeile – nicht absolut positionieren
      pgCanvas.style.position = "static";
      try { pgCanvas.style.removeProperty('inset'); } catch { }
      pgCanvas.style.display = "block";
      pgCanvas.style.pointerEvents = "auto";
      pgCanvas.tabIndex = 0;
      pgCanvas.style.outline = "none";
      const frame = document.getElementById("pygame-frame");
      if (frame) {
        frame.style.display = "flex";
        frame.style.pointerEvents = "auto";
      }
      const r = wrap.getBoundingClientRect();
      const W = Math.max(1, Math.round(r.width));
      const H = Math.max(1, Math.round(r.height));
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      pgCanvas.style.width = W + "px";
      pgCanvas.style.height = H + "px";
      pgCanvas.width = Math.round(W * dpr);
      pgCanvas.height = Math.round(H * dpr);
      if (window.pyodide?._module) window.pyodide._module.canvas = pgCanvas;
      wirePygameInputOnce?.(pgCanvas);
      pgCanvas.oncontextmenu = (e) => e.preventDefault();
      window.applyCanvasAndPygameSize?.(W, H);

      if (isMainMode()) {
        try { await window.pyodide.loadPackage("pygame-ce"); } catch (err) { console.error(err); }
      } else {
        // Worker-Fall: pygame-ce wird oben über init() geladen (falls nötig)
      }
    } else if (wantsMpl) {
      showLayer?.("mpl");
    } else {
      showLayer?.("turtle");
    }

    // --- Prefix/Suffix/Prelude (wie früher) ---
    let prelude = "";
    prelude += [
      "import os",
      "os.makedirs('/home/pyodide', exist_ok=True)",
      "os.chdir('/home/pyodide')",
      ""
    ].join("\n");
    let prefix = "";
    let suffix = "";

    // pandas/numpy Autoload-Import (wenn gewünscht)
    if (/\b(pandas|DataFrame)\b|pd\./.test(raw) && !/\bimport\s+pandas\b/.test(raw)) {
      prelude += "import pandas as pd\nimport numpy as np\n\n";
    }

    // (input() Bridge für Main entfernt, da jetzt JS-Patch (__INPUT_PATCH__) verwendet wird)

    // Worker: lokale Module (aus __lastExampleCtx) ohne FS injizieren
    if (window.isWorkerMode && window.isWorkerMode()) {
      prelude += buildWorkerModulePrelude();
    }

    // pygame Prefix + Usercode asynchronisieren
    let __pygameHeaderLines = 0; // zählt Zeilen, die VOR dem eigentlichen Usercode eingefügt werden (z.B. "import asyncio")
    function transformSyncPygameToAsync(txt) {
      __pygameHeaderLines = 0; // bei jedem Run zurücksetzen
      const lowerOrig = txt.toLowerCase();
      const hasPygame =
        /\bimport\s+[^#\n]*\bpygame\b/.test(lowerOrig) ||
        /\bfrom\s+pygame\b/.test(lowerOrig);
      if (!hasPygame) return txt;

      let out = txt;

      // main() asynchronisieren
      if (!/(^|\n)\s*async\s+def\s+main\s*\(/.test(out)) {
        out = out.replace(
          /(^|\n)(\s*)def\s+main\s*\((.*?)\)\s*:/,
          (_m, pfx, indent, args) => `${pfx}${indent}async def main(${args}):`
        );
      }

      // Aufruf von main() awaiten
      out = out.replace(
        /(^|\n)(\s*)main\s*\(\s*\)\s*($|\n)/,
        (_m, pfx, indent) => `${pfx}${indent}await main()\n`
      );

      // asyncio ggf. importieren
      if (!/\bimport\s+asyncio\b/.test(out.toLowerCase())) {
        out = "import asyncio\n" + out;
        __pygameHeaderLines += 1;
      }

      // ----- While-Schleifen patchen -----
      const lines = out.split(/\r?\n/);
      const indentWidth = (s) =>
        (s.match(/^[ \t]*/)?.[0] || "").replace(/\t/g, "    ").length;

      // Markiere, welche Zeilen im Körper von async def main() liegen.
      const mainBodyFlags = (() => {
        const flags = new Array(lines.length).fill(false);
        let mainIndent = null;
        let inMain = false;
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const m = line.match(/^(\s*)async\s+def\s+main\s*\(/);
          if (m) {
            mainIndent = indentWidth(m[1]);
            inMain = true;
            continue; // Header-Zeile gehört nicht zum Körper
          }
          const trimmed = line.trim();
          if (inMain) {
            const ind = indentWidth(line);
            if (trimmed && ind <= mainIndent) {
              // Wir sind wieder aus main() heraus
              inMain = false;
            } else if (ind > mainIndent) {
              // Zeilen mit größerer Einrückung gehören zum Körper von main()
              flags[i] = true;
            }
          }
        }
        return flags;
      })();

      const fnRegex = /^(\s*)def\s+([A-Za-z_][\w]*)\s*\(/;
      const eventish = new Set();

      // <<< WICHTIG: flip()/tick() gelten auch als „eventish“ >>>
      const hasEventAPI = (t) =>
        /\bpygame\.event\.(get|poll|wait|peek|pump)\s*\(|\bpygame\.display\.flip\s*\(|\bclock\.tick\s*\(|\b\w+\.step\s*\(/.test(t);

      const hasFrameYield = (t) =>
        /\bpygame\.display\.flip\s*\(\s*\)|\bclock\.tick\s*\(|\b\w+\.step\s*\(/.test(t);

      // Scan nach "eventish" Funktionen
      for (let i = 0; i < lines.length; i++) {
        const m = lines[i].match(fnRegex);
        if (!m) continue;
        const baseIndent = indentWidth(m[1]);
        const name = m[2];
        let j = i + 1, isEventish = false;
        for (; j < lines.length; j++) {
          const ln = lines[j];
          if (!ln.trim()) continue;
          if (indentWidth(ln) <= baseIndent) break;
          const t = ln.trim();
          if (hasEventAPI(t)) isEventish = true;
        }
        if (isEventish) eventish.add(name);
        i = j - 1;
      }

      // Prüfen, ob eine Zeile eine eventish-Funktion aufruft
      const callsEventishFn = (line) => {
        for (const fn of eventish) {
          const r = new RegExp(`\\b${fn}\\s*\\(`);
          if (r.test(line)) return true;
        }
        return false;
      };

      const newLines = [];
      // etwas robuster: erlaubt trailing Kommentar nach dem Doppelpunkt
      const isWhileStart = (line) => /^\s*while\b[^\n:]*:\s*(?:#.*)?$/.test(line);
      const whileStack = []; // { indent, yielded, eventLoop }
      const indentStr = (n) => " ".repeat(n);

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const currIndent = indentWidth(line);
        const inMainBody = mainBodyFlags[i];

        // Blöcke schließen
        while (whileStack.length && currIndent < whileStack[whileStack.length - 1].indent) {
          const top = whileStack.pop();
          if (top.eventLoop && !top.yielded && top.indent > 4) {
            newLines.push(`${indentStr(top.indent)}await asyncio.sleep(0)`);
          }
        }

        // while ...: nur innerhalb des Rumpfs von async def main()
        if (isWhileStart(line) && inMainBody) {
          const blockIndent = currIndent + 4;
          whileStack.push({ indent: blockIndent, yielded: false, eventLoop: false });
          newLines.push(line);
          continue;
        }

        newLines.push(line);

        if (whileStack.length) {
          const top = whileStack[whileStack.length - 1];
          const t = line.trim();

          // <<< NEU: eventLoop auch aktivieren, wenn ein Frame-Yield-Kandidat auftaucht >>>
          // auch verschachtelte for e in pygame.event.get(): erkennen
          if (!top.eventLoop && (hasEventAPI(t) || callsEventishFn(t) || hasFrameYield(t))) {
            top.eventLoop = true;
          } else if (!top.eventLoop && /^\s*for\s+\w+\s+in\s+pygame\.event\.get\s*\(/.test(t)) {
            top.eventLoop = true;
          }

          // <<< Injection nach flip()/tick() >>>
          if (hasFrameYield(t) && top.indent > 4) {
            const insIndent = indentWidth(line);
            const nextLine = lines[i + 1] || "";
            if (!/^\s*await\s+asyncio\.sleep\(\s*0\s*\)\s*$/.test(nextLine)) {
              newLines.push(`${indentStr(insIndent)}await asyncio.sleep(0)`);
            }
            top.yielded = true;
          }
        }
      }

      // Offene Blöcke schließen
      while (whileStack.length) {
        const top = whileStack.pop();
        if (top.eventLoop && !top.yielded && top.indent > 4) {
          newLines.push(`${indentStr(top.indent)}await asyncio.sleep(0)`);
        }
      }

      // --- Primär-Ergebnis ---
      let patched = newLines.join("\n");

      // --- Fallback-Pass entfernt ---
      // Früher wurden hier notfalls noch global `await asyncio.sleep(0)`-Aufrufe
      // nach `pygame.display.flip()` / `clock.tick()` eingefügt.
      // Das konnte jedoch `await` außerhalb von async-Funktionen erzeugen,
      // was in Pyodide zu `SyntaxError: 'await' outside async function` führt.
      // Daher verzichten wir auf diesen Fallback und patchen nur noch Schleifen
      // im Körper von async def main().

      return patched;
    }

    if (wantsPygame) {
      // bleibt leer (kein mplSuffix mehr)
      // Dein pygame-Prefix 1:1 (verkürzt hier nicht, damit semantisch gleich bleibt)
      prefix += [
        "from js import window",
        "def __ide_pygame_softreset():",
        "    try:",
        "        window.softResetAfterRun()",
        "        window.pyodide.canvas.setCanvas2D(None)",
        "    except Exception:",
        "        pass",
        "import os, warnings",
        "warnings.filterwarnings('ignore', message='no fc_cache font cache file*')",
        "os.environ['SDL_EMSCRIPTEN_CANVAS_SELECTOR'] = '#canvas'",
        "import pygame",
        "pygame.init(); pygame.font.init()",
        "",
        "from js import document, window",
        "try:",
        "    wrap = document.getElementById('canvas-wrap')",
        "    if wrap and getattr(wrap, 'clientWidth', None):",
        "        MAXWIDTH = int(wrap.clientWidth)",
        "        tb = document.getElementById('pygame-titlebar')",
        "        th = int(tb.getBoundingClientRect().height) if tb else 0",
        "        MAXHEIGHT = int(wrap.clientHeight) - th",
        "        if MAXHEIGHT < 1: MAXHEIGHT = 1",
        "",
        "    else:",
        "        c = document.getElementById('canvas')",
        "        MAXWIDTH = int(c.width) if getattr(c, 'width', None) else 640",
        "        MAXHEIGHT = int(c.height) if getattr(c, 'height', None) else 480",
        "except Exception:",
        "    MAXWIDTH, MAXHEIGHT = 640, 480",
        "import builtins",
        "builtins.MAXWIDTH = MAXWIDTH",
        "builtins.MAXHEIGHT = MAXHEIGHT",
        "",
        "if not hasattr(pygame.display, '__orig_set_mode'):",
        "    pygame.display.__orig_set_mode = pygame.display.set_mode",
        "def __patched_set_mode(size=(0,0), flags=0, depth=0, display=0, vsync=0):",
        "    c = document.getElementById('canvas')",
        "    if c is None:",
        "        return pygame.display.__orig_set_mode(size, flags, depth, display, vsync)",
        "    # Wunschgröße lesen (Default 640x480) und auf MAXWIDTH/MAXHEIGHT begrenzen",
        "    try:",
        "        reqW, reqH = size",
        "    except Exception:",
        "        reqW, reqH = 0, 0",
        "    W = int(reqW) if reqW and int(reqW) > 0 else 640",
        "    H = int(reqH) if reqH and int(reqH) > 0 else 480",
        "    try:",
        "        W = min(W, int(MAXWIDTH))",
        "        H = min(H, int(MAXHEIGHT))",
        "    except Exception:",
        "        pass",
        "    # Canvas CSS + Backing Größen setzen",
        "    try:",
        "        dpr = max(1, int(round(float(window.devicePixelRatio))))",
        "    except Exception:",
        "        dpr = 1",
        "    c.style.width  = f\"{W}px\"",
        "    c.style.height = f\"{H}px\"",
        "    c.width  = W",
        "    c.height = H",
        "    return pygame.display.__orig_set_mode((c.width, c.height), flags, depth, display, vsync)",
        "pygame.display.set_mode = __patched_set_mode",
        "pygame.display.__is_patched = True",
        "",
        "pygame.display.set_mode()",
        "screen = pygame.display.get_surface()",
        "",
        "pygame_close_rect = pygame.Rect(5,5,30,30)",
        "def __draw_close_button(surf):",
        "    return  # HTML-Titlebar übernimmt den Close-Button",
        "",
        "if not hasattr(pygame.display, '__orig_set_caption'):",
        "    pygame.display.__orig_set_caption = pygame.display.set_caption",
        "def __nb_set_caption(title, *args):",
        "    try:",
        "        from js import document",
        "        el = document.getElementById('pygame-caption')",
        "        if el: el.textContent = str(title)",
        "    except Exception:",
        "        pass",
        "    try:",
        "        return pygame.display.__orig_set_caption(title, *args)",
        "    except Exception:",
        "        return None",
        "pygame.display.set_caption = __nb_set_caption",
        "",
        "if not hasattr(pygame.event, '__orig_get'):",
        "    pygame.event.__orig_get = pygame.event.get",
        "def __evt_get(*a, **k):",
        "    evs = pygame.event.__orig_get(*a, **k)",
        "    for e in evs:",
        "        if e.type == pygame.MOUSEBUTTONDOWN and pygame_close_rect.collidepoint(e.pos):",
        "            pygame.event.post(pygame.event.Event(pygame.QUIT))",
        "    return evs",
        "pygame.event.get = __evt_get",
        "",
        "def __resync_backing():",
        "    try:",
        "        c = document.getElementById('canvas')",
        "        if c is None:",
        "            return",
        "        W = int(getattr(c, 'width', 0) or 640)",
        "        H = int(getattr(c, 'height', 0) or 480)",
        "        s = pygame.display.get_surface()",
        "        if (s is None):",
        "            pygame.display.__orig_set_mode((W, H))",
        "    except Exception:",
        "        pass",
        "",
        "if not hasattr(pygame.display, '__orig_flip'):",
        "    pygame.display.__orig_flip = pygame.display.flip",
        "def __flip_wrapper():",
        "    __resync_backing()",
        "    s = pygame.display.get_surface()",
        "    if s:",
        "        __draw_close_button(s)",
        "    try:",
        "        pygame.event.pump()",
        "    except Exception:",
        "        pass",
        "    pygame.display.__orig_flip()",
        "pygame.display.flip = __flip_wrapper",
        "",
        "if not hasattr(pygame.display, '__orig_update'):",
        "    pygame.display.__orig_update = pygame.display.update",
        "def __update_wrapper(*args, **kwargs):",
        "    __resync_backing()",
        "    s = pygame.display.get_surface()",
        "    if s:",
        "        __draw_close_button(s)",
        "    try:",
        "        pygame.event.pump()",
        "    except Exception:",
        "        pass",
        "    return pygame.display.__orig_update(*args, **kwargs)",
        "pygame.display.update = __update_wrapper",
        "",
      ].join("\n") + "\n";

      // Tracks MAXWIDTH/MAXHEIGHT on Python side after wrapper resize
      window.applyCanvasAndPygameSize = async function (W, H) {
        const wrap = document.getElementById("canvas-wrap");
        const cw = Math.max(1, Math.floor(wrap?.clientWidth || W || 0));
        const frame = document.getElementById("pygame-frame");
        const titlebar = document.getElementById("pygame-titlebar");
        const titleH = (frame && frame.style.display !== "none")
          ? Math.max(0, Math.round(titlebar?.getBoundingClientRect?.().height || 0))
          : 0;

        const ch = Math.max(1, Math.floor((wrap?.clientHeight || H || 0) - titleH));
        // Update Python globals if Pyodide is ready
        try {
          await window.pyodide?.runPythonAsync(
            `import builtins\n` +
            `try:\n` +
            `    import pygame\n` +
            `    pygame.display.MAXWIDTH=${cw}\n` +
            `    pygame.display.MAXHEIGHT=${ch}\n` +
            `except Exception:\n` +
            `    pass\n` +
            `builtins.MAXWIDTH=${cw}\n` +
            `builtins.MAXHEIGHT=${ch}\n`
          );
        } catch (e) { /* pyodide not ready yet */ }
      };

      userCode = transformSyncPygameToAsync(userCode);
    } else if (wantsMpl) {


      // --- Matplotlib Prefix (NEU v2) – HiDPI, sauberes Clear, transparenter Hintergrund ---
      const mplPrefix = [
        "import io, base64",
        "from js import document, window, Image as JsImage",
        "import matplotlib",
        "import matplotlib.pyplot as plt",
        "",
        "# --- IDE Default-Fix: kleinere Figure + Auto-Layout (verhindert abgeschnittene Labels)",
        "import matplotlib as _mpl",
        "_mpl.rcParams['figure.figsize'] = (5, 3)",
        "_mpl.rcParams['figure.autolayout'] = True",
        "_mpl.rcParams['font.size'] = 10",
        "_mpl.rcParams['axes.titlesize'] = 11",
        "_mpl.rcParams['axes.labelsize'] = 10",
        "_mpl.rcParams['xtick.labelsize'] = 9",
        "_mpl.rcParams['ytick.labelsize'] = 9",
        "",
        "# Vorherige Figures schließen (verhindert Überlagerungen)",
        "try:",
        "    plt.close('all')",
        "except Exception:",
        "    pass",
        "",
        "def __nb_mpl_show():",
        "    canvas = document.getElementById('mplCanvas')",
        "    if canvas is None:",
        "        return",
        "",
        "    cw, ch = int(canvas.width) or 640, int(canvas.height) or 480",
        "",
        "    # Canvas sofort löschen, bevor das neue Bild geladen wird",
        "    ctx = canvas.getContext('2d')",
        "    try:",
        "        ctx.setTransform(1,0,0,1,0,0)",
        "    except Exception:",
        "        pass",
        "    ctx.clearRect(0, 0, canvas.width, canvas.height)",
        "",
        "    # HiDPI-Anpassung",
        "    try:",
        "        dpr = int(round(float(window.devicePixelRatio)))",
        "        if dpr < 1: dpr = 1",
        "    except Exception:",
        "        dpr = 1",
        "",
        "    fig = plt.gcf()",
        "    dpi = 96 * dpr",
        "    fig.set_dpi(dpi)",
        "    fig.set_size_inches(cw / dpi, ch / dpi)",
        "",
        "    # Transparenz prüfen",
        "    transparent = False",
        "    try:",
        "        fc = fig.get_facecolor()",
        "        transparent = (len(fc) == 4 and fc[3] < 1.0)",
        "    except Exception:",
        "        pass",
        "",
        "    buf = io.BytesIO()",
        "    fig.savefig(",
        "        buf,",
        "        format='png',",
        "        dpi=dpi,",
        "        bbox_inches=None,",
        "        facecolor=fig.get_facecolor(),",
        "        edgecolor='none',",
        "        pad_inches=0,",
        "        transparent=transparent,",
        "    )",
        "    data = 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode('ascii')",
        "",
        "    img = JsImage.new()",
        "    def _onload(ev):",
        "        ctx = canvas.getContext('2d')",
        "        try:",
        "            ctx.setTransform(1,0,0,1,0,0)",
        "        except Exception:",
        "            pass",
        "        ctx.clearRect(0, 0, canvas.width, canvas.height)",
        "        ctx.drawImage(img, 0, 0, cw, ch)",
        "    img.onload = _onload",
        "    img.src = data",
        "",
        "# plt.show / plt.pause hooken",
        "plt.show = __nb_mpl_show",
        "def __nb_mpl_pause(t=0):",
        "    __nb_mpl_show()",
        "plt.pause = __nb_mpl_pause",
      ].join("\n") + "\n";

      // WICHTIG: wirklich einhängen!
      prefix += mplPrefix;
    } // --- Final zusammenbauen & ausführen (mit Mapping/Timeout) ---
    const preludeLines = countLines(prelude);
    const prefixLines = countLines(prefix);

    // HIER wird totalPrefixOffset nochmal als const deklariert:
    totalPrefixOffset = preludeLines + prefixLines + (__pygameHeaderLines || 0);

    window.__lastUserCodeRaw = __userCodeRaw;
    window.__lastPrefixOffset = totalPrefixOffset;

    let code = prelude + prefix + userCode + suffix;
    window.__lastRunPythonCode = code;


    // Timeout wie früher
    let timeoutMs = 300000;
    if (/\binput\s*\(/.test(code)) timeoutMs = 120000;
    if (/makeTurtle|from\s+gturtle|matplotlib|plt\./.test(code)) timeoutMs = Math.max(timeoutMs, 30000);

    // Vor dem Start: Pyodide-Fehlerausgabe unterdrücken



    try {
      const codePromise = window.pyBackend.runPythonAsync(code);
      const { timeoutPromise, disarm } = installAdaptiveTimeout(timeoutMs, "Zeitüberschreitung");
      try {
        await Promise.race([codePromise, timeoutPromise]);
      } finally {
        disarm();
      }
    } catch (e) {
      // Roh-Fehlermeldung aufbereiten
      const msg = (e && (e.message || e.stack || (e.toString && e.toString()))) || String(e);

      // 🧷 Spezialfall:
      // Typische Pygame-Fehler nach dem Schließen des Fensters
      // ("video system not initialized" / "Surface is not initialized")
      // behandeln wir als normalen Programmabbruch und zeigen KEINEN Fehlerdialog.
      if (
        /pygame\.error:\s*(video system not initialized|Surface is not initialized)/i.test(String(msg || ""))
      ) {
        try {
          console.warn("[RUN] Pygame nach Fenster-Schließen – Fehler ignoriert:", msg);
        } catch { }
        // Flag ggf. zurücksetzen und still beenden
        try { window.__userClickedPygameClose = false; } catch { }
        return;
      }

      // Für alle anderen Fehler: normale Fehlermeldung
      try { console.debug("[ERR] JS catch from runUserCode:", e); } catch { }
      window.reportPythonError(String(msg), {
        userCode: __userCodeRaw,
        prefixLines: totalPrefixOffset,
      });
      throw e; // Fehler weiterreichen (optional)
    } finally {
      // Flag immer zurücksetzen – auch bei normalem Ende
      window.__userClickedPygameClose = false;

      // 🧹 Immer aufräumen – auch bei normalem QUIT ohne Exception
      try { await pythonQuitPygame?.(); } catch { }
      try { softResetAfterRun?.(); } catch { }
      try { window.rebuildPygameCanvasHard?.(); } catch { }
      try { restoreEditorFocusNow?.(); } catch { }
    }
  }


  // ========== Deine neue bootPyodide() (komplett) ==========
  async function bootPyodide() {
    const outEl = document.getElementById("output");
    outEl.innerHTML = "Lade Pyodide...<br>";

    // 0) Optional: Worker-Mode
    if (window.USE_PYODIDE_WORKER && window.PY_WORKER_URL && window.PyClient) {
      try {
        window.pyWorkerClient = new window.PyClient(window.PY_WORKER_URL);


        // Streams → nur anzeigen, niemals Fehlerkarte bauen
        window.pyWorkerClient.on("stdout", ({ text }) => window.__py_stdout__?.(text));
        window.pyWorkerClient.on("stderr", ({ text }) => window.__py_stderr__?.(text));

        // Worker booten (ohne Pakete; Pakete lädt runUserCode() bei Bedarf)
        await window.pyWorkerClient.init([], window.PYODIDE_URL);
        outEl.innerHTML += "✅ Pyodide geladen<br>";
        // ⬇️  NEU: Main-Pyodide *sofort* als FS-Host initialisieren
        if (!window.__mainPy) {
          window.__mainPy = await loadPyodide({
            indexURL: window.PYODIDE_URL,
            // Übergang: altes Verhalten beibehalten
            toJsLiteralMap: true,      // 0.29: dict -> Map-ähnlich wie früher
            convertNullToNone: true    // 0.28: JS null wieder als None

          });
          (function patchSilentPackages(py) {
            const __origLP = py.loadPackage.bind(py);
            py.loadPackage = (names, opts = {}) =>
              __origLP(names, { ...opts, messageCallback: () => { } });

            if (py.loadPackagesFromImports) {
              const __origLPI = py.loadPackagesFromImports.bind(py);
              py.loadPackagesFromImports = (code, opts = {}) =>
                __origLPI(code, { ...opts, messageCallback: () => { } });
            }
          })(window.__mainPy);
        }
        window.__mainPyLoaded = true;                 // <<< wichtig: vorhandenes __mainPy gilt als „geladen“
        try { window.__mainPy.FS.mkdir("/home"); } catch { }
        try { window.__mainPy.FS.mkdir("/home/pyodide"); } catch { }
        try { window.__mainPy.FS.mkdir("/home"); } catch { }
        try { window.__mainPy.FS.mkdir("/home/pyodide"); } catch { }
        // gespeicherte Dateien (file_*) aus localStorage ins Main-FS zurückspielen
        try {
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key || !key.startsWith("file_")) continue;
            const name = key.slice(5);
            try {
              const data = JSON.parse(localStorage.getItem(key));
              window.__mainPy.FS.writeFile("/home/pyodide/" + name, new Uint8Array(data));
              (window.uploadedFiles ??= new Set()).add(name);
            } catch { }
          }
          window.refreshFileList?.();
        } catch (e) { }
        // WICHTIG: Turtle-Bridge auch auf dem Main-Pyodide registrieren
        await window.registerTurtleInPython?.(window.__mainPy);
        outEl.innerHTML += "💾 Filesystem bereit<br>";

        window.pyBackend = {
          kind: "worker",
          runPython: (code) => window.pyWorkerClient.run(code),
          runPythonAsync: (code) => window.pyWorkerClient.run(code),
          interrupt: () => window.pyWorkerClient.interrupt(),
          reset: () => window.pyWorkerClient.reset(),
        };

        try { window.showBackendBadge?.(); } catch { }
        return;
      } catch (e) {
        console.warn("[bootPyodide] Worker-Start fehlgeschlagen, fallback auf Main:", e);
      }
    }

    // 1) Fallback: Main-Thread Pyodide
    const py = await loadPyodide({
      indexURL: window.PYODIDE_URL,
      toJsLiteralMap: true,
      convertNullToNone: true
    });
    outEl.innerHTML += "✅ Pyodide 0.29.0 geladen<br>";

    await window.registerTurtleInPython?.(py); // dein Turtle-Hook

    // --- SAS-Pygame Paket laden (ZIP) ---
    /*try {
      const zipUrl = "/assets/sas_pygame.zip"; // <-- Pfad prüfen!
      outEl.innerHTML += "Lade SAS-Pygame…<br>";

      const resp = await fetch(zipUrl, { cache: "no-store" });
      if (!resp.ok) throw new Error(`HTTP ${resp.status} beim Laden ${zipUrl}`);

      const buf = await resp.arrayBuffer();

      // "PK\x03\x04" = 0x04034b50 (little endian)
      const isZip =
        buf.byteLength >= 4 &&
        new DataView(buf).getUint32(0, true) === 0x04034b50;
      if (!isZip) throw new Error("Kein ZIP: falscher Pfad oder Datei korrupt");

      await py.unpackArchive(new Uint8Array(buf), "zip");

      outEl.innerHTML += "✅ SAS-Pygame erfolgreich geladen<br>";
    } catch (e) {
      console.error("Fehler beim Laden des SAS-Pygame Pakets:", e);
      outEl.innerHTML += "⚠️ Fehler beim Laden von sas_pygame.zip: " + (e.message || e) + "<br>";
    }*/

    py.setStdout({
      batched(txt) {
        if (!txt) return;
        try { console.debug('[OUT] stdout:', String(txt).slice(0, 200)); } catch { }
        const out = document.getElementById('output');
        if (!out) return;
        const html = String(txt).replace(/\r\n|\r|\n/g, '<br>');
        out.insertAdjacentHTML('beforeend', `<div>${html}</div>`);
        out.scrollTop = out.scrollHeight;
      },
    });
    py.setStderr({
      batched(txt) {
        if (!txt) return;
        // zentral über unseren gefilterten Hook leiten
        window.__py_stderr__?.(txt);
      },
    });

    // Pyodide-Handles global anbieten
    window.pyodide = py;
    window.pyBackend = {
      kind: "main",
      runPython: (code) => py.runPython(code),
      runPythonAsync: (code) => py.runPythonAsync(code),
      interrupt: () => { },
      reset: () => { },
    };
    console.log("[PyBackend] gestartet im Main-Thread");

    // --- stdout/stderr Hooks (sauber, ohne doppelte Tracebacks) ---
    // direkt in bootPyodide(), wo stdout/stderr gesetzt werden:
    window.__py_stdout__ ??= __appendOut;
    window.__py_stderr__ ??= (t) => {
      if (!t) return;
      const msg = String(t);
      // 1) Fehlermeldung schön ausgeben (DEINE Funktion!)
      try {
        window.reportPythonError?.(msg, {
          userCode: window.__lastUserCodeRaw || window.editor?.getValue?.() || "",
          prefixLines: window.__lastPrefixOffset || 0
        });
      } catch { }
      // 2) IMMER freigeben (auch wenn report schiefgeht)
      try { pythonQuitPygame?.(); } catch { }
      try { softResetAfterRun?.(); } catch { }
      try { restoreEditorFocusNow?.(); } catch { }
    };

    outEl.innerHTML += "✅ Pyodide + jturtle bereit.<br>";// sys.stdout/sys.stderr in Python auf JS-Funktion umbiegen


    // --- FS initialisieren (Main) ---
    try { py.FS.mkdir("/home"); } catch { }
    try { py.FS.mkdir("/home/pyodide"); } catch { }

    // Gespeicherte Dateien reinholen
    let loadedFiles = 0;
    try {
      outEl.innerHTML += "Lade gespeicherte Dateien...<br>";
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("file_")) {
          const filename = key.replace("file_", "");
          try {
            const fileData = JSON.parse(localStorage.getItem(key));
            const uint8Array = new Uint8Array(fileData);
            py.FS.writeFile("/home/pyodide/" + filename, uint8Array);
            (window.uploadedFiles ??= new Set()).add(filename);
            loadedFiles++;
          } catch (e) {
            console.warn("[startup] Wiederherstellen fehlgeschlagen:", filename, e);
            localStorage.removeItem(key);
          }
        }
      }
    } catch (e) {
      console.warn("Fehler beim Laden der gespeicherten Dateien:", e);
      outEl.innerHTML += "⚠️ Fehler beim Laden der gespeicherten Dateien<br>";
    } finally {
      outEl.innerHTML += loadedFiles
        ? `✅ ${loadedFiles} gespeicherte Dateien wiederhergestellt<br>`
        : "ℹ️ Keine gespeicherten Dateien gefunden<br>";

      // Beispiel-Ressourcen aus Session wiederherstellen
      try {
        const raw = sessionStorage.getItem("lastExampleResources");
        const resList = raw ? JSON.parse(raw) : [];
        const tomb = JSON.parse(sessionStorage.getItem("deleted_files") || "[]");
        if (Array.isArray(resList) && resList.length) {
          let restored = 0;
          for (const rel of resList) {
            try {
              const abs = new URL(rel, document.baseURI).href;
              const name = abs.split("/").pop();
              if (tomb.includes(name)) continue; // Fix: nicht 'base'
              const r = await fetch(abs, { cache: "no-store" });
              if (!r.ok) continue;
              const buf = new Uint8Array(await r.arrayBuffer());
              py.FS.writeFile("/home/pyodide/" + name, buf);
              (window.uploadedFiles ??= new Set()).add(name);
              restored++;
            } catch { }
          }
          if (restored) outEl.innerHTML += `🔁 ${restored} Beispiel-Datei(en) wiederhergestellt<br>`;
        }
      } catch { }

      setTimeout(() => {
        const filesPanel = document.getElementById("files-panel");
        const filesHidden = filesPanel && getComputedStyle(filesPanel).display === "none";

        // Dateien prüfen
        let hasFiles = false;
        try {
          const list = py.FS.readdir("/home/pyodide").filter((f) => f !== "." && f !== "..");
          hasFiles = list.length > 0;
        } catch { }

        if (filesPanel && hasFiles) filesPanel.style.display = "block";
        if (filesHidden && !hasFiles) outEl.textContent = "✅ Alle Dateien geladen - Bereit für Python-Code!\n";

        try { window.refreshFileList?.(); } catch (e) { console.warn("[bootPyodide] refreshFileList fehlgeschlagen:", e); }
      }, 1000);

      // IDE neutralisieren (Canvas etc.)
      try {
        window.pyodide?.canvas?.setCanvas2D?.(null);
        const c = document.getElementById("canvas");
        if (c) {
          c.style.pointerEvents = "none";
          c.tabIndex = -1;
          c.blur();
        }
      } catch { }

      // Editor fokusieren
      try {
        window.editor?.focus?.();
        setTimeout(() => window.editor?.focus?.(), 0);
        setTimeout(() => {
          const tn = window.editor?.getDomNode?.()?.querySelector?.("textarea");
          tn?.focus?.();
        }, 0);
      } catch { }
    }

    try { window.showBackendBadge?.(); } catch { }
  } // bootPyodide

  // ---- Adaptive Timeout ----
  function installAdaptiveTimeout(timeoutMs, label = "Zeitüberschreitung") {
    let timer = null;
    let rejectFn = null;
    const timeoutPromise = new Promise((_, reject) => {
      rejectFn = reject;
    });
    function disarm() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    }
    function arm() {
      disarm();
      timer = setTimeout(() => {
        rejectFn(
          new Error(
            `${label} - Programm war ${Math.round(timeoutMs / 1000)}s inaktiv`
          )
        );
      }, timeoutMs);
    }
    function tick() {
      arm();
    }
    window.__activityPing = tick;
    arm();
    return { timeoutPromise, disarm, tick };
  }

  // --- Canvas-Autofix: schaltet Layout auf "Canvas + Output", wenn Code Grafik braucht ---
  function ensureCanvasVisibleForCode(raw) {
    try {
      // Gerät: bei Calliope NIEMALS umschalten
      const dev = document.getElementById('device-select')?.value
        || localStorage.getItem('ui.device')
        || 'none';
      if (dev === 'c12' || dev === 'c3') return;

      const needsPygame = /\b(import\s+pygame|from\s+pygame\b)/i.test(raw);
      const needsMpl = /\b(import\s+matplotlib|from\s+matplotlib\b|plt\.)/i.test(raw);
      // Turtle-Heuristiken (bei dir wird turtle meist ohne import genutzt)
      const needsTurtle = /(forward\s*\(|right\s*\(|left\s*\(|penup|pendown|bgcolor|speed\s*\()/i.test(raw);

      const needsCanvas = needsPygame || needsMpl || needsTurtle; // KEIN Fallback für „einfachen“ Code
      if (!needsCanvas) return;

      // Wenn aktuell "Output + Dateien" aktiv ist → auf "Canvas + Output" umschalten
      const sel = document.getElementById('layout-select');
      const cur = sel?.value || localStorage.getItem('ui.layout') || 'canvas-output';
      if (cur === 'output-files') {
        // benutze deine vorhandene setLayout-Logik, damit alles sauber resized wird
        if (typeof setLayout === 'function') setLayout('canvas-output');
        else {
          sel.value = 'canvas-output';
          window.applyLayoutByValue?.('canvas-output');
          try { localStorage.setItem('ui.layout', 'canvas-output'); } catch { }
        }
      }

      // Wrap sichtbar (failsafe)
      const wrap = document.getElementById('canvas-wrap');
      if (wrap) wrap.style.display = 'flex';
    } catch { }
  }

  // 

  // ========== repeat-Erweiterung & Fehlerformatierer ==========
  function extendPythonCode(code) {
    const lines = code.split(/\r?\n/);
    const out = [];
    for (let line of lines) {
      const original = line;
      const trimmed = line.trimStart();
      const indent = line.slice(0, line.length - trimmed.length);
      if (!trimmed || trimmed.startsWith("#")) {
        out.push(original);
        continue;
      }

      let m = trimmed.match(/^repeat\s+(.+?)\s*:\s*(#.*)?$/);
      if (m) {
        const expr = m[1].trim();
        const comment = m[2] ? " " + m[2].trim() : "";
        out.push(`${indent}for _ in range(${expr}):${comment}`);
        continue;
      }

      m = trimmed.match(/^repeat\s+(.+?)\s+(?!#)(.+)$/);
      if (m) {
        const expr = m[1].trim();
        const stmt = m[2].trim();
        out.push(`${indent}for _ in range(${expr}): ${stmt}`);
        continue;
      }

      m = trimmed.match(/^repeat\s+(.+?)\s*(#.*)?$/);
      if (m) {
        const expr = m[1].trim();
        const comment = m[2] ? " " + m[2].trim() : "";
        out.push(`${indent}for _ in range(${expr}):${comment}`);
        continue;
      }

      out.push(original);
    }
    return out.join("\n");
  }

  function formatPythonError(errorMessage, opts = {}) {
    const {
      userCode = null,
      contextLines = 1,
      prefixLines = 0,
      userTotalLines = null,
    } = opts;

    const clean = extractRelevantError(String(errorMessage || ""));
    const parsed = parsePyodideTraceback(clean.split(/\r?\n/));

    // --- Zeilen-Mapping ---
    let mappedLine = parsed.line;
    let where = "user";
    if (Number.isInteger(parsed.line) && parsed.line > 0 && userCode) {
      const totalUser = userTotalLines ?? userCode.split(/\r?\n/).length;
      const L = parsed.line;

      if (L <= prefixLines) {
        where = "prefix";
      } else if (L > prefixLines + totalUser) {
        where = "suffix";
      } else {
        mappedLine = L - prefixLines;
        where = "user";
      }
    }

    // Snippet nur für User-Code
    const snippet =
      where === "user"
        ? buildSnippet({
          userCode,
          line: mappedLine,
          contextLines,
          fallbackCodeFromTrace: parsed.codeFromTraceback,
        })
        : null;

    const locNote =
      where === "user"
        ? ""
        : where === "prefix"
          ? " (Hinweis: Fehler trat im internen Prefix für Pygame/Matplotlib auf)"
          : " (Hinweis: Fehler trat im internen Suffix für Matplotlib auf)";

    const header =
      "❌ Python-Fehler\n" +
      (parsed.file ? `Datei: ${parsed.file}\n` : "") +
      (where === "user"
        ? mappedLine
          ? `Zeile: ${mappedLine}\n`
          : ""
        : parsed.line
          ? `Zeile: ${parsed.line}${locNote}\n`
          : "") +
      (parsed.errorType ? `Art: ${parsed.errorType}\n` : "") +
      (parsed.errorMessage ? `Nachricht: ${parsed.errorMessage}\n` : "");

    const block = [];
    if (snippet?.text) block.push("\nCodeausschnitt:\n" + snippet.text);
    const hints = buildHints(parsed, snippet?.mainLine || "");
    if (hints) block.push("\nHinweise:\n" + hints);

    return header + (block.length ? "\n" + block.join("\n") : "");
  }

  // —— öffentlich machen (wichtig, sonst ist window.formatPythonError undefined)
  window.extendPythonCode = extendPythonCode;
  window.formatPythonError = formatPythonError;

  function extractRelevantError(message) {
    let m = message;
    const idx = m.indexOf("Traceback (most recent call last):");
    if (idx >= 0) m = m.slice(idx);
    const lines = m.split(/\r?\n/);
    const filtered = [];
    for (const line of lines) {
      if (
        line.includes('File "/lib/python') ||
        line.includes("_pyodide/_base.py") ||
        line.includes('File "/usr/lib/') ||
        line.includes("site-packages/pyodide") ||
        line.includes("importlib/_bootstrap")
      )
        continue;
      filtered.push(line);
    }
    return filtered.join("\n").trim() || message;
  }
  function parsePyodideTraceback(lines) {
    let file = "",
      line = null,
      codeFromTraceback = "",
      errorType = "",
      errorMessage = "";
    const frameRegex = /^\s*File\s+"([^"]+)",\s+line\s+(\d+)(?:,.*)?$/;
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(frameRegex);
      if (m) {
        file = m[1];
        line = parseInt(m[2], 10);
        let j = i + 1;
        while (j < lines.length && lines[j].trim() === "") j++;
        if (j < lines.length && !/^ {0,}File\s+/.test(lines[j])) {
          if (!/^\s*\^+\s*$/.test(lines[j]))
            codeFromTraceback = lines[j].trim();
        }
      }
    }
    let last = "";
    for (let k = lines.length - 1; k >= 0; k--) {
      const t = lines[k].trim();
      if (t) {
        last = t;
        break;
      }
    }
    const mLast = last.match(/^([A-Za-z_][\w\.]*)(?::\s*(.*))?$/);
    if (mLast) {
      errorType = mLast[1] || "";
      errorMessage = mLast[2] || "";
    } else {
      errorMessage = last;
    }
    return { file, line, codeFromTraceback, errorType, errorMessage };
  }
  function buildSnippet({
    userCode,
    line,
    contextLines,
    fallbackCodeFromTrace,
  }) {
    if (userCode && Number.isInteger(line) && line > 0) {
      const src = userCode.split(/\r?\n/);
      const idx = line - 1;
      const start = Math.max(0, idx - contextLines);
      const end = Math.min(src.length - 1, idx + contextLines);
      const rows = [];
      for (let i = start; i <= end; i++) {
        const ln = String(i + 1).padStart(4, " ");
        const marker = i === idx ? ">" : " ";
        rows.push(`${marker} ${ln}: ${src[i]}`);
        if (i === idx) {
          const indent = src[i].match(/^(\s*)/)?.[1].length || 0;
          rows.push(`${" ".repeat(6 + indent)} ^`);
        }
      }
      return { text: rows.join("\n"), mainLine: src[idx] || "" };
    }
    if (fallbackCodeFromTrace)
      return {
        text: `> ${fallbackCodeFromTrace}`,
        mainLine: fallbackCodeFromTrace,
      };
    return { text: "", mainLine: "" };
  }
  function isRepeatContext(lineText) {
    const t = (lineText || "").trim();
    return t.startsWith("repeat ") || t.startsWith("for _ in range(");
  }
  function buildHints(parsed, codeLine) {
    const t = parsed.errorType || "";
    const rawMsg = parsed.errorMessage || "";
    const msg = rawMsg.toLowerCase();
    const lineText = (codeLine || "").trim();
    const inRepeat = isRepeatContext(lineText);
    const missingColonAfter = (kw) =>
      `Fehlender Doppelpunkt nach "${kw}": \n   Richtig: ${kw} … : \n   Falsch:  ${kw} …`;

    if (t === "SyntaxError" || /invalid syntax/.test(msg)) {
      if (/unexpected eof while parsing|unterminated/.test(msg))
        return "Unvollständiger Ausdruck oder fehlende schließende Klammer/Anführungszeichen.";
      if (/eol while scanning string literal/.test(msg))
        return "Unvollständiger String: Anführungszeichen nicht geschlossen.";
      if (/\bexpected ':'\b/.test(msg)) {
        if (
          inRepeat &&
          lineText.startsWith("repeat ") &&
          !lineText.endsWith(":") &&
          !/:\s*\S/.test(lineText)
        )
          return 'Nach "repeat <Ausdruck>" muss ein Doppelpunkt folgen, wenn ein Block kommt.';
        return "Doppelpunkt (:) erwartet – z. B. nach if/for/while/def/class…";
      }
      if (
        /^(if|elif|else|for|while|def|class|try|except|finally)\b/i.test(
          lineText
        ) &&
        !lineText.endsWith(":")
      ) {
        const kw = lineText.match(/^\w+/)?.[0] || "Block";
        return missingColonAfter(kw);
      }
      if (inRepeat && /^repeat\s+.+/.test(lineText) && !/:$/.test(lineText))
        return 'Einzeilige Form: "repeat <Ausdruck> <Anweisung>" – oder Block: "repeat <Ausdruck>:"';
      return "Allgemeiner Syntaxfehler. Prüfe Klammern (), Doppelpunkte (:), Anführungszeichen und Kommas.";
    }
    if (t === "IndentationError") {
      if (/expected an indented block/.test(msg))
        return "Block erwartet: Zeilen innerhalb von if/for/while/def… müssen eingerückt sein (z. B. 4 Leerzeichen).";
      if (/unindent does not match/.test(msg))
        return "Einrückungsniveau passt nicht. Achte auf konsistente Leerzeichen/Tabs.";
      return "Einrückungsfehler. Verwende konsequent 4 Leerzeichen pro Ebene.";
    }
    if (t === "NameError") {
      const m = rawMsg.match(/name ['"]([^'"]+)['"] is not defined/i);
      if (m)
        return inRepeat
          ? `Im Ausdruck von "repeat …" ist „${m[1]}“ nicht definiert.`
          : `„${m[1]}“ ist nicht definiert.`;
      return "Ein Name ist nicht definiert.";
    }
    if (t === "TypeError") {
      if (/object cannot be interpreted as an integer/.test(msg))
        return inRepeat
          ? 'Der Ausdruck in "repeat …" muss eine **ganze Zahl** ergeben.'
          : "Es wurde eine ganze Zahl erwartet (z. B. für range()).";
      if (/unsupported operand type/.test(msg))
        return "Nicht kompatible Typen in einem Operator. Mit int()/str()/float() umwandeln.";
      if (/is not iterable/.test(msg)) return "Objekt ist nicht iterierbar.";
      return inRepeat
        ? 'Der Ausdruck in "repeat …" muss eine **ganze Zahl** liefern.'
        : "Typfehler: Datentypen prüfen.";
    }
    if (t === "ValueError") {
      if (/invalid literal for int\(/.test(msg))
        return inRepeat
          ? 'Der Ausdruck in "repeat …" kann nicht in int umgewandelt werden.'
          : "Ungültiger Wert für int().";
      return "Ungültiger Wert an Funktion/Operation übergeben.";
    }
    if (t === "ZeroDivisionError") return "Division durch 0 ist nicht erlaubt.";
    if (t === "IndexError")
      return "Listenindex außerhalb des gültigen Bereichs.";
    if (t === "KeyError") return "Dictionary-Schlüssel nicht vorhanden.";
    if (/no such file or directory/.test(msg))
      return "Datei nicht gefunden. Pfad/Name prüfen.";
    return inRepeat
      ? 'Fehler in "repeat …". Ausdruck muss eine ganze Zahl sein.'
      : "Fehler prüfen: Syntax, Einrückung, definierte Variablen.";
  }

  function clearAllGraphics() {
    const { turtle, mpl, pygame, single } = getLayers();

    /* 🐢 Turtle */
    if (window.turtleReset) {
      window.turtleReset();     // kompletter Reset (Pfad, Pos, Heading, Sichtbarkeit)
    }

    /* 📈 Matplotlib */
    if (mpl) {
      const ctx = mpl.getContext("2d");
      if (ctx) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, mpl.width, mpl.height);
      }
    }

    /* 🎮 Pygame */
    if (window.pygameReset) {
      window.pygameReset();     // ⭐ BESTE Lösung
    } else if (pygame) {
      // Fallback: Canvas hart löschen
      const ctx = pygame.getContext("2d");
      if (ctx) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, pygame.width, pygame.height);
      }
    }

    /* optional: Single-Canvas */
    if (single) {
      const ctx = single.getContext("2d");
      if (ctx) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, single.width, single.height);
      }
    }

    console.log("✔ Turtle, MPL und Pygame gelöscht");
  }

  document.getElementById("clear-editor-btn")
    ?.addEventListener("click", () => window.editor?.setValue(""));

  document
    .getElementById("clear-canvas-btn")
    ?.addEventListener("click", clearAllGraphics);

  document.getElementById("clear-output-btn")?.addEventListener("click", () => {
    outEl.innerHTML = "";
  });

  // ========== Programm laden/speichern ==========
  document
    .getElementById("load-program-btn")
    ?.addEventListener("click", function (e) {
      e.preventDefault();
      const hb = document.getElementById("hamburger-btn");
      if (window.bootstrap && hb)
        bootstrap.Dropdown.getOrCreateInstance(hb).hide();

      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".py,.txt";
      input.onchange = function (e) {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) =>
          window.editor?.setValue?.(ev.target.result || "");
        reader.readAsText(file);
      };
      input.click();
    });

  document
    .getElementById("save-program-btn")
    ?.addEventListener("click", function (e) {
      e.preventDefault();
      const hb = document.getElementById("hamburger-btn");
      if (window.bootstrap && hb)
        bootstrap.Dropdown.getOrCreateInstance(hb).hide();
      const code = window.editor?.getValue?.() ?? "";
      const blob = new Blob([code], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "programm.py";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });

  // --- Layout-Select beim Öffnen des Menüs aktualisieren ---
  document.getElementById("hamburger-btn")
    ?.addEventListener("click", () => {
      const sel = document.getElementById("layout-select");
      if (sel) sel.value = getLS("ui.layout") || "canvas-output";
    });


  // ------- Beispiele: Setup & UI-Elemente -------
  const examplesModalElement = document.getElementById("examplesModal");
  const examplesGrid = document.getElementById("examples-grid");
  const examplesModalTitle = document.getElementById("examplesModalLabel");
  const licensesBtn = document.getElementById("licenses-btn");
  const impressumBtn = document.getElementById("impressum-btn");

  licensesBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    showLicenses();
  });

  impressumBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    showImpressum();
  });

  // ========== Examples: JSON → Liste anzeigen → erst nach Auswahl laden ==========

  // --- kleine Helper ---
  const $ = (sel) => document.querySelector(sel);

  // Aktuelles Gerät (none | c12 | c3)
  function currentDevice() {
    try {
      const saved = localStorage.getItem("ui.device");
      if (saved) return saved;
    } catch { }
    return $("#device-select")?.value || "none";
  }

  // Globale State-Variablen für das Modal
  let examples = []; // gefilterte Einträge (ohne vorab geladenen Code)
  let selectedExample = null; // Index in examples[]
  let EXAMPLES_BASE = document.baseURI; // Basis-URL der zuletzt geladenen JSON

  // ---- Runtime-Normalisierung: alte JSON-Werte bleiben erlaubt ----
  function normalizeRuntimeToDevice(rtRaw) {
    const r = String(rtRaw || "")
      .toLowerCase()
      .trim();
    if (r === "python" || r === "c3" || r === "c12") return r;
    if (
      r === "micropython" ||
      r === "calliope" ||
      r === "classic" ||
      r === "1/2"
    )
      return "c12";
    // unbekannt → als python behandeln
    return "python";
  }
  function deviceMatches(dev, runtimeNorm) {
    if (dev === "c12") return runtimeNorm === "c12";
    if (dev === "c3") return runtimeNorm === "c3";
    return runtimeNorm === "python";
  }
  const absFromJsonBase = (p) => {
    try {
      return new URL(String(p || "").replace(/^\.\//, ""), EXAMPLES_BASE).href;
    } catch {
      return p;
    }
  };

  // ---------------- 1) Beispiele aus JSON einlesen (KEIN Code vorab laden!) ----------------
  async function loadExamplesFromJson(jsonUrl = "data/examples.json") {
    // 1) JSON holen
    const res = await fetch(jsonUrl, { cache: "no-store" });
    if (!res.ok)
      throw new Error(`JSON nicht ladbar: ${res.status} ${res.statusText}`);
    const data = await res.json();
    const items = Array.isArray(data?.examples) ? data.examples : [];

    // echte Basis der JSON merken (inkl. Redirects)
    EXAMPLES_BASE = new URL(".", res.url).href;

    // 2) Gerätemodus
    const dev = currentDevice(); // 'none' | 'c12' | 'c3'
    const isCalliope = dev === "c12" || dev === "c3";

    // 3) Rohdaten normalisieren + nach Gerät filtern (mit Legacy-"micropython")
    let list = items
      .map((e) => {
        const file = String(e.file || "").trim();
        const name =
          String(e.name || "").trim() ||
          (file ? file.split("/").pop() : "Beispiel");
        const image = e.image ? String(e.image).trim() : null;
        const runtimeNorm = normalizeRuntimeToDevice(e.runtime);
        const resources = Array.isArray(e.resources)
          ? e.resources
          : typeof e.resources === "string"
            ? e.resources
              .split(/[\n,;]+/)
              .map((s) => s.trim())
              .filter(Boolean)
            : [];
        return { file, name, image, runtimeNorm, resources };
      })
      .filter((e) => e.file && deviceMatches(dev, e.runtimeNorm));

    // 4) NUR Liste vorbereiten – KEIN Code vorab laden!
    const out = [];
    const placeholderImg =
      "data:image/svg+xml;base64," +
      btoa(
        '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="180"><rect width="100%" height="100%" fill="#ddd"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#777" font-family="Arial" font-size="14">Kein Bild</text></svg>'
      );

    for (const ex of list) {
      // Bild nur für Turtle versuchen (Calliope ohne Preview)
      let img = ex.image;
      if (!isCalliope) {
        if (!img) {
          // Bildname heuristisch aus Dateinamen ableiten: foo.(png|jpg|jpeg|webp)
          const stem = ex.file
            .replace(/^.*\//, "")
            .replace(/\.py(\.txt)?$/i, "")
            .replace(/\.txt$/i, "");
          const baseDir = ex.file.replace(/[^/]*$/, "");
          // Kandidat absolut relativ zur JSON auflösen
          const tryImg = async (rel) => {
            const url = absFromJsonBase(rel);
            try {
              let rr = await fetch(url, { method: "HEAD", cache: "no-store" });
              if (!rr.ok)
                rr = await fetch(url, { method: "GET", cache: "no-store" });
              return rr.ok ? url : null;
            } catch {
              return null;
            }
          };
          const exts = [
            "png",
            "jpg",
            "jpeg",
            "webp",
            "PNG",
            "JPG",
            "JPEG",
            "WEBP",
          ];
          for (const ext of exts) {
            const candidate = baseDir + stem + "." + ext;
            const ok = await tryImg(candidate);
            if (ok) {
              img = ok;
              break;
            }
          }
        }
        if (!img) img = placeholderImg;
      } else {
        img = null;
      }

      out.push({
        name: ex.name,
        file: ex.file, // Pfad wie in JSON
        absFile: absFromJsonBase(ex.file),
        image: isCalliope ? null : img, // Nur Turtle bekommt Preview
        description: isCalliope
          ? `Calliope ${dev}: ${ex.name}`
          : `Python-Programm: ${ex.name}`,
        code: null, // Wichtig: NICHT vorab laden
        kind: isCalliope ? "calliope" : "turtle",
        resources: ex.resources,
      });
    }

    // 5) Fallback, falls leer
    if (!out.length) {
      out.push({
        name:
          dev === "c12"
            ? "Beispiele (Calliope 1/2)"
            : dev === "c3"
              ? "Beispiel (Calliope 3)"
              : "Beispiel (Turtle)",
        file: "",
        image: dev === "c12" || dev === "c3" ? null : placeholderImg,
        description: "Fallback",
        code:
          dev === "c12" || dev === "c3"
            ? "# Calliope-Fallback\nfrom microbit import *\n\ndisplay.show(Image.HAPPY)\n"
            : "# Turtle-Fallback\nforward(100)\nright(90)\nforward(100)\n",
        kind: dev === "c12" || dev === "c3" ? "calliope" : "turtle",
      });
    }

    // 6) Bereitstellen
    examples = out;

    // Debug
    console.log("[examples] loaded", {
      device: dev,
      base: EXAMPLES_BASE,
      count: examples.length,
      examples,
    });
  }

  // ---------------- 2) Modal rendern: Liste anzeigen, noch nichts laden ----------------
  function showExamples() {
    const modalTitle = $("#examplesModalLabel"); // in index.html vorhanden
    const examplesGrid = $("#examples-grid");
    const loadBtn = $("#load-example-btn");

    if (!examplesGrid || !loadBtn) return;

    // Titel je nach Modus
    const dev = currentDevice();
    if (modalTitle) {
      modalTitle.textContent =
        dev === "c12"
          ? "📚 Calliope 1/2 Beispiele"
          : dev === "c3"
            ? "📚 Calliope 3 Beispiele"
            : "📚 Python-Beispiele";
    }

    examplesGrid.innerHTML = "";
    selectedExample = null;
    loadBtn.disabled = true;
    loadBtn.dataset.selUrl = "";

    // Turtle → kleine Karten mit (optionalem) Bild
    if (dev !== "c12" && dev !== "c3") {
      examples.forEach((ex, index) => {
        const cardHtml = `
        <div  class="col-6 col-md-4 col-lg-3 col-xxl-2">
          <div class="example-card" data-example="${index}">
            ${ex.image
            ? `<img src="${ex.image}" alt="${ex.name}" class="example-image">`
            : `<div class="example-image" style="display:flex;align-items:center;justify-content:center;">Kein Bild</div>`
          }
            <div class="example-title">${ex.name}</div>
          </div>
        </div>
      `;
        examplesGrid.insertAdjacentHTML("beforeend", cardHtml);
      });

      // Auswahl-Handler
      examplesGrid.querySelectorAll(".example-card").forEach((card) => {
        card.addEventListener("click", () => {
          examplesGrid
            .querySelectorAll(".example-card.selected")
            .forEach((c) => c.classList.remove("selected"));
          card.classList.add("selected");
          const idx = Number(card.dataset.example);
          selectedExample = idx;
          loadBtn.disabled = false;
          loadBtn.dataset.selUrl = examples[idx]?.file || "";
        });
      });
    } else {
      // Calliope → schlanke Liste
      const listHtml = `
      <div class="col-12">
        <ul class="list-group" id="calliope-list">
          ${examples
          .map(
            (ex, idx) => `
            <li class="list-group-item d-flex align-items-center justify-content-between" data-example="${idx}">
              <span>${ex.name}</span>
              <button class="btn btn-sm btn-outline-primary pick-example" data-example="${idx}">Auswählen</button>
            </li>
          `
          )
          .join("")}
        </ul>
      </div>
    `;
      examplesGrid.insertAdjacentHTML("beforeend", listHtml);

      // Auswahl-Handler
      examplesGrid.querySelectorAll(".pick-example").forEach((btn) => {
        btn.addEventListener("click", () => {
          examplesGrid
            .querySelectorAll(".list-group-item.active")
            .forEach((li) => li.classList.remove("active"));
          const idx = Number(btn.dataset.example);
          const li = btn.closest(".list-group-item");
          li?.classList.add("active");
          selectedExample = idx;
          loadBtn.disabled = false;
          loadBtn.dataset.selUrl = examples[idx]?.file || "";
        });
      });
    }
  }

  // --- Mini-Helper: /home/pyodide leeren (rekursiv) ------------------------
  function __clearDir(dir) {
    try {
      for (const f of pyodide.FS.readdir(dir)) {
        if (f === "." || f === "..") continue;
        const p = `${dir}/${f}`;
        try {
          const st = pyodide.FS.stat(p);
          if (pyodide.FS.isDir(st.mode)) {
            __clearDir(p);
            pyodide.FS.rmdir(p);
          } else {
            pyodide.FS.unlink(p);
          }
        } catch { }
      }
    } catch { }
  }
  function clearHome() {
    try {
      __clearDir("/home/pyodide");
    } catch { }
  }

  // Pfad relativ zur Seite (index.html) auflösen
  function absFromPageBase(p) {
    try {
      return new URL(p, document.baseURI).href;
    } catch {
      return p;
    }
  }


  // ONE-SHOT: Arbeitsverzeichnis leeren + Ressourcen kopieren + protokollieren
  async function resetAndCopyResources(example) {
    const outEl = document.getElementById("output");
    // === Einfache, zentrale Fehleranzeige ===

    const log = (m) => outEl && (outEl.innerHTML += `<div>${m}</div>`);

    const FS = window.getFS && window.getFS();
    if (!FS) {
      log("ℹ️ Ressourcen werden im Worker übersprungen (kein Filesystem).");
      return 0;
    }

    // 1) /home/pyodide komplett leeren
    try {
      for (const f of FS.readdir("/home/pyodide")) {
        if (f === "." || f === "..") continue;
        FS.unlink(`/home/pyodide/${f}`);
      }
    } catch { }

    // 2) Ressourcenliste tolerant einlesen
    let list = [];
    if (Array.isArray(example?.resources)) list = example.resources;
    else if (typeof example?.resources === "string")
      list = example.resources.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
    try { sessionStorage.setItem("lastExampleResources", JSON.stringify(list)); } catch { }
    if (!list.length) {
      log("ℹ️ Keine Ressourcen angegeben.");
      return 0;
    }

    // 3) Dateien holen und **nur Basename** speichern
    let ok = 0;
    for (const rel of list) {
      try {
        const abs = new URL(rel, document.baseURI).href;
        log(`➡️ lade: ${abs}`);
        const r = await fetch(abs, { cache: "no-store" });
        if (!r.ok) { log(`❌ HTTP ${r.status}`); continue; }
        const buf = new Uint8Array(await r.arrayBuffer());
        const name = abs.split("/").pop();              // nur Dateiname
        FS.writeFile(`/home/pyodide/${name}`, buf);     // flach ablegen
        (window.uploadedFiles ??= new Set()).add(name);  // <<< WICHTIG
        ok++;
        log(`✅ kopiert: ${name}`);
      } catch (e) {
        log(`⚠️ Fehler bei ${rel}: ${e.message || e}`);
      }
    }
    try { sessionStorage.setItem("lastExampleResources", JSON.stringify(list)); } catch { }
    log(`📦 ${ok} Datei(en) kopiert`);
    console.log("[TEST] check main cwd + list");
    try { await window.refreshFileList?.(); } catch { }

    // Modal schließen
    try {
      const modalEl = document.getElementById("examplesModal");
      bootstrap.Modal.getOrCreateInstance(modalEl).hide();
    } catch { }

  }

  // ---------------- 3) Ausgewählte Datei JETZT laden (einzeln) -------------
  // === Beispiel laden (robust: .py und .py.txt probieren, Sibling-Module einsammeln)
  async function openSelectedExampleFromList(relPath) {
    const outEl = document.getElementById("output");

    // 1) Pfad aus Button/Selektion ermitteln
    if (!relPath) {
      const fromBtn = document.getElementById("load-example-btn")?.dataset?.selUrl || "";
      const fromSel = (typeof selectedExample === "number" && examples[selectedExample])
        ? (examples[selectedExample].file || "")
        : "";
      relPath = fromBtn || fromSel || "";
    }
    if (!relPath) {
      outEl?.insertAdjacentHTML?.("beforeend", `<div class="text-danger">❌ Kein Beispielpfad vorhanden.</div>`);
      return;
    }

    // 2) Exakt 1 URL (relativ zur index.html)
    const url = new URL(relPath, document.baseURI).href;

    // 3) Laden
    let code;
    try {
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
      code = await r.text();
    } catch (e) {
      outEl?.insertAdjacentHTML?.("beforeend",
        `<div class="text-danger">❌ Beispiel nicht gefunden: <code>${url}</code><br><small>${e?.message || e}</small></div>`);
      return;
    }

    // 4) Editor füllen
    window.editor?.setValue?.(code);
    outEl?.insertAdjacentHTML?.("beforeend", `✅ Beispiel geladen: <code>${url}</code><br>`);

    // 5) Kontext für Sibling-Module (optional)
    window.__lastExampleCtx.baseUrl = url;
    window.__lastExampleCtx.modules = {};

    // 6) Sibling-Module (nur .py) im selben Ordner
    const localMods = parseLocalImports(code);
    for (const mod of localMods) {
      const hit = await tryFetchSibling(url, mod);
      if (hit && window.isMainMode && window.isMainMode()) {
        try {
          const FS = window.pyodide?.FS;
          if (FS) {
            try { FS.mkdir("/home"); } catch { }
            try { FS.mkdir("/home/pyodide"); } catch { }
            FS.writeFile(`/home/pyodide/${mod}.py`, new TextEncoder().encode(hit.code));
          }
        } catch { }
      }
    }

    // 7) Ressourcen kopieren: **relativ zur index.html** (nicht zur Beispiel-Datei)
    try {
      await resetAndCopyResources({ resources: examples[selectedExample]?.resources || [] });
    } catch { }
    try { window.refreshFileList?.(); } catch { }
    // Modal schließen (falls offen)
    try {
      const modalEl = document.getElementById("examplesModal");
      if (modalEl) {
        const inst = bootstrap.Modal.getInstance(modalEl)
          || bootstrap.Modal.getOrCreateInstance(modalEl);
        inst.hide();
      }
    } catch { }
  }

  // ---------------- 4) Wiring: Buttons/Events ----------------
  $("#examples-btn")?.addEventListener("click", async (ev) => {
    ev.preventDefault();
    const grid = $("#examples-grid");
    const loadBtn = $("#load-example-btn");
    if (grid && loadBtn) {
      grid.innerHTML = '<div class="text-muted p-2">Lade Liste …</div>';
      loadBtn.disabled = true;
      loadBtn.dataset.selUrl = "";
    }
    try {
      await loadExamplesFromJson("data/examples.json");
      showExamples();
      // Modal öffnen
      const modalEl = $("#examplesModal");
      const modal =
        bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
      modal.show();
    } catch (e) {
      console.error("[examples] JSON-Fehler:", e);
      if (grid)
        grid.innerHTML = `<div class="text-danger p-2">Fehler: ${e?.message || e
          }</div>`;
    }
  });

  // exklusiver Click-Handler für "Beispiel laden"
  (function wireExclusiveOpenHandler() {
    const btn = document.getElementById("load-example-btn");
    if (!btn) return;

    // evtl. alte Listener entfernen (falls ihr ein eigenes .onClick gesetzt hattet)
    btn.onclick = null;

    btn.addEventListener(
      "click",
      async (e) => {
        // verhindert, dass andere (alte) Listener laufen
        e.preventDefault();
        e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();

        // unser Loader
        try {
          await openSelectedExampleFromList();
        } catch (err) {
          console.warn("openSelectedExampleFromList failed:", err);
        }
      },
      true
    ); // useCapture=true hilft zusätzlich gegen Bubbling-Handler
  })();


  // Optional: Beim Gerätewechsel, falls Modal offen, Liste neu aufbauen
  $("#device-select")?.addEventListener("change", async () => {
    // ➕ Layout bei Calliope erzwingen
    const dev = document.getElementById("device-select")?.value;
    if (dev === "c12" || dev === "c3") {
      setLayout("output-files"); // „Text/Dateien“
    }

    // (bestehende Logik für Examples-Modal)
    const modalEl = $("#examplesModal");
    const isOpen = modalEl?.classList.contains("show");
    if (!isOpen) return;
    await loadExamplesFromJson("data/examples.json");
    showExamples();
  });

  function showLicenses() {
    const el = document.getElementById("licensesModal");
    if (el && window.bootstrap) {
      bootstrap.Modal.getOrCreateInstance(el).show();
    } else {
      console.error("licensesModal nicht gefunden oder bootstrap fehlt.");
    }
  }

  function showImpressum() {
    const el = document.getElementById("impressumModal");
    if (el && window.bootstrap) {
      bootstrap.Modal.getOrCreateInstance(el).show();
    } else {
      console.error("impressumModal nicht gefunden oder bootstrap fehlt.");
    }
  }

  // ====== Resizer + Live-Pygame-Resize ========================================
  (function () {
    // kleine Helfer: sichere Aktualisierung von Canvas + pygame.set_mode
    async function applyCanvasAndPygameSize(w, h) {
      const c = document.getElementById("canvas");
      if (!c) return;
      if (window.__canvasResizeLocked) return;

      // Pygame-Titlebar (Caption + X) sitzt oberhalb des Canvas im pygame-frame.
      // Daher muss die Höhe abgezogen werden, sonst ist die Zeichenfläche zu groß.
      const frame = document.getElementById("pygame-frame");
      const titlebar = document.getElementById("pygame-titlebar");
      const titleH =
        (frame && frame.style.display !== "none")
          ? Math.max(0, Math.round(titlebar?.getBoundingClientRect?.().height || 0))
          : 0;

      const h2 = Math.max(1, Math.floor((h || 0) - titleH));
      sizeCanvasForSDL(c, w, h2);
    }

    window.applyCanvasAndPygameSize = applyCanvasAndPygameSize;
  })();

  // ---------- Vertikaler Resizer (#resizer) ----------
  (function () {
    const container = document.getElementById("workarea"); // gesamter flex-Container
    const left = document.getElementById("left"); // linke Spalte (Editor)
    const resizer = document.getElementById("resizer"); // senkrechter Griff
    if (!container || !left || !resizer) return;

    let dragging = false;
    let startX = 0;

    function startDrag(x) {
      dragging = true;
      startX = x;
      document.body.classList.add("dragging");
      document.body.style.cursor = "col-resize";
      resizer.style.pointerEvents = "auto";
    }

    function onMove(x) {
      if (!dragging) return;
      if (window.__canvasResizeLocked) return;
      const rect = container.getBoundingClientRect();
      const gripW = resizer.getBoundingClientRect().width || 8;
      const minLeft = 200;
      const maxLeft = rect.width - gripW - 260;
      const newLeft = Math.max(minLeft, Math.min(maxLeft, x - rect.left));
      left.style.flex = `0 0 ${newLeft}px`;
      resizer.style.flex = `0 0 ${gripW}px`;
      window.editor?.layout?.();
    }

    function endDrag() {
      if (!dragging) return;
      dragging = false;
      document.body.classList.remove("dragging");
      document.body.style.cursor = "";
      resizer.style.pointerEvents = "";
      document.removeEventListener("touchmove", onTouchMove, { passive: false });
      document.removeEventListener("touchend", endDrag, { passive: true });
      document.removeEventListener("touchcancel", endDrag, { passive: true });
      setTimeout(() => window.editor?.layout?.(), 50);
    }

    function onTouchMove(e) {
      if (!dragging) return;
      e.preventDefault();
      onMove(e.touches[0].clientX);
    }

    // Maus
    resizer.addEventListener(
      "mousedown",
      (e) => {
        e.preventDefault();
        startDrag(e.clientX);
      },
      { passive: false }
    );
    window.addEventListener("mousemove", (e) => onMove(e.clientX), {
      passive: true,
    });
    window.addEventListener("mouseup", endDrag, { passive: true });

    resizer.addEventListener(
      "touchstart",
      (e) => {
        e.preventDefault();
        startDrag(e.touches[0].clientX);
        document.addEventListener("touchmove", onTouchMove, { passive: false });
        document.addEventListener("touchend", endDrag, { passive: true });
        document.addEventListener("touchcancel", endDrag, { passive: true });
      },
      { passive: false }
    );


    window.addEventListener("touchend", endDrag, { passive: true });
    window.addEventListener("touchcancel", endDrag, { passive: true });
  })();

  // ---------- Horizontaler Resizer (#resizer-h) ----------
  (function () {
    const container = document.getElementById("right"); // rechte Spalte (Canvas/Output)
    const canvasWrap = document.getElementById("canvas-wrap");
    const resizerH = document.getElementById("resizer-h"); // waagrechter Griff
    if (!container || !canvasWrap || !resizerH) return;

    let dragging = false;
    let startY = 0;
    let startH = 0;

    function startDrag(y) {
      dragging = true;
      startY = y;
      startH = canvasWrap.getBoundingClientRect().height;
      document.body.classList.add("dragging");
      document.body.style.cursor = "row-resize";
      resizerH.style.pointerEvents = "auto";
    }

    function onMove(y) {
      if (!dragging) return;
      if (window.__canvasResizeLocked) return;
      const rect = container.getBoundingClientRect();
      const dy = y - startY;
      const minTop = 120; // Mindesthöhe für den Wrap
      const maxTop = rect.height - 120; // Platz für Output unten
      const newH = Math.max(minTop, Math.min(maxTop, Math.round(startH + dy)));

      // Canvas-Wrap-Höhe via Flex festsetzen
      canvasWrap.style.flex = `0 0 ${newH}px`;

      // Jetzt Breite messen und Canvas/pygame live mitskalieren (1:1)
      const w = Math.max(
        1,
        Math.round(canvasWrap.getBoundingClientRect().width)
      );
      applyCanvasAndPygameSize(w, newH);
    }

    function endDrag() {
      if (!dragging) return;
      dragging = false;
      document.body.classList.remove("dragging");
      document.body.style.cursor = "";
      resizerH.style.pointerEvents = "";

      // ggf. nachlaufende Korrektur
      setTimeout(() => {
        const w = Math.max(
          1,
          Math.round(canvasWrap.getBoundingClientRect().width)
        );
        const h = Math.max(
          1,
          Math.round(canvasWrap.getBoundingClientRect().height)
        );
        applyCanvasAndPygameSize(w, h);
      }, 50);
    }

    // Maus
    resizerH.addEventListener(
      "mousedown",
      (e) => {
        e.preventDefault();
        startDrag(e.clientY);
      },
      { passive: false }
    );
    window.addEventListener("mousemove", (e) => onMove(e.clientY), {
      passive: false,
    });
    window.addEventListener("mouseup", endDrag, { passive: true });

    // Touch
    resizerH.addEventListener(
      "touchstart",
      (e) => {
        e.preventDefault();
        startDrag(e.touches[0].clientY);
      },
      { passive: false }
    );
    window.addEventListener(
      "touchmove",
      (e) => {
        if (!dragging) return;
        e.preventDefault();
        onMove(e.touches[0].clientY);
      },
      { passive: false }
    );
    window.addEventListener("touchend", endDrag, { passive: true });
    window.addEventListener("touchcancel", endDrag, { passive: true });
  })();

  // ---------- ResizeObserver auf #canvas-wrap (alle Layout-Änderungen) ----------
  (function () {
    const wrap = document.getElementById("canvas-wrap");
    if (!wrap || !("ResizeObserver" in window)) return;

    let rafId = null;
    const ro = new ResizeObserver(() => {
      if (window.__canvasResizeLocked) return;
      // debounce via rAF: nur 1x pro Frame reagieren
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const r = wrap.getBoundingClientRect();
        const W = Math.max(1, Math.round(r.width));
        const H = Math.max(1, Math.round(r.height));
        applyCanvasAndPygameSize(W, H);
      });
    });
    ro.observe(wrap);
  })();

  // --- global sichtbar machen ---
  window.bootPyodide = bootPyodide;
  window.runUserCode = runUserCode;


  // (damit Konsole/Buttons es finden)


  const TITLES = {
    SyntaxError: "Syntaxfehler", IndentationError: "Einrückungsfehler", NameError: "Name nicht definiert",
    TypeError: "Typfehler", ValueError: "Ungültiger Wert", IndexError: "Index außerhalb des Bereichs",
    KeyError: "Unbekannter Schlüssel", ZeroDivisionError: "Division durch 0", ModuleNotFoundError: "Modul nicht gefunden",
    ImportError: "Import-Fehler", AttributeError: "Attribut/Funktion nicht vorhanden", RuntimeError: "Laufzeitfehler"
  };
  const HINTS = {
    SyntaxError: ["Fehlt ein Doppelpunkt <code>:</code>?", "Sind Klammern/Anführungszeichen korrekt geschlossen?"],
    IndentationError: ["Blöcke müssen eingerückt sein.", "Keine Tabs mit Leerzeichen mischen."],
    NameError: ["Schreibweise prüfen.", "Variable/Funktion vorher definieren oder importieren."],
    TypeError: ["Passen die Datentypen zusammen (z. B. Zahl + Text)?"],
    ValueError: ["Der Wert passt nicht zur Funktion."],
    IndexError: ["Greifst du außerhalb der Listenlänge zu?"],
    KeyError: ["Gibt es den Schlüssel in diesem Wörterbuch wirklich?"],
    ZeroDivisionError: ["Teilst du durch 0? Prüfe den Nenner vorher."],
    ModuleNotFoundError: ["Schreibweise des Modulnamens prüfen.", "Ist das Paket verfügbar?"],
    ImportError: ["Pfad/Datei vorhanden? Modulname korrekt?"],
    AttributeError: ["Hat dieses Objekt die aufgerufene Funktion?"]
  };
  function _esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function _parseTrace(tb) {
    const i = { type: "Fehler", msg: "", file: "", line: null, col: null }; if (!tb) return i;
    const t = String(tb), L = t.trim().split(/\r?\n/); const last = (L.slice().reverse().find(l => l.trim()) || "").trim();
    const m = last.match(/^([A-Za-z_]\w*):\s*([\s\S]*)$/); if (m) { i.type = m[1]; i.msg = m[2].trim(); } else i.msg = last;
    const rx = /^\s*File\s+"([^"]+)",\s+line\s+(\d+)/gm; const f = [...t.matchAll(rx)];
    if (f.length) {
      let g = null; for (let j = f.length - 1; j >= 0; j--) { const n = f[j][1]; if (n.includes("<exec>") || n.includes("<stdin>")) { g = f[j]; break; } }
      if (!g) g = f[f.length - 1]; i.file = g[1]; i.line = parseInt(g[2], 10);
    }
    const ci = L.findIndex(l => /^\s*\^+\s*$/.test(l)); if (ci > 0) { const p = L[ci].indexOf("^"); if (p >= 0) i.col = p + 1; } return i;
  }
  function _makeSnippet(code, line, col) {
    if (!code || !Number.isInteger(line) || line < 1) return ""; const s = String(code).split(/\r?\n/);
    const idx = Math.min(s.length - 1, line - 1); const pad = String(s.length).length;
    const ln = String(idx + 1).padStart(pad, " "); const row = _esc(s[idx] || "");
    let h = `<div class="fe-code"><div class="fe-row fe-err"><span class="fe-ln">${ln}</span> ${row}</div>`;
    if (col) {
      const left = (s[idx]?.slice(0, col - 1) || "").replace(/\t/g, "    "); const sp = "&nbsp;".repeat(pad + 1 + left.length);
      h += `<div class="fe-row fe-care"><span class="fe-ln"></span> ${sp}^</div>`;
    } return h + "</div>";
  }
  window.formatFriendlyPythonError = function (tb, { userCode = "", prefixLines = 0, filenameLabel = "dein Programm" } = {}) {
    const info = _parseTrace(tb || "");
    const inPrefix = Number.isInteger(info.line) && prefixLines > 0 && info.line <= prefixLines;
    const uLine = !inPrefix && Number.isInteger(info.line) ? Math.max(1, info.line - prefixLines) : null;
    const t = info.type || "", msg = info.msg || ""; let cust = { title: null, what: null, hints: [] };
    let dispLine = uLine;
    try {
      if (!inPrefix && dispLine && /SyntaxError/.test(t) && userCode) {
        const src = String(userCode).split(/\r?\n/);
        const i = Math.min(src.length - 1, dispLine - 1);
        // Fall: Caret steht auf einer Leerzeile – nächste Zeile ist die sinnvolle Anzeige
        if ((src[i] || "").trim() === "" && (src[i + 1] || "").trim() !== "") {
          // Optional: nur beim klassischen ":"-Fall schieben:
          // if (/expected ':'/i.test(msg)) dispLine = dispLine + 1;
          // Allgemeiner (robust für andere SyntaxError-Leerzeilen):
          dispLine = dispLine + 1;
        }
      }
    } catch { }
    if (/SyntaxError/.test(t) && /invalid syntax/i.test(msg)) {
      const l = (userCode.split(/\r?\n/)[(uLine || 1) - 1] || "");
      if (/\bfrom\s+[A-Za-z_]\w*\s+import\s*$/.test(l)) {
        cust.title = "Unvollständiger Import";
        cust.what = "Nach „from … import“ fehlt ein Name."; cust.hints.push("z. B. <code>from jturtle import *</code>");
      }
    }
    if (/NameError|AttributeError/.test(t)) {
      const m = msg.match(/['"]([^'"]+)['"]/); if (m) {
        const wrong = m[1], sug = ["print", "show", "plt", "pygame", "range", "input", "matplotlib", "forward"]
          .find(w => Math.abs(w.length - wrong.length) <= 2 && (w[0] === wrong[0] || w.includes(wrong[0])));
        if (sug) cust.hints.push(`Meintest du vielleicht: <code>${sug}</code>?`);
      }
    }
    const title = cust.title || TITLES[t] || "Fehler", what = cust.what || _esc(msg);
    const hints = (cust.hints || []).concat(HINTS[t] || []).slice(0, 2);
    const where = inPrefix ? `Im <b>internem Startcode</b>.` : (dispLine ? `In <b>${_esc(filenameLabel)}</b> auf Zeile <b>${dispLine}</b>${info.col ? `, Spalte <b>${info.col}</b>` : ""}` : `In <b>${_esc(filenameLabel)}</b>.`);
    const snip = !inPrefix && dispLine ? _makeSnippet(userCode, dispLine, info.col) : "";
    return `<div class="fe-card"><div class="fe-head">❌ <b>${_esc(title)}</b></div><div class="fe-what">${what}</div>
<div class="fe-where">${where}</div>${snip}${hints.length ? `<ul class="fe-tips">${hints.map(x => `<li>${x}</li>`).join("")}</ul>` : ""}
<details class="fe-details"><summary>Original-Fehler</summary><pre class="fe-raw">${_esc(tb || "")}</pre></details></div>
<style>
.fe-card{border:1px solid #f1c1c1;background:#fff6f6;border-radius:8px;padding:8px 10px;font:12px/1.25 system-ui;-webkit-font-smoothing:antialiased}
.fe-head{font-weight:700;margin-bottom:4px}.fe-what{margin:2px 0 4px}.fe-where{color:#a33;margin-bottom:4px}
.fe-code{font-family:monospace;background:#fff;border:1px solid #eee;border-radius:6px}
.fe-row{white-space:pre;padding:1px 6px}.fe-row.fe-err{background:#fff1f1}.fe-ln{color:#999;margin-right:6px}
.fe-tips{margin:2px 0 0 14px;padding:0}.fe-tips li{margin:0}.fe-details{margin-top:4px}.fe-raw{white-space:pre-wrap;font-size:11px}
</style>`;
  };
  window.reportPythonError = function (raw, { userCode, prefixLines } = {}) {
    const out = document.getElementById("output"); if (!out) return;
    const code = typeof userCode === "string" ? userCode : (window.__lastUserCodeRaw || window.editor?.getValue?.() || "");
    const pref = Number.isInteger(prefixLines) ? prefixLines : (window.__lastPrefixOffset || 0);
    try {
      const html = window.formatFriendlyPythonError(String(raw || ""), { userCode: code, prefixLines: pref });
      out.innerHTML = html; out.scrollTop = 0;
    }
    catch (e) {
      out.innerHTML = `<pre style="white-space:pre-wrap;color:#b00020;margin:0">${_esc(String(raw || ""))}</pre>`;
      console.error("[reportPythonError failed]", e);
    }
  };
  // --- Ende ---

  // --- Ende Friendly Python Errors ---

})();
