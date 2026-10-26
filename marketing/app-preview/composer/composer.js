/**
 * Haptic Heist — App Store Preview : le compositeur.
 *
 * Dessine l'image n de la vidéo à partir de la timeline (../timeline.mjs) et des
 * captures de la vraie app (../.cache/clips). Entièrement déterministe :
 * `window.hh.render(n)` produit toujours exactement la même image.
 *
 *   ?variant=device  iPhone mis en scène (par défaut)
 *   ?variant=store   l'écran de l'app seul, sans matériel dessiné ni inclinaison 3D
 */
import * as TL from '../timeline.mjs';

const { PHONE, FPS, WIDTH, HEIGHT, EASE, clamp01, lerp, COLORS } = TL;
const VARIANT = new URLSearchParams(location.search).get('variant') || 'device';
const STORE = VARIANT === 'store';
const CLIP_ROOT = '../.cache/clips/';
const pt = PHONE.pt;

const clips = await (await fetch(`${CLIP_ROOT}clips.json`)).json();
const { F, ev } = TL.resolve(clips);
const CAMS = { main: TL.cameraMain(F), left: TL.cameraSide('left'), right: TL.cameraSide('right') };
const RINGS = TL.RINGS(F, ev);
const pad4 = (n) => String(n).padStart(4, '0');
const frameSrc = (clip, f) => `${CLIP_ROOT}${clip}/${pad4(Math.max(0, Math.min(clips[clip].frames - 1, f)))}.jpg`;

const el = (tag, cls, parent, style = {}) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  Object.assign(e.style, style);
  if (parent) parent.appendChild(e);
  return e;
};
const px = (v) => `${v}px`;

/* ───────────────────────── iPhone ───────────────────────── */

const SCREEN_R = 55 * pt;

function statusBarSvg() {
  // Réseau, Wi-Fi, batterie — dessinés en points iOS.
  return `<svg viewBox="0 0 78 14" width="${78 * pt}" height="${14 * pt}" fill="#fff">
    <rect x="0" y="9" width="3" height="4" rx="1"/><rect x="4.7" y="6.6" width="3" height="6.4" rx="1"/>
    <rect x="9.4" y="4.2" width="3" height="8.8" rx="1"/><rect x="14.1" y="1.8" width="3" height="11.2" rx="1"/>
    <path d="M29.6 4.1c2.2 0 4.2.8 5.7 2.2l1.2-1.2C34.6 3.3 32.2 2.3 29.6 2.3s-5 1-6.9 2.8l1.2 1.2c1.5-1.4 3.5-2.2 5.7-2.2zm0 3.5c1.2 0 2.4.5 3.2 1.3l1.2-1.2c-1.2-1.1-2.7-1.8-4.4-1.8s-3.2.7-4.4 1.8l1.2 1.2c.8-.8 2-1.3 3.2-1.3zm0 3.4l1.9-1.9c-.5-.5-1.2-.8-1.9-.8s-1.4.3-1.9.8l1.9 1.9z"/>
    <rect x="43" y="1.6" width="24.5" height="11" rx="3.4" fill="none" stroke="#fff" stroke-opacity=".4" stroke-width="1"/>
    <rect x="45" y="3.6" width="18" height="7" rx="1.8"/><rect x="68.6" y="5.1" width="1.6" height="4" rx=".8" fill-opacity=".4"/>
  </svg>`;
}

function buildPhone(id, parent) {
  const root = el('div', 'phone', parent, { width: px(PHONE.w), height: px(PHONE.h) });
  root.id = `phone-${id}`;
  const body = el('div', 'body', root, { borderRadius: px(SCREEN_R + PHONE.bezel) });
  // Boutons latéraux, discrets.
  const keys = [
    ['left', 0.155, 0.032],
    ['left', 0.215, 0.058],
    ['left', 0.29, 0.058],
    ['right', 0.245, 0.09],
  ];
  for (const [side, top, h] of keys) el('div', 'key', root, { [side]: px(-4), top: px(PHONE.h * top), height: px(PHONE.h * h) });
  const screen = el('div', 'screen', root, {
    left: px(PHONE.bezel),
    top: px(PHONE.bezel),
    width: px(PHONE.screenW),
    height: px(PHONE.screenH),
    borderRadius: px(SCREEN_R),
  });
  const imgA = el('img', 'shot', screen);
  const imgB = el('img', 'shot', screen);
  const macro = id === 'main' ? el('img', 'macro', screen) : null;
  const mask = id === 'main' ? el('div', 'mask', screen, { position: 'absolute', inset: '0px' }) : null;
  const dim = el('div', 'dim', screen, { position: 'absolute', inset: '0px', background: '#000', opacity: 0 });
  const status = el('div', 'statusbar', screen, { height: px(59 * pt) });
  const time = el('div', 'time', status, { left: px(34 * pt), width: px(64 * pt), top: px(19 * pt), fontSize: px(17 * pt) });
  time.textContent = '9:41';
  status.insertAdjacentHTML('beforeend', statusBarSvg());
  Object.assign(status.querySelector('svg').style, { left: px(291 * pt), top: px(23 * pt) });
  const island = el('div', 'island', screen, {
    left: px(((393 - 126) / 2) * pt),
    top: px(11 * pt),
    width: px(126 * pt),
    height: px(37 * pt),
    borderRadius: px(18.5 * pt),
  });
  const home = el('div', 'home', screen, {
    left: px(((393 - 134) / 2) * pt),
    bottom: px(8 * pt),
    width: px(134 * pt),
    height: px(5 * pt),
    borderRadius: px(2.5 * pt),
  });
  const touch = el('div', 'touch', screen, { width: px(44 * pt), height: px(44 * pt), opacity: 0 });
  const rings = el('div', 'rings', root, { left: px(PHONE.bezel), top: px(PHONE.bezel), width: px(PHONE.screenW), height: px(PHONE.screenH) });
  const ringEls = Array.from({ length: 4 }, () => el('div', 'ring', rings, { opacity: 0 }));
  if (STORE) {
    // Variante App Store : uniquement l'écran capturé (coins arrondis d'iOS), aucun matériel dessiné.
    body.style.display = 'none';
    root.querySelectorAll('.key').forEach((k) => (k.style.display = 'none'));
    island.style.display = 'none';
  }
  return { id, root, screen, imgA, imgB, macro, mask, dim, touch, ringEls, home, status };
}

/* ───────────────────────── Textes ───────────────────────── */

const texts = document.getElementById('texts');
const TEXT_BLOCKS = TL.TEXTS.map((spec) => {
  const block = el('div', 'headline', texts);
  if (spec.size) block.style.fontSize = px(86 * spec.size);
  const accent = spec.accent === 'red' ? COLORS.red : COLORS.gold;
  const words = [];
  spec.lines.forEach((line, li) => {
    const lineEl = el('span', 'line', block);
    let on = false;
    line
      .replace(/(\d) %/g, '$1 %')
      .split(' ')
      .forEach((tok, wi, arr) => {
        const starts = tok.startsWith('*');
        if (starts) on = true;
        const w = el('span', 'word', lineEl);
        w.textContent = tok.replace(/\*/g, '') + (wi < arr.length - 1 ? ' ' : '');
        w.style.color = on ? accent : spec.dim ? COLORS.text2 : COLORS.text;
        if (tok.endsWith('*') || tok.endsWith('*.')) on = false;
        words.push({ el: w, line: li });
        if (wi < arr.length - 1) lineEl.appendChild(document.createTextNode(''));
      });
  });
  let sub = null;
  if (spec.sub) {
    sub = el('span', 'sub', block);
    sub.textContent = spec.sub;
  }
  return { spec, block, words, sub };
});

/* ───────────────────────── Scène ───────────────────────── */

const stage = document.getElementById('stage');
const PHONES = {
  left: buildPhone('left', stage),
  right: buildPhone('right', stage),
  main: buildPhone('main', stage),
};
const glow = document.getElementById('glow');
const scrim = document.getElementById('scrim');
const endcard = document.getElementById('endcard');
const endIcon = document.getElementById('end-icon');
const endTitle = document.getElementById('end-title');
const endTagline = document.getElementById('end-tagline');
const endCta = document.getElementById('end-cta');
const endRings = document.getElementById('end-rings');
const endRingEls = Array.from({ length: 4 }, () => el('div', 'ring', endRings, { opacity: 0 }));
endIcon.src = `${CLIP_ROOT}app-icon.png`;
endTitle.textContent = TL.END_CARD.title;
endTagline.textContent = TL.END_CARD.tagline;
document.getElementById('end-cta-label').textContent = TL.END_CARD.cta;

await document.fonts.load('700 86px "Inter Display"');
await document.fonts.load('500 32px "Inter"');
await document.fonts.load('600 32px "Inter"');
await document.fonts.ready;
await endIcon.decode().catch(() => {});

// Positions verticales des blocs de texte (mesurées une fois les polices chargées).
for (const b of TEXT_BLOCKS) {
  const lh = parseFloat(getComputedStyle(b.block).fontSize) * 1.04;
  const h = b.block.offsetHeight;
  const top = b.spec.pos === 'top' ? 168 : b.spec.pos === 'bottom' ? 1470 : (HEIGHT - h) / 2;
  b.block.style.top = px(top + (b.spec.row || 0) * lh);
}

/* ───────────────────────── Rendu d'une image ───────────────────────── */

const pending = [];
function setSrc(img, src) {
  if (img.dataset.src === src) return;
  img.dataset.src = src;
  img.src = src;
  pending.push(img.decode().catch(() => {}));
}

function screenAt(id, t) {
  const segs = TL.SCREENS[id];
  let i = segs.findIndex((s) => t >= s.t0 && t < s.t1);
  if (i < 0) i = segs.length - 1;
  const seg = segs[i];
  const cur = { clip: seg.clip, frame: seg.map(t) };
  if (seg.fade && i > 0 && t - seg.t0 < seg.fade) {
    const prev = segs[i - 1];
    return { a: { clip: prev.clip, frame: prev.map(t) }, b: cur, mix: EASE.inOutCubic(clamp01((t - seg.t0) / seg.fade)) };
  }
  return { a: cur, b: null, mix: 0 };
}

function storeCamera(cam) {
  // Même cadrage que la version iPhone (les titres gardent leur espace), sans inclinaison 3D :
  // seule la bascule de transition est conservée.
  return { ...cam, ry: Math.abs(cam.ry) > 25 ? cam.ry : 0, rx: 0 };
}

function placePhone(p, cam) {
  const Px = PHONE.bezel + cam.fu * PHONE.screenW;
  const Py = PHONE.bezel + cam.fv * PHONE.screenH;
  p.root.style.transformOrigin = `${Px}px ${Py}px`;
  p.root.style.transform = `translate(${cam.x - Px}px, ${cam.y - Py}px) perspective(2600px) rotateY(${cam.ry}deg) rotateX(${cam.rx}deg) scale(${cam.s})`;
  p.root.style.opacity = String(cam.o);
  p.root.style.filter = cam.blur > 0.05 ? `blur(${cam.blur}px)` : 'none';
  p.root.style.visibility = cam.o < 0.002 ? 'hidden' : 'visible';
  // Centre de l'iPhone sur l'image (pour le halo).
  return { cx: cam.x + (PHONE.w / 2 - Px) * cam.s, cy: cam.y + (PHONE.h / 2 - Py) * cam.s };
}

function drawRings(ringEls, list, t, w, h, sizeRef) {
  let k = 0;
  for (const r of list) {
    for (let i = 0; i < r.count; i++) {
      const age = t - (r.t + i * r.gap);
      if (age < 0 || age > 1.05 || k >= ringEls.length) continue;
      const e = ringEls[k++];
      const x = clamp01(age / 1.05);
      const d = sizeRef * r.size;
      const s = 0.62 + 0.78 * EASE.outCubic(x);
      const color = r.color === 'red' ? COLORS.red : COLORS.gold;
      Object.assign(e.style, {
        width: px(d),
        height: px(d),
        left: px(r.at[0] * w - d / 2),
        top: px(r.at[1] * h - d / 2),
        borderWidth: px(3 / s),
        borderColor: color,
        transform: `scale(${s})`,
        opacity: String(0.85 * Math.pow(1 - x, 1.4)),
        boxShadow: `0 0 ${18 / s}px ${color}55`,
      });
    }
  }
  for (; k < ringEls.length; k++) ringEls[k].style.opacity = '0';
}

function drawTexts(t) {
  let topVisible = 0;
  for (const b of TEXT_BLOCKS) {
    const { spec } = b;
    const live = t >= spec.in - 0.05 && t <= spec.out + 0.4;
    b.block.style.visibility = live ? 'visible' : 'hidden';
    if (!live) continue;
    const xo = clamp01((t - spec.out) / 0.34);
    const exitO = 1 - EASE.outQuad(xo);
    b.block.style.opacity = String(exitO);
    b.block.style.transform = `translateY(${-20 * EASE.inQuad(xo)}px)`;
    b.block.style.filter = xo > 0 ? `blur(${9 * xo}px)` : 'none';
    const stagger = spec.stagger ?? 0.055;
    b.words.forEach((w, i) => {
      const d = spec.in + (spec.lineStagger ? w.line * stagger : i * stagger);
      const e = EASE.outExpo(clamp01((t - d) / 0.7));
      w.el.style.opacity = String(Math.min(1, e * 1.15));
      w.el.style.transform = `translateY(${(1 - e) * 36}px)`;
      w.el.style.filter = e < 0.995 ? `blur(${(1 - e) * 16}px)` : 'none';
    });
    if (b.sub) {
      const e = EASE.outExpo(clamp01((t - spec.in - 0.35) / 0.7));
      b.sub.style.opacity = String(e);
      b.sub.style.transform = `translateY(${(1 - e) * 18}px)`;
    }
    if (spec.pos === 'top') topVisible = Math.max(topVisible, exitO);
  }
  scrim.style.opacity = String(topVisible);
}

function drawEndCard(t) {
  const E = TL.END_CARD;
  const on = t >= E.in - 0.02;
  endcard.style.visibility = on ? 'visible' : 'hidden';
  if (!on) return;
  const step = (delay, dur = 0.75) => EASE.outExpo(clamp01((t - E.in - delay) / dur));
  const ei = step(0, 0.9);
  endIcon.style.opacity = String(ei);
  endIcon.style.transform = `scale(${lerp(0.82, 1, ei)})`;
  endIcon.style.filter = ei < 0.995 ? `blur(${(1 - ei) * 18}px)` : 'none';
  for (const [node, delay, dy] of [
    [endTitle, 0.22, 30],
    [endTagline, 0.36, 24],
    [endCta, 0.55, 24],
  ]) {
    const e = step(delay);
    node.style.opacity = String(e);
    node.style.transform = `translateY(${(1 - e) * dy}px)`;
    node.style.filter = e < 0.995 ? `blur(${(1 - e) * 12}px)` : 'none';
  }
  // Ondes autour de l'icône (centre mesuré dans la mise en page).
  const r = endIcon.getBoundingClientRect();
  endRings.style.left = px(r.left + r.width / 2);
  endRings.style.top = px(r.top + r.height / 2);
  drawRings(
    endRingEls,
    RINGS.filter((x) => x.at === 'icon').map((x) => ({ ...x, at: [0, 0] })),
    t,
    0,
    0,
    300 * 1.25,
  );
}

async function render(n) {
  const t = n / FPS;
  pending.length = 0;
  let center = { cx: WIDTH / 2, cy: HEIGHT / 2 };

  for (const id of ['left', 'right', 'main']) {
    const p = PHONES[id];
    const cam0 = CAMS[id](t);
    const cam = STORE ? storeCamera(cam0) : cam0;
    const c = placePhone(p, cam);
    if (id === 'main') center = c;
    if (cam.o < 0.002) continue;

    const scr = screenAt(id, t);
    setSrc(p.imgA, frameSrc(scr.a.clip, scr.a.frame));
    if (scr.b) {
      setSrc(p.imgB, frameSrc(scr.b.clip, scr.b.frame));
      p.imgB.style.opacity = String(scr.mix);
    } else {
      p.imgB.style.opacity = '0';
    }
    const shown = scr.b && scr.mix > 0.5 ? scr.b : scr.a;

    if (p.macro) {
      // Gros plan du logo : la même image, capturée en 8× pour rester nette au zoom.
      const mo = shown.clip === 'hero' ? 1 - clamp01((t - 4.2) / 0.3) : 0;
      p.macro.style.opacity = String(mo);
      if (mo > 0) {
        const lb = clips.logo.logo;
        Object.assign(p.macro.style, { left: px(lb.x * pt), top: px(lb.y * pt), width: px(lb.width * pt), height: px(lb.height * pt) });
        setSrc(p.macro, frameSrc('logo', shown.frame));
      }
    }

    if (p.mask) {
      const m = TL.MACRO_MASK(t);
      const lb = clips.logo.logo;
      const cx = (lb.x + lb.width / 2) * pt;
      const cy = (lb.y + lb.height / 2) * pt;
      p.mask.style.opacity = String(m.o);
      const k = cam.s || 1; // rayons exprimés en px de l'image finale
      p.mask.style.background = `radial-gradient(circle at ${cx}px ${cy}px, rgba(0,0,0,0) ${m.inner / k}px, #000 ${m.outer / k}px)`;
    }
    p.dim.style.opacity = String(cam.dim ? cam.dim * cam.o : 0);

    // Point de contact du doigt.
    const fingers = clips[shown.clip].fingers || [];
    const f = fingers[shown.frame];
    if (f) {
      const prevF = fingers[shown.frame - 1];
      const appear = prevF ? 1 : 0.82;
      Object.assign(p.touch.style, {
        left: px(f.x * pt - 22 * pt),
        top: px(f.y * pt - 22 * pt),
        opacity: '1',
        transform: `scale(${appear})`,
      });
    } else {
      p.touch.style.opacity = '0';
    }

    if (id === 'main') {
      const list = RINGS.filter((r) => r.at !== 'icon');
      drawRings(p.ringEls, list, t, PHONE.screenW, PHONE.screenH, PHONE.screenW);
    }
  }

  const g = TL.GLOW(t);
  glow.style.background = `radial-gradient(circle at ${center.cx}px ${center.cy}px, rgba(${g.r | 0},${g.g | 0},${g.b | 0},${g.a}) 0px, rgba(${g.r | 0},${g.g | 0},${g.b | 0},${g.a * 0.35}) 360px, rgba(0,0,0,0) 820px)`;

  drawTexts(t);
  drawEndCard(t);
  await Promise.all(pending);
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  return t;
}

window.hh = { render, frames: TL.FRAMES, fps: FPS, width: WIDTH, height: HEIGHT, variant: VARIANT, ready: true };
document.title = `ready:${VARIANT}`;
