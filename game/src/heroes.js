// heroes.js: The playable crew. Each hero has a look (what sprites.js paints), stats,
// a starting weapon and one active skill on Q. The look block is data, so a card, a
// HUD portrait and the street all show the same person.
import { WEAPONS } from './weapons.js';
import { addHeat } from './police.js';

export const HERO_ORDER = ['dario', 'mika', 'rocco', 'luna'];

export const HEROES = {
  dario: {
    id: 'dario', name: 'Dario Reyes', role: 'Street Boss',
    blurb: 'Smooth, cocky, always one step ahead of the law.',
    maxHp: 100, speed: 1, power: 1, weapon: 'pistol',
    skill: { name: 'Adrenaline Rush', desc: 'Fire 80% faster and run 15% quicker for 6s.', cooldown: 16, duration: 6, color: '#ff8a3c' },
    look: { skin: '#e0ac8a', hairStyle: 'quiff', hair: '#2a1c14', top: '#e4572e', detail: 'jacket', pants: '#2d3550', shoes: '#f2f0e6', face: 'shades', accent: '#e4572e', accessory: 'shades' },
  },
  mika: {
    id: 'mika', name: 'Mika "Ghost"', role: 'Shadow Runner',
    blurb: 'Light on her feet. By the time you notice her, she is gone.',
    maxHp: 80, speed: 1.15, power: 0.92, weapon: 'smg',
    skill: { name: 'Shadow Dash', desc: 'Dash through danger, untouchable for a moment. In a car: nitro burst.', cooldown: 5, duration: 0.25, color: '#37e0c8' },
    look: { skin: '#f1c9a5', hairStyle: 'hood', hair: '#4b3f72', top: '#2a2740', detail: 'bodysuit', pants: '#1c1b2e', shoes: '#37e0c8', face: 'hood', accent: '#37e0c8', extra: 'scarf' },
  },
  rocco: {
    id: 'rocco', name: 'Rocco Brandt', role: 'Heavy Bruiser',
    blurb: 'Built like a van. Punches like one, too.',
    maxHp: 150, speed: 0.9, power: 1.2, weapon: 'shotgun',
    skill: { name: 'Ground Slam', desc: 'Slam the street: knock back and hurt everything nearby.', cooldown: 10, duration: 0.3, color: '#ffb347' },
    look: { skin: '#b9825a', hairStyle: 'band', hair: '#2a1c14', top: '#4a5a3a', detail: 'vest', pants: '#3b3f2a', shoes: '#16181f', face: 'beard', accent: '#d64545', accessory: 'headband', scale: 1.1, bodyW: 23 },
  },
  luna: {
    id: 'luna', name: 'Dr. Luna Park', role: 'Street Medic',
    blurb: 'Patches up crews by day. Cooks up trouble by night.',
    maxHp: 100, speed: 1.05, power: 1, weapon: 'plasma',
    skill: { name: 'Nano Burst', desc: 'Heal 40 HP, mend your car and shrug off damage for 2s.', cooldown: 14, duration: 2, color: '#7fe8ff' },
    look: { skin: '#f6d3bd', hairStyle: 'buns', hair: '#ff5ea8', top: '#f2f0e6', detail: 'labcoat', pants: '#5a6ea8', shoes: '#f2f0e6', face: 'goggles', accent: '#7ab8ff', accessory: 'goggles' },
  },
};


export function applyHero(w, id) {
  const hero = HEROES[id] ?? HEROES.dario;
  const p = w.player;
  p.hero = hero.id;
  p.maxHp = hero.maxHp;
  p.hp = hero.maxHp;
  p.weapons = {
    owned: { pistol: true, [hero.weapon]: true },
    ammo: { pistol: WEAPONS.pistol.startAmmo, smg: 0, shotgun: 0, plasma: 0 },
    current: hero.weapon,
  };
  p.weapons.ammo[hero.weapon] = Math.max(p.weapons.ammo[hero.weapon], WEAPONS[hero.weapon].startAmmo);
  p.skillCd = 0;
  p.skillT = 0;
  p.guard = 0;
  p.dashT = 0;
  p.dashVx = 0;
  p.dashVy = 0;
  p.healT = 0;
  p.trail = [];
  p.recoil = 0;
  p.muzzleT = 0;
  p.flash = 0;
  p.fistMode = false;
}


export function fireRateMultiplier(p) {
  return p.hero === 'dario' && p.skillT > 0 ? 1.8 : 1;
}

export function speedMultiplier(p) {
  const hero = HEROES[p.hero] ?? HEROES.dario;
  return hero.speed * (p.hero === 'dario' && p.skillT > 0 ? 1.15 : 1);
}

export function damageMultiplier(p) {
  return (HEROES[p.hero] ?? HEROES.dario).power;
}


export function stepHero(w, dt) {
  const p = w.player;
  if (p.skillCd > 0) p.skillCd = Math.max(0, p.skillCd - dt);
  if (p.skillT > 0) p.skillT = Math.max(0, p.skillT - dt);
  if (p.guard > 0) p.guard = Math.max(0, p.guard - dt);
  if (p.recoil > 0) p.recoil = Math.max(0, p.recoil - dt * 7);
  if (p.muzzleT > 0) p.muzzleT = Math.max(0, p.muzzleT - dt);
  if (p.flash > 0) p.flash = Math.max(0, p.flash - dt * 6);
  if (p.healT > 0) {
    p.healT = Math.max(0, p.healT - dt);
    p.hp = Math.min(p.maxHp, p.hp + 20 * dt);
  }
  if (p.dashT > 0) {
    p.dashT = Math.max(0, p.dashT - dt);
    const last = p.trail[p.trail.length - 1];
    if (!last || Math.hypot(last.x - p.x, last.y - p.y) > 14) {
      p.trail.push({ x: p.x, y: p.y, facing: Math.cos(p.aimAngle) >= 0 ? 1 : -1, life: 0.32 });
    }
  }
  for (const ghost of p.trail) ghost.life -= dt;
  if (p.trail.length > 0 && p.trail[0].life <= 0) p.trail = p.trail.filter((ghost) => ghost.life > 0);
}


export function useSkill(w, controls) {
  const p = w.player;
  const hero = HEROES[p.hero] ?? HEROES.dario;
  if (p.skillCd > 0) return false;
  const fx = w.effects;
  const cx = p.car !== null ? p.car.x : p.x;
  const cy = p.car !== null ? p.car.y : p.y;
  if (hero.id === 'dario') {
    p.skillT = hero.skill.duration;
    fx.addRing(cx, cy, hero.skill.color, 70, 0.5);
    fx.addFloater(cx, cy - 36, 'ADRENALINE!', hero.skill.color);
  } else if (hero.id === 'mika') {
    if (p.car !== null) {
      p.car.boost = 1.1;
      fx.addRing(cx, cy, hero.skill.color, 80, 0.4);
      fx.addFloater(cx, cy - 36, 'NITRO!', hero.skill.color);
    } else {
      let dx = controls.move.x;
      let dy = controls.move.y;
      if (dx === 0 && dy === 0) {
        dx = Math.cos(p.aimAngle);
        dy = Math.sin(p.aimAngle);
      }
      p.dashT = hero.skill.duration;
      p.dashVx = dx * 720;
      p.dashVy = dy * 720;
      p.guard = Math.max(p.guard, 0.4);
      fx.addRing(cx, cy, hero.skill.color, 50, 0.3);
    }
  } else if (hero.id === 'rocco') {
    if (p.car !== null) {
      w.message = { text: 'Step out of the car to use Ground Slam.', timer: 2 };
      return false;
    }
    slam(w, p.x, p.y);
  } else if (hero.id === 'luna') {
    p.healT = 2;
    p.guard = Math.max(p.guard, hero.skill.duration);
    if (p.car !== null) p.car.health = Math.min(100, p.car.health + 40);
    fx.addRing(cx, cy, hero.skill.color, 90, 0.6);
    fx.addFloater(cx, cy - 36, 'NANO BURST', hero.skill.color);
  }
  p.skillCd = hero.skill.cooldown;
  return true;
}

const SLAM_RADIUS = 150;


function slam(w, x, y) {
  const fx = w.effects;
  fx.addRing(x, y, '#ffb347', SLAM_RADIUS, 0.45);
  fx.addShake(10);
  let hurt = false;
  const damage = 38 * damageMultiplier(w.player);
  for (const list of [w.peds, w.footPolice]) {
    for (const person of list) {
      const dx = person.x - x;
      const dy = person.y - y;
      const dist = Math.hypot(dx, dy);
      if (dist > SLAM_RADIUS) continue;
      hurt = true;
      person.hp -= damage;
      person.flash = 0.2;
      person.x += (dx / (dist || 1)) * 46;
      person.y += (dy / (dist || 1)) * 46;
      fx.blood(person.x, person.y);
      fx.addFloater(person.x, person.y - 26, String(Math.round(damage)), '#ffb347');
      if (person.hp <= 0) person.dead = true;
      else if (!person.isCop) {
        person.state = 'flee';
        person.fleeTimer = 2.5;
        person.target = { x: person.x + dx * 4, y: person.y + dy * 4 };
      }
    }
  }
  for (const car of w.cars) {
    if (car.wrecked) continue;
    const dx = car.x - x;
    const dy = car.y - y;
    const dist = Math.hypot(dx, dy);
    if (dist > SLAM_RADIUS + 20) continue;
    hurt = true;
    car.x += (dx / (dist || 1)) * 30;
    car.y += (dy / (dist || 1)) * 30;
    car.vx += (dx / (dist || 1)) * 260;
    car.vy += (dy / (dist || 1)) * 260;
    car.damageFlash = 0.2;
  }
  w.peds = w.peds.filter((ped) => !ped.dead);
  w.footPolice = w.footPolice.filter((cop) => !cop.dead);
  if (hurt) addHeat(w, 25, x, y);
  return hurt;
}
