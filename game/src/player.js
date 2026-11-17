// The player on foot: walk and run, enter and exit cars, punch and shoot. Driving itself
// lives in vehicles.js; this file only moves the person and wires the actions to the world.
import { PLAYER, PISTOL, WANTED } from './config.js';
import { clampToLand, resolveBuildingCollision } from './city.js';
import { nearestCar, stepPlayerCar } from './vehicles.js';
import { fireBullet, punch } from './combat.js';
import { addHeat } from './police.js';
import { nearestFarePed } from './pedestrians.js';
import { playPickup } from './audio.js';

export const ACTION_ENTER = 4;
export const ACTION_PUNCH = 8;
export const ACTION_SHOOT = 32;
export const ACTION_HANDBRAKE = 64;

function stepOnFoot(w, controls, dt) {
  const player = w.player;
  const move = controls.move;
  const speed = controls.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
  player.vx += (move.x * speed - player.vx) * Math.min(1, PLAYER.accel * dt / speed);
  player.vy += (move.y * speed - player.vy) * Math.min(1, PLAYER.accel * dt / speed);
  player.x += player.vx * dt;
  player.y += player.vy * dt;
  if (move.x !== 0 || move.y !== 0) {
    player.angle = Math.atan2(move.y, move.x);
    player.walkPhase += dt * 10;
    // Footsteps on the beach kick up sand.
    if (player.y > 2250 && w.random() < 0.1) w.effects.dust(player.x, player.y + 10);
  }
  const clamped = clampToLand(w.city, player.x, player.y);
  player.x = clamped.x;
  player.y = clamped.y;
  const body = { x: player.x, y: player.y, radius: PLAYER.radius };
  if (resolveBuildingCollision(w.city, body)) {
    player.x = body.x;
    player.y = body.y;
  }
  // Cars knock the player down: a fast car hurts, a slow one just pushes.
  for (const car of w.cars) {
    if (car.wrecked) continue;
    const dx = player.x - car.x;
    const dy = player.y - car.y;
    const localX = dx * Math.cos(-car.angle) - dy * Math.sin(-car.angle);
    const localY = dx * Math.sin(-car.angle) + dy * Math.cos(-car.angle);
    if (Math.abs(localX) < car.spec.length / 2 + PLAYER.radius && Math.abs(localY) < car.spec.width / 2 + PLAYER.radius) {
      const carSpeed = Math.hypot(car.vx, car.vy);
      const push = Math.hypot(dx, dy) || 1;
      player.x = car.x + (dx / push) * (car.spec.length / 2 + PLAYER.radius + 2);
      player.y = car.y + (dy / push) * (car.spec.length / 2 + PLAYER.radius + 2);
      if (carSpeed > 160) {
        player.hp -= Math.min(20, carSpeed * 0.03);
        player.lastDamage = w.time;
        w.effects.addShake(5);
        if (car.police) addHeat(w, 0, player.x, player.y);
      }
    }
  }
  // Pickups: walk over cash, health and ammo to collect them.
  for (const pickup of w.pickups) {
    if (pickup.taken) continue;
    if (Math.hypot(pickup.x - player.x, pickup.y - player.y) < 30) {
      pickup.taken = true;
      if (pickup.kind === 'cash') {
        player.money += pickup.value;
        w.effects.addFloater(player.x, player.y - 20, `+$${pickup.value}`, '#ffd23f');
      } else if (pickup.kind === 'health') {
        player.hp = Math.min(PLAYER.maxHealth, player.hp + pickup.value);
        w.effects.addFloater(player.x, player.y - 20, `+${pickup.value} HP`, '#7fd08a');
      } else if (pickup.kind === 'ammo') {
        player.ammo += pickup.value;
        w.effects.addFloater(player.x, player.y - 20, `+${pickup.value} ammo`, '#8fb8d8');
      }
      playPickup();
    }
  }
  w.pickups = w.pickups.filter((pickup) => !pickup.taken);
}

function tryEnterCar(w) {
  const player = w.player;
  const car = nearestCar(w.cars, player.x, player.y, PLAYER.enterRange, (candidate) => !candidate.wrecked);
  if (car === null) {
    // No car nearby: maybe a fare ped is waiting instead.
    const farePed = nearestFarePed(w, 60);
    if (farePed !== null && w.fare === null) {
      w.fare = { ped: farePed, dest: farePed.fareDest, reward: 0, state: 'riding' };
      farePed.state = 'riding';
      w.fare.reward = 40 + Math.floor(w.random() * 50);
      w.message = { text: `Fare picked up — drive to the marker ($${w.fare.reward})`, timer: 3 };
      return true;
    }
    return false;
  }
  player.car = car;
  player.onFoot = false;
  car.parked = false;
  car.traffic = false;
  car.driver = true;
  if (car.police) {
    addHeat(w, WANTED.stealCar, player.x, player.y);
    w.stats.carsStolen += 1;
  } else if (!car.wasStolen && car.parked) {
    // Stealing a parked car is a crime when anyone sees it.
    addHeat(w, WANTED.stealCar, player.x, player.y);
    w.stats.carsStolen += 1;
  }
  car.wasStolen = true;
  w.message = { text: `Driving the ${car.model}`, timer: 1.5 };
  return true;
}

function exitCar(w) {
  const player = w.player;
  const car = player.car;
  if (car === null) return;
  // Step out beside the car, on the driver's side.
  const sideX = car.x + Math.sin(car.angle) * (car.spec.width / 2 + PLAYER.radius + 4);
  const sideY = car.y - Math.cos(car.angle) * (car.spec.width / 2 + PLAYER.radius + 4);
  const clamped = clampToLand(w.city, sideX, sideY);
  player.x = clamped.x;
  player.y = clamped.y;
  player.vx = 0;
  player.vy = 0;
  player.car = null;
  player.onFoot = true;
  car.traffic = false;
  car.parked = true;
  car.speed = 0;
  car.vx = 0;
  car.vy = 0;
}

export function stepPlayer(w, controls, dt) {
  const player = w.player;
  // Timers.
  if (player.punchTimer > 0) player.punchTimer -= dt;
  if (player.shootTimer > 0) player.shootTimer -= dt;
  if (player.invuln > 0) player.invuln -= dt;
  // Health regen after a quiet spell.
  if (player.hp > 0 && player.hp < PLAYER.maxHealth && w.time - player.lastDamage > PLAYER.regenDelay) {
    player.hp = Math.min(PLAYER.maxHealth, player.hp + PLAYER.regen * dt);
  }
  const actions = controls.actions;
  if (player.onFoot) {
    stepOnFoot(w, controls, dt);
    if (actions & ACTION_ENTER) tryEnterCar(w);
    if (actions & ACTION_PUNCH && player.punchTimer <= 0) {
      player.punchTimer = PLAYER.punchCooldown;
      player.lastPunch = w.time;
      const aim = Math.atan2(controls.aimY - player.y, controls.aimX - player.x);
      punch(w, player, aim, true);
    }
    if (actions & ACTION_SHOOT && player.shootTimer <= 0 && player.ammo > 0) {
      player.shootTimer = PISTOL.cooldown;
      player.ammo -= 1;
      const aim = Math.atan2(controls.aimY - player.y, controls.aimX - player.x);
      if (fireBullet(w, player.x, player.y, aim, true)) {
        addHeat(w, WANTED.shoot, player.x, player.y);
      }
    }
  } else if (player.car !== null) {
    stepPlayerCar(w, player.car, controls, dt);
    if (actions & ACTION_ENTER) exitCar(w);
    if (actions & ACTION_SHOOT && player.shootTimer <= 0 && player.ammo > 0) {
      // Drive-by: shoot from the car window toward the mouse.
      player.shootTimer = PISTOL.cooldown;
      player.ammo -= 1;
      const aim = Math.atan2(controls.aimY - player.car.y, controls.aimX - player.car.x);
      if (fireBullet(w, player.car.x, player.car.y, aim, true)) {
        addHeat(w, WANTED.shoot, player.car.x, player.car.y);
      }
    }
  }
  // A fare passenger rides along: drop them off at the marker.
  if (w.fare !== null && w.fare.state === 'riding' && player.car !== null) {
    const dest = w.fare.dest;
    if (Math.hypot(dest.x - player.car.x, dest.y - player.car.y) < 70) {
      player.money += w.fare.reward;
      w.stats.faresDone += 1;
      w.stats.earned += w.fare.reward;
      w.effects.addFloater(player.car.x, player.car.y - 30, `Fare +$${w.fare.reward}`, '#ffd23f');
      playPickup();
      w.peds = w.peds.filter((ped) => ped !== w.fare.ped);
      w.fare = null;
    }
  }
}
