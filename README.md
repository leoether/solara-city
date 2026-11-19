# SOLARA CITY

[![make.fun](https://img.shields.io/badge/make.fun-bounty-ff6b35)](https://make.fun)
[![AI Agents](https://img.shields.io/badge/ai--agents-gta6--01-7b61ff)](https://make.fun)
[![Bounties](https://img.shields.io/badge/bounties-gta6--01-2ecc71)](https://make.fun)

A sun-soaked GTA-style top-down open-world game, built fresh for the
**gta6-01** make.fun bounty (round 4, v5 rebuild). Steal cars, outrun the
police, run four missions, and become a **SOLARA LEGEND**.

## How to play

```bash
node main.ts        # serves the game at http://localhost:8080
# or
node serve.ts 8901  # dev server
```

Open the page in a browser and press **Start** (or Enter).

| Key | Action |
| --- | --- |
| WASD / Arrow keys | Walk & drive |
| E | Steal a car / exit a car |
| Mouse click / Space | Shoot |
| P / Esc | Pause |
| M | Mute |
| Enter | Continue / respawn |

## Missions

1. **Kurir Paket (+$300)** — pick up the package, deliver it to the green marker.
2. **Kabur! (+$500)** — reach the green marker before the 45s timer runs out while police chase you.
3. **Bertahan (+$800)** — survive 30 seconds at wanted level 3.
4. **Coupe Emas (+$1500)** — steal the guarded gold coupe and bring it to the garage.

Finish all four (total **$3.100**) to become a **SOLARA LEGEND**. Progress
auto-saves to `localStorage`; **Continue** on the boot screen resumes it.

Getting **busted** costs $50 and respawns you; dying shows **WASTED** and
retries from your last checkpoint.

## Game feel

- Dynamic screen shake on crashes, hard turns and hits
- Exhaust smoke, crash sparks, brake dust, skid marks
- Speed lines at high speed, hit flash, animated wanted stars
- Synthesized WebAudio: engine, crashes, gunshots, police sirens, cash jingles
- Dynamic lighting around the player, parallax sky / hills / tree line
- Minimap with player, police and mission targets

## Tech

- Plain ES modules, no build step, no audio files — `game/src/`:
  `state.js` (shared state + tuning), `world.js` (city gen + drawing),
  `vehicles.js` (traffic + driving physics), `police.js` (chase AI),
  `missions.js` (missions 1–4 + save), `render.js` (camera, lighting,
  screens), `hud.js` (cash, stars, tracker, minimap), `shots.js`
  (screenshot presets), `main.js` (bootstrap + game loop).
- `main.ts` — make.fun entrypoint, serves the game + `/health`.
- `playtest-cdp.js` — headless Chrome CDP full-loop playtest
  (win path + busted + wasted, 0 console errors).
- `capture-shots.js` — captures the 4 required 1280x720 screenshots.

## License

MIT — see [LICENSE](LICENSE).
