// turtle-blocks.js — Browser Turtle (Canvas) with Python-like API + Pyodide export

// ------- Config -------
const TURTLE_SIZE = 20; // visible turtle icon size
const DEFAULT_LINE_WIDTH = 1; // default pen width
// vorher (typisch)
// nachher (für die Layer-Umschaltung)
const CANDIDATE_CANVAS_IDS = ["turtleCanvas"];
// ------- State -------
let canvas = document.getElementById("turtleCanvas"),
  ctx,
  cssW = 0,
  cssH = 0,
  dpr = 1;
let x = 0,
  y = 0; // turtle coords (centered coordinate system)
let xL = 0, yL = 0;
let headingL = 0;
let heading = 0; // Python turtle: 0 = east, 90 = north (CCW positive)
let penDown = true;
let turtleVisible = true;
let paths = []; // list of path segments
let current; // current segment
let strokeColor = "#000000";
let fillColor = "#000000";
let filling = false;
let turtleImg = null;
let activeFill = null;
let fontSize = 16; // default font size for text
let _turtleInited = false;
let bgColor = "#ffffff";   // Hintergrundfarbe
let bgImg = null;          // Image-Objekt
let bgImgSrc = "";         // zuletzt gesetzte Quelle
let turtlespeed = 3;
// ------- Draw pacing (Slow/Fast) -------
let __fastDraw = false;              // wird true, sobald hideturtle() aufgerufen wurde
let __delayMs = 80;          // ~1 Frame Pause (16ms). Auf 0 setzen = noch schneller.

let __q = [];                        // Operationen-Schlange
let __running = false;

function __sleep(ms) {
  return new Promise(res => setTimeout(res, ms));
}

async function __drainQueue() {
  if (__running) return;
  __running = true;

  try {
    while (__q.length) {
      const fn = __q.shift();
      try { fn(); } catch {}

      // ✅ HIER die Pause – sonst nirgends
      if (!__fastDraw && __delayMs > 0) {
        await new Promise(r => setTimeout(r, __delayMs));
      }
    }
  } finally {
    __running = false;
  }
}

function __enqueue(fn) {
  __q.push(fn);

  __drainQueue();
}

// Standardpause zwischen Schritten
function speed(n = 3) {
  n = Number(n);
  // turtle: 1 langsam ... 10 schnell, 0 = "fastest"
  if (!isFinite(n)) n = 3;

  if (n <= 0) __delayMs = 0;
  else __delayMs = Math.max(0, Math.round(250 / n)); // z.B. n=1 -> 250ms, n=10 -> 25ms
}

// Ready helper (for async registration)
let _readyResolve;
const turtleReady = new Promise((res) => (_readyResolve = res));
// ------- Init -------
function pickCanvas() {
  for (const id of CANDIDATE_CANVAS_IDS) {
    const el = document.getElementById(id);
    if (el) return el;
  }
  return null;
}

function __flushInstant() {
  // alles was noch in der Queue liegt sofort ausführen
  while (__q.length) {
    const fn = __q.shift();
    try { fn(); } catch (e) { console.warn(e); }
  }
}

function setupCanvasResolution() {
  dpr = window.devicePixelRatio || 1;

  // Canvas kann display:none sein -> dann 0
  const r = canvas.getBoundingClientRect();
  let w = r.width;
  let h = r.height;

  if (!w || !h) {
    const wrap = document.getElementById("canvas-wrap");
    const rw = wrap?.getBoundingClientRect?.();
    w = rw?.width || 800;
    h = rw?.height || 400;
  }

  cssW = Math.max(1, Math.floor(w));
  cssH = Math.max(1, Math.floor(h));

  canvas.width = Math.floor(cssW * dpr);
  canvas.height = Math.floor(cssH * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function initTurtle(force = true) {
  if (_turtleInited && !force) return;
  __flushInstant();
  __running = false;
  canvas = pickCanvas();
  if (!canvas) return;
  ctx = canvas.getContext("2d");

  setupCanvasResolution();

  // 🔥 WICHTIG: Canvas vollständig leeren (CSS-Pixel!)
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // internen Zustand zurücksetzen
  paths = [];
  current = null;
  bgColor = "#ffffff";
  bgImg = null;
  bgImgSrc = "";
  x = 0;
  y = 0;
  headingL = 0; 
  heading = headingL;
  xL = 0;
  yL = 0;
     // Start: nach rechts
  penDown = true;
  turtleVisible = true;
  strokeColor = "#000";
  fillColor = "#000";
  filling = false;
  turtleVisible = true;   // ⭐⭐⭐ DAS FEHLTE
  __fastDraw = false;     // ⭐ wichtig nach hideturtle()

  // Turtle-Bild laden (einmalig)
  if (!turtleImg) {
    turtleImg = new Image();
    turtleImg.src = "turtle.png";
    turtleImg.onload = () => draw();
  }

  // 🚨 WICHTIG: neuen Startpfad anlegen
  newPath();

  _turtleInited = true;
  draw();

  if (_readyResolve) _readyResolve();
}

function ensureInit() {
  if (!_turtleInited) initTurtle(false);
  return _turtleInited && !!current;
}

window.addEventListener("load", () => initTurtle(false));

// ------- Geometry Helpers -------
function toCanvasX(xu) {
  return cssW / 2 + xu;
}
function toCanvasY(yu) {
  return cssH / 2 - yu;
}
function rad(deg) {
  return (deg * Math.PI) / 180;
}

// ------- Path Handling -------
function newPath() {
  current = {
    down: penDown,
    stroke: strokeColor,
    lineWidth: DEFAULT_LINE_WIDTH,
    fontsize: fontSize,
    fill: filling,
    fillstyle: fillColor,
    points: [], // {x, y, r} if r>0 -> dot/circle element
  };
  // start at current pen position
  current.points.push({ x: toCanvasX(x), y: toCanvasY(y), r: 0 });
  paths.push(current);
}

function commitStyleToNewPathSync() {
  const prevLW = current?.lineWidth ?? DEFAULT_LINE_WIDTH;
  const seg = {
    down: penDown,
    stroke: strokeColor,
    lineWidth: prevLW,
    fontsize: fontSize,
    fill: filling,
    fillstyle: fillColor,
    points: []
  };
  seg.points.push({ x: toCanvasX(x), y: toCanvasY(y), r: 0 });
  paths.push(seg);
  current = seg;
}

// ------- Drawing -------
function drawPaths() {
  for (const p of paths) {
    if (!p.points.length) continue;

    ctx.beginPath();

    for (let i = 0; i < p.points.length; i++) {
      const pt = p.points[i];

      // Text separat rendern (kein Teil des Canvas-Pfads)
      if (pt.text && pt.text !== "") {
        const family = p.fontfamily || "Arial";
        const style = p.fontstyle || "normal";
        ctx.font = `${style} ${p.fontsize}px ${family}`;
        ctx.fillStyle = p.fillstyle;
        ctx.textAlign = (pt.align === "center" || pt.align === "right") ? pt.align : "left";
        ctx.textBaseline = "bottom";
        ctx.fillText(pt.text, pt.x, pt.y);
        continue;
      }

      if (pt.r && pt.r > 0) {
        // Kreis/Punkt
        if (i === 0) ctx.moveTo(pt.x + pt.r, pt.y);
        ctx.arc(pt.x, pt.y, pt.r, 0, 2 * Math.PI);
      } else if (p.down) {
        // zeichnender Pfad
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      } else {
        // Stift oben → nur bewegen
        ctx.moveTo(pt.x, pt.y);
      }
    }

    // Styles setzen
    ctx.strokeStyle = p.stroke;
    ctx.lineWidth = p.lineWidth;

    // Nur Füll-Pfade schließen + füllen
    if (p.fill) {
      ctx.closePath();   // schließt Polygon, damit Füllen korrekt ist
      ctx.fillStyle = p.fillstyle;
      ctx.fill();
    }

    // Linien zeichnen (ohne closePath → keine Diagonal-Schlusslinie)
    if (p.down) {
      ctx.stroke();
    }
    // KEIN ctx.closePath() hier!
  }
}

function draw() {
  // Nur zeichnen, wenn Turtle initialisiert UND Canvas sichtbar ist
  if (!ensureInit()) return;
  if (!canvas || !ctx) return;

  // Wenn Canvas gerade unsichtbar ist (display:none), nichts tun
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  // Canvas ggf. neu skalieren (nach Layer-Switch / Resize)
  setupCanvasResolution();

  // Löschen in CSS-Pixeln (wichtig!)
  // statt clearRect: Hintergrund (Farbe + ggf. Bild) zeichnen
  drawBackground();

  // dann Linien + Turtle darüber
  drawPaths();
  drawTurtle();
}

function drawTurtle() {
  if (!turtleVisible || !turtleImg || !turtleImg.complete) return;
  ctx.save();
  // Note: canvas Y increases downward; our heading is mathematical (0° points east, +CCW)
  ctx.translate(toCanvasX(x), toCanvasY(y));
  ctx.rotate(rad(-heading));// negate to match screen coords
  ctx.drawImage(
    turtleImg,
    -TURTLE_SIZE / 2,
    -TURTLE_SIZE / 2,
    TURTLE_SIZE,
    TURTLE_SIZE
  );
  ctx.restore();
}

function drawBackground() {
  // Hintergrundfarbe
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);   // sicher in CSS-Pixeln zeichnen
  ctx.fillStyle = bgColor || "#ffffff";
  ctx.fillRect(0, 0, cssW, cssH);

  // Hintergrundbild (falls vorhanden & geladen)
  if (bgImg && bgImg.complete && bgImg.naturalWidth > 0) {
    ctx.drawImage(bgImg, 0, 0, cssW, cssH); // skaliert auf Canvas
  }
  ctx.restore();
}

function bgcolor(c) {
  if (!ensureInit()) return;
  __enqueue(() => {
    bgColor = String(c || "#ffffff");
    draw();
  });
}

// Python turtle: bgpic(filename) / bgpic("") entfernt Bild
function bgpic(filename = "") {
  if (!ensureInit()) return;

  const name = String(filename || "").trim();

  // Bild entfernen
  if (!name) {
    __enqueue(() => {
      bgImg = null;
      bgImgSrc = "";
      draw();
    });
    return;
  }

  __enqueue(() => {
    const FS = window.__mainPy?.FS || window.pyodide?.FS;
    if (!FS) {
      console.warn("[turtle] bgpic: Pyodide FS nicht verfügbar");
      return;
    }

    // 🔒 NUR FS – typische Pfade
    const candidates = [
      name,
      `/home/pyodide/${name}`,
      `/home/pyodide/files/${name}`,
      `/home/pyodide/uploads/${name}`,
    ];

    let data = null;
    let foundPath = null;

    for (const p of candidates) {
      try {
        data = FS.readFile(p);   // Uint8Array
        foundPath = p;
        break;
      } catch { /* weiter */ }
    }

    if (!data) {
      console.warn("[turtle] bgpic: Datei nicht im FS gefunden:", name);
      return;
    }

    // Blob → ObjectURL
    const blob = new Blob([data], { type: "image/*" });
    const url = URL.createObjectURL(blob);

    const img = new Image();
    img.onload = () => {
      // nur übernehmen, wenn nicht inzwischen ein anderes Bild gesetzt wurde
      bgImg = img;
      bgImgSrc = foundPath;
      draw();
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      console.warn("[turtle] bgpic: Bild konnte nicht geladen werden:", foundPath);
      URL.revokeObjectURL(url);
    };

    img.src = url;
  });
}


// Funktion zum Neuziechnen aller Pfade nach Canvas-Resize
function redrawAllPaths() {
  if (!canvas || !ctx) {
    console.log("Canvas oder Kontext nicht verfügbar");
    return;
  }

  console.log("Zeichne alle Pfade neu nach Canvas-Resize");
  console.log("Anzahl Pfade:", paths.length);

  // Canvas-Auflösung aktualisieren
  setupCanvasResolution();

  // Alle Pfade mit neuen Koordinaten neu zeichnen
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (paths.length > 0) {
    drawPaths();
    console.log("Pfade neu gezeichnet");
  } else {
    console.log("Keine Pfade zum Zeichnen vorhanden");
  }

  drawTurtle();
}

// Globale Funktion für externe Aufrufe
window.turtleRedraw = redrawAllPaths;

// Funktion zum Löschen aller Pfade
function clearAllPaths() {
  if (!canvas || !ctx) {
    console.log("Canvas oder Kontext nicht verfügbar");
    return;
  }

  console.log("Lösche alle Pfade...");

  // Alle Pfade löschen
  paths = [];
  current = null;

  // Turtle zur Mitte zurücksetzen
  x = 0;
  y = 0;
  heading = 0;

  // Canvas leeren
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Neuen Pfad starten
  newPath();

  // Turtle zeichnen
  drawTurtle();

  console.log("Alle Pfade gelöscht, Turtle zur Mitte zurückgesetzt");
}

// Globale Funktion zum Löschen aller Pfade
window.clearAllPaths = clearAllPaths;

// ------- API (English, near Python turtle) -------
function forward(dist) {
  if (!ensureInit()) return;

  const a = rad(90 - headingL);
  const nx = xL + Number(dist) * Math.cos(a);
  const ny = yL + Number(dist) * Math.sin(a);

  // ✅ Logik sofort (damit xcor/ycor direkt stimmt)
  xL = nx;
  yL = ny;

  // 🎬 Render/Zeichnen in Queue (Animation)
  __enqueue(() => {
    x = nx;
    y = ny;
    current.points.push({ x: toCanvasX(nx), y: toCanvasY(ny), r: 0 });
    if (filling && activeFill) {
      activeFill.points.push({ x: toCanvasX(nx), y: toCanvasY(ny), r: 0 });
    }

    draw();
  });
}

function backward(dist) {
  forward(-dist);
}

const normDeg = (a) => ((a % 360) + 360) % 360;

function right(angle) {
  if (!ensureInit()) return;
  headingL = normDeg(headingL + Number(angle));   // ✅ sofort korrekt
  __enqueue(() => {
    // 🎬 Render nachziehen
    heading = normDeg(heading - Number(angle)); 
    draw();
  });
}

function left(angle) {
  if (!ensureInit()) return;
  headingL = normDeg(headingL - Number(angle));
  
  __enqueue(() => {
      heading = normDeg(heading + Number(angle));
    draw();
  });
}

function setheading(a) {
  if (!ensureInit()) return;
  headingL = normDeg(Number(a));
  __enqueue(() => {
    heading = normDeg(Number(a));
    draw();
  });
}

function towards(tx, ty) {
  if (!ensureInit()) return;

  const dx = Number(tx) - xL;
  const dy = Number(ty) - yL;

  // Sonderfall: Ziel = aktuelle Position
  if (!isFinite(dx) || !isFinite(dy) || (dx === 0 && dy === 0)) return;

  // atan2: 0°=Ost, CCW positiv
  // Umrechnung auf: 0°=Nord, rechtsdrehend
  const angle = normDeg(90 - (Math.atan2(dy, dx) * 180 / Math.PI));

  setheading(angle);
}

function penup() {
  if (!ensureInit()) return;
  __enqueue(() => { penDown = false; commitStyleToNewPathSync(); draw(); });
}
function pendown() {
  if (!ensureInit()) return;
  __enqueue(() => { penDown = true; commitStyleToNewPathSync(); draw(); });
}


function goto_(a, b) {
  if (!ensureInit()) return;

  let px, py;
  if (b === undefined && (Array.isArray(a) || (a && typeof a === "object"))) {
    const arr = Array.isArray(a) ? a : [a.x, a.y];
    px = Number(arr[0]);
    py = Number(arr[1]);
  } else {
    px = Number(a);
    py = Number(b);
  }

  // ✅ Logik sofort
  xL = px;
  yL = py;

  __enqueue(() => {
    x = px;
    y = py;
    current.points.push({ x: toCanvasX(x), y: toCanvasY(y), r: 0 });
    if (filling && activeFill) {
      activeFill.points.push({ x: toCanvasX(x), y: toCanvasY(y), r: 0 });
    }
    draw();
  });
}

function setx(px) {
  goto_(Number(px), yL);
}
function sety(py) {
  goto_(xL, Number(py));
}

const down = pendown, up = penup;

function pen(p = undefined) {
  // Python turtle: pen() -> dict; pen({...}) setzt Werte
  if (p === undefined) {
    return {
      pendown: penDown,
      pencolor: strokeColor,
      fillcolor: fillColor,
      pensize: current?.lineWidth ?? DEFAULT_LINE_WIDTH,
      speed: __fastDraw ? 0 : 3, // grob
      shown: turtleVisible,
    };
  }
  // Setter (teilweise)
  __enqueue(() => {
    if ("pendown" in p) penDown = !!p.pendown;
    if ("pencolor" in p) strokeColor = toColorString(p.pencolor);
    if ("fillcolor" in p) fillColor = toColorString(p.fillcolor);
    if ("pensize" in p) {
      const lw = Number(p.pensize);
      const seg = {
        down: penDown,
        stroke: strokeColor,
        lineWidth: lw,
        fontsize: fontSize,
        fill: filling,
        fillstyle: fillColor,
        points: [{ x: toCanvasX(x), y: toCanvasY(y), r: 0 }],
      };
      current = seg; paths.push(seg);
    } else {
      commitStyleToNewPathSync();
    }
    draw();
  });
}

function gotoFunc(px, py) {
  goto_(px, py);
} // exported as 'goto'

function position() { return [xL, yL]; }
const pos = position;

function xcor() { return xL; }
function ycor() { return yL; }
function heading_() { return headingL; } // name, damit es nicht mit var kollidiert

function speed(n = 3) {
  n = Number(n);
  if (!isFinite(n)) n = 3;

  // Python turtle: 0 = fastest
  if (n <= 0) {
    __delayMs = 0;
  } else {
    // sanfte Kurve, gut für Unterricht
    __delayMs = Math.max(0, Math.round(300 / n));
  }
}

function clear() {
  if (!ensureInit()) return;
  paths = [];
  newPath();
  draw();
}
function reset() {
  initTurtle(true);
} // full re-init

function init() {
  initTurtle(true);
} // alias für reset

function showturtle() {
  turtleVisible = true;
  __fastDraw = false;  // wieder mit Pausen
  draw();
}
function hideturtle() {
  turtleVisible = false;
  __fastDraw = true;   // ab jetzt ohne Pause zeichnen
  draw();
}

function isvisible() { return turtleVisible; }

function color(...args) {
  const s = (args.length === 1) ? toColorString(args[0]) : toColorString(args[0]);
  const f = (args.length === 1) ? s : toColorString(args[1]);
  __enqueue(() => {
    strokeColor = s;
    fillColor = f;
    commitStyleToNewPathSync();    // neues Liniensegment mit DIESEM Style
    if (filling && activeFill) {
      activeFill.stroke = strokeColor;
      activeFill.fillstyle = fillColor;
    }
  });
}


function pencolor(c) {
  if (!ensureInit()) return;
  const next = toColorString(c);
  __enqueue(() => {
    strokeColor = next;
    commitStyleToNewPathSync();
  });
}

function fillcolor(c) {
  if (!ensureInit()) return;
  const next = toColorString(c);
  __enqueue(() => {
    fillColor = next;
    commitStyleToNewPathSync();
    draw();
  });
}

function pensize(w) {
  if (!ensureInit()) return;
  __enqueue(() => {
    const seg = {
      down: penDown,
      stroke: strokeColor,
      lineWidth: Number(w),
      fontsize: fontSize,
      fill: filling,
      fillstyle: fillColor,
      points: [{ x: toCanvasX(x), y: toCanvasY(y), r: 0 }],
    };
    current = seg; paths.push(seg);
  });
}
function width(w) {
  pensize(w);
}

function begin_fill() {
  if (!ensureInit()) return;
  __enqueue(() => {
    if (filling) return;
    filling = true;
    activeFill = {
      down: penDown,
      stroke: "transparent",
      lineWidth: 1,
      fontsize: fontSize,
      fill: true,
      fillstyle: fillColor,
      points: [{ x: toCanvasX(x), y: toCanvasY(y), r: 0 }],
    };
    paths.push(activeFill);
  });
}

function end_fill() {
  if (!ensureInit()) return;
  __enqueue(() => {
    if (!filling) return;
    activeFill = null;
    filling = false;
    commitStyleToNewPathSync();
    draw()
  })
}

function dot(size = 5, c = null) {
  if (!ensureInit()) return;
  __enqueue(() => {
    const r = Math.max(0.5, Number(size)) / 2;
    const seg = {
      down: false, // Keine Linie zeichnen, nur den Punkt
      stroke: c ? toColorString(c) : strokeColor,
      lineWidth: 1,
      fontsize: fontSize,
      fill: true,
      fillstyle: c ? toColorString(c) : strokeColor,
      points: [],
    };
    seg.points.push({ x: toCanvasX(x), y: toCanvasY(y), r: r }); // Radius explizit setzen
    paths.push(seg);
    draw();
  })
}

function circle(radius, steps = 120) {
  // Approximate circle using polygon; sign of radius sets left/right orientation like turtle
  if (!ensureInit()) return;
  const r = Number(radius);
  const s = Math.max(8, Number(steps) | 0);
  const total = 2 * Math.PI * Math.abs(r);
  const stepLen = total / s;
  const turn = (360 / s) * (r >= 0 ? 1 : -1); // positive radius -> left turns
  for (let i = 0; i < s; i++) {
    forward(stepLen);
    right(turn);
  }
}



function write(text, move = false, align = "left", font = null) {
  if (!ensureInit()) return;

  // --- Font auflösen ---
  let family = "Arial";
  let size = current?.fontsize ?? fontSize;
  let style = "normal";

  try {
    if (font && (Array.isArray(font) || typeof font === "object")) {
      const arr = Array.from(font);
      if (arr[0]) family = String(arr[0]);
      if (arr[1]) size = Number(arr[1]);
      if (arr[2]) style = String(arr[2]);
    }
  } catch { }

  // ✅ WICHTIG: Position JETZT merken (nicht später im enqueue)
  const px = xL;   // oder x, falls du nur einen State nutzt
  const py = yL;
  const canvasX = toCanvasX(px);
  const canvasY = toCanvasY(py);
  const txt = String(text);
  const al = String(align || "left");

  __enqueue(() => {
    const seg = {
      down: false,
      stroke: strokeColor,
      lineWidth: 1,
      fontsize: size,
      fontfamily: family,
      fontstyle: style,
      fill: true,
      fillstyle: strokeColor,
      points: [],
    };
    seg.points.push({ x: canvasX, y: canvasY, text: txt, align: al });
    paths.push(seg);
    draw();
  });
}

function home() {
  goto_(0, 0);
  setheading(0);
}

// Schriftgröße setzen
function setfontsize(size) {
  if (!ensureInit()) return;
  __enqueue(() => {
    const seg = {
      down: penDown,
      stroke: strokeColor,
      lineWidth: current?.lineWidth ?? DEFAULT_LINE_WIDTH,
      fontsize: Number(size),
      fill: filling,
      fillstyle: fillColor,
      points: [{ x: toCanvasX(x), y: toCanvasY(y), r: 0 }],
    };
    current = seg; paths.push(seg); draw();
  });
}


// RGB zu Hex Konverter (intern)
function rgbToHex(r, g, b) {
  // Stelle sicher, dass die Werte Zahlen sind und im Bereich 0-255 sind
  const clampedR = Math.max(0, Math.min(255, Math.round(Number(r))));
  const clampedG = Math.max(0, Math.min(255, Math.round(Number(g))));
  const clampedB = Math.max(0, Math.min(255, Math.round(Number(b))));

  // Konvertiere zu Hex mit führenden Nullen
  const hexR = clampedR.toString(16).padStart(2, "0");
  const hexG = clampedG.toString(16).padStart(2, "0");
  const hexB = clampedB.toString(16).padStart(2, "0");

  return `#${hexR}${hexG}${hexB}`;
}

// RGB-Array zu Hex Konverter (intern)
function rgbArrayToHex(rgbArray) {
  if (!Array.isArray(rgbArray) || rgbArray.length < 3) {
    return "#000000";
  }

  return rgbToHex(rgbArray[0], rgbArray[1], rgbArray[2]);
}

// helpers
function toColorString(v) {
  if (typeof v === "string") return v
  //else (Array.isArray(v) || (v && typeof v === "object" && v.length === 3)) {
  const [r, g, b] = Array.from(v);
  // Stelle sicher, dass die Werte Zahlen sind
  const result = rgbArrayToHex(Array.from(v));
  return result;
  //}

  //return "#000";
}

// Movement aliases
const fd = forward;
const bk = backward;
const back = backward;

// Turn aliases
const rt = right;
const lt = left;

// goto aliases
const goto = (...args) => goto_(...args);
const setpos = (...args) => goto_(...args);
const setposition = (...args) => goto_(...args);

// heading alias
const seth = setheading;

// pen aliases
const pd = pendown;
const pu = penup;

// turtle visibility aliases
const st = showturtle;
const ht = hideturtle;

// ------- Expose to JS (optional for debugging) -------
Object.assign(window, {
  forward, fd,
  backward, bk, back,
  right, rt,
  left, lt,

  goto, setpos, setposition,
  setx, sety,

  setheading, seth,
  home,
  circle,
  dot,

  position, pos,
  xcor, ycor,
  heading: heading_,
  towards,

  pendown, pd, down,
  penup, pu, up,
  pensize, width,
  pen,
  write,
  color,
  pencolor,
  fillcolor,
  begin_fill,
  end_fill,

  bgcolor,
  bgpic,

  reset,
  speed,
  clear,

  turtleReset: () => initTurtle(true),
  turtleClear: () => clearAllPaths(),

  showturtle, st,
  hideturtle, ht,
  isvisible,
});

// ------- Export to Python (Pyodide) -------
window.registerTurtleInPython = async (pyodide) => {
  // make sure canvas is ready
  if (!ensureInit()) await turtleReady;

  const api = {
    forward, fd,
    backward, bk, back,
    right, rt,
    left, lt,

    goto, setpos, setposition,
    setx, sety,

    setheading, seth,
    home,
    circle,
    dot,
    towards,

    position, pos,
    xcor, ycor,
    heading: heading_,

    pendown, pd, down,
    penup, pu, up,
    pensize, width,
    pen,
    write,


    color,
    pencolor,
    fillcolor,
    begin_fill,
    end_fill,

    bgcolor,
    bgpic,

    reset,
    speed,
    clear,

    showturtle, st,
    hideturtle, ht,
    isvisible,
  };

  pyodide.registerJsModule("turtle", api);
  pyodide.registerJsModule("jturtle", api);

  console.log("Turtle-API erfolgreich in Pyodide registriert");
};
