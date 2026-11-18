// input.js: Keyboard and pointer input. Held keys give a movement vector; one-shot

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_PUNCH = 8;
export const ACTION_MUTE = 16;
export const ACTION_SHOOT = 32;
export const ACTION_REPAIR = 64;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const ENTER = new Set(['KeyE']);
const PUNCH = new Set(['KeyF']);
const REPAIR = new Set(['KeyG']);
const MUTE = new Set(['KeyM']);
const RUN = new Set(['ShiftLeft', 'ShiftRight']);

export function createInput(canvas) {
  let up = false;
  let down = false;
  let left = false;
  let right = false;
  let run = false;
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;
  let spaceHeld = false;

  function press(event, set) {
    if (set.has(event.code)) return true;
    return false;
  }

  window.addEventListener('keydown', (event) => {
    if (press(event, UP)) up = true;
    else if (press(event, DOWN)) down = true;
    else if (press(event, LEFT)) left = true;
    else if (press(event, RIGHT)) right = true;
    else if (press(event, RUN)) run = true;
    else if (press(event, CONFIRM)) {
      spaceHeld = true;
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (press(event, PAUSE)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (press(event, ENTER)) {
      if (!event.repeat) actions |= ACTION_ENTER;
    } else if (press(event, PUNCH)) {
      if (!event.repeat) actions |= ACTION_PUNCH;
    } else if (press(event, REPAIR)) {
      if (!event.repeat) actions |= ACTION_REPAIR;
    } else if (press(event, MUTE)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (press(event, UP)) up = false;
    else if (press(event, DOWN)) down = false;
    else if (press(event, LEFT)) left = false;
    else if (press(event, RIGHT)) right = false;
    else if (press(event, RUN)) run = false;
    else if (press(event, CONFIRM)) spaceHeld = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    up = false;
    down = false;
    left = false;
    right = false;
    run = false;
    spaceHeld = false;
    mouseDown = false;
  });
  canvas.addEventListener('pointerdown', (event) => {
    mouseDown = true;
    actions |= ACTION_CONFIRM;
    actions |= ACTION_SHOOT;
  });
  canvas.addEventListener('pointerup', () => {
    mouseDown = false;
  });
  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
  });

  return {
    /** Movement vector, normalised: x and y each in -1..1. */
    move() {
      const x = (right ? 1 : 0) - (left ? 1 : 0);
      const y = (down ? 1 : 0) - (up ? 1 : 0);
      if (x === 0 && y === 0) return { x: 0, y: 0 };
      const length = Math.hypot(x, y);
      return { x: x / length, y: y / length };
    },
    running() {
      return run;
    },
    /** Space held: the handbrake while driving. */
    handbrake() {
      return spaceHeld;
    },
    mouse() {
      return { x: mouseX, y: mouseY, down: mouseDown };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
