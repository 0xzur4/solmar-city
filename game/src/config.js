// Every tuning number and colour in one place. Solmar is a sun-soaked coastal city:
// warm sand, teal water, pastel buildings, dark asphalt roads. The world is one fixed
// rectangle; the camera shows a 1280x720 window of it. Nothing here depends on screen size.

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** The whole city, in world units. */
export const WORLD = { width: 3600, height: 2600 };

/** The camera's view, in world units. */
export const VIEW = { width: 1280, height: 720 };

/** Road layout: avenues run north-south, streets east-west. */
export const CITY = {
  avenues: [300, 700, 1100, 1500, 1900, 2300, 2700, 3100],
  streets: [250, 600, 950, 1300, 1650, 2000],
  roadWidth: 96,
  sidewalk: 18,
  laneOffset: 24,
  /** South of this y the city gives way to beach, then water. */
  beachY: 2250,
  waterY: 2460,
};

/** On-foot player. */
export const PLAYER = {
  radius: 14,
  walkSpeed: 230,
  runSpeed: 340,
  accel: 1800,
  maxHealth: 100,
  /** Health regained per second after 8 s without damage. */
  regen: 2.5,
  regenDelay: 8,
  /** How close the player must be to enter a car. */
  // Enter range must exceed the farthest the car-collision push in stepOnFoot can shove the
  // player (a van's half-length + player radius + 2 ≈ 64): any smaller and the player can
  // never stand close enough to a car to enter it.
  enterRange: 76,
  punchRange: 36,
  punchDamage: 12,
  punchArc: 1.1,
  punchCooldown: 0.35,
};

/** Pistol. */
export const PISTOL = {
  damage: 34,
  range: 520,
  cooldown: 0.28,
  bulletSpeed: 900,
  startAmmo: 24,
  pickupAmmo: 24,
  spread: 0.05,
};

/** Car models: how each kind of car drives. */
export const CAR_MODELS = {
  sedan: { length: 64, width: 30, accel: 420, brake: 700, reverse: 200, maxSpeed: 460, grip: 0.9, turn: 2.6, color: '#c94f43' },
  taxi: { length: 64, width: 30, accel: 400, brake: 700, reverse: 200, maxSpeed: 440, grip: 0.9, turn: 2.6, color: '#f2c230' },
  van: { length: 76, width: 32, accel: 300, brake: 600, reverse: 170, maxSpeed: 380, grip: 0.93, turn: 2.1, color: '#7a8ba0' },
  sports: { length: 62, width: 30, accel: 620, brake: 800, reverse: 230, maxSpeed: 640, grip: 0.86, turn: 3.1, color: '#2fb3a6' },
  pickup: { length: 70, width: 32, accel: 380, brake: 650, reverse: 190, maxSpeed: 430, grip: 0.91, turn: 2.4, color: '#4f7ec9' },
  police: { length: 66, width: 30, accel: 560, brake: 800, reverse: 220, maxSpeed: 600, grip: 0.88, turn: 3.0, color: '#20242e' },
};

/** Traffic and pedestrians. */
export const TRAFFIC = {
  cars: 22,
  parked: 16,
  cruiseSpeed: 175,
  cruiseJitter: 45,
  peds: 42,
  pedSpeed: 55,
  pedFleeSpeed: 150,
};

/** Wanted level: heat 0-100 maps to stars; heat decays when the player stays clean. */
export const WANTED = {
  starAt: [15, 35, 55, 75, 90],
  decay: 2.2,
  decayDelay: 5,
  stealCar: 25,
  hitPed: 30,
  killPed: 45,
  shoot: 12,
  hitPolice: 40,
  killPolice: 50,
  /** Police cars per star level, index = stars. */
  policeCars: [0, 1, 2, 3, 4, 5],
  /** Foot police per star level. */
  footPolice: [0, 0, 1, 2, 3, 4],
  spawnRange: 700,
  despawnRange: 1400,
};

/** Money: payouts and penalties. */
export const MONEY = {
  start: 100,
  fareMin: 40,
  fareMax: 90,
  cashPickup: 50,
  bustedLoss: 0.15,
  wastedLoss: 0.1,
  healthPack: 40,
};

/** Pickups and side activity. */
export const PICKUPS = {
  cash: 5,
  health: 3,
  ammo: 3,
  farePeds: 4,
};

/** Where the save lives (this browser only). */
export const SAVE_KEY = 'solmar.save.v1';

export const PALETTE = {
  backdrop: '#1c2430',
  water: '#2fa8b5',
  waterDeep: '#1f7f96',
  sand: '#e8d5a3',
  sandDark: '#d9c184',
  grass: '#7fb069',
  grassDark: '#6a9a58',
  road: '#3d3a38',
  roadEdge: '#57504a',
  laneDash: '#e8e0c8',
  sidewalk: '#b9a98c',
  sidewalkEdge: '#a08e6e',
  crosswalk: '#e8e0c8',
  buildingRoof: ['#e8a87c', '#d9c27a', '#a8c8a0', '#e07a6a', '#8fb8d8', '#c9a0c9', '#f0d0a0', '#9ab8a0'],
  buildingEdge: 'rgba(0, 0, 0, 0.2)',
  tree: '#4e7d46',
  treeTrunk: '#6b4a2f',
  lamp: '#3a3f4a',
  player: '#f2f0e6',
  playerShirt: '#e4572e',
  pedShirt: ['#e4572e', '#4f7ec9', '#f2c230', '#7fb069', '#c94f43', '#8e6fc9', '#2fb3a6', '#e8e0c8'],
  policeShirt: '#20242e',
  policeCar: '#20242e',
  policeLightRed: '#ff3b30',
  policeLightBlue: '#2f7bff',
  marker: '#ffd23f',
  markerRing: '#ffffff',
  hudPanel: 'rgba(16, 20, 28, 0.72)',
  hudText: '#f2f0e6',
  hudMuted: '#b9b4a4',
  hudGood: '#7fd08a',
  hudBad: '#ff6b5e',
  hudGold: '#ffd23f',
  star: '#ffd23f',
  starEmpty: '#5a5f6a',
  health: '#7fd08a',
  healthLow: '#ff6b5e',
  title: '#ffd23f',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
