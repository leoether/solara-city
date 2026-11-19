# SOLARA CITY

[![make.fun](https://img.shields.io/badge/make.fun-gta6--01-f2c14e)](https://make.fun/c/gta6-01)
[![entry](https://img.shields.io/badge/entry-SOLARA%20CITY-ff7e6b)](https://make.fun/c/gta6-01)
[![license](https://img.shields.io/badge/license-MIT-39d353)](LICENSE)

Game open-world crime top-down di browser: jelajahi kota matahari terbenam
**Solara** dengan jalan kaki atau mobil curian, kejar-kejaran dengan polisi,
dan selesaikan 4 misi sampai jadi **SOLARA LEGEND** ($3.100).

## Cara main

- **WASD / panah** — jalan & nyetir (Shift = lari)
- **E** — curi mobil / keluar mobil
- **Mouse** — arahkan, **klik / spasi** — tembak
- **M** — mulai misi berikutnya
- **P / Esc** — pause, **R** — kembali ke checkpoint
- Progres tersimpan otomatis di `localStorage` (Continue di boot screen).

## Misi

1. **Paket Panas** (+$300) — ambil paket di gudang utara, antar ke dermaga selatan.
2. **Kabur dari Blokade** (+$500) — sampai ke parkir timur sebelum timer 75 detik habis, sambil dikejar polisi.
3. **Badai Sirene** (+$800) — bertahan 45 detik di wanted level 3.
4. **Coupe Emas** (+$1.500) — curi coupe emas dari lot terjaga di barat, bawa ke penanda tanpa tertangkap.

Total $3.100 = **SOLARA LEGEND**. Tertangkap (BUSTED) kena denda $120 dan
respawn; mati (WASTED) retry dari checkpoint terakhir.

## Fitur

- Kota prosedural: grid jalan bermarka, trotoar, gedung bervariasi, taman,
  lampu jalan, zebra cross, parallax langit/bukit/pohon matahari terbenam.
- Lalu lintas NPC + pejalan kaki yang panik saat ada tembakan.
- Wanted level 1–3: polisi makin cepat dan banyak, sirene berkedip.
- Rasa: screen shake, asap knalpot, percikan api, debu rem, skid marks,
  speed lines, pencahayaan radial mengikuti pemain.
- Suara WebAudio synth (tanpa file audio): mesin, tabrakan, tembakan, sirene, cash.
- HUD: cash, bintang wanted beranimasi, tracker misi, speedometer, minimap.

## Struktur kode

```
game/
  index.html            halaman game (canvas fullscreen)
  src/
    config.js           konstanta tuning (dunia, mobil, misi, ekonomi)
    random.js           RNG deterministik + helper matematika
    world.js            kota prosedural + tabrakan gedung
    vehicles.js         fisika mobil pemain + lalu lintas NPC
    pedestrians.js      pejalan kaki
    police.js           AI kejar polisi + aturan busted
    missions.js         rantai misi 1–4 + wanted per progres
    combat.js           tembakan pemain/polisi + damage
    audio.js            synth WebAudio (mesin, sirene, cash, ...)
    render.js           kamera, kota, efek, pencahayaan
    hud.js              HUD, minimap, menu (boot/pause/busted/wasted/legend)
    shots.js            staging adegan untuk screenshot
    main.js             loop utama, input, save/load, state machine
```

## Jalankan

```sh
node serve.ts        # http://localhost:8080
```

Game murni file statis di bawah `game/`, tanpa build step dan tanpa
permintaan jaringan. Dibangun untuk kompetisi
[make.fun](https://make.fun/c/gta6-01) — topik repo: `makefun`, `ai-agents`,
`bounties`. Lisensi MIT.
