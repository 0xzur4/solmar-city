// Pedestrians: they stroll the sidewalks between random waypoints, scatter when a gun goes
// off or a car comes at them, and a few of them wait with a fare flag — drive one to its
// destination and it pays. Peds also witness crimes: steal a car in front of one and the
// wanted level climbs.
import { CITY, TRAFFIC } from './config.js';
import { randomSidewalkPoint } from './city.js';
import { pick, range } from './random.js';

let nextPedId = 1;

export function createPed(city, random, options = {}) {
  const point = options.x !== undefined ? { x: options.x, y: options.y } : randomSidewalkPoint(random);
  return {
    id: nextPedId,
    x: point.x,
    y: point.y,
    angle: random() * Math.PI * 2,
    speed: 0,
    color: options.color ?? pick(random, ['#e4572e', '#4f7ec9', '#f2c230', '#7fb069', '#c94f43', '#8e6fc9', '#2fb3a6', '#e8e0c8']),
    state: options.fare ? 'fare' : 'walk',
    target: randomSidewalkPoint(random),
    waitTimer: range(random, 0, 4),
    fleeTimer: 0,
    hp: 30,
    isCop: false,
    fare: options.fare ?? false,
    fareDest: options.fareDest ?? null,
    fareReward: options.fareReward ?? 0,
    walkPhase: random() * Math.PI * 2,
  };
}

export function spawnPeds(city, random, count) {
  const peds = [];
  for (let i = 0; i < count; i += 1) peds.push(createPed(city, random));
  return peds;
}

/** A few peds wait at curbs with a fare flag. Returns them so the world can track them. */
export function spawnFarePeds(city, random, count) {
  const peds = [];
  for (let i = 0; i < count; i += 1) {
    const point = randomSidewalkPoint(random);
    const dest = randomSidewalkPoint(random);
    peds.push(createPed(city, random, {
      x: point.x,
      y: point.y,
      fare: true,
      fareDest: dest,
      fareReward: 0,
    }));
  }
  return peds;
}

/** Is the player (or a gunshot) close enough to scare this ped? */
function dangerNear(w, ped) {
  const player = w.player;
  if (player.car) {
    const carSpeed = Math.hypot(player.car.vx, player.car.vy);
    if (carSpeed > 200 && Math.hypot(ped.x - player.car.x, ped.y - player.car.y) < 130) return true;
  } else if (Math.hypot(ped.x - player.x, ped.y - player.y) < 60 && w.time - player.lastPunch < 0.5) {
    return true;
  }
  if (w.time - w.lastShot < 0.4 && Math.hypot(ped.x - w.lastShotX, ped.y - w.lastShotY) < 420) return true;
  return false;
}

function stepPed(w, ped, dt) {
  if (ped.state === 'fare') {
    // Waiting for a fare: stand still, face the road.
    ped.speed = 0;
    return;
  }
  if (ped.state === 'flee') {
    ped.fleeTimer -= dt;
    if (ped.fleeTimer <= 0) {
      ped.state = 'walk';
      ped.target = randomSidewalkPoint(w.random);
    }
  } else if (dangerNear(w, ped)) {
    ped.state = 'flee';
    ped.fleeTimer = 1.6 + w.random() * 1.4;
    // Run away from the player.
    const away = Math.atan2(ped.y - w.player.y, ped.x - w.player.x);
    ped.target = {
      x: ped.x + Math.cos(away) * 260,
      y: ped.y + Math.sin(away) * 260,
    };
  }
  const speed = ped.state === 'flee' ? TRAFFIC.pedFleeSpeed : TRAFFIC.pedSpeed;
  const dx = ped.target.x - ped.x;
  const dy = ped.target.y - ped.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 12) {
    if (ped.state === 'walk') {
      ped.waitTimer -= dt;
      if (ped.waitTimer <= 0) {
        ped.target = randomSidewalkPoint(w.random);
        ped.waitTimer = range(w.random, 1, 6);
      }
      ped.speed = 0;
      return;
    }
    ped.target = randomSidewalkPoint(w.random);
  }
  ped.angle = Math.atan2(dy, dx);
  ped.speed = speed;
  ped.x += Math.cos(ped.angle) * speed * dt;
  ped.y += Math.sin(ped.angle) * speed * dt;
  ped.walkPhase += dt * (speed > 0 ? 9 : 0);
  // Keep peds on land and out of buildings: nudge them back onto a sidewalk.
  const clampedX = Math.max(20, Math.min(3580, ped.x));
  const clampedY = Math.max(20, Math.min(2440, ped.y));
  ped.x = clampedX;
  ped.y = clampedY;
}

export function stepPeds(w, dt) {
  for (const ped of w.peds) stepPed(w, ped, dt);
}

/** The nearest fare ped to the player, within range. */
export function nearestFarePed(w, rangePx) {
  let best = null;
  let bestDist = rangePx;
  for (const ped of w.peds) {
    if (!ped.fare) continue;
    const dist = Math.hypot(ped.x - w.player.x, ped.y - w.player.y);
    if (dist < bestDist) {
      bestDist = dist;
      best = ped;
    }
  }
  return best;
}

/** The nearest ped to a point, within range (for punches). */
export function nearestPed(w, x, y, maxRange) {
  let best = null;
  let bestDist = maxRange;
  for (const ped of w.peds) {
    const dist = Math.hypot(ped.x - x, ped.y - y);
    if (dist < bestDist) {
      bestDist = dist;
      best = ped;
    }
  }
  return best;
}
