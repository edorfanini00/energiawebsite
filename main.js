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
  accent: "#5b8dff",
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
plaza.position.set(8, 0.03, 24);
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

/* ---------- per-floor HVAC: ducts, VAV boxes, diffusers, desks ---------- */
const diffuserCones = [];
for (let i = 0; i < FLOORS; i++) {
  const ceilY = (i + 1) * FH - 0.55;
  // main ceiling trunk duct (runs along x)
  box(W - 5, 0.7, 0.85, C.duct, -1, ceilY, -1.5, bld);
  // branches toward front with VAV box + diffusers
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
  // sparse furniture
  for (const fx of [-9, -4.5, 1, 5.5, 9]) {
    box(2.2, 0.9, 1.1, C.unit, fx + (i % 2) * 1.2, i * FH + 0.95, 3.8 - (i % 3), bld);
  }
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
rtu(6.5, 2.0);

/* cooling tower */
const ct = new THREE.Group();
ct.position.set(8.5, ROOF_Y + 0.5, -3.5);
box(4.0, 3.0, 4.0, C.unit, 0, 1.5, 0, ct);
for (let k = 0; k < 5; k++) box(4.1, 0.1, 3.6, C.dark, 0, 0.5 + k * 0.45, 0, ct);
cyl(1.6, 1.9, 0.9, C.shell, 0, 3.4, 0, ct);
makeFan(1.25, 0, 3.95, 0, ct);
bld.add(ct);

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

/* chilled-water pipe run (coral, like the red lines in the reference) */
function pipe(points, color, radius = 0.14) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 80, radius, 8),
    new THREE.MeshBasicMaterial({ color })
  );
  scene.add(tube);
  return curve;
}
pipe(
  [
    [21, 0.5, 3.2],
    [21, 0.35, 9],
    [14, 0.35, 12],
    [2, 0.35, 12.5],
    [-6, 0.35, 18],
    [-7, 0.35, 30],
  ],
  "#ff6a5e"
);
pipe(
  [
    [22, 0.5, 3.0],
    [22.4, 0.35, 10],
    [16, 0.35, 13.6],
    [3, 0.35, 14.2],
    [-4.4, 0.35, 19.6],
    [-5.4, 0.35, 31],
  ],
  "#ff8a7e",
  0.11
);
/* pipes from chiller up to cooling tower */
pipe(
  [
    [18.2, 1.6, 0.2],
    [15.5, 6, -2.6],
    [13.4, 12, -3.4],
    [11.2, ROOF_Y + 1.2, -3.5],
  ],
  "#9fb8cf",
  0.16
);

/* ============================================================
   SUPPLY-AIR FLOW — glowing particle stream
   ============================================================ */
const flowCurve = new THREE.CatmullRomCurve3(
  [
    [8.5, ROOF_Y + 4.2, -3.5],   // cooling tower top
    [9.5, ROOF_Y + 1.5, -5.0],   // riser inlet
    [9.5, 10.6, -5.2],           // down the riser
    [6, 10.3, -1.5],             // into floor-3 trunk duct
    [-4, 10.3, -1.5],            // along the duct
    [-8, 9.0, 3.5],              // out the diffuser
    [-8, 2.5, 10],               // descending into plaza
    [-2, 0.7, 16],               // skimming the dotted plaza
    [10, 0.6, 22],
    [22, 0.6, 28],
  ].map((p) => new THREE.Vector3(...p))
);

function glowSprite(size, color, opacity) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.25, color);
  grad.addColorStop(1, "rgba(110,170,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const s = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, opacity, depthWrite: false })
  );
  s.scale.setScalar(size);
  scene.add(s);
  return s;
}

const N_PARTICLES = 90;
const particles = [];
for (let i = 0; i < N_PARTICLES; i++) {
  const s = glowSprite(0.55 + Math.random() * 0.5, "rgba(95,160,255,0.9)", 0.55);
  particles.push({ s, t: i / N_PARTICLES, speed: 0.00045 + Math.random() * 0.0002 });
}
const comet = glowSprite(4.2, "rgba(120,180,255,0.95)", 0.9);
let cometT = 0;

/* ============================================================
   SURROUNDINGS — context buildings, trees, tiny people
   ============================================================ */
const bgBuildings = [
  [-34, 10, -16, 9, 20, 9],
  [-26, 7, -30, 8, 14, 8],
  [30, 6, -22, 10, 12, 10],
  [40, 9, -2, 8, 18, 8],
  [-40, 4, 8, 7, 8, 7],
];
for (const [x, , z, w, h, d] of bgBuildings) {
  box(w, h, d, C.wall, x, h / 2, z);
  box(w * 0.5, 1, d * 0.5, C.dark, x, h + 0.5, z); // rooftop unit silhouette
}
function tree(x, z, s = 1) {
  cyl(0.12 * s, 0.16 * s, 0.9 * s, C.dark, x, 0.45 * s, z);
  const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(0.85 * s, 0), mat("#cdddd2"));
  crown.position.set(x, 1.45 * s, z);
  crown.castShadow = true;
  scene.add(crown);
}
[[-16, 14], [-19, 19], [16, 16, 1.3], [24, 12], [28, 18, 0.8], [-24, 4, 1.2], [-20, -10], [34, 8, 1.1]].forEach(
  ([x, z, s]) => tree(x, z, s || 1)
);
function person(x, z) {
  const g = new THREE.Group();
  cyl(0.14, 0.18, 0.55, C.dark, 0, 0.28, 0, g);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 10), mat(C.dark));
  head.position.y = 0.68;
  head.castShadow = true;
  g.add(head);
  g.position.set(x, 0, z);
  scene.add(g);
}
[[-13, 10], [-10, 12.5], [15, 9], [17.5, 11], [3, 17], [-2, 21]].forEach(([x, z]) => person(x, z));

/* ============================================================
   SCROLL CHOREOGRAPHY
   ============================================================ */
const camPos = new THREE.CatmullRomCurve3(
  [
    [40, 30, 42],     // hero — wide iso view
    [22, 30, 26],     // 01 — over the rooftop plant
    [30, 8, 20],      // 02 — down at the chiller plant
    [26, 13, 26],     // 03 — looking into the cutaway floors
    [16, 6, 38],      // 04 — low over the plaza / air stream
    [48, 32, 50],     // exit — pull way out
  ].map((p) => new THREE.Vector3(...p))
);
const camTarget = new THREE.CatmullRomCurve3(
  [
    [0, 8, 0],
    [2, ROOF_Y + 1, -1],
    [19, 1.5, 1],
    [-2, 9, 0],
    [2, 1, 16],
    [0, 9, 0],
  ].map((p) => new THREE.Vector3(...p))
);

let progress = 0;
const hero = document.querySelector(".hero");
const steps = [...document.querySelectorAll(".step")];

ScrollTrigger.create({
  trigger: ".stage",
  start: "top top",
  end: "bottom bottom",
  scrub: 0.8,
  onUpdate(self) {
    progress = self.progress;

    /* hero fade */
    const h = Math.max(0, 1 - progress / 0.09);
    hero.style.opacity = h;
    hero.style.transform = `translateY(${progress * -160}px)`;

    /* step activation: 4 windows between 8% and 92% */
    let idx = -1;
    if (progress > 0.08) idx = Math.min(3, Math.floor(((progress - 0.08) / 0.84) * 4));
    steps.forEach((el, i) => el.classList.toggle("active", i === idx));
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
  smooth += (progress - smooth) * 0.07;
  const u = Math.min(0.999, Math.max(0.001, smooth));
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

  /* particles along the supply curve */
  for (const pt of particles) {
    pt.t = (pt.t + pt.speed) % 1;
    flowCurve.getPoint(pt.t, _p);
    pt.s.position.copy(_p);
  }
  cometT = (cometT + 0.0011) % 1;
  flowCurve.getPoint(cometT, _p);
  comet.position.copy(_p);

  renderer.render(scene, camera);
}
requestAnimationFrame(tick);
