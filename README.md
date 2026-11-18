# SOLARA CITY — an open-world crime game

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/leoether/solara-city/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/leoether/solara-city/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Rico just got off the bus with empty pockets and a borrowed jacket.** Mama Lou runs
Solara — a night city of neon avenues and lit windows — and four jobs stand between
Rico and the title of **Solara Legend**: deliver the package, outrun the police,
survive a 3-star hunt, and steal the gold coupe home.

## What is in the game

- **A real open world:** a procedural 2D top-down night city (7×7 road grid, ~64
  buildings with lit windows, parks, trees, street lamps), all generated in code —
  no external assets.
- **On foot and behind the wheel:** top-down walking (WASD / arrows), arcade driving
  with drift and skid marks, and stealing any parked or traffic car with **E**.
- **A living city:** 13 traffic cars driving the grid, 11 parked cars to steal,
  26 pedestrians who flee from speeding cars and gunfire.
- **Wanted 1–3 stars:** stealing and shooting draw the Solara PD — police cars chase,
  ram and shoot (wanted 2+). Linger next to a cop while slow and you get BUSTED.
- **Four chained story missions** from fixer Mama Lou — deliver, timed escape,
  survive 45s at wanted 3, steal the gold coupe — with cash rewards ($300 / $500 /
  $800 / $1,500) and a save that persists in localStorage. All four pay out $3,100
  and crown you **SOLARA LEGEND**.
- **Combat:** Space to shoot (tracers, muzzle flash, police cars take damage and can
  be wrecked), crash damage, health regen after 8 calm seconds.
- **HUD + live minimap:** cash with legend progress bar, wanted stars, mission
  tracker with timer, speed, health, toasts, and a top-down minimap with blips for
  the target, police and the player.
- **Polish:** boot / pause / busted / wasted / legend screens with click buttons,
  particles (exhaust, sparks, brake dust), screen shake, speed lines, dynamic
  lighting, and fully synthesised WebAudio sound (engine hum, two-tone siren,
  gunshots, jingles).

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Walk / drive |
| E | Steal car / exit car (refuses above speed 60) |
| Space | Shoot |
| P / Esc | Pause |
| Enter | Start / continue / respawn / retry |
| C | Continue from save (boot screen) |
| R | Restart (pause screen) |

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

100% static, 100% offline — `game/` holds everything (plain ES modules, no
bundler, no network request at runtime). Screenshots are real renders of the game,
staged deterministically with `?shot=chase|reward|legend|shootout`.

## Test it

```sh
node playtest-cdp.js   # 24 headless CDP checks + 4 screenshots at 1280x720
```

## Entry

Built for the [make.fun **gta6-01** bounty](https://make.fun/bounty/gta6-01) — "Make GTA 6",
an original open-world crime game. A completely original game: no Rockstar characters,
names, maps or assets.
