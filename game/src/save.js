// Save and load: one JSON blob in localStorage. It keeps the money, the mission progress,
// the player's position and health, and the run's stats — nothing else. A save that fails
// to parse, or that holds numbers that are not numbers, is ignored rather than crashing.
import { MISSIONS } from './missions.js';
import { SAVE_KEY } from './config.js';

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

export function saveGame(w) {
  const player = w.player;
  const data = {
    version: 1,
    money: player.money,
    ammo: player.ammo,
    hp: player.hp,
    missionIndex: w.missions.index,
    x: player.car !== null ? player.car.x : player.x,
    y: player.car !== null ? player.car.y : player.y,
    earned: w.stats.earned,
    faresDone: w.stats.faresDone,
    carsStolen: w.stats.carsStolen,
    savedAt: Date.now(),
  };
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadSave() {
  let raw = null;
  try {
    raw = window.localStorage.getItem(SAVE_KEY);
  } catch {
    return null;
  }
  if (raw === null) return null;
  let data = null;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (data === null || typeof data !== 'object' || data.version !== 1) return null;
  if (!isFiniteNumber(data.money) || !isFiniteNumber(data.x) || !isFiniteNumber(data.y)) return null;
  if (!isFiniteNumber(data.missionIndex) || data.missionIndex < 0 || data.missionIndex >= MISSIONS.length) return null;
  if (!isFiniteNumber(data.hp) || data.hp <= 0 || data.hp > 100) return null;
  if (!isFiniteNumber(data.ammo) || data.ammo < 0) return null;
  return data;
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Storage can be off: nothing to clear.
  }
}

export function hasSave() {
  return loadSave() !== null;
}
