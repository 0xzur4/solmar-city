// The screenshot scenes behind ?shot=chase|foot|drive|mission. Each one plays the real rules
// forward from a fresh world for a fixed number of steps, steered by a small autopilot that
// drives or walks toward the scene's target, so the frame is what real play looks like and
// the same seed always gives the same frame.
import { STEP } from './config.js';
import { createCar } from './vehicles.js';
import { placePoint } from './missions.js';
import { SCREEN_PLAY } from './render.js';

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
  w.cars = w.cars.filter((car) => {
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
    w.step(STEP, controlsFor(w));
  }
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * chase: a police chase at 3 stars, driving for the safehouse (the cover shot).
 * foot: on foot downtown, walking to the park contact among pedestrians.
 * drive: cruising the beach road toward the marina.
 * mission: holding the marina warehouse while the police close in.
 */
export function stageShot(name, world) {
  world.reset();
  if (name === 'chase') {
    // Straight down the beach road toward the safehouse: no turns, no traffic jam,
    // the sports car at speed with the police closing in behind it.
    clearRoute(world, 2045, 0, 3600, 150);
    putPlayerInCar(world, 'sports', 2700, 2000, Math.PI);
    setMission(world, 3, 2);
    setWanted(world, 3);
    runSteps(world, 3.5, (w) => {
      const point = placePoint(w.city, 'safehouse');
      return driveControls(w, point.x, point.y);
    });
    // The police spawn 700 away and close in over time; put the first two right behind
    // the player so the chase reads in the frame.
    const car = world.player.car;
    world.policeCars.slice(0, 2).forEach((policeCar, i) => {
      policeCar.x = car.x + 320 + i * 130;
      policeCar.y = car.y + (i === 0 ? -50 : 55);
      policeCar.angle = Math.PI;
      policeCar.vx = -380;
      policeCar.vy = 0;
    });
    return { screen: SCREEN_PLAY };
  }
  if (name === 'foot') {
    setMission(world, 2, 0);
    // Mid-walk to the park contact: the marker ahead, pedestrians around, step unfinished.
    world.player.x = world.city.park.x - 500;
    world.player.y = world.city.park.y + world.city.park.h / 2;
    runSteps(world, 1.5, (w) => {
      const point = placePoint(w.city, 'park');
      return walkControls(w, point.x, point.y);
    });
    return { screen: SCREEN_PLAY };
  }
  if (name === 'drive') {
    clearRoute(world, 2040, 0, 3600, 150);
    putPlayerInCar(world, 'sedan', 300, 2000, 0);
    setMission(world, 0, 1);
    runSteps(world, 2, (w) => {
      const point = placePoint(w.city, 'marina');
      return driveControls(w, point.x, point.y);
    });
    return { screen: SCREEN_PLAY };
  }
  if (name === 'mission') {
    setMission(world, 4, 1);
    world.missions.timer = 6;
    setWanted(world, 3);
    const point = placePoint(world.city, 'marina');
    world.player.x = point.x;
    world.player.y = point.y;
    runSteps(world, 8, (w) => {
      const marker = placePoint(w.city, 'marina');
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
