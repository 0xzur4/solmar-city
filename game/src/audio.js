// audio.js: All sound is synthesised with the Web Audio API: no audio files, no ne

let context = null;
let master = null;
let muted = false;

let unlocked = false;
function ensureContext() {
  if (context !== null) return context;
  if (!unlocked) return null;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;
  context = new AudioContext();
  master = context.createGain();
  master.gain.value = 0.5;
  master.connect(context.destination);
  return context;
}


export function unlockAudio() {
  unlocked = true;
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

export function playShoot(kind = 'pistol') {
  if (kind === 'smg') {
    noise({ duration: 0.07, volume: 0.32, filterFrequency: 2400, type: 'highpass' });
    tone({ frequency: 240, endFrequency: 90, duration: 0.06, type: 'square', volume: 0.15 });
  } else if (kind === 'shotgun') {
    noise({ duration: 0.28, volume: 0.7, filterFrequency: 900 });
    tone({ frequency: 120, endFrequency: 40, duration: 0.22, type: 'sawtooth', volume: 0.3 });
  } else if (kind === 'plasma') {
    tone({ frequency: 1100, endFrequency: 260, duration: 0.2, type: 'sine', volume: 0.25 });
    tone({ frequency: 520, endFrequency: 1300, duration: 0.1, type: 'triangle', volume: 0.12 });
  } else {
    noise({ duration: 0.12, volume: 0.5, filterFrequency: 1800, type: 'highpass' });
    tone({ frequency: 180, endFrequency: 60, duration: 0.1, type: 'square', volume: 0.25 });
  }
}


export function playSkill(kind) {
  const base = { dario: 330, mika: 520, rocco: 110, luna: 660 }[kind] ?? 400;
  if (kind === 'rocco') {
    noise({ duration: 0.4, volume: 0.6, filterFrequency: 260 });
    tone({ frequency: 110, endFrequency: 35, duration: 0.4, type: 'sawtooth', volume: 0.4 });
  } else {
    tone({ frequency: base, endFrequency: base * 2.4, duration: 0.28, type: 'triangle', volume: 0.3 });
    tone({ frequency: base * 1.5, endFrequency: base * 3, duration: 0.22, type: 'sine', volume: 0.18, when: 0.05 });
  }
}

export function playSwitch() {
  tone({ frequency: 420, duration: 0.04, type: 'square', volume: 0.12 });
  tone({ frequency: 620, duration: 0.05, type: 'square', volume: 0.12, when: 0.04 });
}

export function playEmpty() {
  tone({ frequency: 150, duration: 0.05, type: 'square', volume: 0.12 });
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
