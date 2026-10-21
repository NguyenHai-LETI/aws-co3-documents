// [v5] π Production UI build (server/lib/lan-ui.ts): the source stamp follows every change of the build inputs, a
// restarted process (the update flow: sync pulls code → "Khởi động lại" → exit 75 → launcher) rebuilds a stale build and
// reuses a current one, and a running process keeps its build while a synced code update waits for the restart.
// Fake builder, temp folders: no vite, nothing outside the temp dir. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createUiBuild, sourceStampOf } from '../server/lib/lan-ui.ts';

function tree() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'trainer-ui-'));
  fs.mkdirSync(path.join(root, 'web', 'pages'), { recursive: true });
  fs.mkdirSync(path.join(root, 'shared'));
  fs.writeFileSync(path.join(root, 'index.html'), '<div id=root></div>');
  fs.writeFileSync(path.join(root, 'web', 'main.tsx'), 'console.log(1)');
  fs.writeFileSync(path.join(root, 'web', 'pages', 'A.tsx'), 'export const A = 1');
  fs.writeFileSync(path.join(root, 'shared', 'types.ts'), 'export {}');
  return root;
}

/** Fake `vite build`: index.html carries a build number; counts the builds. */
function builder(root: string) {
  let builds = 0;
  return {
    get builds() {
      return builds;
    },
    build: async (outDir: string) => {
      builds++;
      fs.mkdirSync(path.join(outDir, 'assets'), { recursive: true });
      fs.writeFileSync(path.join(outDir, 'index.html'), `<html>build ${builds} of ${fs.readFileSync(path.join(root, 'web', 'main.tsx'), 'utf8')}</html>`);
      fs.writeFileSync(path.join(outDir, 'assets', 'app-1.js'), 'x'.repeat(2000));
      fs.writeFileSync(path.join(outDir, 'sw.js'), 'self');
      return undefined;
    },
  };
}

async function get(ui: ReturnType<typeof createUiBuild>, p: string): Promise<{ status: number; headers: http.OutgoingHttpHeaders; body: string }> {
  let status = 0;
  let headers: http.OutgoingHttpHeaders = {};
  let body = '';
  const res = {
    writeHead: (s: number, h: http.OutgoingHttpHeaders) => {
      status = s;
      headers = h;
    },
    end: (b?: Buffer | string) => {
      body = b ? b.toString() : '';
    },
  } as unknown as http.ServerResponse;
  const req = { method: 'GET', headers: {} } as http.IncomingMessage;
  const served = await ui.serve(req, res, new URL(p, 'http://localhost'));
  assert.ok(served, `${p} answered by the build`);
  return { status, headers, body };
}

test('source stamp: content edits, new files, renames and older mtimes all change it', () => {
  const root = tree();
  try {
    const a = sourceStampOf(root);
    assert.equal(sourceStampOf(root), a, 'stable');
    const f = path.join(root, 'web', 'pages', 'A.tsx');
    const st = fs.statSync(f);
    fs.writeFileSync(f, 'export const A = 2'); // same size
    fs.utimesSync(f, st.atime, new Date(st.mtimeMs - 3600_000)); // restored with an OLDER mtime (cp -p, rsync -t)
    const b = sourceStampOf(root);
    assert.notEqual(b, a, 'older mtime, same size → still a change');
    fs.renameSync(f, path.join(root, 'web', 'pages', 'B.tsx'));
    assert.notEqual(sourceStampOf(root), b, 'rename');
    fs.writeFileSync(path.join(root, 'web', '.DS_Store'), 'x');
    fs.mkdirSync(path.join(root, 'web', 'node_modules'));
    fs.writeFileSync(path.join(root, 'web', 'node_modules', 'x.js'), 'x');
    const c = sourceStampOf(root);
    fs.writeFileSync(path.join(root, 'web', '.DS_Store'), 'yy');
    assert.equal(sourceStampOf(root), c, 'dot-files are ignored');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('code update → restart: the new process rebuilds a stale build, reuses a current one, and serves it', async () => {
  const root = tree();
  const outDir = path.join(root, '.cache', 'lan-ui');
  try {
    const b = builder(root);
    const first = createUiBuild({ root, outDir, build: b.build, stampTtlMs: 0 });
    assert.equal(await first.ensure(), true);
    assert.equal(b.builds, 1);
    const page = await get(first, '/');
    assert.match(page.body, /build 1 of console\.log\(1\)/);
    assert.equal(page.headers['Cache-Control'], 'no-cache');
    assert.match(String((await get(first, '/assets/app-1.js')).headers['Cache-Control']), /immutable/);
    assert.equal((await get(first, '/sw.js')).headers['Cache-Control'], 'no-cache', 'the service worker is always revalidated');
    assert.equal((await get(first, '/web/main.tsx')).status, 404, 'no sources from the build server');

    // "restart" without a code change: the build on disk is reused
    const same = createUiBuild({ root, outDir, build: b.build, stampTtlMs: 0 });
    assert.equal(await same.ensure(), true);
    assert.equal(b.builds, 1, 'reused, not rebuilt');

    // a sync pulls new web code, the learner restarts: the next process finds the stale stamp and rebuilds
    fs.writeFileSync(path.join(root, 'web', 'main.tsx'), 'console.log(2)');
    const restarted = createUiBuild({ root, outDir, build: b.build, stampTtlMs: 0 });
    assert.equal(await restarted.ensure(), true);
    assert.equal(b.builds, 2);
    assert.match((await get(restarted, '/')).body, /build 2 of console\.log\(2\)/);
    assert.equal(fs.readFileSync(path.join(outDir, '.source-stamp'), 'utf8'), restarted.stamp());
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('a running process keeps its build while a synced code update waits for the restart; local edits rebuild', async () => {
  const root = tree();
  const outDir = path.join(root, '.cache', 'lan-ui');
  try {
    const b = builder(root);
    let pending = false;
    const ui = createUiBuild({ root, outDir, build: b.build, stampTtlMs: 0, frozen: () => pending });
    await ui.ensure();
    pending = true; // sync received app code (version.ts pendingUpdate)
    fs.writeFileSync(path.join(root, 'web', 'main.tsx'), 'console.log(3)');
    assert.equal(await ui.ensure(), true);
    assert.equal(b.builds, 1, 'frozen: pages keep matching the server code');
    assert.match((await get(ui, '/')).body, /console\.log\(1\)/);
    pending = false; // no pending update (e.g. the learner edits web/ while `npm start` runs)
    await ui.ensure();
    assert.equal(b.builds, 2);
    assert.match((await get(ui, '/')).body, /console\.log\(3\)/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('a failed build is not retried until the sources change (the dev server stands in)', async () => {
  const root = tree();
  const outDir = path.join(root, '.cache', 'lan-ui');
  let calls = 0;
  try {
    const ui = createUiBuild({
      root,
      outDir,
      stampTtlMs: 0,
      build: async () => {
        calls++;
        return 'syntax error';
      },
    });
    const errors = console.error;
    console.error = () => undefined;
    try {
      assert.equal(await ui.ensure(), false);
      assert.equal(await ui.ensure(), false);
      assert.equal(calls, 1);
      assert.equal(ui.mode(), 'dev');
      fs.writeFileSync(path.join(root, 'web', 'main.tsx'), 'fixed');
      assert.equal(ui.mode(), 'dist');
      await ui.ensure();
      assert.equal(calls, 2);
    } finally {
      console.error = errors;
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('a page opened before a rebuild still gets its old lazy chunks (one previous build is kept, also across a restart)', async () => {
  const root = tree();
  const outDir = path.join(root, '.cache', 'lan-ui');
  let n = 0;
  const build = async (dir: string) => {
    n++;
    fs.mkdirSync(path.join(dir, 'assets'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), `<html>build ${n}</html>`);
    fs.writeFileSync(path.join(dir, 'assets', `Pair-v${n}.js`), `chunk ${n}`);
    return undefined;
  };
  try {
    const ui = createUiBuild({ root, outDir, build, stampTtlMs: 0 });
    await ui.ensure();
    fs.writeFileSync(path.join(root, 'web', 'main.tsx'), 'v2');
    await ui.ensure();
    assert.equal((await get(ui, '/assets/Pair-v2.js')).body, 'chunk 2');
    assert.equal((await get(ui, '/assets/Pair-v1.js')).body, 'chunk 1', 'the previous build’s chunk is still served');
    // restart + another rebuild: v2 is carried, v1 (already carried once) is dropped
    fs.writeFileSync(path.join(root, 'web', 'main.tsx'), 'v3');
    const restarted = createUiBuild({ root, outDir, build, stampTtlMs: 0 });
    await restarted.ensure();
    assert.equal((await get(restarted, '/assets/Pair-v3.js')).body, 'chunk 3');
    assert.equal((await get(restarted, '/assets/Pair-v2.js')).body, 'chunk 2');
    assert.equal((await get(restarted, '/assets/Pair-v1.js')).status, 404, 'only one generation is kept');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
