// Playwright smoke test of the web UI against a sandbox server (temp TRAINER_HOME + seeded history, free port).
// Checks: every page renders without page errors / console errors / failing API calls; a test can be created,
// answered and submitted through the UI; a submit without connection waits as "⏳ chờ nộp" and goes through once the
// server answers again (exactly one result); no horizontal overflow at 390 px; dark theme renders.
// Run: npm run test:ui   (Chromium once: npx playwright install chromium — checked first, exit code 2 with the fix)
// Env: SMOKE_OUT=<dir> screenshots (default: temp dir) · HEADED=1 show the browser · PLAYWRIGHT_BROWSERS_PATH as usual.
import { chromium } from 'playwright';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { apiClient, makeSandbox, startServer } from '../helpers/server.ts';
import { seedHistory } from '../helpers/learner.ts';
import { TRAINER_ROOT } from '../helpers/paths.ts';

// ── browser preflight ───────────────────────────────────────────────────────
// Playwright needs the browser build of its own version (start.sh installs packages with PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD,
// so an upgrade silently leaves an older build behind). Fail in a second with the exact fix instead of a stack trace.

function browsersDir() {
  const env = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (env && env !== '0') return path.resolve(env);
  if (env === '0') return path.join(path.dirname(createRequire(import.meta.url).resolve('playwright-core/package.json')), '.local-browsers');
  if (process.platform === 'darwin') return path.join(os.homedir(), 'Library', 'Caches', 'ms-playwright');
  if (process.platform === 'win32') return path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'ms-playwright');
  return path.join(process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache'), 'ms-playwright');
}

function expectedChromium() {
  try {
    const req = createRequire(import.meta.url);
    const core = path.dirname(req.resolve('playwright-core/package.json')); // browsers.json itself is not "exported"
    const { browsers } = JSON.parse(fs.readFileSync(path.join(core, 'browsers.json'), 'utf8'));
    const version = JSON.parse(fs.readFileSync(req.resolve('playwright/package.json'), 'utf8')).version;
    const shell = browsers.find((b) => b.name === 'chromium-headless-shell') ?? browsers.find((b) => b.name === 'chromium');
    return { version, dir: `${shell.name.replace(/-/g, '_')}-${shell.revision}` };
  } catch {
    return { version: '?', dir: 'chromium_headless_shell-?' };
  }
}

async function launchOrExplain() {
  try {
    return await chromium.launch({ headless: !process.env.HEADED });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!/Executable doesn't exist|browser.*(not|isn't) installed|playwright install/i.test(msg)) throw e;
    const dir = browsersDir();
    const want = expectedChromium();
    let found = [];
    try {
      found = fs.readdirSync(dir).filter((n) => /^chromium/.test(n));
    } catch {
      // no browser cache at all
    }
    const env = process.env.PLAYWRIGHT_BROWSERS_PATH ? `PLAYWRIGHT_BROWSERS_PATH="${process.env.PLAYWRIGHT_BROWSERS_PATH}" ` : '';
    console.error(
      [
        `✗ UI smoke: thiếu trình duyệt cho Playwright ${want.version} — cần ${want.dir} trong ${dir}.`,
        found.length ? `  Đang có: ${found.join(', ')} (của bản Playwright khác).` : '  Thư mục đó chưa có Chromium nào.',
        '  Sửa (một lần, tải ~150 MB):',
        `    cd "${TRAINER_ROOT}" && ${env}npx playwright install chromium`,
        '  Hoặc trỏ tới bộ trình duyệt đã có đúng bản: PLAYWRIGHT_BROWSERS_PATH=<thư mục chứa ' + want.dir + '> npm run test:ui',
      ].join('\n'),
    );
    process.exit(2);
  }
}

const OUT = path.resolve(process.env.SMOKE_OUT || fs.mkdtempSync(path.join(os.tmpdir(), 'trainer-smoke-')));
fs.mkdirSync(OUT, { recursive: true });
const BANK_GUIDE = '/bank?tab=quality&sec=guide'; // [v5 γ1] exam-guide coverage map
const PAGES = [
  ['/', 'dashboard'],
  ['/new', 'new-test'],
  ['/stats', 'stats'],
  ['/history', 'history'],
  ['/bank', 'bank'],
  ['/coach', 'coach'],
  ['/tools', 'tools'],
  ['/pair?a=SNS&b=SQS', 'pair'], // [v5 μ]
  ['/pair', 'pairs'],
];

const results = []; // { name, ok, detail }
let current = 'setup';
const problems = []; // errors seen while `current` was running
let offline = false; // a step simulating a dropped connection: the browser's "Failed to load resource" is expected

function watch(page) {
  page.on('pageerror', (e) => problems.push(`[${current}] pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error' || (offline && /ERR_INTERNET_DISCONNECTED|Failed to load resource/.test(m.text()))) return;
    problems.push(`[${current}] console.error: ${m.text().slice(0, 300)}`);
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

/** [v5] Puts a test built through the API into the browser as the unfinished test (fields the runner fills itself omitted). */
async function injectActive(page, base, session, questions, opts = {}) {
  await open(page, base, '/');
  await page.evaluate(
    ([s, qs, o]) =>
      localStorage.setItem('trainer.activeTest.v1', JSON.stringify({ session: s, questions: qs, answers: {}, current: 0, startedAt: Date.now(), pausedTotal: 0, opts: o })),
    [session, questions, opts],
  );
  await open(page, base, '/run');
  await page.locator('.runner-bar').first().waitFor({ timeout: 20_000 });
}

/** Display position (1-based key to press) of option `key` for question entry `id` of the stored unfinished test. */
async function keyFor(page, id, key) {
  return page.evaluate(
    ([qid, k]) => {
      const t = JSON.parse(localStorage.getItem('trainer.activeTest.v1') ?? 'null');
      const q = t.questions.find((x) => x.id === qid);
      const own = qid.endsWith('~relearn') ? t.relearn?.[qid]?.order : t.session.questions.find((r) => r.id === qid)?.order;
      const order = own && own.length === q.options.length ? own : q.options.map((o) => o.key);
      return String(order.indexOf(k) + 1);
    },
    [id, key],
  );
}

async function submitFromRunner(page) {
  await page.getByRole('button', { name: /^Nộp bài/ }).first().click();
  await page.getByRole('button', { name: /xem kết quả|Kết thúc bài thi/ }).first().click({ timeout: 10_000 });
  await page.waitForURL(/#\/result\//, { timeout: 20_000 });
  await rendered(page);
}

// ── run ─────────────────────────────────────────────────────────────────────

let browser = await launchOrExplain(); // before the sandbox and the server: a missing browser costs one second
const sb = makeSandbox();
const notRepo = path.join(sb.root, 'not-a-repo'); // sync status must never look at the real repo
fs.mkdirSync(notRepo);
let srv;
let exitCode = 1;
try {
  srv = await startServer({ home: sb.home, repo: notRepo });
  const api = apiClient(srv.base);
  await seedHistory(api);
  console.log(`server ${srv.base} · sandbox ${sb.root} · screenshots ${OUT}`);

  // warm-up (not recorded): Vite optimizes dependencies on the first page load and may reload the page once
  const warm = await browser.newContext();
  const w = await warm.newPage();
  await open(w, srv.base, '/');
  await rendered(w);
  await w.waitForTimeout(1500);
  // every page once: a page importing a dependency not optimized yet makes Vite reload the tab, which would drop the
  // key presses of a recorded step that happens to run right then
  for (const [hash] of [...PAGES, ['/run'], ['/listen'], ['/notes'], [BANK_GUIDE], ['/new?mode=today']]) {
    await open(w, srv.base, hash);
    await w.locator('main > *, .runner > *').first().waitFor({ timeout: 45_000 }).catch(() => undefined);
    await w.waitForTimeout(400);
  }
  await w.waitForTimeout(1000);
  await warm.close();

  // desktop, light
  const desk = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: 'light' });
  await desk.addInitScript(() => localStorage.setItem('trainer.theme', 'light')); // the app is dark by default: keep light covered here
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
  // [v5 μ] result page "🩹 Chữa N câu": retry before the explanation (POST /api/results/:id/retry)
  await step('desktop result → 🩹 Chữa → retry → explanation', p, async () => {
    const fix = p.getByRole('button', { name: /Chữa \d+ câu/ });
    if (!(await fix.count())) return; // nothing to correct in this attempt (or the stepper is not in this tree)
    await fix.first().click();
    await p.locator('.lrn-fix').first().waitFor({ timeout: 10_000 });
    await p.locator('.lrn-fix .opt:not(.struck)').first().click();
    const check = p.locator('.lrn-fix').getByRole('button', { name: 'Kiểm tra' });
    if ((await check.count()) && (await check.first().isEnabled())) await check.first().click();
    else await p.locator('.lrn-fix').getByRole('button', { name: /Bỏ qua, xem giải thích/ }).first().click();
    await p.locator('.lrn-fix .explain').first().waitFor({ state: 'visible', timeout: 10_000 });
  });
  await step('desktop practice quick test (reveal)', p, async () => {
    await takeTestThroughUi(p, srv.base, 'mode=quick', 1);
    await p.keyboard.press('Enter'); // practice: check the answer
    await p.waitForTimeout(300);
  });
  // [v5 ρ] "⏹ Dừng ở đây": 2 of 5 answered → only those are stored, the 3 never viewed stay in the queues
  await step('desktop ⏹ stop early → result covers the answered part', p, async () => {
    await takeTestThroughUi(p, srv.base, 'mode=topic&topics=networking&count=5', 2);
    await p.getByRole('button', { name: 'Dừng ở đây' }).click();
    await p.getByRole('button', { name: /Dừng & lưu phần đã làm/ }).click({ timeout: 10_000 });
    await p.waitForURL(/#\/result\//, { timeout: 20_000 });
    await rendered(p);
    const a = (await api.get('/api/results?limit=1')).body.items[0];
    if (!a.stoppedEarly || a.planned !== 5 || a.total !== 2) throw new Error(`stopped early attempt: ${JSON.stringify({ stoppedEarly: a.stoppedEarly, planned: a.planned, total: a.total })}`);
  });

  // [v5 ρ] in-session relearning: a wrong answer comes back later with its options hidden until the learner recalls
  await step('desktop 🔁 relearn: wrong answer → asked again (recall gate) → stored as a retry', p, async () => {
    const built = await api.post('/api/tests', { mode: 'quick', feedback: 'practice', relearn: true, count: 5 });
    if (!built.ok) throw new Error(`POST /api/tests → ${built.status}`);
    const { session, questions } = built.body;
    const q0 = questions[0];
    await injectActive(p, srv.base, session, questions, { relearn: true });
    const wrongKey = q0.options.map((o) => o.key).find((k) => !q0.answer.includes(k));
    await p.keyboard.press(await keyFor(p, q0.id, wrongKey));
    await p.keyboard.press('Enter'); // Kiểm tra → wrong → queued
    await p.getByText(/Câu này sẽ được hỏi lại/).waitFor({ timeout: 10_000 });
    for (let i = 0; i < 8 && !(await p.locator('.relearn-badge').count()); i++) {
      await p.keyboard.press('ArrowRight');
      await p.waitForTimeout(80);
    }
    await p.locator('#recall-input').fill('ý chính của đáp án');
    await p.keyboard.press('Enter'); // options shown
    const slotId = `${q0.id}~relearn`;
    for (const k of q0.answer) await p.keyboard.press(await keyFor(p, slotId, k));
    await p.keyboard.press('Enter'); // Kiểm tra
    await p.getByText(/Lần hỏi lại này không tính điểm/).waitFor({ timeout: 10_000 });
    await submitFromRunner(p);
    const id = decodeURIComponent(new URL(p.url()).hash.split('/').pop() ?? '');
    const a = (await api.get(`/api/results/${encodeURIComponent(id)}`)).body.attempt;
    const recs = a.answers.filter((r) => r.q === q0.id);
    if (recs.length !== 2 || recs[0].ok || !recs[1].relearn || !recs[1].ok) throw new Error(`relearn records: ${JSON.stringify(recs.map((r) => ({ ok: r.ok, relearn: r.relearn })))}`);
  });

  // [v5 γ1] Quality → 🗺️ Đề cương
  await step('desktop bank exam-guide map', p, async () => {
    await open(p, srv.base, BANK_GUIDE);
    await rendered(p);
    await p.getByText('Sinh cho ô trống').first().waitFor({ timeout: 20_000 });
  });

  // [v5 σ] "Học hôm nay": preview → start → runner; left with ⏹ before any answer ("🗑 Bỏ bài này": nothing stored)
  await step('desktop ▶ Học hôm nay → runner → bỏ bài', p, async () => {
    const before = (await api.get('/api/results')).body.length;
    await open(p, srv.base, '/new?mode=today');
    await rendered(p);
    const start = p.getByRole('button', { name: /^▶ (Học hôm nay|Bắt đầu)/ }).last(); // the start button, not the mode card
    await start.waitFor({ timeout: 20_000 });
    for (let i = 0; i < 50 && !(await start.isEnabled()); i++) await p.waitForTimeout(200); // the today preview arrives
    await start.click();
    await p.waitForURL(/#\/run/, { timeout: 20_000 });
    await p.locator('.runner-bar').first().waitFor({ timeout: 20_000 });
    const title = await p.locator('.runner-title').first().innerText();
    if (!/Học hôm nay/.test(title)) throw new Error(`runner title: ${title}`);
    await p.getByRole('button', { name: 'Dừng ở đây' }).click();
    await p.getByRole('button', { name: /Bỏ bài này/ }).click({ timeout: 10_000 });
    await p.waitForURL((u) => !/#\/run/.test(u.hash), { timeout: 20_000 });
    const left = await p.evaluate(() => localStorage.getItem('trainer.activeTest.v1'));
    if (left) throw new Error('the abandoned test is still stored');
    const after = (await api.get('/api/results')).body.length;
    if (after !== before) throw new Error(`abandon stored ${after - before} result(s)`);
  });

  await step('desktop submit without connection → ⏳ chờ nộp → sent once when back', p, async () => {
    const before = (await api.get('/api/results')).body.length;
    await takeTestThroughUi(p, srv.base, 'mode=topic&topics=storage&count=3', 3);
    offline = true;
    const drop = (route) => (route.request().method() === 'POST' ? route.abort('internetdisconnected') : route.continue());
    await p.route('**/api/results', drop);
    try {
      await p.getByRole('button', { name: /^Nộp bài/ }).first().click();
      await p.getByRole('button', { name: /xem kết quả/ }).first().click({ timeout: 10_000 });
      await p.getByRole('heading', { name: /Bài đang chờ nộp/ }).waitFor({ timeout: 15_000 });
      const queued = await p.evaluate(() => JSON.parse(localStorage.getItem('trainer.outbox.v1') ?? '[]').length);
      if (queued !== 1) throw new Error(`outbox holds ${queued} entries, expected 1`);
    } finally {
      await p.unroute('**/api/results', drop);
      offline = false;
    }
    await p.getByRole('button', { name: /Thử nộp lại ngay/ }).click();
    await p.waitForURL(/#\/result\//, { timeout: 20_000 });
    await rendered(p);
    const after = (await api.get('/api/results')).body.length;
    if (after !== before + 1) throw new Error(`expected exactly one new result, got ${after - before}`);
    const left = await p.evaluate(() => localStorage.getItem('trainer.outbox.v1'));
    if (left) throw new Error(`outbox not emptied: ${left.slice(0, 120)}`);
  });

  // mobile 390 px: no horizontal overflow
  const mob = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'light' });
  await mob.addInitScript(() => localStorage.setItem('trainer.theme', 'light'));
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
  await step('390px bank exam-guide map', m, async () => {
    await open(m, srv.base, BANK_GUIDE);
    await rendered(m);
    await m.getByText('Sinh cho ô trống').first().waitFor({ timeout: 20_000 });
    await noOverflow(m);
  });
  // [v5 τ] pages without a sidebar <h1> of their own: wait for the main content instead
  for (const [hash, name] of [
    ['/listen', 'listen'],
    ['/notes?tab=notebook', 'notes notebook'],
  ]) {
    await step(`390px ${name}`, m, async () => {
      await open(m, srv.base, hash);
      await m.locator('main > *').last().waitFor({ state: 'visible', timeout: 45_000 });
      await m.waitForTimeout(900);
      await noOverflow(m);
    });
  }

  // dark theme: the default even when the OS asks for light; the sidebar button switches and is remembered
  const dark = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: 'light' });
  const d = await dark.newPage();
  watch(d);
  const themeOf = () => d.evaluate(() => ({ attr: document.documentElement.dataset.theme, bg: getComputedStyle(document.body).backgroundColor, stored: localStorage.getItem('trainer.theme') }));
  const isDarkBg = (bg) => {
    const [r, g, b] = (bg.match(/\d+/g) ?? []).map(Number);
    return r + g + b < 120;
  };
  for (const [hash, name] of [PAGES[0], PAGES[2], PAGES[4]]) {
    await step(`dark ${name}`, d, async () => {
      await open(d, srv.base, hash);
      await rendered(d);
      const t = await themeOf();
      if (t.attr !== 'dark' || !isDarkBg(t.bg)) throw new Error(`expected the dark theme by default, got ${JSON.stringify(t)}`);
    });
  }
  await step('theme toggle: dark → light → reload → dark', d, async () => {
    const toggle = d.locator('.theme-toggle');
    await toggle.click();
    let t = await themeOf();
    if (t.attr !== 'light' || t.stored !== 'light' || isDarkBg(t.bg)) throw new Error(`toggle to light failed: ${JSON.stringify(t)}`);
    await d.reload();
    await rendered(d);
    t = await themeOf();
    if (t.attr !== 'light') throw new Error(`light not remembered after reload: ${JSON.stringify(t)}`);
    await d.locator('.theme-toggle').click();
    t = await themeOf();
    if (t.attr !== 'dark' || t.stored !== 'dark') throw new Error(`toggle back to dark failed: ${JSON.stringify(t)}`);
  });

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
