// audio.js: All sound is synthesised with the Web Audio API: no audio files, no ne

let context = null;
let master = null;
let muted = false;
let engineNodes = null;

function ensureContext() {
  if (context !== null) return context;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;
  context = new AudioContext();
  master = context.createGain();
  master.gain.value = 0.5;
  master.connect(context.destination);
  return context;
}

/** Call from a user gesture (start button, key press) so the browser allows sound. */
export function unlockAudio() {
  const ctx = ensureContext();
  if (ctx !== null && ctx.state === 'suspended') ctx.resume().catch(() => {});
}

export function setMuted(value) {
  muted = value;
  if (master !== null) master.gain.value = muted ? 0 : 0.5;
}

export function isMuted() {
  return muted;
}

function tone({ frequency, endFrequency, duration, type, volume, when = 0 }) {
  const ctx = ensureContext();
  if (ctx === null || muted) return;
  const start = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, start);
  if (endFrequency !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), start + duration);
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  osc.connect(gain);
  gain.connect(master);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

function noise({ duration, volume, filterFrequency, type = 'lowpass', when = 0 }) {
  const ctx = ensureContext();
  if (ctx === null || muted) return;
  const start = ctx.currentTime + when;
  const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = filterFrequency;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  source.start(start);
  source.stop(start + duration + 0.02);
}

export function playShoot() {
  noise({ duration: 0.12, volume: 0.5, filterFrequency: 1800, type: 'highpass' });
  tone({ frequency: 180, endFrequency: 60, duration: 0.1, type: 'square', volume: 0.25 });
}

export function playPunch() {
  noise({ duration: 0.09, volume: 0.4, filterFrequency: 500 });
}

export function playCrash(strength) {
  noise({ duration: 0.18, volume: Math.min(0.6, 0.2 + strength * 0.001), filterFrequency: 300 });
}

export function playExplosion() {
  noise({ duration: 0.5, volume: 0.6, filterFrequency: 220 });
  tone({ frequency: 90, endFrequency: 30, duration: 0.45, type: 'sawtooth', volume: 0.35 });
}

export function playPickup() {
  tone({ frequency: 660, duration: 0.09, type: 'sine', volume: 0.3 });
  tone({ frequency: 990, duration: 0.12, type: 'sine', volume: 0.3, when: 0.08 });
}

export function playMissionDone() {
  const notes = [523, 659, 784, 1047];
  notes.forEach((frequency, index) => {
    tone({ frequency, duration: 0.16, type: 'triangle', volume: 0.3, when: index * 0.11 });
  });
}

export function playBusted() {
  tone({ frequency: 220, endFrequency: 110, duration: 0.5, type: 'sawtooth', volume: 0.25 });
}

export function playClick() {
  tone({ frequency: 800, duration: 0.05, type: 'sine', volume: 0.2 });
}

export function playSirenTick(on) {
  tone({ frequency: on ? 880 : 660, duration: 0.18, type: 'sine', volume: 0.08 });
}

/** Start the engine hum; call every frame with the driven car's speed ratio (0..1). */
export function updateEngine(speedRatio, driving) {
  const ctx = ensureContext();
  if (ctx === null || muted) {
    if (engineNodes !== null) {
      engineNodes.osc.stop();
      engineNodes = null;
    }
    return;
  }
  if (!driving) {
    if (engineNodes !== null) {
      engineNodes.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
      const nodes = engineNodes;
      window.setTimeout(() => {
        try { nodes.osc.stop(); } catch { /* already stopped */ }
      }, 400);
      engineNodes = null;
    }
    return;
  }
  if (engineNodes === null) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = 60;
    gain.gain.value = 0;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    osc.start();
    engineNodes = { osc, gain, filter };
  }
  const target = 55 + speedRatio * 130;
  engineNodes.osc.frequency.setTargetAtTime(target, ctx.currentTime, 0.08);
  engineNodes.gain.gain.setTargetAtTime(0.05 + speedRatio * 0.05, ctx.currentTime, 0.1);
}
