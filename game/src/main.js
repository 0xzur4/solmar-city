// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s steps
// (several in a slow frame, none in a fast one), and the renderer paints what is there. The game
// moves between six screens: title, play, paused, busted, wasted and complete.
//
// ?seed=N fixes the city's layout. ?shot=chase|foot|drive|mission (with &seed=N) stages that
// scene instead of running the loop, paints it twice and sets window.__shotReady for a
// screenshot. window.__solmar exposes the world for automated playtests.
import { MONEY, STEP, VIEW } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BUSTED, EVENT_MISSION, EVENT_WASTED } from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createRenderer, SCREEN_BUSTED, SCREEN_COMPLETE, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WASTED } from './render.js';
import { stageShot } from './shots.js';
import { clearSave, hasSave, loadSave, saveGame } from './save.js';
import { restartMission } from './missions.js';
import { setMuted, unlockAudio } from './audio.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
world.saveExists = hasSave();

/** The mouse position in world coordinates, from the pointer's CSS position. */
function mouseToWorld(input, camera) {
  const mouse = input.mouse();
  const scale = Math.min(window.innerWidth / VIEW.width, window.innerHeight / VIEW.height);
  const viewX = (window.innerWidth - VIEW.width * scale) / 2;
  const viewY = (window.innerHeight - VIEW.height * scale) / 2;
  const viewMouseX = (mouse.x - viewX) / scale;
  const viewMouseY = (mouse.y - viewY) / scale;
  return {
    x: camera.x - VIEW.width / 2 + viewMouseX,
    y: camera.y - VIEW.height / 2 + viewMouseY,
  };
}

function runShot(name) {
  const scene = stageShot(name, world);
  // A handle for automated playtests, the same shape as the game's.
  window.__solmar = {
    world,
    get screen() {
      return scene.screen;
    },
  };
  // A screenshot is a still frame, not a session: no status line, no early-game hint,
  // no transient message banner.
  status.style.display = 'none';
  world.time = Math.max(world.time, 30);
  world.message = { text: '', timer: 0 };
  let painted = 0;
  function paint() {
    renderer.draw(world, scene.screen);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();
  let completeShown = false;
  let mutedFlag = false;
  let pendingKey = null;

  window.addEventListener('keydown', (event) => {
    if (!event.repeat) pendingKey = event.code;
  });

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function startNewGame() {
    clearSave();
    world.reset();
    world.saveExists = false;
    completeShown = false;
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Solmar. Mara Voss has work for you.');
  }

  function startContinuedGame() {
    const data = loadSave();
    if (data === null) {
      startNewGame();
      return;
    }
    world.applySave(data);
    completeShown = world.missions.done;
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Welcome back to Solmar.');
  }

  function buildControls(actions) {
    const aim = mouseToWorld(input, world.camera);
    return {
      move: input.move(),
      run: input.running(),
      aimX: aim.x,
      aimY: aim.y,
      actions,
      handbrake: input.handbrake(),
    };
  }

  function stepPlay(controls) {
    const events = world.step(STEP, controls);
    if (events & EVENT_MISSION) {
      saveGame(world);
    }
    if (events & EVENT_BUSTED) {
      world.respawn('policeStation', MONEY.bustedLoss);
      screen = SCREEN_BUSTED;
      announce('Busted by the Solmar PD.');
    } else if (events & EVENT_WASTED) {
      world.respawn('hospital', MONEY.wastedLoss);
      screen = SCREEN_WASTED;
      announce('Wasted. You woke up at Solmar General.');
    } else if (world.missions.done && !completeShown) {
      completeShown = true;
      screen = SCREEN_COMPLETE;
      announce('King of Solmar.');
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    // One-shot actions are taken once per frame and handed to the first world step.
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      mutedFlag = !mutedFlag;
      setMuted(mutedFlag);
    }
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) {
        unlockAudio();
        if (world.saveExists) startContinuedGame();
        else startNewGame();
      } else if (pendingKey === 'KeyN') {
        unlockAudio();
        startNewGame();
      }
      pendingKey = null;
      // The title screen's backdrop is the living city.
      while (accumulator >= STEP) {
        world.attract(STEP);
        accumulator -= STEP;
      }
    } else if (screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else {
        let firstStep = true;
        while (accumulator >= STEP) {
          stepPlay(buildControls(firstStep ? actions : 0));
          firstStep = false;
          accumulator -= STEP;
          if (screen !== SCREEN_PLAY) break;
        }
      }
      if (screen === SCREEN_PAUSED) accumulator = 0;
    } else if (screen === SCREEN_PAUSED) {
      accumulator = 0;
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      } else if (pendingKey === 'KeyS') {
        if (saveGame(world)) world.message = { text: 'Game saved.', timer: 2 };
      } else if (pendingKey === 'KeyR') {
        restartMission(world);
        world.message = { text: 'Mission restarted.', timer: 2 };
      } else if (pendingKey === 'KeyQ') {
        saveGame(world);
        world.saveExists = hasSave();
        screen = SCREEN_TITLE;
        announce('Solmar. Press Enter to continue.');
      }
      pendingKey = null;
    } else if (screen === SCREEN_BUSTED || screen === SCREEN_WASTED || screen === SCREEN_COMPLETE) {
      accumulator = 0;
      if (actions & ACTION_CONFIRM) {
        screen = SCREEN_PLAY;
        announce('Back on the streets of Solmar.');
      }
    }
    renderer.draw(world, screen);
  }

  // Leaving the tab pauses a running game rather than letting the city move unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  // A handle for automated playtests: state, screens and a way to read the world.
  window.__solmar = {
    world,
    get screen() {
      return screen;
    },
    startNewGame,
    startContinuedGame,
  };

  announce('Solmar. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
