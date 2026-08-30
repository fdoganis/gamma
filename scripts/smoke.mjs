// Dependency-free smoke check: boot the dev server, open ?run in headless Chrome
// over CDP, and assert the app loads clean and actually renders + animates.
// Run before pushing:  npm run smoke
//
// Chrome is found via $CHROME_PATH or a few well-known locations. No npm deps.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

const PORT = 5179;
const URL = `http://localhost:${PORT}/?run`;
const CDP_PORT = 9411;

const CHROME =
  process.env.CHROME_PATH ||
  [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser'
  ].find(existsSync);

if (!CHROME) {
  console.error('smoke: no Chrome found. Set CHROME_PATH.');
  process.exit(2);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const kids = [];
const cleanup = () => kids.forEach((p) => { try { p.kill('SIGKILL'); } catch {} });
process.on('exit', cleanup);

function fail(msg) {
  console.error(`smoke: FAIL — ${msg}`);
  cleanup();
  process.exit(1);
}

// --- boot the dev server ---
const vite = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
kids.push(vite);
for (let i = 0; i < 60; i++) {
  try { if ((await fetch(`http://localhost:${PORT}/`)).ok) break; } catch {}
  await sleep(500);
  if (i === 59) fail('dev server did not start');
}

// --- headless Chrome + CDP ---
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${CDP_PORT}`, '--no-sandbox',
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--window-size=1000,760', URL
], { stdio: 'ignore' });
kids.push(chrome);

let target;
for (let i = 0; i < 60; i++) {
  try {
    const list = await (await fetch(`http://localhost:${CDP_PORT}/json/list`)).json();
    target = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
    if (target) break;
  } catch {}
  await sleep(250);
  if (i === 59) fail('Chrome DevTools did not come up');
}

const ws = new WebSocket(target.webSocketDebuggerUrl);
let msgId = 0;
const pending = new Map();
const problems = [];
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') {
    const d = m.params.exceptionDetails;
    problems.push(`exception: ${d.exception?.description || d.text}`);
  }
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
    problems.push(`console.error: ${m.params.args.map((a) => a.value ?? a.description).join(' ')}`);
  }
};
const send = (method, params = {}) =>
  new Promise((res) => { const id = ++msgId; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); });

await new Promise((r) => (ws.onopen = r));
await send('Runtime.enable');
await send('Page.enable');
await sleep(2000); // let it boot + render a few frames

const shot = async () => (await send('Page.captureScreenshot', { format: 'png' })).data;
const evalJs = async (expr) =>
  (await send('Runtime.evaluate', { expression: expr, returnByValue: true })).result?.value;

// --- assertions ---
const canvasSize = await evalJs(
  "(() => { const c = document.querySelector('canvas'); return c ? [c.width, c.height] : null; })()"
);
if (!canvasSize) fail('no <canvas> in the page');
if (!(canvasSize[0] > 0 && canvasSize[1] > 0)) fail(`canvas has zero size (${canvasSize})`);

const a = await shot();
await sleep(2000);
const b = await shot();
if (a === b) fail('canvas did not change over 2s — nothing is animating');

if (problems.length) fail(`page reported errors:\n  ${problems.join('\n  ')}`);

console.log(`smoke: OK — canvas ${canvasSize[0]}x${canvasSize[1]}, renders + animates, no errors`);
cleanup();
process.exit(0);
