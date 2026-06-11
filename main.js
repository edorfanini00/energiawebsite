/* ============================================================
   Energia AI — 3D HVAC world (VECTR-style scroll scene)
   ============================================================ */
import * as THREE from "three";

gsap.registerPlugin(ScrollTrigger);

/* ---------- renderer / scene / camera ---------- */
const canvas = document.getElementById("scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const BG = new THREE.Color("#d7e2ec");
const scene = new THREE.Scene();
scene.background = BG;
scene.fog = new THREE.Fog(BG, 70, 160);

const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 400);

/* ---------- lights ---------- */
scene.add(new THREE.HemisphereLight(0xffffff, 0xc3d2e2, 1.7));
scene.add(new THREE.AmbientLight(0xdfe9f4, 0.55));
const sun = new THREE.DirectionalLight(0xffffff, 1.05);
sun.position.set(35, 55, 25);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -55;
sun.shadow.camera.right = 55;
sun.shadow.camera.top = 55;
sun.shadow.camera.bottom = -55;
sun.shadow.bias = -0.0004;
scene.add(sun);

/* ---------- material helpers ---------- */
const MAT = {};
function mat(hex) {
  if (!MAT[hex]) MAT[hex] = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.95, metalness: 0 });
  return MAT[hex];
}
const C = {
  shell: "#eef3f8",
  slab: "#e2eaf2",
  wall: "#dde6ef",
  duct: "#cfdbe7",
  unit: "#e8eef5",
  dark: "#b9c7d6",
  accent: "#22c55e",
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

/* ---------- ground ---------- */
const ground = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), mat("#dae4ee"));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

/* dotted "data" plaza (like the dotted grid in the reference) */
function dotTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const g = c.getContext("2d");
  g.clearRect(0, 0, 512, 512);
  for (let i = 0; i < 16; i++)
    for (let j = 0; j < 16; j++) {
      const r = 5 + 3 * Math.sin(i * 0.8 + j * 0.5);
      g.fillStyle = "rgba(120,170,225,0.55)";
      g.beginPath();
      g.arc(16 + i * 32, 16 + j * 32, Math.max(2.5, r * 0.55), 0, Math.PI * 2);
      g.fill();
    }
  const t = new THREE.CanvasTexture(c);
  return t;
}
const plaza = new THREE.Mesh(
  new THREE.PlaneGeometry(34, 34),
  new THREE.MeshBasicMaterial({ map: dotTexture(), transparent: true, opacity: 0.8, depthWrite: false })
);
plaza.rotation.x = -Math.PI / 2;
plaza.position.set(-12, 0.03, 20);
scene.add(plaza);

/* ============================================================
   MAIN BUILDING — commercial cutaway with HVAC
   ============================================================ */
const bld = new THREE.Group();
scene.add(bld);

const FLOORS = 5;
const FH = 3.6;              // floor height
const W = 24, D = 15;        // footprint
const ROOF_Y = FLOORS * FH;  // 18

/* slabs, back & left walls, columns, core */
for (let i = 0; i <= FLOORS; i++) {
  box(W, 0.5, D, C.slab, 0, i * FH + 0.25, 0, bld);
}
for (let i = 0; i < FLOORS; i++) {
  const y = i * FH + FH / 2 + 0.25;
  box(W, FH, 0.45, C.wall, 0, y, -D / 2 + 0.22, bld);          // back wall
  box(0.45, FH, D, C.wall, -W / 2 + 0.22, y, 0, bld);          // left wall
  // front columns
  for (let cx = -W / 2 + 2; cx <= W / 2 - 2; cx += 5.5) {
    box(0.5, FH, 0.5, C.shell, cx, y, D / 2 - 0.6, bld);
  }
}
/* service core (elevators/stairs) */
box(5, ROOF_Y + 1.2, 4.5, C.shell, -W / 2 + 3, (ROOF_Y + 1.2) / 2, -D / 2 + 2.8, bld);

/* roof parapet */
box(W + 0.6, 1.0, 0.5, C.shell, 0, ROOF_Y + 0.75, D / 2, bld);
box(W + 0.6, 1.0, 0.5, C.shell, 0, ROOF_Y + 0.75, -D / 2, bld);
box(0.5, 1.0, D, C.shell, -W / 2, ROOF_Y + 0.75, 0, bld);
box(0.5, 1.0, D, C.shell, W / 2, ROOF_Y + 0.75, 0, bld);

/* ---------- per-floor HVAC: minimalist — detail only where the journey goes ---------- */
const diffuserCones = [];
const JOURNEY_FLOOR = 3; // the floor the line ends on
for (let i = 0; i < FLOORS; i++) {
  const ceilY = (i + 1) * FH - 0.55;
  // main ceiling trunk duct (runs along x) — kept simple on every floor
  box(W - 5, 0.7, 0.85, C.duct, -1, ceilY, -1.5, bld);
  if (i !== JOURNEY_FLOOR) continue;

  // detailed branches with VAV boxes + diffusers, only on the journey floor
  for (const bx of [-8, -1, 6]) {
    box(0.6, 0.6, 5.5, C.duct, bx, ceilY, 1.2, bld);
    box(1.5, 1.0, 1.6, C.dark, bx, ceilY, -0.2, bld); // VAV box
    // diffuser + air cone
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(0.85, 1.5, 4),
      new THREE.MeshBasicMaterial({ color: 0x6db4ff, transparent: true, opacity: 0.32 })
    );
    cone.position.set(bx, ceilY - 1.0, 3.5);
    cone.rotation.y = Math.PI / 4;
    bld.add(cone);
    diffuserCones.push(cone);
    box(1.1, 0.18, 1.1, C.shell, bx, ceilY - 0.32, 3.5, bld);
  }
  // the destination VAV (bx = -8) gets full detail: damper actuator + reheat coil
  box(0.5, 0.42, 0.5, C.accent, -7.05, ceilY + 0.2, -0.2, bld);  // damper actuator
  box(0.9, 0.7, 0.6, C.dark, -8, ceilY - 0.1, 0.9, bld);          // reheat coil section
  cyl(0.09, 0.09, 1.3, C.dark, -8.75, ceilY - 0.5, 0.9, bld);     // hot-water tap to coil
}

/* ---------- vertical supply riser ---------- */
box(1.4, ROOF_Y, 1.4, C.duct, 9.5, ROOF_Y / 2, -5.2, bld);

/* ============================================================
   ROOFTOP PLANT — RTUs + cooling tower
   ============================================================ */
const fans = [];
function makeFan(r, x, y, z, parent) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const ring = cyl(r, r, 0.22, C.dark, 0, 0, 0, g);
  ring.rotation.x = 0;
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
  box(4.6, 1.9, 2.6, C.unit, 0, 1.0, 0, g);
  box(4.8, 0.25, 2.8, C.dark, 0, 0.12, 0, g);          // curb
  makeFan(0.85, -1.1, 2.05, 0, g);
  makeFan(0.85, 1.1, 2.05, 0, g);
  // louvers
  for (let k = 0; k < 4; k++) box(0.06, 1.2, 2.2, C.dark, 2.05, 1.0, 0 - k * 0, g);
  // supply drop into roof
  box(0.9, 1.0, 0.9, C.duct, -1.6, -0.2, 0.9, g);
  bld.add(g);
  return g;
}
rtu(-6, 1.5);
rtu(0.5, -2.5);

/* cooling tower */
const ct = new THREE.Group();
ct.position.set(-9, ROOF_Y + 0.5, -4);
box(4.0, 3.0, 4.0, C.unit, 0, 1.5, 0, ct);
for (let k = 0; k < 5; k++) box(4.1, 0.1, 3.6, C.dark, 0, 0.5 + k * 0.45, 0, ct);
cyl(1.6, 1.9, 0.9, C.shell, 0, 3.4, 0, ct);
makeFan(1.25, 0, 3.95, 0, ct);
bld.add(ct);

/* ---------- rooftop AHU (air handling unit, next to the riser) ---------- */
const ahu = new THREE.Group();
ahu.position.set(5.2, ROOF_Y + 0.5, -2.6);
box(6.2, 0.25, 3.2, C.dark, 0, 0.12, 0, ahu);                 // curb
box(6.0, 2.2, 3.0, C.unit, 0, 1.35, 0, ahu);                  // casing
box(0.08, 1.8, 2.6, C.dark, -1.0, 1.35, 0, ahu);              // section seam
box(0.08, 1.8, 2.6, C.dark, 1.2, 1.35, 0, ahu);               // section seam
cyl(0.55, 0.55, 0.12, C.dark, -2.2, 1.35, 1.52, ahu).rotation.x = Math.PI / 2; // access port
cyl(0.55, 0.55, 0.12, C.dark, 0.1, 1.35, 1.52, ahu).rotation.x = Math.PI / 2;
makeFan(0.8, 2.2, 2.6, 0, ahu);                               // supply fan
box(1.0, 0.8, 1.0, C.duct, 3.4, 1.0, -1.0, ahu);              // duct to riser
/* outside-air intake hood with louvers */
box(0.9, 1.5, 2.4, C.dark, -3.4, 1.5, 0, ahu);
for (let k = 0; k < 4; k++) box(0.98, 0.07, 2.2, C.shell, -3.4, 1.0 + k * 0.34, 0, ahu);
/* internal sections shown as bands: filter (grey) → cooling coil (green) */
box(0.12, 2.0, 3.06, "#b6c6d6", -0.4, 1.35, 0, ahu);          // filter bank
box(0.12, 2.0, 3.06, "#9fd8bb", 0.55, 1.35, 0, ahu);          // cooling coil
bld.add(ahu);

/* ---------- supply shaft: roof → floor-3 ceiling plenum ---------- */
box(1.2, 4.6, 1.2, C.duct, 2.5, ROOF_Y - 2.2, -5.0, bld);

/* ============================================================
   GROUND-FLOOR MECHANICAL ROOM — boiler
   ============================================================ */
const mech = new THREE.Group();
mech.position.set(6.5, 0, -3.2);
scene.add(mech);
box(5.5, 0.12, 4.5, C.dark, 0, 0.31, 0, mech);                 // mech-room pad
cyl(1.0, 1.0, 2.3, C.unit, 0, 1.45, 0, mech);                  // boiler vessel
const dome = new THREE.Mesh(new THREE.SphereGeometry(1.0, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat(C.unit));
dome.position.set(0, 2.6, 0);
dome.castShadow = true;
mech.add(dome);
box(0.9, 1.1, 0.12, C.dark, 0, 1.2, 1.0, mech);                // burner panel
cyl(0.22, 0.22, 1.0, C.dark, 0, 3.2, 0, mech);                 // flue stack
cyl(0.5, 0.5, 1.4, C.dark, 1.7, 0.75, 1.2, mech).rotation.z = Math.PI / 2; // circ pump
box(0.6, 0.6, 0.6, C.unit, 2.4, 0.75, 1.2, mech);              // pump motor
cyl(0.45, 0.45, 1.6, C.shell, -1.9, 1.1, 0.8, mech);           // expansion tank
/* hot-water supply & return piping toward the riser */
cyl(0.15, 0.15, 2.6, C.dark, 1.55, 2.45, -0.6, mech).rotation.z = Math.PI / 2;
cyl(0.15, 0.15, 1.7, C.dark, 2.8, 1.65, -0.6, mech);
cyl(0.15, 0.15, 2.1, C.dark, 1.25, 2.0, 0.45, mech).rotation.z = Math.PI / 2;
/* isolation valves (green handwheels) + gauge */
cyl(0.28, 0.28, 0.12, C.accent, 1.0, 2.78, -0.6, mech);
cyl(0.28, 0.28, 0.12, C.accent, 1.0, 2.33, 0.45, mech);
cyl(0.18, 0.18, 0.08, "#ffffff", 0.55, 1.95, 1.02, mech).rotation.x = Math.PI / 2; // pressure gauge

/* ============================================================
   GROUND-LEVEL CHILLER PLANT (beside building)
   ============================================================ */
const plant = new THREE.Group();
plant.position.set(19.5, 0, 1);
scene.add(plant);
box(6.5, 0.3, 5.5, C.slab, 0, 0.15, 0, plant);                 // pad
box(5.4, 1.7, 2.3, C.unit, 0, 1.15, -0.8, plant);              // chiller body
cyl(0.65, 0.65, 4.6, C.shell, 0, 2.35, -0.8, plant).rotation.z = Math.PI / 2;  // compressor barrel
cyl(0.45, 0.45, 4.2, C.dark, 0, 2.9, -0.3, plant).rotation.z = Math.PI / 2;
/* pumps */
for (const px of [-1.6, 0.2, 1.9]) {
  cyl(0.42, 0.42, 0.8, C.dark, px, 0.7, 1.6, plant).rotation.z = Math.PI / 2;
  box(0.7, 0.7, 0.7, C.unit, px + 0.75, 0.7, 1.6, plant);
}

/* ============================================================
   THE JOURNEY LINE — street → lobby → boiler → riser → AHU → VAV
   Drawn progressively as the user scrolls.
   ============================================================ */
const routeCurve = new THREE.CatmullRomCurve3(
  [
    [-28, 0.5, 27],              // out on the street
    [-19, 0.5, 23.5],
    [-12, 0.5, 20],              // across the dotted plaza
    [-4, 0.7, 12],
    [-1, 1.0, 7],                // through the front colonnade
    [1.5, 1.2, 2],               // across the ground floor
    [4.5, 1.5, -1.4],
    [6.5, 3.1, -3.2],            // up and over the boiler
    [9.6, 3.9, -4.2],            // join the riser corner
    [10.45, 8, -4.3],            // climbing alongside the riser (visible face)
    [10.45, 14, -4.3],
    [10.1, ROOF_Y + 1.4, -4.5],  // exit at the roof
    [8.6, ROOF_Y + 1.6, -3.8],   // into the AHU
    [5.2, ROOF_Y + 1.9, -2.6],   // through the AHU sections
    [3.2, ROOF_Y + 1.4, -3.8],   // out the supply side
    [3.05, ROOF_Y - 2, -4.25],   // down the supply shaft (visible face)
    [3.0, 13.95, -3.5],          // into the floor-3 plenum
    [-1.5, 13.35, -0.95],        // along the trunk duct (just below it)
    [-7.2, 13.35, -0.95],        // reach the VAV branch
    [-8, 13.3, 0.6],             // through the VAV box
    [-8, 12.7, 3.5],             // out the diffuser
    [-8, 11.6, 5.2],             // into the room
  ].map((p) => new THREE.Vector3(...p)),
  false,
  "catmullrom",
  0.08                            // low tension → crisp, near-orthogonal corners
);

/* green tube + pale core, revealed via drawRange as you scroll */
const TUBE_SEGS = 900;
const routeTube = new THREE.Mesh(
  new THREE.TubeGeometry(routeCurve, TUBE_SEGS, 0.17, 12),
  new THREE.MeshBasicMaterial({ color: "#22c55e" })
);
const routeCore = new THREE.Mesh(
  new THREE.TubeGeometry(routeCurve, TUBE_SEGS, 0.065, 8),
  new THREE.MeshBasicMaterial({ color: "#d9f7e4" })
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
  new THREE.BoxGeometry(8, 2.9, 6.5),
  new THREE.MeshBasicMaterial({ color: 0x5fdc8f, transparent: true, opacity: 0, depthWrite: false })
);
roomGlow.position.set(-8, 12.6, 3.2);
scene.add(roomGlow);

function glowSprite(size, color, opacity) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.25, color);
  grad.addColorStop(1, "rgba(110,235,170,0)");
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
const N_PARTICLES = 26;
const particles = [];
for (let i = 0; i < N_PARTICLES; i++) {
  const s = glowSprite(0.7 + Math.random() * 0.4, "rgba(120,235,170,0.95)", 0.6);
  particles.push({ s, t: Math.random(), speed: 0.0012 + Math.random() * 0.0008 });
}
/* glowing head riding the tip of the line as it draws */
const comet = glowSprite(3.6, "rgba(130,255,180,0.95)", 0.95);

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
  g.fillStyle = "rgba(11,13,26,0.92)";
  g.beginPath();
  g.roundRect((512 - w) / 2, 28, w, 72, 36);
  g.fill();
  g.fillStyle = "#5ee395";
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
  s.scale.set(7.2, 1.8, 1);
  s.position.set(x, y, z);
  s.renderOrder = 10;
  scene.add(s);
  return s;
}

/* world positions where the line reaches each key system */
const stations = [
  { point: new THREE.Vector3(6.5, 3.1, -3.2),            label: makeLabel("BOILER PLANT", 6.5, 6.2, -3.2) },
  { point: new THREE.Vector3(5.2, ROOF_Y + 1.9, -2.6),   label: makeLabel("ROOFTOP AHU", 5.2, ROOF_Y + 5.2, -2.6) },
  { point: new THREE.Vector3(-8, 13.3, 0.6),             label: makeLabel("VAV ZONE — FLOOR 4", -8, 16.6, 0.6) },
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
   SURROUNDINGS — kept minimal: a few context masses, a few trees
   ============================================================ */
const bgBuildings = [
  [-34, 10, -16, 9, 20, 9],
  [30, 6, -22, 10, 12, 10],
  [40, 9, -2, 8, 18, 8],
];
for (const [x, , z, w, h, d] of bgBuildings) {
  box(w, h, d, C.wall, x, h / 2, z);
}
function tree(x, z, s = 1) {
  cyl(0.12 * s, 0.16 * s, 0.9 * s, C.dark, x, 0.45 * s, z);
  const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(0.85 * s, 0), mat("#cdddd2"));
  crown.position.set(x, 1.45 * s, z);
  crown.castShadow = true;
  scene.add(crown);
}
[[-16, 14], [16, 16, 1.3], [24, 12], [-24, 4, 1.2]].forEach(([x, z, s]) => tree(x, z, s || 1));

/* ============================================================
   SCROLL CHOREOGRAPHY
   ============================================================ */
/* camera follows the line: street → boiler → riser/AHU → VAV room → out */
const camPos = new THREE.CatmullRomCurve3(
  [
    [40, 30, 42],      // hero — wide iso view
    [-16, 9, 46],      // 01 — line approaching from the street
    [20, 5, 14],       // 02 — looking into the ground floor, at the boiler
    [32, 19, 16],      // 03 — riser climbing to the rooftop AHU
    [3, 13.2, 24],     // 04 — level with floor 3, looking into the VAV zone
    [48, 32, 50],      // exit — pull way out
  ].map((p) => new THREE.Vector3(...p)),
  false,
  "centripetal"      // no overshoot — keeps the camera outside the building
);
const camTarget = new THREE.CatmullRomCurve3(
  [
    [0, 8, 0],
    [-10, 1, 18],      // the line on the plaza
    [6.5, 1.7, -3.2],  // the boiler
    [10, 12, -4],      // the riser / AHU
    [-6.5, 13.4, 1.5], // the VAV box
    [0, 9, 0],
  ].map((p) => new THREE.Vector3(...p)),
  false,
  "centripetal"
);

let progress = 0;
const hero = document.querySelector(".hero");
const steps = [...document.querySelectorAll(".step")];

ScrollTrigger.create({
  trigger: ".stage",
  start: "top top",
  end: "bottom bottom",
  scrub: 0.5,
  onUpdate(self) {
    progress = self.progress;

    /* hero fade */
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
  /* gentle idle drift so the hero isn't static */
  _p.x += Math.sin(time * 0.0002) * 0.8;
  _p.y += Math.sin(time * 0.00027) * 0.4;
  camera.position.copy(_p);
  camera.lookAt(_t);

  /* fans */
  for (const f of fans) f.rotation.y = time * 0.004;

  /* diffuser cones breathing */
  for (let i = 0; i < diffuserCones.length; i++) {
    const c = diffuserCones[i];
    c.material.opacity = 0.2 + 0.16 * (0.5 + 0.5 * Math.sin(time * 0.0025 + i));
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

  /* glowing head rides the tip of the line
     (getPointAt = arc-length parameterized, matching the tube's drawRange) */
  if (reveal > 0.001 && reveal < 0.999) {
    comet.material.opacity = 0.95;
    routeCurve.getPointAt(reveal, _p);
    comet.position.copy(_p);
  } else {
    comet.material.opacity = 0;
  }

  /* energy pulses flow only through the revealed portion */
  for (const pt of particles) {
    pt.t = (pt.t + pt.speed) % 1;
    const visible = reveal > 0.02;
    pt.s.material.opacity = visible ? 0.55 : 0;
    if (visible) {
      routeCurve.getPointAt(pt.t * reveal, _p);
      pt.s.position.copy(_p);
    }
  }

  /* destination room lights up when the line arrives */
  const arrived = Math.min(1, Math.max(0, (reveal - 0.93) / 0.07));
  roomGlow.material.opacity = arrived * (0.13 + 0.05 * Math.sin(time * 0.003));

  renderer.render(scene, camera);
}
requestAnimationFrame(tick);
