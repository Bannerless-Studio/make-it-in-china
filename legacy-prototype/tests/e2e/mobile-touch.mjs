import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const shotDir = resolve(root, 'docs/screenshots');
const BASE_URL = process.env.BASE_URL ?? 'http://localhost:4174';

let chromium;
let devices;
try {
  ({ chromium, devices } = await import('playwright'));
} catch {
  console.error('FAIL  playwright_import  (add playwright as a devDependency and run npx playwright install chromium)');
  process.exit(1);
}

const results = [];

function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`);
}

async function shot(page, name) {
  await page.screenshot({ path: resolve(shotDir, `mobile-${name}.png`), fullPage: false });
}

async function boxCenter(locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('missing bounding box');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2, box };
}

async function touchDrag(cdp, start, end, steps = 10, holdMs = 80) {
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ id: 1, x: start.x, y: start.y }],
  });
  for (let step = 1; step <= steps; step += 1) {
    const t = step / steps;
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{
        id: 1,
        x: start.x + (end.x - start.x) * t,
        y: start.y + (end.y - start.y) * t,
      }],
    });
    await new Promise(resolve => setTimeout(resolve, holdMs));
  }
}

async function touchEnd(cdp) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

async function waitReady(page) {
  await page.waitForSelector('#joystick-base', { state: 'visible' });
  await page.waitForSelector('#loading', { state: 'detached' });
  await page.waitForFunction(() => {
    const pose = window.__debug?.position?.();
    return Boolean(pose) && (Math.abs(pose[0]) + Math.abs(pose[2]) > 1);
  });
}

const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
const context = await browser.newContext({
  ...devices['Pixel 7'],
  hasTouch: true,
  isMobile: true,
});
const page = await context.newPage();
page.setDefaultTimeout(60_000);
const cdp = await context.newCDPSession(page);
const opusUrls = [];
page.on('request', request => {
  if (/\.opus(?:\?|$)/i.test(request.url())) opusUrls.push(request.url());
});

await mkdir(shotDir, { recursive: true });
let failed = false;

try {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await shot(page, 'title');
  await page.getByRole('button', { name: 'New game', exact: true }).tap();
  await waitReady(page);
  await page.waitForTimeout(600);
  record('new_game', true);
  await shot(page, 'controls');

  const controlsVisible = await page.locator('#touch-controls').evaluate(el => {
    const style = getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden';
  });
  record('touch_controls_visible', controlsVisible);

  await page.evaluate(() => window.__debug.teleport(-18, -5));
  await page.waitForTimeout(200);
  const walkBefore = await page.evaluate(() => window.__debug.position());
  const stick = await boxCenter(page.locator('#joystick-base'));
  await touchDrag(cdp, stick, { x: stick.x, y: stick.y - 48 }, 8, 90);
  await page.waitForTimeout(800);
  const walkAfter = await page.evaluate(() => window.__debug.position());
  await touchEnd(cdp);
  const walkDist = Math.hypot(walkAfter[0] - walkBefore[0], walkAfter[2] - walkBefore[2]);
  record('joystick_move', walkDist > 0.8, `${walkDist.toFixed(2)}m`);
  await shot(page, 'joystick');

  await page.evaluate(() => window.__debug.teleport(-18, -5));
  await page.waitForTimeout(200);
  const runBefore = await page.evaluate(() => window.__debug.position());
  const run = await boxCenter(page.locator('#touch-run'));
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      { id: 1, x: stick.x, y: stick.y },
      { id: 2, x: run.x, y: run.y },
    ],
  });
  for (let step = 1; step <= 8; step += 1) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        { id: 1, x: stick.x, y: stick.y - step * 6 },
        { id: 2, x: run.x, y: run.y },
      ],
    });
    await page.waitForTimeout(90);
  }
  await page.waitForTimeout(800);
  const runAfter = await page.evaluate(() => window.__debug.position());
  await touchEnd(cdp);
  const runDist = Math.hypot(runAfter[0] - runBefore[0], runAfter[2] - runBefore[2]);
  record('run_plus_joystick', runDist > walkDist * 1.15, `walk ${walkDist.toFixed(2)}m run ${runDist.toFixed(2)}m`);

  const yawBefore = await page.evaluate(() => window.__debug.yaw());
  const view = page.viewportSize();
  const origin = { x: (view?.width ?? 412) * 0.55, y: (view?.height ?? 915) * 0.42 };
  await touchDrag(cdp, origin, { x: origin.x + 120, y: origin.y }, 12, 40);
  await page.waitForTimeout(200);
  const yawAfter = await page.evaluate(() => window.__debug.yaw());
  await touchEnd(cdp);
  const yawDelta = Math.abs(yawAfter - yawBefore);
  record('single_finger_orbit', yawDelta > 0.08, `Δyaw ${yawDelta.toFixed(3)} rad`);
  await shot(page, 'orbit');

  await page.locator('#notebook-button').tap();
  const bookOpen = await page.locator('#notebook-panel').isVisible();
  record('notebook_opens', bookOpen);
  if (bookOpen) await page.locator('#notebook-close').tap();

  await page.locator('#menu-button').tap();
  const menuOpen = await page.locator('#ui-overlay').isVisible();
  record('menu_opens', menuOpen);
  if (menuOpen) await page.getByRole('button', { name: 'Resume', exact: true }).tap();

  const snapped = await page.evaluate(() => window.__debug.snapToNpc('landlord'));
  record('snap_landlord', snapped);
  await page.waitForTimeout(300);
  await page.locator('#touch-talk').tap();
  await page.waitForTimeout(400);
  const choice = page.locator('#reply-options .choice-row:not([disabled])').first();
  if (await choice.count()) await choice.tap();
  await page.waitForSelector('#dialogue-bubble:not([hidden])');
  await page.waitForSelector('#reply-options:not([hidden]) .reply-button[aria-label^="Reply"]');
  await page.waitForTimeout(800);
  const audioState = await page.evaluate(() => window.__audioState?.contextState ?? 'unavailable');
  record('talk_opus_and_audio', opusUrls.length > 0 && audioState === 'running', `${opusUrls.length} opus, context ${audioState}`);
  await shot(page, 'talk');

  const reply = page.locator('#reply-options .reply-button[aria-label^="Reply"]').first();
  const lineBefore = await page.locator('#dialogue-line').innerText();
  await reply.tap();
  await page.waitForTimeout(400);
  await reply.tap();
  await page.waitForFunction(previous => {
    const line = document.querySelector('#dialogue-line');
    return Boolean(line) && line.textContent !== previous;
  }, lineBefore);
  const lineAfter = await page.locator('#dialogue-line').innerText();
  record('reply_double_tap_advances', lineAfter !== lineBefore, `"${lineBefore}" → "${lineAfter}"`);
  await shot(page, 'dialogue');

  const scroll = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollX: window.scrollX,
    scrollY: window.scrollY,
  }));
  record(
    'no_page_scroll',
    scroll.scrollWidth === scroll.clientWidth && scroll.scrollX === 0 && scroll.scrollY === 0,
    JSON.stringify(scroll),
  );

  await page.waitForTimeout(700);
  const fps = await page.evaluate(() => window.__debug.fps());
  record('fps_measured', fps > 5, `${fps} fps`);
} catch (error) {
  failed = true;
  record('script_error', false, error instanceof Error ? error.message : String(error));
  try {
    await shot(page, 'error');
  } catch {
    // Screenshot is best-effort after a crash.
  }
} finally {
  await browser.close();
}

failed = failed || results.some(item => !item.ok);
console.log(`===== mobile-touch ${failed ? 'FAIL' : 'PASS'} ${results.filter(item => item.ok).length}/${results.length} =====`);
process.exit(failed ? 1 : 0);
