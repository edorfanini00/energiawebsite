/* ============================================================
   Energia AI — 3D energy campus (Hut8-style off-white iso world)
   ============================================================ */
import * as THREE from "three";

gsap.registerPlugin(ScrollTrigger);

/* ---------- renderer / scene / camera ---------- */
const canvas = document.getElementById("scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const BG = new THREE.Color("#f4f4f1");
const scene = new THREE.Scene();
scene.background = BG;
scene.fog = new THREE.Fog(BG, 170, 380);

const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 800);

/* ---------- lights — very soft, low-contrast ---------- */
scene.add(new THREE.HemisphereLight(0xffffff, 0xeaeae4, 1.55));
scene.add(new THREE.AmbientLight(0xf2f2ee, 0.55));
const sun = new THREE.DirectionalLight(0xffffff, 0.8);
sun.position.set(60, 95, 45);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -130;
sun.shadow.camera.right = 130;
sun.shadow.camera.top = 130;
sun.shadow.camera.bottom = -130;
sun.shadow.bias = -0.0004;
scene.add(sun);

/* ---------- material helpers ---------- */
const MAT = {};
function mat(hex) {
  if (!MAT[hex]) MAT[hex] = new THREE.MeshStandardMaterial({ color: hex, roughness: 1, metalness: 0 });
  return MAT[hex];
}
const C = {
  shell: "#f2f3f0",
  slab: "#e9eae6",
  wall: "#e1e2dd",
  duct: "#d3d5cf",
  unit: "#edeeea",
  dark: "#c3c6bf",
  accent: "#a4c652", // lime trace green
};

function box(w, h, d, color, x, y, z, parent = scene) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
function cyl(rt, rb, h, color, x, y, z, parent = scene, seg = 20) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
/* fin arrays — the ribbed look of the reference style */
function fins(count, fw, fh, fd, gap, color, x, y, z, parent = scene, axis = "x") {
  for (let i = 0; i < count; i++) {
    const o = (i - (count - 1) / 2) * gap;
    box(fw, fh, fd, color, x + (axis === "x" ? o : 0), y, z + (axis === "z" ? o : 0), parent);
  }
}

/* ---------- ground: huge white plane + global dot grid ---------- */
const ground = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), mat("#f6f6f3"));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

function dotTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  for (let i = 0; i < 8; i++)
    for (let j = 0; j < 8; j++) {
      g.fillStyle = (i * 8 + j) % 19 === 0 ? "rgba(164,198,82,0.55)" : "rgba(125,135,150,0.38)";
      g.beginPath();
      g.arc(16 + i * 32, 16 + j * 32, 2.1, 0, Math.PI * 2);
      g.fill();
    }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(56, 56);
  return t;
}
const dots = new THREE.Mesh(
  new THREE.PlaneGeometry(760, 760),
  new THREE.MeshBasicMaterial({ map: dotTexture(), transparent: true, opacity: 0.85, depthWrite: false })
);
dots.rotation.x = -Math.PI / 2;
dots.position.y = 0.02;
scene.add(dots);

/* ---------- multi-strand trace routes (gray strands + one lime) ---------- */
function stripeTexture(strands, greenIdx) {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 128;
  const g = c.getContext("2d");
  for (let i = 0; i < strands; i++) {
    const y = (i + 0.5) * (128 / strands);
    g.strokeStyle = i === greenIdx ? "rgba(164,198,82,0.95)" : "rgba(125,130,122,0.35)";
    g.lineWidth = i === greenIdx ? 3 : 2;
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(64, y);
    g.stroke();
  }
  return c;
}
function traceRoute(pts, width = 3.2, strands = 9, greenIdx = 3) {
  const img = stripeTexture(strands, greenIdx);
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, z1] = pts[i];
    const [x2, z2] = pts[i + 1];
    const dx = x2 - x1, dz = z2 - z1;
    const len = Math.hypot(dx, dz) + width * 0.6;
    const tex = new THREE.CanvasTexture(img);
    tex.wrapS = THREE.RepeatWrapping;
    tex.repeat.set(len / 10, 1);
    const geo = new THREE.PlaneGeometry(len, width);
    geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    m.rotation.y = Math.atan2(-dz, dx);
    m.position.set((x1 + x2) / 2, 0.05 + i * 0.002, (z1 + z2) / 2);
    m.renderOrder = 1;
    scene.add(m);
  }
}
/* campus grid of routes */
traceRoute([[-105, 82], [-62, 54], [-30, 32], [-8, 16]]);            // street → building (journey road)
traceRoute([[-52, 64], [-2, 52], [46, 42]], 3.6, 11, 5);             // solar → substation
traceRoute([[-72, -22], [-18, -32], [54, -32]], 4.2, 13, 6);         // cooling towers → data hall
traceRoute([[46, 40], [30, 20], [19, 10]], 2.6, 7, 3);               // substation → building
traceRoute([[74, 32], [42, -8], [24, -22]], 2.6, 7, 2);              // east feeder

/* ============================================================
   MAIN BUILDING — larger commercial cutaway with HVAC
   ============================================================ */
const bld = new THREE.Group();
scene.add(bld);

const FLOORS = 7;
const FH = 3.8;               // floor height
const W = 34, D = 22;         // footprint
const ROOF_Y = FLOORS * FH;   // 26.6
const JOURNEY_FLOOR = 5;      // the floor the line ends on

/* slabs, back & left walls, columns, core */
for (let i = 0; i <= FLOORS; i++) {
  box(W, 0.5, D, C.slab, 0, i * FH + 0.25, 0, bld);
}
for (let i = 0; i < FLOORS; i++) {
  const y = i * FH + FH / 2 + 0.25;
  box(W, FH, 0.45, C.wall, 0, y, -D / 2 + 0.22, bld);           // back wall
  box(0.45, FH, D, C.wall, -W / 2 + 0.22, y, 0, bld);           // left wall
  for (let cx = -W / 2 + 2.5; cx <= W / 2 - 2; cx += 6) {
    box(0.55, FH, 0.55, C.shell, cx, y, D / 2 - 0.7, bld);      // front columns
  }
}
/* service core (elevators/stairs) */
box(6, ROOF_Y + 1.2, 5, C.shell, -W / 2 + 3.5, (ROOF_Y + 1.2) / 2, -D / 2 + 3, bld);

/* roof parapet */
box(W + 0.6, 1.0, 0.5, C.shell, 0, ROOF_Y + 0.75, D / 2, bld);
box(W + 0.6, 1.0, 0.5, C.shell, 0, ROOF_Y + 0.75, -D / 2, bld);
box(0.5, 1.0, D, C.shell, -W / 2, ROOF_Y + 0.75, 0, bld);
box(0.5, 1.0, D, C.shell, W / 2, ROOF_Y + 0.75, 0, bld);

/* ---------- per-floor HVAC: detail only where the journey goes ---------- */
const diffuserCones = [];
for (let i = 0; i < FLOORS; i++) {
  const ceilY = (i + 1) * FH - 0.55;
  box(W - 8, 0.8, 1.0, C.duct, -1, ceilY, -2, bld);             // trunk duct, every floor
  if (i !== JOURNEY_FLOOR) continue;

  for (const bx of [-11, -2, 7]) {
    box(0.6, 0.6, 8, C.duct, bx, ceilY, 1.8, bld);              // branch duct
    box(1.6, 1.1, 1.8, C.dark, bx, ceilY, -0.3, bld);           // VAV box
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(0.95, 1.7, 4),
      new THREE.MeshBasicMaterial({ color: 0xa9cf86, transparent: true, opacity: 0.3 })
    );
    cone.position.set(bx, ceilY - 1.15, 5.5);
    cone.rotation.y = Math.PI / 4;
    bld.add(cone);
    diffuserCones.push(cone);
    box(1.2, 0.18, 1.2, C.shell, bx, ceilY - 0.34, 5.5, bld);   // diffuser plate
  }
  /* destination VAV (bx = -11) — full detail */
  box(0.55, 0.45, 0.55, C.accent, -10.0, ceilY + 0.25, -0.3, bld); // damper actuator
  box(1.0, 0.8, 0.7, C.dark, -11, ceilY - 0.15, 1.0, bld);         // reheat coil section
  cyl(0.1, 0.1, 1.5, C.dark, -11.8, ceilY - 0.6, 1.0, bld);        // hot-water tap
}

/* ---------- vertical supply riser ---------- */
box(1.6, ROOF_Y, 1.6, C.duct, 14, ROOF_Y / 2, -7.2, bld);

/* ============================================================
   ROOFTOP PLANT — finned RTUs, AHU, louvered cooling tower
   ============================================================ */
const fans = [];
function makeFan(r, x, y, z, parent) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  cyl(r, r, 0.22, C.dark, 0, 0, 0, g);
  const blades = new THREE.Group();
  for (let k = 0; k < 3; k++) {
    const b = box(r * 1.7, 0.08, 0.28, C.shell, 0, 0.14, 0, blades);
    b.rotation.y = (k * Math.PI) / 3;
  }
  g.add(blades);
  fans.push(blades);
  parent.add(g);
  return g;
}

function rtu(x, z) {
  const g = new THREE.Group();
  g.position.set(x, ROOF_Y + 0.5, z);
  box(5.6, 0.28, 3.2, C.dark, 0, 0.14, 0, g);                   // curb
  box(5.2, 2.1, 2.9, C.unit, 0, 1.2, 0, g);                     // casing
  makeFan(0.9, -1.3, 2.35, 0, g);
  makeFan(0.9, 1.1, 2.35, 0, g);
  fins(9, 0.07, 1.5, 2.6, 0.26, C.dark, 1.6, 1.2, 0, g);        // condenser fin bank
  box(0.08, 1.6, 2.5, C.dark, -2.3, 1.2, 0, g);                 // filter access seam
  box(1.0, 1.1, 1.0, C.duct, -1.7, -0.25, 1.0, g);              // supply drop
  bld.add(g);
  return g;
}
rtu(-9, 3);
rtu(0, 6.5);

/* louvered cooling tower */
const ct = new THREE.Group();
ct.position.set(-12, ROOF_Y + 0.5, -5);
box(4.6, 3.4, 4.6, C.unit, 0, 1.7, 0, ct);
for (let k = 0; k < 7; k++) box(4.7, 0.1, 4.2, C.dark, 0, 0.55 + k * 0.46, 0, ct);
cyl(1.7, 2.0, 0.95, C.shell, 0, 3.85, 0, ct);
makeFan(1.35, 0, 4.45, 0, ct);
bld.add(ct);

/* rooftop AHU — sectioned, with intake hood + filter/coil bands */
const ahu = new THREE.Group();
ahu.position.set(7, ROOF_Y + 0.5, -4);
box(7.8, 0.28, 3.8, C.dark, 0, 0.14, 0, ahu);                   // curb
box(7.4, 2.5, 3.5, C.unit, 0, 1.5, 0, ahu);                     // casing
box(0.08, 2.1, 3.1, C.dark, -1.4, 1.5, 0, ahu);                 // section seams
box(0.08, 2.1, 3.1, C.dark, 1.5, 1.5, 0, ahu);
cyl(0.6, 0.6, 0.12, C.dark, -2.7, 1.5, 1.78, ahu).rotation.x = Math.PI / 2; // access ports
cyl(0.6, 0.6, 0.12, C.dark, 0.1, 1.5, 1.78, ahu).rotation.x = Math.PI / 2;
makeFan(0.85, 2.6, 2.9, 0, ahu);                                // supply fan
box(1.1, 0.9, 1.1, C.duct, 4.2, 1.1, -1.2, ahu);                // duct to shaft
/* outside-air intake hood with louvers */
box(1.0, 1.7, 2.8, C.dark, -4.2, 1.6, 0, ahu);
for (let k = 0; k < 5; k++) box(1.08, 0.07, 2.6, C.shell, -4.2, 1.0 + k * 0.32, 0, ahu);
/* internal section bands: filter (grey) → cooling coil (lime) */
box(0.12, 2.3, 3.56, "#c8cdc4", -0.5, 1.5, 0, ahu);
box(0.12, 2.3, 3.56, "#b9d489", 0.6, 1.5, 0, ahu);
bld.add(ahu);

/* supply shaft: roof → journey-floor ceiling plenum */
box(1.3, ROOF_Y - 22.0, 1.3, C.duct, 4.4, (ROOF_Y + 22.0) / 2, -6.4, bld);

/* ============================================================
   GROUND-FLOOR MECHANICAL ROOM — boiler plant
   ============================================================ */
const mech = new THREE.Group();
mech.position.set(9, 0, -5);
scene.add(mech);
box(6.5, 0.14, 5.2, C.dark, 0, 0.32, 0, mech);                  // mech-room pad
cyl(1.1, 1.1, 2.5, C.unit, 0, 1.55, 0, mech);                   // boiler vessel
const dome = new THREE.Mesh(new THREE.SphereGeometry(1.1, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat(C.unit));
dome.position.set(0, 2.8, 0);
dome.castShadow = true;
mech.add(dome);
box(1.0, 1.2, 0.13, C.dark, 0, 1.25, 1.12, mech);               // burner panel
cyl(0.24, 0.24, 1.1, C.dark, 0, 3.5, 0, mech);                  // flue stack
cyl(0.55, 0.55, 1.5, C.dark, 1.9, 0.8, 1.3, mech).rotation.z = Math.PI / 2; // circ pump
box(0.65, 0.65, 0.65, C.unit, 2.7, 0.8, 1.3, mech);             // pump motor
cyl(0.5, 0.5, 1.8, C.shell, -2.1, 1.2, 0.9, mech);              // expansion tank
/* hot-water supply & return piping toward the riser */
cyl(0.16, 0.16, 3.4, C.dark, 1.9, 2.6, -0.7, mech).rotation.z = Math.PI / 2;
cyl(0.16, 0.16, 2.0, C.dark, 3.6, 1.7, -0.7, mech);
cyl(0.16, 0.16, 2.6, C.dark, 1.5, 2.1, 0.5, mech).rotation.z = Math.PI / 2;
/* isolation valves (lime handwheels) + gauge */
cyl(0.3, 0.3, 0.13, C.accent, 1.1, 2.96, -0.7, mech);
cyl(0.3, 0.3, 0.13, C.accent, 1.1, 2.46, 0.5, mech);
cyl(0.2, 0.2, 0.09, "#ffffff", 0.6, 2.05, 1.13, mech).rotation.x = Math.PI / 2;

/* ============================================================
   GROUND-LEVEL CHILLER PLANT (beside building)
   ============================================================ */
const plant = new THREE.Group();
plant.position.set(30, 0, 6);
scene.add(plant);
box(9, 0.3, 7, C.slab, 0, 0.15, 0, plant);                      // pad
for (const cz of [-1.6, 1.6]) {
  box(6.4, 1.9, 2.4, C.unit, 0, 1.25, cz, plant);               // chiller body
  cyl(0.7, 0.7, 5.4, C.shell, 0, 2.6, cz, plant).rotation.z = Math.PI / 2;
  cyl(0.48, 0.48, 5.0, C.dark, 0, 3.15, cz + 0.5, plant).rotation.z = Math.PI / 2;
}
for (const px of [-2.2, 0, 2.2]) {
  cyl(0.45, 0.45, 0.85, C.dark, px, 0.75, 3.0, plant).rotation.z = Math.PI / 2;
  box(0.75, 0.75, 0.75, C.unit, px + 0.8, 0.75, 3.0, plant);
}
/* chilled-water mains into the building */
cyl(0.3, 0.3, 9, C.dark, 21.5, 1.3, 6, scene).rotation.z = Math.PI / 2;
cyl(0.3, 0.3, 9, C.dark, 21.5, 1.9, 6.8, scene).rotation.z = Math.PI / 2;

/* ============================================================
   THE JOURNEY LINE — campus street → lobby → boiler → riser
   → AHU → shaft → VAV. Drawn progressively on scroll.
   ============================================================ */
const routeCurve = new THREE.CatmullRomCurve3(
  [
    [-105, 0.5, 82],             // far out on the campus grid
    [-62, 0.5, 54],
    [-30, 0.5, 32],              // along the trace road
    [-12, 0.6, 19],
    [-4, 0.9, 14],               // through the front colonnade
    [2, 1.2, 5],                 // across the ground floor
    [6, 1.5, -1.5],
    [9, 3.6, -5],                // up and over the boiler
    [13.4, 4.4, -6.9],           // join the riser corner
    [14.9, 12, -7.2],            // climbing alongside the riser (visible face)
    [14.9, 20, -7.2],
    [14.2, ROOF_Y + 1.6, -7.4],  // exit at the roof
    [11, ROOF_Y + 1.9, -5.4],    // toward the AHU
    [7, ROOF_Y + 2.2, -4],       // through the AHU sections
    [4.6, ROOF_Y + 1.6, -5.9],   // out the supply side
    [4.45, ROOF_Y - 3.4, -6.45], // down the supply shaft (visible face)
    [4.4, 22.1, -5.2],           // into the journey-floor plenum
    [-2, 21.65, -2.0],           // along the trunk duct
    [-9.9, 21.65, -2.0],         // reach the VAV branch
    [-11, 21.55, 1.0],           // through the VAV box
    [-11, 20.8, 5.5],            // out the diffuser
    [-11, 19.5, 7.8],            // into the room
  ].map((p) => new THREE.Vector3(...p)),
  false,
  "catmullrom",
  0.08
);

/* lime tube + pale core, revealed via drawRange as you scroll */
const TUBE_SEGS = 1200;
const routeTube = new THREE.Mesh(
  new THREE.TubeGeometry(routeCurve, TUBE_SEGS, 0.16, 12),
  new THREE.MeshBasicMaterial({ color: "#a4c652" })
);
const routeCore = new THREE.Mesh(
  new THREE.TubeGeometry(routeCurve, TUBE_SEGS, 0.06, 8),
  new THREE.MeshBasicMaterial({ color: "#eef6da" })
);
routeTube.renderOrder = 2;
routeCore.renderOrder = 3;
scene.add(routeTube, routeCore);
const TUBE_INDEX = routeTube.geometry.index.count;
const CORE_INDEX = routeCore.geometry.index.count;
routeTube.geometry.setDrawRange(0, 0);
routeCore.geometry.setDrawRange(0, 0);

/* destination room glow (pulses once the line arrives at the VAV) */
const roomGlow = new THREE.Mesh(
  new THREE.BoxGeometry(9, 3.2, 7),
  new THREE.MeshBasicMaterial({ color: 0xb9d878, transparent: true, opacity: 0, depthWrite: false })
);
roomGlow.position.set(-11, 20.8, 4.5);
scene.add(roomGlow);

function glowSprite(size, color, opacity) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.25, color);
  grad.addColorStop(1, "rgba(180,215,120,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const s = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, opacity, depthWrite: false })
  );
  s.scale.setScalar(size);
  scene.add(s);
  return s;
}

/* energy pulses traveling along the revealed portion of the line */
const N_PARTICLES = 30;
const particles = [];
for (let i = 0; i < N_PARTICLES; i++) {
  const s = glowSprite(0.7 + Math.random() * 0.4, "rgba(190,225,120,0.95)", 0.55);
  particles.push({ s, t: Math.random(), speed: 0.0012 + Math.random() * 0.0008 });
}
/* glowing head riding the tip of the line as it draws */
const comet = glowSprite(3.4, "rgba(195,230,130,0.95)", 0.9);

/* ============================================================
   SYSTEM STATIONS — the line "docks" at each system, scroll
   gets sticky there, and a label fades in
   ============================================================ */
function makeLabel(text, x, y, z) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 128;
  const g = c.getContext("2d");
  g.font = "700 44px Archivo, Inter, sans-serif";
  const w = g.measureText(text).width + 76;
  g.fillStyle = "rgba(20,24,30,0.92)";
  g.beginPath();
  g.roundRect((512 - w) / 2, 28, w, 72, 36);
  g.fill();
  g.fillStyle = "#b9d878";
  g.beginPath();
  g.arc((512 - w) / 2 + 36, 64, 9, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#ffffff";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, 256 + 14, 66);
  const s = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, opacity: 0, depthTest: false })
  );
  s.scale.set(8.4, 2.1, 1);
  s.position.set(x, y, z);
  s.renderOrder = 10;
  scene.add(s);
  return s;
}

/* world positions where the line reaches each key system */
const stations = [
  { point: new THREE.Vector3(9, 3.6, -5),               label: makeLabel("BOILER PLANT", 9, 7.4, -5) },
  { point: new THREE.Vector3(7, ROOF_Y + 2.2, -4),      label: makeLabel("ROOFTOP AHU", 7, ROOF_Y + 6, -4) },
  { point: new THREE.Vector3(-11, 21.55, 1.0),          label: makeLabel("VAV ZONE — FLOOR 6", -11, 25.6, 1.0) },
];

/* find the arc-length parameter u where the curve passes each station */
const _sv = new THREE.Vector3();
function findU(target) {
  let best = 0, bd = Infinity;
  for (let i = 0; i <= 600; i++) {
    const u = i / 600;
    routeCurve.getPointAt(u, _sv);
    const d = _sv.distanceToSquared(target);
    if (d < bd) { bd = d; best = u; }
  }
  return best;
}
for (const st of stations) st.u = findU(st.point);

/* journey-space stop values (same mapping used by the reveal: j = 0.05 + 0.85u) */
const stopsJ = stations.map((st) => Math.min(0.98, 0.05 + 0.85 * st.u));

/* piecewise scroll → journey map with a flat "dwell" at each station.
   Smoothstep easing inside each travel segment decelerates into the
   stop and accelerates out — the scroll friction. */
const DWELL = 0.085;
const journeySegs = [];
{
  const knots = [0, ...stopsJ, 1];
  const gaps = knots.slice(1).map((v, i) => v - knots[i]);
  const totalGap = gaps.reduce((a, b) => a + b, 0);
  const travelTotal = 1 - DWELL * stopsJ.length;
  let s = 0;
  for (let i = 0; i < gaps.length; i++) {
    const w = travelTotal * (gaps[i] / totalGap);
    journeySegs.push([s, s + w, knots[i], knots[i + 1]]);
    s += w;
    if (i < stopsJ.length) {
      journeySegs.push([s, s + DWELL, knots[i + 1], knots[i + 1]]);
      s += DWELL;
    }
  }
}
function journeyMap(x) {
  for (const [s0, s1, j0, j1] of journeySegs) {
    if (x <= s1) {
      const t = s1 === s0 ? 1 : (x - s0) / (s1 - s0);
      const e = t * t * (3 - 2 * t); // smoothstep = friction at both ends
      return j0 + (j1 - j0) * e;
    }
  }
  return 1;
}

/* ============================================================
   ENERGY CAMPUS — wind, solar, cooling towers, substation,
   finned data hall, louvered racks, cube clusters
   ============================================================ */
const turbines = [];
function windTurbine(x, z, yaw = 0) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  cyl(0.28, 0.5, 15, C.shell, 0, 7.5, 0, g);                    // tower
  box(2.0, 0.9, 0.9, C.unit, 0.4, 15.2, 0, g);                  // nacelle
  const hub = new THREE.Group();
  hub.position.set(1.55, 15.2, 0);
  for (let k = 0; k < 3; k++) {
    const pivot = new THREE.Group();
    pivot.rotation.x = (k * Math.PI * 2) / 3;
    const blade = box(0.12, 6.2, 0.5, C.shell, 0, 3.1, 0, pivot);
    blade.castShadow = true;
    hub.add(pivot);
  }
  g.add(hub);
  turbines.push(hub);
  scene.add(g);
}
windTurbine(-78, 14, 0.5);
windTurbine(-66, 28, 0.4);
windTurbine(-56, 10, 0.6);
windTurbine(-70, -2, 0.45);

/* solar array */
function solarField(cx, cz, cols, rows) {
  const g = new THREE.Group();
  g.position.set(cx, 0, cz);
  g.rotation.y = 0.35;
  for (let i = 0; i < cols; i++)
    for (let j = 0; j < rows; j++) {
      const x = (i - (cols - 1) / 2) * 4.0;
      const z = (j - (rows - 1) / 2) * 2.9;
      cyl(0.08, 0.08, 0.8, C.dark, x, 0.4, z, g);
      const p = box(3.4, 0.1, 2.2, "#dfe3da", x, 0.95, z, g);
      p.rotation.x = -0.42;
    }
  scene.add(g);
}
solarField(-46, 58, 7, 4);

/* hyperboloid cooling towers */
function coolingTowerLarge(x, z, s = 1) {
  const pts = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const r = 4.2 - 2.0 * Math.sin(t * Math.PI * 0.62);
    pts.push(new THREE.Vector2(r * s, t * 13 * s));
  }
  const m = new THREE.Mesh(new THREE.LatheGeometry(pts, 26), mat(C.shell));
  m.position.set(x, 0, z);
  m.castShadow = true;
  m.receiveShadow = true;
  scene.add(m);
  cyl(2.6 * s, 2.6 * s, 0.3, C.dark, x, 13 * s, z);
}
coolingTowerLarge(-62, -22);
coolingTowerLarge(-52, -28, 0.85);

/* substation */
const sub = new THREE.Group();
sub.position.set(48, 0, 42);
sub.rotation.y = -0.3;
box(14, 0.25, 10, C.slab, 0, 0.12, 0, sub);
for (const tx of [-4, 0.5]) {
  box(2.6, 2.4, 2.0, C.unit, tx, 1.45, -1.5, sub);
  fins(6, 0.07, 1.8, 1.7, 0.3, C.dark, tx + 1.5, 1.45, -1.5, sub);
  cyl(0.12, 0.12, 1.2, C.dark, tx - 0.6, 3.2, -1.5, sub);
}
for (const px of [-5, 0, 5]) {
  cyl(0.14, 0.14, 4.2, C.shell, px, 2.1, 2.6, sub);
  cyl(0.14, 0.14, 4.2, C.shell, px + 2.4, 2.1, 2.6, sub);
  box(3.4, 0.22, 0.22, C.shell, px + 1.2, 4.2, 2.6, sub);
}
scene.add(sub);

/* finned data hall (the big ribbed building of the reference) */
const hall = new THREE.Group();
hall.position.set(60, 0, -32);
hall.rotation.y = 0.25;
box(28, 5.5, 16, C.shell, 0, 2.75, 0, hall);
box(30, 1.1, 18, C.slab, 0, 0.55, 0, hall);
fins(22, 0.45, 1.4, 13, 1.15, C.dark, 0, 6.2, 0, hall);          // rooftop fin bank
box(8, 3.4, 6, C.unit, -14, 1.7, 6, hall);                       // annex
scene.add(hall);

/* louvered rack rows (like the reference's data-center aisles) */
function louverRack(x, z, yaw) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  box(4.6, 6.4, 3.8, C.shell, 0, 3.2, 0, g);
  for (let k = 0; k < 6; k++) box(3.6, 0.16, 0.1, C.dark, 0, 1.1 + k * 0.82, 1.92, g);
  box(4.8, 0.35, 4.0, C.slab, 0, 0.17, 0, g);
  scene.add(g);
}
for (let i = 0; i < 4; i++) {
  louverRack(34 + i * 8, -56, 0.15);
  louverRack(36 + i * 8, -68, 0.15);
}

/* small white cube clusters scattered on the grid */
function cluster(x, z) {
  const n = 3 + Math.floor(Math.random() * 4);
  for (let i = 0; i < n; i++) {
    const s = 0.9 + Math.random() * 1.4;
    box(s, s * 0.8, s, C.shell, x + (Math.random() - 0.5) * 6, s * 0.4, z + (Math.random() - 0.5) * 6);
  }
}
[[-22, 62], [26, 62], [-88, 44], [78, 8], [8, -62], [-30, -52], [-92, -8], [88, 52]].forEach(([x, z]) => cluster(x, z));

/* low context building near the plaza */
const ctx1 = new THREE.Group();
ctx1.position.set(-34, 0, -18);
box(13, 4.2, 9, C.shell, 0, 2.1, 0, ctx1);
fins(10, 0.35, 0.9, 7.5, 1.1, C.dark, 0, 4.9, 0, ctx1);
scene.add(ctx1);

/* ============================================================
   SCROLL CHOREOGRAPHY
   ============================================================ */
const camPos = new THREE.CatmullRomCurve3(
  [
    [105, 78, 110],     // hero — vast iso campus view
    [-45, 22, 105],     // 01 — gliding along the trace road
    [42, 9, 28],        // 02 — ground floor, at the boiler
    [52, 36, 26],       // 03 — riser climbing to the rooftop AHU
    [7, 23, 42],        // 04 — level with the journey floor, VAV zone
    [120, 85, 125],     // exit — pull way out
  ].map((p) => new THREE.Vector3(...p)),
  false,
  "centripetal"
);
const camTarget = new THREE.CatmullRomCurve3(
  [
    [0, 10, 0],
    [-28, 1, 36],       // the line on the campus grid
    [9, 2.6, -5],       // the boiler
    [13, 24, -6.5],     // the riser / AHU
    [-9, 21.8, 2],      // the VAV box
    [0, 12, 0],
  ].map((p) => new THREE.Vector3(...p)),
  false,
  "centripetal"
);

let progress = 0;
const hero = document.querySelector(".hero");
const steps = [...document.querySelectorAll(".step")];

/* header inverts to white while the dark photo hero is on screen */
const headerEl = document.querySelector(".site-header");
ScrollTrigger.create({
  trigger: ".photo-hero",
  start: "top top",
  end: "bottom top+=70",
  onToggle(self) {
    headerEl.classList.toggle("on-dark", self.isActive);
  },
});

ScrollTrigger.create({
  trigger: ".stage",
  start: "top top",
  end: "bottom bottom",
  scrub: 0.5,
  onUpdate(self) {
    progress = self.progress;
    const h = Math.max(0, 1 - progress / 0.09);
    hero.style.opacity = h;
    hero.style.transform = `translateY(${progress * -160}px)`;
  },
});

/* ---------- resize ---------- */
function resize() {
  const w = canvas.clientWidth || window.innerWidth;
  const h = canvas.clientHeight || window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();

/* ============================================================
   IMPACT SECTION — dotted terrain with building pins
   (second canvas: AI savings across the managed portfolio)
   ============================================================ */
const impactCanvas = document.getElementById("impact-scene");
const impactRenderer = new THREE.WebGLRenderer({ canvas: impactCanvas, antialias: true, alpha: true });
impactRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const impactScene = new THREE.Scene();
/* transparent canvas so the ghosted headline shows through behind the hills */
impactScene.fog = new THREE.Fog(BG, 70, 170);
const impactCam = new THREE.PerspectiveCamera(35, 1, 0.1, 400);

/* rolling height field */
function terrainH(x, z) {
  return (
    2.6 * Math.sin(x * 0.055 + 1.2) +
    2.1 * Math.sin(z * 0.085 + 2.1) +
    1.7 * Math.sin((x + z) * 0.045 + 0.4) +
    1.1 * Math.sin(x * 0.13 - z * 0.07 + 3.0)
  );
}

/* dotted terrain — a points cloud over the height field */
{
  const cols = 200, rows = 130, sp = 1.1;
  const pos = new Float32Array(cols * rows * 3);
  let k = 0;
  for (let i = 0; i < cols; i++)
    for (let j = 0; j < rows; j++) {
      const x = (i - cols / 2) * sp;
      const z = (j - rows / 2) * sp;
      pos[k++] = x;
      pos[k++] = terrainH(x, z);
      pos[k++] = z;
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const dotC = document.createElement("canvas");
  dotC.width = dotC.height = 64;
  const dg = dotC.getContext("2d");
  dg.fillStyle = "#8e9189";
  dg.beginPath();
  dg.arc(32, 32, 26, 0, Math.PI * 2);
  dg.fill();
  const points = new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      map: new THREE.CanvasTexture(dotC),
      size: 0.55,
      transparent: true,
      alphaTest: 0.4,
      sizeAttenuation: true,
      color: "#90938b",
    })
  );
  impactScene.add(points);
}

/* portfolio pins: annual energy saved per building */
const SITES = [
  { v: 2.1, unit: "GWh", name: "Hudson Square — NYC", note: "" },
  { v: 1.8, unit: "GWh", name: "Century City — LA", note: "Under Deployment" },
  { v: 1.4, unit: "GWh", name: "Beacon Tower — Boston", note: "" },
  { v: 1.1, unit: "GWh", name: "Galleria — Houston", note: "" },
  { v: 0.98, unit: "GWh", name: "Wacker Drive — Chicago", note: "" },
  { v: 0.76, unit: "GWh", name: "Midtown Union — Atlanta", note: "" },
  { v: 0.62, unit: "GWh", name: "Financial District — SF", note: "" },
  { v: 0.54, unit: "GWh", name: "Tech Center — Denver", note: "" },
  { v: 0.48, unit: "GWh", name: "Brickell — Miami", note: "" },
  { v: 0.41, unit: "GWh", name: "Navy Yard — DC", note: "" },
  { v: 0.35, unit: "GWh", name: "Capitol Hill — Seattle", note: "Onboarding" },
  { v: 0.29, unit: "GWh", name: "Uptown — Dallas", note: "Onboarding" },
];
const SITE_XZ = [
  [-28, -8], [22, 4], [-17, 6], [6, -12], [-6, -2], [12, 10],
  [-23, 12], [1, 4], [27, -10], [17, -18], [-11, -18], [30, 10],
];

const labelsRoot = document.getElementById("impact-labels");
const pins = [];
const needleGeo = new THREE.CylinderGeometry(0.07, 0.015, 1, 8);
needleGeo.translate(0, 0.5, 0); // grow upward from the base
for (let i = 0; i < SITES.length; i++) {
  const site = SITES[i];
  const [x, z] = SITE_XZ[i];
  const baseY = terrainH(x, z);
  const h = 5 + (site.v / 2.1) * 11;

  const needle = new THREE.Mesh(needleGeo, new THREE.MeshBasicMaterial({ color: "#181a1f" }));
  needle.position.set(x, baseY, z);
  needle.scale.set(1, 0.001, 1);
  impactScene.add(needle);

  const el = document.createElement("div");
  el.className = "pin-label";
  el.innerHTML =
    `<strong>${site.v} ${site.unit}</strong><span>${site.name}</span>` +
    (site.note ? `<em>${site.note}</em>` : "");
  labelsRoot.appendChild(el);

  pins.push({ needle, el, x, z, baseY, h, delay: i * 0.035 });
}

/* scroll progress + counter */
let impactProgress = 0;
ScrollTrigger.create({
  trigger: ".impact",
  start: "top bottom",
  end: "bottom top",
  scrub: 0.5,
  onUpdate(self) {
    impactProgress = self.progress;
  },
});
const countEl = document.getElementById("impact-count");
const counter = { v: 0 };
ScrollTrigger.create({
  trigger: ".impact",
  start: "top 55%",
  once: true,
  onEnter() {
    gsap.to(counter, {
      v: 10.8,
      duration: 2.2,
      ease: "power2.out",
      onUpdate: () => (countEl.textContent = counter.v.toFixed(1)),
    });
  },
});

function impactResize() {
  const w = impactCanvas.clientWidth || window.innerWidth;
  const h = impactCanvas.clientHeight || window.innerHeight;
  impactRenderer.setSize(w, h, false);
  impactCam.aspect = w / h;
  impactCam.updateProjectionMatrix();
}
window.addEventListener("resize", impactResize);
impactResize();

const _iv = new THREE.Vector3();
function renderImpact(time) {
  if (impactProgress <= 0 || impactProgress >= 1) return;
  const p = impactProgress;

  /* slow pan across the terrain as you scroll */
  impactCam.position.set(-10 + 20 * p, 22 + 10 * p, 56 - 12 * p);
  impactCam.position.y += Math.sin(time * 0.00022) * 0.6;
  impactCam.lookAt(4 * p, -1, -6);

  /* pins rise in with a slight stagger once the section is on screen */
  const inView = Math.min(1, Math.max(0, (p - 0.18) / 0.22));
  const w = impactCanvas.clientWidth || window.innerWidth;
  const hpx = impactCanvas.clientHeight || window.innerHeight;
  for (const pin of pins) {
    const grow = Math.min(1, Math.max(0.001, (inView - pin.delay) * 2.2));
    pin.needle.scale.y = pin.h * grow;

    /* project the pin tip into screen space and place the HTML label */
    _iv.set(pin.x, pin.baseY + pin.h * grow + 0.4, pin.z).project(impactCam);
    const sx = (_iv.x * 0.5 + 0.5) * w;
    const sy = (-_iv.y * 0.5 + 0.5) * hpx;
    const visible = _iv.z < 1 && grow > 0.65 && sx > -80 && sx < w + 80;
    pin.el.style.opacity = visible ? Math.min(1, (grow - 0.65) * 4) : 0;
    if (visible) pin.el.style.transform = `translate(${sx + 8}px, ${sy - 6}px)`;
  }

  impactRenderer.render(impactScene, impactCam);
}

/* ---------- render loop ---------- */
const _p = new THREE.Vector3();
const _t = new THREE.Vector3();
let smooth = 0;

function tick(time) {
  requestAnimationFrame(tick);

  /* extra smoothing on top of scrub */
  smooth += (progress - smooth) * 0.12;

  /* scroll → journey with dwell stops at each system */
  const j = journeyMap(smooth);

  /* step activation follows the journey, so text and view agree */
  let idx = -1;
  if (j > 0.08) idx = Math.min(3, Math.floor(((j - 0.08) / 0.84) * 4));
  steps.forEach((el, i) => el.classList.toggle("active", i === idx));

  const u = Math.min(0.999, Math.max(0.001, j));
  camPos.getPoint(u, _p);
  camTarget.getPoint(u, _t);
  _p.x += Math.sin(time * 0.0002) * 1.1;
  _p.y += Math.sin(time * 0.00027) * 0.5;
  camera.position.copy(_p);
  camera.lookAt(_t);

  /* fans + wind turbines */
  for (const f of fans) f.rotation.y = time * 0.004;
  for (let i = 0; i < turbines.length; i++) turbines[i].rotation.x = time * 0.0011 + i * 1.4;

  /* diffuser cones breathing */
  for (let i = 0; i < diffuserCones.length; i++) {
    const c = diffuserCones[i];
    c.material.opacity = 0.18 + 0.16 * (0.5 + 0.5 * Math.sin(time * 0.0025 + i));
  }

  /* ---- journey line reveal, tied to scroll (with station dwells) ---- */
  const reveal = Math.min(1, Math.max(0, (j - 0.05) / 0.85));
  routeTube.geometry.setDrawRange(0, Math.floor(TUBE_INDEX * reveal));
  routeCore.geometry.setDrawRange(0, Math.floor(CORE_INDEX * reveal));

  /* station labels fade in while the line is docked at each system */
  for (let i = 0; i < stations.length; i++) {
    const near = 1 - Math.min(1, Math.abs(j - stopsJ[i]) / 0.06);
    stations[i].label.material.opacity = near * (0.85 + 0.15 * Math.sin(time * 0.004));
  }

  /* glowing head rides the tip of the line */
  if (reveal > 0.001 && reveal < 0.999) {
    comet.material.opacity = 0.9;
    routeCurve.getPointAt(reveal, _p);
    comet.position.copy(_p);
  } else {
    comet.material.opacity = 0;
  }

  /* energy pulses flow only through the revealed portion */
  for (const pt of particles) {
    pt.t = (pt.t + pt.speed) % 1;
    const visible = reveal > 0.02;
    pt.s.material.opacity = visible ? 0.5 : 0;
    if (visible) {
      routeCurve.getPointAt(pt.t * reveal, _p);
      pt.s.position.copy(_p);
    }
  }

  /* destination room lights up when the line arrives */
  const arrived = Math.min(1, Math.max(0, (reveal - 0.93) / 0.07));
  roomGlow.material.opacity = arrived * (0.13 + 0.05 * Math.sin(time * 0.003));

  renderer.render(scene, camera);
  renderImpact(time);
}
requestAnimationFrame(tick);
