// main.js: Boot and the one loop: input is read every frame, the world advances i
import { MONEY, STEP, VIEW } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BUSTED, EVENT_WASTED } from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createRenderer, SCREEN_BUSTED, SCREEN_COMPLETE, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_SELECT, SCREEN_TITLE, SCREEN_WASTED } from './render.js';
import { heroCardAt } from './hud.js';
import { HERO_ORDER } from './heroes.js';
import { restartMission } from './missions.js';
import { setMuted, unlockAudio } from './audio.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);

function mouseView(input) {
  const mouse = input.mouse();
  const scale = Math.min(window.innerWidth / VIEW.width, window.innerHeight / VIEW.height);
  const viewX = (window.innerWidth - VIEW.width * scale) / 2;
  const viewY = (window.innerHeight - VIEW.height * scale) / 2;
  return { x: (mouse.x - viewX) / scale, y: (mouse.y - viewY) / scale };
}

function mouseToWorld(input, camera) {
  const v = mouseView(input);
  const zoom = camera.zoom ?? 1;
  return {
    x: camera.x - VIEW.width / (2 * zoom) + v.x / zoom,
    y: camera.y - VIEW.height / (2 * zoom) + v.y / zoom,
  };
}

function mouseToView(input) {
  return mouseView(input);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();
  let completeShown = false;
  let mutedFlag = false;
  let pendingKey = null;
  let lastView = { x: -1, y: -1 };
  /** One-shot actions from a frame that ran no simulation step: handed to the next frame, never lost. */
  let carried = 0;

  window.addEventListener('keydown', (event) => {
    if (!event.repeat) pendingKey = event.code;
  });


  function announce(message) {
    status.textContent = message;
  }

  function startNewGame() {
    world.reset();
    completeShown = false;
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Solmar. Mara Voss has work for you.');
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
      firing: input.firing(),
    };
  }

  function stepPlay(controls) {
    const events = world.step(STEP, controls);
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

  function openHeroSelect() {
    world.ui.heroIndex = Math.max(0, HERO_ORDER.indexOf(world.heroId));
    lastView = mouseToView(input);
    screen = SCREEN_SELECT;
    announce('Choose your hero. Left and right to browse, Enter to confirm.');
  }

  /** The hero select screen: arrows or A/D browse, Enter or a click on the chosen card confirms. */
  function stepSelect(actions) {
    const count = HERO_ORDER.length;
    const ui = world.ui;
    if (pendingKey === 'ArrowLeft' || pendingKey === 'KeyA') ui.heroIndex = (ui.heroIndex + count - 1) % count;
    else if (pendingKey === 'ArrowRight' || pendingKey === 'KeyD') ui.heroIndex = (ui.heroIndex + 1) % count;
    else if (pendingKey === 'Escape') {
      screen = SCREEN_TITLE;
      return;
    }
    const view = mouseToView(input);
    const moved = view.x !== lastView.x || view.y !== lastView.y;
    lastView = view;
    const hovered = heroCardAt(view.x, view.y);
    if (moved && hovered >= 0) ui.heroIndex = hovered;
    const keyConfirm = pendingKey === 'Enter' || pendingKey === 'NumpadEnter' || pendingKey === 'Space';
    const clickConfirm = (actions & ACTION_CONFIRM) !== 0 && !keyConfirm && hovered === ui.heroIndex;
    if (keyConfirm || clickConfirm) {
      world.heroId = HERO_ORDER[ui.heroIndex];
      startNewGame();
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;

    const actions = input.takeActions() | carried;
    carried = 0;
    if (actions & ACTION_MUTE) {
      mutedFlag = !mutedFlag;
      setMuted(mutedFlag);
    }
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) {
        unlockAudio();
        openHeroSelect();
      }
      pendingKey = null;

      accumulator = 0;
    } else if (screen === SCREEN_SELECT) {
      stepSelect(actions);
      pendingKey = null;
      accumulator = 0;
    } else if (screen === SCREEN_PLAY) {
      pendingKey = null;
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

        if (firstStep) carried = actions & ~(ACTION_MUTE | ACTION_PAUSE);
      }
      if (screen === SCREEN_PAUSED) accumulator = 0;
    } else if (screen === SCREEN_PAUSED) {
      accumulator = 0;
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      } else if (pendingKey === 'KeyR') {
        restartMission(world);
        world.message = { text: 'Mission restarted.', timer: 2 };
      } else if (pendingKey === 'KeyQ') {
        screen = SCREEN_TITLE;
        announce('Solmar. Press Enter to start a new game.');
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


  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });


  window.__solmar = {
    world,
    get screen() {
      return screen;
    },
    startNewGame,
  };

  announce('Solmar. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

runGame();
