// lighting.js: Lighting: Solmar's day cycle. The clock runs through day, golden hour,
import { LIGHTING } from './config.js';

export function createLighting() {
  return { clock: 0, fixed: false };
}

/** Advance the clock, unless a shot fixed it. */
export function stepLighting(lighting, dt) {
  if (!lighting.fixed) lighting.clock += dt;
}

/** Fix the clock at a phase: 'day' | 'golden' | 'night' | 'dawn'. */
export function fixLighting(lighting, phase) {
  const at = { day: 0.2, golden: 0.62, night: 0.8, dawn: 0.96 }[phase] ?? 0.2;
  lighting.clock = at * LIGHTING.cycleSeconds;
  lighting.fixed = true;
}

/** Current state: name, how dark the overlay is, lamp/neon strength, warm tint. */
export function lightingState(lighting) {
  const p = ((lighting.clock % LIGHTING.cycleSeconds) / LIGHTING.cycleSeconds + 1) % 1;
  if (p < LIGHTING.dayEnd) return { name: 'day', darkness: 0, warmth: 0, lamps: 0, neon: 0.25 };
  if (p < LIGHTING.goldenEnd) return { name: 'golden', darkness: 0.06, warmth: LIGHTING.goldenWarmth, lamps: 0.5, neon: 0.7 };
  if (p < LIGHTING.nightEnd) return { name: 'night', darkness: LIGHTING.nightDarkness, warmth: 0, lamps: 1, neon: 1 };
  return { name: 'dawn', darkness: 0.12, warmth: 0.1, lamps: 0.6, neon: 0.8 };
}

/** Is it dark enough that headlights and lit windows matter? */
export function isNight(lighting) {
  const state = lightingState(lighting);
  return state.name === 'night' || state.name === 'dawn';
}
