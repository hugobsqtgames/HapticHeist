/**
 * Lets the Node video scripts import the app's own TypeScript modules (`@/…`),
 * so the video reuses the real loot generator and the real sound synthesis
 * instead of copies. Native-only modules are replaced by inert stubs.
 */
const fs = require('fs');
const path = require('path');
const Module = require('module');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '../../..');
const STUBS = {
  'expo-file-system': { File: class {}, Paths: {} },
  'react-native': { Platform: { OS: 'node', select: (o) => o.default } },
};

const resolveTs = (base) => {
  for (const ext of ['.ts', '.tsx', '/index.ts', '/index.tsx']) {
    if (fs.existsSync(base + ext)) return base + ext;
  }
  return null;
};

const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (request.startsWith('@/')) {
    const hit = resolveTs(path.join(ROOT, 'src', request.slice(2)));
    if (hit) return hit;
  }
  if (request.startsWith('.') && parent && parent.filename && parent.filename.startsWith(path.join(ROOT, 'src'))) {
    const hit = resolveTs(path.resolve(path.dirname(parent.filename), request));
    if (hit) return hit;
  }
  return origResolve.call(this, request, parent, ...rest);
};

const origLoad = Module._load;
Module._load = function (request, ...rest) {
  if (STUBS[request]) return STUBS[request];
  return origLoad.call(this, request, ...rest);
};

for (const ext of ['.ts', '.tsx']) {
  require.extensions[ext] = (m, filename) => {
    const out = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.React },
      fileName: filename,
    });
    m._compile(out.outputText, filename);
  };
}

/** Deterministic Math.random for reproducible content. */
function seedRandom(seed) {
  let a = seed >>> 0;
  Math.random = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

module.exports = { ROOT, seedRandom };
