// hud.js: The HUD and the menus, drawn in 1280x720 view coordinates: objective t
import { CITY, MONEY, PALETTE, PICKUPS, VIEW, WORLD } from './config.js';
import { MISSIONS, currentMission, currentStep } from './missions.js';
import { packagesFound } from './sidejobs.js';

const MINIMAP = { width: 224, height: 160, x: VIEW.width - 224 - 16, y: VIEW.height - 160 - 16 };

const PANEL_FONT = '20px ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace';

/** Wrap one line to the panel's width, so no line ever runs past the panel's edge. */
function wrapLine(context, line, maxWidth) {
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

function drawPanel(context, text, x, y, width, height, title, lines, prompt) {
  context.fillStyle = 'rgba(10, 14, 20, 0.78)';
  context.fillRect(0, 0, VIEW.width, VIEW.height);
  context.fillStyle = PALETTE.hudPanel;
  context.beginPath();
  context.roundRect(x, y, width, height, 12);
  context.fill();
  context.strokeStyle = 'rgba(255, 210, 63, 0.5)';
  context.lineWidth = 2;
  context.stroke();
  text(title, VIEW.width / 2, y + 74, 52, PALETTE.title, 'center');
  context.font = PANEL_FONT;
  const wrapped = lines.flatMap((line) => (line === '' ? [''] : wrapLine(context, line, width - 48)));
  for (let i = 0; i < wrapped.length; i += 1) {
    text(wrapped[i], VIEW.width / 2, y + 132 + i * 30, 20, PALETTE.hudMuted, 'center');
  }
  if (prompt) text(prompt, VIEW.width / 2, y + height - 36, 22, PALETTE.hudGold, 'center');
}

function drawStars(context, text, w) {
  const stars = w.wanted.stars;
  const x0 = VIEW.width - 220;
  const y0 = 22;
  text('WANTED', x0 - 12, y0 + 14, 16, PALETTE.hudText, 'right');
  // The newest star pulses while the heat is on.
  const pulse = stars > 0 ? 1 + Math.sin(w.time * 8) * 0.18 : 1;
  for (let i = 0; i < 5; i += 1) {
    const size = i === stars - 1 ? Math.round(24 * pulse) : 24;
    text('★', x0 + i * 26, y0 + 16, size, i < stars ? PALETTE.star : PALETTE.starEmpty, 'left');
  }
  if (w.heli.active) {
    text('HELI', x0 - 12, y0 + 42, 14, PALETTE.hudBad, 'right');
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
  context.fillStyle = 'rgba(10, 14, 20, 0.72)';
  context.fillRect(x + width / 2 - 44, y - 24, 88, 20);
  context.fillStyle = PALETTE.hudText;
  context.font = '14px ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace';
  context.textAlign = 'center';
  context.textBaseline = 'alphabetic';
  context.fillText('SOLMAR', x + width / 2, y - 8);
  // Land, sand, water.
  context.fillStyle = '#5d9153';
  context.fillRect(ox, oy, mapW, mapH);
  context.fillStyle = PALETTE.sand;
  context.fillRect(ox, oy + CITY.beachY * scale, mapW, (CITY.waterY - CITY.beachY) * scale);
  context.fillStyle = PALETTE.water;
  context.fillRect(ox, oy + CITY.waterY * scale, mapW, (WORLD.height - CITY.waterY) * scale);
  // Roads.
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
  // Buildings.
  context.fillStyle = 'rgba(232, 168, 124, 0.8)';
  for (const building of w.city.buildings) {
    context.fillRect(ox + building.x * scale, oy + building.y * scale, Math.max(1, building.w * scale), Math.max(1, building.h * scale));
  }
  // The view rectangle, sized by the camera zoom.
  const halfW = VIEW.width / (2 * w.camera.zoom);
  const halfH = VIEW.height / (2 * w.camera.zoom);
  context.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  context.lineWidth = 1;
  context.strokeRect(ox + (w.camera.x - halfW) * scale, oy + (w.camera.y - halfH) * scale, halfW * 2 * scale, halfH * 2 * scale);
  // Blips: mission marker, fare peds, police, player.
  const marker = w.marker;
  if (marker) {
    const pulse = 1 + Math.sin(w.time * 4) * 0.2;
    context.fillStyle = PALETTE.marker;
    context.beginPath();
    context.arc(ox + marker.x * scale, oy + marker.y * scale, 5 * pulse, 0, Math.PI * 2);
    context.fill();
  }
  for (const ped of w.peds) {
    if (!ped.fare) continue;
    context.fillStyle = '#7fd08a';
    context.fillRect(ox + ped.x * scale - 2, oy + ped.y * scale - 2, 4, 4);
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
  // Top-left: the mission and the current objective, with distance to the marker.
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
      const dist = Math.round(Math.hypot(marker.x - px, marker.y - py));
      text(`${dist}m`, 432, 40, 18, PALETTE.hudMuted, 'right');
    }
    if (step.type === 'hold' || step.type === 'survive' || step.type === 'race') {
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
  // Top-right: wanted stars, money, health, packages.
  drawStars(context, text, w);
  text(`$${player.money}`, VIEW.width - 24, 62, 26, PALETTE.hudGold, 'right');
  context.fillStyle = PALETTE.hudPanel;
  context.beginPath();
  context.roundRect(VIEW.width - 24 - 150, 118, 150, 24, 6);
  context.fill();
  text(`Packages ${packagesFound(w)}/${PICKUPS.packages}`, VIEW.width - 32, 135, 14, PALETTE.hudText, 'right');
  const healthW = 180;
  const healthX = VIEW.width - 24 - healthW;
  const healthY = 96;
  context.fillStyle = 'rgba(0, 0, 0, 0.5)';
  context.fillRect(healthX, healthY, healthW, 14);
  context.fillStyle = player.hp < 30 ? PALETTE.healthLow : PALETTE.health;
  context.fillRect(healthX, healthY, healthW * Math.max(0, player.hp / 100), 14);
  text('HP', healthX - 10, healthY + 12, 14, PALETTE.hudMuted, 'right');
  // Bottom-left: what the player is doing, and the ammo.
  context.fillStyle = PALETTE.hudPanel;
  context.beginPath();
  context.roundRect(16, VIEW.height - 66, 300, 50, 8);
  context.fill();
  if (player.car !== null) {
    const speed = Math.round(Math.hypot(player.car.vx, player.car.vy) * 0.18);
    text(`${speed} km/h`, 30, VIEW.height - 40, 20, PALETTE.hudText, 'left');
    text(`Car ${Math.max(0, Math.round(player.car.health))}%`, 30, VIEW.height - 24, 14, PALETTE.hudMuted, 'left');
    const nearGarage = Math.hypot(w.city.garage.x - player.car.x, w.city.garage.y - player.car.y) < 140;
    text(nearGarage && player.car.health < 100 ? `G: repair $${MONEY.repairCost}` : 'E: exit car', 300, VIEW.height - 40, 14, PALETTE.hudMuted, 'right');
  } else {
    text(`Ammo ${player.ammo}`, 30, VIEW.height - 40, 20, PALETTE.hudText, 'left');
    text('E: enter car   F: punch   Click: shoot', 30, VIEW.height - 24, 14, PALETTE.hudMuted, 'left');
  }
  // A fare in progress.
  if (w.fare !== null) {
    text(`Fare: $${w.fare.reward} — drive to the marker`, VIEW.width / 2, 110, 18, PALETTE.hudGold, 'center');
  }
  // The message banner.
  if (w.message.timer > 0) {
    context.globalAlpha = Math.min(1, w.message.timer);
    text(w.message.text, VIEW.width / 2, 150, 24, PALETTE.hudText, 'center');
    context.globalAlpha = 1;
  }
  // Mission card: the job briefing or the completion banner, centre screen.
  if (w.missionCard !== null) {
    const card = w.missionCard;
    context.globalAlpha = Math.min(1, card.timer);
    context.fillStyle = 'rgba(10, 14, 20, 0.82)';
    context.beginPath();
    context.roundRect(VIEW.width / 2 - 310, 196, 620, 108, 10);
    context.fill();
    context.strokeStyle = 'rgba(255, 210, 63, 0.6)';
    context.lineWidth = 2;
    context.stroke();
    text(card.title, VIEW.width / 2, 234, 28, PALETTE.hudGold, 'center');
    context.font = '16px ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace';
    for (const [i, line] of wrapLine(context, card.sub, 580).entries()) {
      text(line, VIEW.width / 2, 264 + i * 22, 16, PALETTE.hudText, 'center');
    }
    context.globalAlpha = 1;
  }
  // Low health warning, pulsing.
  if (player.hp > 0 && player.hp < 30) {
    context.globalAlpha = 0.6 + Math.sin(w.time * 6) * 0.4;
    text('LOW HEALTH — find a health pack', VIEW.width / 2, 320, 20, PALETTE.hudBad, 'center');
    context.globalAlpha = 1;
  }
  // Helicopter warning, above the controls hint at the bottom.
  if (w.heli.active) {
    text('POLICE HELICOPTER — break line of sight', VIEW.width / 2, VIEW.height - 112, 17, PALETTE.hudBad, 'center');
  }
  // Early-game controls hint.
  if (w.time < 25 && !w.missions.done) {
    text('WASD move · Shift run · E enter car · Space handbrake · P pause · M mute', VIEW.width / 2, VIEW.height - 90, 15, PALETTE.hudMuted, 'center');
  }
  drawMinimap(context, text, w);
}

/** One line naming every job, with its state: done, current, or locked. */
function jobsLine(w) {
  return `Jobs: ${MISSIONS.map((m, i) => `${i < w.missions.index ? '✓' : i === w.missions.index ? '▶' : '·'} ${m.name}`).join('   ')}`;
}

export function drawScreenPanel(context, text, kind, w) {
  if (kind === 'title') {
    const lines = [
      'Dario Reyes is back in Solmar — and the fixer Mara Voss has work for him.',
      'Eleven jobs. One rival. A city that never sleeps.',
      '',
      'WASD move · Shift run · E enter or exit a car · Space handbrake',
      'Click shoot · F punch · G repair at the garage · P pause · M mute',
      '',
      jobsLine(w),
      '',
      `Money $${w.player.money} · ${w.stats.faresDone} fares done · ${w.stats.carsStolen} cars stolen · ${packagesFound(w)}/${PICKUPS.packages} packages`,
    ];
    const prompt = w.saveExists ? 'Enter: continue   N: new game' : 'Press Enter or click to start';
    drawPanel(context, text, 300, 130, 680, 460, 'SOLMAR', lines, prompt);
    text('An open-world crime story', VIEW.width / 2, 130 + 104, 22, PALETTE.hudGold, 'center');
    return;
  }
  if (kind === 'paused') {
    drawPanel(context, text, 340, 150, 600, 420, 'PAUSED', [
      'The city waits for you.',
      '',
      jobsLine(w),
      '',
      `Money $${w.player.money} · Earned $${w.stats.earned} · ${w.stats.faresDone} fares · ${packagesFound(w)}/${PICKUPS.packages} packages`,
      '',
      'P / Esc: resume     S: save game',
      'R: restart mission     Q: quit to title',
    ], 'Press P to resume');
    return;
  }
  if (kind === 'busted') {
    drawPanel(context, text, 340, 200, 600, 320, 'BUSTED', [
      'The Solmar PD caught up with you.',
      `You lost $${w.penalty ?? 0} and the mission restarts.`,
      '',
      'The garage still has work for you.',
    ], 'Press Enter to continue');
    return;
  }
  if (kind === 'wasted') {
    drawPanel(context, text, 340, 200, 600, 320, 'WASTED', [
      'You woke up at Solmar General.',
      `You lost $${w.penalty ?? 0} and the mission restarts.`,
      '',
      'Patch up and get back out there.',
    ], 'Press Enter to continue');
    return;
  }
  if (kind === 'complete') {
    drawPanel(context, text, 300, 130, 680, 460, 'KING OF SOLMAR', [
      'Vince Kroll is finished. Mara pays in full.',
      'You run this city now.',
      '',
      `Earned $${w.stats.earned} · ${w.stats.faresDone} fares · ${w.stats.carsStolen} cars stolen · ${packagesFound(w)}/${PICKUPS.packages} packages`,
      `Final cash: $${w.player.money}`,
      '',
      'Free roam continues — the streets are still yours.',
    ], 'Press Enter to keep playing');
    return;
  }
}
