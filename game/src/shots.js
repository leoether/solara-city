// SOLARA CITY v3 — screenshot staging: deterministic scenes for the four
// dossier screenshots, driven through the game's own public API (?shot=
// query param). Each scene sets up a real game state, never a fake image.

export function applyShot(G, name) {
  const api = G.api;
  if (!api) return false;
  if (name === 'start') {
    G.mode = 'boot';
    return true;
  }
  if (name === 'chase') {
    api.start();
    api.giveCar();
    api.setWanted(1);
    api.placePoliceNear(2, 220);
    api.setCarSpeed(430);
    api.teleportToRoad();
    G.renderer.addShake(4);
    return true;
  }
  if (name === 'reward') {
    api.start();
    api.setCash(500);
    api.setMission(1);
    api.showBanner('MISI SELESAI', '+$500', '#7ee787');
    api.toast('Misi 2: Kabur dari Polisi');
    return true;
  }
  if (name === 'legend') {
    api.start();
    api.setCash(3100);
    api.spawnGoldNear();
    api.legend();
    return true;
  }
  if (name === 'shootout') {
    api.start();
    api.giveCar();
    api.setWanted(3);
    api.placePoliceNear(4, 260);
    api.setHealth(62);
    api.fireDemoShots();
    return true;
  }
  return false;
}
