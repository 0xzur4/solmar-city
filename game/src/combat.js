// combat.js: Combat: the pistol and the punch. Bullets are pooled, fly straight, an
import { PISTOL, PLAYER } from './config.js';
import { buildingAt } from './city.js';
import { damageCar } from './vehicles.js';
import { addHeat } from './police.js';
import { playPunch, playShoot } from './audio.js';
import { damageMultiplier } from './heroes.js';

const MAX_BULLETS = 110;

export function createBullets() {
  const bullets = [];
  for (let i = 0; i < MAX_BULLETS; i += 1) {
    bullets.push({
      active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, fromPlayer: true,
      damage: 0, color: '#ffe08a', size: 6, kind: 'bullet', pierce: 0, hits: [],
    });
  }
  return bullets;
}

function freeBullet(bullets) {
  for (const bullet of bullets) if (!bullet.active) return bullet;
  return null;
}


export function fireBullet(w, x, y, angle, fromPlayer, weapon = null, quiet = false, damageScale = 1) {
  const bullet = freeBullet(w.bullets);
  if (bullet === null) return false;
  const spreadAmount = weapon ? weapon.spread : PISTOL.spread;
  const speed = weapon ? weapon.speed : PISTOL.bulletSpeed;
  const range = weapon ? weapon.range : PISTOL.range;
  const spread = (w.random() - 0.5) * spreadAmount * 2;

  const origin = weapon ? (weapon.muzzle + 9) * 0.9 : 22;
  bullet.active = true;
  bullet.x = x + Math.cos(angle) * origin;
  bullet.y = y + Math.sin(angle) * origin;
  bullet.vx = Math.cos(angle + spread) * speed;
  bullet.vy = Math.sin(angle + spread) * speed;
  bullet.life = range / speed;
  bullet.fromPlayer = fromPlayer;
  bullet.damage = (weapon ? weapon.damage : PISTOL.damage) * damageScale;
  bullet.color = weapon ? weapon.color : '#ffe08a';
  bullet.size = weapon ? weapon.size : 6;
  bullet.kind = weapon ? weapon.kind : 'bullet';
  bullet.pierce = weapon ? weapon.pierce : 0;
  bullet.hits.length = 0;
  if (!quiet) {
    w.effects.muzzle(bullet.x, bullet.y);
    w.lastShot = w.time;
    w.lastShotX = bullet.x;
    w.lastShotY = bullet.y;
    playShoot(weapon ? weapon.id : 'pistol');
  }
  return true;
}


export function fireWeapon(w, x, y, angle, weapon, damageScale) {
  let fired = false;
  for (let i = 0; i < weapon.pellets; i += 1) {
    if (fireBullet(w, x, y, angle, true, weapon, i > 0, damageScale)) fired = true;
  }
  return fired;
}

function hitPerson(w, person, damage, fromPlayer) {
  person.hp -= damage;
  person.flash = 0.16;
  w.effects.blood(person.x, person.y);
  if (fromPlayer) w.effects.addFloater(person.x, person.y - 28, String(Math.round(damage)), person.hp <= 0 ? '#ff6b5e' : '#ffe08a');
  if (person.hp <= 0) {
    if (fromPlayer) {
      addHeat(w, person.isCop ? 50 : 45, person.x, person.y);
    }
    return true;
  }
  return false;
}

function stepBullet(w, bullet, dt) {
  bullet.x += bullet.vx * dt;
  bullet.y += bullet.vy * dt;
  bullet.life -= dt;
  if (bullet.life <= 0) {
    bullet.active = false;
    return;
  }

  if (buildingAt(w.city, bullet.x, bullet.y)) {
    w.effects.sparks(bullet.x, bullet.y);
    bullet.active = false;
    return;
  }

  for (const car of w.cars) {
    if (car.wrecked) continue;
    const dx = bullet.x - car.x;
    const dy = bullet.y - car.y;
    const localX = dx * Math.cos(-car.angle) - dy * Math.sin(-car.angle);
    const localY = dx * Math.sin(-car.angle) + dy * Math.cos(-car.angle);
    if (Math.abs(localX) < car.spec.length / 2 && Math.abs(localY) < car.spec.width / 2) {
      damageCar(w, car, bullet.damage);
      w.effects.sparks(bullet.x, bullet.y);
      bullet.active = false;
      return;
    }
  }

  if (!bullet.fromPlayer) {
    const player = w.player;
    if (!player.car && Math.hypot(bullet.x - player.x, bullet.y - player.y) < PLAYER.radius) {
      player.hp -= bullet.damage;
      player.lastDamage = w.time;
      player.flash = 0.25;
      w.effects.blood(player.x, player.y);
      w.effects.addShake(4);
      bullet.active = false;
    }
    return;
  }

  for (const ped of w.peds) {
    if (Math.hypot(bullet.x - ped.x, bullet.y - ped.y) < 15 && !bullet.hits.includes(ped)) {
      if (hitPerson(w, ped, bullet.damage, true)) ped.dead = true;
      if (bullet.pierce > 0) {
        bullet.pierce -= 1;
        bullet.hits.push(ped);
      } else {
        bullet.active = false;
        return;
      }
    }
  }
  for (const cop of w.footPolice) {
    if (Math.hypot(bullet.x - cop.x, bullet.y - cop.y) < 16 && !bullet.hits.includes(cop)) {
      if (hitPerson(w, cop, bullet.damage, true)) cop.dead = true;
      if (bullet.pierce > 0) {
        bullet.pierce -= 1;
        bullet.hits.push(cop);
      } else {
        bullet.active = false;
        return;
      }
    }
  }
  for (const car of w.policeCars) {

    const dx = bullet.x - car.x;
    const dy = bullet.y - car.y;
    const localX = dx * Math.cos(-car.angle) - dy * Math.sin(-car.angle);
    const localY = dx * Math.sin(-car.angle) + dy * Math.cos(-car.angle);
    if (Math.abs(localX) < car.spec.length / 2 && Math.abs(localY) < car.spec.width / 2) {
      addHeat(w, 12, bullet.x, bullet.y);
      bullet.active = false;
      return;
    }
  }
}

export function stepBullets(w, dt) {
  for (const ped of w.peds) if (ped.flash > 0) ped.flash -= dt * 6;
  for (const cop of w.footPolice) if (cop.flash > 0) cop.flash -= dt * 6;
  for (const bullet of w.bullets) {
    if (bullet.active) stepBullet(w, bullet, dt);
  }

  w.peds = w.peds.filter((ped) => !ped.dead);
  w.footPolice = w.footPolice.filter((cop) => !cop.dead);
}


export function punch(w, attacker, angle, fromPlayer) {
  let hit = false;
  const punchDamage = PLAYER.punchDamage * (fromPlayer ? damageMultiplier(w.player) : 1);
  const targets = [];
  for (const ped of w.peds) targets.push({ x: ped.x, y: ped.y, radius: 14, ref: ped, kind: 'ped' });
  for (const cop of w.footPolice) targets.push({ x: cop.x, y: cop.y, radius: 15, ref: cop, kind: 'cop' });
  if (!fromPlayer) {
    targets.push({ x: w.player.x, y: w.player.y, radius: PLAYER.radius, ref: w.player, kind: 'player' });
  }
  for (const target of targets) {
    const dx = target.x - attacker.x;
    const dy = target.y - attacker.y;
    const dist = Math.hypot(dx, dy);
    if (dist > PLAYER.punchRange + target.radius) continue;
    const targetAngle = Math.atan2(dy, dx);
    let diff = targetAngle - angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) > PLAYER.punchArc) continue;
    hit = true;
    w.effects.blood(target.x, target.y);
    if (target.ref) target.ref.flash = 0.16;
    if (target.kind === 'player') {
      w.player.hp -= PLAYER.punchDamage;
      w.player.lastDamage = w.time;
      w.effects.addShake(3);
    } else if (target.kind === 'cop') {
      if (hitPerson(w, target.ref, punchDamage, fromPlayer)) target.ref.dead = true;
      addHeat(w, 12, target.x, target.y);
    } else {

      target.ref.hp = (target.ref.hp ?? 30) - punchDamage;
      if (target.ref.hp <= 0) {
        target.ref.dead = true;
        addHeat(w, 30, target.x, target.y);
      } else {
        target.ref.state = 'flee';
        target.ref.fleeTimer = 2;
        target.ref.target = {
          x: target.x + (target.x - attacker.x) * 4,
          y: target.y + (target.y - attacker.y) * 4,
        };
      }
    }
  }
  if (hit) playPunch();
  w.peds = w.peds.filter((ped) => !ped.dead);
  w.footPolice = w.footPolice.filter((cop) => !cop.dead);
  return hit;
}
