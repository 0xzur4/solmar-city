// shots.js: The screenshot scenes behind ?shot=chase|foot|drive|mission. Each one 
import { STEP } from './config.js';
import { createCar } from './vehicles.js';
import { placePoint } from './missions.js';
import { fixLighting } from './lighting.js';
import { SCREEN_PLAY } from './render.js';

/** The shoot action's bit, as input.js defines it. */
const ACTION_SHOOT = 32;

function angleDifference(a, b) {
  let diff = b - a;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

function driveControls(w, targetX, targetY) {
  const car = w.player.car;
  const wantAngle = Math.atan2(targetY - car.y, targetX - car.x);
  // Aim for the right-hand lane, the way the traffic AI drives: the car meets oncoming
  // traffic in its own lane instead of head-on down the centre line.
  const aimX = targetX + -Math.sin(wantAngle) * 24;
  const aimY = targetY + Math.cos(wantAngle) * 24;
  const diff = angleDifference(car.angle, Math.atan2(aimY - car.y, aimX - car.x));
  return {
    move: { x: Math.max(-1, Math.min(1, diff * 2)), y: -1 },
    run: false,
    aimX: car.x + Math.cos(car.angle) * 100,
    aimY: car.y + Math.sin(car.angle) * 100,
    actions: 0,
    handbrake: false,
  };
}

function walkControls(w, targetX, targetY) {
  const player = w.player;
  const dx = targetX - player.x;
  const dy = targetY - player.y;
  const length = Math.hypot(dx, dy) || 1;
  return {
    move: { x: dx / length, y: dy / length },
    run: false,
    aimX: targetX,
    aimY: targetY,
    actions: 0,
    handbrake: false,
  };
}

function putPlayerInCar(w, model, x, y, angle) {
  const car = createCar(model, x, y, angle, { parked: false, color: undefined });
  w.cars.push(car);
  w.player.car = car;
  w.player.onFoot = false;
  w.player.x = x;
  w.player.y = y;
  car.driver = true;
  return car;
}

/** Clear the road ahead of a driving shot — traffic and parked cars both — so the staged car
 * is moving, not queued in traffic or clipped by a parked car at the road's edge. */
function clearRoute(w, yCenter, xMin, xMax, halfWidth) {
  // Police cars stay: they are the chase. Everything else on the road goes.
  w.cars = w.cars.filter((car) => {
    if (car.police) return true;
    const onRoute = car.y > yCenter - halfWidth && car.y < yCenter + halfWidth && car.x > xMin && car.x < xMax;
    return !onRoute;
  });
}

function setMission(w, index, step) {
  w.missions.index = index;
  w.missions.step = step;
  w.missions.started = true;
  w.missions.timer = 0;
}

function setWanted(w, stars) {
  const thresholds = [15, 35, 55, 75, 90];
  w.wanted.heat = thresholds[stars - 1] + 5;
  w.wanted.stars = stars;
  w.wanted.lastCrime = w.time;
}

function runSteps(w, seconds, controlsFor) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    w.step(STEP, controlsFor(w, i, steps));
  }
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * chase: a five-star night chase through downtown, helicopter overhead (the cover shot).
 * foot: on-foot combat at a downtown intersection at golden hour, cops closing in.
 * drive: cruising downtown at golden hour, towers and neon on both sides.
 * mission: holding the bank doors at night while the police close in.
 */
export function stageShot(name, world) {
  world.reset();
  if (name === 'chase') {
    fixLighting(world.lighting, 'night');
    // East along the downtown street: towers, neon, sirens, the sports car at speed.
    // A long run-up and a mid-run re-clear keep the car moving: traffic wanders into
    // the street during staging, and every ram halves the car's speed, so a car that
    // gets boxed once never gets going again.
    clearRoute(world, 1300, 0, 3600, 150);
    putPlayerInCar(world, 'sports', 800, 1300, 0);
    setMission(world, 3, 1);
    setWanted(world, 5);
    runSteps(world, 3, (w, i, steps) => {
      if (i === Math.floor(steps / 2)) clearRoute(w, 1300, 0, 3600, 150);
      return driveControls(w, 3100, 1300);
    });
    // The police spawn 700 away and close in over time; put four of them in
    // the frame — two tight behind the player, two closing in from ahead.
    const car = world.player.car;
    world.policeCars.slice(0, 4).forEach((policeCar, i) => {
      const ahead = i >= 2;
      policeCar.x = car.x + (ahead ? 220 + (i - 2) * 110 : -280 - i * 130);
      policeCar.y = car.y + (i === 1 ? -55 : i === 3 ? 55 : 0);
      policeCar.angle = ahead ? Math.PI : 0;
      policeCar.vx = ahead ? -420 : 420;
      policeCar.vy = 0;
    });
    return { screen: SCREEN_PLAY };
  }
  if (name === 'foot') {
    fixLighting(world.lighting, 'golden');
    setMission(world, 2, 0);
    setWanted(world, 2);
    // On foot at the downtown intersection, shooting at the cops who come for the package.
    // The walk is short on purpose: the park contact's marker stays unfinished. The cops
    // start far enough that they only just reach the player as the frame is taken.
    world.player.x = 1500;
    world.player.y = 1250;
    world.player.ammo = 24;
    for (const pack of world.packages) {
      if (Math.hypot(pack.x - world.player.x, pack.y - world.player.y) < 350) {
        pack.x = 300;
        pack.y = 300;
      }
    }
    for (let i = 0; i < 2; i += 1) {
      world.footPolice.push({
        x: world.player.x + (i === 0 ? 120 : -80),
        y: world.player.y + (i === 0 ? -500 : 500),
        angle: Math.PI,
        speed: 0,
        radius: 14,
        hp: 60,
        isCop: true,
        arrestTimer: 0,
        walkPhase: 0,
      });
    }
    runSteps(world, 1.5, (w, i, steps) => {
      const cop = w.footPolice[0];
      const aimX = cop !== undefined ? cop.x : w.player.x + 100;
      const aimY = cop !== undefined ? cop.y : w.player.y;
      const controls = walkControls(w, 1600, 1250);
      controls.aimX = aimX;
      controls.aimY = aimY;
      // One shot only, on the final step, so the muzzle flash is fresh.
      controls.actions = i === steps - 1 ? ACTION_SHOOT : 0;
      return controls;
    });
    return { screen: SCREEN_PLAY };
  }
  if (name === 'drive') {
    fixLighting(world.lighting, 'golden');
    clearRoute(world, 1300, 0, 3600, 150);
    putPlayerInCar(world, 'muscle', 1500, 1300, 0);
    setMission(world, 0, 1);
    runSteps(world, 2.5, (w) => driveControls(w, 3100, 1300));
    return { screen: SCREEN_PLAY };
  }
  if (name === 'mission') {
    fixLighting(world.lighting, 'night');
    setMission(world, 6, 1);
    world.missions.timer = 8;
    setWanted(world, 3);
    const point = placePoint(world.city, 'bank');
    world.player.x = point.x;
    world.player.y = point.y;
    for (let i = 0; i < 2; i += 1) {
      world.footPolice.push({
        x: point.x - 200 - i * 80,
        y: point.y + 140 - i * 120,
        angle: 0,
        speed: 0,
        radius: 14,
        hp: 60,
        isCop: true,
        arrestTimer: 0,
        walkPhase: 0,
      });
    }
    runSteps(world, 6, (w) => {
      const marker = placePoint(w.city, 'bank');
      return walkControls(w, marker.x + Math.sin(w.time) * 40, marker.y + Math.cos(w.time) * 40);
    });
    // Police rams shove the player off the point while staging: put them back on it and
    // snap the camera, so the beacon and the player share the frame.
    world.player.x = point.x + 30;
    world.player.y = point.y;
    world.player.vx = 0;
    world.player.vy = 0;
    world.camera.x = world.player.x;
    world.camera.y = world.player.y;
    return { screen: SCREEN_PLAY };
  }
  // Any other name stages the title backdrop.
  world.reset();
  return { screen: SCREEN_PLAY };
}
