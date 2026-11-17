// The wanted level and the Solmar PD. Heat rises when the player commits a crime in front
// of witnesses; stars follow the heat. Police cars spawn off-screen and chase the player,
// ramming their car or running them down on foot; foot police chase on foot and arrest the
// player if they hold them for a second. Busted or wasted ends the chase the hard way.
import { WANTED } from './config.js';
import { createCar, damageCar } from './vehicles.js';
import { clampToLand } from './city.js';
import { playSirenTick } from './audio.js';

function starsForHeat(heat) {
  let stars = 0;
  for (let i = 0; i < WANTED.starAt.length; i += 1) {
    if (heat >= WANTED.starAt[i]) stars = i + 1;
  }
  return stars;
}

/** Add heat for a crime. Witnesses nearby make it count double. */
export function addHeat(w, amount, x, y) {
  let witnessed = false;
  for (const ped of w.peds) {
    if (Math.hypot(ped.x - x, ped.y - y) < 480) {
      witnessed = true;
      break;
    }
  }
  for (const cop of w.footPolice) {
    if (Math.hypot(cop.x - x, cop.y - y) < 600) {
      witnessed = true;
      break;
    }
  }
  w.wanted.heat = Math.min(100, w.wanted.heat + amount * (witnessed ? 1 : 0.6));
  w.wanted.lastCrime = w.time;
  w.wanted.stars = starsForHeat(w.wanted.heat);
}

export function clearWanted(w) {
  w.wanted.heat = 0;
  w.wanted.stars = 0;
}

/** Pick a spawn point on a road near the player but off the visible screen. */
function spawnPointNear(w, distance) {
  const player = w.player;
  for (let tries = 0; tries < 12; tries += 1) {
    const angle = w.random() * Math.PI * 2;
    const x = player.x + Math.cos(angle) * distance;
    const y = player.y + Math.sin(angle) * distance;
    const clamped = clampToLand(w.city, x, y);
    const dist = Math.hypot(clamped.x - player.x, clamped.y - player.y);
    if (dist > 520 && dist < WANTED.despawnRange) return clamped;
  }
  return { x: player.x + distance, y: player.y };
}

function spawnPoliceCar(w) {
  const point = spawnPointNear(w, WANTED.spawnRange);
  const car = createCar('police', point.x, point.y, w.random() * Math.PI * 2, {
    police: true,
    driver: true,
    cruise: 320,
  });
  w.cars.push(car);
  w.policeCars.push(car);
  return car;
}

function spawnFootPolice(w) {
  const point = spawnPointNear(w, 420);
  const cop = {
    x: point.x,
    y: point.y,
    angle: 0,
    speed: 0,
    radius: 14,
    hp: 60,
    isCop: true,
    arrestTimer: 0,
    walkPhase: 0,
  };
  w.footPolice.push(cop);
  return cop;
}

function stepPoliceCar(w, car, dt) {
  const player = w.player;
  const targetX = player.car ? player.car.x : player.x;
  const targetY = player.car ? player.car.y : player.y;
  const dist = Math.hypot(targetX - car.x, targetY - car.y);
  // Give up if the player got far away.
  if (dist > WANTED.despawnRange) {
    car.despawn = true;
    return;
  }
  // Pursuit steering: aim slightly ahead of the player.
  const lead = 0.45;
  const aimX = targetX + (player.car ? player.car.vx * lead : player.vx * lead);
  const aimY = targetY + (player.car ? player.car.vy * lead : player.vy * lead);
  const wantAngle = Math.atan2(aimY - car.y, aimX - car.x);
  let diff = wantAngle - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.angle += Math.max(-3.4 * dt, Math.min(3.4 * dt, diff));
  const wantSpeed = dist > 240 ? car.spec.maxSpeed : car.spec.maxSpeed * 0.75;
  car.speed += Math.max(-700 * dt, Math.min(560 * dt, wantSpeed - car.speed));
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.vx = Math.cos(car.angle) * car.speed;
  car.vy = Math.sin(car.angle) * car.speed;
  // Ram the player's car: a hard shove and a little damage, at most twice a second.
  if (player.car && !player.car.wrecked) {
    const d = Math.hypot(player.car.x - car.x, player.car.y - car.y);
    car.ramTimer = Math.max(0, (car.ramTimer ?? 0) - dt);
    if (d < (car.spec.length + player.car.spec.length) / 2 - 10 && car.ramTimer <= 0) {
      car.ramTimer = 0.5;
      player.car.vx += Math.cos(car.angle) * 260;
      player.car.vy += Math.sin(car.angle) * 260;
      damageCar(w, player.car, 6);
      w.effects.addShake(3);
    }
  }
  // Run the player down on foot.
  if (!player.car) {
    const d = Math.hypot(player.x - car.x, player.y - car.y);
    if (d < 40) {
      player.hp -= 22 * dt;
      player.lastDamage = w.time;
      player.x += Math.cos(car.angle) * 120 * dt;
      player.y += Math.sin(car.angle) * 120 * dt;
      w.effects.addShake(2);
    }
  }
}

function stepFootPolice(w, cop, dt) {
  const player = w.player;
  const dist = Math.hypot(player.x - cop.x, player.y - cop.y);
  if (dist > WANTED.despawnRange) {
    cop.despawn = true;
    return;
  }
  const speed = player.car ? 300 : 265;
  cop.angle = Math.atan2(player.y - cop.y, player.x - cop.x);
  cop.x += Math.cos(cop.angle) * speed * dt;
  cop.y += Math.sin(cop.angle) * speed * dt;
  cop.walkPhase += dt * 10;
  // Arrest: hold the player on foot for a second.
  if (!player.car && dist < 30) {
    cop.arrestTimer += dt;
    if (cop.arrestTimer > 1.1) w.busted = true;
  } else {
    cop.arrestTimer = 0;
  }
}

export function stepPolice(w, dt) {
  const stars = w.wanted.stars;
  // Heat decays when the player stays clean and no police are near.
  if (stars > 0 && w.time - w.wanted.lastCrime > WANTED.decayDelay) {
    let policeNear = false;
    for (const car of w.policeCars) {
      if (Math.hypot(car.x - w.player.x, car.y - w.player.y) < 420) {
        policeNear = true;
        break;
      }
    }
    if (!policeNear) {
      w.wanted.heat = Math.max(0, w.wanted.heat - WANTED.decay * dt);
      w.wanted.stars = starsForHeat(w.wanted.heat);
    }
  }
  // Spawn to match the wanted level.
  const wantCars = WANTED.policeCars[stars];
  const wantFoot = WANTED.footPolice[stars];
  if (w.policeCars.length < wantCars && w.time - w.lastPoliceSpawn > 1.2) {
    spawnPoliceCar(w);
    w.lastPoliceSpawn = w.time;
  }
  if (w.footPolice.length < wantFoot && w.time - w.lastPoliceSpawn > 1.2) {
    spawnFootPolice(w);
    w.lastPoliceSpawn = w.time;
  }
  // Despawn the extras when the heat drops.
  while (w.policeCars.length > wantCars) {
    const car = w.policeCars.pop();
    car.despawn = true;
  }
  while (w.footPolice.length > wantFoot) {
    const cop = w.footPolice.pop();
    cop.despawn = true;
  }
  for (const car of w.policeCars) stepPoliceCar(w, car, dt);
  for (const cop of w.footPolice) stepFootPolice(w, cop, dt);
  // Remove despawned police cars from the car list too.
  w.cars = w.cars.filter((car) => !car.despawn);
  w.policeCars = w.policeCars.filter((car) => !car.despawn);
  w.footPolice = w.footPolice.filter((cop) => !cop.despawn);
  // Siren wail while police are close.
  if (w.policeCars.length > 0) {
    w.sirenTimer -= dt;
    if (w.sirenTimer <= 0) {
      w.sirenTimer = 0.36;
      w.sirenHigh = !w.sirenHigh;
      playSirenTick(w.sirenHigh);
    }
  }
}
