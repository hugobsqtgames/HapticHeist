/**
 * Renders the App Store Preview from the composer page, frame by frame.
 *
 *   node scripts/render.cjs                          → out/haptic-heist-preview.mp4 (iPhone mis en scène)
 *   node scripts/render.cjs --variant=store          → out/haptic-heist-preview-store.mp4 (plein écran)
 *   node scripts/render.cjs --stills=0.5,12.9,28.8   → .cache/stills/*.png (contrôle des plans)
 *   node scripts/render.cjs --frames=300-420         → rendu partiel (brouillon)
 *
 * The soundtrack (.cache/audio/soundtrack.wav, from scripts/soundtrack.mjs) is muxed in when present.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const CACHE = path.join(ROOT, '.cache');
const OUT = path.join(ROOT, 'out');
const arg = (name, def) => {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const VARIANT = arg('variant', 'device');
const STILLS = arg('stills', null);
const RANGE = arg('frames', null);
const SHOTS = process.argv.includes('--screenshots');

function serve() {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json' };
  const server = http.createServer((req, res) => {
    const file = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404);
      return res.end();
    }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'max-age=3600' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, () => resolve({ server, port: server.address().port })));
}

(async () => {
  if (!fs.existsSync(path.join(CACHE, 'clips', 'clips.json'))) throw new Error('Captures absentes : lancez d’abord scripts/capture.cjs');
  const { server, port } = await serve();
  const browser = await chromium.launch();
  // Captures App Store 6,9" : 1290 × 2796 (même ratio que la vidéo, rendu net en ×1,456).
  const page = await browser.newPage({ viewport: { width: 886, height: 1920 }, deviceScaleFactor: SHOTS ? 1290 / 886 : 1 });
  page.on('pageerror', (e) => console.error('[composer]', e.message));
  page.on('console', (m) => m.type() === 'error' && console.error('[composer]', m.text()));
  await page.goto(`http://localhost:${port}/composer/index.html?variant=${VARIANT}`);
  await page.waitForFunction(() => window.hh && window.hh.ready, null, { timeout: 30000 });
  const { frames, fps } = await page.evaluate(() => ({ frames: window.hh.frames, fps: window.hh.fps }));
  const shoot = async (n) => {
    await page.evaluate((i) => window.hh.render(i), n);
    return page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 886, height: 1920 } });
  };

  try {
    if (SHOTS) {
      const TL = await import(path.join(ROOT, 'timeline.mjs'));
      const dir = path.join(OUT, 'screenshots');
      fs.mkdirSync(dir, { recursive: true });
      for (const s of TL.SCREENSHOTS) {
        const raw = path.join(CACHE, `${s.name}.png`);
        fs.writeFileSync(raw, await shoot(Math.round(s.t * fps)));
        const file = path.join(dir, `${s.name}.png`);
        await new Promise((r, j) => {
          const p = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-i', raw, '-vf', 'scale=1290:2796:flags=lanczos,format=rgb24', file], { stdio: 'inherit' });
          p.on('close', (c) => (c === 0 ? r() : j(new Error(`ffmpeg ${c}`))));
        });
      }
      console.log(`› ${TL.SCREENSHOTS.length} captures App Store (1290 × 2796) → ${dir}`);
      return;
    }
    if (STILLS) {
      const dir = path.join(CACHE, 'stills', VARIANT);
      fs.mkdirSync(dir, { recursive: true });
      for (const s of STILLS.split(',')) {
        const n = Math.round(parseFloat(s) * fps);
        fs.writeFileSync(path.join(dir, `${s.padStart(5, '0')}.png`), await shoot(n));
      }
      console.log(`› ${STILLS.split(',').length} images fixes → ${dir}`);
      return;
    }

    let [from, to] = [0, frames];
    if (RANGE) [from, to] = RANGE.split('-').map(Number);
    fs.mkdirSync(OUT, { recursive: true });
    const name = VARIANT === 'store' ? 'haptic-heist-preview-store' : 'haptic-heist-preview';
    const silent = path.join(CACHE, `${name}.video.mp4`);
    const ff = spawn('ffmpeg', [
      '-y', '-loglevel', 'error',
      '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-profile:v', 'high', '-level', '4.2',
      '-pix_fmt', 'yuv420p', '-r', String(fps), '-movflags', '+faststart', silent,
    ], { stdio: ['pipe', 'inherit', 'inherit'] });
    const t0 = Date.now();
    for (let n = from; n < to; n++) {
      const png = await shoot(n);
      if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once('drain', r));
      if (n % 60 === 0) process.stdout.write(`\r› ${VARIANT} : image ${n}/${to} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
    }
    ff.stdin.end();
    await new Promise((r, j) => ff.on('close', (c) => (c === 0 ? r() : j(new Error(`ffmpeg ${c}`)))));
    console.log(`\n› vidéo muette : ${silent}`);

    // Assemblage final avec la bande-son (AAC stéréo 48 kHz 256 kb/s, exigences App Store).
    const audio = path.join(CACHE, 'audio', 'soundtrack.wav');
    if (fs.existsSync(audio) && !RANGE) {
      const final = path.join(OUT, `${name}.mp4`);
      await new Promise((r, j) => {
        const p = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-i', silent, '-i', audio, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-ac', '2', '-shortest', '-movflags', '+faststart', final], { stdio: 'inherit' });
        p.on('close', (c) => (c === 0 ? r() : j(new Error(`ffmpeg ${c}`))));
      });
      console.log(`› vidéo finale : ${final}`);
    }
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
