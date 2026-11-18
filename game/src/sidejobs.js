// sidejobs.js: Side jobs: ten hidden packages scattered around the city, each worth $
import { MONEY, PICKUPS } from './config.js';
import { randomSidewalkPoint } from './city.js';
import { playPickup } from './audio.js';

export function spawnPackages(w) {
  const spots = [
    { place: 'park' }, { place: 'marina' }, { place: 'beach' }, { place: 'plaza' },
    { place: 'bank' }, { place: 'dealership' }, { place: 'hospital' }, { place: 'safehouse' },
  ];
  const packages = [];
  for (let i = 0; i < PICKUPS.packages; i += 1) {
    const spot = spots[i % spots.length];
    let point;
    if (spot.place === 'park') point = { x: w.city.park.x + 40 + w.random() * (w.city.park.w - 80), y: w.city.park.y + 40 + w.random() * (w.city.park.h - 80) };
    else if (spot.place === 'beach') point = { x: 300 + w.random() * 3000, y: 2290 + w.random() * 130 };
    else if (spot.place === 'plaza') point = { x: w.city.plaza.x + 30 + w.random() * (w.city.plaza.w - 60), y: w.city.plaza.y + 30 + w.random() * (w.city.plaza.h - 60) };
    else if (spot.place === 'marina') point = { x: w.city.marina.x - 120 + w.random() * 240, y: 2100 + w.random() * 120 };
    else point = randomSidewalkPoint(w.random);
    packages.push({ id: i, x: point.x, y: point.y, taken: false });
  }
  return packages;
}

/** Walk over a package to take it: money, a floater, and a count for the HUD. */
export function collectPackages(w) {
  const player = w.player;
  if (!player.onFoot) return;
  for (const pack of w.packages) {
    if (pack.taken) continue;
    if (Math.hypot(pack.x - player.x, pack.y - player.y) < 34) {
      pack.taken = true;
      player.money += MONEY.packageReward;
      w.stats.earned += MONEY.packageReward;
      w.stats.packages = (w.stats.packages ?? 0) + 1;
      w.effects.addFloater(player.x, player.y - 24, `Package +$${MONEY.packageReward}`, '#ffd23f');
      playPickup();
    }
  }
}

/** How many packages the player has found. */
export function packagesFound(w) {
  return w.packages.filter((pack) => pack.taken).length;
}
