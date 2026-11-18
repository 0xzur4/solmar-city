// hud.js: The HUD and the menus, drawn in 1280x720 view coordinates.
import { CITY, FONT, MONEY, PALETTE, VIEW, WORLD } from './config.js';
import { HERO_ORDER, HEROES } from './heroes.js';
import { WEAPON_ORDER, WEAPONS } from './weapons.js';
import { drawCharacter } from './sprites.js';
import { MISSIONS, currentMission, currentStep } from './missions.js';

const MINIMAP = { width: 224, height: 160, x: VIEW.width - 224 - 16, y: VIEW.height - 160 - 16 };
const CONTROLS = [
  ['WASD', 'Move'], ['Shift', 'Run'], ['E', 'Enter / exit car'],
  ['Space', 'Handbrake'], ['Click', 'Shoot / punch'], ['F', 'Punch'],
  ['V', 'Fists / weapons'], ['G', 'Repair at garage'], ['P', 'Pause'],
  ['M', 'Mute'], ['Q', 'Hero skill'], ['1-4', 'Weapons'],
];


function wrapLine(context, line, maxWidth, size) {
  context.font = `${size}px ${FONT}`;
  const words = line.split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    const test = current.length > 0 ? `${current} ${word}` : word;
    if (context.measureText(test).width > maxWidth && current.length > 0) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current.length > 0) lines.push(current);
  return lines;
}



function drawPanel(context, text, width, title, body, prompt) {
  const x = (VIEW.width - width) / 2;
  const pad = 32;
  const inner = width - pad * 2;
  const contentH = body(x + pad, 0, inner, false);
  const height = 96 + contentH + (prompt ? 76 : 28);
  const y = Math.max(16, (VIEW.height - height) / 2);
  context.fillStyle = 'rgba(10, 14, 20, 0.78)';
  context.fillRect(0, 0, VIEW.width, VIEW.height);
  context.fillStyle = 'rgba(14, 18, 26, 0.97)';
  context.beginPath();
  context.roundRect(x, y, width, height, 14);
  context.fill();
  context.strokeStyle = 'rgba(255, 210, 63, 0.55)';
  context.lineWidth = 2;
  context.stroke();
  text(title, VIEW.width / 2 + 2, y + 73, 56, 'rgba(0, 0, 0, 0.55)', 'center');
  text(title, VIEW.width / 2, y + 70, 56, PALETTE.title, 'center');
  body(x + pad, y + 96, inner, true);
  if (prompt) {
    context.globalAlpha = 0.65 + 0.35 * Math.sin(performance.now() / 320);
    text(prompt, VIEW.width / 2, y + height - 32, 22, PALETTE.hudGold, 'center');
    context.globalAlpha = 1;
  }
}


function drawLines(context, text, items, y, width, size, draw) {
  let cursor = y;
  for (const item of items) {
    const s = item.size ?? size;
    const wrapped = wrapLine(context, item.t, width, s);
    if (draw) wrapped.forEach((line, n) => text(line, VIEW.width / 2, cursor + s + n * Math.round(s * 1.4) - 2, s, item.color ?? PALETTE.hudMuted, 'center'));
    cursor += wrapped.length * Math.round(s * 1.4) + (item.gap ?? 0);
  }
  return cursor - y;
}

function drawControls(context, text, x, y, width, draw) {
  if (!draw) return Math.ceil(CONTROLS.length / 3) * 34;
  const colW = width / 3;
  for (let i = 0; i < CONTROLS.length; i += 1) {
    const [key, action] = CONTROLS[i];
    const cx = x + (i % 3) * colW;
    const cy = y + Math.floor(i / 3) * 34 + 17;
    context.fillStyle = 'rgba(255, 255, 255, 0.1)';
    context.strokeStyle = 'rgba(255, 255, 255, 0.28)';
    context.lineWidth = 1;
    context.beginPath();
    context.roundRect(cx, cy - 12, 64, 24, 6);
    context.fill();
    context.stroke();
    text(key, cx + 32, cy + 1, 14, PALETTE.hudText, 'center', 'middle');
    text(action, cx + 74, cy + 1, 16, PALETTE.hudMuted, 'left', 'middle');
  }
  return Math.ceil(CONTROLS.length / 3) * 34;
}

function drawJobs(context, text, w, x, y, width, draw) {
  const rows = Math.ceil(MISSIONS.length / 2);
  if (!draw) return rows * 26 + 4;
  for (let i = 0; i < MISSIONS.length; i += 1) {
    const done = i < w.missions.index;
    const current = i === w.missions.index && !w.missions.done;
    const cx = x + Math.floor(i / rows) * (width / 2);
    const cy = y + (i % rows) * 26 + 13;
    const mark = done ? '✓' : current ? '▶' : '·';
    const color = done ? PALETTE.health : current ? PALETTE.hudGold : PALETTE.starEmpty;
    text(mark, cx, cy, 16, color, 'left', 'middle');
    text(`${i + 1}. ${MISSIONS[i].name}`, cx + 24, cy, 17, done || current ? PALETTE.hudText : PALETTE.hudMuted, 'left', 'middle');
  }
  return rows * 26 + 4;
}

function drawStars(context, text, w) {
  const stars = w.wanted.stars;
  const x0 = VIEW.width - 220;
  const y0 = 22;
  text('WANTED', x0 - 12, y0 + 14, 16, PALETTE.hudText, 'right');
  const pulse = stars > 0 ? 1 + Math.sin(w.time * 8) * 0.18 : 1;
  for (let i = 0; i < 5; i += 1) {
    const size = i === stars - 1 ? Math.round(24 * pulse) : 24;
    text('★', x0 + i * 26, y0 + 16, size, i < stars ? PALETTE.star : PALETTE.starEmpty, 'left');
  }
}

function drawMinimap(context, text, w) {
  const { x, y, width, height } = MINIMAP;
  const scale = Math.min(width / WORLD.width, height / WORLD.height);
  const mapW = WORLD.width * scale;
  const mapH = WORLD.height * scale;
  const ox = x + (width - mapW) / 2;
  const oy = y + (height - mapH) / 2;
  context.fillStyle = 'rgba(10, 14, 20, 0.72)';
  context.fillRect(x - 6, y - 6, width + 12, height + 12);
  context.fillStyle = PALETTE.hudText;
  context.font = '14px ui-monospace, Menlo, Consolas, monospace';
  context.textAlign = 'center';
  context.fillText('SOLMAR', x + width / 2, y - 8);
  context.fillStyle = '#5d9153';
  context.fillRect(ox, oy, mapW, mapH);
  context.fillStyle = PALETTE.sand;
  context.fillRect(ox, oy + CITY.beachY * scale, mapW, (CITY.waterY - CITY.beachY) * scale);
  context.fillStyle = PALETTE.water;
  context.fillRect(ox, oy + CITY.waterY * scale, mapW, (WORLD.height - CITY.waterY) * scale);
  context.strokeStyle = '#3d3a38';
  context.lineWidth = 3;
  for (const avenue of CITY.avenues) {
    context.beginPath();
    context.moveTo(ox + avenue * scale, oy);
    context.lineTo(ox + avenue * scale, oy + CITY.beachY * scale);
    context.stroke();
  }
  for (const street of CITY.streets) {
    context.beginPath();
    context.moveTo(ox, oy + street * scale);
    context.lineTo(ox + mapW, oy + street * scale);
    context.stroke();
  }
  context.fillStyle = 'rgba(232, 168, 124, 0.8)';
  for (const building of w.city.buildings) {
    context.fillRect(ox + building.x * scale, oy + building.y * scale, Math.max(1, building.w * scale), Math.max(1, building.h * scale));
  }
  const halfW = VIEW.width / (2 * w.camera.zoom);
  const halfH = VIEW.height / (2 * w.camera.zoom);
  context.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  context.lineWidth = 1;
  context.strokeRect(ox + (w.camera.x - halfW) * scale, oy + (w.camera.y - halfH) * scale, halfW * 2 * scale, halfH * 2 * scale);
  const marker = w.marker;
  if (marker) {
    const pulse = 1 + Math.sin(w.time * 4) * 0.2;
    context.fillStyle = PALETTE.marker;
    context.beginPath();
    context.arc(ox + marker.x * scale, oy + marker.y * scale, 5 * pulse, 0, Math.PI * 2);
    context.fill();
  }
  for (const car of w.policeCars) {
    context.fillStyle = '#ff3b30';
    context.beginPath();
    context.arc(ox + car.x * scale, oy + car.y * scale, 3.5, 0, Math.PI * 2);
    context.fill();
  }
  for (const cop of w.footPolice) {
    context.fillStyle = '#ff3b30';
    context.fillRect(ox + cop.x * scale - 2, oy + cop.y * scale - 2, 4, 4);
  }
  const player = w.player;
  const px = player.car !== null ? player.car.x : player.x;
  const py = player.car !== null ? player.car.y : player.y;
  const angle = player.car !== null ? player.car.angle : player.angle;
  context.fillStyle = '#ffffff';
  context.save();
  context.translate(ox + px * scale, oy + py * scale);
  context.rotate(angle);
  context.beginPath();
  context.moveTo(7, 0);
  context.lineTo(-5, -5);
  context.lineTo(-5, 5);
  context.closePath();
  context.fill();
  context.restore();
}

export function drawHud(context, text, w) {
  const player = w.player;
  const mission = currentMission(w.missions);
  const step = currentStep(w.missions);
  context.fillStyle = PALETTE.hudPanel;
  context.beginPath();
  context.roundRect(16, 16, 430, 66, 8);
  context.fill();
  if (mission !== null && step !== null) {
    text(mission.name, 30, 40, 20, PALETTE.hudGold, 'left');
    text(step.text, 30, 64, 17, PALETTE.hudText, 'left');
    const marker = w.marker;
    if (marker && step.type !== 'race') {
      const px = player.car !== null ? player.car.x : player.x;
      const py = player.car !== null ? player.car.y : player.y;
      text(`${Math.round(Math.hypot(marker.x - px, marker.y - py))}m`, 432, 40, 18, PALETTE.hudMuted, 'right');
    }
    if (step.seconds !== undefined) {
      const left = Math.max(0, Math.ceil(step.seconds - w.missions.timer));
      text(`${left}s`, 432, 64, 18, PALETTE.hudText, 'right');
    }
    if (step.type === 'race') {
      text(`Checkpoint ${w.missions.checkpoint + 1}/${step.checkpoints.length}`, 432, 40, 18, PALETTE.hudText, 'right');
    }
  } else if (w.missions.done) {
    text('King of Solmar', 30, 40, 20, PALETTE.hudGold, 'left');
    text('Free roam — the city is yours.', 30, 64, 17, PALETTE.hudText, 'left');
  }
  drawStars(context, text, w);
  text(`$${player.money}`, VIEW.width - 24, 62, 26, PALETTE.hudGold, 'right');
  const healthW = 180;
  const healthX = VIEW.width - 24 - healthW;
  const healthY = 96;
  context.fillStyle = 'rgba(0, 0, 0, 0.5)';
  context.fillRect(healthX, healthY, healthW, 14);
  context.fillStyle = player.hp < player.maxHp * 0.3 ? PALETTE.healthLow : PALETTE.health;
  context.fillRect(healthX, healthY, healthW * Math.max(0, Math.min(1, player.hp / player.maxHp)), 14);
  text(`${Math.max(0, Math.ceil(player.hp))}/${player.maxHp}`, healthX + healthW - 6, healthY + 12, 12, PALETTE.hudText, 'right');
  text('HP', healthX - 10, healthY + 12, 14, PALETTE.hudMuted, 'right');
  drawHeroPanel(context, text, w);
  if (w.message.timer > 0) {
    context.globalAlpha = Math.min(1, w.message.timer);
    text(w.message.text, VIEW.width / 2, 150, 24, PALETTE.hudText, 'center');
    context.globalAlpha = 1;
  }
  if (w.missionCard !== null) {
    const card = w.missionCard;
    const subLines = wrapLine(context, card.sub, 580, 16);
    const cardHeight = 86 + (subLines.length - 1) * 22;
    context.globalAlpha = Math.min(1, card.timer);
    context.fillStyle = 'rgba(10, 14, 20, 0.82)';
    context.beginPath();
    context.roundRect(VIEW.width / 2 - 310, 196, 620, cardHeight, 10);
    context.fill();
    context.strokeStyle = 'rgba(255, 210, 63, 0.6)';
    context.lineWidth = 2;
    context.stroke();
    text(card.title, VIEW.width / 2, 234, 28, PALETTE.hudGold, 'center');
    subLines.forEach((line, i) => text(line, VIEW.width / 2, 264 + i * 22, 16, PALETTE.hudText, 'center'));
    context.globalAlpha = 1;
  }
  if (player.hp > 0 && player.hp < 30) {
    context.globalAlpha = 0.6 + Math.sin(w.time * 6) * 0.4;
    text('LOW HEALTH — find a health pack', VIEW.width / 2, 320, 20, PALETTE.hudBad, 'center');
    context.globalAlpha = 1;
  }
  if (w.time < 25 && !w.missions.done) {
    text('WASD move · Shift run · Q skill · V fists / weapons · 1-4 weapons · E car · P pause', VIEW.width / 2 + 120, VIEW.height - 24, 15, PALETTE.hudMuted, 'center');
  }
  drawMinimap(context, text, w);
}


function drawHeroPanel(context, text, w) {
  const player = w.player;
  const hero = HEROES[player.hero] ?? HEROES.dario;
  const top = VIEW.height - 104;
  context.fillStyle = PALETTE.hudPanel;
  context.beginPath();
  context.roundRect(16, top, 420, 88, 12);
  context.fill();
  const px = 66;
  const py = top + 44;
  const fraction = Math.max(0, Math.min(1, player.hp / player.maxHp));
  context.save();
  context.beginPath();
  context.arc(px, py, 32, 0, Math.PI * 2);
  context.clip();
  const bg = context.createRadialGradient(px - 8, py - 10, 4, px, py, 34);
  bg.addColorStop(0, hero.skill.color);
  bg.addColorStop(1, '#1a2030');
  context.fillStyle = bg;
  context.fillRect(px - 34, py - 34, 68, 68);
  drawCharacter(context, {
    look: hero.look, x: px, y: py + 16.4 * 2.1 * 0.9 * (hero.look.scale ?? 1) + 2, facing: 1, aim: 0.1, scale: 2.1,
    weapon: null, time: w.time, seed: 1, flash: player.flash > 0 ? player.flash : 0, moving: 0,
  });
  context.restore();
  context.lineWidth = 5;
  context.strokeStyle = 'rgba(0, 0, 0, 0.55)';
  context.beginPath();
  context.arc(px, py, 35, 0, Math.PI * 2);
  context.stroke();
  context.strokeStyle = fraction < 0.3 ? PALETTE.healthLow : PALETTE.health;
  context.lineCap = 'round';
  context.beginPath();
  context.arc(px, py, 35, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * fraction);
  context.stroke();
  context.lineCap = 'butt';
  const tx = 118;
  if (player.car !== null) {
    const speed = Math.round(Math.hypot(player.car.vx, player.car.vy) * 0.18);
    text(`${speed} km/h`, tx, top + 34, 24, PALETTE.hudText, 'left');
    text(`Car ${Math.max(0, Math.round(player.car.health))}%`, tx, top + 56, 15, PALETTE.hudMuted, 'left');
    const nearGarage = Math.hypot(w.city.garage.x - player.car.x, w.city.garage.y - player.car.y) < 140;
    text(nearGarage && player.car.health < 100 ? `G: repair $${MONEY.repairCost}` : 'E: exit car   Click: drive-by', tx, top + 76, 13, PALETTE.hudMuted, 'left');
  } else if (player.fistMode) {
    text('FISTS', tx, top + 30, 19, '#ffd23f', 'left');
    text('Click to punch', tx, top + 54, 18, PALETTE.hudText, 'left');
    text('V: weapons · F: quick punch', tx, top + 78, 12, PALETTE.hudMuted, 'left');
  } else {
    const current = WEAPONS[player.weapons.current];
    text(current.name, tx, top + 30, 19, current.color, 'left');
    const ammo = player.weapons.ammo[current.id];
    text(`Ammo ${ammo}`, tx, top + 54, 18, ammo > 0 ? PALETTE.hudText : PALETTE.healthLow, 'left');
    text('Hold click: shoot · V: fists', tx, top + 78, 12, PALETTE.hudMuted, 'left');
  }
  for (let i = 0; i < WEAPON_ORDER.length; i += 1) {
    const id = WEAPON_ORDER[i];
    const owned = player.weapons.owned[id];
    const x = 242 + i * 30;
    const y = top + 14;
    context.fillStyle = owned ? 'rgba(255, 255, 255, 0.14)' : 'rgba(255, 255, 255, 0.05)';
    context.beginPath();
    context.roundRect(x, y, 26, 26, 6);
    context.fill();
    if (id === player.weapons.current && !player.fistMode) {
      context.strokeStyle = WEAPONS[id].color;
      context.lineWidth = 2;
      context.stroke();
    }
    text(String(i + 1), x + 13, y + 18, 14, owned ? WEAPONS[id].color : PALETTE.starEmpty, 'center');
  }
  const sx = 392;
  const sy = top + 44;
  const ready = player.skillCd <= 0;
  const live = player.skillT > 0 || player.guard > 0.3 || player.dashT > 0;
  context.fillStyle = 'rgba(14, 18, 26, 0.9)';
  context.beginPath();
  context.arc(sx, sy, 30, 0, Math.PI * 2);
  context.fill();
  if (ready || live) {
    context.globalAlpha = 0.5 + Math.sin(performance.now() / 180) * 0.25;
    context.fillStyle = hero.skill.color;
    context.beginPath();
    context.arc(sx, sy, 30, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = 1;
  } else {
    const done = 1 - player.skillCd / hero.skill.cooldown;
    context.fillStyle = hero.skill.color;
    context.globalAlpha = 0.32;
    context.beginPath();
    context.moveTo(sx, sy);
    context.arc(sx, sy, 30, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * done);
    context.closePath();
    context.fill();
    context.globalAlpha = 1;
  }
  context.lineWidth = 3;
  context.strokeStyle = ready ? hero.skill.color : '#4a5368';
  context.beginPath();
  context.arc(sx, sy, 30, 0, Math.PI * 2);
  context.stroke();
  text(ready || live ? 'Q' : String(Math.ceil(player.skillCd)), sx, sy + 8, ready || live ? 24 : 22, ready || live ? '#ffffff' : PALETTE.hudText, 'center');
  text(hero.skill.name, sx, top + 84, 11, PALETTE.hudMuted, 'center');
}


const CARD = { w: 270, h: 470, gap: 20, y: 132 };
const CARD_X0 = (VIEW.width - (CARD.w * 4 + CARD.gap * 3)) / 2;

function cardX(i) {
  return CARD_X0 + i * (CARD.w + CARD.gap);
}

export function heroCardAt(x, y) {
  if (y < CARD.y || y > CARD.y + CARD.h) return -1;
  for (let i = 0; i < HERO_ORDER.length; i += 1) {
    if (x >= cardX(i) && x <= cardX(i) + CARD.w) return i;
  }
  return -1;
}

function statBar(context, text, label, fraction, x, y, color) {
  text(label, x, y + 10, 13, PALETTE.hudMuted, 'left');
  context.fillStyle = 'rgba(255, 255, 255, 0.1)';
  context.beginPath();
  context.roundRect(x + 44, y, 170, 11, 5);
  context.fill();
  context.fillStyle = color;
  context.beginPath();
  context.roundRect(x + 44, y, Math.max(8, 170 * Math.min(1, fraction)), 11, 5);
  context.fill();
}

function drawHeroSelect(context, text, w) {
  const time = performance.now() / 1000;
  context.fillStyle = 'rgba(10, 14, 20, 0.86)';
  context.fillRect(0, 0, VIEW.width, VIEW.height);
  const chosen = HEROES[HERO_ORDER[w.ui.heroIndex]];
  text('CHOOSE YOUR CRIMINAL', VIEW.width / 2 + 2, 63, 40, 'rgba(0, 0, 0, 0.55)', 'center');
  text('CHOOSE YOUR CRIMINAL', VIEW.width / 2, 60, 40, PALETTE.title, 'center');
  text(chosen.blurb, VIEW.width / 2, 100, 18, PALETTE.hudMuted, 'center');
  for (let i = 0; i < HERO_ORDER.length; i += 1) {
    const hero = HEROES[HERO_ORDER[i]];
    const selected = i === w.ui.heroIndex;
    const x = cardX(i);
    const y = CARD.y - (selected ? 8 : 0);
    context.fillStyle = selected ? 'rgba(26, 32, 46, 0.97)' : 'rgba(18, 22, 32, 0.9)';
    context.beginPath();
    context.roundRect(x, y, CARD.w, CARD.h, 16);
    context.fill();
    context.lineWidth = selected ? 3 : 1.5;
    context.strokeStyle = selected ? hero.skill.color : 'rgba(255, 255, 255, 0.18)';
    context.stroke();
    context.save();
    context.beginPath();
    context.roundRect(x + 6, y + 6, CARD.w - 12, 212, 12);
    context.clip();
    const spot = context.createRadialGradient(x + CARD.w / 2, y + 130, 10, x + CARD.w / 2, y + 130, 170);
    spot.addColorStop(0, hero.skill.color);
    spot.addColorStop(1, 'rgba(10, 14, 20, 0.2)');
    context.globalAlpha = selected ? 0.55 : 0.28;
    context.fillStyle = spot;
    context.fillRect(x, y, CARD.w, 230);
    context.globalAlpha = 1;
    const cycle = time % 1.7;
    const recoil = selected ? Math.max(0, 1 - cycle * 6) : 0;
    drawCharacter(context, {
      look: hero.look, x: x + CARD.w / 2 - 6, y: y + 122, facing: 1, aim: -0.08 + Math.sin(time * 1.3 + i) * 0.06,
      scale: 3.1, weapon: hero.weapon, twoHanded: WEAPONS[hero.weapon].twoHanded, time, seed: i + 1,
      recoil, muzzle: recoil > 0.55 ? 0.06 : 0, firing: recoil > 0.55, moving: 0,
    });
    context.restore();
    text(hero.name, x + CARD.w / 2, y + 244, 21, selected ? PALETTE.hudGold : PALETTE.hudText, 'center');
    text(hero.role.toUpperCase(), x + CARD.w / 2, y + 264, 13, hero.skill.color, 'center');
    statBar(context, text, 'HP', hero.maxHp / 150, x + 18, y + 282, '#7fd08a');
    statBar(context, text, 'SPD', hero.speed / 1.2, x + 18, y + 302, '#7fb8ff');
    statBar(context, text, 'PWR', hero.power / 1.3, x + 18, y + 322, '#ff9a7a');
    text(`Q · ${hero.skill.name}`, x + 18, y + 362, 15, hero.skill.color, 'left');
    wrapLine(context, hero.skill.desc, CARD.w - 36, 13).slice(0, 3).forEach((line, n) => text(line, x + 18, y + 382 + n * 17, 13, PALETTE.hudMuted, 'left'));
    const weapon = WEAPONS[hero.weapon];
    text('Starts with', x + 18, y + CARD.h - 30, 12, PALETTE.hudMuted, 'left');
    text(weapon.name, x + 18, y + CARD.h - 12, 15, weapon.color, 'left');
  }
  text('← → or mouse to browse   ·   Enter or click to choose   ·   Esc to go back', VIEW.width / 2, 660, 18, PALETTE.hudMuted, 'center');
}

function statsLine(w, full) {
  return full
    ? `Money $${w.player.money} · Earned $${w.stats.earned}`
    : `Money $${w.player.money} · ${w.stats.carsStolen} cars stolen`;
}

export function drawScreenPanel(context, text, kind, w) {
  if (kind === 'select') {
    drawHeroSelect(context, text, w);
    return;
  }
  if (kind === 'title') {
    drawPanel(context, text, 780, 'SOLMAR', (x, y, width, draw) => {
      let cursor = y;
      cursor += drawLines(context, text, [
        { t: 'An open-world crime story', color: PALETTE.hudGold, size: 22, gap: 6 },
        { t: 'Pick your crew member — the fixer Mara Voss has work for them.' },
        { t: 'Four heroes. Eleven jobs. One rival. A city that never sleeps.' },
      ], cursor, width, 20, draw);
      cursor += 14;
      cursor += drawControls(context, text, x, cursor, width, draw);
      cursor += 14;
      cursor += drawJobs(context, text, w, x + 40, cursor, width - 80, draw);
      cursor += 14;
      cursor += drawLines(context, text, [{ t: statsLine(w, false), color: PALETTE.hudText, size: 17 }], cursor, width, 20, draw);
      return cursor - y;
    }, 'Press Enter or click to choose your hero');
    return;
  }
  if (kind === 'paused') {
    drawPanel(context, text, 700, 'PAUSED', (x, y, width, draw) => {
      let cursor = y;
      cursor += drawLines(context, text, [{ t: `Playing as ${(HEROES[w.player.hero] ?? HEROES.dario).name}`, color: PALETTE.hudGold, size: 20 }], cursor, width, 20, draw);
      cursor += 14;
      cursor += drawJobs(context, text, w, x + 40, cursor, width - 80, draw);
      cursor += 14;
      cursor += drawLines(context, text, [
        { t: statsLine(w, true), color: PALETTE.hudText, size: 17 },
        { t: 'R: restart mission   ·   Q: quit to title', size: 17 },
      ], cursor, width, 20, draw);
      return cursor - y;
    }, 'Press P or Esc to resume');
    return;
  }
  if (kind === 'busted' || kind === 'wasted') {
    const busted = kind === 'busted';
    drawPanel(context, text, 660, busted ? 'BUSTED' : 'WASTED', (x, y, width) => drawLines(context, text, [
      { t: busted ? 'The Solmar PD caught up with you.' : 'You woke up at Solmar General.' },
      { t: `You lost $${w.penalty ?? 0} and the mission restarts.` },
      { t: 'The garage still has work for you.' },
    ], y, width, 20, draw), 'Press Enter to continue');
    return;
  }
  if (kind === 'complete') {
    drawPanel(context, text, 700, 'KING OF SOLMAR', (x, y, width, draw) => {
      let cursor = y;
      cursor += drawLines(context, text, [
        { t: 'Vince Kroll is finished. Mara pays in full.', size: 20 },
        { t: 'You run this city now.' },
      ], cursor, width, 20, draw);
      cursor += 14;
      cursor += drawJobs(context, text, w, x + 40, cursor, width - 80, draw);
      cursor += 14;
      cursor += drawLines(context, text, [
        { t: `Earned $${w.stats.earned} · ${w.stats.carsStolen} cars stolen`, color: PALETTE.hudText, size: 17 },
        { t: `Final cash: $${w.player.money}`, color: PALETTE.hudGold, size: 20 },
        { t: 'Free roam continues — the streets are still yours.' },
      ], cursor, width, 20, draw);
      return cursor - y;
    }, 'Press Enter to keep playing');
  }
}
