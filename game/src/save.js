// Save and load through localStorage: cash, mission progress, position,
// health and ammo. A save never blocks play — if storage is off, the game
// just keeps going.

import { SAVE_KEY } from './config.js';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data.cash !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

export function storeSave(state) {
  try {
    const { player, missions } = state;
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: player.cash,
      missionsDone: player.missionsDone,
      missionIndex: missions.index,
      faresDone: player.faresDone,
      pickups: player.pickups,
      x: player.x,
      y: player.y,
      health: player.health,
      ammo: player.ammo,
      savedAt: Date.now(),
    }));
    return true;
  } catch {
    return false;
  }
}

export function restoreSave(state, save) {
  const { player, missions } = state;
  player.cash = save.cash;
  player.missionsDone = save.missionsDone || 0;
  player.faresDone = save.faresDone || 0;
  player.pickups = save.pickups || 0;
  player.x = save.x;
  player.y = save.y;
  player.health = save.health ?? 100;
  player.ammo = save.ammo ?? 24;
  missions.index = save.missionIndex || 0;
  missions.step = 0;
  missions.collected = 0;
  missions.timer = 0;
  if (missions.index >= missions.defs.length) {
    missions.finished = true;
    missions.active = false;
  }
}

export function wipeSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing saved, nothing to clear.
  }
}
