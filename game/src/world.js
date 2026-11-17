// The world: one object holding everything, and the one step that advances it. The player,
// the traffic, the police, the pedestrians, the missions, the pickups and the camera all
// update here, in that order, so a step is deterministic for a given seed and input.
import { MONEY, PICKUPS, PLAYER, PISTOL, TRAFFIC, VIEW, WORLD } from './config.js';
import { createCity, randomRoadPoint, randomSidewalkPoint } from './city.js';
import { createEffects } from './effects.js';
import { createBullets, stepBullets } from './combat.js';
import { createMissionState, placePoint, restartMission, stepMarker, updateMissions } from './missions.js';
import { clearWanted, stepPolice } from './police.js';
import { createPed, spawnFarePeds, spawnPeds, stepPeds } from './pedestrians.js';
import { stepPlayer } from './player.js';
import { saveGame } from './save.js';
import { collideCars, spawnParkedCars, spawnTrafficCars, stepTraffic } from './vehicles.js';
import { updateEngine } from './audio.js';

export const EVENT_MISSION = 1;
export const EVENT_BUSTED = 2;
export const EVENT_WASTED = 4;

function spawnPickups(w) {
  const kinds = [];
  for (let i = 0; i < PICKUPS.cash; i += 1) kinds.push('cash');
  for (let i = 0; i < PICKUPS.health; i += 1) kinds.push('health');
  for (let i = 0; i < PICKUPS.ammo; i += 1) kinds.push('ammo');
  for (const kind of kinds) {
    const point = randomSidewalkPoint(w.random);
    w.pickups.push({
      kind,
      x: point.x,
      y: point.y,
      value: kind === 'cash' ? MONEY.cashPickup : kind === 'health' ? MONEY.healthPack : PISTOL.pickupAmmo,
      taken: false,
    });
  }
}

function populate(w) {
  w.cars = [
    ...spawnTrafficCars(w.city, w.random, TRAFFIC.cars),
    ...spawnParkedCars(w.city, w.random, TRAFFIC.parked),
  ];
  w.peds = [...spawnPeds(w.city, w.random, TRAFFIC.peds - PICKUPS.farePeds), ...spawnFarePeds(w.city, w.random, PICKUPS.farePeds)];
  w.policeCars = [];
  w.footPolice = [];
  w.pickups = [];
  spawnPickups(w);
}

export function createWorld(random) {
  const city = createCity(random);
  const w = {
    random,
    city,
    effects: createEffects(),
    time: 0,
    player: {
      x: city.spawn.x,
      y: city.spawn.y,
      angle: 0,
      vx: 0,
      vy: 0,
      hp: PLAYER.maxHealth,
      money: MONEY.start,
      ammo: PISTOL.startAmmo,
      onFoot: true,
      car: null,
      invuln: 0,
      lastDamage: -100,
      lastPunch: -100,
      punchTimer: 0,
      shootTimer: 0,
      walkPhase: 0,
      aimAngle: 0,
    },
    cars: [],
    peds: [],
    policeCars: [],
    footPolice: [],
    bullets: createBullets(),
    pickups: [],
    fare: null,
    wanted: { heat: 0, stars: 0, lastCrime: -100 },
    missions: createMissionState(),
    stats: { earned: 0, faresDone: 0, carsStolen: 0 },
    camera: { x: city.spawn.x, y: city.spawn.y },
    marker: null,
    message: { text: '', timer: 0 },
    busted: false,
    penalty: 0,
    lastShot: -100,
    lastShotX: 0,
    lastShotY: 0,
    lastPoliceSpawn: -100,
    sirenTimer: 0,
    sirenHigh: false,
    topupTimer: 0,
    autoSaveTimer: 0,
    saveExists: false,
  };

  populate(w);

  /** Start over: a fresh city population, a fresh player, the first mission. */
  function reset() {
    w.time = 0;
    w.player.x = city.spawn.x;
    w.player.y = city.spawn.y;
    w.player.angle = 0;
    w.player.vx = 0;
    w.player.vy = 0;
    w.player.hp = PLAYER.maxHealth;
    w.player.money = MONEY.start;
    w.player.ammo = PISTOL.startAmmo;
    w.player.onFoot = true;
    w.player.car = null;
    w.player.invuln = 0;
    w.player.lastDamage = -100;
    w.player.lastPunch = -100;
    w.fare = null;
    w.wanted = { heat: 0, stars: 0, lastCrime: -100 };
    w.missions = createMissionState();
    w.stats = { earned: 0, faresDone: 0, carsStolen: 0 };
    w.camera.x = city.spawn.x;
    w.camera.y = city.spawn.y;
    w.message = { text: '', timer: 0 };
    w.busted = false;
    w.penalty = 0;
    w.bullets = createBullets();
    populate(w);
  }

  /** Restore a save: money, mission, position, health, ammo and stats. */
  function applySave(data) {
    reset();
    w.player.money = data.money;
    w.player.ammo = data.ammo;
    w.player.hp = data.hp;
    w.player.x = data.x;
    w.player.y = data.y;
    w.missions.index = data.missionIndex;
    w.stats.earned = data.earned ?? 0;
    w.stats.faresDone = data.faresDone ?? 0;
    w.stats.carsStolen = data.carsStolen ?? 0;
    w.camera.x = data.x;
    w.camera.y = data.y;
    w.message = { text: 'Save loaded — welcome back to Solmar.', timer: 4 };
  }

  /** Busted or wasted: pay the penalty, wake up at the station or the hospital. */
  function respawn(place, lossRate) {
    const penalty = Math.floor(w.player.money * lossRate);
    w.player.money -= penalty;
    w.penalty = penalty;
    if (w.player.car !== null) {
      w.player.car.parked = true;
      w.player.car.traffic = false;
      w.player.car.speed = 0;
      w.player.car.vx = 0;
      w.player.car.vy = 0;
      w.player.car = null;
    }
    w.player.onFoot = true;
    const point = placePoint(city, place);
    w.player.x = point.x;
    w.player.y = point.y;
    w.player.vx = 0;
    w.player.vy = 0;
    w.player.hp = place === 'hospital' ? PLAYER.maxHealth : 60;
    w.player.invuln = 2;
    w.player.lastDamage = w.time;
    w.fare = null;
    w.busted = false;
    clearWanted(w);
    // The police stand down.
    for (const car of w.policeCars) car.despawn = true;
    w.policeCars = [];
    w.footPolice = [];
    w.camera.x = point.x;
    w.camera.y = point.y;
    restartMission(w);
  }

  /** The title screen's living backdrop: traffic and pedestrians only. */
  function attract(dt) {
    w.time += dt;
    stepTraffic(w, dt);
    stepPeds(w, dt);
    w.effects.step(dt);
    // Slowly pan the camera across downtown.
    w.camera.x = 1500 + Math.sin(w.time * 0.02) * 500;
    w.camera.y = 950 + Math.cos(w.time * 0.013) * 260;
    w.camera.x = Math.max(VIEW.width / 2, Math.min(WORLD.width - VIEW.width / 2, w.camera.x));
    w.camera.y = Math.max(VIEW.height / 2, Math.min(WORLD.height - VIEW.height / 2, w.camera.y));
  }

  function topUp(dt) {
    w.topupTimer -= dt;
    if (w.topupTimer > 0) return;
    w.topupTimer = 5;
    // Wrecks older than a minute are towed away; fresh traffic replaces them.
    for (const car of w.cars) {
      if (car.wrecked) car.wreckTimer = (car.wreckTimer ?? 0) + 5;
    }
    const before = w.cars.length;
    w.cars = w.cars.filter((car) => !(car.wrecked && (car.wreckTimer ?? 0) > 60));
    w.policeCars = w.policeCars.filter((car) => w.cars.includes(car));
    if (before !== w.cars.length) {
      const fresh = spawnTrafficCars(city, random, 2);
      for (const car of fresh) {
        const point = randomRoadPoint(random);
        if (Math.hypot(point.x - w.player.x, point.y - w.player.y) > 800) {
          car.x = point.x;
          car.y = point.y;
          w.cars.push(car);
        }
      }
    }
    const trafficCount = w.cars.filter((car) => car.traffic).length;
    if (trafficCount < 16) {
      const fresh = spawnTrafficCars(city, random, 18 - trafficCount);
      for (const car of fresh) {
        const point = randomRoadPoint(random);
        if (Math.hypot(point.x - w.player.x, point.y - w.player.y) > 800) {
          car.x = point.x;
          car.y = point.y;
          w.cars.push(car);
        }
      }
    }
    if (w.peds.length < 34) {
      const fresh = spawnPeds(city, random, 6);
      for (const ped of fresh) {
        if (Math.hypot(ped.x - w.player.x, ped.y - w.player.y) > 500) w.peds.push(ped);
      }
    }
    const fareCount = w.peds.filter((ped) => ped.fare).length;
    if (fareCount < PICKUPS.farePeds) {
      const fresh = spawnFarePeds(city, random, 1);
      const ped = fresh[0];
      if (Math.hypot(ped.x - w.player.x, ped.y - w.player.y) > 500) w.peds.push(ped);
    }
    // Pickups refill over time.
    const counts = { cash: 0, health: 0, ammo: 0 };
    for (const pickup of w.pickups) counts[pickup.kind] += 1;
    const kinds = [];
    for (let i = counts.cash; i < PICKUPS.cash; i += 1) kinds.push('cash');
    for (let i = counts.health; i < PICKUPS.health; i += 1) kinds.push('health');
    for (let i = counts.ammo; i < PICKUPS.ammo; i += 1) kinds.push('ammo');
    for (const kind of kinds) {
      const point = randomSidewalkPoint(random);
      w.pickups.push({
        kind,
        x: point.x,
        y: point.y,
        value: kind === 'cash' ? MONEY.cashPickup : kind === 'health' ? MONEY.healthPack : PISTOL.pickupAmmo,
        taken: false,
      });
    }
  }

  /** One fixed step. `controls` carries the movement vector, the aim point and the actions. */
  function step(dt, controls) {
    let events = 0;
    w.time += dt;
    if (w.message.timer > 0) w.message.timer -= dt;
    const player = w.player;
    player.aimAngle = Math.atan2(controls.aimY - (player.car !== null ? player.car.y : player.y), controls.aimX - (player.car !== null ? player.car.x : player.x));
    stepPlayer(w, controls, dt);
    stepTraffic(w, dt);
    stepPolice(w, dt);
    stepPeds(w, dt);
    stepBullets(w, dt);
    collideCars(w, dt);
    if (updateMissions(w, dt)) events |= EVENT_MISSION;
    w.effects.step(dt);
    w.marker = stepMarker(w);
    // Camera: follow the player or their car, smoothly.
    const focusX = player.car !== null ? player.car.x : player.x;
    const focusY = player.car !== null ? player.car.y : player.y;
    const follow = 1 - Math.exp(-6 * dt);
    w.camera.x += (focusX - w.camera.x) * follow;
    w.camera.y += (focusY - w.camera.y) * follow;
    w.camera.x = Math.max(VIEW.width / 2, Math.min(WORLD.width - VIEW.width / 2, w.camera.x));
    w.camera.y = Math.max(VIEW.height / 2, Math.min(WORLD.height - VIEW.height / 2, w.camera.y));
    // Engine hum follows the driven car.
    updateEngine(player.car !== null ? Math.min(1, Math.abs(player.car.speed) / player.car.spec.maxSpeed) : 0, player.car !== null);
    topUp(dt);
    // Autosave every 30 seconds of play.
    w.autoSaveTimer += dt;
    if (w.autoSaveTimer > 30) {
      w.autoSaveTimer = 0;
      saveGame(w);
    }
    if (w.busted) events |= EVENT_BUSTED;
    if (player.hp <= 0) events |= EVENT_WASTED;
    return events;
  }

  // The returned object IS the world: methods close over it, so a reset that replaces
  // the car list or the mission state is visible to every reader of the same object.
  w.reset = reset;
  w.applySave = applySave;
  w.respawn = respawn;
  w.attract = attract;
  w.step = step;
  return w;
}
