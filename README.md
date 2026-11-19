# SOLARA CITY

[![make.fun](https://img.shields.io/badge/make.fun-GTA%206%20bounty-orange)](https://make.fun/c/gta6-01)
[![entry](https://img.shields.io/badge/entry-SOLARA%20CITY-gold)](https://make.fun/c/gta6-01)
[![license](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)

Game kota terbuka 2D bergaya GTA — orisinal, tanpa aset dari game komersial
mana pun. Dibangun untuk kompetisi **GTA 6** di make.fun.

**Topik repo:** `makefun` `ai-agents` `bounties`

## Cara main

```sh
node serve.ts
# buka http://localhost:8080
```

Tidak ada build step: `game/` adalah file statis, `game/index.html` langsung
dimainkan di desktop Chrome. Semua suara disintesis dengan WebAudio —
tanpa file audio, tanpa request jaringan.

## Kontrol

| Tombol | Aksi |
| --- | --- |
| WASD / panah | Jalan kaki / nyetir |
| E | Curi mobil (atau keluar dari mobil) |
| Spasi / klik | Tembak |
| M | Mulai misi berikutnya |
| P / Esc | Jeda |
| R | Klakson |
| Enter | Mulai / respawn / retry |

## Misi (total $3.100 = SOLARA LEGEND)

1. **Paket Kilat** (+$300) — ambil paket, antar ke tujuan.
2. **Kabur dari Kejaran** (+$500) — sampai ke tempat aman sebelum timer
   habis sambil dikejar polisi wanted 1–2.
3. **Bertahan di Wanted 3** (+$800) — bertahan 45 detik, polisi agresif.
4. **Coupe Emas** (+$1.500) — curi coupe emas dari lokasi terjaga, antar
   ke penanda ungu tanpa tertangkap (busted = misi gagal, coba lagi).

Wanted naik 1 → 2 → 3 mengikuti progres misi; polisi makin cepat dan
makin banyak. Busted = respawn (cash dipotong 10%), WASTED = retry dari
checkpoint. Progres tersimpan otomatis ke localStorage tiap misi selesai —
tombol **Lanjutkan** di boot screen memuatnya.

## Fitur

- Kota prosedural: jalan bermarka, trotoar, gedung bervariasi, lampu jalan,
  taman dan pohon palem, lalu lintas dan pejalan kaki.
- Game feel: screen shake, asap knalpot, percikan api tabrakan, debu rem,
  skid marks, speed lines, wanted stars beranimasi.
- Visual: dynamic lighting mengikuti mobil, parallax langit/bukit/palem,
  minimap (pemain, polisi, target misi), HUD cash/wanted/kecepatan.
- Suara synth WebAudio: mesin, tabrakan, tembakan, sirene, bunyi cash.

## Struktur kode

- `main.ts` — entrypoint: menyalin `game/` + `screenshots/` ke output dan
  menulis `dossier.json` (make.fun).
- `serve.ts` — dev server statis untuk main lokal.
- `game/index.html` — halaman game.
- `game/src/main.js` — orkestrator: `init()`, `loop(dt)`,
  `handleInput()`, `updateWanted(level)`.
- `game/src/state.js` — state + save/load localStorage.
- `game/src/world.js` — kota prosedural + parallax.
- `game/src/vehicles.js` — fisika mobil + lalu lintas.
- `game/src/police.js` — AI polisi + sistem wanted.
- `game/src/missions.js` — logika misi 1–4.
- `game/src/render.js` — rendering Canvas 2D + HUD + minimap + menu.
- `game/src/audio.js` — synth suara WebAudio.

## Lisensi

MIT — lihat [LICENSE](./LICENSE).
