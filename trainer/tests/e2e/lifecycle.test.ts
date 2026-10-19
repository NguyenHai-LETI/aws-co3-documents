// Server lifecycle (server/index.ts): the SSE `data` event follows every data version (config.yaml, personal FSRS
// parameters, …) and the shutdown signals never lose the debounced coach snapshot. Run: npm run test:e2e
// (Started with pipes, like CI: no terminal — the "terminal closed" SIGHUP path is checked by hand with a pty.)
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { apiClient, makeSandbox, startServer, type Sandbox, type ServerHandle } from '../helpers/server.ts';
import { takeTest } from '../helpers/learner.ts';

const T = { timeout: 120_000 };
const sandboxes: Sandbox[] = [];
const servers: ServerHandle[] = [];
after(async () => {
  await Promise.all(servers.map((s) => s.stop()));
  for (const s of sandboxes) s.cleanup();
});

async function boot() {
  const sb = makeSandbox();
  sandboxes.push(sb);
  const srv = await startServer({ home: sb.home });
  servers.push(srv);
  return { sb, srv, api: apiClient(srv.base) };
}

const exited = (srv: ServerHandle) =>
  new Promise<number | null>((resolve) => {
    if (srv.proc.exitCode !== null) return resolve(srv.proc.exitCode);
    srv.proc.once('exit', (code) => resolve(code));
  });

/** SSE client collecting `data` events. */
function listen(base: string) {
  const events: Record<string, string>[] = [];
  const req = http.get(`${base}/api/events`, (res) => {
    let buf = '';
    res.setEncoding('utf8');
    res.on('data', (chunk: string) => {
      buf += chunk;
      let i: number;
      while ((i = buf.indexOf('\n\n')) >= 0) {
        const block = buf.slice(0, i);
        buf = buf.slice(i + 2);
        if (/^event: data$/m.test(block)) events.push(JSON.parse(/^data: (.*)$/m.exec(block)![1]));
      }
    });
  });
  req.on('error', () => undefined);
  return { events, close: () => req.destroy() };
}

async function waitFor<X>(fn: () => X | undefined, ms: number, what: string): Promise<X> {
  const end = Date.now() + ms;
  for (;;) {
    const v = fn();
    if (v !== undefined) return v;
    if (Date.now() > end) throw new Error(`timeout: ${what}`);
    await new Promise((r) => setTimeout(r, 200));
  }
}

test('SSE `data` follows config.yaml and the personal FSRS parameters (and carries the day)', T, async () => {
  const { sb, srv } = await boot();
  const sse = listen(srv.base);
  try {
    await new Promise((r) => setTimeout(r, 3500)); // the poller records the current versions once a client is connected
    const cfgFile = path.join(sb.home, 'config.yaml');
    fs.appendFileSync(cfgFile, '\n# touched by lifecycle.test.ts\n');
    const a = await waitFor(() => sse.events.at(-1), 8000, 'data event after a config.yaml edit');
    for (const k of ['bank', 'results', 'plans', 'params', 'config', 'day']) assert.ok(k in a, `versions carry ${k}: ${JSON.stringify(a)}`);
    assert.match(a.day, /^\d{4}-\d{2}-\d{2}$/);
    const n = sse.events.length;
    fs.writeFileSync(path.join(sb.home, 'results', 'fsrs-params.json'), '');
    const b = await waitFor(() => (sse.events.length > n ? sse.events.at(-1) : undefined), 8000, 'data event after fsrs-params.json appeared');
    assert.notEqual(b.params, a.params);
    assert.equal(b.config, a.config);
  } finally {
    sse.close();
  }
});

test('SIGTERM inside the snapshot debounce: the snapshot is written before the process exits', T, async () => {
  const { sb, srv, api } = await boot();
  const snap = path.join(sb.home, 'coach', 'snapshot.md');
  await takeTest(api, { mode: 'quick' });
  const pending = !fs.existsSync(snap); // debounced: not written by the request itself
  srv.proc.kill('SIGTERM');
  assert.equal(await exited(srv), 0);
  assert.ok(fs.existsSync(snap), 'flushed on shutdown');
  if (!pending) console.log('# note: the snapshot was already written before the signal — flush not exercised');
});

test('SIGHUP without a terminal (nohup / service): snapshot written, server keeps serving; double SIGINT exits once', T, async () => {
  const { sb, srv, api } = await boot();
  const snap = path.join(sb.home, 'coach', 'snapshot.md');
  await takeTest(api, { mode: 'quick' });
  srv.proc.kill('SIGHUP');
  await waitFor(() => (fs.existsSync(snap) ? true : undefined), 1500, 'snapshot written on SIGHUP (before the 3 s debounce)');
  assert.equal((await api.get('/api/meta')).status, 200, 'still serving');
  srv.proc.kill('SIGINT');
  srv.proc.kill('SIGINT');
  assert.equal(await exited(srv), 0);
  assert.ok(!/failed/i.test(srv.logs()), srv.logs());
});
