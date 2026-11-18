# SOLARA CITY — an open-world crime game

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/leoether/solara-city/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/leoether/solara-city/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Rico just got off the bus with empty pockets and a borrowed jacket.** Mama Lou runs
Solara — a sun-soaked coastal city of palm avenues, glass towers and a beach boardwalk —
and four jobs stand between Rico and the title of **Solara Legend**: jack a car, deliver
the package before the clock runs out, survive a 3-star police hunt, and steal the gold
coupe home.

## What is in the game

- **A real open world:** a procedural 5×5 road-grid city (~64 buildings, palms, lamps,
  the gold Solara Tower, beach + ocean), all generated in code — no external assets.
- **On foot and behind the wheel:** third-person walking (WASD + mouse camera), arcade
  driving, and stealing any parked or traffic car with **E**.
- **A living city:** 12 traffic cars looping the grid, 20 pedestrians who flee from
  speeding cars and gunfire.
- **Wanted 1–5 stars:** stealing, running people over and shooting draw the Solara PD —
  police cars chase and ram, foot cops close in and shoot. Hide and the heat cools off.
- **Four chained story missions** from fixer Mama Lou, with timers, a survival stretch,
  a gold target car, cash rewards and a save that persists in localStorage.
- **Combat:** hitscan shooting (click) and close-quarters punches, with muzzle flash.
- **HUD + live minimap:** health, cash, wanted stars, mission objective with distance,
  mission timer, and a 2D top-down minimap with blips for the target, police and cars.
- **Polish:** start screen with the story, pause, busted / wasted / legend end screens,
  and fully synthesised WebAudio sound (engine hum, two-tone siren, gunshots, jingles).

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Walk / drive |
| Mouse drag | Orbit camera |
| Click | Shoot |
| E | Steal car / exit car |
| Shift | Run |
| P / Esc | Pause |
| M | Mute |

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

100% static, 100% offline — `game/` holds everything (`vendor/three.min.js` is vendored;
no network request is made at runtime). Screenshots are real renders of the game, staged
deterministically with `?shot=cover|street|police|mission&seed=1`.

## Entry

Built for the [make.fun **gta6-01** bounty](https://make.fun/bounty/gta6-01) — "Make GTA 6",
an original open-world crime game. A completely original game: no Rockstar characters,
names, maps or assets.
