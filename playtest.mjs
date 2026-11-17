// Playtest driver for Solmar: launches headless Chrome over CDP, loads the game, collects
// console errors and failed requests, drives keys/mouse, and screenshots. Usage:
//   node playtest.mjs <url> <screenshot.png> [--wait <ms>] [--keys W,A,S,D,...] [--eval <js>]
// The game exposes window.__solmar = { world, screen, startNewGame, startContinuedGame }.
import { execFile } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const CHROME = '/opt/meta-chromium/chrome';
const PORT = 9333;

const [url, screenshot, ...rest] = process.argv.slice(2);
if (!url || !screenshot) {
  console.error('usage: node playtest.mjs <url> <screenshot.png> [--wait ms] [--keys K1,K2] [--eval <js>] [--mouse x,y]');
  process.exit(2);
}
let waitMs = 3000;
let keys = [];
let evalJs = null;
let mouse = null;
for (let i = 0; i < rest.length; i += 1) {
  if (rest[i] === '--wait') waitMs = Number(rest[++i]);
  else if (rest[i] === '--keys') keys = rest[++i].split(',');
  else if (rest[i] === '--eval') evalJs = rest[++i];
  else if (rest[i] === '--mouse') mouse = rest[++i].split(',').map(Number);
}

const chrome = execFile(CHROME, [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1280,720',
  '--disable-features=LocalNetworkAccessChecks',
  '--allow-file-access-from-files',
  '--hatch-webgl-allowed-domains-file=/home/hatch/workspace/makefun/gta6-entry/.webgl-policy.txt',
  '--hatch-webgl-allowed-domains-sha256=c5c85869591ff8b3491450f49cfd62912c6dd41e5cecada4e831191d3185035e',
  `--remote-debugging-port=${PORT}`, '--user-data-dir=/home/hatch/workspace/makefun/gta6-entry/.chrome-profile',
  url,
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getTarget() {
  for (let i = 0; i < 50; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const targets = await res.json();
      const page = targets.find((t) => t.type === 'page');
      if (page) return page;
    } catch { /* chrome still starting */ }
    await sleep(200);
  }
  throw new Error('chrome did not start');
}

const target = await getTarget();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve) => ws.addEventListener('open', resolve));

let messageId = 0;
const pending = new Map();
const consoleErrors = [];
const failedRequests = [];
const pageErrors = [];
ws.addEventListener('message', (event) => {
  const data = JSON.parse(event.data);
  if (data.id !== undefined && pending.has(data.id)) {
    pending.get(data.id)(data);
    pending.delete(data.id);
  } else if (data.method === 'Runtime.consoleAPICalled' && (data.params.type === 'error' || data.params.type === 'warning')) {
    consoleErrors.push(data.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
  } else if (data.method === 'Runtime.exceptionThrown') {
    pageErrors.push(data.params.exceptionDetails.exception?.description ?? JSON.stringify(data.params.exceptionDetails));
  } else if (data.method === 'Network.loadingFailed') {
    failedRequests.push(data.params.errorText);
  } else if (data.method === 'Network.responseReceived' && data.params.response.status >= 400) {
    failedRequests.push(`${data.params.response.status} ${data.params.response.url}`);
  }
});

function send(method, params = {}) {
  return new Promise((resolve) => {
    const id = ++messageId;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

await send('Runtime.enable');
await send('Page.enable');
await send('Network.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
await sleep(waitMs);

async function evaluate(expression) {
  const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (res.result?.exceptionDetails) return { error: res.result.exceptionDetails.exception?.description ?? 'eval error' };
  return res.result?.result?.value;
}

const VIRTUAL_KEY_CODES = {
  KeyW: 87, KeyA: 65, KeyS: 83, KeyD: 68, KeyE: 69, KeyF: 70, KeyM: 77, KeyN: 78,
  KeyP: 80, KeyQ: 81, KeyR: 82, Enter: 13, Space: 32, ShiftLeft: 16, ShiftRight: 16,
  Escape: 27, ArrowUp: 38, ArrowDown: 40, ArrowLeft: 37, ArrowRight: 39,
};

async function key(code, keyName, type) {
  await send('Input.dispatchKeyEvent', { type, code, key: keyName, windowsVirtualKeyCode: VIRTUAL_KEY_CODES[code] ?? 0 });
}

async function pressKey(code, keyName) {
  await key(code, keyName, 'keyDown');
  await sleep(60);
  await key(code, keyName, 'keyUp');
}

// Drive the requested keys: "W:1200" holds W for 1200 ms, plain "W" taps it.
for (const spec of keys) {
  const [code, holdMs] = spec.split(':');
  const hold = holdMs ? Number(holdMs) : 120;
  const keyName = code.length === 1 ? code.toLowerCase() : code;
  await key(code, keyName, 'keyDown');
  await sleep(hold);
  await key(code, keyName, 'keyUp');
  await sleep(80);
}
if (mouse) {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: mouse[0], y: mouse[1] });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: mouse[0], y: mouse[1], button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: mouse[0], y: mouse[1], button: 'left', clickCount: 1 });
  await sleep(300);
}

const state = evalJs ? await evaluate(evalJs) : null;
const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 85 });
writeFileSync(screenshot, Buffer.from(shot.result.data, 'base64'));

console.log(JSON.stringify({
  consoleErrors, failedRequests, pageErrors, state,
  shotBytes: Buffer.from(shot.result.data, 'base64').length,
}, null, 2));
chrome.kill('SIGKILL');
process.exit(0);
