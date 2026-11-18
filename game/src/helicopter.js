// helicopter.js: The police helicopter: at 4 stars and up it circles the player, its sp
import { WANTED } from './config.js';

export function createHeli() {
  return { active: false, x: 0, y: 0, angle: 0, rotor: 0, spotX: 0, spotY: 0 };
}

/** Step the helicopter: spawn at 4 stars, follow the player, despawn when the heat drops. */
export function stepHeli(w, dt) {
  const heli = w.heli;
  const player = w.player;
  const px = player.car !== null ? player.car.x : player.x;
  const py = player.car !== null ? player.car.y : player.y;
  if (w.wanted.stars < WANTED.heliAtStars) {
    heli.active = false;
    return;
  }
  if (!heli.active) {
    heli.active = true;
    heli.x = px + 350;
    heli.y = py - 280;
  }
  heli.rotor += dt * 28;
  // Circle the player at a fixed radius: take the helicopter's current angle around
  // the player, advance it a little, and chase that point on the circle. (The old
  // version aimed at the player plus a fixed offset and spiralled into the player.)
  const orbit = Math.atan2(heli.y - py, heli.x - px) + dt * 0.55;
  const tx = px + Math.cos(orbit) * 330;
  const ty = py + Math.sin(orbit) * 330;
  heli.x += (tx - heli.x) * Math.min(1, 2.2 * dt);
  heli.y += (ty - heli.y) * Math.min(1, 2.2 * dt);
  heli.angle = Math.atan2(py - heli.y, px - heli.x);
  heli.spotX = px;
  heli.spotY = py;
}

/** Is the spotlight on the player right now? */
export function heliSpotOnPlayer(w) {
  return w.heli.active;
}
