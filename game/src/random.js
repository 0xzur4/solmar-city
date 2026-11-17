// A small seeded random number generator (mulberry32): the same seed gives the same city,
// the same traffic and the same screenshot scenes, which is what makes the game repeatable.

export function createRandom(seed) {
  let state = seed | 0;
  return function random() {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pick one element of an array with the seeded random. */
export function pick(random, array) {
  return array[Math.floor(random() * array.length)];
}

/** A number between min and max, inclusive of min, exclusive of max. */
export function range(random, min, max) {
  return min + random() * (max - min);
}

/** A whole number between min and max, inclusive. */
export function intRange(random, min, max) {
  return min + Math.floor(random() * (max - min + 1));
}
