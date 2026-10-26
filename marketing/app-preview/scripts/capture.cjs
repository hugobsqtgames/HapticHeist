/**
 * Captures the REAL app (web build of this project) frame by frame.
 *
 * The browser clock is faked (Playwright `page.clock`): every frame advances
 * time by exactly 1/30 s, then takes a screenshot. Animations, timers and the
 * lock engine run unmodified, so the footage is the real app, perfectly smooth,
 * independent of how fast this machine renders.
 *
 * Output: .cache/clips/<clip>/0000.jpg … and .cache/clips/clips.json
 * (frame counts + events: taps, finger path, dial ticks, anchors, unlocks…),
 * which the composer and the soundtrack both read.
 *
 *   node marketing/app-preview/scripts/capture.cjs [--rebuild] [--only hero,decoy,veteran]
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { execSync } = require('child_process');
const { chromium } = require('playwright');
const { CAREERS, STORAGE_KEY } = require('./careers.cjs');

const ROOT = path.resolve(__dirname, '../../..');
const CACHE = path.resolve(__dirname, '../.cache');
const WEB = path.join(CACHE, 'web');
const CLIPS = path.join(CACHE, 'clips');
const FPS = 30;
const FRAME_MS = 1000 / FPS;
const VIEWPORT = { width: 393, height: 852 };
const DPR = 3; // 1179 × 2556 : la résolution native d'un iPhone 15 Pro
/** Marges de sécurité d'un iPhone à Dynamic Island, imposées à l'app comme sur l'appareil. */
const SAFE_AREA = { top: 59, bottom: 34 };
const SENSITIVITY = 0.6; // réglage « Normale » de l'app
const START_TIME = Date.parse('2026-10-20T19:42:00Z');
/** Graine du hasard par séquence (choisie pour un butin photogénique ; --seed-<clip>=N pour essayer). */
const SEEDS = { hero: 101, decoy: 0x51ed270b, veteran: 0x2545f491 };
for (const a of process.argv) {
  const m = a.match(/^--seed-(\w+)=(\d+)$/);
  if (m) SEEDS[m[1]] = Number(m[2]);
}

const args = process.argv.slice(2);
const only = (args.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const mod = (a, n) => ((a % n) + n) % n;
const signedDiff = (from, to) => {
  let d = mod(to - from, 360);
  if (d > 180) d -= 360;
  return d;
};

/* ───────────────────────── Build + static server ───────────────────────── */

function buildWeb() {
  if (fs.existsSync(path.join(WEB, 'index.html')) && !args.includes('--rebuild')) return;
  console.log('› Export web de l’app…');
  fs.rmSync(WEB, { recursive: true, force: true });
  execSync(`npx expo export --platform web --output-dir "${WEB}"`, { cwd: ROOT, stdio: 'inherit', env: { ...process.env, CI: '1' } });
}

function serve() {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.ttf': 'font/ttf' };
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    let file = path.join(WEB, url);
    if (!file.startsWith(WEB) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(WEB, 'index.html');
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, () => resolve({ server, port: server.address().port })));
}

/* ───────────────────────── One scripted session ───────────────────────── */

class Session {
  constructor(page, clip) {
    this.page = page;
    this.clip = clip; // null = répétition sans capture (repérage)
    this.frame = 0;
    this.events = [];
    this.fingers = [];
    this.finger = null; // {x, y} quand le doigt est posé
    this.rotation = 0; // rotation du cadran, suivie comme le moteur la calcule
    this.fingerAngle = 0;
    this.dial = null;
    this.lastStatus = '';
    this.lastDetent = 0;
  }

  static async open(browser, careerKey, clip, { dpr = DPR } = {}) {
    const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: dpr, reducedMotion: 'no-preference' });
    const page = await context.newPage();
    page.on('pageerror', (e) => {
      if (!/play\(\)|NotAllowedError|interact/.test(e.message)) console.warn('  [page]', e.message);
    });
    // Horloge figée : elle n'avance que de 1/30 s par image, jamais en temps réel.
    await page.clock.install({ time: START_TIME });
    await page.clock.pauseAt(START_TIME + 1);
    await page.addInitScript(
      ({ key, career, seed, safe }) => {
        // Hasard déterministe : la même partie se rejoue à l'identique.
        let a = seed >>> 0;
        Math.random = () => {
          a = (a + 0x6d2b79f5) >>> 0;
          let t = a;
          t = Math.imul(t ^ (t >>> 15), t | 1);
          t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
          return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
        localStorage.clear();
        localStorage.setItem(key, JSON.stringify(career));
        // Typographie la plus proche de la police système d'iOS (SF Pro).
        const style = document.createElement('style');
        style.textContent = `*, text { font-family: 'Inter', -apple-system, system-ui, sans-serif !important; }
          body > div[style*="safe-area-inset-top"] { padding-top: ${safe.top}px !important; padding-bottom: ${safe.bottom}px !important; }
          ::-webkit-scrollbar { display: none; } * { scrollbar-width: none; caret-color: transparent; user-select: none !important; -webkit-user-select: none !important; }`;
        document.addEventListener('DOMContentLoaded', () => document.head.appendChild(style));
      },
      { key: STORAGE_KEY, career: CAREERS[careerKey], seed: SEEDS[careerKey], safe: SAFE_AREA },
    );
    const s = new Session(page, clip);
    if (clip) fs.mkdirSync(path.join(CLIPS, clip), { recursive: true });
    await page.goto(s.url);
    return s;
  }

  get url() {
    return Session.baseUrl;
  }

  async text() {
    return this.page.evaluate(() => document.body.innerText);
  }

  log(type, data = {}) {
    if (this.clip) this.events.push({ frame: this.frame, type, ...data });
  }

  /** Advances exactly one frame (1/30 s) and records it. */
  async step() {
    await this.page.clock.runFor(FRAME_MS);
    await this.observe();
    if (this.clip) {
      const file = path.join(CLIPS, this.clip, `${String(this.frame).padStart(4, '0')}.jpg`);
      await this.page.screenshot({ path: file, type: 'jpeg', quality: 93, ...(this.shotClip ? { clip: this.shotClip } : {}) });
      this.fingers.push(this.finger ? { x: +this.finger.x.toFixed(1), y: +this.finger.y.toFixed(1) } : null);
      this.frame += 1;
    }
  }

  async wait(seconds) {
    const n = Math.round(seconds * FPS);
    for (let i = 0; i < n; i++) await this.step();
  }

  /** Lets time pass without recording (setup before a clip starts). */
  async skip(seconds) {
    const clip = this.clip;
    this.clip = null;
    await this.wait(seconds);
    this.clip = clip;
  }

  async waitFor(re, maxSeconds = 10) {
    for (let i = 0; i < maxSeconds * FPS; i++) {
      if (re.test(await this.text())) return;
      await this.step();
    }
    throw new Error(`Texte introuvable : ${re}`);
  }

  async waitGone(re, maxSeconds = 10) {
    for (let i = 0; i < maxSeconds * FPS; i++) {
      if (!re.test(await this.text())) return;
      await this.step();
    }
    throw new Error(`Texte toujours présent : ${re}`);
  }

  /** Watches the heist status line and screen changes to log game events. */
  async observe() {
    if (!this.clip) return;
    const t = await this.text();
    const status = (t.match(/(Ancrage — ne bougez plus|Goupille \d débloquée|Leurre — \d essais? restants?|Mécanisme ouvert|Alarme déclenchée|Temps écoulé|Cherchez le point d’ancrage|Doigt levé[^\n]*|Tremblement[^\n]*|Glissement[^\n]*)/) || [])[1] || '';
    if (status !== this.lastStatus) {
      if (status.startsWith('Ancrage')) this.log('anchor');
      else if (status.startsWith('Goupille')) this.log('unlock');
      else if (status.startsWith('Mécanisme')) this.log('unlock', { final: true });
      else if (status.startsWith('Leurre') || status.startsWith('Alarme')) this.log('trap', { final: status.startsWith('Alarme') });
      this.lastStatus = status;
    }
    const screen = /Alarme désactivée/.test(t) ? 'success' : /Dossier de police/.test(t) ? 'busted' : null;
    if (screen && screen !== this.lastScreen) this.log(`screen:${screen}`);
    this.lastScreen = screen;
  }

  async boxOf(re) {
    const loc = this.page.getByText(re).last();
    await loc.waitFor({ state: 'visible', timeout: 5000 });
    return loc.boundingBox();
  }

  /** A tap, as a finger would do it: press, hold two frames, release. */
  async tap(re, { record = true } = {}) {
    const b = await this.boxOf(re);
    const x = b.x + b.width / 2;
    const y = b.y + b.height / 2;
    await this.page.mouse.move(x, y);
    this.finger = { x, y };
    await this.page.mouse.down();
    if (record) this.log('tap', { x, y });
    await this.step();
    await this.step();
    await this.page.mouse.up();
    this.finger = null;
    await this.step();
  }

  async locateDial() {
    const loc = this.page.locator('[aria-label^="Cadran du coffre-fort"]').last();
    await loc.waitFor({ state: 'visible', timeout: 5000 });
    const b = await loc.boundingBox();
    this.dial = { cx: b.x + b.width / 2, cy: b.y + b.height / 2, r: b.width * 0.37, size: b.width };
    if (this.clip && !this.dialBox) this.dialBox = { x: b.x, y: b.y, width: b.width, height: b.height };
  }

  get reading() {
    return mod(-this.rotation, 360);
  }

  fingerPos(a) {
    const rad = (a * Math.PI) / 180;
    return { x: this.dial.cx + this.dial.r * Math.cos(rad), y: this.dial.cy + this.dial.r * Math.sin(rad) };
  }

  async press(startAngle = -60) {
    if (!this.dial) await this.locateDial();
    this.fingerAngle = startAngle;
    const p = this.fingerPos(startAngle);
    await this.page.mouse.move(p.x, p.y);
    await this.page.mouse.down();
    this.finger = p;
    this.log('press', p);
  }

  async release() {
    await this.page.mouse.up();
    this.finger = null;
    this.log('release');
  }

  /** Moves the finger by `dFinger` degrees during this frame, then advances it. */
  async moveFinger(dFinger) {
    this.fingerAngle += dFinger;
    const p = this.fingerPos(this.fingerAngle);
    await this.page.mouse.move(p.x, p.y);
    this.finger = p;
    this.rotation += dFinger * SENSITIVITY;
    const detent = Math.floor(this.rotation / 2);
    if (detent !== this.lastDetent) {
      this.log('tick', { n: Math.abs(detent - this.lastDetent) });
      this.lastDetent = detent;
    }
    await this.step();
  }

  /**
   * Turns the dial until it reads `target`, the way a player does:
   * a confident sweep, then a slow, careful approach as the tremor grows.
   */
  async turnTo(target, { seconds = 2.4, approachDeg = 9, approachSeconds = 1.1, minTravel = 0 } = {}) {
    let dReading = signedDiff(this.reading, target);
    if (Math.abs(dReading) < minTravel) dReading += dReading >= 0 ? -360 : 360;
    const totalRot = -dReading; // la lecture décroît quand la rotation croît
    const dir = Math.sign(totalRot) || 1;
    const sweepRot = totalRot - dir * Math.min(approachDeg, Math.abs(totalRot));
    const approachRot = totalRot - sweepRot;
    const sweepFrames = Math.max(1, Math.round((seconds - approachSeconds) * FPS));
    const approachFrames = Math.max(1, Math.round(approachSeconds * FPS));
    const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
    let done = 0;
    for (let i = 1; i <= sweepFrames; i++) {
      const want = sweepRot * ease(i / sweepFrames);
      await this.moveFinger((want - done) / SENSITIVITY);
      done = want;
    }
    const easeOut = (x) => 1 - Math.pow(1 - x, 2.2);
    let done2 = 0;
    for (let i = 1; i <= approachFrames; i++) {
      const want = approachRot * easeOut(i / approachFrames);
      await this.moveFinger((want - done2) / SENSITIVITY);
      done2 = want;
    }
  }

  /** Scouting pass: sweeps the whole dial and returns the anchor zone centres. */
  async scout() {
    await this.press();
    const zones = [];
    let enter = null;
    const steps = Math.round(380 / 3);
    for (let i = 0; i < steps; i++) {
      const before = this.reading;
      await this.moveFinger(-3 / SENSITIVITY); // la lecture augmente de 3° par image (~90°/s)
      const t = await this.text();
      const inZone = /Ancrage — ne bougez plus/.test(t);
      if (inZone && enter == null) enter = before;
      if (!inZone && enter != null) {
        zones.push(mod(enter + signedDiff(enter, this.reading) / 2, 360));
        enter = null;
      }
    }
    await this.release();
    const uniq = [];
    for (const z of zones) if (!uniq.some((u) => Math.abs(signedDiff(u, z)) < 6)) uniq.push(Math.round(z * 10) / 10);
    return uniq;
  }

  async close() {
    await this.page.context().close();
  }
}

/* ───────────────────────── Scenario helpers ───────────────────────── */

async function bootToHome(s) {
  // Splash (900 ms) puis accueil — même séquence d'images en repérage et en prise,
  // pour que le hasard (seedé) tombe exactement pareil.
  await s.skip(0.95);
  await s.waitFor(/Lancer le casse/, 6);
}

/** From home: opens the briefing, starts the heist and waits for "GO". */
async function startHeist(s) {
  await s.tap(/^Lancer le casse$/);
  await s.waitFor(/Commencer/, 4);
  await s.wait(1.2);
  await s.tap(/^Commencer$/);
  await s.waitFor(/Infiltration/, 3);
  await s.waitGone(/Infiltration/, 5); // fin du compte à rebours : le cadran devient actif
}

/* ───────────────────────── Clips ───────────────────────── */

/**
 * HERO — the full journey on the gold Bijouterie (level 2):
 * home (animated logo) → briefing → countdown → dial → anchor → hold → vault opens.
 */
async function clipHero(browser) {
  // Repérage : où se cache le point d'ancrage de cette partie ?
  const prefix = async (x) => {
    await bootToHome(x);
    x.log('screen:home');
    await x.wait(6.5);
    await startHeist(x);
    x.log('heist:go');
    await x.wait(0.5);
  };
  const scout = await Session.open(browser, 'hero', null);
  await prefix(scout);
  const [target] = await scout.scout();
  await scout.close();
  console.log(`  hero : point d’ancrage à ${target}°`);

  const s = await Session.open(browser, 'hero', 'hero');
  await prefix(s);
  await s.press();
  await s.wait(0.25);
  await s.turnTo(target, { seconds: 3.2, approachDeg: 10, approachSeconds: 1.3, minTravel: 150 });
  await s.waitFor(/Mécanisme ouvert/, 2.5); // immobile : la jauge de maintien se remplit
  await s.release();
  await s.waitFor(/Alarme désactivée/, 3);
  await s.wait(5.2);
  return s;
}

/**
 * LOGO — the same home screen as HERO, frame for frame, but rendered at 8× so the
 * opening macro shot of the animated logo stays razor sharp.
 */
async function clipLogo(browser) {
  const s = await Session.open(browser, 'hero', 'logo', { dpr: 8 });
  await bootToHome(s);
  s.log('screen:home');
  const box = await s.page.evaluate(() => {
    // L'intro du logo est une mise à l'échelle autour de son centre : le centre est fixe.
    const svg = [...document.querySelectorAll('svg')].find((e) => e.getAttribute('width') === '104');
    const r = svg.getBoundingClientRect();
    return { cx: r.x + r.width / 2, cy: r.y + r.height / 2 };
  });
  const half = 104 * 0.82; // le logo et ses ondes
  s.logoBox = { x: box.cx - half, y: box.cy - half, width: half * 2, height: half * 2 };
  s.shotClip = s.logoBox;
  await s.wait(6.4);
  return s;
}

/** DECOY — Banque Sterling (level 3): the dial lands on a decoy, the alarm bites, then the arrest. */
async function clipDecoy(browser) {
  // Repérage 1 : les deux zones, puis laquelle est le leurre.
  let s = await Session.open(browser, 'decoy', null);
  await bootToHome(s);
  await startHeist(s);
  const zones = await s.scout();
  await s.close();
  if (zones.length < 2) throw new Error(`Repérage leurre : zones = ${zones}`);

  const tryHold = async (angle) => {
    const t = await Session.open(browser, 'decoy', null);
    await bootToHome(t);
    await startHeist(t);
    await t.press();
    await t.turnTo(angle, { seconds: 1.6, approachDeg: 6, approachSeconds: 0.6 });
    await t.wait(1.3);
    const txt = await t.text();
    await t.close();
    return /Leurre/.test(txt);
  };
  const decoy = (await tryHold(zones[0])) ? zones[0] : zones[1];
  console.log(`  decoy : zones ${zones.join('°, ')}° → leurre à ${decoy}°`);

  // Les leurres se déplacent après chaque alarme : on rejoue la partie pour les retrouver.
  const plan = [decoy];
  const replay = async (clip) => {
    const r = await Session.open(browser, 'decoy', clip);
    await bootToHome(r);
    const rec = r.clip;
    r.clip = null;
    await startHeist(r);
    r.clip = rec;
    r.log('heist:go');
    await r.wait(0.2);
    await r.press();
    for (let i = 0; i < plan.length; i++) {
      await r.turnTo(plan[i], i === 0 ? { seconds: 2.2, approachDeg: 8, approachSeconds: 1.0, minTravel: 90 } : { seconds: 1.4, approachDeg: 5, approachSeconds: 0.5 });
      await r.wait(i === 0 ? 1.6 : 1.25);
    }
    return r;
  };
  // Le vrai point ne bouge pas : après chaque alarme, la zone qui n'est pas lui est le leurre déplacé.
  const real = zones.find((z) => z !== decoy);
  for (let k = 1; k < 3; k++) {
    const r = await replay(null);
    await r.release();
    const zs = await r.scout();
    await r.close();
    const moved = zs.find((z) => Math.abs(signedDiff(z, real)) > 4);
    if (moved == null) throw new Error(`Repérage leurre ${k} : zones = ${zs}`);
    plan.push(moved);
  }
  console.log(`  decoy : plan ${plan.join('° → ')}°`);
  const r = await replay('decoy');
  await r.release();
  await r.waitFor(/Dossier de police/, 4);
  await r.wait(3.2);
  return r;
}

/** VETERAN — later on: the vault, the tutorial and the settings of a seasoned player. */
async function clipVeteran(browser) {
  const s = await Session.open(browser, 'veteran', 'veteran');
  await bootToHome(s);
  const rec = s.clip;
  s.clip = null;
  await s.tap(/^Butin$/, { record: false });
  await s.wait(0.6);
  s.clip = rec;
  s.log('screen:vault');
  await s.wait(3.4);
  s.clip = null;
  await s.tap(/^Tutoriel$/, { record: false });
  await s.wait(0.6);
  s.clip = rec;
  s.log('screen:tutorial');
  await s.wait(2.6);
  s.clip = null;
  await s.tap(/^Réglages$/, { record: false });
  await s.wait(0.6);
  s.clip = rec;
  s.log('screen:settings');
  await s.wait(2.6);
  return s;
}

/** The real app icon, rendered large for the end card. */
async function captureIcon(browser) {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 8 });
  const page = await context.newPage();
  await page.clock.install({ time: START_TIME });
  await page.clock.pauseAt(START_TIME + 1);
  await page.goto(Session.baseUrl);
  await page.clock.runFor(700);
  const icon = page.getByText('Haptic Heist').locator('xpath=preceding-sibling::*[1]');
  await icon.screenshot({ path: path.join(CLIPS, 'app-icon.png'), omitBackground: true });
  await context.close();
}

/* ───────────────────────── Main ───────────────────────── */

(async () => {
  buildWeb();
  const { server, port } = await serve();
  Session.baseUrl = `http://localhost:${port}/`;
  fs.mkdirSync(CLIPS, { recursive: true });
  const manifestPath = path.join(CLIPS, 'clips.json');
  const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};
  const browser = await chromium.launch();
  const jobs = { hero: clipHero, logo: clipLogo, decoy: clipDecoy, veteran: clipVeteran };
  try {
    for (const [name, fn] of Object.entries(jobs)) {
      if (only.length && !only.includes(name)) continue;
      fs.rmSync(path.join(CLIPS, name), { recursive: true, force: true });
      const t0 = Date.now();
      console.log(`› Capture « ${name} »…`);
      const s = await fn(browser);
      manifest[name] = { dial: s.dialBox || null, logo: s.logoBox || null, frames: s.frame, fps: FPS, width: VIEWPORT.width * DPR, height: VIEWPORT.height * DPR, viewport: VIEWPORT, safeArea: SAFE_AREA, events: s.events, fingers: s.fingers };
      await s.close();
      console.log(`  ${s.frame} images en ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    }
    if (!only.length || only.includes('icon')) await captureIcon(browser);
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
