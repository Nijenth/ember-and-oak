/**
 * The 3D cup. One fixed WebGL canvas floats above the page and docks into the
 * empty "spots" in each section as you scroll (#spotHero → #spotStory →
 * #cupWindow → #spotBakery → #spotVisit). Loaded lazily by site.ts after the page is idle.
 * In the Bakery section the cup hands over to a 3D cookie or muffin (see bake3d.ts).
 *
 * Tuning: CUP_SIZE below changes how much of each spot the cup fills.
 */
import * as THREE from 'three';
import { THEMES, type ThemeKey } from '../data/themes';
import { createBakery, type BakeLook } from './bake3d';

type Look = { cup: 'mug' | 'demi' | 'glass'; liquid: string; art: string; fill: number };

const CUP_SIZE = 0.6; // 1 = fill each spot; lower = smaller cup

export function startCup({ looks, start, bakes = {}, bakeStart = null }: { looks: Record<string, Look>; start: string | null; bakes?: Record<string, BakeLook>; bakeStart?: string | null }) {
  const canvas = document.querySelector<HTMLCanvasElement>('#stage');
  const firstLook = (start && looks[start]) || Object.values(looks)[0];
  if (!canvas || !firstLook) return;

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const skin = () => (document.documentElement.dataset.skin as ThemeKey) in THEMES ? (document.documentElement.dataset.skin as ThemeKey) : 'espresso';

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, 10);

  // Hex colours are sRGB; THREE.Color converts them to the linear working space for us.
  const col = (hex: string) => new THREE.Color(hex);
  const V2 = (p: number[]) => new THREE.Vector2(p[0], p[1]);
  const smooth = (pts: number[][], n: number) => new THREE.SplineCurve(pts.map(V2)).getPoints(n);
  const srgbTex = (c: HTMLCanvasElement) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
  const hexLerp = (a: string, b: string, t: number) => {
    const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
    const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
    return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * t)).join(',')})`;
  };

  /* Studio environment, generated in code: a dim room with softboxes, baked into reflections. */
  {
    const env = new THREE.Scene();
    env.add(new THREE.Mesh(new THREE.BoxGeometry(14, 9, 14), new THREE.MeshBasicMaterial({ color: col('#2b2622'), side: THREE.BackSide })));
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.MeshBasicMaterial({ color: col('#15110e') }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -4.4; env.add(floor);
    const panel = (w: number, h: number, hex: string, k: number, pos: [number, number, number]) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: col(hex).multiplyScalar(k), side: THREE.DoubleSide }));
      m.position.set(...pos); m.lookAt(0, 0, 0); env.add(m);
    };
    panel(7, 2.6, '#ffffff', 7, [0, 4.3, 1.5]);     // overhead softbox
    panel(2.2, 5, '#fff1de', 4.5, [-6.8, 1, 2.5]);  // warm strip, left
    panel(2.2, 5, '#e3eeff', 2.2, [6.8, 0.6, -1]);  // cool strip, right
    panel(5, 1.4, '#ffffff', 2.6, [0, 0.8, 6.8]);   // front fill (window glint)
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(env, 0.04).texture;
    pm.dispose();
  }

  // Physically based light units: these are the old (legacy) intensities × π.
  scene.add(new THREE.HemisphereLight(0xfff4e6, 0x1a120c, 0.25 * Math.PI));
  const key = new THREE.DirectionalLight(0xffffff, 1.5 * Math.PI);
  key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
  scene.add(key, key.target);
  const rim = new THREE.PointLight(0xe0913f, 0.9 * Math.PI, 40, 1); rim.position.set(-5, 3, -4); scene.add(rim);

  const rig = new THREE.Group(); scene.add(rig);       // positioned + scaled by scroll
  const inner = new THREE.Group(); rig.add(inner);     // tilt + spin
  const model = new THREE.Group(); inner.add(model); model.position.y = -0.64;
  const cupGroup = new THREE.Group(); model.add(cupGroup); // everything that belongs to the drink

  // Glazed ceramic
  const glaze = () => new THREE.MeshPhysicalMaterial({ color: col('#F2EAE0'), roughness: 0.32, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06, side: THREE.DoubleSide });
  const cupMat = glaze(), saucerMat = glaze();

  // Mug: one smooth profile (foot ring, body, rounded lip, inner wall)
  const mug = new THREE.Group(); cupGroup.add(mug); mug.position.y = 0.095;
  const mugProfile = smooth([[0, 0], [0.4, 0], [0.5, 0.012], [0.55, 0.05], [0.6, 0.2], [0.68, 0.5], [0.76, 0.85], [0.81, 1.08], [0.83, 1.16], [0.818, 1.19], [0.79, 1.192], [0.766, 1.16], [0.738, 1.0], [0.68, 0.7], [0.6, 0.38], [0.5, 0.17], [0.32, 0.115], [0, 0.105]], 140);
  const mugMesh = new THREE.Mesh(new THREE.LatheGeometry(mugProfile, 96), cupMat); mugMesh.castShadow = true; mug.add(mugMesh);
  const handleCurve = new THREE.CatmullRomCurve3([[0.7, 1.0], [0.98, 1.0], [1.13, 0.78], [1.06, 0.5], [0.86, 0.38], [0.64, 0.36]].map((p) => new THREE.Vector3(p[0], p[1], 0)));
  const handle = new THREE.Mesh(new THREE.TubeGeometry(handleCurve, 64, 0.058, 18, false), cupMat); handle.castShadow = true; handle.scale.z = 0.8; mug.add(handle);
  const innerR = (y: number) => {
    const pts = [[0.115, 0.32], [0.17, 0.5], [0.38, 0.6], [0.7, 0.68], [1.0, 0.738], [1.16, 0.766]];
    for (let i = 0; i < pts.length - 1; i++) { const [y0, r0] = pts[i], [y1, r1] = pts[i + 1]; if (y <= y1) return r0 + (r1 - r0) * Math.max(0, (y - y0) / (y1 - y0)); }
    return 0.766;
  };

  // Liquid surface with latte art
  const artCanvas = document.createElement('canvas'); artCanvas.width = artCanvas.height = 512;
  const artTex = srgbTex(artCanvas); artTex.anisotropy = 4;
  const liquidMat = new THREE.MeshPhysicalMaterial({ map: artTex, roughness: 0.42, clearcoat: 0.45, clearcoatRoughness: 0.18 });
  const surface = new THREE.Mesh(new THREE.CircleGeometry(1, 72), liquidMat); surface.rotation.x = -Math.PI / 2; surface.receiveShadow = true; mug.add(surface);

  // Saucer with foot ring and a shallow well
  const saucer = new THREE.Mesh(new THREE.LatheGeometry(smooth([[0, 0], [0.66, 0], [0.76, 0.015], [0.79, 0.04], [0.8, 0.06], [1.05, 0.08], [1.28, 0.17], [1.35, 0.21], [1.34, 0.228], [1.3, 0.226], [1.1, 0.155], [0.74, 0.11], [0.56, 0.097], [0, 0.1]], 110), 96), saucerMat);
  saucer.castShadow = true; saucer.receiveShadow = true; cupGroup.add(saucer);

  // Glass for cold drinks
  const glass = new THREE.Group(); glass.visible = false; cupGroup.add(glass);
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.03, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02, transparent: true, opacity: 0.22, envMapIntensity: 2.4, side: THREE.DoubleSide, depthWrite: false });
  const glassMesh = new THREE.Mesh(new THREE.LatheGeometry(smooth([[0, 0], [0.46, 0], [0.54, 0.02], [0.57, 0.08], [0.6, 0.6], [0.635, 1.25], [0.65, 1.6], [0.645, 1.63], [0.625, 1.63], [0.61, 1.3], [0.575, 0.6], [0.54, 0.17], [0.4, 0.14], [0, 0.14]], 120), 96), glassMat);
  glassMesh.renderOrder = 3; glass.add(glassMesh);
  const coldMat = new THREE.MeshPhysicalMaterial({ color: col('#2E170B'), roughness: 0.12, clearcoat: 0.6, transparent: true, opacity: 0.93 });
  const coldBody = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.555, 1, 64, 1, true), coldMat); glass.add(coldBody);
  const coldTop = new THREE.Mesh(new THREE.CircleGeometry(1, 64), liquidMat); coldTop.rotation.x = -Math.PI / 2; glass.add(coldTop);
  const iceMat = new THREE.MeshPhysicalMaterial({ color: 0xf2fbff, roughness: 0.06, clearcoat: 1, transparent: true, opacity: 0.5, envMapIntensity: 2 });
  const iceGeo = new THREE.BoxGeometry(0.32, 0.32, 0.32, 3, 3, 3);
  {
    const p = iceGeo.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const n = v.clone().normalize().multiplyScalar(0.2); v.lerp(n, 0.22); p.setXYZ(i, v.x, v.y, v.z); }
    iceGeo.computeVertexNormals();
  }
  const ice = [0, 1, 2].map(() => { const m = new THREE.Mesh(iceGeo, iceMat); glass.add(m); return m; });

  // Pour stream shown while a drink refills
  const pourMat = new THREE.MeshPhysicalMaterial({ color: col('#6B3A22'), roughness: 0.15, clearcoat: 0.8 });
  const pour = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.055, 1, 20, 1, true), pourMat); pour.visible = false; cupGroup.add(pour);

  // Ground that only shows shadows, plus a soft contact shadow
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(7, 7), new THREE.ShadowMaterial({ opacity: 0.4 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.002; ground.receiveShadow = true; model.add(ground);
  const shc = document.createElement('canvas'); shc.width = shc.height = 128;
  {
    const shx = shc.getContext('2d')!; const shg = shx.createRadialGradient(64, 64, 0, 64, 64, 64);
    shg.addColorStop(0, 'rgba(0,0,0,0.5)'); shg.addColorStop(0.55, 'rgba(0,0,0,0.18)'); shg.addColorStop(1, 'rgba(0,0,0,0)'); shx.fillStyle = shg; shx.fillRect(0, 0, 128, 128);
  }
  const contact = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), new THREE.MeshBasicMaterial({ map: srgbTex(shc), transparent: true, depthWrite: false, opacity: 0.6 }));
  contact.rotation.x = -Math.PI / 2; contact.position.y = 0.001; model.add(contact);

  // Roasted beans: oily sheen and an S-shaped crease
  const beanMat = new THREE.MeshPhysicalMaterial({ color: col('#3B2416'), roughness: 0.4, clearcoat: 0.55, clearcoatRoughness: 0.32 });
  const creaseMat = new THREE.MeshStandardMaterial({ color: col('#120804'), roughness: 0.9 });
  const beanGeo = new THREE.SphereGeometry(0.5, 32, 20);
  const creaseGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([[-0.4, 0.0, 0.25], [-0.15, 0.05, 0.272], [0.12, -0.05, 0.272], [0.4, 0.0, 0.25]].map((p) => new THREE.Vector3(p[0], p[1], p[2]))), 24, 0.024, 8, false);
  const beansGroup = new THREE.Group(); rig.add(beansGroup);
  const beans = Array.from({ length: 12 }, (_, i) => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(beanGeo, beanMat); body.scale.set(1, 0.7, 0.55); g.add(body);
    g.add(new THREE.Mesh(creaseGeo, creaseMat));
    beansGroup.add(g);
    return { g, a: (i / 12) * Math.PI * 2 + Math.random() * 0.3, r: 1.5 + Math.random() * 0.6, y: -0.5 + Math.random() * 1.9, sp: 0.06 + Math.random() * 0.06, ph: Math.random() * 6, rs: new THREE.Vector3(Math.random(), Math.random(), Math.random()).multiplyScalar(1.2) };
  });

  // Steam: soft curling wisps
  const wc = document.createElement('canvas'); wc.width = 128; wc.height = 256;
  {
    const wx = wc.getContext('2d')!; wx.lineCap = 'round';
    for (let k = 0; k < 3; k++) {
      const x0 = 44 + k * 20;
      const path = () => { wx.beginPath(); wx.moveTo(x0, 250); wx.bezierCurveTo(x0 - 40, 190, x0 + 46, 130, x0 - 6, 70); wx.bezierCurveTo(x0 - 30, 40, x0 + 18, 18, x0 + 4, 4); };
      [34, 24, 16, 10, 6].forEach((w) => { wx.strokeStyle = 'rgba(255,255,255,0.07)'; wx.lineWidth = w; path(); wx.stroke(); });
    }
    // Fade the wisps out towards the top and bottom so the sprite edges never show.
    const fade = wx.createLinearGradient(0, 0, 0, 256);
    fade.addColorStop(0, 'rgba(0,0,0,0)'); fade.addColorStop(0.25, 'rgba(0,0,0,1)'); fade.addColorStop(0.8, 'rgba(0,0,0,1)'); fade.addColorStop(1, 'rgba(0,0,0,0)');
    wx.globalCompositeOperation = 'destination-in'; wx.fillStyle = fade; wx.fillRect(0, 0, 128, 256);
    // Same horizontally, for the wide strokes near the sides.
    const side = wx.createLinearGradient(0, 0, 128, 0);
    side.addColorStop(0, 'rgba(0,0,0,0)'); side.addColorStop(0.2, 'rgba(0,0,0,1)'); side.addColorStop(0.8, 'rgba(0,0,0,1)'); side.addColorStop(1, 'rgba(0,0,0,0)');
    wx.fillStyle = side; wx.fillRect(0, 0, 128, 256);
  }
  const steamTex = srgbTex(wc);
  const steamGroup = new THREE.Group(); rig.add(steamGroup);
  const steam = Array.from({ length: 14 }, () => {
    const m = new THREE.SpriteMaterial({ map: steamTex, transparent: true, depthWrite: false, opacity: 0, rotation: (Math.random() - 0.5) * 0.4 });
    const s = new THREE.Sprite(m); steamGroup.add(s);
    return { s, m, life: Math.random(), dur: 3.2 + Math.random() * 2, x0: (Math.random() - 0.5) * 0.5, ph: Math.random() * 6, flip: Math.random() < 0.5 ? -1 : 1 };
  });

  /* Latte art drawn on a 2D canvas, mapped onto the liquid surface. */
  function drawArt(d: Look) {
    const c = artCanvas.getContext('2d', { willReadFrequently: true })!, W = 512, C = 256;
    c.clearRect(0, 0, W, W);
    const base = (inner: string, outer: string) => { const g = c.createRadialGradient(C, C, 10, C, C, 256); g.addColorStop(0, inner); g.addColorStop(0.75, outer); g.addColorStop(1, outer); c.fillStyle = g; c.fillRect(0, 0, W, W); };
    const milk = '#F6ECDF';
    const heart = (cx: number, cy: number, s: number, fill: string) => { c.fillStyle = fill; c.beginPath(); c.moveTo(cx, cy + 95 * s); c.bezierCurveTo(cx - 150 * s, cy, cx - 110 * s, cy - 130 * s, cx, cy - 55 * s); c.bezierCurveTo(cx + 110 * s, cy - 130 * s, cx + 150 * s, cy, cx, cy + 95 * s); c.fill(); };
    const speckle = (n: number, r: number, fill: string) => { c.fillStyle = fill; for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, rr = Math.sqrt(Math.random()) * r; c.globalAlpha = 0.25 + Math.random() * 0.5; c.beginPath(); c.arc(C + Math.cos(a) * rr, C + Math.sin(a) * rr, 1 + Math.random() * 2.2, 0, 6.283); c.fill(); } c.globalAlpha = 1; };
    switch (d.art) {
      case 'crema': base('#D39A5C', '#6E3A18'); speckle(500, 230, '#4A230D'); break;
      case 'heart': base('#B5784A', '#7A4626'); c.shadowColor = milk; c.shadowBlur = 12; heart(C, C + 10, 1.1, milk); c.shadowBlur = 0; break;
      case 'rosetta': {
        base('#B57A4C', '#7B4727'); c.shadowColor = milk; c.shadowBlur = 8;
        for (let i = 0; i < 7; i++) { const y = 360 - i * 30, w = 150 - i * 15; c.fillStyle = milk; c.beginPath(); c.ellipse(C, y, w, 26, 0, Math.PI, 0); c.fill(); c.fillStyle = '#A86E43'; c.beginPath(); c.ellipse(C, y + 9, w * 0.9, 18, 0, Math.PI, 0); c.fill(); }
        heart(C, 140, 0.45, milk); c.shadowBlur = 0; c.strokeStyle = '#A86E43'; c.lineWidth = 7; c.beginPath(); c.moveTo(C, 112); c.lineTo(C, 395); c.stroke(); break;
      }
      case 'foam': { base('#C79566', '#8A5631'); const g = c.createRadialGradient(C, C, 0, C, C, 215); g.addColorStop(0, '#FBF5EC'); g.addColorStop(0.8, '#F1E3D1'); g.addColorStop(1, 'rgba(241,227,209,0)'); c.fillStyle = g; c.fillRect(0, 0, W, W); speckle(900, 130, '#5B2E15'); break; }
      case 'drizzle': { base('#8C5634', '#5A301B'); c.fillStyle = '#D8B38E'; c.beginPath(); c.arc(C, C, 170, 0, 6.283); c.fill(); c.strokeStyle = '#2A140A'; c.lineWidth = 7; c.lineCap = 'round'; c.beginPath(); for (let t = 0; t < 6 * Math.PI; t += 0.05) { const r = 8 + t * 8.5; const x = C + Math.cos(t) * r, y = C + Math.sin(t) * r; if (t) c.lineTo(x, y); else c.moveTo(x, y); } c.stroke(); break; }
      case 'matcha': base('#A8C978', '#6E9440'); c.shadowColor = '#F2F6E4'; c.shadowBlur = 10; heart(C, C + 10, 1.05, '#F2F6E4'); c.shadowBlur = 0; break;
      default: { base(hexLerp(d.liquid, '#ffffff', 0.18), d.liquid); c.fillStyle = 'rgba(255,255,255,.12)'; c.beginPath(); c.ellipse(C - 60, C - 70, 120, 40, -0.5, 0, 6.283); c.fill(); }
    }
    // Microfoam grain + darker meniscus where liquid meets the cup wall
    const img = c.getImageData(0, 0, W, W), px = img.data;
    for (let i = 0; i < px.length; i += 4) { const n = (Math.random() - 0.5) * 10; px[i] += n; px[i + 1] += n; px[i + 2] += n; }
    c.putImageData(img, 0, 0);
    const ring = c.createRadialGradient(C, C, 205, C, C, 256); ring.addColorStop(0, 'rgba(40,18,6,0)'); ring.addColorStop(1, 'rgba(40,18,6,0.55)');
    c.fillStyle = ring; c.fillRect(0, 0, W, W);
    artTex.needsUpdate = true;
  }

  let steamOn = 1, drink = firstLook;
  function setLevel(k: number) {
    if (drink.cup === 'glass') {
      const h = Math.max(0.02, 1.48 * drink.fill * k);
      coldBody.scale.set(1, h, 1); coldBody.position.y = 0.14 + h / 2;
      const top = 0.14 + h; coldTop.position.y = top + 0.002; coldTop.scale.setScalar(0.555 + 0.045 * Math.min(1, h / 1.48) - 0.004);
      ice.forEach((m, i) => m.position.set([-0.17, 0.19, 0.0][i], Math.max(0.3, top - 0.07 - i * 0.06), [0.12, -0.06, -0.22][i]));
    } else {
      const y = 0.12 + (1.16 - 0.12) * drink.fill * k;
      surface.position.y = y; surface.scale.setScalar(innerR(y) - 0.008);
    }
  }
  function applyDrink(d: Look, k = 1) {
    drink = d;
    const isGlass = d.cup === 'glass';
    mug.visible = !isGlass; saucer.visible = !isGlass; glass.visible = isGlass;
    mug.scale.setScalar(d.cup === 'demi' ? 0.78 : 1); saucer.scale.setScalar(d.cup === 'demi' ? 0.86 : 1);
    coldMat.color.copy(col(d.liquid));
    pourMat.color.copy(col(d.art === 'plain' || d.art === 'crema' ? d.liquid : '#E9D8C3'));
    ice.forEach((m, i) => m.rotation.set(i * 0.7, i * 1.9, i * 0.4));
    steamOn = isGlass ? 0 : 1;
    drawArt(d); setLevel(k);
  }
  applyDrink(firstLook);

  // Theme → materials
  function applyTheme(k: ThemeKey) {
    const t = THEMES[k], d3 = t.d3;
    const matte = d3.rough > 0.6;
    cupMat.color.copy(col(d3.cup)); cupMat.roughness = d3.rough; cupMat.clearcoat = matte ? 0.12 : 1;
    saucerMat.color.copy(col(d3.saucer)); saucerMat.roughness = Math.min(0.9, d3.rough + 0.04); saucerMat.clearcoat = matte ? 0.12 : 1;
    beanMat.color.copy(col(d3.bean)); rim.color.copy(col(d3.rim));
    (ground.material as THREE.ShadowMaterial).opacity = t.dark ? 0.55 : 0.28;
    (contact.material as THREE.MeshBasicMaterial).opacity = t.dark ? 0.75 : 0.45;
    renderer.toneMappingExposure = t.dark ? 1.1 : 1.0;
    bakery?.applyTheme(t.c.accent);
  }
  // Cookies and muffins for the Bakery section, on a plate that matches the saucer.
  const hasBakery = Object.keys(bakes).length > 0 && !!document.querySelector('#spotBakery');
  const bakery = hasBakery ? createBakery({ looks: bakes, start: bakeStart, plateMat: saucerMat, reduce }) : null;
  if (bakery) { bakery.group.visible = false; model.add(bakery.group); }
  document.addEventListener('cafe:bake', (e) => bakery?.select((e as CustomEvent<string>).detail));

  applyTheme(skin());
  document.addEventListener('cafe:theme', (e) => applyTheme((e as CustomEvent<ThemeKey>).detail));

  // Drink switching: drain, swap, then pour back up to the new level
  let swap: { t: number; d: Look; applied: boolean } | null = null;
  document.addEventListener('cafe:drink', (e) => {
    const d = looks[(e as CustomEvent<string>).detail];
    if (!d) return;
    if (reduce) applyDrink(d);
    else swap = { t: 0, d, applied: false };
  });

  /* ---------- Scroll choreography ---------- */
  const spotEls = {
    hero: document.querySelector<HTMLElement>('#spotHero'),
    story: document.querySelector<HTMLElement>('#spotStory'),
    win: document.querySelector<HTMLElement>('#cupWindow'),
    bakery: document.querySelector<HTMLElement>('#spotBakery'),
    visit: document.querySelector<HTMLElement>('#spotVisit'),
  };
  const menuSection = document.querySelector<HTMLElement>('#menu');
  type SpotName = keyof typeof spotEls;
  type Focus = { spot: SpotName; f: number; tilt: number; beans: number; roll: number; bake: number };

  let vw = innerWidth, vh = innerHeight;
  const halfH = Math.tan((35 / 2) * Math.PI / 180) * 10;
  let halfW = halfH * (vw / vh);
  let focus: Focus[] = [];
  const docTop = (el: HTMLElement) => el.getBoundingClientRect().top + scrollY;

  function measure() {
    vw = innerWidth; vh = innerHeight;
    renderer.setSize(vw, vh, false);
    camera.aspect = vw / vh; camera.updateProjectionMatrix();
    halfW = halfH * camera.aspect;
    const center = (el: HTMLElement) => docTop(el) + el.offsetHeight / 2 - vh / 2;
    const f: Focus[] = [];
    if (spotEls.hero) f.push({ spot: 'hero', f: 0, tilt: 0.42, beans: 1, roll: 0, bake: 0 });
    if (spotEls.story) f.push({ spot: 'story', f: center(spotEls.story), tilt: 0.3, beans: 0.8, roll: 0.14, bake: 0 });
    if (spotEls.win && menuSection) {
      const mTop = docTop(menuSection), mBot = mTop + menuSection.offsetHeight;
      f.push({ spot: 'win', f: mTop - 20, tilt: 0.62, beans: 0, roll: 0, bake: 0 });
      f.push({ spot: 'win', f: Math.max(mTop, mBot - vh), tilt: 0.62, beans: 0, roll: 0, bake: 0 });
    }
    if (spotEls.bakery) {
      // The bakery spot is sticky, so hold the bakery pose until it stops sticking
      // (its column ends), then let the item scroll away with the page.
      const sec = document.querySelector<HTMLElement>('#bakery')!;
      const spot = spotEls.bakery, column = spot.parentElement!;
      const stickTop = parseFloat(getComputedStyle(spot).top) || 0;
      const bTop = docTop(sec);
      const bEnd = Math.max(bTop, docTop(column) + column.offsetHeight - spot.offsetHeight - stickTop);
      const pose = { spot: 'bakery' as const, tilt: 0.5, beans: bakery ? 0 : 0.8, roll: 0.06, bake: bakery ? 1 : 0 };
      f.push({ ...pose, f: Math.min(center(spotEls.bakery), bTop + 40) });
      f.push({ ...pose, f: bEnd });
    }
    if (spotEls.visit) f.push({ spot: 'visit', f: center(spotEls.visit), tilt: 0.38, beans: 0.55, roll: -0.08, bake: 0 });
    for (let i = 1; i < f.length; i++) f[i].f = Math.max(f[i].f, f[i - 1].f + 1);
    focus = f;
  }

  const live = (name: SpotName) => {
    const r = spotEls[name]!.getBoundingClientRect();
    const isWin = name === 'win';
    const narrow = vw < 860;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2 - (isWin ? r.height * (narrow ? 0.14 : 0.06) : 0);
    const wW = (r.width / vw) * 2 * halfW, wH = (r.height / vh) * 2 * halfH;
    const s = (isWin && narrow ? Math.min(wH / 3.2, wW / 3.8) : Math.min(wH / (isWin ? 2.3 : 2.1), wW / 3.1)) * CUP_SIZE;
    return { x: ((cx / vw) * 2 - 1) * halfW, y: (-(cy / vh) * 2 + 1) * halfH, s: Math.max(0.05, s) };
  };
  const ease = (t: number) => t * t * (3 - 2 * t);
  function target() {
    const y = scrollY;
    let i = 0; while (i < focus.length - 1 && y >= focus[i + 1].f) i++;
    const A = focus[i], B = focus[Math.min(i + 1, focus.length - 1)];
    const t = A === B ? 0 : ease(Math.min(1, Math.max(0, (y - A.f) / (B.f - A.f))));
    const a = live(A.spot), b = A.spot === B.spot ? a : live(B.spot);
    const L = (p: number, q: number) => p + (q - p) * t;
    return { x: L(a.x, b.x), y: L(a.y, b.y), s: L(a.s, b.s), tilt: L(A.tilt, B.tilt), beans: L(A.beans, B.beans), roll: L(A.roll, B.roll), bake: L(A.bake, B.bake) };
  }

  measure();
  if (!focus.length) return;
  addEventListener('resize', measure);
  if ('ResizeObserver' in window) new ResizeObserver(measure).observe(document.body);
  document.fonts?.ready.then(measure);

  let px = 0, py = 0;
  addEventListener('pointermove', (e) => { px = (e.clientX / vw) * 2 - 1; py = (e.clientY / vh) * 2 - 1; }, { passive: true });

  // If the GPU drops the context (e.g. a backgrounded mobile tab), fall back to the illustration.
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); document.documentElement.classList.remove('has3d'); });
  canvas.addEventListener('webglcontextrestored', () => document.documentElement.classList.add('has3d'));

  const cur = { x: 0, y: 0, s: 0.5, tilt: 0.4, beans: 1, roll: 0, bake: 0 };
  let bakeShown = false;
  let first = true, last = performance.now(), spin = 0, clock = 0;

  function frame(now: number) {
    requestAnimationFrame(frame);
    if (document.hidden) { last = now; return; }
    const dt = Math.min(0.05, (now - last) / 1000); last = now; clock += dt;
    const T = target();
    const k = first ? 1 : 1 - Math.exp(-dt * 4.5);
    (Object.keys(cur) as (keyof typeof cur)[]).forEach((key) => (cur[key] += (T[key] - cur[key]) * k));

    let swapSpin = 0;
    pour.visible = false;
    if (swap) {
      swap.t = Math.min(1, swap.t + dt / 1.9);
      const t = swap.t;
      if (t < 0.32) { const e = t / 0.32; setLevel(1 - 0.88 * e * e); }
      else {
        if (!swap.applied) { applyDrink(swap.d, 0.12); swap.applied = true; }
        const e = Math.min(1, (t - 0.32) / 0.6), lvl = 0.12 + 0.88 * (1 - Math.pow(1 - e, 3));
        setLevel(lvl);
        if (t < 0.9) {
          const surfY = drink.cup === 'glass' ? 0.14 + 1.48 * drink.fill * lvl : mug.position.y + (0.12 + (1.16 - 0.12) * drink.fill * lvl) * mug.scale.y;
          const topY = surfY + 1.5, thin = t > 0.8 ? 1 - (t - 0.8) / 0.1 : Math.min(1, (t - 0.32) / 0.05);
          pour.visible = true; pour.scale.set(thin, topY - surfY, thin);
          pour.position.set(Math.sin(clock * 9) * 0.006, (topY + surfY) / 2, 0);
        }
      }
      swapSpin = Math.sin(Math.PI * t) * 0.25;
      if (t >= 1) { setLevel(1); swap = null; }
    }
    if (!reduce) spin += dt * 0.12;

    rig.position.set(cur.x, cur.y, 0);
    rig.scale.setScalar(cur.s);
    rig.rotation.y = px * 0.08;
    inner.rotation.set(cur.tilt + py * 0.04, (reduce ? -0.5 : spin) + swapSpin, cur.roll);

    // Key light + shadow camera follow the cup
    const s = cur.s;
    key.position.set(cur.x + 3.2 * s, cur.y + 6.5 * s, 5 * s);
    key.target.position.set(cur.x, cur.y, 0); key.target.updateMatrixWorld();
    const sc = key.shadow.camera; sc.left = sc.bottom = -2.6 * s; sc.right = sc.top = 2.6 * s; sc.near = 0.1; sc.far = 20 * s + 5; sc.updateProjectionMatrix();

    // Beans orbit
    beansGroup.visible = cur.beans > 0.08;
    beans.forEach((b, i) => {
      if (!reduce) b.a += dt * b.sp;
      const bob = reduce ? 0 : Math.sin(clock * 0.7 + b.ph) * 0.06;
      b.g.position.set(Math.cos(b.a) * b.r * (0.6 + 0.4 * cur.beans), b.y + bob, Math.sin(b.a) * b.r * 0.7);
      if (!reduce) { b.g.rotation.x += dt * b.rs.x * 0.4; b.g.rotation.y += dt * b.rs.y * 0.4; }
      b.g.scale.setScalar((0.17 + (i % 5) * 0.012) * Math.pow(cur.beans, 1.5));
    });

    // Hand over between the drink and the bakery item: one shrinks away as the other grows.
    const bw = ease(Math.min(1, Math.max(0, (cur.bake - 0.15) / 0.7)));
    cupGroup.scale.setScalar(Math.max(0.0001, 1 - bw));
    cupGroup.visible = bw < 0.999;
    if (bakery) {
      bakery.group.visible = bw > 0.001;
      bakery.group.scale.setScalar(Math.max(0.0001, bw));
      if (bw > 0.5 && !bakeShown) { bakeShown = true; bakery.intro(); }
      if (bw < 0.05) bakeShown = false;
      bakery.update(dt, bw);
    }

    // Steam wisps (from the drink, or from a warm muffin)
    const cupTop = glass.visible ? 1.0 : mug.scale.x < 1 ? 0.4 : 0.6;
    const bs = bakery ? bakery.steam() : { top: 0.4, amount: 0 };
    const topY = cupTop + (bs.top - cupTop) * bw;
    const steamAmount = steamOn * (1 - bw) + bs.amount * bw;
    steam.forEach((p) => {
      p.life += dt / p.dur; if (p.life > 1) { p.life = 0; p.x0 = (Math.random() - 0.5) * 0.5; }
      const L = p.life;
      p.s.position.set(p.x0 + Math.sin(L * 3 + p.ph) * 0.14 * L, topY + 0.35 + L * 1.5, 0.1);
      p.s.scale.set((0.45 + L * 0.5) * p.flip, 0.9 + L * 0.9, 1);
      p.m.rotation += dt * 0.05 * p.flip;
      p.m.opacity = Math.pow(Math.sin(Math.PI * L), 1.5) * 0.55 * steamAmount * (reduce ? 0.6 : 1);
    });
    ice.forEach((m, i) => { if (!reduce) m.rotation.y += dt * (0.08 + i * 0.04); });

    renderer.render(scene, camera);
    if (first) { first = false; document.documentElement.classList.add('has3d'); }
  }
  requestAnimationFrame(frame);
}
