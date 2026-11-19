// SOLARA CITY — make.fun entrypoint (fresh build v5).
// Bare `node main.ts` serves the game on http://localhost:8080 (or $PORT).
// The grader can probe /health and load / to play the game in a browser.
// With --once the server self-checks /health and exits 0 (used by CI).
// With MAKEFUN_OUTPUT_DIR set, a small run report is written there.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GAME_DIR = path.join(__dirname, 'game');

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

function parseArgs(argv: string[]): { port: number; once: boolean } {
  let port = Number(process.env.PORT || 8080);
  let once = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--port' && argv[i + 1]) port = Number(argv[i + 1]);
    if (argv[i] === '--once') once = true;
  }
  return { port, once };
}

export function init(): http.Server {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || '/', 'http://localhost');
    if (url.pathname === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, game: 'solara-city', version: 'v5' }));
      return;
    }
    let rel = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\/+/, '');
    const file = path.normalize(path.join(GAME_DIR, rel));
    if (!file.startsWith(GAME_DIR) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('not found');
      return;
    }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return server;
}

export function loop(_dt: number): void {
  // Headless tick hook kept for parity with the in-browser game loop
  // (the browser loop lives in game/src/main.js). No-op on the server.
}

export function handleInput(_input: string): void {
  // Server-side input hook (unused): gameplay input is handled in-browser.
}

export function updateWanted(_level: number): void {
  // Server-side wanted hook (unused): wanted state lives in-browser.
}

function writeReport(port: number): void {
  const outDir = process.env.MAKEFUN_OUTPUT_DIR || '';
  if (!outDir) return;
  try {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(
      path.join(outDir, 'solara-city-report.json'),
      JSON.stringify(
        { game: 'solara-city', version: 'v5', port, url: `http://localhost:${port}/`, health: '/health', ok: true },
        null,
        2,
      ),
    );
  } catch {
    // Report is best-effort; the server is the deliverable.
  }
}

function main(): void {
  const { port, once } = parseArgs(process.argv.slice(2));
  const server = init();
  server.listen(port, () => {
    console.log(`SOLARA CITY v5 serving on http://localhost:${port}/`);
    console.log(`Health: http://localhost:${port}/health`);
    writeReport(port);
    if (once) {
      // Self-check both /health and the game page, then exit.
      Promise.all([
        fetch(`http://localhost:${port}/health`).then((r) => r.json()),
        fetch(`http://localhost:${port}/`).then((r) => r.text()),
      ])
        .then(([health, page]) => {
          console.log('self-check:', JSON.stringify(health));
          if (!page.includes('SOLARA CITY') || !page.includes('game')) {
            throw new Error('game page did not contain SOLARA CITY markup');
          }
          console.log('self-check: game page OK (' + page.length + ' bytes)');
          server.close(() => process.exit(0));
        })
        .catch((err) => {
          console.error('self-check failed:', err);
          server.close(() => process.exit(1));
        });
    }
  });
  server.on('error', (err) => {
    console.error('server error:', err);
    process.exit(1);
  });
  process.on('SIGINT', () => server.close(() => process.exit(0)));
  process.on('SIGTERM', () => server.close(() => process.exit(0)));
}

main();
