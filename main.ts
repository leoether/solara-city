// SOLARA CITY — main.ts
// Entrypoint make.fun (Node 22, stdlib saja): salin game/ + screenshots/
// dari repo ke direktori output, lalu tulis /output/dossier.json dengan
// buildDossier dari vendor/makefun-game.ts (kit, byte-identik dengan scorer).
// Deterministik: dua run menulis byte yang sama.

import { cpSync, mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

// Gagal cepat bila screenshot belum dibuat (gate butuh 3-4 gambar).
const shots = readdirSync(join(repoRoot, 'screenshots')).filter((f) => /\.(png|jpe?g)$/i.test(f));
if (shots.length < 3 || shots.length > 4) {
  throw new Error(`SOLARA CITY: screenshots/ harus berisi 3-4 gambar, ada ${shots.length}`);
}

mkdirSync(outDir, { recursive: true });
mkdirSync(join(outDir, 'game'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });

// Salin seluruh game/ (file statis, tanpa build step).
cpSync(join(repoRoot, 'game'), join(outDir, 'game'), { recursive: true });
// Salin screenshot (3-4 JPEG hasil playtest di sesi ini).
cpSync(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });

// Dossier: cap sesuai gate gta6-01 (gate.json).
const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
console.log(`SOLARA CITY: wrote ${outDir} (dossier ${dossier.length} bytes)`);
