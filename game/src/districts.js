// districts.js: Districts: which part of Solmar a block belongs to. Downtown towers ge
import { PALETTE } from './config.js';
import { pick } from './random.js';

export const DISTRICT_DOWNTOWN = 'downtown';
export const DISTRICT_COMMERCIAL = 'commercial';
export const DISTRICT_RESIDENTIAL = 'residential';
export const DISTRICT_MARINA = 'marina';

const NEON_WORDS = ['HOTEL', 'BAR', 'CLUB', 'CAFE', '24H', 'PIER', 'MART', 'NEON'];

/** District of the block at (avenue index, street index). */
export function districtFor(ai, si) {
  if (si === 4 && ai >= 3 && ai <= 4) return DISTRICT_MARINA;
  if (ai >= 2 && ai <= 4 && si >= 1 && si <= 2) return DISTRICT_DOWNTOWN;
  if (si === 3 || (ai >= 5 && si <= 2)) return DISTRICT_COMMERCIAL;
  return DISTRICT_RESIDENTIAL;
}

/** Building height in storeys, by district: towers downtown, houses at the edges. */
export function heightFor(random, district) {
  if (district === DISTRICT_DOWNTOWN) return 3 + Math.floor(random() * 2);
  if (district === DISTRICT_COMMERCIAL) return 2;
  return 1 + Math.floor(random() * 2);
}

/** A neon storefront sign for a downtown building, or null. */
export function neonFor(random, district) {
  if (district !== DISTRICT_DOWNTOWN || random() > 0.65) return null;
  return { text: pick(random, NEON_WORDS), color: pick(random, PALETTE.neon) };
}

/** Ground colour under a block, so districts read at a glance from above. */
export function groundFor(district) {
  if (district === DISTRICT_DOWNTOWN) return '#8a8f7a';
  if (district === DISTRICT_COMMERCIAL) return '#7d8a72';
  if (district === DISTRICT_MARINA) return '#b9a98c';
  return PALETTE.grass;
}
