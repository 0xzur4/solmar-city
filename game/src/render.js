// render.js: Drawing only: the city, the cars, the people, the effects — and nothin
import { CITY, FONT, PALETTE, VIEW, WORLD } from './config.js';
import { drawHud, drawScreenPanel } from './hud.js';
import { lightingState } from './lighting.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';
export const SCREEN_COMPLETE = 'complete';

export function createRenderer(canvas) {
  const TAU = Math.PI * 2;
  const main = canvas.getContext('2d');
  let context = main;
  // Pixel look: the world renders into a 640x360 buffer, upscaled with smoothing off.
  const buf = document.createElement('canvas');
  buf.width = 640;
  buf.height = 360;
  const bctx = buf.getContext('2d');
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
    main.imageSmoothingEnabled = false;
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
    context.arc(x, y, radius, 0, TAU);
    context.fill();
  }

  /** A soft radial glow, drawn with 'lighter' wherever light pools at night. */
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
      context.fillStyle = PALETTE.sandDark;
      for (let i = 0; i < 8; i += 1) {
        const patchX = ((i * 613) % 3400) + 100;
        if (patchX < left || patchX > right) continue;
        context.fillRect(patchX, sandTop + 40 + (i % 3) * 50, 90, 22);
      }
    }
    const waterTop = Math.max(top, CITY.waterY);
    if (bottom > waterTop) {
      context.fillStyle = PALETTE.water;
      context.fillRect(Math.max(left, 0), waterTop, Math.min(right, WORLD.width) - Math.max(left, 0), Math.min(bottom, WORLD.height) - waterTop);
      context.fillStyle = 'rgba(255, 255, 255, 0.55)';
      for (let i = 0; i < 12; i += 1) {
        const foamX = ((w.time * 30 + i * 271) % 3600);
        if (foamX < left || foamX > right) continue;
        context.fillRect(foamX, waterTop + Math.sin(w.time * 1.5 + i) * 4, 46, 3);
      }
      context.fillStyle = PALETTE.waterDeep;
      for (let i = 0; i < 10; i += 1) {
        const waveY = CITY.waterY + 30 + i * 14;
        if (waveY < top || waveY > bottom) continue;
        const offset = ((w.time * 20 + i * 137) % 300) - 150;
        context.fillRect(Math.max(left, 0) + offset, waveY, 60, 3);
      }
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
    // Lane dashes.
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
    // Crosswalks at every intersection.
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
      if (building.height >= 3) {
        context.fillStyle = 'rgba(0, 0, 0, 0.3)';
        context.fillRect(building.x + 12, building.y + 12, 18, 12);
        context.fillRect(building.x + building.w - 34, building.y + building.h - 26, 22, 14);
      }
      if (building.neon) {
        const signW = Math.min(building.w - 12, building.neon.text.length * 9 + 10);
        const signX = building.x + (building.w - signW) / 2;
        const signY = building.y + building.h - 18;
        if (night > 0.3) {
          context.globalCompositeOperation = 'lighter';
          drawGlow(warmGlow, signX + signW / 2, signY + 6, 40, night * 0.5);
          context.globalCompositeOperation = 'source-over';
        }
        context.fillStyle = building.neon.color;
        context.fillRect(signX, signY, signW, 12);
        text(building.neon.text, signX + signW / 2, signY + 9, 12, '#10141c', 'center');
      }
    }
    // Shop awnings on commercial buildings.
    for (const awning of w.city.awnings) {
      if (awning.x > right || awning.x + awning.w < left || awning.y < top || awning.y > bottom) continue;
      context.fillStyle = awning.color;
      context.fillRect(awning.x, awning.y, awning.w, 10);
      context.fillStyle = 'rgba(255, 255, 255, 0.5)';
      for (let x = awning.x + 6; x < awning.x + awning.w - 4; x += 14) context.fillRect(x, awning.y, 5, 10);
    }
    // The park: a green block with paths, a pond and benches.
    const park = w.city.park;
    if (park.x < right && park.x + park.w > left && park.y < bottom && park.y + park.h > top) {
      context.fillStyle = PALETTE.grassDark;
      context.fillRect(park.x, park.y, park.w, park.h);
      context.fillStyle = PALETTE.sandDark;
      context.fillRect(park.x + park.w / 2 - 8, park.y, 16, park.h);
      context.fillRect(park.x, park.y + park.h / 2 - 8, park.w, 16);
      context.fillStyle = PALETTE.fountain;
      context.beginPath();
      context.arc(park.x + park.w * 0.72, park.y + park.h * 0.28, 22, 0, TAU);
      context.fill();
      context.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      context.lineWidth = 2;
      context.stroke();
    }
    // The plaza: paving, a fountain and benches.
    const plaza = w.city.plaza;
    if (plaza.x < right && plaza.x + plaza.w > left && plaza.y < bottom && plaza.y + plaza.h > top) {
      context.fillStyle = PALETTE.plaza;
      context.fillRect(plaza.x, plaza.y, plaza.w, plaza.h);
      context.strokeStyle = PALETTE.plazaEdge;
      context.lineWidth = 3;
      context.strokeRect(plaza.x + 2, plaza.y + 2, plaza.w - 4, plaza.h - 4);
      context.fillStyle = PALETTE.fountain;
      context.beginPath();
      context.arc(plaza.x + plaza.w / 2, plaza.y + plaza.h / 2, 26, 0, TAU);
      context.fill();
      context.strokeStyle = '#f2f0e6';
      context.lineWidth = 3;
      context.stroke();
    }
    for (const tree of w.city.trees) {
      if (tree.x < left || tree.x > right || tree.y < top || tree.y > bottom) continue;
      context.fillStyle = 'rgba(0, 0, 0, 0.18)';
      context.beginPath();
      context.ellipse(tree.x + 5, tree.y + 6, tree.r, tree.r * 0.7, 0, 0, TAU);
      context.fill();
      context.fillStyle = PALETTE.treeTrunk;
      context.fillRect(tree.x - 2, tree.y - 2, 4, 6);
      circle(tree.x, tree.y - 4, tree.r, PALETTE.tree);
      circle(tree.x - tree.r * 0.4, tree.y - tree.r * 0.5, tree.r * 0.6, '#5d9153');
    }
    for (const bench of w.city.benches) {
      if (bench.x < left || bench.x > right || bench.y < top || bench.y > bottom) continue;
      context.save();
      context.translate(bench.x, bench.y);
      context.rotate(bench.angle);
      context.fillStyle = PALETTE.bench;
      context.fillRect(-14, -4, 28, 8);
      context.fillStyle = 'rgba(0, 0, 0, 0.3)';
      context.fillRect(-14, 4, 28, 3);
      context.restore();
    }
    for (const hydrant of w.city.hydrants) {
      if (hydrant.x < left || hydrant.x > right || hydrant.y < top || hydrant.y > bottom) continue;
      context.fillStyle = PALETTE.hydrant;
      context.fillRect(hydrant.x - 3, hydrant.y - 5, 6, 10);
      circle(hydrant.x, hydrant.y - 6, 3, PALETTE.hydrant);
    }
    for (const stop of w.city.busStops) {
      if (stop.x < left || stop.x > right || stop.y < top || stop.y > bottom) continue;
      context.fillStyle = '#3a3f4a';
      context.fillRect(stop.x - 8, stop.y - 12, 16, 24);
      context.fillStyle = '#f2c230';
      context.fillRect(stop.x - 8, stop.y - 12, 16, 5);
    }
    for (const lamp of w.city.lamps) {
      if (lamp.x < left || lamp.x > right || lamp.y < top || lamp.y > bottom) continue;
      context.fillStyle = PALETTE.lamp;
      context.fillRect(lamp.x - 2, lamp.y - 8, 4, 16);
      circle(lamp.x, lamp.y - 9, 4, '#ffe9a8');
    }
    // Beach umbrellas and towels on the sand.
    for (const umbrella of w.city.umbrellas) {
      if (umbrella.x < left || umbrella.x > right || umbrella.y < top || umbrella.y > bottom) continue;
      context.fillStyle = 'rgba(0, 0, 0, 0.15)';
      context.beginPath();
      context.ellipse(umbrella.x + 4, umbrella.y + 5, 12, 6, 0, 0, TAU);
      context.fill();
      context.fillStyle = umbrella.color;
      context.beginPath();
      context.arc(umbrella.x, umbrella.y, 11, Math.PI, 0);
      context.fill();
      context.fillStyle = '#f2f0e6';
      context.fillRect(umbrella.x + 8, umbrella.y + 2, 14, 6);
    }
    for (const pier of w.city.piers) {
      if (pier.x > right || pier.x + pier.w < left || pier.y > bottom || pier.y + pier.h < top) continue;
      context.fillStyle = PALETTE.pierWood;
      context.fillRect(pier.x, pier.y, pier.w, pier.h);
      context.fillStyle = 'rgba(0, 0, 0, 0.25)';
      for (let y = pier.y + 12; y < pier.y + pier.h; y += 18) context.fillRect(pier.x, y, pier.w, 2);
    }
    for (const boat of w.city.boats) {
      if (boat.x < left || boat.x > right || boat.y < top || boat.y > bottom) continue;
      const bobY = Math.sin(w.time * 0.9 + boat.bob) * 3;
      context.save();
      context.translate(boat.x, boat.y + bobY);
      context.rotate(boat.angle);
      context.fillStyle = boat.color;
      context.beginPath();
      context.moveTo(-20, 0);
      context.lineTo(20, 0);
      context.lineTo(12, 10);
      context.lineTo(-12, 10);
      context.closePath();
      context.fill();
      context.fillStyle = '#f2f0e6';
      context.fillRect(-4, -12, 8, 12);
      context.restore();
    }
  }

  function drawCarShape(w, car) {
    const spec = car.spec;
    context.save();
    context.translate(car.x, car.y);
    context.rotate(car.angle);
    // Shadow.
    context.fillStyle = 'rgba(0, 0, 0, 0.25)';
    context.fillRect(-spec.length / 2 + 4, -spec.width / 2 + 5, spec.length, spec.width);
    // Wheels.
    context.fillStyle = '#14161c';
    for (const wx of [-spec.length * 0.32, spec.length * 0.32]) {
      context.fillRect(wx - 5, -spec.width / 2 - 2, 10, 5);
      context.fillRect(wx - 5, spec.width / 2 - 3, 10, 5);
    }
    // Body.
    context.fillStyle = car.wrecked ? '#3a3a3a' : car.color;
    context.beginPath();
    context.roundRect(-spec.length / 2, -spec.width / 2, spec.length, spec.width, 8);
    context.fill();
    // Windshield and roof.
    context.fillStyle = 'rgba(20, 30, 40, 0.85)';
    context.fillRect(spec.length * 0.12, -spec.width / 2 + 4, spec.length * 0.2, spec.width - 8);
    context.fillStyle = 'rgba(255, 255, 255, 0.35)';
    context.fillRect(-spec.length * 0.28, -spec.width / 2 + 4, spec.length * 0.3, spec.width - 8);
    if (car.model === 'truck') {
      // Cargo bed with crates.
      context.fillStyle = 'rgba(0, 0, 0, 0.35)';
      context.fillRect(-spec.length * 0.42, -spec.width / 2 + 4, spec.length * 0.3, spec.width - 8);
      context.fillStyle = '#c9a86a';
      context.fillRect(-spec.length * 0.38, -spec.width / 2 + 7, 12, 10);
      context.fillRect(-spec.length * 0.38, spec.width / 2 - 17, 12, 10);
    }
    if (car.model === 'muscle') {
      // Hood stripe.
      context.fillStyle = 'rgba(0, 0, 0, 0.4)';
      context.fillRect(spec.length * 0.28, -4, spec.length * 0.2, 8);
    }
    // Headlights and brake lights.
    context.fillStyle = '#ffe9a8';
    context.fillRect(spec.length / 2 - 3, -spec.width / 2 + 3, 3, 6);
    context.fillRect(spec.length / 2 - 3, spec.width / 2 - 9, 3, 6);
    context.fillStyle = car.brakeLight ? '#ff3b30' : '#a02020';
    context.fillRect(-spec.length / 2, -spec.width / 2 + 3, 3, 6);
    context.fillRect(-spec.length / 2, spec.width / 2 - 9, 3, 6);
    if (car.police) {
      // Police livery: white doors and a light bar.
      context.fillStyle = '#f2f0e6';
      context.fillRect(-spec.length * 0.1, -spec.width / 2 + 2, spec.length * 0.28, spec.width - 4);
      context.fillStyle = '#20242e';
      text('PD', 0, 5, 16, '#20242e', 'center');
      const flash = Math.floor(w.time * 4) % 2 === 0;
      context.fillStyle = flash ? PALETTE.policeLightRed : PALETTE.policeLightBlue;
      context.fillRect(-6, -spec.width / 2 - 2, 12, 5);
    }
    if (car.model === 'taxi') {
      context.fillStyle = '#20242e';
      text('TAXI', 0, 5, 14, '#20242e', 'center');
    }
    context.restore();
    if (car.wrecked) {
      context.fillStyle = 'rgba(0, 0, 0, 0.35)';
      context.beginPath();
      context.arc(car.x, car.y, 6, 0, TAU);
      context.fill();
    }
  }

  function drawPerson(x, y, angle, shirt, walkPhase, radius, f) {
    const bob = Math.sin(walkPhase) * 2;
    context.save();
    context.translate(x, y);
    // Shadow.
    context.fillStyle = 'rgba(0, 0, 0, 0.25)';
    context.beginPath();
    context.ellipse(2, 3, radius * 1.1, radius * 0.75, 0, 0, TAU);
    context.fill();
    context.rotate(angle);
    context.translate(0, Math.sin(walkPhase) * 1.5);
    const sq = Math.sin(walkPhase * 2) * 0.07;
    context.scale(1 + sq, 1 - sq);
    // Body: thick outline, shoulders, then the big chibi head in front.
    circle(0, 0, radius * 0.95, '#20242e');
    context.fillStyle = shirt;
    context.beginPath();
    context.arc(0, 0, radius * 0.85, 0, TAU);
    context.fill();
    circle(radius * 0.5, 0, radius * 0.7, '#20242e');
    context.fillStyle = PALETTE.player;
    context.beginPath();
    context.arc(radius * 0.5, 0, radius * 0.6, 0, TAU);
    context.fill();
    // Arms swing a little while walking.
    context.fillStyle = shirt;
    context.beginPath();
    context.arc(-radius * 0.3, -radius * 0.8 + bob, radius * 0.3, 0, TAU);
    context.arc(-radius * 0.3, radius * 0.8 - bob, radius * 0.3, 0, TAU);
    context.fill();
    if (f > 0) circle(0, 0, radius, 'rgba(255, 255, 255, 0.85)');
    context.restore();
  }

  function drawHelicopter(w) {
    const heli = w.heli;
    if (!heli.active) return;
    // Ground shadow, offset down-right.
    context.fillStyle = 'rgba(0, 0, 0, 0.3)';
    context.beginPath();
    context.ellipse(heli.x + 26, heli.y + 34, 26, 14, 0, 0, TAU);
    context.fill();
    context.save();
    context.translate(heli.x, heli.y);
    context.rotate(heli.angle);
    // Tail and body.
    context.fillStyle = '#20242e';
    context.fillRect(-34, -4, 22, 8);
    context.fillStyle = '#3a4256';
    context.beginPath();
    context.ellipse(0, 0, 18, 11, 0, 0, TAU);
    context.fill();
    context.fillStyle = 'rgba(140, 200, 230, 0.9)';
    context.beginPath();
    context.arc(10, 0, 6, 0, TAU);
    context.fill();
    // Rotor: a spinning blur bar.
    context.rotate(heli.rotor);
    context.fillStyle = 'rgba(20, 22, 28, 0.5)';
    context.fillRect(-34, -2, 68, 4);
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
    // Skid marks.
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
    // Pickups.
    for (const pickup of w.pickups) {
      if (pickup.x < left || pickup.x > right || pickup.y < top || pickup.y > bottom) continue;
      const bobY = Math.sin(w.time * 3 + pickup.x) * 3;
      if (pickup.kind === 'cash') {
        context.fillStyle = '#2f9e44';
        context.fillRect(pickup.x - 10, pickup.y - 7 + bobY, 20, 14);
        text('$', pickup.x, pickup.y + 5 + bobY, 18, '#ffffff', 'center');
      } else if (pickup.kind === 'health') {
        context.fillStyle = '#f2f0e6';
        context.fillRect(pickup.x - 9, pickup.y - 9 + bobY, 18, 18);
        context.fillStyle = '#d64545';
        context.fillRect(pickup.x - 2, pickup.y - 6 + bobY, 4, 12);
        context.fillRect(pickup.x - 6, pickup.y - 2 + bobY, 12, 4);
      } else {
        context.fillStyle = '#8fb8d8';
        context.fillRect(pickup.x - 8, pickup.y - 8 + bobY, 16, 16);
        text('A', pickup.x, pickup.y + 6 + bobY, 16, '#20242e', 'center');
      }
    }
    // Hidden packages: gold parcels with a pulsing ring.
    for (const pack of w.packages) {
      if (pack.taken) continue;
      if (pack.x < left || pack.x > right || pack.y < top || pack.y > bottom) continue;
      const pulse = 1 + Math.sin(w.time * 4 + pack.id) * 0.2;
      context.strokeStyle = PALETTE.hudGold;
      context.lineWidth = 2;
      context.beginPath();
      context.arc(pack.x, pack.y, 16 * pulse, 0, TAU);
      context.stroke();
      context.fillStyle = '#c9a227';
      context.fillRect(pack.x - 8, pack.y - 6, 16, 12);
      context.fillStyle = '#8a6d1f';
      context.fillRect(pack.x - 1, pack.y - 6, 2, 12);
    }
    const marker = w.marker;
    if (marker) {
      const pulse = 1 + Math.sin(w.time * 4) * 0.15;
      context.fillStyle = 'rgba(255, 210, 63, 0.12)';
      context.fillRect(marker.x - 26, top, 52, bottom - top);
      context.strokeStyle = PALETTE.marker;
      context.lineWidth = 3;
      context.beginPath();
      context.arc(marker.x, marker.y, 34 * pulse, 0, TAU);
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
    // Fare peds wave a little flag.
    for (const ped of w.peds) {
      if (!ped.fare) continue;
      if (ped.x < left || ped.x > right || ped.y < top || ped.y > bottom) continue;
      const bobY = Math.sin(w.time * 5 + ped.id) * 4;
      context.fillStyle = '#ffd23f';
      context.fillRect(ped.x - 8, ped.y - 34 + bobY, 16, 12);
      text('$', ped.x, ped.y - 24 + bobY, 14, '#20242e', 'center');
    }
    const drawables = [];
    for (const ped of w.peds) drawables.push({ y: ped.y, kind: 'ped', ref: ped });
    for (const cop of w.footPolice) drawables.push({ y: cop.y, kind: 'cop', ref: cop });
    for (const car of w.cars) drawables.push({ y: car.y, kind: 'car', ref: car });
    if (w.player.onFoot) drawables.push({ y: w.player.y, kind: 'player', ref: w.player });
    drawables.sort((a, b) => a.y - b.y);
    for (const item of drawables) {
      if (item.y < top - 60 || item.y > bottom + 60) continue;
      if (item.kind === 'ped') {
        const ped = item.ref;
        drawPerson(ped.x, ped.y, ped.angle, ped.color, ped.walkPhase, 11, ped.flash);
      } else if (item.kind === 'cop') {
        const cop = item.ref;
        drawPerson(cop.x, cop.y, cop.angle, PALETTE.policeShirt, cop.walkPhase, 12, cop.flash);
        context.fillStyle = '#20242e';
        context.beginPath();
        context.arc(cop.x + Math.cos(cop.angle) * 6, cop.y + Math.sin(cop.angle) * 6, 5, 0, TAU);
        context.fill();
      } else if (item.kind === 'car') {
        drawCarShape(w, item.ref);
      } else {
        const player = item.ref;
        const blink = player.invuln > 0 && Math.floor(player.invuln * 10) % 2 === 0;
        if (!blink) {
          drawPerson(player.x, player.y, player.angle, PALETTE.playerShirt, player.walkPhase, 13, w.time - player.lastDamage < 0.15 ? 1 : 0);
          context.save();
          context.translate(player.x, player.y);
          context.rotate(player.aimAngle);
          context.fillStyle = '#20242e';
          context.fillRect(8, -2, 14, 4);
          context.restore();
        }
        // Aim line while the pistol was just fired.
        if (player.shootTimer > 0.12) {
          context.strokeStyle = 'rgba(255, 224, 138, 0.8)';
          context.lineWidth = 2;
          context.beginPath();
          context.moveTo(player.x + Math.cos(player.aimAngle) * 16, player.y + Math.sin(player.aimAngle) * 16);
          context.lineTo(player.x + Math.cos(player.aimAngle) * 34, player.y + Math.sin(player.aimAngle) * 34);
          context.stroke();
        }
      }
    }
    // Muzzle flash.
    if (w.player.shootTimer > 0.12) circle(w.lastShotX, w.lastShotY, 8, '#ffe08a');
    // Bullets.
    context.fillStyle = '#ffe08a';
    for (const bullet of w.bullets) {
      if (!bullet.active) continue;
      context.fillRect(bullet.x - 3, bullet.y - 1, 6, 2);
    }
    // Particles.
    w.effects.forEachParticle((particle) => {
      context.globalAlpha = Math.max(0, particle.life / particle.maxLife);
      circle(particle.x, particle.y, particle.size, particle.color);
    });
    context.globalAlpha = 1;
    // Floating texts.
    w.effects.forEachFloater((floater) => {
      context.globalAlpha = Math.min(1, floater.life);
      text(floater.text, floater.x, floater.y, 18, floater.color, 'center');
    });
    context.globalAlpha = 1;
    // The helicopter flies above it all.
    drawHelicopter(w);
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
      // Lamp pools.
      for (const lamp of w.city.lamps) {
        if (lamp.x < left || lamp.x > right || lamp.y < top || lamp.y > bottom) continue;
        drawGlow(warmGlow, lamp.x, lamp.y - 9, 85, light.lamps * 0.5);
      }
      // Headlight cones in front of every car.
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
      // Police siren glow spilling onto the road.
      const flash = Math.floor(w.time * 4) % 2 === 0;
      for (const car of w.policeCars) {
        if (car.x < left || car.x > right || car.y < top || car.y > bottom) continue;
        drawGlow(flash ? redGlow : blueGlow, car.x, car.y, 80, 0.55);
        drawGlow(flash ? blueGlow : redGlow, car.x, car.y, 50, 0.3);
      }
      if (w.heli.active) {
        drawGlow(whiteGlow, w.heli.spotX, w.heli.spotY, 95, 0.5);
        context.strokeStyle = 'rgba(255, 255, 230, 0.22)';
        context.lineWidth = 12;
        context.beginPath();
        context.moveTo(w.heli.x, w.heli.y);
        context.lineTo(w.heli.spotX, w.heli.spotY);
        context.stroke();
      }
      context.globalCompositeOperation = 'source-over';
    }
  }

  /** Paint one frame: the world, the HUD, and the screen's panel. */
  function draw(w, screen) {
    const zoom = w.camera.zoom;
    const shakeX = (Math.random() - 0.5) * w.effects.shake;
    const shakeY = (Math.random() - 0.5) * w.effects.shake;
    // World space, into the low-res buffer: the camera centre sits in the middle
    // of the view, zoomed in.
    const bs = buf.width / VIEW.width;
    context = bctx;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, buf.width, buf.height);
    context.setTransform(
      bs * zoom, 0, 0, bs * zoom,
      (VIEW.width / 2 - w.camera.x * zoom + shakeX * zoom) * bs,
      (VIEW.height / 2 - w.camera.y * zoom + shakeY * zoom) * bs,
    );
    drawWorld(w);
    // Upscale the buffer to the screen, then the HUD at full resolution.
    context = main;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.drawImage(buf, 0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    // Low-health damage vignette.
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
