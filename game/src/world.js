// world.js: The world: one object holding everything, and the one step that advanc
import { CAMERA, MONEY, PICKUPS, PLAYER, PISTOL, TRAFFIC, VIEW, WORLD } from './config.js';
import { createCity, randomRoadPoint, randomSidewalkPoint } from './city.js';
import { createEffects } from './effects.js';
import { createBullets, stepBullets } from './combat.js';
import { createMissionState, placePoint, restartMission, stepMarker, updateMissions } from './missions.js';
import { clearWanted, stepPolice } from './police.js';
import { spawnPeds, stepPeds } from './pedestrians.js';
import { stepPlayer } from './player.js';
import { collideCars, createCar, spawnParkedCars, spawnTrafficCars, stepTraffic } from './vehicles.js';
import { createLighting, stepLighting } from './lighting.js';
import { applyHero } from './heroes.js';
import { WEAPONS } from './weapons.js';

export const EVENT_MISSION = 1;
export const EVENT_BUSTED = 2;
export const EVENT_WASTED = 4;

const CRATE_WEAPONS = ['smg', 'shotgun', 'plasma'];

function makePickup(w, kind, point) {
  const pickup = {
    kind,
    x: point.x,
    y: point.y,
    value: kind === 'cash' ? MONEY.cashPickup : kind === 'health' ? MONEY.healthPack : PISTOL.pickupAmmo,
    taken: false,
  };
  if (kind === 'weapon') pickup.weapon = CRATE_WEAPONS[Math.floor(w.random() * CRATE_WEAPONS.length)];
  return pickup;
}

/** The pickup kinds still missing from the street, given how many of each are lying around. */
function missingKinds(counts) {
  const kinds = [];
  for (let i = counts.cash; i < PICKUPS.cash; i += 1) kinds.push('cash');
  for (let i = counts.health; i < PICKUPS.health; i += 1) kinds.push('health');
  for (let i = counts.ammo; i < PICKUPS.ammo; i += 1) kinds.push('ammo');
  for (let i = counts.weapon; i < PICKUPS.weapons; i += 1) kinds.push('weapon');
  return kinds;
}

function spawnPickups(w) {
  for (const kind of missingKinds({ cash: 0, health: 0, ammo: 0, weapon: 0 })) {
    w.pickups.push(makePickup(w, kind, randomSidewalkPoint(w.random)));
  }
}

function populate(w) {
  w.cars = [
    ...spawnTrafficCars(w.city, w.random, TRAFFIC.cars),
    ...spawnParkedCars(w.city, w.random, TRAFFIC.parked),
  ];
  w.peds = spawnPeds(w.city, w.random, TRAFFIC.peds);
  w.policeCars = [];
  w.footPolice = [];
  w.pickups = [];
  spawnPickups(w);
  const starter = createCar('sedan', w.city.spawn.x + 54, w.city.spawn.y, Math.PI / 2, { parked: true, color: '#2fb3a6' });
  starter.wasStolen = true;
  w.cars.push(starter);
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
      maxHp: PLAYER.maxHealth,
      hero: 'dario',
      money: MONEY.start,
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
    wanted: { heat: 0, stars: 0, lastCrime: -100 },
    missions: createMissionState(),
    stats: { earned: 0, carsStolen: 0 },
    camera: { x: city.spawn.x, y: city.spawn.y, zoom: CAMERA.zoom },
    marker: null,
    message: { text: '', timer: 0 },
    missionCard: null,
    lighting: createLighting(),
    busted: false,
    penalty: 0,
    lastShot: -100,
    lastShotX: 0,
    lastShotY: 0,
    lastPoliceSpawn: -100,
    sirenTimer: 0,
    sirenHigh: false,
    topupTimer: 0,
    heroId: 'dario',
    ui: { heroIndex: 0 },
  };
  applyHero(w, w.heroId);

  populate(w);

  /** Start over: a fresh city population, a fresh player, the first mission. */
  function reset() {
    w.time = 0;
    w.player.x = city.spawn.x;
    w.player.y = city.spawn.y;
    w.player.angle = 0;
    w.player.vx = 0;
    w.player.vy = 0;
    applyHero(w, w.heroId);
    w.player.money = MONEY.start;
    w.player.onFoot = true;
    w.player.car = null;
    w.player.invuln = 0;
    w.player.lastDamage = -100;
    w.player.lastPunch = -100;
    w.wanted = { heat: 0, stars: 0, lastCrime: -100 };
    w.missions = createMissionState();
    w.stats = { earned: 0, carsStolen: 0 };
    w.camera.x = city.spawn.x;
    w.camera.y = city.spawn.y;
    w.camera.zoom = CAMERA.zoom;
    w.message = { text: '', timer: 0 };
    w.missionCard = null;
    w.busted = false;
    w.penalty = 0;
    w.bullets = createBullets();
    populate(w);
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
    w.player.hp = place === 'hospital' ? w.player.maxHp : 60;
    w.player.invuln = 2;
    w.player.lastDamage = w.time;
    w.busted = false;
    clearWanted(w);

    for (const car of w.policeCars) car.despawn = true;
    w.policeCars = [];
    w.footPolice = [];
    w.camera.x = point.x;
    w.camera.y = point.y;
    restartMission(w);
  }

  function topUp(dt) {
    w.topupTimer -= dt;
    if (w.topupTimer > 0) return;
    w.topupTimer = 5;

    for (const car of w.cars) {
      if (car.wrecked) car.wreckTimer = (car.wreckTimer ?? 0) + 5;
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
    const counts = { cash: 0, health: 0, ammo: 0, weapon: 0 };
    for (const pickup of w.pickups) counts[pickup.kind] += 1;
    for (const kind of missingKinds(counts)) {
      w.pickups.push(makePickup(w, kind, randomSidewalkPoint(random)));
    }
  }

  /** One fixed step. `controls` carries the movement vector, the aim point and the actions. */
  function step(dt, controls) {
    let events = 0;
    w.time += dt;
    stepLighting(w.lighting, dt);
    if (w.message.timer > 0) w.message.timer -= dt;
    if (w.missionCard !== null) {
      w.missionCard.timer -= dt;
      if (w.missionCard.timer <= 0) w.missionCard = null;
    }
    const player = w.player;
    player.aimAngle = Math.atan2(controls.aimY - (player.car !== null ? player.car.y : player.y), controls.aimX - (player.car !== null ? player.car.x : player.x));
    const hpBefore = player.hp;
    player.aimX = controls.aimX;
    player.aimY = controls.aimY;
    stepPlayer(w, controls, dt);
    stepTraffic(w, dt);
    stepPolice(w, dt);
    stepPeds(w, dt);
    stepBullets(w, dt);
    collideCars(w, dt);

    if (player.guard > 0 && player.hp < hpBefore) {
      player.hp = hpBefore;
      if (w.time - (player.lastBlock ?? -1) > 0.15) {
        player.lastBlock = w.time;
        const gx = player.car !== null ? player.car.x : player.x;
        const gy = player.car !== null ? player.car.y : player.y;
        w.effects.sparks(gx, gy);
      }
    }
    if (updateMissions(w, dt)) events |= EVENT_MISSION;
    w.effects.step(dt);
    w.marker = stepMarker(w);


    const lead = player.car !== null ? 0.28 : 0;
    const focusX = (player.car !== null ? player.car.x + player.car.vx * lead : player.x);
    const focusY = (player.car !== null ? player.car.y + player.car.vy * lead : player.y);
    const follow = 1 - Math.exp(-6 * dt);
    w.camera.x += (focusX - w.camera.x) * follow;
    w.camera.y += (focusY - w.camera.y) * follow;
    const speed = player.car !== null ? Math.abs(player.car.speed) : 0;
    const targetZoom = speed > 350 ? CAMERA.zoomFast : CAMERA.zoom;
    w.camera.zoom += (targetZoom - w.camera.zoom) * Math.min(1, CAMERA.zoomLerp * dt);
    const halfW = VIEW.width / (2 * w.camera.zoom);
    const halfH = VIEW.height / (2 * w.camera.zoom);
    w.camera.x = Math.max(halfW, Math.min(WORLD.width - halfW, w.camera.x));
    w.camera.y = Math.max(halfH, Math.min(WORLD.height - halfH, w.camera.y));

    topUp(dt);

    if (w.busted) events |= EVENT_BUSTED;
    if (player.hp <= 0) events |= EVENT_WASTED;
    return events;
  }



  w.reset = reset;
  w.respawn = respawn;
  w.step = step;
  return w;
}
