// SOLARA CITY v3 — make.fun program entrypoint (Node 22+, stdlib only).
//
// Hands in the game built in this repo: copies game/ (the playable static
// game) and screenshots/ (the 4 dossier screenshots) next to this file into
// /output (or $MAKEFUN_OUTPUT_DIR outside the grader), then writes
// /output/dossier.json with the kit's vendored buildDossier library — the
// same library the scorer uses, so the dossier always matches the bytes.
//
// Bare run is the normal path (no flags needed):
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
// An empty MAKEFUN_OUTPUT_DIR (e.g. `MAKEFUN_OUTPUT_DIR= node main.ts`)
// would otherwise make mkdirSync/cpSync fail with a cryptic ENOENT.
const out = (process.env.MAKEFUN_OUTPUT_DIR ?? '/output').trim() || '/output';
const gameDir = join(here, 'game');
const shotsDir = join(here, 'screenshots');

if (!existsSync(gameDir)) {
  throw new Error(`game/ is missing — expected at ${gameDir}`);
}
if (!existsSync(join(gameDir, 'index.html'))) {
  throw new Error('game/index.html is missing — the build is incomplete');
}

mkdirSync(out, { recursive: true });
cpSync(gameDir, join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(shotsDir)) cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });

// Pre-flight: the scorer refuses more than 4 screenshots, or any over
// 256 KiB. Fail loudly here instead of handing in a refused entry.
const shots = existsSync(shotsDir) ? readdirSync(shotsDir).filter((f) => /\.(png|jpe?g)$/i.test(f)) : [];
if (shots.length === 0 || shots.length > 4) {
  throw new Error(`expected 1-4 screenshots, found ${shots.length}`);
}
for (const f of shots) {
  const size = statSync(join(shotsDir, f)).size;
  if (size > 262144) throw new Error(`screenshot ${f} is ${size} bytes (cap 262144)`);
}

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes
// the bytes; the others refuse an entry the scorer would refuse (more than
// 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB
// of game files, in all, or a path under game/ over 1000 bytes).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

console.log(`SOLARA CITY v3 handed in: ${shots.length} screenshots, dossier written to ${join(out, 'dossier.json')}`);

// Verify the handoff: the dossier must parse, and the copied game tree
// must actually contain the entrypoint and its modules.
const dossierPath = join(out, 'dossier.json');
const dossier = JSON.parse(readFileSync(dossierPath, 'utf8'));
if (!dossier || typeof dossier !== 'object') throw new Error('dossier.json did not parse to an object');
let gameFiles = 0;
const walk = (dir) => {
  for (const f of readdirSync(dir, { withFileTypes: true })) {
    if (f.isDirectory()) walk(join(dir, f.name));
    else gameFiles++;
  }
};
walk(join(out, 'game'));
if (!existsSync(join(out, 'game', 'index.html')) || !existsSync(join(out, 'game', 'src', 'main.js'))) {
  throw new Error('handed-in game/ is missing index.html or src/main.js');
}
console.log(`verified: dossier ${statSync(dossierPath).size} bytes, ${gameFiles} game files, shots: ${shots.join(', ')}`);
