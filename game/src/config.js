// config.js: Every tuning number and colour in one place. Solmar is a sun-soaked co


export const STEP = 1 / 60;


export const WORLD = { width: 3600, height: 2600 };


export const VIEW = { width: 1280, height: 720 };


export const CITY = {
  avenues: [300, 700, 1100, 1500, 1900, 2300, 2700, 3100],
  streets: [250, 600, 950, 1300, 1650, 2000],
  roadWidth: 96,
  sidewalk: 18,
  laneOffset: 24,

  beachY: 2250,
  waterY: 2460,
};


export const PLAYER = {
  radius: 14,
  walkSpeed: 230,
  runSpeed: 340,
  accel: 1800,
  maxHealth: 100,

  regen: 2.5,
  regenDelay: 8,


  enterRange: 76,
  punchRange: 36,
  punchDamage: 12,
  punchArc: 1.1,
  punchCooldown: 0.35,
};


export const PISTOL = {
  damage: 34,
  range: 520,
  cooldown: 0.28,
  bulletSpeed: 900,
  startAmmo: 24,
  pickupAmmo: 24,
  spread: 0.05,
};


export const CAR_MODELS = {
  sedan: { length: 64, width: 30, accel: 420, brake: 700, reverse: 200, maxSpeed: 460, grip: 0.9, turn: 2.6, color: '#c94f43' },
  taxi: { length: 64, width: 30, accel: 400, brake: 700, reverse: 200, maxSpeed: 440, grip: 0.9, turn: 2.6, color: '#f2c230' },
  van: { length: 76, width: 32, accel: 300, brake: 600, reverse: 170, maxSpeed: 380, grip: 0.93, turn: 2.1, color: '#7a8ba0' },
  sports: { length: 62, width: 30, accel: 620, brake: 800, reverse: 230, maxSpeed: 640, grip: 0.86, turn: 3.1, color: '#2fb3a6' },
  pickup: { length: 70, width: 32, accel: 380, brake: 650, reverse: 190, maxSpeed: 430, grip: 0.91, turn: 2.4, color: '#4f7ec9' },
  muscle: { length: 66, width: 32, accel: 560, brake: 750, reverse: 210, maxSpeed: 580, grip: 0.88, turn: 2.8, color: '#e07a2e' },
  truck: { length: 92, width: 34, accel: 240, brake: 550, reverse: 150, maxSpeed: 340, grip: 0.95, turn: 1.8, color: '#8a6d4b' },
  police: { length: 66, width: 30, accel: 560, brake: 800, reverse: 220, maxSpeed: 600, grip: 0.88, turn: 3.0, color: '#20242e' },
};


export const TRAFFIC = {
  cars: 30,
  parked: 24,
  cruiseSpeed: 175,
  cruiseJitter: 45,
  peds: 64,
  pedSpeed: 55,
  pedFleeSpeed: 150,
};


export const WANTED = {
  starAt: [15, 35, 55, 75, 90],
  decay: 2.2,
  decayDelay: 5,

  hideMultiplier: 3,
  stealCar: 25,
  hitPed: 30,
  killPed: 45,
  shoot: 12,
  hitPolice: 40,
  killPolice: 50,

  policeCars: [0, 1, 2, 3, 4, 5],

  footPolice: [0, 0, 1, 2, 3, 4],


  spawnRange: 700,
  despawnRange: 1400,
};


export const MONEY = {
  start: 100,
  cashPickup: 50,
  repairCost: 150,
  bustedLoss: 0.15,
  wastedLoss: 0.1,
  healthPack: 40,
};


export const PICKUPS = {
  cash: 5,
  health: 3,
  ammo: 3,
  weapons: 3,
};


export const LIGHTING = {
  cycleSeconds: 300,

  dayEnd: 0.55,
  goldenEnd: 0.7,
  nightEnd: 0.92,
  nightDarkness: 0.42,
  goldenWarmth: 0.16,
};


export const CAMERA = {
  zoom: 1.55,
  zoomFast: 1.3,
  zoomTitle: 1.25,
  zoomLerp: 2,
};


export const PALETTE = {
  backdrop: '#1c2430',
  water: '#2fa8b5',
  sand: '#e8d5a3',
  sandDark: '#d9c184',
  grass: '#7fb069',
  grassDark: '#6a9a58',
  road: '#3d3a38',
  laneDash: '#e8e0c8',
  sidewalk: '#b9a98c',
  crosswalk: '#e8e0c8',
  buildingRoof: ['#e8a87c', '#d9c27a', '#a8c8a0', '#e07a6a', '#8fb8d8', '#c9a0c9', '#f0d0a0', '#9ab8a0'],
  buildingEdge: 'rgba(0, 0, 0, 0.2)',
  tree: '#4e7d46',
  treeTrunk: '#6b4a2f',
  plaza: '#9a938a',
  plazaEdge: '#7d766e',
  fountain: '#3fa8c9',
  umbrella: ['#e4572e', '#f2c230', '#4f7ec9', '#c94f43', '#2fb3a6'],
  awning: ['#e4572e', '#2fb3a6', '#f2c230', '#c94f43'],
  windowLit: '#ffe9a8',
  policeLightRed: '#ff3b30',
  policeLightBlue: '#2f7bff',
  marker: '#ffd23f',
  markerRing: '#ffffff',
  hudPanel: 'rgba(16, 20, 28, 0.72)',
  hudText: '#f2f0e6',
  hudMuted: '#b9b4a4',
  hudBad: '#ff6b5e',
  hudGold: '#ffd23f',
  star: '#ffd23f',
  starEmpty: '#5a5f6a',
  health: '#7fd08a',
  healthLow: '#ff6b5e',
  title: '#ffd23f',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
