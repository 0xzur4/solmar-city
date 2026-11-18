// missions.js: The story of Solmar: eleven chained jobs for the fixer Mara Voss, from
import { CITY } from './config.js';
import { createCar } from './vehicles.js';
import { addHeat } from './police.js';
import { playMissionDone } from './audio.js';

export const MISSIONS = [
  {
    name: 'First Fare',
    intro: 'Mara Voss needs a driver. Meet her at the garage, then pick up at the marina.',
    reward: 250,
    steps: [
      { type: 'goto', text: 'Meet Mara at the garage', place: 'garage', radius: 90 },
      { type: 'goto', text: 'Drive to the marina pickup', place: 'marina', radius: 90 },
    ],
  },
  {
    name: 'Hot Wheels',
    intro: 'A Comet GT sits at Costa Motors. Take it quietly and bring it to the garage.',
    reward: 500,
    steps: [
      { type: 'steal', text: 'Steal the Comet GT at Costa Motors', place: 'dealership', radius: 70 },
      { type: 'deliver', text: 'Deliver the Comet GT to the garage', place: 'garage', radius: 90 },
    ],
  },
  {
    name: 'The Drop',
    intro: 'A package for the park contact. Get it there unseen — if the PD spots you, the deal is off.',
    reward: 600,
    steps: [
      { type: 'stealth', text: 'Deliver the package unseen — stay clean', place: 'park', radius: 80 },
      { type: 'goto', text: 'Lose the heat — reach the safehouse', place: 'safehouse', radius: 90 },
    ],
  },
  {
    name: 'Getaway',
    intro: 'Pick up the crew at the bank. The alarm is ringing — get them out and lose the cops.',
    reward: 800,
    steps: [
      { type: 'goto', text: 'Pick up the crew at the bank', place: 'bank', radius: 80 },
      { type: 'survive', text: 'Survive the chase — 25 seconds', seconds: 25, wanted: 3 },
      { type: 'goto', text: 'Reach the safehouse', place: 'safehouse', radius: 90 },
    ],
  },
  {
    name: 'The Marina Job',
    intro: 'Hold the marina warehouse while the crew works. The PD is coming.',
    reward: 1200,
    steps: [
      { type: 'goto', text: 'Get to the marina warehouse', place: 'marina', radius: 90 },
      { type: 'hold', text: 'Hold the warehouse — 15 seconds', seconds: 15, wanted: 3, place: 'marina' },
      { type: 'goto', text: 'Escape to the garage', place: 'garage', radius: 90 },
    ],
  },
  {
    name: 'The Informant',
    intro: 'An informant waits at the plaza with names for Mara. Get him to the safehouse — the PD wants him too.',
    reward: 900,
    steps: [
      { type: 'goto', text: 'Pick up the informant at the plaza', place: 'plaza', radius: 80 },
      { type: 'timed', text: 'Get him to the safehouse — 60 seconds', place: 'safehouse', radius: 90, seconds: 60, wanted: 2 },
    ],
  },
  {
    name: 'Bank Run',
    intro: 'The crew is inside the bank. Hold the doors while they empty the vault, then run.',
    reward: 1500,
    steps: [
      { type: 'goto', text: 'Get to the bank', place: 'bank', radius: 80 },
      { type: 'hold', text: 'Hold the bank doors — 15 seconds', seconds: 15, wanted: 3, place: 'bank' },
      { type: 'goto', text: 'Escape to the marina', place: 'marina', radius: 90 },
    ],
  },
  {
    name: 'The Racer',
    intro: 'A midnight street race: dealership, bank, plaza, marina. Beat the clock.',
    reward: 1400,
    steps: [
      { type: 'race', text: 'Race the checkpoints — beat the clock', seconds: 80, checkpoints: [
        { place: 'dealership', radius: 70 },
        { place: 'bank', radius: 70 },
        { place: 'plaza', radius: 70 },
        { place: 'marina', radius: 90 },
      ] },
    ],
  },
  {
    name: 'The Convoy',
    intro: 'Vince Kroll moves his money in an armoured truck. Run it off the road, bring the cash to Mara.',
    reward: 1800,
    steps: [
      { type: 'chase', text: 'Disable the armoured truck', place: 'streets', radius: 0, model: 'truck' },
      { type: 'goto', text: 'Bring the cash to Mara at the garage', place: 'garage', radius: 90 },
    ],
  },
  {
    name: 'Payback',
    intro: 'Two of Vince’s muscle cars cruise the beach road. Wreck them both.',
    reward: 1700,
    steps: [
      { type: 'destroy', text: 'Wreck both muscle cars', place: 'streets', radius: 0, model: 'muscle', count: 2 },
      { type: 'goto', text: 'Report back to Mara at the garage', place: 'garage', radius: 90 },
    ],
  },
  {
    name: 'King of Solmar',
    intro: 'Vince Kroll is running with the take. Run his car off the road and bring it home.',
    reward: 2000,
    steps: [
      { type: 'chase', text: 'Disable Vince Kroll’s car', place: 'streets', radius: 0 },
      { type: 'goto', text: 'Bring the take to Mara at the garage', place: 'garage', radius: 90 },
    ],
  },
];

/** Resolve a step's named place to a world point. */
export function placePoint(city, place) {
  if (place === 'park') return { x: city.park.x + city.park.w / 2, y: city.park.y + city.park.h / 2 };
  if (place === 'plaza') return { x: city.plaza.x + city.plaza.w / 2, y: city.plaza.y + city.plaza.h / 2 };
  const at = city[place];
  return at !== undefined ? { x: at.x, y: at.y } : { x: city.spawn.x, y: city.spawn.y };
}

export function createMissionState() {
  return {
    index: 0,
    step: 0,
    timer: 0,
    targetCar: null,
    targets: [],
    checkpoint: 0,
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
  if (step.type === 'destroy') {
    const live = w.missions.targets.find((car) => !car.wrecked && car.health > 25);
    if (live !== undefined) return { x: live.x, y: live.y, label: 'Muscle car' };
    return null;
  }
  if (step.type === 'race') {
    const point = step.checkpoints[w.missions.checkpoint];
    if (point === undefined) return null;
    const at = placePoint(w.city, point.place);
    return { x: at.x, y: at.y, label: `Checkpoint ${w.missions.checkpoint + 1}/${step.checkpoints.length}` };
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
  state.checkpoint = 0;
  if (step.wanted !== undefined) {

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
    const car = createCar(step.model ?? 'sports', point.x + 600, point.y + 120, Math.PI, {
      traffic: true,
      driver: true,
      cruise: step.model === 'truck' ? 300 : 420,
      color: step.model === 'truck' ? '#5a4a35' : '#8e2f2f',
    });
    w.cars.push(car);
    state.targetCar = car;
  }
  if (step.type === 'destroy') {
    state.targets = [];
    for (let i = 0; i < (step.count ?? 2); i += 1) {
      const point = placePoint(w.city, 'streets');
      const car = createCar(step.model ?? 'muscle', point.x + 500 + i * 220, point.y - 160 + i * 320, Math.PI, {
        traffic: true,
        driver: true,
        cruise: 400,
        color: '#8e2f2f',
      });
      w.cars.push(car);
      state.targets.push(car);
    }
  }
  w.message = { text: step.text, timer: 3 };
}

function finishStep(w) {
  const state = w.missions;
  state.step += 1;
  state.targetCar = null;
  state.targets = [];
  const mission = currentMission(state);
  if (mission !== null && state.step >= mission.steps.length) {

    w.player.money += mission.reward;
    w.stats.earned += mission.reward;
    w.effects.addFloater(w.player.x, w.player.y - 30, `+$${mission.reward}`, '#ffd23f');
    w.message = { text: `${mission.name} complete — +$${mission.reward}`, timer: 4 };
    w.missionCard = { title: `${mission.name} complete`, sub: `+$${mission.reward} — next job from Mara`, timer: 3.5 };
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
    w.missionCard = { title: mission.name, sub: mission.intro, timer: 4 };
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
  } else if (step.type === 'timed') {
    state.timer += dt;
    if (state.timer >= step.seconds) {
      w.message = { text: 'Too slow — the job is blown. Try again.', timer: 4 };
      restartMission(w);
      return false;
    }
    const point = placePoint(w.city, step.place);
    if (Math.hypot(point.x - pos.x, point.y - pos.y) < step.radius) {
      finishStep(w);
      return true;
    }
  } else if (step.type === 'stealth') {
    if (w.wanted.stars > 0) {
      w.message = { text: 'Spotted — the deal is off. Try again.', timer: 4 };
      restartMission(w);
      return false;
    }
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
    const point = placePoint(w.city, step.place);
    if (Math.hypot(point.x - pos.x, point.y - pos.y) < 160) {
      state.timer += dt;
      if (state.timer >= step.seconds) {
        finishStep(w);
        return true;
      }
    }
  } else if (step.type === 'race') {
    state.timer += dt;
    if (state.timer >= step.seconds) {

      w.message = { text: 'Too slow — the race is lost. Try again.', timer: 4 };
      restartMission(w);
      return false;
    }
    const point = step.checkpoints[state.checkpoint];
    if (point !== undefined) {
      const at = placePoint(w.city, point.place);
      if (Math.hypot(at.x - pos.x, at.y - pos.y) < point.radius) {
        state.checkpoint += 1;
        w.effects.addFloater(pos.x, pos.y - 30, `Checkpoint ${state.checkpoint}/${step.checkpoints.length}`, '#ffd23f');
        if (state.checkpoint >= step.checkpoints.length) {
          finishStep(w);
          return true;
        }
      }
    }
  } else if (step.type === 'destroy') {
    const live = state.targets.filter((car) => !car.wrecked && car.health > 25);
    if (state.targets.length > 0 && live.length === 0) {
      finishStep(w);
      return true;
    }

    if (w.player.car !== null) {
      for (const car of live) {
        const d = Math.hypot(car.x - w.player.car.x, car.y - w.player.car.y);
        if (d < 80 && Math.hypot(w.player.car.vx, w.player.car.vy) > 300) {
          car.health -= 60 * dt;
        }
      }
    }
  } else if (step.type === 'chase') {
    const car = state.targetCar;
    if (car !== null) {

      car.cruise = car.model === 'truck' ? 300 : 430;
      if (car.wrecked || car.health <= 25) {
        finishStep(w);
        return true;
      }

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

  if (state.targetCar !== null && w.player.car !== state.targetCar) {
    w.cars = w.cars.filter((car) => car !== state.targetCar);
  }
  if (state.targets.length > 0) {
    const targets = new Set(state.targets);
    w.cars = w.cars.filter((car) => !targets.has(car) || w.player.car === car);
  }
  state.step = 0;
  state.timer = 0;
  state.targetCar = null;
  state.targets = [];
  state.checkpoint = 0;
  state.started = false;
  const step = currentStep(state);
  if (step !== null) startStep(w, step);
}
