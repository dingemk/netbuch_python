// ./vendor/nrf-intel-hex/esm/shim.js
const g = globalThis;
const MemoryMap =
  g.nrfintelhex?.MemoryMap ||        // üblich bei intel-hex.browser.js
  g.nrfIntelHex?.MemoryMap ||        // falls anderer Case
  g.MemoryMap ||                     // falls direkt global exportiert
  null;

if (!MemoryMap) {
  throw new Error(
    "[nrf-intel-hex shim] Global MemoryMap fehlt. " +
    "Stelle sicher, dass VOR dem Import dieser Datei folgendes geladen wurde:\n" +
    "  1) <script>window.nrfintelhex = window.nrfintelhex || {};</script>\n" +
    "  2) <script src=\"./vendor/nrf-intel-hex/esm/intel-hex.browser.js\"></script>"
  );
}

export default MemoryMap;
export { MemoryMap };