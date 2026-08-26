// lib/py-client.js
// Kleiner Client, der den Worker kapselt (Event-Emitter + init/run-API).

export class PyClient {
  constructor(workerUrl) {
    if (!workerUrl) throw new Error('PyClient: workerUrl fehlt');
    this.worker = new Worker(workerUrl); // klassischer Worker (kein type: 'module')
    this.listeners = { stdout: [], stderr: [], error: [], warn: [], pkg: [], 'init:done': [], 'run:done': [], ready: [] };

    this.ready = new Promise((resolve) => {
      const onReady = (m) => {
        const d = m.data || {};
        if (d.type === 'ready') {
          this.worker.removeEventListener('message', onReady);
          resolve(true);
          this._emit('ready', d);
        }
      };
      this.worker.addEventListener('message', onReady);
    });

    this.worker.addEventListener('message', (ev) => {
      const d = ev.data || {};
      if (d.type) this._emit(d.type, d);
    });
    this.worker.addEventListener('error', (e) => this._emit('error', { error: e.message || String(e) }));
  }

  on(type, cb) {
    (this.listeners[type] ||= []).push(cb);
    return () => {
      this.listeners[type] = (this.listeners[type] || []).filter(fn => fn !== cb);
    };
  }
  _emit(type, payload) {
    (this.listeners[type] || []).forEach(fn => {
      try { fn(payload); } catch {}
    });
  }

  async init(pkgs = []) {
    await this.ready;
    this.worker.postMessage({ type: 'init', pkgs });
  }
  async run(code) {
    await this.ready;
    this.worker.postMessage({ type: 'run', code });
  }
  interrupt() {
    this.worker.postMessage({ type: 'interrupt' });
  }
  reset() {
    this.worker.postMessage({ type: 'reset' });
  }
}

// Zusätzlich als Global bereitstellen (für Fallbacks / Nicht-ESM-Nutzung)
if (typeof window !== 'undefined') {
  window.PyClient = PyClient;
}

export default PyClient;