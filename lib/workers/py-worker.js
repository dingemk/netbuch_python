// Classic Worker
importScripts("https://cdn.jsdelivr.net/pyodide/v0.29.0/full/pyodide.js");
console.log("[WK] Worker gestartet! self =", typeof self, "importScripts" in self ? "Classic" : "Module");
const postOK = (id, result=null)=>postMessage({id, ok:true, result});
const postERR = (id, err)=>postMessage({id, ok:false, error:{message:String(err?.message||err), stack:String(err?.stack||"")}});

let pyodide = null;

onmessage = async (e) => {
  const m = e.data || {};
  try {
    if (m.type === "init") {
      pyodide = await loadPyodide({ 
        indexURL: "https://cdn.jsdelivr.net/pyodide/v0.29.0/full/",
        // Übergang: altes Verhalten beibehalten
        toJsLiteralMap: true,      // 0.29: dict -> Map-ähnlich wie früher
        convertNullToNone: true    // 0.28: JS null wieder als None
       });
      pyodide.setStdout({ batched: (t)=> t && postMessage({event:"stdout", text:String(t)}) });
      pyodide.setStderr({ batched: (t)=> t && postMessage({event:"stderr", text:String(t)}) });
      return postOK(m.id, "ready");
    }
    if (m.type === "loadPackages") {
      const pkgs = Array.isArray(m.packages)?m.packages:[];
      if (pkgs.length) await pyodide.loadPackage(pkgs);
      return postOK(m.id, "packages loaded");
    }
    if (m.type === "run") {
      const result = await pyodide.runPythonAsync(String(m.code||""));
      return postOK(m.id, result);
    }
    if (m.type === "interrupt") return postOK(m.id, "noop");
    if (m.type === "reset") {
      pyodide = await loadPyodide({ indexURL: "https://cdn.jsdelivr.net/pyodide/v0.29.0/full/" });
      return postOK(m.id, "reset");
    }
    return postERR(m.id, new Error("unknown type: "+m.type));
  } catch (err) {
    return postERR(m.id, err);
  }
};