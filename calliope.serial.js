// =============================================================
// Calliope Serial API (für Calliope mini 1/2 und 3) - Non-module
// =============================================================
(function () {
  if (window.CalliopeSerial) {
    console.log("[CalliopeSerial] bereits vorhanden");
    return;
  }
  console.log("[CalliopeSerial] geladen (non-module)");

  const S = window.__CalliopeSerialState ||= {
    port: null,
    reader: null,
    writer: null,
    enc: null,
    dec: null,
    readPipe: null,       // (Legacy) wird nicht genutzt, bleibt für Kompatibilität
    listeners: new Set(),
    lineBuf: "",
    outEl: null,
    editor: null,
    lastInfo: null,       // { usbVendorId, usbProductId }
    opening: false,       // schützt vor parallelen open()-Aufrufen
    closingPromise: null, // garantiertes Close vor neuem Open
    expectResetUntil: 0,  // Zeitfenster für Auto-Reconnect nach Flash
    promptSeen: false,    // erst nach >>> spiegeln
    mirrorToOut: true,    // optionaler Schalter
  };

  // ---------- Utils ----------
  function isOpen() {
    try {
      return !!(S.port && S.port.readable && S.port.writable);
    } catch {
      return false;
    }
  }
  function onLine(fn) { if (typeof fn === "function") S.listeners.add(fn); }
  function offLine(fn) { S.listeners.delete(fn); }
  function expectReset(ms = 8000) { S.expectResetUntil = performance.now() + ms; }

  // ---------- Öffnen ----------
  async function openSerial(opts = {}) {
    const {
      port = null,
      forcePicker = false,
      mode = "monitor",
      baudRate = 115200,
    } = opts;

    if (S.opening) return;
    if (isOpen()) return;
    S.opening = true;
    // Bereits verbunden? Dann sofort raus – kein Picker, kein erneutes Öffnen
    if (S.writer && S.port?.readable) {
      console.log('[CalliopeSerial] bereits verbunden');
      return true;
    }
    try {
      // Falls gerade ein Close läuft, erst sauber warten
      if (S.closingPromise) {
        try { await S.closingPromise; } catch { }
      }


      // 0) Reconnect-Fenster: still ohne Dialog versuchen (nach Flash)
      if (!port && forcePicker === false && S.expectResetUntil && performance.now() < S.expectResetUntil) {
        const end = performance.now() + 2000; // bis zu 2s leise warten
        while (performance.now() < end && !S.port) {
          const granted = await navigator.serial.getPorts();
          if (granted.length) { S.port = granted[0]; break; }
          await new Promise(r => setTimeout(r, 150));
        }
        if (!S.port) {
          // Kein granted Port und kein Picker erlaubt -> ruhig abbrechen
          return false;
        }
      }

      // 1) expliziter Port?
      if (port) {
        S.port = port;
      }
      // 2) Picker explizit gewünscht?
      else if (forcePicker === true) {
        S.port = S.port = await navigator.serial.requestPort();
      }
      // 3) Kein Picker erlaubt: nur bereits freigegebene Ports nehmen
      else {
        const granted = await navigator.serial.getPorts();
        if (granted.length) {
          S.port = granted[0];
        } else {
          // Kein granted Port -> leise abbrechen, kein Dialog
          return false;
        }
      }

      await S.port.open({ baudRate });
      
      S.enc = new TextEncoder();
      S.dec = new TextDecoder();
      S.writer = S.port.writable.getWriter();
      S.lastInfo = S.port.getInfo?.() || {};

      // Leseloop starten
      S.promptSeen = false;
      startReadLoop();

      // REPL-Modus: ggf. Ctrl-C/-B senden
      if (mode === "repl") {
        await write("\x03"); // Ctrl-C
        await write("\x02"); // Ctrl-B (raw off)
      }

      console.log("[CalliopeSerial] verbunden:", S.lastInfo);
    } catch (e) {
      console.error("[CalliopeSerial] openSerial Fehler:", e);
      throw e;
    } finally {
      S.opening = false;
    }
  }

  // ---------- Lesen ----------
  async function startReadLoop() {
  if (!S.port?.readable) return;
  S.reader = S.port.readable.getReader();
  try {
    while (true) {
      const { value, done } = await S.reader.read();
      if (done) break;
      if (value?.length) {
        const txt = S.dec.decode(value, { stream: true });

        if (S.expectResetUntil && performance.now() < S.expectResetUntil) {
          if (/KeyboardInterrupt|MicroPython|^>>> ?$/m.test(txt)) continue;
        }

        // ---- Puffer & Prompt-Erkennung ----
        S.lineBuf += txt;
        if (!S.promptSeen && S.lineBuf.indexOf(">>>") !== -1) {
          S.promptSeen = true;
          // (Optional) Banner bis >>> aus dem Puffer entfernen:
          S.lineBuf = S.lineBuf.replace(/MicroPython[\s\S]*?>>> ?/i, "");
        }

        // Listener zuerst (die können selbst puffern)
        for (const fn of S.listeners) {
          try { fn(txt); } catch {}
        }

        // ---- Spiegeln in den DOM nur wenn erlaubt & Prompt gesehen
        if (S.outEl && S.mirrorToOut && S.promptSeen && (!S.listeners || S.listeners.size === 0)) {
          const html = txt.replace(/\r?\n/g, "<br>");
          S.outEl.insertAdjacentHTML("beforeend", html);
          console.log("startreadloop");
          S.outEl.scrollTop = S.outEl.scrollHeight;
        }
      }
    }
  } catch (e) {
    if (e?.name !== "AbortError") console.warn("[CalliopeSerial] readLoop:", e);
  } finally {
    try { S.reader.releaseLock(); } catch {}
    S.reader = null;
  }
}

  // ---------- Schreiben ----------
  async function write(data) {
    if (!isOpen()) throw new Error("Serielle Verbindung nicht offen");
    const u8 = typeof data === "string" ? S.enc.encode(data) : data;
    await S.writer.write(u8);
  }

  // ---------- Schließen ----------
  async function closeSerial() {
    if (!S.port && !S.reader && !S.writer) return;
    if (S.closingPromise) return S.closingPromise;

    S.closingPromise = (async () => {
      try {
        console.log("[CalliopeSerial] schließe Port …");
        if (S.reader) {
          try { await S.reader.cancel(); } catch { }
          try { S.reader.releaseLock(); } catch { }
          S.reader = null;
        }
        if (S.writer) {
          try { S.writer.releaseLock(); } catch { }
          S.writer = null;
        }
        if (S.port) {
          try { await S.port.close(); } catch { }
        }
        console.log("[CalliopeSerial] Port geschlossen");
      } finally {
        S.port = null;
        S.closingPromise = null;
      }
    })();

    return S.closingPromise;
  }

  // ---------- Stillen Reconnect probieren (ohne Picker) ----------
  async function tryOpenGranted() {
    if (isOpen()) return true;
    const ports = await navigator.serial.getPorts();
    if (!ports.length) return false;
    try {
      await openSerial({ port: ports[0], forcePicker: false, mode: "monitor" });
      return true;
    } catch (e) {
      console.warn("[CalliopeSerial] tryOpenGranted fehlgeschlagen:", e);
      return false;
    }
  }

  // ---------- Ausgabe binden ----------
  function bindOutput(el) {
    S.outEl = el || null;
  }

  // ---------- Auto-Cleanup bei Disconnect ----------
  if (navigator.serial) {
    navigator.serial.addEventListener("disconnect", () => {
      console.warn("[CalliopeSerial] Gerät getrennt");
      closeSerial();
    });
  }

  // ---------- API global machen ----------
  window.CalliopeSerial = {
    isOpen,
    onLine,
    offLine,
    expectReset,
    openSerial,
    closeSerial,
    write,
    tryOpenGranted,
    bindOutput,
  };

  
  console.log("[CalliopeSerial] bereit (global)");
})();