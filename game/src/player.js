// player.js: The player on foot: walk and run, enter and exit cars, punch and shoot,
// fist mode vs weapon mode. Heat for stealing a car only counts when someone sees it.
import { PLAYER, WANTED, MONEY } from './config.js';
import { clampToLand, resolveBuildingCollision } from './city.js';
import { nearestCar, stepPlayerCar } from './vehicles.js';
import { fireWeapon, punch } from './combat.js';
import { addHeat } from './police.js';
import { playEmpty, playPickup, playSkill, playSwitch } from './audio.js';
import { WEAPONS, cycleWeapon, WEAPON_ORDER } from './weapons.js';
import { damageMultiplier, fireRateMultiplier, speedMultiplier, stepHero, useSkill } from './heroes.js';
import { ACTION_FIST, ACTION_SKILL, ACTION_SLOT_BASE, ACTION_WEAPON_NEXT, ACTION_WEAPON_PREV } from './input.js';

export const ACTION_ENTER = 4;
export const ACTION_PUNCH = 8;
export const ACTION_SHOOT = 32;
export const ACTION_REPAIR = 64;


function witnessNear(w, x, y) {
  for (const ped of w.peds) {
    if (Math.hypot(ped.x - x, ped.y - y) < 480) return true;
  }
  for (const cop of w.footPolice) {
    if (Math.hypot(cop.x - x, cop.y - y) < 600) return true;
  }
  return false;
}

function stepOnFoot(w, controls, dt) {
  const player = w.player;
  const move = controls.move;
  const speed = (controls.run ? PLAYER.runSpeed : PLAYER.walkSpeed) * speedMultiplier(player);
  if (player.dashT > 0) {
    player.vx = player.dashVx;
    player.vy = player.dashVy;
  } else {
    player.vx += (move.x * speed - player.vx) * Math.min(1, PLAYER.accel * dt / speed);
    player.vy += (move.y * speed - player.vy) * Math.min(1, PLAYER.accel * dt / speed);
  }
  player.x += player.vx * dt;
  player.y += player.vy * dt;
  if (move.x !== 0 || move.y !== 0) {
    player.angle = Math.atan2(move.y, move.x);
    player.walkPhase += dt * 10;
  }
  const clamped = clampToLand(w.city, player.x, player.y);
  player.x = clamped.x;
  player.y = clamped.y;
  const body = { x: player.x, y: player.y, radius: PLAYER.radius };
  if (resolveBuildingCollision(w.city, body)) {
    player.x = body.x;
    player.y = body.y;
  }

  for (const car of w.cars) {
    if (car.wrecked) continue;
    const dx = player.x - car.x;
    const dy = player.y - car.y;
    const localX = dx * Math.cos(-car.angle) - dy * Math.sin(-car.angle);
    const localY = dx * Math.sin(-car.angle) + dy * Math.cos(-car.angle);
    const half = car.spec.length / 2 + PLAYER.radius;
    if (Math.abs(localX) < half && Math.abs(localY) < car.spec.width / 2 + PLAYER.radius) {
      const carSpeed = Math.hypot(car.vx, car.vy);
      const push = Math.hypot(dx, dy) || 1;
      player.x = car.x + (dx / push) * (half + 2);
      player.y = car.y + (dy / push) * (half + 2);
      if (carSpeed > 160) {
        player.hp -= Math.min(20, carSpeed * 0.03);
        player.lastDamage = w.time;
        w.effects.addShake(5);
        if (car.police) addHeat(w, 0, player.x, player.y);
      }
    }
  }

  for (const pickup of w.pickups) {
    if (pickup.taken) continue;
    if (Math.hypot(pickup.x - player.x, pickup.y - player.y) < 30) {
      pickup.taken = true;
      if (pickup.kind === 'cash') {
        player.money += pickup.value;
        w.effects.addFloater(player.x, player.y - 20, `+$${pickup.value}`, '#ffd23f');
      } else if (pickup.kind === 'health') {
        player.hp = Math.min(player.maxHp, player.hp + pickup.value);
        w.effects.addFloater(player.x, player.y - 20, `+${pickup.value} HP`, '#7fd08a');
      } else if (pickup.kind === 'ammo') {
        const current = player.weapons.current;
        const amount = Math.max(1, Math.round(pickup.value * WEAPONS[current].pickupAmmo / WEAPONS.pistol.pickupAmmo));
        player.weapons.ammo[current] += amount;
        w.effects.addFloater(player.x, player.y - 20, `+${amount} ammo`, '#8fb8d8');
      } else if (pickup.kind === 'weapon') {
        const weapon = WEAPONS[pickup.weapon];
        const isNew = !player.weapons.owned[weapon.id];
        player.weapons.owned[weapon.id] = true;
        player.weapons.ammo[weapon.id] += weapon.pickupAmmo;
        if (isNew) player.weapons.current = weapon.id;
        w.effects.addFloater(player.x, player.y - 24, isNew ? weapon.name : `+${weapon.pickupAmmo} ${weapon.name}`, weapon.color);
        w.effects.addRing(player.x, player.y, weapon.color, 50, 0.4);
      }
      playPickup();
    }
  }
  w.pickups = w.pickups.filter((pickup) => !pickup.taken);
}

function tryEnterCar(w) {
  const player = w.player;
  const car = nearestCar(w.cars, player.x, player.y, PLAYER.enterRange, (candidate) => !candidate.wrecked);
  if (car === null) return false;

  const wasParked = car.parked;
  const wasStolen = car.wasStolen;
  player.car = car;
  player.onFoot = false;
  car.parked = false;
  car.traffic = false;
  car.driver = true;
  if (car.police) {
    addHeat(w, WANTED.stealCar, player.x, player.y);
    w.stats.carsStolen += 1;
  } else if (!wasStolen && wasParked && witnessNear(w, player.x, player.y)) {


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



function tryShoot(w, controls, ox, oy) {
  const player = w.player;
  if (player.fistMode && player.onFoot) {
    const clicked = (controls.actions & ACTION_SHOOT) !== 0;
    if (clicked && player.punchTimer <= 0) {
      player.punchTimer = PLAYER.punchCooldown;
      player.lastPunch = w.time;
      const aim = Math.atan2(controls.aimY - oy, controls.aimX - ox);
      punch(w, player, aim, true);
    }
    return;
  }
  const id = player.weapons.current;
  const weapon = WEAPONS[id];
  const clicked = (controls.actions & ACTION_SHOOT) !== 0;
  if (!clicked && !(weapon.auto && controls.firing)) return;
  if (player.shootTimer > 0) return;
  if (player.weapons.ammo[id] <= 0) {
    if (clicked) {
      playEmpty();
      w.message = { text: `${weapon.name} is out of ammo — find a crate or switch weapons.`, timer: 1.6 };
    }
    return;
  }
  player.weapons.ammo[id] -= 1;
  player.shootTimer = weapon.cooldown / fireRateMultiplier(player);
  const aim = Math.atan2(controls.aimY - oy, controls.aimX - ox);
  if (fireWeapon(w, ox, oy, aim, weapon, damageMultiplier(player))) {
    addHeat(w, weapon.heat, ox, oy);
    player.recoil = 1;
    player.muzzleT = 0.07;
    player.firedAt = w.time;
    if (id === 'pistol' || id === 'smg') {
      w.effects.shell(ox - Math.cos(aim) * 4, oy - Math.sin(aim) * 4);
    }
  }
}


function switchWeapons(w, actions) {
  const player = w.player;
  const owned = player.weapons.owned;
  let next = player.weapons.current;
  for (let i = 0; i < WEAPON_ORDER.length; i += 1) {
    if (actions & (ACTION_SLOT_BASE << i) && owned[WEAPON_ORDER[i]]) next = WEAPON_ORDER[i];
  }
  if (actions & ACTION_WEAPON_NEXT) next = cycleWeapon(owned, next, 1);
  if (actions & ACTION_WEAPON_PREV) next = cycleWeapon(owned, next, -1);
  if (next !== player.weapons.current) {
    player.weapons.current = next;
    player.shootTimer = Math.max(player.shootTimer, 0.12);
    playSwitch();
    const x = player.car !== null ? player.car.x : player.x;
    const y = player.car !== null ? player.car.y : player.y;
    w.effects.addFloater(x, y - 34, WEAPONS[next].name, WEAPONS[next].color);
  }
}

export function stepPlayer(w, controls, dt) {
  const player = w.player;
  if (player.punchTimer > 0) player.punchTimer -= dt;
  if (player.shootTimer > 0) player.shootTimer -= dt;
  if (player.invuln > 0) player.invuln -= dt;
  stepHero(w, dt);
  if (player.hp > 0 && player.hp < player.maxHp && w.time - player.lastDamage > PLAYER.regenDelay) {
    player.hp = Math.min(player.maxHp, player.hp + PLAYER.regen * dt);
  }
  const actions = controls.actions;
  switchWeapons(w, actions);
  if (actions & ACTION_FIST) {
    player.fistMode = !player.fistMode;
    w.message = {
      text: player.fistMode ? 'FISTS — click to punch (V for weapons)' : `${WEAPONS[player.weapons.current].name} — hold click to shoot (V for fists)`,
      timer: 2,
    };
  }
  if (actions & ACTION_SKILL) {
    if (useSkill(w, controls)) playSkill(player.hero);
    else if (player.skillCd > 0 && w.message === null) {
      w.message = { text: `Skill ready in ${Math.ceil(player.skillCd)}s`, timer: 1 };
    }
  }
  if (player.onFoot) {
    stepOnFoot(w, controls, dt);
    if (actions & ACTION_ENTER) tryEnterCar(w);
    if (actions & ACTION_PUNCH && player.punchTimer <= 0) {
      player.punchTimer = PLAYER.punchCooldown;
      player.lastPunch = w.time;
      const aim = Math.atan2(controls.aimY - player.y, controls.aimX - player.x);
      punch(w, player, aim, true);
    }
    tryShoot(w, controls, player.x, player.y);
  } else if (player.car !== null) {
    stepPlayerCar(w, player.car, controls, dt);
    if (actions & ACTION_ENTER) exitCar(w);
    if (actions & ACTION_REPAIR && player.car.health < 100) {
      const garage = w.city.garage;
      if (Math.hypot(garage.x - player.car.x, garage.y - player.car.y) < 140) {
        if (player.money >= MONEY.repairCost) {
          player.money -= MONEY.repairCost;
          player.car.health = 100;
          w.effects.addFloater(player.car.x, player.car.y - 30, 'Repaired', '#7fd08a');
          playPickup();
        } else {
          w.message = { text: `Repair costs $${MONEY.repairCost} — you are short.`, timer: 2 };
        }
      }
    }


    if (player.car !== null) tryShoot(w, controls, player.car.x, player.car.y);
  }
}
