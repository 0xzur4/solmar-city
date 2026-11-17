// The story of Solmar: six chained jobs for the fixer Mara Voss, from a first fare to the
// takedown of the rival Vince Kroll. Each mission is a list of steps; a step is done when
// the player reaches its marker, steals its car, survives its timer, or disables its target.
// A step's marker is what the HUD, the minimap and the world beacon all point at.
import { CITY } from './config.js';
import { createCar } from './vehicles.js';
import { addHeat } from './police.js';
import { playMissionDone } from './audio.js';

export const MISSIONS = [
  {
    name: 'First Fare',
    intro: 'Mara Voss needs a driver she can trust. Meet her at the garage, then run a pickup at the marina.',
    reward: 250,
    steps: [
      { type: 'goto', text: 'Meet Mara at the garage', x: null, y: null, place: 'garage', radius: 90 },
      { type: 'goto', text: 'Drive to the marina pickup', x: null, y: null, place: 'marina', radius: 90 },
    ],
  },
  {
    name: 'Hot Wheels',
    intro: 'A Comet GT is sitting at Costa Motors. Take it — quietly if you can — and bring it to the garage.',
    reward: 500,
    steps: [
      { type: 'steal', text: 'Steal the Comet GT at Costa Motors', x: null, y: null, place: 'dealership', radius: 70 },
      { type: 'deliver', text: 'Deliver the Comet GT to the garage', x: null, y: null, place: 'garage', radius: 90 },
    ],
  },
  {
    name: 'The Drop',
    intro: 'A package for the park contact. The PD is watching — they will come for you. Stay on foot, stay calm.',
    reward: 600,
    steps: [
      { type: 'goto', text: 'Deliver the package to the park contact', x: null, y: null, place: 'park', radius: 80, wanted: 2 },
      { type: 'goto', text: 'Lose the heat — reach the safehouse', x: null, y: null, place: 'safehouse', radius: 90 },
    ],
  },
  {
    name: 'Getaway',
    intro: 'Pick up the crew at the bank. The alarm is already ringing — get them out and lose the cops.',
    reward: 800,
    steps: [
      { type: 'goto', text: 'Pick up the crew at the bank', x: null, y: null, place: 'bank', radius: 80 },
      { type: 'survive', text: 'Survive the chase — 25 seconds', seconds: 25, wanted: 3 },
      { type: 'goto', text: 'Reach the safehouse', x: null, y: null, place: 'safehouse', radius: 90 },
    ],
  },
  {
    name: 'The Marina Job',
    intro: 'Hold the marina warehouse while the crew works. The PD will send everything they have.',
    reward: 1200,
    steps: [
      { type: 'goto', text: 'Get to the marina warehouse', x: null, y: null, place: 'marina', radius: 90 },
      { type: 'hold', text: 'Hold the warehouse — 20 seconds', seconds: 20, wanted: 3, place: 'marina' },
      { type: 'goto', text: 'Escape to the garage', x: null, y: null, place: 'garage', radius: 90 },
    ],
  },
  {
    name: 'King of Solmar',
    intro: 'Vince Kroll is running with the take. Run his car off the road, then bring the money home to Mara.',
    reward: 2000,
    steps: [
      { type: 'chase', text: 'Disable Vince Kroll’s car', x: null, y: null, place: 'streets', radius: 0 },
      { type: 'goto', text: 'Bring the take to Mara at the garage', x: null, y: null, place: 'garage', radius: 90 },
    ],
  },
];

/** Resolve a step's named place to a world point. */
export function placePoint(city, place) {
  if (place === 'garage') return { x: city.garage.x, y: city.garage.y };
  if (place === 'marina') return { x: city.marina.x, y: city.marina.y };
  if (place === 'dealership') return { x: city.dealership.x, y: city.dealership.y };
  if (place === 'park') return { x: city.park.x + city.park.w / 2, y: city.park.y + city.park.h / 2 };
  if (place === 'safehouse') return { x: city.safehouse.x, y: city.safehouse.y };
  if (place === 'bank') return { x: city.bank.x, y: city.bank.y };
  if (place === 'hospital') return { x: city.hospital.x, y: city.hospital.y };
  if (place === 'policeStation') return { x: city.policeStation.x, y: city.policeStation.y };
  return { x: city.spawn.x, y: city.spawn.y };
}

export function createMissionState() {
  return {
    index: 0,
    step: 0,
    timer: 0,
    targetCar: null,
    started: false,
    done: false,
  };
}

/** The mission and step the player is on now. */
export function currentMission(missions) {
  if (missions.index >= MISSIONS.length) return null;
  return MISSIONS[missions.index];
}

export function currentStep(missions) {
  const mission = currentMission(missions);
  if (mission === null) return null;
  return mission.steps[missions.step] ?? null;
}

/** The world point the current step points at, for the HUD, minimap and beacon. */
export function stepMarker(w) {
  const step = currentStep(w.missions);
  if (step === null) return null;
  if (step.type === 'chase' && w.missions.targetCar !== null) {
    return { x: w.missions.targetCar.x, y: w.missions.targetCar.y, label: 'Vince Kroll' };
  }
  if (step.type === 'steal' && w.missions.targetCar !== null) {
    return { x: w.missions.targetCar.x, y: w.missions.targetCar.y, label: 'Comet GT' };
  }
  if (step.place) {
    const point = placePoint(w.city, step.place);
    return { x: point.x, y: point.y, label: step.text };
  }
  return null;
}

function startStep(w, step) {
  const state = w.missions;
  state.timer = 0;
  if (step.wanted !== undefined) {
    // The job starts hot: set the wanted level straight to the named stars.
    const thresholds = [15, 35, 55, 75, 90];
    w.wanted.heat = thresholds[step.wanted - 1] + 5;
    w.wanted.stars = step.wanted;
    w.wanted.lastCrime = w.time;
  }
  if (step.type === 'steal') {
    const point = placePoint(w.city, 'dealership');
    const car = createCar('sports', point.x + 40, point.y, 0, { parked: true, color: '#e8b13c' });
    w.cars.push(car);
    state.targetCar = car;
  }
  if (step.type === 'chase') {
    const point = placePoint(w.city, 'streets');
    const car = createCar('sports', point.x + 600, point.y + 120, Math.PI, {
      traffic: true,
      driver: true,
      cruise: 420,
      color: '#8e2f2f',
    });
    w.cars.push(car);
    state.targetCar = car;
  }
  w.message = { text: step.text, timer: 3 };
}

function finishStep(w) {
  const state = w.missions;
  state.step += 1;
  state.targetCar = null;
  const mission = currentMission(state);
  if (mission !== null && state.step >= mission.steps.length) {
    // Mission complete: pay out and move to the next job.
    w.player.money += mission.reward;
    w.stats.earned += mission.reward;
    w.effects.addFloater(w.player.x, w.player.y - 30, `+$${mission.reward}`, '#ffd23f');
    w.message = { text: `${mission.name} complete — +$${mission.reward}`, timer: 4 };
    playMissionDone();
    state.index += 1;
    state.step = 0;
    if (state.index >= MISSIONS.length) {
      state.done = true;
      w.message = { text: 'KING OF SOLMAR — you run this city now.', timer: 8 };
    }
  }
  const next = currentStep(state);
  if (next !== null) startStep(w, next);
}

function playerPosition(w) {
  const player = w.player;
  if (player.car !== null) return { x: player.car.x, y: player.car.y };
  return { x: player.x, y: player.y };
}

/** Advance the mission state machine one step. Returns true when a step finished. */
export function updateMissions(w, dt) {
  const state = w.missions;
  if (state.done) return false;
  const mission = currentMission(state);
  if (mission === null) return false;
  const step = currentStep(state);
  if (step === null) return false;
  if (!state.started) {
    state.started = true;
    w.message = { text: `${mission.name}: ${mission.intro}`, timer: 5 };
    startStep(w, step);
    return false;
  }
  const pos = playerPosition(w);
  if (step.type === 'goto' || step.type === 'deliver') {
    const point = placePoint(w.city, step.place);
    if (Math.hypot(point.x - pos.x, point.y - pos.y) < step.radius) {
      finishStep(w);
      return true;
    }
  } else if (step.type === 'steal') {
    const car = state.targetCar;
    if (car !== null && w.player.car === car) {
      finishStep(w);
      return true;
    }
  } else if (step.type === 'survive') {
    state.timer += dt;
    if (state.timer >= step.seconds) {
      finishStep(w);
      return true;
    }
  } else if (step.type === 'hold') {
    const point = placePoint(w.city, 'marina');
    if (Math.hypot(point.x - pos.x, point.y - pos.y) < 160) {
      state.timer += dt;
      if (state.timer >= step.seconds) {
        finishStep(w);
        return true;
      }
    }
  } else if (step.type === 'chase') {
    const car = state.targetCar;
    if (car !== null) {
      // The rival flees: keep his cruise high and his route random.
      car.cruise = 430;
      if (car.wrecked || car.health <= 25) {
        finishStep(w);
        return true;
      }
      // If the player rams him hard, he takes damage too.
      if (w.player.car !== null) {
        const d = Math.hypot(car.x - w.player.car.x, car.y - w.player.car.y);
        if (d < 70 && Math.hypot(w.player.car.vx, w.player.car.vy) > 300) {
          car.health -= 60 * dt;
          if (car.health <= 25) {
            finishStep(w);
            return true;
          }
        }
      }
    }
  }
  return false;
}

/** Restart the current mission from its first step (after a bust or a waste). */
export function restartMission(w) {
  const state = w.missions;
  // Take the old target car off the street so restarts do not pile them up.
  if (state.targetCar !== null && w.player.car !== state.targetCar) {
    w.cars = w.cars.filter((car) => car !== state.targetCar);
  }
  state.step = 0;
  state.timer = 0;
  state.targetCar = null;
  state.started = false;
  const step = currentStep(state);
  if (step !== null) startStep(w, step);
}
