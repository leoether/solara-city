// SOLARA CITY — main.ts
// Entrypoint for the make.fun GTA 6 bounty (Node 22, standard library only).
// Hands the game in: copies game/ and screenshots/ from this repository
// into the output directory and writes /output/dossier.json with
// buildDossier from vendor/makefun-game.ts. No network, deterministic:
// two runs write the same bytes.
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const REPO_ROOT = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = process.env.MAKEFUN_OUTPUT_DIR || '/output';

// Caps from the competition rules: game/ at most 993 entries / 48 MiB,
// screenshots at most 4 images of 256 KiB, dossier text at most 160 KiB.
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 48 * 1024 * 1024,
  game_path_max_bytes: 1000,
};

function main(): void {
  const gameDir = join(REPO_ROOT, 'game');
  const shotsDir = join(REPO_ROOT, 'screenshots');
  if (!existsSync(gameDir)) {
    throw new Error(`game/ not found in ${REPO_ROOT}`);
  }
  mkdirSync(OUT_DIR, { recursive: true });
  // Start clean so a stale file can never leak into the entry.
  rmSync(join(OUT_DIR, 'game'), { recursive: true, force: true });
  rmSync(join(OUT_DIR, 'screenshots'), { recursive: true, force: true });
  rmSync(join(OUT_DIR, 'dossier.json'), { force: true });
  cpSync(gameDir, join(OUT_DIR, 'game'), { recursive: true });
  if (existsSync(shotsDir)) {
    cpSync(shotsDir, join(OUT_DIR, 'screenshots'), { recursive: true });
  }
  const dossier = buildDossier(OUT_DIR, CAPS);
  const dossierPath = join(OUT_DIR, 'dossier.json');
  writeFileSync(dossierPath, dossier);
  if (!existsSync(dossierPath)) {
    throw new Error('dossier.json was not written');
  }
  console.log(`SOLARA CITY entry written to ${OUT_DIR} (${dossier.length} byte dossier).`);
}

main();
