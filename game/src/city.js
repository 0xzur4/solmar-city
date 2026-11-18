// city.js: The city of Solmar, generated once from a seed: avenues and streets on
import { CITY, PALETTE, WORLD } from './config.js';
import { districtFor, groundFor, heightFor, neonFor, DISTRICT_COMMERCIAL } from './districts.js';
import { intRange, pick, range } from './random.js';

/** Is the point on a road (including the sidewalk strip)? */
export function onRoad(city, x, y) {
  for (const avenue of CITY.avenues) {
    if (Math.abs(x - avenue) <= CITY.roadWidth / 2 + CITY.sidewalk) return true;
  }
  for (const street of CITY.streets) {
    if (Math.abs(y - street) <= CITY.roadWidth / 2 + CITY.sidewalk) return true;
  }
  return false;
}

/** Is the point on the drivable asphalt (not the sidewalk)? */
export function onAsphalt(city, x, y) {
  for (const avenue of CITY.avenues) {
    if (Math.abs(x - avenue) <= CITY.roadWidth / 2) return true;
  }
  for (const street of CITY.streets) {
    if (Math.abs(y - street) <= CITY.roadWidth / 2) return true;
  }
  return false;
}

/** Is the point inside a building? Returns the building or null. */
export function buildingAt(city, x, y) {
  for (const building of city.buildings) {
    if (x >= building.x && x <= building.x + building.w && y >= building.y && y <= building.y + building.h) {
      return building;
    }
  }
  return null;
}

/** Push a circle (x, y, radius) out of every building it overlaps. Returns true if it moved. */
export function resolveBuildingCollision(city, body) {
  let moved = false;
  for (const building of city.buildings) {
    const closestX = Math.max(building.x, Math.min(body.x, building.x + building.w));
    const closestY = Math.max(building.y, Math.min(body.y, building.y + building.h));
    const dx = body.x - closestX;
    const dy = body.y - closestY;
    const distSq = dx * dx + dy * dy;
    if (distSq >= body.radius * body.radius) continue;
    moved = true;
    if (distSq > 0.0001) {
      const dist = Math.sqrt(distSq);
      body.x = closestX + (dx / dist) * body.radius;
      body.y = closestY + (dy / dist) * body.radius;
    } else {
      // Centre inside the building: push out along the smallest penetration axis.
      const left = body.x - building.x;
      const right = building.x + building.w - body.x;
      const top = body.y - building.y;
      const bottom = building.y + building.h - body.y;
      const min = Math.min(left, right, top, bottom);
      if (min === left) body.x = building.x - body.radius;
      else if (min === right) body.x = building.x + building.w + body.radius;
      else if (min === top) body.y = building.y - body.radius;
      else body.y = building.y + building.h + body.radius;
    }
  }
  return moved;
}

/** Clamp a point inside the world, keeping it off the water. */
export function clampToLand(city, x, y) {
  return {
    x: Math.max(20, Math.min(WORLD.width - 20, x)),
    y: Math.max(20, Math.min(CITY.waterY - 30, y)),
  };
}

/** A random point on a road centreline (for traffic and mission targets). */
export function randomRoadPoint(random) {
  if (random() < 0.5) {
    return { x: pick(random, CITY.avenues), y: range(random, 120, CITY.beachY - 120) };
  }
  return { x: range(random, 120, WORLD.width - 120), y: pick(random, CITY.streets) };
}

/** A random point on a sidewalk (for pedestrians and on-foot targets). */
export function randomSidewalkPoint(random) {
  const point = randomRoadPoint(random);
  const onAvenue = CITY.avenues.includes(point.x);
  if (onAvenue) point.x += (random() < 0.5 ? -1 : 1) * (CITY.roadWidth / 2 + CITY.sidewalk / 2);
  else point.y += (random() < 0.5 ? -1 : 1) * (CITY.roadWidth / 2 + CITY.sidewalk / 2);
  return point;
}

/** The nearest intersection (avenue, street) to a point. */
export function nearestIntersection(x, y) {
  let bestAvenue = CITY.avenues[0];
  let bestStreet = CITY.streets[0];
  for (const avenue of CITY.avenues) {
    if (Math.abs(avenue - x) < Math.abs(bestAvenue - x)) bestAvenue = avenue;
  }
  for (const street of CITY.streets) {
    if (Math.abs(street - y) < Math.abs(bestStreet - street)) bestStreet = street;
  }
  return { x: bestAvenue, y: bestStreet };
}

function buildBlocks(random) {
  const buildings = [];
  const trees = [];
  const lamps = [];
  const benches = [];
  const hydrants = [];
  const busStops = [];
  const awnings = [];
  const blockGround = [];
  const avenues = CITY.avenues;
  const streets = CITY.streets;
  // Blocks are the cells between neighbouring avenues and streets.
  for (let ai = 0; ai < avenues.length - 1; ai += 1) {
    for (let si = 0; si < streets.length - 1; si += 1) {
      const x0 = avenues[ai] + CITY.roadWidth / 2 + CITY.sidewalk + 8;
      const x1 = avenues[ai + 1] - CITY.roadWidth / 2 - CITY.sidewalk - 8;
      const y0 = streets[si] + CITY.roadWidth / 2 + CITY.sidewalk + 8;
      const y1 = streets[si + 1] - CITY.roadWidth / 2 - CITY.sidewalk - 8;
      const blockW = x1 - x0;
      const blockH = y1 - y0;
      const district = districtFor(ai, si);
      blockGround.push({ x: x0 - 8, y: y0 - 8, w: blockW + 16, h: blockH + 16, color: groundFor(district) });
      // The park block stays green: no buildings, only trees.
      const isPark = ai === 3 && si === 2;
      if (isPark) {
        for (let t = 0; t < 14; t += 1) {
          trees.push({ x: range(random, x0 + 20, x1 - 20), y: range(random, y0 + 20, y1 - 20), r: range(random, 12, 20) });
        }
        benches.push({ x: x0 + blockW / 2 - 60, y: y0 + blockH / 2, angle: 0 });
        benches.push({ x: x0 + blockW / 2 + 60, y: y0 + blockH / 2, angle: Math.PI });
        continue;
      }
      // One or two buildings per block, with a yard gap between them.
      const split = blockW > 220 && random() < 0.6;
      const count = split ? 2 : 1;
      for (let b = 0; b < count; b += 1) {
        const bx0 = split ? x0 + (b * blockW) / 2 + 6 : x0 + 10;
        const bx1 = split ? x0 + ((b + 1) * blockW) / 2 - 6 : x1 - 10;
        const w = range(random, (bx1 - bx0) * 0.55, bx1 - bx0 - 8);
        const h = range(random, blockH * 0.45, blockH - 16);
        const building = {
          x: bx0 + range(random, 0, Math.max(0, (bx1 - bx0) - w)),
          y: y0 + range(random, 0, Math.max(0, blockH - h)),
          w,
          h,
          color: pick(random, PALETTE.buildingRoof),
          windows: intRange(random, 2, 5),
          district,
          height: heightFor(random, district),
          neon: neonFor(random, district),
        };
        buildings.push(building);
        if (district === DISTRICT_COMMERCIAL && random() < 0.7) {
          awnings.push({ x: building.x, y: building.y + building.h - 4, w: building.w * 0.6, color: pick(random, PALETTE.awning) });
        }
      }
      // A tree or two on the block's corners, and lamps along its roads.
      if (random() < 0.7) trees.push({ x: x0 + 14, y: y0 + 14, r: range(random, 10, 16) });
      if (random() < 0.5) trees.push({ x: x1 - 14, y: y1 - 14, r: range(random, 10, 16) });
      if (random() < 0.5) trees.push({ x: x0 + blockW / 2, y: y1 - 16, r: range(random, 9, 14) });
      if (random() < 0.4) hydrants.push({ x: x0 + 10, y: y0 + blockH - 10 });
      if (random() < 0.25) busStops.push({ x: x1 - 6, y: y0 + 30 });
      lamps.push({ x: x0 - 4, y: y0 + blockH / 2 });
      lamps.push({ x: x1 + 4, y: y0 + blockH / 2 });
    }
  }
  // Beach props: umbrellas and towels on the sand, piers and boats at the marina.
  const umbrellas = [];
  for (let i = 0; i < 14; i += 1) {
    umbrellas.push({
      x: range(random, 200, WORLD.width - 200),
      y: range(random, CITY.beachY + 30, CITY.waterY - 30),
      color: pick(random, PALETTE.umbrella),
    });
  }
  const piers = [];
  for (const px of [CITY.avenues[3] + 120, CITY.avenues[4] - 60, CITY.avenues[4] + 140]) {
    piers.push({ x: px, y: CITY.beachY + 40, w: 26, h: CITY.waterY - CITY.beachY + 120 });
  }
  const boats = [];
  for (let i = 0; i < 6; i += 1) {
    boats.push({
      x: range(random, 400, WORLD.width - 400),
      y: range(random, CITY.waterY + 30, WORLD.height - 60),
      angle: range(random, -0.4, 0.4),
      color: pick(random, PALETTE.boatHull),
      bob: random() * Math.PI * 2,
    });
  }
  return { buildings, trees, lamps, benches, hydrants, busStops, awnings, umbrellas, piers, boats, blockGround };
}

/** Build the whole city from the seed. */
export function createCity(random) {
  const blocks = buildBlocks(random);
  const city = {
    ...blocks,
    park: { x: CITY.avenues[3] + CITY.roadWidth / 2 + CITY.sidewalk, y: CITY.streets[2] + CITY.roadWidth / 2 + CITY.sidewalk, w: 400 - CITY.roadWidth - 2 * CITY.sidewalk, h: 350 - CITY.roadWidth - 2 * CITY.sidewalk },
    plaza: { x: CITY.avenues[4] + CITY.roadWidth / 2 + CITY.sidewalk, y: CITY.streets[1] + CITY.roadWidth / 2 + CITY.sidewalk, w: 400 - CITY.roadWidth - 2 * CITY.sidewalk, h: 350 - CITY.roadWidth - 2 * CITY.sidewalk },
    // Named places the story uses, each on a road so cars and feet can reach them.
    hospital: { x: CITY.avenues[1], y: CITY.streets[1] + 90, label: 'Solmar General' },
    policeStation: { x: CITY.avenues[2], y: CITY.streets[2] - 90, label: 'Solmar PD' },
    garage: { x: CITY.avenues[6], y: CITY.streets[4] + 90, label: "Mara's Garage" },
    dealership: { x: CITY.avenues[5], y: CITY.streets[1] - 90, label: 'Costa Motors' },
    marina: { x: CITY.avenues[4], y: 2080, label: 'Solmar Marina' },
    safehouse: { x: CITY.avenues[0], y: CITY.streets[5] + 90, label: 'Safehouse' },
    bank: { x: CITY.avenues[3], y: CITY.streets[3] - 90, label: 'Solmar Bank' },
    pier: { x: CITY.avenues[4] - 60, y: 2360, label: 'Solmar Pier' },
    spawn: { x: CITY.avenues[2], y: CITY.streets[3] },
  };
  return city;
}
