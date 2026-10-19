// Playwright smoke test of the web UI against a sandbox server (temp TRAINER_HOME + seeded history, free port).
// Checks: every page renders without page errors / console errors / failing API calls; a test can be created,
// answered and submitted through the UI; no horizontal overflow at 390 px; dark theme renders.
// Run: npm run test:ui   (Chromium once: npx playwright install chromium)
// Env: SMOKE_OUT=<dir> screenshots (default: temp dir) · HEADED=1 show the browser · PLAYWRIGHT_BROWSERS_PATH as usual.
import { chromium } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { apiClient, makeSandbox, startServer } from '../helpers/server.ts';
import { seedHistory } from '../helpers/learner.ts';

const OUT = path.resolve(process.env.SMOKE_OUT || fs.mkdtempSync(path.join(os.tmpdir(), 'trainer-smoke-')));
fs.mkdirSync(OUT, { recursive: true });
const PAGES = [
  ['/', 'dashboard'],
  ['/new', 'new-test'],
  ['/stats', 'stats'],
  ['/history', 'history'],
  ['/bank', 'bank'],
  ['/coach', 'coach'],
  ['/tools', 'tools'],
];

const results = []; // { name, ok, detail }
let current = 'setup';
const problems = []; // errors seen while `current` was running

function watch(page) {
  page.on('pageerror', (e) => problems.push(`[${current}] pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`[${current}] console.error: ${m.text().slice(0, 300)}`);
  });
  page.on('response', (r) => {
    const u = new URL(r.url());
    if (u.pathname.startsWith('/api/') && r.status() >= 400) problems.push(`[${current}] ${r.request().method()} ${u.pathname}${u.search} → ${r.status()}`);
  });
  page.on('dialog', (d) => d.accept()); // "bỏ bài đang làm dở?" confirms
}

async function step(name, page, fn) {
  current = name;
  const before = problems.length;
  let error;
  try {
    await fn();
  } catch (e) {
    error = e instanceof Error ? e.message.split('\n')[0] : String(e);
  }
  await page.waitForTimeout(150);
  const seen = problems.slice(before);
  const ok = !error && !seen.length;
  results.push({ name, ok, detail: [error, ...seen].filter(Boolean).join('\n      ') });
  try {
    await page.screenshot({ path: path.join(OUT, `${String(results.length).padStart(2, '0')}-${name.replace(/[^\w.-]+/g, '_')}.png`), fullPage: false });
  } catch {
    // page closed
  }
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : `\n      ${results.at(-1).detail}`}`);
}

async function open(page, base, hash) {
  await page.goto(`${base}/#${hash}`, { waitUntil: 'domcontentloaded' });
  await page.locator('#root *').first().waitFor({ timeout: 30_000 });
}

/** Page content rendered: the page heading is visible (sidebar pages have <main><h1>). */
async function rendered(page) {
  await page.locator('main h1').first().waitFor({ state: 'visible', timeout: 45_000 });
  await page.waitForTimeout(700); // secondary fetches (stats, quality, sync status…)
}

async function noOverflow(page) {
  const o = await page.evaluate(() => {
    const doc = document.documentElement;
    const width = doc.clientWidth;
    const offenders = [];
    if (doc.scrollWidth > width + 1) {
      // culprits = outermost elements sticking out that no scrolling/clipping ancestor contains
      const clipped = (el) => {
        for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) if (getComputedStyle(p).overflowX !== 'visible') return true;
        return false;
      };
      const reported = [];
      const report = (el, right, what = '') => {
        if (reported.some((x) => x.contains(el))) return;
        reported.push(el);
        const cls = typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).join('.') : '';
        const text = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 50);
        if (offenders.length < 4) offenders.push(`${what}${el.tagName.toLowerCase()}${cls} (right ${Math.round(right)}px${text ? `, “${text}”` : ''})`);
      };
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect();
        if (r.width && r.right > width + 1 && !clipped(el)) report(el, r.right);
      }
      // text that runs out of its box (long unbreakable words, paths, URLs) does not move the box itself
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const range = document.createRange();
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (!n.textContent.trim() || !n.parentElement) continue;
        range.selectNodeContents(n);
        const r = range.getBoundingClientRect();
        if (r.width && r.right > width + 1 && !clipped(n.parentElement) && getComputedStyle(n.parentElement).overflowX === 'visible') report(n.parentElement, r.right, 'text in ');
      }
    }
    return { scrollWidth: doc.scrollWidth, width, offenders };
  });
  if (o.scrollWidth > o.width + 1) throw new Error(`horizontal overflow: scrollWidth ${o.scrollWidth} > ${o.width} — ${o.offenders.join(', ')}`);
}

/** NewTest → runner → answer every question → submit → result page. Returns the result hash. */
async function takeTestThroughUi(page, base, query, count) {
  await open(page, base, `/new?${query}`);
  await rendered(page);
  await page.getByRole('button', { name: /Bắt đầu/ }).first().click();
  await page.waitForURL(/#\/run/, { timeout: 20_000 });
  await page.locator('.runner, [class*="runner"]').first().waitFor({ timeout: 20_000 });
  for (let i = 0; i < count; i++) {
    await page.keyboard.press(String((i % 4) + 1));
    await page.waitForTimeout(60);
    if (i < count - 1) await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(60);
  }
  return page;
}

async function submitFromRunner(page) {
  await page.getByRole('button', { name: /^Nộp bài/ }).first().click();
  await page.getByRole('button', { name: /xem kết quả|Kết thúc bài thi/ }).first().click({ timeout: 10_000 });
  await page.waitForURL(/#\/result\//, { timeout: 20_000 });
  await rendered(page);
}

// ── run ─────────────────────────────────────────────────────────────────────

const sb = makeSandbox();
const notRepo = path.join(sb.root, 'not-a-repo'); // sync status must never look at the real repo
fs.mkdirSync(notRepo);
let srv;
let browser;
let exitCode = 1;
try {
  srv = await startServer({ home: sb.home, repo: notRepo });
  const api = apiClient(srv.base);
  await seedHistory(api);
  console.log(`server ${srv.base} · sandbox ${sb.root} · screenshots ${OUT}`);

  browser = await chromium.launch({ headless: !process.env.HEADED });

  // warm-up (not recorded): Vite optimizes dependencies on the first page load and may reload the page once
  const warm = await browser.newContext();
  const w = await warm.newPage();
  await open(w, srv.base, '/');
  await rendered(w);
  await w.waitForTimeout(1500);
  await warm.close();

  // desktop, light
  const desk = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: 'light' });
  const p = await desk.newPage();
  watch(p);
  for (const [hash, name] of PAGES) {
    await step(`desktop ${name}`, p, async () => {
      await open(p, srv.base, hash);
      await rendered(p);
    });
  }
  let resultHash = '';
  await step('desktop new test → runner → submit → result', p, async () => {
    await takeTestThroughUi(p, srv.base, 'mode=topic&topics=database&count=5', 5);
    await submitFromRunner(p);
    resultHash = new URL(p.url()).hash.slice(1);
    const list = (await api.get('/api/results')).body;
    if (!Array.isArray(list) || !list.some((a) => resultHash.includes(encodeURIComponent(a.id)) || resultHash.includes(a.id))) {
      throw new Error(`submitted attempt not found in /api/results (hash ${resultHash})`);
    }
  });
  await step('desktop practice quick test (reveal)', p, async () => {
    await takeTestThroughUi(p, srv.base, 'mode=quick', 1);
    await p.keyboard.press('Enter'); // practice: check the answer
    await p.waitForTimeout(300);
  });

  // mobile 390 px: no horizontal overflow
  const mob = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'light' });
  const m = await mob.newPage();
  watch(m);
  for (const [hash, name] of PAGES) {
    await step(`390px ${name}`, m, async () => {
      await open(m, srv.base, hash);
      await rendered(m);
      await noOverflow(m);
    });
  }
  if (resultHash) {
    await step('390px result', m, async () => {
      await open(m, srv.base, resultHash.replace(/^#/, ''));
      await rendered(m);
      await noOverflow(m);
    });
  }
  await step('390px runner', m, async () => {
    await takeTestThroughUi(m, srv.base, 'mode=quick', 2);
    await noOverflow(m);
  });

  // dark theme
  const dark = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: 'dark' });
  const d = await dark.newPage();
  watch(d);
  for (const [hash, name] of [PAGES[0], PAGES[2], PAGES[4]]) {
    await step(`dark ${name}`, d, async () => {
      await open(d, srv.base, hash);
      await rendered(d);
    });
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${failed.length ? '✗' : '✓'} UI smoke: ${results.length - failed.length}/${results.length} bước ổn · ảnh chụp: ${OUT}`);
  exitCode = failed.length ? 1 : 0;
} catch (e) {
  console.error('✗ UI smoke aborted:', e);
  if (srv) console.error(srv.logs().slice(-3000));
} finally {
  await browser?.close();
  await srv?.stop();
  if (process.env.SMOKE_KEEP) console.log(`sandbox kept: ${sb.root}`);
  else sb.cleanup();
}
process.exit(exitCode);
