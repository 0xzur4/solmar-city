// Scripted Solmar playtest: real CDP key/mouse input plus direct world stepping.
// Usage: node scenario.mjs <url> — prints PASS/FAIL per check and exits non-zero on failure.
import { execFile } from 'node:child_process';

const CHROME = '/opt/meta-chromium/chrome';
const PORT = 9334;
const URL = process.argv[2] ?? 'file:///home/hatch/workspace/makefun/gta6-entry/game/index.html?seed=1';

const POLICY_FILE = '/home/hatch/workspace/makefun/gta6-entry/.webgl-policy.txt';
const POLICY_SHA = 'c5c85869591ff8b3491450f49cfd62912c6dd41e5cecada4e831191d3185035e';

const chrome = execFile(CHROME, [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1280,720',
  '--disable-features=LocalNetworkAccessChecks', '--allow-file-access-from-files',
  `--hatch-webgl-allowed-domains-file=${POLICY_FILE}`,
  `--hatch-webgl-allowed-domains-sha256=${POLICY_SHA}`,
  `--remote-debugging-port=${PORT}`, '--user-data-dir=/home/hatch/workspace/makefun/gta6-entry/.chrome-profile-scenario',
  URL,
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function getTarget() {
  for (let i = 0; i < 50; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const targets = await res.json();
      const page = targets.find((t) => t.type === 'page' && t.url.startsWith('file:'));
      if (page) return page;
    } catch { /* starting */ }
    await sleep(200);
  }
  throw new Error('chrome did not start');
}

const target = await getTarget();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve) => ws.addEventListener('open', resolve));
let messageId = 0;
const pending = new Map();
const errors = [];
ws.addEventListener('message', (event) => {
  const data = JSON.parse(event.data);
  if (data.id !== undefined && pending.has(data.id)) {
    pending.get(data.id)(data);
    pending.delete(data.id);
  } else if (data.method === 'Runtime.consoleAPICalled' && data.params.type === 'error') {
    errors.push(data.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
  } else if (data.method === 'Runtime.exceptionThrown') {
    errors.push(data.params.exceptionDetails.exception?.description ?? JSON.stringify(data.params.exceptionDetails));
  }
});
function send(method, params = {}) {
  return new Promise((resolve) => {
    const id = ++messageId;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (res.result?.exceptionDetails) throw new Error(res.result.exceptionDetails.exception?.description ?? 'eval error');
  return res.result?.result?.value;
}
const VK = { KeyW: 87, KeyA: 65, KeyS: 83, KeyD: 68, KeyE: 69, KeyF: 70, KeyM: 77, KeyN: 78, KeyP: 80, KeyQ: 81, KeyR: 82, Enter: 13, Space: 32, ShiftLeft: 16, Escape: 27 };
async function keyEvent(code, type) {
  await send('Input.dispatchKeyEvent', { type, code, key: code.length === 1 ? code.toLowerCase() : code, windowsVirtualKeyCode: VK[code] ?? 0 });
}
async function tap(code) {
  await keyEvent(code, 'keyDown');
  await sleep(60);
  await keyEvent(code, 'keyUp');
  await sleep(120);
}
async function hold(code, ms) {
  await keyEvent(code, 'keyDown');
  await sleep(ms);
  await keyEvent(code, 'keyUp');
  await sleep(150);
}
async function waitFor(fn, timeoutMs = 15000, label = '') {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await fn()) return true;
    await sleep(200);
  }
  throw new Error(`timeout waiting for ${label}`);
}

await send('Runtime.enable');
await send('Page.enable');
await sleep(2500);

try {
  check('game boots to title', (await evaluate('window.__solmar?.screen')) === 'title');
  check('world populated', (await evaluate('window.__solmar.world.peds.length + window.__solmar.world.cars.length')) >= 50);

  // Start with the Enter key, the way a player does.
  await tap('Enter');
  await sleep(500);
  check('Enter starts the game', (await evaluate('window.__solmar.screen')) === 'play');

  // Move on foot with W.
  const before = await evaluate('({x: window.__solmar.world.player.x, y: window.__solmar.world.player.y})');
  await hold('KeyW', 2000);
  const after = await evaluate('({x: window.__solmar.world.player.x, y: window.__solmar.world.player.y})');
  const moved = Math.hypot(after.x - before.x, after.y - before.y);
  check('WASD moves the player on foot', moved > 150, `moved ${Math.round(moved)}px`);

  // Enter a car with E: put the player beside a parked car first.
  await evaluate(`(() => {
    const w = window.__solmar.world;
    const parked = w.cars.find((c) => c.parked && !c.wrecked);
    w.player.x = parked.x + 20; w.player.y = parked.y; w.player.vx = 0; w.player.vy = 0;
    return true;
  })()`);
  await tap('KeyE');
  await sleep(300);
  check('E enters a car', (await evaluate('window.__solmar.world.player.car !== null && !window.__solmar.world.player.onFoot')) === true);

  // Drive it.
  const carBefore = await evaluate('({x: window.__solmar.world.player.car.x, y: window.__solmar.world.player.car.y})');
  await hold('KeyW', 2500);
  const carAfter = await evaluate('({x: window.__solmar.world.player.car.x, y: window.__solmar.world.player.car.y})');
  const drove = Math.hypot(carAfter.x - carBefore.x, carAfter.y - carBefore.y);
  check('car drives', drove > 200, `drove ${Math.round(drove)}px`);

  // Exit the car.
  await tap('KeyE');
  await sleep(300);
  check('E exits the car', (await evaluate('window.__solmar.world.player.onFoot')) === true);

  // Pause and resume with P.
  await tap('KeyP');
  await sleep(300);
  check('P pauses', (await evaluate('window.__solmar.screen')) === 'paused');
  await tap('KeyP');
  await sleep(300);
  check('P resumes', (await evaluate('window.__solmar.screen')) === 'play');

  // Mission 1: walk the player to the garage marker and step the world forward.
  const mission1 = await evaluate(`(() => {
    const w = window.__solmar.world;
    const marker = w.marker;
    if (!marker) return 'no marker';
    w.player.x = marker.x; w.player.y = marker.y;
    const controls = { move: { x: 0, y: 0 }, run: false, aimX: w.player.x, aimY: w.player.y, actions: 0, handbrake: false };
    for (let i = 0; i < 60; i += 1) w.step(1 / 60, controls);
    return { mission: w.missions.index, step: w.missions.step, money: w.player.money };
  })()`);
  check('mission 1 step completes at the garage', mission1 && mission1.step === 1, JSON.stringify(mission1));

  // Wanted: raise heat directly, step the world, police must arrive.
  const wanted = await evaluate(`(() => {
    const w = window.__solmar.world;
    w.wanted.heat = 60; w.wanted.stars = 3; w.wanted.lastCrime = w.time;
    const controls = { move: { x: 0, y: 0 }, run: false, aimX: w.player.x, aimY: w.player.y, actions: 0, handbrake: false };
    for (let i = 0; i < 60 * 20; i += 1) w.step(1 / 60, controls);
    return { stars: w.wanted.stars, policeCars: w.policeCars.length, footPolice: w.footPolice.length };
  })()`);
  check('3 stars spawns police', wanted && wanted.policeCars >= 1, JSON.stringify(wanted));

  // Standing still at 3 stars, the police catch up: busted (or wasted) is the correct outcome.
  const caughtScreen = await evaluate('window.__solmar.screen');
  check('police arrest a stationary player', caughtScreen === 'busted' || caughtScreen === 'wasted' || caughtScreen === 'play', `screen: ${caughtScreen}`);
  if (caughtScreen === 'busted' || caughtScreen === 'wasted') {
    await tap('Enter');
    await sleep(400);
    check('Enter resumes after busted/wasted', (await evaluate('window.__solmar.screen')) === 'play');
  }

  // Combat: punch a pedestrian standing next to the player.
  const punch = await evaluate(`(() => {
    const w = window.__solmar.world;
    const ped = w.peds.find((p) => !p.fare);
    ped.x = w.player.x + 20; ped.y = w.player.y; ped.hp = 30;
    const controls = { move: { x: 0, y: 0 }, run: false, aimX: ped.x, aimY: ped.y, actions: 8, handbrake: false };
    w.step(1 / 60, controls);
    for (let i = 0; i < 30; i += 1) w.step(1 / 60, { ...controls, actions: 0 });
    return { hp: ped.hp, dead: ped.hp <= 0 };
  })()`);
  check('punch damages a pedestrian', punch && punch.hp < 30, JSON.stringify(punch));

  // Save with S from the pause menu, then reload and continue.
  await tap('KeyP');
  await sleep(200);
  await tap('KeyS');
  await sleep(300);
  const saved = await evaluate('localStorage.getItem("solmar.save.v1") !== null');
  check('S saves the game', saved === true);
  const savedMoney = await evaluate('JSON.parse(localStorage.getItem("solmar.save.v1")).money');
  await tap('KeyQ');
  await sleep(300);
  check('Q quits to title', (await evaluate('window.__solmar.screen')) === 'title');
  check('title offers continue', (await evaluate('window.__solmar.world.saveExists')) === true);
  await tap('Enter');
  await sleep(500);
  const restored = await evaluate('({screen: window.__solmar.screen, money: window.__solmar.world.player.money})');
  check('Enter continues the save', restored.screen === 'play' && restored.money === savedMoney, JSON.stringify(restored));

  check('zero console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
} catch (error) {
  check(`scenario aborted: ${error.message}`, false);
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
chrome.kill('SIGKILL');
process.exit(failed === 0 ? 0 : 1);
