/**
 * 3D cookies and muffins for the Bakery section, built in code (no model files).
 *
 * - Cookie: a lumpy disc with baked cracks, darker edges and chips/raisins/nuts on top,
 *   shown as two cookies, one leaning on the other. New cookies drop onto the plate
 *   with a little bounce and a burst of crumbs.
 * - Muffin: a pleated paper case and a domed crumb top with toppings. New muffins
 *   "bake": the case pops in, then the top rises out of it, then the toppings land.
 *
 * cup3d.ts owns the scene; this module returns a group to add to it and an update().
 */
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

export type BakeLook = { shape: 'cookie' | 'muffin'; tone: string; topping: string; seed: number };

const TOPPING = {
  chocolate: { color: '#2A150A', rough: 0.45, size: [0.05, 0.085], count: [16, 12] },
  raisins: { color: '#3A1D1B', rough: 0.55, size: [0.045, 0.07], count: [12, 10] },
  nuts: { color: '#B07A44', rough: 0.8, size: [0.06, 0.095], count: [9, 9] },
  blueberries: { color: '#2F2A55', rough: 0.3, size: [0.055, 0.075], count: [9, 11] },
  seeds: { color: '#191512', rough: 0.6, size: [0.012, 0.016], count: [110, 160] },
  sugar: { color: '#F6F0E6', rough: 0.25, size: [0.014, 0.022], count: [70, 110] },
} as const;
type ToppingKey = keyof typeof TOPPING;

/* ---------- Small helpers ---------- */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Cheap smooth pseudo-noise in roughly [-1, 1], continuous in space (so seams don't show). */
function noiseFn(seed: number) {
  const r = rng(seed);
  const o = Array.from({ length: 8 }, () => r() * 10);
  return (x: number, y: number, z: number) =>
    (Math.sin(x * 7.1 + o[0]) * Math.sin(z * 6.3 + o[1]) +
      0.5 * Math.sin(x * 13.7 + z * 11.3 + o[2]) +
      0.35 * Math.sin(y * 17.0 + x * 5.3 + o[3]) * Math.sin(z * 9.1 + o[4]) +
      0.2 * Math.sin(x * 29.0 + y * 23.0 + z * 31.0 + o[5])) / 2.05;
}
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const V2 = (p: number[]) => new THREE.Vector2(p[0], p[1]);
const smooth = (pts: number[][], n: number) => new THREE.SplineCurve(pts.map(V2)).getPoints(n);

/** A lathe with its UV seam welded, so we can displace it without cracks. */
function weldedLathe(profile: number[][], points: number, segments: number) {
  let g: THREE.BufferGeometry = new THREE.LatheGeometry(smooth(profile, points), segments);
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  g = mergeVertices(g, 1e-5);
  return g;
}

/** An irregular little lump (chip, nut, raisin). */
function lumpGeo(seed: number, detail = 1) {
  const g = new THREE.IcosahedronGeometry(1, detail);
  const n = noiseFn(seed);
  const p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    v.multiplyScalar(1 + 0.28 * n(v.x * 0.6, v.y * 0.6, v.z * 0.6));
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

/* ---------- Cookie ---------- */
const COOKIE_R = 0.82;
const cookieTop = (r: number) => 0.205 - 0.06 * Math.pow(clamp01(r / 0.62), 2);

function buildCookie(look: BakeLook, seed: number) {
  const n = noiseFn(seed);
  const r = rng(seed * 7 + 3);
  const g = weldedLathe(
    [[0, 0], [0.6, 0], [0.72, 0.012], [0.79, 0.04], [0.825, 0.085], [0.81, 0.13], [0.75, 0.165], [0.58, 0.19], [0.32, 0.203], [0, 0.207]],
    48,
    120,
  );

  // A few cracks across the top: [x, z, dirX, dirZ, length]
  const cracks = Array.from({ length: 4 }, () => {
    const a = r() * Math.PI * 2, d = 0.15 + r() * 0.35;
    const da = a + Math.PI / 2 + (r() - 0.5) * 0.9;
    return [Math.cos(a) * d, Math.sin(a) * d, Math.cos(da), Math.sin(da), 0.18 + r() * 0.25];
  });
  const crackAt = (x: number, z: number) => {
    let best = 0;
    for (const [cx, cz, dx, dz, len] of cracks) {
      const t = Math.max(-len, Math.min(len, (x - cx) * dx + (z - cz) * dz));
      const px = cx + dx * t - x, pz = cz + dz * t - z;
      const d = Math.hypot(px, pz);
      const width = 0.028 * (1 - Math.abs(t) / len);
      if (d < width) best = Math.max(best, 1 - d / width);
    }
    return best;
  };

  const base = new THREE.Color(look.tone);
  const colors: number[] = [];
  const p = g.attributes.position, v = new THREE.Vector3(), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const a = Math.atan2(v.z, v.x), rad = Math.hypot(v.x, v.z);
    const wob = 1 + 0.03 * Math.sin(a * 5 + seed) + 0.018 * Math.sin(a * 9 + seed * 2) + 0.012 * n(v.x * 3, 0, v.z * 3);
    v.x *= wob; v.z *= wob;
    const top = clamp01((v.y - 0.06) / 0.1);
    const nz = n(v.x * 2.2, v.y, v.z * 2.2);
    let crack = 0;
    if (top > 0) {
      v.y += top * (0.016 * nz + 0.006 * n(v.x * 9, 0, v.z * 9));
      crack = crackAt(v.x, v.z) * top;
      v.y -= crack * 0.03;
    }
    p.setXYZ(i, v.x, v.y, v.z);
    // Baked look: darker edges and underside, mottled top, pale dough inside the cracks.
    const edge = clamp01((rad - 0.55) / 0.3);
    let k = 0.74 + 0.1 * nz - 0.2 * edge - 0.16 * (1 - top);
    k += crack * 0.3;
    c.copy(base).multiplyScalar(Math.max(0.35, k));
    colors.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return g;
}

/* ---------- Muffin ---------- */
const CASE_TOP = 0.6;
const crownTop = (r: number) => 1.12 - 0.38 * Math.pow(clamp01(r / 0.78), 2.3);

function buildCase(seed: number) {
  const g = weldedLathe([[0, 0.002], [0.5, 0.002], [0.505, 0.01], [0.66, CASE_TOP], [0.672, CASE_TOP + 0.01]], 24, 112);
  const p = g.attributes.position, v = new THREE.Vector3();
  const colors: number[] = [];
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const a = Math.atan2(v.z, v.x);
    const f = (((a / (Math.PI * 2)) * 30) % 1 + 1) % 1; // pleat phase
    const tri = Math.abs(f - 0.5) * 2;
    const k = v.y > 0.012 ? 1 + 0.045 * tri : 1;
    v.x *= k; v.z *= k;
    p.setXYZ(i, v.x, v.y, v.z);
    const shade = 0.82 + 0.18 * tri + 0.05 * Math.sin(seed + a * 3);
    colors.push(shade, shade, shade);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return g;
}

function buildCrown(look: BakeLook, seed: number) {
  const n = noiseFn(seed);
  const g = weldedLathe(
    [[0, 0.46], [0.6, 0.5], [0.66, 0.6], [0.75, 0.655], [0.8, 0.71], [0.785, 0.79], [0.7, 0.9], [0.5, 1.02], [0.26, 1.1], [0, 1.12]],
    56,
    120,
  );
  const base = new THREE.Color(look.tone);
  const colors: number[] = [];
  const p = g.attributes.position, v = new THREE.Vector3(), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const a = Math.atan2(v.z, v.x);
    const exposed = clamp01((v.y - 0.62) / 0.08); // above the case
    const big = n(v.x * 2.4, v.y * 2.4, v.z * 2.4), fine = n(v.x * 8, v.y * 8, v.z * 8);
    const d = exposed * (0.04 * big + 0.014 * fine);
    v.x *= 1 + d; v.z *= 1 + d;
    v.y += exposed * (d * 0.7 + 0.02 * Math.sin(a * 2 + seed));
    p.setXYZ(i, v.x, v.y, v.z);
    // Golden-brown top, paler where it rose out of the case, crumb texture from the noise.
    const height = clamp01((v.y - 0.66) / 0.46);
    const k = 0.88 - 0.28 * height + 0.09 * big + 0.05 * fine - 0.22 * (1 - exposed);
    c.copy(base).multiplyScalar(Math.max(0.35, k));
    colors.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return g;
}

/* ---------- Toppings ---------- */
function addToppings(target: THREE.Group, look: BakeLook, seed: number, heightAt: (r: number) => number, maxR: number) {
  const key = (look.topping in TOPPING ? look.topping : 'none') as ToppingKey | 'none';
  if (key === 'none') return [] as THREE.Object3D[];
  const t = TOPPING[key];
  const r = rng(seed * 13 + 5);
  const isTiny = key === 'seeds' || key === 'sugar';
  const mat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(t.color), roughness: t.rough, clearcoat: key === 'blueberries' || key === 'chocolate' ? 0.4 : 0 });
  const geos = isTiny ? [new THREE.SphereGeometry(1, 6, 4)] : key === 'blueberries' ? [new THREE.SphereGeometry(1, 20, 14)] : [0, 1, 2].map((i) => lumpGeo(seed + i * 31, 1));
  const count = look.shape === 'cookie' ? t.count[0] : t.count[1];
  const items: THREE.Object3D[] = [];
  for (let i = 0; i < count; i++) {
    const rr = Math.sqrt(r()) * maxR, a = r() * Math.PI * 2;
    const size = t.size[0] + r() * (t.size[1] - t.size[0]);
    const m = new THREE.Mesh(geos[i % geos.length], mat);
    const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
    m.position.set(x, heightAt(rr) - size * (isTiny ? 0.2 : 0.35), z);
    m.rotation.set(r() * 6, r() * 6, r() * 6);
    const flat = key === 'raisins' ? 0.55 : key === 'seeds' ? 0.6 : key === 'blueberries' ? 0.92 : 0.75;
    m.scale.set(size, size * flat, size * (key === 'seeds' ? 1.5 : 1));
    m.userData.size = m.scale.clone();
    m.castShadow = !isTiny;
    target.add(m);
    items.push(m);
  }
  return items;
}

/* ---------- Public API ---------- */
export function createBakery(opts: { looks: Record<string, BakeLook>; start: string | null; plateMat: THREE.Material; reduce: boolean }) {
  const { looks, plateMat, reduce } = opts;
  const group = new THREE.Group();

  // A plate (same family as the saucer, a little wider and flatter).
  const plate = new THREE.Mesh(
    new THREE.LatheGeometry(smooth([[0, 0], [0.7, 0], [0.8, 0.015], [0.83, 0.04], [0.84, 0.06], [1.2, 0.075], [1.48, 0.15], [1.55, 0.185], [1.54, 0.2], [1.5, 0.198], [1.25, 0.13], [0.8, 0.1], [0, 0.1]], 110), 96),
    plateMat,
  );
  plate.castShadow = true; plate.receiveShadow = true;
  group.add(plate);
  const PLATE_Y = 0.1;

  const doughMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, envMapIntensity: 0.45 });
  const crownMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, envMapIntensity: 0.45 });
  // The studio lights are tuned for glossy white ceramic; baked goods need less light to look golden, not raw.
  doughMat.color.setRGB(0.58, 0.55, 0.52);
  crownMat.color.setRGB(0.6, 0.57, 0.54);
  const caseMat = new THREE.MeshStandardMaterial({ vertexColors: true, color: new THREE.Color('#E0913F'), roughness: 0.7, side: THREE.DoubleSide });

  // Crumbs that burst out when a cookie lands.
  const crumbGeo = lumpGeo(99, 0);
  const crumbs = Array.from({ length: 16 }, () => {
    const m = new THREE.Mesh(crumbGeo, new THREE.MeshStandardMaterial({ roughness: 0.85 }));
    m.visible = false;
    group.add(m);
    return { m, v: new THREE.Vector3(), life: 0, size: 0 };
  });
  function burst(color: THREE.Color, at: THREE.Vector3) {
    if (reduce) return;
    crumbs.forEach((c) => {
      const a = Math.random() * Math.PI * 2, sp = 0.6 + Math.random() * 0.9;
      c.m.position.set(at.x + Math.cos(a) * 0.5, at.y + 0.05, at.z + Math.sin(a) * 0.5);
      c.v.set(Math.cos(a) * sp, 0.9 + Math.random() * 0.9, Math.sin(a) * sp);
      c.size = 0.025 + Math.random() * 0.03;
      c.life = 1;
      c.m.visible = true;
      (c.m.material as THREE.MeshStandardMaterial).color.copy(color).multiplyScalar(0.75 + Math.random() * 0.25);
      c.m.rotation.set(Math.random() * 6, Math.random() * 6, 0);
    });
  }

  type Built = {
    root: THREE.Group;
    look: BakeLook;
    parts: { obj: THREE.Object3D; restY: number; delay: number }[]; // things that drop / rise
    toppings: THREE.Object3D[];
    crown?: THREE.Mesh;
    caseMesh?: THREE.Mesh;
    landed: boolean[];
  };

  function build(look: BakeLook): Built {
    const root = new THREE.Group();
    root.position.y = PLATE_Y;
    group.add(root);
    const b: Built = { root, look, parts: [], toppings: [], landed: [] };
    if (look.shape === 'cookie') {
      // Two cookies: one flat, one leaning against it so you can see the top.
      const specs = [
        { seed: look.seed, pos: [0.12, 0, 0.1], rot: [0, 0.3, 0], delay: 0 },
        { seed: look.seed + 17, pos: [-0.16, 0.2, -0.14], rot: [0.32, 1.4, -0.12], delay: 0.12 },
      ];
      for (const s of specs) {
        const holder = new THREE.Group();
        holder.position.set(s.pos[0], s.pos[1], s.pos[2]);
        holder.rotation.set(s.rot[0], s.rot[1], s.rot[2]);
        const mesh = new THREE.Mesh(buildCookie(look, s.seed), doughMat);
        mesh.castShadow = true; mesh.receiveShadow = true;
        holder.add(mesh);
        b.toppings.push(...addToppings(holder, look, s.seed, cookieTop, 0.6));
        root.add(holder);
        b.parts.push({ obj: holder, restY: s.pos[1], delay: s.delay });
        b.landed.push(false);
      }
      holderScale(b, 1.08);
    } else {
      const caseMesh = new THREE.Mesh(buildCase(look.seed), caseMat);
      caseMesh.castShadow = true;
      const crown = new THREE.Mesh(buildCrown(look, look.seed), crownMat);
      crown.castShadow = true; crown.receiveShadow = true;
      // The crown is pivoted at the case mouth (y = 0.5), so scaling it up looks like it rising.
      const top = new THREE.Group();
      top.position.y = 0.5;
      const pivot = new THREE.Group();
      pivot.position.y = -0.5;
      pivot.add(crown);
      b.toppings.push(...addToppings(pivot, look, look.seed, crownTop, 0.62));
      top.add(pivot);
      root.add(caseMesh, top);
      b.crown = crown;
      b.caseMesh = caseMesh;
      b.parts.push({ obj: caseMesh, restY: 0, delay: 0 }, { obj: top, restY: 0.5, delay: 0.15 });
      b.landed.push(false, false);
    }
    return b;
  }
  function holderScale(b: Built, s: number) { b.root.scale.setScalar(s); }

  function dispose(b: Built) {
    group.remove(b.root);
    b.root.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        if (o.geometry !== crumbGeo) o.geometry.dispose();
        if (o.material !== doughMat && o.material !== crownMat && o.material !== caseMat) (o.material as THREE.Material).dispose();
      }
    });
  }

  const startId = (opts.start && looks[opts.start] ? opts.start : Object.keys(looks)[0]) ?? null;
  let current: Built | null = startId ? build(looks[startId]) : null;
  let currentId = startId;
  let outgoing: Built | null = null;
  let anim = 1; // 0 → 1 progress of the "arrive" animation for `current`
  let outT = 1; // 0 → 1 progress of the "leave" animation for `outgoing`

  const easeOutBack = (t: number) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
  const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

  /** Pose `current` at arrival progress t (0 = not yet there, 1 = settled). */
  function poseArrival(b: Built, t: number) {
    if (b.look.shape === 'cookie') {
      b.parts.forEach((part, i) => {
        const lt = clamp01((t - part.delay) / 0.62);
        // Fall from above (accelerating), then a small damped bounce with squash.
        const fall = lt < 0.6 ? 1 - Math.pow(lt / 0.6, 2) : 0;
        const bt = clamp01((lt - 0.6) / 0.4);
        const bounce = lt >= 0.6 ? Math.abs(Math.sin(bt * Math.PI * 2)) * 0.09 * (1 - bt) : 0;
        part.obj.position.y = part.restY + fall * 2.4 + bounce;
        const squash = lt >= 0.6 ? 1 - 0.16 * Math.sin(bt * Math.PI) * (1 - bt) : 1;
        part.obj.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));
        part.obj.visible = lt > 0;
        if (lt >= 0.6 && !b.landed[i]) {
          b.landed[i] = true;
          const world = new THREE.Vector3();
          part.obj.getWorldPosition(world);
          burst(new THREE.Color(b.look.tone), group.worldToLocal(world.clone()));
        }
      });
      b.toppings.forEach((m) => m.scale.copy(m.userData.size as THREE.Vector3));
    } else {
      // Case pops in, then the crown rises out of it, then the toppings land.
      const ct = clamp01(t / 0.25);
      b.caseMesh!.scale.setScalar(Math.max(0.0001, easeOutBack(ct)));
      b.caseMesh!.visible = t > 0;
      const rt = clamp01((t - 0.2) / 0.6);
      const top = b.parts[1].obj;
      top.visible = rt > 0;
      // Batter sits in the case, then domes up and spreads over the rim.
      const rise = 0.06 + 0.94 * easeOutBack(rt);
      const spread = 0.78 + 0.22 * easeOutCubic(clamp01((rt - 0.25) / 0.75));
      top.scale.set(spread, Math.max(0.0001, rise), spread);
      const tt = clamp01((t - 0.78) / 0.22);
      b.toppings.forEach((m, i) => {
        const lt = clamp01(tt * 1.6 - (i % 7) * 0.08);
        m.scale.copy(m.userData.size as THREE.Vector3).multiplyScalar(Math.max(0.0001, easeOutBack(lt)));
      });
    }
  }

  function select(id: string) {
    const look = looks[id];
    if (!look || id === currentId) return;
    currentId = id;
    if (outgoing) dispose(outgoing);
    outgoing = current;
    outT = reduce ? 1 : 0;
    if (reduce && outgoing) { dispose(outgoing); outgoing = null; }
    current = build(look);
    anim = reduce ? 1 : 0;
    poseArrival(current, anim);
  }

  /** Replay the arrival (used when scrolling into the Bakery section). */
  function intro() {
    if (!current || reduce) return;
    anim = 0;
    current.landed = current.landed.map(() => false);
    poseArrival(current, 0);
  }

  function applyTheme(caseColor: string) {
    caseMat.color.set(caseColor);
  }

  /** Where steam should rise from, and how much (warm muffins steam a little). */
  function steam() {
    if (!current) return { top: 0.4, amount: 0 };
    return current.look.shape === 'muffin' ? { top: 1.05 + PLATE_Y, amount: 0.55 * clamp01((anim - 0.6) / 0.4) } : { top: 0.3, amount: 0 };
  }

  function update(dt: number, active: number) {
    // Arrival waits until the bakery is mostly in view, so you actually see it.
    if (current && anim < 1 && active > 0.6) {
      anim = Math.min(1, anim + dt / (current.look.shape === 'cookie' ? 1.1 : 1.4));
      poseArrival(current, anim);
    }
    if (outgoing) {
      outT = Math.min(1, outT + dt / 0.35);
      const e = outT * outT;
      outgoing.root.scale.setScalar(Math.max(0.0001, (1 - e) * (outgoing.look.shape === 'cookie' ? 1.08 : 1)));
      outgoing.root.position.y = PLATE_Y + e * 0.5;
      outgoing.root.rotation.y += dt * 6;
      if (outT >= 1) { dispose(outgoing); outgoing = null; }
    }
    // Crumbs: simple gravity, bounce on the plate, then shrink away.
    for (const c of crumbs) {
      if (c.life <= 0) continue;
      c.life -= dt / 0.9;
      c.v.y -= 6 * dt;
      c.m.position.addScaledVector(c.v, dt);
      if (c.m.position.y < PLATE_Y + 0.02) { c.m.position.y = PLATE_Y + 0.02; c.v.y *= -0.35; c.v.x *= 0.6; c.v.z *= 0.6; }
      c.m.scale.setScalar(Math.max(0.0001, c.size * Math.min(1, c.life * 2.5)));
      c.m.rotation.x += dt * 4;
      if (c.life <= 0) c.m.visible = false;
    }
  }

  return { group, select, intro, update, applyTheme, steam, get currentId() { return currentId; } };
}
