// Combat: the pistol and the punch. Bullets are pooled, fly straight, and stop at the first
// thing they hit — a building, a car, a pedestrian, a cop, or the player. Punching is a short
// arc in front of the attacker. Nothing here reads the mouse; the caller passes an aim angle.
import { PISTOL, PLAYER } from './config.js';
import { buildingAt } from './city.js';
import { damageCar } from './vehicles.js';
import { addHeat } from './police.js';
import { playPunch, playShoot } from './audio.js';

const MAX_BULLETS = 48;

export function createBullets() {
  const bullets = [];
  for (let i = 0; i < MAX_BULLETS; i += 1) {
    bullets.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, fromPlayer: true });
  }
  return bullets;
}

function freeBullet(bullets) {
  for (const bullet of bullets) if (!bullet.active) return bullet;
  return null;
}

/** Fire one bullet. Returns false when the pool is empty. */
export function fireBullet(w, x, y, angle, fromPlayer) {
  const bullet = freeBullet(w.bullets);
  if (bullet === null) return false;
  const spread = (w.random() - 0.5) * PISTOL.spread * 2;
  bullet.active = true;
  bullet.x = x + Math.cos(angle) * 22;
  bullet.y = y + Math.sin(angle) * 22;
  bullet.vx = Math.cos(angle + spread) * PISTOL.bulletSpeed;
  bullet.vy = Math.sin(angle + spread) * PISTOL.bulletSpeed;
  bullet.life = PISTOL.range / PISTOL.bulletSpeed;
  bullet.fromPlayer = fromPlayer;
  w.effects.muzzle(bullet.x, bullet.y);
  w.lastShot = w.time;
  w.lastShotX = bullet.x;
  w.lastShotY = bullet.y;
  playShoot();
  return true;
}

function hitPerson(w, person, damage, fromPlayer) {
  person.hp -= damage;
  w.effects.blood(person.x, person.y);
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
  // Buildings stop bullets.
  if (buildingAt(w.city, bullet.x, bullet.y)) {
    w.effects.sparks(bullet.x, bullet.y);
    bullet.active = false;
    return;
  }
  // Cars stop bullets.
  for (const car of w.cars) {
    if (car.wrecked) continue;
    const dx = bullet.x - car.x;
    const dy = bullet.y - car.y;
    const localX = dx * Math.cos(-car.angle) - dy * Math.sin(-car.angle);
    const localY = dx * Math.sin(-car.angle) + dy * Math.cos(-car.angle);
    if (Math.abs(localX) < car.spec.length / 2 && Math.abs(localY) < car.spec.width / 2) {
      damageCar(w, car, PISTOL.damage);
      w.effects.sparks(bullet.x, bullet.y);
      bullet.active = false;
      return;
    }
  }
  // People stop bullets.
  if (!bullet.fromPlayer) {
    const player = w.player;
    if (!player.car && Math.hypot(bullet.x - player.x, bullet.y - player.y) < PLAYER.radius) {
      player.hp -= PISTOL.damage;
      player.lastDamage = w.time;
      w.effects.blood(player.x, player.y);
      w.effects.addShake(4);
      bullet.active = false;
    }
    return;
  }
  for (const ped of w.peds) {
    if (Math.hypot(bullet.x - ped.x, bullet.y - ped.y) < 14) {
      if (hitPerson(w, ped, PISTOL.damage, true)) ped.dead = true;
      bullet.active = false;
      return;
    }
  }
  for (const cop of w.footPolice) {
    if (Math.hypot(bullet.x - cop.x, bullet.y - cop.y) < 15) {
      if (hitPerson(w, cop, PISTOL.damage, true)) cop.dead = true;
      bullet.active = false;
      return;
    }
  }
  for (const car of w.policeCars) {
    // Shooting a police car counts as a crime against the police.
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
  for (const bullet of w.bullets) {
    if (bullet.active) stepBullet(w, bullet, dt);
  }
  // Remove the dead: peds and cops shot down.
  w.peds = w.peds.filter((ped) => !ped.dead);
  w.footPolice = w.footPolice.filter((cop) => !cop.dead);
}

/** A punch in an arc in front of the attacker. Returns true if it connected. */
export function punch(w, attacker, angle, fromPlayer) {
  let hit = false;
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
    if (target.kind === 'player') {
      w.player.hp -= PLAYER.punchDamage;
      w.player.lastDamage = w.time;
      w.effects.addShake(3);
    } else if (target.kind === 'cop') {
      if (hitPerson(w, target.ref, PLAYER.punchDamage, fromPlayer)) target.ref.dead = true;
      addHeat(w, 12, target.x, target.y);
    } else {
      // Punching a ped: it goes down after two hits; the first one scares it off.
      target.ref.hp = (target.ref.hp ?? 30) - PLAYER.punchDamage;
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
