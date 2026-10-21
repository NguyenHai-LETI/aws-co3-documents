// [v5] π SAA-C03 Trainer mod for Claude Code (mods API, Claude Code ≥ 2.1.287; terminal + Desktop app).
// While Claude works, the band above the prompt shows one short question from the trainer (GET /api/micro/next). Answer
// with the buttons or by typing the digit alone into the empty prompt (1 = A, 2 = B, …): the trainer grades it, adds it to
// today's "☕ Câu hỏi nhanh" result file and the band shows ✅/❌, the answer and one line of explanation. No model call,
// nothing Claude reads (the command returns no text). The trainer app must be running (npm start / npm run service).
//   /saa off · /saa on · /saa next (another question) · /saa status · /saa port 4000
// Load: `claude --plugin-dir trainer/integrations/claude-code/mod` (one session), or add trainer/integrations/claude-code
// as a plugin marketplace and install `saa-trainer-micro` (/plugin). Turn off: /saa off, or disable the plugin in /plugin.
// Plain JavaScript without the 'claude-code' module, so tests/micro-mod.test.ts can run it with a fake `on` / `$`
// (state lives in module variables; a test imports a fresh copy per case).

const RESULT_MS = 20_000; // a result stays visible this long after Claude finished

let enabled = true;
let port = 3003;
let question = null; // MicroQuestion
let picked = []; // keys chosen so far (questions with "chọn 2")
let shownAt = 0;
let result = null; // { ok, keyLabels, correct, explanation, today, at, repeat }
let note = ''; // why there is no question
let loading = false;
let sending = false;

const base = () => `http://127.0.0.1:${port}`;

async function call($, path, body) {
  const init = body === undefined ? { method: 'GET' } : { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Trainer': '1' }, body: JSON.stringify(body) };
  const r = await $.http.fetch(base() + path, init);
  let data;
  try {
    data = JSON.parse(r.text || 'null');
  } catch {
    data = null;
  }
  if (!r.ok) throw new Error((data && data.error) || `HTTP ${r.status}`);
  return data;
}

async function load($) {
  if (loading || !enabled) return;
  loading = true;
  try {
    const next = await call($, '/api/micro/next');
    question = next && next.question ? next.question : null;
    note = question ? '' : (next && next.note) || '';
    picked = [];
    shownAt = 0;
  } catch {
    question = null; // the trainer is not running: draw nothing
    note = '';
  } finally {
    loading = false;
    $.ui.invalidate('ui.render');
  }
}

async function answer($, key) {
  if (!question || sending) return;
  picked = picked.includes(key) ? picked.filter((k) => k !== key) : [...picked, key];
  if (picked.length < question.choose) {
    $.ui.invalidate('ui.render');
    return;
  }
  sending = true;
  const q = question;
  const t = shownAt ? Math.round((Date.now() - shownAt) / 1000) : 0;
  try {
    const r = await call($, '/api/micro/answer', { q: q.id, pick: picked, t });
    result = { ok: r.ok, keyLabels: r.keyLabels, correct: r.correct, explanation: r.explanation, today: r.today, repeat: !!r.repeat, at: Date.now() };
    question = null;
  } catch (e) {
    $.ui.toast(`SAA: chưa lưu được câu trả lời (${e.message})`);
  } finally {
    picked = [];
    sending = false;
    $.ui.invalidate('ui.render');
  }
}

async function save($) {
  try {
    await $.store.set('settings', { enabled, port });
  } catch {
    // the store is optional
  }
}

function questionTree(ui, $, width) {
  const { Box, Text, Button } = ui;
  const head = `☕ SAA-C03${question.topicLabel ? ` · ${question.topicLabel}` : ''}${question.due ? ' · đến hạn ôn' : ''}${question.choose > 1 ? ` · chọn ${question.choose}` : ''}`;
  return Box({
    flexDirection: 'column',
    children: [
      Text({ dimColor: true, children: [head] }),
      Text({ wrap: 'wrap', children: [question.stem] }),
      ...question.options.map((o) => {
        const line = `${o.label}. ${o.text}`.slice(0, Math.max(20, width * 2));
        return picked.includes(o.key) ? Text({ wrap: 'truncate-end', color: 'cyan', children: [line] }) : Text({ wrap: 'truncate-end', children: [line] });
      }),
      Box({
        flexDirection: 'row',
        columnGap: 2,
        children: [
          ...question.options.map((o, i) =>
            Button({ key: `pick-${o.key}`, label: o.label, hotkey: String(i + 1), plain: true, onPress: () => answer($, o.key) }),
          ),
          Text({ dimColor: true, children: ['gõ số rồi dừng tay · /saa off để tắt'] }),
        ],
      }),
    ],
  });
}

function resultTree(ui, $) {
  const { Box, Text, Button } = ui;
  const verdict = result.ok ? '✅ Đúng' : `❌ Sai — đáp án ${result.keyLabels}: ${result.correct.map((c) => c.text).join(' · ')}`;
  return Box({
    flexDirection: 'column',
    children: [
      Text({ color: result.ok ? 'green' : 'red', wrap: 'truncate-end', children: [verdict] }),
      Text({ dimColor: true, wrap: 'wrap', children: [result.explanation] }),
      Box({
        flexDirection: 'row',
        columnGap: 2,
        children: [
          Text({ dimColor: true, children: [`Hôm nay ☕ ${result.today.correct}/${result.today.answered}${result.repeat ? ' · câu lặp lại không tính điểm' : ''}`] }),
          Button({
            key: 'next',
            label: 'Câu khác',
            hotkey: '0',
            plain: true,
            onPress: () => {
              result = null;
              void load($);
            },
          }),
        ],
      }),
    ],
  });
}

export function register(on) {
  on('session.start', async ($, e, next) => {
    try {
      const saved = await $.store.get('settings');
      if (saved && typeof saved === 'object') {
        if (typeof saved.enabled === 'boolean') enabled = saved.enabled;
        if (Number(saved.port) > 0) port = Number(saved.port);
      }
    } catch {
      // defaults
    }
    try {
      await $.command.register({ name: 'saa', description: 'SAA-C03: câu hỏi nhanh khi chờ Claude (on | off | next | status | port N)', argumentHint: '[on|off|next|status|port N]', immediate: true });
    } catch {
      // name taken: the band still works
    }
    return next(e);
  });

  // a new turn: fetch a question if none is waiting (the previous result makes room for it)
  on('turn.start', async ($, e, next) => {
    if (enabled && !question && !loading) {
      result = null;
      void load($);
    }
    return next(e);
  });

  on('command.run', { command: 'saa' }, async ($, e) => {
    const [cmd, arg] = String(e.args || '').trim().split(/\s+/);
    if (cmd === 'off') {
      enabled = false;
      question = null;
      result = null;
      await save($);
      $.ui.toast('SAA: đã tắt câu hỏi nhanh (/saa on để bật lại)');
    } else if (cmd === 'on') {
      enabled = true;
      await save($);
      await load($);
      $.ui.toast(question ? 'SAA: đã bật — câu hỏi hiện khi Claude đang làm việc' : 'SAA: đã bật (chưa có câu — trainer đang chạy chưa?)');
    } else if (cmd === 'port' && Number(arg) > 0) {
      port = Number(arg);
      await save($);
      await load($);
      $.ui.toast(`SAA: dùng trainer ở cổng ${port}`);
    } else if (cmd === 'next') {
      result = null;
      await load($);
      if (!question) $.ui.toast(note || `SAA: không lấy được câu hỏi — trainer có đang chạy ở cổng ${port}?`);
    } else {
      try {
        const s = await call($, '/api/micro/status');
        $.ui.toast(`SAA: ${s.line}${enabled ? '' : ' · (đang tắt)'}`);
      } catch {
        $.ui.toast(`SAA: trainer không chạy ở cổng ${port} (npm start trong thư mục trainer)`);
      }
    }
    $.ui.invalidate('ui.render');
    return {};
  });

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (!enabled) return next(e);
    const working = !!(e.props && e.props.isWorking);
    const freshResult = result && (working || Date.now() - result.at < RESULT_MS);
    if (!freshResult && !(working && question)) return next(e);
    const ui = $.ui.resolve(e);
    const width = (e.props && e.props.bodyColumns) || 80;
    let mine;
    if (freshResult) mine = resultTree(ui, $);
    else {
      if (!shownAt) shownAt = Date.now();
      mine = questionTree(ui, $, width);
    }
    const theirs = await next(e);
    return theirs ? ui.Box({ flexDirection: 'column', children: [mine, theirs] }) : mine;
  });
}
