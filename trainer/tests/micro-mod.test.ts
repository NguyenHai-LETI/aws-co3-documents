// [v5] π The Claude Code mod (trainer/integrations/claude-code/mod/hooks/register.js) driven by a fake mods API: the
// band appears only while Claude works, buttons / digit hotkeys answer through the micro API with X-Trainer, multi-answer
// questions wait for every pick, /saa returns no text Claude would read, and a stopped trainer draws nothing.
// The status-line script is run against a fake trainer too. No Claude Code, no real trainer. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

const MOD = path.join(import.meta.dirname, '..', 'integrations', 'claude-code', 'mod', 'hooks', 'register.js');
const STATUSLINE = path.join(import.meta.dirname, '..', 'integrations', 'claude-code', 'statusline.mjs');

type Handler = (...args: any[]) => Promise<any>;
interface El {
  type: string;
  [k: string]: any;
}

let copy = 0;
/** A fresh module instance (its state lives in module variables) wired to a fake trainer. */
async function load(opts: { down?: boolean; choose?: number } = {}) {
  const { register } = await import(`${MOD}?case=${++copy}`);
  const handlers: { event: string; matcher?: Record<string, unknown>; fn: Handler }[] = [];
  register((event: string, a: unknown, b?: unknown) => {
    handlers.push(typeof a === 'function' ? { event, fn: a as Handler } : { event, matcher: a as Record<string, unknown>, fn: b as Handler });
  });
  const calls: { url: string; init: any }[] = [];
  const store = new Map<string, unknown>();
  const toasts: string[] = [];
  const commands: any[] = [];
  let invalidations = 0;
  const choose = opts.choose ?? 1;
  const el = (type: string) => (p: Record<string, unknown>) => ({ type, ...p });
  const $ = {
    http: {
      fetch: async (url: string, init: any) => {
        calls.push({ url, init });
        if (opts.down) throw new Error('ECONNREFUSED');
        const body = (data: unknown) => ({ status: 200, ok: true, headers: {}, text: JSON.stringify(data) });
        if (url.endsWith('/api/micro/next')) {
          return body({
            question: { id: 'q1', stem: 'Which service decouples producers and consumers?', choose, topic: 'integration', topicLabel: 'Tích hợp', due: true, options: [{ key: 'C', label: 'A', text: 'Amazon SQS' }, { key: 'A', label: 'B', text: 'Amazon EBS' }, { key: 'B', label: 'C', text: 'AWS Batch' }] },
            remaining: 3,
            today: { answered: 0, correct: 0 },
          });
        }
        if (url.endsWith('/api/micro/answer')) {
          const pick = JSON.parse(init.body).pick as string[];
          const ok = pick.join('') === (choose > 1 ? 'AC' : 'C') || pick.sort().join('') === 'AC';
          return body({ ok, pick: pick.join(''), key: 'C', keyLabels: 'A', correct: [{ label: 'A', text: 'Amazon SQS' }], explanation: 'SQS buffers messages between producers and consumers.', attempt: 'x', today: { answered: 1, correct: ok ? 1 : 0 } });
        }
        if (url.endsWith('/api/micro/status')) return body({ line: '📚 3 câu đến hạn' });
        return { status: 404, ok: false, headers: {}, text: '{"error":"nope"}' };
      },
    },
    store: { get: async (k: string) => store.get(k), set: async (k: string, v: unknown) => void store.set(k, v) },
    command: { register: async (c: unknown) => void commands.push(c) },
    ui: {
      invalidate: () => void invalidations++,
      toast: (s: string) => void toasts.push(s),
      resolve: () => ({ Box: el('Box'), Text: el('Text'), Button: el('Button') }),
    },
  };
  const fire = async (event: string, e: Record<string, unknown> = {}, nextResult: unknown = undefined) => {
    const h = handlers.find((x) => x.event === event && (!x.matcher || Object.entries(x.matcher).every(([k, v]) => e[k] === v)));
    assert.ok(h, `handler for ${event}`);
    return h!.fn($, e, async (ev: unknown) => nextResult ?? ev);
  };
  const band = (working: boolean) => fire('ui.render', { component: 'AbovePrompt', props: { isWorking: working, bodyColumns: 80 } }, null);
  return { fire, band, calls, store, toasts, commands, invalidations: () => invalidations };
}

const flat = (t: El | null): El[] => (t && typeof t === 'object' && t.type ? [t, ...(t.children ?? []).flatMap((c: El | string) => (typeof c === 'string' ? [] : flat(c)))] : []);
const texts = (t: El | null) => flat(t).filter((x) => x.type === 'Text').map((x) => x.children.join(''));
const buttons = (t: El | null) => flat(t).filter((x) => x.type === 'Button');
const tick = () => new Promise((r) => setTimeout(r, 5));

test('session start registers /saa (immediate, no transcript text); the band shows only while Claude works', async () => {
  const m = await load();
  await m.fire('session.start', {});
  assert.equal(m.commands[0].name, 'saa');
  assert.equal(m.commands[0].immediate, true);
  const idle = await m.band(false);
  assert.equal(idle?.type, undefined, 'nothing before a turn');
  await m.fire('turn.start', {});
  await tick();
  assert.ok(m.calls[0].url.endsWith('/api/micro/next'));
  assert.equal(m.calls[0].init.method, 'GET');
  const notWorking = await m.band(false);
  assert.ok(!notWorking || notWorking.type !== 'Box', 'a question is not shown while Claude is idle');
  const tree = await m.band(true);
  assert.ok(texts(tree).some((t) => t.includes('Which service decouples')));
  assert.ok(texts(tree).some((t) => t.startsWith('☕ SAA-C03 · Tích hợp · đến hạn ôn')));
  assert.deepEqual(buttons(tree).map((b) => [b.label, b.hotkey]), [['A', '1'], ['B', '2'], ['C', '3']], 'digit hotkeys 1–3');
});

test('a press answers through the micro API with X-Trainer and shows the verdict + one line', async () => {
  const m = await load();
  await m.fire('session.start', {});
  await m.fire('turn.start', {});
  await tick();
  const tree = await m.band(true);
  await buttons(tree).find((b) => b.label === 'B')!.onPress();
  const post = m.calls.find((c) => c.url.endsWith('/api/micro/answer'))!;
  assert.equal(post.init.method, 'POST');
  assert.equal(post.init.headers['X-Trainer'], '1');
  assert.deepEqual(JSON.parse(post.init.body).pick, ['A'], 'the bank key behind label B');
  const after = await m.band(true);
  assert.ok(texts(after).some((t) => t.startsWith('❌ Sai — đáp án A: Amazon SQS')));
  assert.ok(texts(after).some((t) => t.includes('SQS buffers')));
  assert.ok(texts(after).some((t) => t.includes('Hôm nay ☕ 0/1')));
  assert.ok(buttons(after).some((b) => b.label === 'Câu khác' && b.hotkey === '0'));
  assert.ok(texts(await m.band(false)).length > 0, 'the result stays a moment after Claude finished');
});

test('"chọn 2": the first pick waits, the second sends both', async () => {
  const m = await load({ choose: 2 });
  await m.fire('turn.start', {});
  await tick();
  let tree = await m.band(true);
  await buttons(tree).find((b) => b.label === 'A')!.onPress();
  assert.ok(!m.calls.some((c) => c.url.endsWith('/answer')));
  tree = await m.band(true);
  assert.ok(flat(tree).some((x) => x.type === 'Text' && x.color === 'cyan'), 'the first pick is highlighted');
  await buttons(tree).find((b) => b.label === 'B')!.onPress();
  assert.deepEqual(JSON.parse(m.calls.find((c) => c.url.endsWith('/answer'))!.init.body).pick, ['C', 'A']);
});

test('/saa off|on|status: toasts, saved setting, nothing for Claude to read; a stopped trainer draws nothing', async () => {
  const m = await load();
  await m.fire('session.start', {});
  assert.deepEqual(await m.fire('command.run', { command: 'saa', args: 'off' }), {});
  assert.deepEqual(m.store.get('settings'), { enabled: false, port: 3003 });
  await m.fire('turn.start', {});
  await tick();
  assert.ok(!m.calls.some((c) => c.url.endsWith('/next')), 'off: no request');
  assert.deepEqual(await m.fire('command.run', { command: 'saa', args: 'port 4123' }), {});
  assert.deepEqual(m.store.get('settings'), { enabled: false, port: 4123 });
  await m.fire('command.run', { command: 'saa', args: 'on' });
  assert.ok(m.calls.at(-1)!.url.startsWith('http://127.0.0.1:4123/api/micro/next'));
  await m.fire('command.run', { command: 'saa', args: 'status' });
  assert.match(m.toasts.at(-1)!, /📚 3 câu đến hạn/);

  const down = await load({ down: true });
  await down.fire('turn.start', {});
  await tick();
  const tree = await down.band(true);
  assert.ok(!tree || tree.type !== 'Box', 'trainer not running: no band');
  await down.fire('command.run', { command: 'saa', args: 'status' });
  assert.match(down.toasts.at(-1)!, /không chạy ở cổng 3003/);
});

test('status-line script: prints the trainer line, nothing when the app is down', async () => {
  const srv = http.createServer((req, res) => {
    res.writeHead(req.url === '/api/micro/status' ? 200 : 404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ line: '📚 7 câu đến hạn\u001b[2J · sẵn sàng 61 %\n' }));
  });
  await new Promise<void>((r) => srv.listen(0, '127.0.0.1', () => r()));
  const port = (srv.address() as { port: number }).port;
  const cache = fs.mkdtempSync(path.join(os.tmpdir(), 'trainer-sl-'));
  const run = (p: number) =>
    new Promise<string>((resolve) => {
      const c = spawn(process.execPath, [STATUSLINE, '--port', String(p), '--plain'], { env: { ...process.env, XDG_CACHE_HOME: cache, LOCALAPPDATA: cache }, stdio: ['pipe', 'pipe', 'inherit'] });
      let out = '';
      c.stdout.on('data', (b: Buffer) => (out += b.toString()));
      c.on('exit', () => resolve(out));
      c.stdin.end('{"session_id":"x"}');
    });
  try {
    assert.equal(await run(port), '📚 7 câu đến hạn [2J · sẵn sàng 61 %\n', '[R3] control characters stripped');
    const file = path.join(cache, 'saa-trainer', `status-${port}.json`);
    assert.ok(fs.existsSync(file), '[R3] cached in the per-user cache folder, not the shared temp dir');
    if (process.platform !== 'win32') assert.equal(fs.statSync(file).mode & 0o777, 0o600);
    assert.equal(await run(port), '📚 7 câu đến hạn [2J · sẵn sàng 61 %\n', 'served from the cache');
  } finally {
    await new Promise((r) => srv.close(r));
  }
  fs.rmSync(path.join(cache, 'saa-trainer'), { recursive: true, force: true });
  assert.equal(await run(port), '', 'app down: empty line');
  fs.rmSync(cache, { recursive: true, force: true });
});
