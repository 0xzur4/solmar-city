// Drawing only: the city, the cars, the people, the effects — and nothing else. The 1280x720
// camera window is scaled to fit the window and centred, the margin filled with backdrop.
// Everything is flat canvas shapes: no images, no fonts to load, nothing over the network.
import { CITY, FONT, PALETTE, VIEW, WORLD } from './config.js';
import { drawHud, drawScreenPanel } from './hud.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';
export const SCREEN_COMPLETE = 'complete';

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

  function drawGround(w, left, top, right, bottom) {
    // Grass everywhere, then sand and water along the south shore.
    context.fillStyle = PALETTE.grass;
    context.fillRect(left, top, right - left, bottom - top);
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
      // Water shimmer: a few darker waves drifting east.
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
    // Sidewalk first (wider), asphalt on top, then lane dashes and crosswalks.
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
    for (const building of w.city.buildings) {
      if (building.x > right || building.x + building.w < left || building.y > bottom || building.y + building.h < top) continue;
      // Soft shadow to the south-east, then the roof, then a window grid.
      context.fillStyle = 'rgba(0, 0, 0, 0.18)';
      context.fillRect(building.x + 6, building.y + 8, building.w, building.h);
      context.fillStyle = building.color;
      context.fillRect(building.x, building.y, building.w, building.h);
      context.strokeStyle = PALETTE.buildingEdge;
      context.lineWidth = 2;
      context.strokeRect(building.x + 1, building.y + 1, building.w - 2, building.h - 2);
      context.fillStyle = 'rgba(255, 255, 255, 0.35)';
      const cols = Math.max(1, Math.floor(building.w / 34));
      const rows = Math.max(1, Math.floor(building.h / 34));
      for (let c = 0; c < cols; c += 1) {
        for (let r = 0; r < rows; r += 1) {
          context.fillRect(building.x + 10 + c * 34, building.y + 10 + r * 34, 14, 12);
        }
      }
    }
    // The park: a green block with a path.
    const park = w.city.park;
    if (park.x < right && park.x + park.w > left && park.y < bottom && park.y + park.h > top) {
      context.fillStyle = PALETTE.grassDark;
      context.fillRect(park.x, park.y, park.w, park.h);
      context.fillStyle = PALETTE.sandDark;
      context.fillRect(park.x + park.w / 2 - 8, park.y, 16, park.h);
      context.fillRect(park.x, park.y + park.h / 2 - 8, park.w, 16);
    }
    for (const tree of w.city.trees) {
      if (tree.x < left || tree.x > right || tree.y < top || tree.y > bottom) continue;
      context.fillStyle = PALETTE.treeTrunk;
      context.fillRect(tree.x - 2, tree.y - 2, 4, 6);
      circle(tree.x, tree.y - 4, tree.r, PALETTE.tree);
      circle(tree.x - tree.r * 0.4, tree.y - tree.r * 0.5, tree.r * 0.6, '#5d9153');
    }
    for (const lamp of w.city.lamps) {
      if (lamp.x < left || lamp.x > right || lamp.y < top || lamp.y > bottom) continue;
      context.fillStyle = PALETTE.lamp;
      context.fillRect(lamp.x - 2, lamp.y - 8, 4, 16);
      circle(lamp.x, lamp.y - 9, 4, '#ffe9a8');
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
    // Body.
    context.fillStyle = car.wrecked ? '#3a3a3a' : car.color;
    context.beginPath();
    context.roundRect(-spec.length / 2, -spec.width / 2, spec.length, spec.width, 8);
    context.fill();
    // Windshield and roof.
    context.fillStyle = 'rgba(20, 30, 40, 0.85)';
    context.fillRect(spec.length * 0.12, -spec.width / 2 + 4, spec.length * 0.2, spec.width - 8);
    context.fillStyle = 'rgba(255, 255, 255, 0.18)';
    context.fillRect(-spec.length * 0.28, -spec.width / 2 + 4, spec.length * 0.3, spec.width - 8);
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

  function drawPerson(x, y, angle, shirt, walkPhase, radius) {
    const bob = Math.sin(walkPhase) * 2;
    context.save();
    context.translate(x, y);
    // Shadow.
    context.fillStyle = 'rgba(0, 0, 0, 0.25)';
    context.beginPath();
    context.ellipse(2, 3, radius, radius * 0.7, 0, 0, Math.PI * 2);
    context.fill();
    context.rotate(angle);
    // Body: shoulders, then the head in front.
    context.fillStyle = shirt;
    context.beginPath();
    context.arc(0, 0, radius * 0.85, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.player;
    context.beginPath();
    context.arc(radius * 0.55, 0, radius * 0.5, 0, Math.PI * 2);
    context.fill();
    // Arms swing a little while walking.
    context.fillStyle = shirt;
    context.beginPath();
    context.arc(-radius * 0.3, -radius * 0.8 + bob, radius * 0.3, 0, Math.PI * 2);
    context.arc(-radius * 0.3, radius * 0.8 - bob, radius * 0.3, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function drawWorld(w) {
    const camera = w.camera;
    const shakeX = (Math.random() - 0.5) * w.effects.shake;
    const shakeY = (Math.random() - 0.5) * w.effects.shake;
    const left = camera.x - VIEW.width / 2 + shakeX;
    const top = camera.y - VIEW.height / 2 + shakeY;
    const right = left + VIEW.width;
    const bottom = top + VIEW.height;
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
        text('$', pickup.x, pickup.y + 4 + bobY, 13, '#ffffff', 'center');
      } else if (pickup.kind === 'health') {
        context.fillStyle = '#f2f0e6';
        context.fillRect(pickup.x - 9, pickup.y - 9 + bobY, 18, 18);
        context.fillStyle = '#d64545';
        context.fillRect(pickup.x - 2, pickup.y - 6 + bobY, 4, 12);
        context.fillRect(pickup.x - 6, pickup.y - 2 + bobY, 12, 4);
      } else {
        context.fillStyle = '#8fb8d8';
        context.fillRect(pickup.x - 8, pickup.y - 8 + bobY, 16, 16);
        text('A', pickup.x, pickup.y + 5 + bobY, 12, '#20242e', 'center');
      }
    }
    // Mission beacon: a pillar of light and a pulsing ring at the marker.
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
    // Fare peds wave a little flag.
    for (const ped of w.peds) {
      if (!ped.fare) continue;
      if (ped.x < left || ped.x > right || ped.y < top || ped.y > bottom) continue;
      const bobY = Math.sin(w.time * 5 + ped.id) * 4;
      context.fillStyle = '#ffd23f';
      context.fillRect(ped.x - 8, ped.y - 34 + bobY, 16, 12);
      text('$', ped.x, ped.y - 24 + bobY, 11, '#20242e', 'center');
    }
    // People and cars, sorted by y so nearer things draw over farther ones.
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
        drawPerson(ped.x, ped.y, ped.angle, ped.color, ped.walkPhase, 11);
      } else if (item.kind === 'cop') {
        const cop = item.ref;
        drawPerson(cop.x, cop.y, cop.angle, PALETTE.policeShirt, cop.walkPhase, 12);
        context.fillStyle = '#20242e';
        context.beginPath();
        context.arc(cop.x + Math.cos(cop.angle) * 6, cop.y + Math.sin(cop.angle) * 6, 5, 0, Math.PI * 2);
        context.fill();
      } else if (item.kind === 'car') {
        drawCarShape(w, item.ref);
      } else {
        const player = item.ref;
        const blink = player.invuln > 0 && Math.floor(player.invuln * 10) % 2 === 0;
        if (!blink) drawPerson(player.x, player.y, player.angle, PALETTE.playerShirt, player.walkPhase, 13);
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
  }

  /** Paint one frame: the world, the HUD, and the screen's panel. */
  function draw(w, screen) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const shakeX = (Math.random() - 0.5) * w.effects.shake;
    const shakeY = (Math.random() - 0.5) * w.effects.shake;
    // World space: the camera centre sits in the middle of the view.
    context.setTransform(
      view.scale, 0, 0, view.scale,
      view.x + (VIEW.width / 2 - w.camera.x + shakeX) * view.scale,
      view.y + (VIEW.height / 2 - w.camera.y + shakeY) * view.scale,
    );
    drawWorld(w);
    // View space (1280x720) for the HUD and the panels.
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
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
