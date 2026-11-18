// random.js: A small seeded random number generator (mulberry32): the same seed giv

export function createRandom(seed) {
  let state = seed | 0;
  return function random() {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}


export function pick(random, array) {
  return array[Math.floor(random() * array.length)];
}


export function range(random, min, max) {
  return min + random() * (max - min);
}


export function intRange(random, min, max) {
  return min + Math.floor(random() * (max - min + 1));
}
