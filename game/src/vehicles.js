// vehicles.js: Cars: the player's arcade driving, traffic that follows the road graph
import { CAR_MODELS, CITY, TRAFFIC, WORLD } from './config.js';
import { nearestIntersection, onAsphalt, randomRoadPoint, resolveBuildingCollision } from './city.js';
import { pick, range } from './random.js';
import { playExplosion } from './audio.js';

let nextCarId = 1;

export function createCar(model, x, y, angle, options = {}) {
  const spec = CAR_MODELS[model];
  return {
    id: nextCarId,
    model,
    spec,
    x,
    y,
    angle,
    speed: 0,
    vx: 0,
    vy: 0,
    radius: spec.length / 2,
    color: options.color ?? spec.color,
    parked: options.parked ?? false,
    traffic: options.traffic ?? false,
    police: options.police ?? false,
    driver: options.driver ?? false,
    health: 100,
    wrecked: false,
    smoke: 0,
    cruise: options.cruise ?? TRAFFIC.cruiseSpeed,
    target: null,
    stuckTimer: 0,
    lastX: x,
    lastY: y,
    brakeLight: false,
  };
}

/** A point on the road graph: intersections are the nodes traffic drives between. */
function randomNeighbour(random, node) {
  const neighbours = [];
  for (const avenue of CITY.avenues) {
    if (avenue !== node.x) neighbours.push({ x: avenue, y: node.y });
  }
  for (const street of CITY.streets) {
    if (street !== node.y) neighbours.push({ x: node.x, y: street });
  }
  return pick(random, neighbours);
}

function lanePoint(from, to) {
  // Right-hand traffic: drive offset to the right of the travel direction.
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const nx = -dy / length;
  const ny = dx / length;
  return { x: to.x + nx * CITY.laneOffset, y: to.y + ny * CITY.laneOffset };
}

export function spawnTrafficCars(city, random, count) {
  const cars = [];
  const models = ['sedan', 'taxi', 'van', 'pickup', 'sedan', 'taxi', 'muscle', 'truck'];
  for (let i = 0; i < count; i += 1) {
    const point = randomRoadPoint(random);
    const car = createCar(pick(random, models), point.x, point.y, random() * Math.PI * 2, {
      traffic: true,
      driver: true,
      cruise: TRAFFIC.cruiseSpeed + range(random, -TRAFFIC.cruiseJitter, TRAFFIC.cruiseJitter),
    });
    car.target = randomNeighbour(random, nearestIntersection(point.x, point.y));
    cars.push(car);
  }
  return cars;
}

export function spawnParkedCars(city, random, count) {
  const cars = [];
  const models = ['sedan', 'taxi', 'van', 'pickup', 'sports', 'muscle', 'truck'];
  for (let i = 0; i < count; i += 1) {
    const point = randomRoadPoint(random);
    const onAvenue = CITY.avenues.includes(point.x);
    const side = random() < 0.5 ? -1 : 1;
    const x = onAvenue ? point.x + side * (CITY.roadWidth / 2 + 6) : point.x;
    const y = onAvenue ? point.y : point.y + side * (CITY.roadWidth / 2 + 6);
    const angle = onAvenue ? (side > 0 ? Math.PI / 2 : -Math.PI / 2) : (side > 0 ? 0 : Math.PI);
    cars.push(createCar(pick(random, models), x, y, angle, { parked: true }));
  }
  return cars;
}

/** The nearest car to a point, within range, passing a filter. */
export function nearestCar(cars, x, y, maxRange, filter) {
  let best = null;
  let bestDist = maxRange;
  for (const car of cars) {
    if (car.wrecked) continue;
    if (filter && !filter(car)) continue;
    const dist = Math.hypot(car.x - x, car.y - y);
    if (dist < bestDist) {
      bestDist = dist;
      best = car;
    }
  }
  return best;
}

function angleDifference(a, b) {
  let diff = b - a;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

/** One traffic car: steer toward its target intersection, slow for the car ahead. */
function stepTrafficCar(w, car, dt) {
  if (car.wrecked) return;
  if (!car.target) car.target = randomNeighbour(w.random, nearestIntersection(car.x, car.y));
  const goal = lanePoint({ x: car.x, y: car.y }, car.target);
  const distToGoal = Math.hypot(goal.x - car.x, goal.y - car.y);
  if (distToGoal < 30) {
    car.target = randomNeighbour(w.random, nearestIntersection(car.x, car.y));
    return;
  }
  const wantAngle = Math.atan2(goal.y - car.y, goal.x - car.x);
  const turn = angleDifference(car.angle, wantAngle);
  car.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, turn));
  // Slow down if another car is close ahead.
  let targetSpeed = car.cruise;
  const aheadX = car.x + Math.cos(car.angle) * 70;
  const aheadY = car.y + Math.sin(car.angle) * 70;
  for (const other of w.cars) {
    if (other === car || other.wrecked) continue;
    if (Math.hypot(other.x - aheadX, other.y - aheadY) < 42) {
      targetSpeed = Math.min(targetSpeed, other.speed * 0.9);
      break;
    }
  }
  // And if a pedestrian is right in front, stop.
  for (const ped of w.peds) {
    if (Math.hypot(ped.x - aheadX, ped.y - aheadY) < 30) {
      targetSpeed = 0;
      break;
    }
  }
  const accel = targetSpeed > car.speed ? 260 : 500;
  car.speed += Math.max(-accel * dt, Math.min(accel * dt, targetSpeed - car.speed));
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.vx = Math.cos(car.angle) * car.speed;
  car.vy = Math.sin(car.angle) * car.speed;
  // Off the road (pushed by a collision): steer back toward the nearest intersection.
  if (!onAsphalt(w.city, car.x, car.y)) {
    const node = nearestIntersection(car.x, car.y);
    car.target = node;
  }
  // Stuck against something: pick a new target.
  if (Math.hypot(car.x - car.lastX, car.y - car.lastY) < 4 && car.speed > 40) car.stuckTimer += dt;
  else car.stuckTimer = 0;
  car.lastX = car.x;
  car.lastY = car.y;
  if (car.stuckTimer > 2.5) {
    car.target = randomNeighbour(w.random, nearestIntersection(car.x, car.y));
    car.stuckTimer = 0;
  }
}

/** The car the player drives: arcade physics with drift and handbrake. */
export function stepPlayerCar(w, car, controls, dt) {
  const spec = car.spec;
  const forward = Math.cos(car.angle);
  const right = Math.sin(car.angle);
  const forwardSpeed = car.vx * forward + car.vy * right;
  const move = controls.move;
  // Forward/back along the car's heading; W/S (or up/down) is the throttle.
  const throttle = -move.y;
  if (throttle > 0) car.speed += spec.accel * throttle * dt;
  else if (throttle < 0) car.speed -= (forwardSpeed > 10 ? spec.brake : spec.reverse) * dt;
  else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 160 * dt);
  car.speed = Math.max(-spec.reverse, Math.min(spec.maxSpeed, car.speed));
  // Steering: stronger at speed, reversed when reversing.
  const steer = move.x;
  const steerFactor = Math.min(1, Math.abs(forwardSpeed) / 120);
  car.angle += steer * spec.turn * steerFactor * Math.sign(forwardSpeed || 1) * dt;
  // Velocity follows the heading, with grip: low grip (handbrake) keeps sliding.
  const handbrake = controls.handbrake;
  const grip = handbrake ? 0.86 : spec.grip;
  const targetVx = Math.cos(car.angle) * car.speed;
  const targetVy = Math.sin(car.angle) * car.speed;
  car.vx += (targetVx - car.vx) * grip;
  car.vy += (targetVy - car.vy) * grip;
  car.x += car.vx * dt;
  car.y += car.vy * dt;
  car.brakeLight = throttle < 0;
  if (throttle > 0 && Math.random() < 0.3) w.effects.smoke(car.x - forward * spec.length * 0.5, car.y - right * spec.length * 0.5);
  // Skid marks and smoke while sliding sideways.
  const lateral = Math.abs(car.vx * Math.sin(car.angle) - car.vy * Math.cos(car.angle));
  if ((handbrake && Math.abs(car.speed) > 120) || lateral > 170) {
    const backX = car.x - Math.cos(car.angle) * spec.length * 0.32;
    const backY = car.y - Math.sin(car.angle) * spec.length * 0.32;
    const perpX = Math.sin(car.angle);
    const perpY = -Math.cos(car.angle);
    w.effects.addSkid(
      backX + perpX * 11 - car.vx * dt, backY + perpY * 11 - car.vy * dt,
      backX + perpX * 11, backY + perpY * 11,
    );
    w.effects.addSkid(
      backX - perpX * 11 - car.vx * dt, backY - perpY * 11 - car.vy * dt,
      backX - perpX * 11, backY - perpY * 11,
    );
    if (Math.random() < 0.4) w.effects.smoke(backX, backY);
  }
  if (car.health < 40) {
    car.smoke += dt;
    if (car.smoke > 0.12) {
      car.smoke = 0;
      w.effects.smoke(car.x + Math.cos(car.angle) * spec.length * 0.3, car.y + Math.sin(car.angle) * spec.length * 0.3);
    }
  }
  // Off-road at speed kicks up dust behind the car.
  if (!onAsphalt(w.city, car.x, car.y) && Math.abs(car.speed) > 200 && w.random() < 0.35) {
    w.effects.dust(car.x - Math.cos(car.angle) * spec.length * 0.4, car.y - Math.sin(car.angle) * spec.length * 0.4);
  }
}

/** Damage a car; a wrecked car stops, smokes and — for a hard kill — explodes. Returns true if it just wrecked. */
export function damageCar(w, car, amount) {
  if (car.wrecked) return false;
  car.health -= amount;
  if (car.health <= 0) {
    car.health = 0;
    car.wrecked = true;
    car.speed = 0;
    car.vx = 0;
    car.vy = 0;
    w.effects.explosion(car.x, car.y);
    playExplosion();
    return true;
  }
  return false;
}

/** Car vs car and car vs building collisions for every car. */
export function collideCars(w, dt) {
  const cars = w.cars;
  for (const car of cars) {
    if (car.wrecked) continue;
    const body = { x: car.x, y: car.y, radius: car.radius * 0.72 };
    if (resolveBuildingCollision(w.city, body)) {
      const hitSpeed = Math.hypot(car.vx, car.vy);
      car.x = body.x;
      car.y = body.y;
      car.vx *= -0.3;
      car.vy *= -0.3;
      car.speed *= 0.4;
      if (hitSpeed > 260) {
        damageCar(w, car, (hitSpeed - 260) * 0.05);
        if (car === w.player.car) {
          w.player.hp -= Math.min(18, (hitSpeed - 260) * 0.03);
          w.player.lastDamage = w.time;
        }
      }
    }
    // Keep cars inside the world.
    car.x = Math.max(30, Math.min(WORLD.width - 30, car.x));
    car.y = Math.max(30, Math.min(2460 - 30, car.y));
  }
  for (let i = 0; i < cars.length; i += 1) {
    for (let j = i + 1; j < cars.length; j += 1) {
      const a = cars[i];
      const b = cars[j];
      if (a.wrecked && b.wrecked) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      const minDist = (a.spec.length + b.spec.length) / 2 - 14;
      if (dist >= minDist || dist === 0) continue;
      const push = (minDist - dist) / 2;
      const nx = dx / dist;
      const ny = dy / dist;
      a.x -= nx * push;
      a.y -= ny * push;
      b.x += nx * push;
      b.y += ny * push;
      const relSpeed = Math.abs((a.vx - b.vx) * nx + (a.vy - b.vy) * ny);
      if (relSpeed > 120) {
        damageCar(w, a, relSpeed * 0.03);
        damageCar(w, b, relSpeed * 0.03);
        w.effects.sparks((a.x + b.x) / 2, (a.y + b.y) / 2);
        w.effects.addShake(Math.min(6, relSpeed * 0.008));
        if (a === w.player.car || b === w.player.car) {
          w.player.hp -= Math.min(12, relSpeed * 0.015);
          w.player.lastDamage = w.time;
        }
      }
      // Exchange a little velocity so they do not stick together.
      const aSpeed = a.speed;
      a.speed = b.speed * 0.5;
      b.speed = aSpeed * 0.5;
      a.vx *= 0.5;
      a.vy *= 0.5;
      b.vx *= 0.5;
      b.vy *= 0.5;
    }
  }
}

/** Step every traffic car. */
export function stepTraffic(w, dt) {
  for (const car of w.cars) {
    if (car.traffic && !car.wrecked) stepTrafficCar(w, car, dt);
  }
}
