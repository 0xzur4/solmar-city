// render.js: Drawing only: the city, the cars, the people, the effects.
import { CITY, FONT, PALETTE, VIEW, WORLD } from './config.js';
import { drawHud, drawScreenPanel } from './hud.js';
import { lightingState } from './lighting.js';
import { COP_LOOK, drawCharacter, facingFromAngle, pedLook } from './sprites.js';
import { HEROES } from './heroes.js';
import { WEAPONS } from './weapons.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';
export const SCREEN_COMPLETE = 'complete';
export const SCREEN_SELECT = 'select';

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };

  function resize() {
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / VIEW.width, height / VIEW.height);
    view.x = (width - VIEW.width * view.scale) / 2;
    view.y = (height - VIEW.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align, baseline = 'alphabetic') {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = baseline;
    context.fillText(value, x, y);
  }

  function circle(x, y, radius, color) {
    context.fillStyle = color;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }

  function glowSprite(color) {
    const sprite = document.createElement('canvas');
    sprite.width = 128;
    sprite.height = 128;
    const glow = sprite.getContext('2d');
    const gradient = glow.createRadialGradient(64, 64, 4, 64, 64, 64);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    glow.fillStyle = gradient;
    glow.fillRect(0, 0, 128, 128);
    return sprite;
  }
  const warmGlow = glowSprite('rgba(255, 210, 122, 0.85)');
  const redGlow = glowSprite('rgba(255, 59, 48, 0.8)');
  const blueGlow = glowSprite('rgba(47, 123, 255, 0.8)');
  const whiteGlow = glowSprite('rgba(255, 255, 255, 0.7)');

  function drawGlow(sprite, x, y, radius, alpha) {
    context.globalAlpha = alpha;
    context.drawImage(sprite, x - radius, y - radius, radius * 2, radius * 2);
    context.globalAlpha = 1;
  }

  function onScreen(x, y, left, top, right, bottom, pad = 0) {
    return x > left - pad && x < right + pad && y > top - pad && y < bottom + pad;
  }

  function drawGround(w, left, top, right, bottom) {
    context.fillStyle = PALETTE.grass;
    context.fillRect(left, top, right - left, bottom - top);
    for (const block of w.city.blockGround) {
      if (block.x > right || block.x + block.w < left || block.y > bottom || block.y + block.h < top) continue;
      context.fillStyle = block.color;
      context.fillRect(block.x, block.y, block.w, block.h);
    }
    const sandTop = Math.max(top, CITY.beachY);
    const sandBottom = Math.min(bottom, CITY.waterY);
    if (sandBottom > sandTop) {
      context.fillStyle = PALETTE.sand;
      context.fillRect(Math.max(left, 0), sandTop, Math.min(right, WORLD.width) - Math.max(left, 0), sandBottom - sandTop);
    }
    const waterTop = Math.max(top, CITY.waterY);
    if (bottom > waterTop) {
      context.fillStyle = PALETTE.water;
      context.fillRect(Math.max(left, 0), waterTop, Math.min(right, WORLD.width) - Math.max(left, 0), Math.min(bottom, WORLD.height) - waterTop);
    }
  }

  function drawRoads(left, top, right, bottom) {
    for (const avenue of CITY.avenues) {
      if (avenue + CITY.roadWidth / 2 + CITY.sidewalk < left || avenue - CITY.roadWidth / 2 - CITY.sidewalk > right) continue;
      context.fillStyle = PALETTE.sidewalk;
      context.fillRect(avenue - CITY.roadWidth / 2 - CITY.sidewalk, Math.max(top, 0), CITY.roadWidth + 2 * CITY.sidewalk, Math.min(bottom, CITY.beachY) - Math.max(top, 0));
      context.fillStyle = PALETTE.road;
      context.fillRect(avenue - CITY.roadWidth / 2, Math.max(top, 0), CITY.roadWidth, Math.min(bottom, CITY.beachY) - Math.max(top, 0));
    }
    for (const street of CITY.streets) {
      if (street + CITY.roadWidth / 2 + CITY.sidewalk < top || street - CITY.roadWidth / 2 - CITY.sidewalk > bottom) continue;
      context.fillStyle = PALETTE.sidewalk;
      context.fillRect(Math.max(left, 0), street - CITY.roadWidth / 2 - CITY.sidewalk, Math.min(right, WORLD.width) - Math.max(left, 0), CITY.roadWidth + 2 * CITY.sidewalk);
      context.fillStyle = PALETTE.road;
      context.fillRect(Math.max(left, 0), street - CITY.roadWidth / 2, Math.min(right, WORLD.width) - Math.max(left, 0), CITY.roadWidth);
    }
    context.fillStyle = PALETTE.laneDash;
    for (const avenue of CITY.avenues) {
      if (avenue < left || avenue > right) continue;
      for (let y = Math.floor(top / 44) * 44; y < Math.min(bottom, CITY.beachY); y += 44) {
        context.fillRect(avenue - 2, y, 4, 22);
      }
    }
    for (const street of CITY.streets) {
      if (street < top || street > bottom) continue;
      for (let x = Math.floor(left / 44) * 44; x < Math.min(right, WORLD.width); x += 44) {
        context.fillRect(x, street - 2, 22, 4);
      }
    }
    context.fillStyle = PALETTE.crosswalk;
    for (const avenue of CITY.avenues) {
      for (const street of CITY.streets) {
        if (avenue < left - 60 || avenue > right + 60 || street < top - 60 || street > bottom + 60) continue;
        for (let i = -3; i <= 3; i += 1) {
          context.fillRect(avenue - CITY.roadWidth / 2 + 6, street + i * 12 - 4, 14, 7);
          context.fillRect(avenue + CITY.roadWidth / 2 - 20, street + i * 12 - 4, 14, 7);
          context.fillRect(avenue + i * 12 - 4, street - CITY.roadWidth / 2 + 6, 7, 14);
          context.fillRect(avenue + i * 12 - 4, street + CITY.roadWidth / 2 - 20, 7, 14);
        }
      }
    }
  }

  function drawBuildings(w, left, top, right, bottom) {
    const night = lightingState(w.lighting).lamps;
    for (const building of w.city.buildings) {
      if (building.x > right || building.x + building.w < left || building.y > bottom || building.y + building.h < top) continue;
      const shadowX = 6 + building.height * 3;
      const shadowY = 8 + building.height * 4;
      context.fillStyle = `rgba(0, 0, 0, ${0.15 + building.height * 0.03})`;
      context.fillRect(building.x + shadowX, building.y + shadowY, building.w, building.h);
      context.fillStyle = building.color;
      context.fillRect(building.x, building.y, building.w, building.h);
      context.strokeStyle = PALETTE.buildingEdge;
      context.lineWidth = 2;
      context.strokeRect(building.x + 1, building.y + 1, building.w - 2, building.h - 2);
      context.fillStyle = 'rgba(0, 0, 0, 0.25)';
      context.fillRect(building.x, building.y, building.w, 5);
      const cols = Math.max(1, Math.floor(building.w / 34));
      const rows = Math.max(1, Math.floor(building.h / 34));
      for (let c = 0; c < cols; c += 1) {
        for (let r = 0; r < rows; r += 1) {
          const lit = night > 0.4 && ((building.x + c * 34 + r * 17) % 3 === 0);
          context.fillStyle = lit ? PALETTE.windowLit : 'rgba(255, 255, 255, 0.35)';
          context.fillRect(building.x + 10 + c * 34, building.y + 10 + r * 34, 14, 12);
        }
      }
    }
    for (const awning of w.city.awnings) {
      if (awning.x > right || awning.x + awning.w < left || awning.y < top || awning.y > bottom) continue;
      context.fillStyle = awning.color;
      context.fillRect(awning.x, awning.y, awning.w, 10);
      context.fillStyle = 'rgba(255, 255, 255, 0.5)';
      for (let x = awning.x + 6; x < awning.x + awning.w - 4; x += 14) context.fillRect(x, awning.y, 5, 10);
    }
    const park = w.city.park;
    if (park.x < right && park.x + park.w > left && park.y < bottom && park.y + park.h > top) {
      context.fillStyle = PALETTE.grassDark;
      context.fillRect(park.x, park.y, park.w, park.h);
      context.fillStyle = PALETTE.sandDark;
      context.fillRect(park.x + park.w / 2 - 8, park.y, 16, park.h);
      context.fillRect(park.x, park.y + park.h / 2 - 8, park.w, 16);
      context.fillStyle = PALETTE.fountain;
      context.beginPath();
      context.arc(park.x + park.w * 0.72, park.y + park.h * 0.28, 22, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      context.lineWidth = 2;
      context.stroke();
    }
    const plaza = w.city.plaza;
    if (plaza.x < right && plaza.x + plaza.w > left && plaza.y < bottom && plaza.y + plaza.h > top) {
      context.fillStyle = PALETTE.plaza;
      context.fillRect(plaza.x, plaza.y, plaza.w, plaza.h);
      context.strokeStyle = PALETTE.plazaEdge;
      context.lineWidth = 3;
      context.strokeRect(plaza.x + 2, plaza.y + 2, plaza.w - 4, plaza.h - 4);
      context.fillStyle = PALETTE.fountain;
      context.beginPath();
      context.arc(plaza.x + plaza.w / 2, plaza.y + plaza.h / 2, 26, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = '#f2f0e6';
      context.lineWidth = 3;
      context.stroke();
    }
    for (const tree of w.city.trees) {
      if (!onScreen(tree.x, tree.y, left, top, right, bottom)) continue;
      context.fillStyle = 'rgba(0, 0, 0, 0.18)';
      context.beginPath();
      context.ellipse(tree.x + 5, tree.y + 6, tree.r, tree.r * 0.7, 0, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.treeTrunk;
      context.fillRect(tree.x - 2, tree.y - 2, 4, 6);
      circle(tree.x, tree.y - 4, tree.r, PALETTE.tree);
      circle(tree.x - tree.r * 0.4, tree.y - tree.r * 0.5, tree.r * 0.6, '#5d9153');
    }
  }

  function drawCarShape(w, car) {
    const spec = car.spec;
    context.save();
    context.translate(car.x, car.y);
    context.rotate(car.angle);
    context.fillStyle = 'rgba(0, 0, 0, 0.25)';
    context.fillRect(-spec.length / 2 + 4, -spec.width / 2 + 5, spec.length, spec.width);
    context.fillStyle = '#14161c';
    for (const wx of [-spec.length * 0.32, spec.length * 0.32]) {
      context.fillRect(wx - 5, -spec.width / 2 - 2, 10, 5);
      context.fillRect(wx - 5, spec.width / 2 - 3, 10, 5);
    }
    context.fillStyle = car.wrecked ? '#3a3a3a' : car.color;
    context.beginPath();
    context.roundRect(-spec.length / 2, -spec.width / 2, spec.length, spec.width, 8);
    context.fill();
    context.fillStyle = 'rgba(20, 30, 40, 0.85)';
    context.fillRect(spec.length * 0.12, -spec.width / 2 + 4, spec.length * 0.2, spec.width - 8);
    context.fillStyle = 'rgba(255, 255, 255, 0.18)';
    context.fillRect(-spec.length * 0.28, -spec.width / 2 + 4, spec.length * 0.3, spec.width - 8);
    context.fillStyle = '#ffe9a8';
    context.fillRect(spec.length / 2 - 3, -spec.width / 2 + 3, 3, 6);
    context.fillRect(spec.length / 2 - 3, spec.width / 2 - 9, 3, 6);
    context.fillStyle = car.brakeLight ? '#ff3b30' : '#a02020';
    context.fillRect(-spec.length / 2, -spec.width / 2 + 3, 3, 6);
    context.fillRect(-spec.length / 2, spec.width / 2 - 9, 3, 6);
    if (car.police) {
      context.fillStyle = '#f2f0e6';
      context.fillRect(-spec.length * 0.1, -spec.width / 2 + 2, spec.length * 0.28, spec.width - 4);
      context.fillStyle = '#20242e';
      text('PD', 0, 4, 11, '#20242e', 'center');
      const flash = Math.floor(w.time * 4) % 2 === 0;
      context.fillStyle = flash ? PALETTE.policeLightRed : PALETTE.policeLightBlue;
      context.fillRect(-6, -spec.width / 2 - 2, 12, 5);
    }
    if (car.model === 'taxi') {
      context.fillStyle = '#20242e';
      text('TAXI', 0, 4, 10, '#20242e', 'center');
    }
    context.restore();
    if (car.wrecked) {
      context.fillStyle = 'rgba(0, 0, 0, 0.35)';
      context.beginPath();
      context.arc(car.x, car.y, 6, 0, Math.PI * 2);
      context.fill();
    }
  }


  function drawDriver(w, car) {
    const hero = HEROES[w.player.hero] ?? HEROES.dario;
    const look = hero.look;
    context.save();
    context.translate(car.x, car.y);
    context.rotate(car.angle);
    context.translate(-1, -car.spec.width * 0.19);
    context.fillStyle = look.skin;
    context.strokeStyle = '#141824';
    context.lineWidth = 1.6;
    context.beginPath();
    context.arc(0, 0, 6.4, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.fillStyle = look.hair;
    context.beginPath();
    context.arc(0, 0, 6.4, Math.PI * 0.5, Math.PI * 1.5);
    context.closePath();
    context.fill();
    context.stroke();
    if (look.accessory === 'shades') {
      context.fillStyle = '#0e1118';
      context.fillRect(3.2, -4.2, 2.6, 8.4);
    }
    context.restore();
  }

  function drawCrosshair(w) {
    const p = w.player;
    if (p.aimX === undefined) return;
    const weapon = WEAPONS[p.weapons.current];
    const ox = p.car !== null ? p.car.x : p.x;
    const oy = p.car !== null ? p.car.y : p.y;
    const dist = Math.hypot(p.aimX - ox, p.aimY - oy);
    const reach = Math.min(dist, weapon.range);
    const ax = Math.cos(p.aimAngle);
    const ay = Math.sin(p.aimAngle);
    context.save();
    context.strokeStyle = weapon.color;
    context.globalAlpha = 0.28;
    context.lineWidth = 1.5;
    context.setLineDash([4, 7]);
    context.beginPath();
    context.moveTo(ox + ax * 40, oy + ay * 40);
    context.lineTo(ox + ax * reach, oy + ay * reach);
    context.stroke();
    context.setLineDash([]);
    context.globalAlpha = 0.9;
    context.lineWidth = 2;
    const spread = 7 + weapon.spread * 60 + p.recoil * 5;
    context.beginPath();
    context.arc(p.aimX, p.aimY, spread, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = weapon.color;
    context.beginPath();
    context.arc(p.aimX, p.aimY, 1.8, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function drawWorld(w) {
    const camera = w.camera;
    const zoom = camera.zoom;
    const shakeX = (Math.random() - 0.5) * w.effects.shake;
    const shakeY = (Math.random() - 0.5) * w.effects.shake;
    const halfW = VIEW.width / (2 * zoom);
    const halfH = VIEW.height / (2 * zoom);
    const left = camera.x - halfW + shakeX;
    const top = camera.y - halfH + shakeY;
    const right = left + VIEW.width / zoom;
    const bottom = top + VIEW.height / zoom;
    drawGround(w, left, top, right, bottom);
    drawRoads(left, top, right, bottom);
    drawBuildings(w, left, top, right, bottom);
    context.strokeStyle = 'rgba(20, 20, 20, 0.5)';
    context.lineWidth = 4;
    w.effects.forEachSkid((skid) => {
      context.globalAlpha = Math.min(1, skid.life / 3);
      context.beginPath();
      context.moveTo(skid.x1, skid.y1);
      context.lineTo(skid.x2, skid.y2);
      context.stroke();
    });
    context.globalAlpha = 1;
    for (const pickup of w.pickups) {
      if (!onScreen(pickup.x, pickup.y, left, top, right, bottom)) continue;
      const bobY = Math.sin(w.time * 3 + pickup.x) * 3;
      if (pickup.kind === 'cash') {
        context.fillStyle = '#2f9e44';
        context.fillRect(pickup.x - 10, pickup.y - 7 + bobY, 20, 14);
        text('$', pickup.x, pickup.y + 4 + bobY, 13, '#ffffff', 'center');
      } else if (pickup.kind === 'health') {
        context.fillStyle = '#f2f0e6';
        context.fillRect(pickup.x - 9, pickup.y - 9 + bobY, 18, 18);
        context.fillStyle = '#d64545';
        context.fillRect(pickup.x - 2, pickup.y - 6 + bobY, 4, 12);
        context.fillRect(pickup.x - 6, pickup.y - 2 + bobY, 12, 4);
      } else if (pickup.kind === 'weapon') {
        const weapon = WEAPONS[pickup.weapon];
        context.globalAlpha = 0.3 + Math.sin(w.time * 4 + pickup.x) * 0.12;
        circle(pickup.x, pickup.y + bobY, 24, weapon.color);
        context.globalAlpha = 1;
        context.fillStyle = '#2a3140';
        context.beginPath();
        context.roundRect(pickup.x - 13, pickup.y - 10 + bobY, 26, 20, 4);
        context.fill();
        context.strokeStyle = weapon.color;
        context.lineWidth = 2.4;
        context.stroke();
        context.fillStyle = weapon.color;
        context.fillRect(pickup.x - 13, pickup.y - 2 + bobY, 26, 3.5);
        text(String(weapon.slot), pickup.x, pickup.y - 3 + bobY, 13, '#ffffff', 'center');
      } else {
        context.fillStyle = '#8fb8d8';
        context.fillRect(pickup.x - 8, pickup.y - 8 + bobY, 16, 16);
        text('A', pickup.x, pickup.y + 5 + bobY, 12, '#20242e', 'center');
      }
    }
    const marker = w.marker;
    if (marker) {
      const pulse = 1 + Math.sin(w.time * 4) * 0.15;
      context.fillStyle = 'rgba(255, 210, 63, 0.12)';
      context.fillRect(marker.x - 26, top, 52, bottom - top);
      context.strokeStyle = PALETTE.marker;
      context.lineWidth = 3;
      context.beginPath();
      context.arc(marker.x, marker.y, 34 * pulse, 0, Math.PI * 2);
      context.stroke();
      context.fillStyle = PALETTE.marker;
      context.beginPath();
      context.moveTo(marker.x, marker.y - 44);
      context.lineTo(marker.x + 12, marker.y - 22);
      context.lineTo(marker.x - 12, marker.y - 22);
      context.closePath();
      context.fill();
      circle(marker.x, marker.y, 6, PALETTE.markerRing);
    }
    const drawables = [];
    for (const ped of w.peds) drawables.push({ y: ped.y, kind: 'ped', ref: ped });
    for (const cop of w.footPolice) drawables.push({ y: cop.y, kind: 'cop', ref: cop });
    for (const car of w.cars) drawables.push({ y: car.y, kind: 'car', ref: car });
    if (w.player.onFoot) drawables.push({ y: w.player.y, kind: 'player', ref: w.player });
    drawables.sort((a, b) => (a.kind === 'car' ? a.y : a.y + 15) - (b.kind === 'car' ? b.y : b.y + 15));
    const ghostHero = HEROES[w.player.hero] ?? HEROES.dario;
    for (const ghost of w.player.trail) {
      drawCharacter(context, {
        look: ghostHero.look, x: ghost.x, y: ghost.y, facing: ghost.facing, aim: ghost.facing > 0 ? 0 : Math.PI,
        moving: 1, walk: w.time * 12, time: w.time, scale: 1, weapon: null,
        alpha: Math.max(0, ghost.life / 0.32) * 0.5, flash: 0.85, tint: ghostHero.skill.color,
      });
    }
    for (const item of drawables) {
      if (item.y < top - 60 || item.y > bottom + 60) continue;
      if (item.kind === 'ped') {
        const ped = item.ref;
        drawCharacter(context, {
          look: pedLook(ped.id, ped.color), x: ped.x, y: ped.y, facing: facingFromAngle(ped.angle), aim: ped.angle,
          walk: ped.walkPhase, moving: ped.speed > 1 ? 1 : 0, time: w.time, seed: ped.id, weapon: null,
          flash: ped.flash > 0 ? Math.min(1, ped.flash / 0.12) : 0,
        });
      } else if (item.kind === 'cop') {
        const cop = item.ref;
        const idle = cop.post && Math.hypot(w.player.x - cop.x, w.player.y - cop.y) > 260;
        drawCharacter(context, {
          look: COP_LOOK, x: cop.x, y: cop.y, facing: facingFromAngle(cop.angle), aim: cop.angle, walk: cop.walkPhase,
          moving: idle ? 0 : 1, time: w.time, seed: cop.walkPhase > 0 ? 3 : 1, weapon: 'pistol',
          flash: cop.flash > 0 ? Math.min(1, cop.flash / 0.12) : 0,
        });
      } else if (item.kind === 'car') {
        drawCarShape(w, item.ref);
        if (item.ref === w.player.car) drawDriver(w, item.ref);
      } else {
        const player = item.ref;
        const blink = player.invuln > 0 && Math.floor(player.invuln * 10) % 2 === 0;
        if (!blink) {
          const hero = HEROES[player.hero] ?? HEROES.dario;
          const weaponId = player.weapons.current;
          drawCharacter(context, {
            look: hero.look, x: player.x, y: player.y, facing: facingFromAngle(player.aimAngle), aim: player.aimAngle,
            walk: player.walkPhase, moving: Math.min(1, Math.hypot(player.vx, player.vy) / 230), time: w.time, seed: 0,
            weapon: weaponId, twoHanded: WEAPONS[weaponId].twoHanded, recoil: player.recoil, muzzle: player.muzzleT,
            firing: player.muzzleT > 0, flash: player.flash > 0 ? Math.min(1, player.flash / 0.12) : 0,
            tint: player.flash > 0 && player.hp < player.maxHp && w.time - player.lastDamage < 0.3 ? '#ff5a4a' : '#ffffff',
            shield: player.hero === 'luna' && player.guard > 0.25 ? Math.min(1, player.guard) : 0,
            aura: player.skillT > 0 ? hero.skill.color : null, stretch: player.dashT > 0 ? 0.1 : 0,
          });
        }
      }
    }
    context.lineCap = 'round';
    for (const bullet of w.bullets) {
      if (!bullet.active) continue;
      const angle = Math.atan2(bullet.vy, bullet.vx);
      if (bullet.kind === 'plasma') {
        context.globalAlpha = 0.35;
        circle(bullet.x, bullet.y, bullet.size * 1.9, bullet.color);
        context.globalAlpha = 0.6;
        context.strokeStyle = bullet.color;
        context.lineWidth = bullet.size * 0.9;
        context.beginPath();
        context.moveTo(bullet.x - Math.cos(angle) * 20, bullet.y - Math.sin(angle) * 20);
        context.lineTo(bullet.x, bullet.y);
        context.stroke();
        context.globalAlpha = 1;
        circle(bullet.x, bullet.y, bullet.size * 0.7, '#e8fffb');
      } else {
        const length = bullet.size * 2.6;
        context.strokeStyle = bullet.color;
        context.lineWidth = 2.6;
        context.beginPath();
        context.moveTo(bullet.x - Math.cos(angle) * length, bullet.y - Math.sin(angle) * length);
        context.lineTo(bullet.x, bullet.y);
        context.stroke();
        context.strokeStyle = '#ffffff';
        context.lineWidth = 1.2;
        context.beginPath();
        context.moveTo(bullet.x - Math.cos(angle) * length * 0.4, bullet.y - Math.sin(angle) * length * 0.4);
        context.lineTo(bullet.x, bullet.y);
        context.stroke();
      }
    }
    context.lineCap = 'butt';
    w.effects.forEachParticle((particle) => {
      context.globalAlpha = Math.max(0, particle.life / particle.maxLife);
      circle(particle.x, particle.y, particle.size, particle.color);
    });
    context.globalAlpha = 1;
    w.effects.forEachRing((ring) => {
      const t = 1 - ring.life / ring.maxLife;
      const radius = ring.radius * (0.2 + 0.8 * t);
      context.globalAlpha = Math.max(0, (1 - t) * 0.85);
      context.strokeStyle = ring.color;
      context.lineWidth = 1.5 + 6 * (1 - t);
      context.beginPath();
      context.ellipse(ring.x, ring.y + 14, radius, radius * 0.62, 0, 0, Math.PI * 2);
      context.stroke();
    });
    context.globalAlpha = 1;
    w.effects.forEachFloater((floater) => {
      context.globalAlpha = Math.min(1, floater.life);
      text(floater.text, floater.x, floater.y, 18, floater.color, 'center');
    });
    context.globalAlpha = 1;
    const light = lightingState(w.lighting);
    if (light.darkness > 0 || light.warmth > 0) {
      if (light.warmth > 0) {
        context.fillStyle = `rgba(255, 130, 50, ${light.warmth})`;
        context.fillRect(left, top, right - left, bottom - top);
      }
      if (light.darkness > 0) {
        context.fillStyle = `rgba(8, 12, 40, ${light.darkness})`;
        context.fillRect(left, top, right - left, bottom - top);
      }
      context.globalCompositeOperation = 'lighter';
      for (const lamp of w.city.lamps) {
        if (!onScreen(lamp.x, lamp.y, left, top, right, bottom)) continue;
        drawGlow(warmGlow, lamp.x, lamp.y - 9, 85, light.lamps * 0.5);
      }
      for (const car of w.cars) {
        if (car.wrecked || car.x < left - 200 || car.x > right + 200 || car.y < top - 200 || car.y > bottom + 200) continue;
        const frontX = car.x + Math.cos(car.angle) * car.spec.length * 0.5;
        const frontY = car.y + Math.sin(car.angle) * car.spec.length * 0.5;
        const tipX = frontX + Math.cos(car.angle) * 170;
        const tipY = frontY + Math.sin(car.angle) * 170;
        const sideX = Math.sin(car.angle) * 42;
        const sideY = -Math.cos(car.angle) * 42;
        context.fillStyle = `rgba(255, 242, 192, ${0.1 * light.lamps})`;
        context.beginPath();
        context.moveTo(frontX, frontY);
        context.lineTo(tipX + sideX, tipY + sideY);
        context.lineTo(tipX - sideX, tipY - sideY);
        context.closePath();
        context.fill();
        drawGlow(warmGlow, tipX, tipY, 46, light.lamps * 0.35);
      }
      const flash = Math.floor(w.time * 4) % 2 === 0;
      for (const car of w.policeCars) {
        if (!onScreen(car.x, car.y, left, top, right, bottom)) continue;
        drawGlow(flash ? redGlow : blueGlow, car.x, car.y, 80, 0.55);
        drawGlow(flash ? blueGlow : redGlow, car.x, car.y, 50, 0.3);
      }
      context.globalCompositeOperation = 'source-over';
    }
  }

  function draw(w, screen) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const zoom = w.camera.zoom;
    const shakeX = (Math.random() - 0.5) * w.effects.shake;
    const shakeY = (Math.random() - 0.5) * w.effects.shake;
    context.setTransform(
      view.scale * zoom, 0, 0, view.scale * zoom,
      view.x + (VIEW.width / 2 - w.camera.x * zoom + shakeX * zoom) * view.scale,
      view.y + (VIEW.height / 2 - w.camera.y * zoom + shakeY * zoom) * view.scale,
    );
    drawWorld(w);
    if (screen === SCREEN_PLAY) drawCrosshair(w);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    if (w.player.hp > 0 && w.player.hp < 35) {
      const pulse = 0.35 + Math.sin(w.time * 6) * 0.15;
      const gradient = context.createRadialGradient(
        VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.32,
        VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.75,
      );
      gradient.addColorStop(0, 'rgba(200, 20, 20, 0)');
      gradient.addColorStop(1, `rgba(200, 20, 20, ${pulse})`);
      context.fillStyle = gradient;
      context.fillRect(0, 0, VIEW.width, VIEW.height);
    }
    if (screen === SCREEN_TITLE) {
      drawScreenPanel(context, text, 'title', w);
      return;
    }
    if (screen === SCREEN_SELECT) {
      drawScreenPanel(context, text, 'select', w);
      return;
    }
    drawHud(context, text, w);
    if (screen === SCREEN_PAUSED) drawScreenPanel(context, text, 'paused', w);
    else if (screen === SCREEN_BUSTED) drawScreenPanel(context, text, 'busted', w);
    else if (screen === SCREEN_WASTED) drawScreenPanel(context, text, 'wasted', w);
    else if (screen === SCREEN_COMPLETE) drawScreenPanel(context, text, 'complete', w);
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
