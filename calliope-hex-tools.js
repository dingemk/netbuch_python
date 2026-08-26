/**
 * Minimal-Tooling für Calliope-HEX:
 *  - appendScriptV1(): fügt main.py nach 0x0003E000 ein (Classic/Calliope 1.x/2.0 und V3).
  *  - packMainPyAuto(): nimmt den Python-Code (aus getBundledPy) und hängt ihn
 *    als "Appended Script" an; optional werden extraFiles (.py-Uploads) als
 *    Inline-Module # --- auto-inlined modules --- vorangestellt.
 *
 * Wir verlassen uns vollständig darauf, dass die IDE (scripts.js) bereits
 * alle Upload-Module inline in den Python-Text einbaut (# --- auto-inlined modules ---).
 * Dieses Modul kümmert sich NUR darum, diesen Text als main.py ins HEX zu packen.
 */

///////////////////////////
// Intel HEX Hilfsfunktionen
///////////////////////////
function toHex2(n){ return n.toString(16).toUpperCase().padStart(2,'0'); }
function toHex4(n){ return n.toString(16).toUpperCase().padStart(4,'0'); }

function checksumByteSum(bytes){
  let sum = 0;
  for (const b of bytes) sum = (sum + (b & 0xFF)) & 0xFF;
  // Zweierkomplement
  return ((~sum + 1) & 0xFF);
}

function makeRecord(address16, recordType, dataBytes){
  const len = dataBytes.length;
  const hi = (address16 >> 8) & 0xFF, lo = address16 & 0xFF;
  const bytes = [len, hi, lo, recordType, ...dataBytes];
  const csum = checksumByteSum(bytes);
  const dataHex = dataBytes.map(toHex2).join('');
  return `:${toHex2(len)}${toHex4(address16)}${toHex2(recordType)}${dataHex}${toHex2(csum)}`;
}

function stripEOF(hexStr){
  return hexStr
    .replace(/\r/g,'')
    .split('\n')
    .filter(l => l.trim() && !/^:00000001FF$/i.test(l.trim()))
    .join('\n');
}

///////////////////////////
// 1) Classic: "Appended script" bei 0x0003E000 (V1-kompatibel)
///////////////////////////
function appendScriptV1(baseHex, pythonText){
  // MicroPython V1 "Appended script" Format:
  // 0x0003E000: 'M' 'P' (0x4D 0x50)
  // 0x0003E002: 2 Bytes Länge (little endian, nur der Script-Teil)
  // 0x0003E004: Script als UTF-8 Bytes
  const utf8 = new TextEncoder().encode(String(pythonText || ''));
  if (utf8.length > 8*1024 - 4) {
    throw new Error("Script zu groß für den 8KB Appended-Script-Bereich (Classic).");
  }
  const header = new Uint8Array(4);
  header[0] = 0x4D; // 'M'
  header[1] = 0x50; // 'P'
  header[2] = utf8.length & 0xFF;
  header[3] = (utf8.length >> 8) & 0xFF;

  // Datenblock ab 0x0003E000:
  const startAddr = 0x0003E000;
  const block = new Uint8Array(header.length + utf8.length);
  block.set(header, 0);
  block.set(utf8, 4);

  // Intel-HEX Records erzeugen
  const lines = [];
  const ELA = 0x04;
  const DATA = 0x00;
  const EOF  = ":00000001FF";

  const base = stripEOF(baseHex);
  lines.push(base);

  // Setze Upper 16 Bits auf 0x0003
  const upper = 0x0003;
  const elaData = [ (upper >> 8) & 0xFF, (upper & 0xFF) ];
  lines.push(makeRecord(0x0000, ELA, elaData));

  // Schreibe Daten in 16-Byte Zeilen ab 0xE000 (lower 16 bits)
  const lowBase = startAddr & 0xFFFF;
  const chunkSize = 16;
  for (let off = 0; off < block.length; off += chunkSize){
    const slice = block.slice(off, off + chunkSize);
    lines.push(makeRecord(lowBase + off, DATA, Array.from(slice)));
  }

  // EOF
  lines.push(EOF);
  return lines.join('\n') + '\n';
}

///////////////////////////
// 2) Auto: main.py (Bundler liefert schon fertigen Code)
///////////////////////////
async function packMainPyAuto(baseHex, pythonText, opts = {}) {
  // 1) Haupt-Code bereinigen (BOM weg)
  const mainSrc = String(pythonText || '').replace(/^\uFEFF/, '');

  // 2) Keine eigenen Inline-Module mehr bauen!
  //    Der Bundler in scripts.js hat bereits alles (servo, test, usw.)
  //    in den Python-Text eingebaut.

  // 3) Wie bisher: als Appended Script anhängen
  return appendScriptV1(baseHex, mainSrc);
}

// Export nach außen
window.calliopeHexTools = { appendScriptV1, packMainPyAuto };