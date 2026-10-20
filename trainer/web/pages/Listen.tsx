// [v5 τ] #/listen — 🎧 hands-free mode, mobile-first. Short due questions are read aloud by the browser (speechSynthesis:
// English stem / options / answer, Vietnamese summary when the device has a Vietnamese voice), a pause to recall, then the
// answer; the learner self-grades 1–4 with big buttons, the keyboard or headset keys (Media Session API, kept alive by a
// silent looping audio element). Saved through POST /api/listen/finish as mode 'listen' (source 'listen': FSRS grade = the
// self-grade, never part of readiness). "📒 Bản tin" (`?mode=briefing`) reads the notebook's rules aloud — no AI.
// Works over LAN HTTP: speechSynthesis needs no secure context; no microphone is used.
import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.ts';
import { href, navigate, useRoute } from '../lib/router.ts';
import { Empty, ErrorBox, Seg } from '../components/ui.tsx';
import type { ListenFinishResponse, ListenItem, ListenNext, NotebookEntry, NotebookView } from '../../shared/types.ts';
import '../styles-tutor.css';

type Phase = 'stem' | 'options' | 'recall' | 'answer' | 'grade';
type Grade = 1 | 2 | 3 | 4;
const PHASES: Phase[] = ['stem', 'options', 'recall', 'answer', 'grade'];
const PHASE_LABEL: Record<Phase, string> = { stem: '🔊 Đang đọc đề', options: '🔊 Đang đọc các lựa chọn', recall: '🤔 Tự nhớ đáp án', answer: '🔊 Đang đọc đáp án', grade: '✍️ Tự chấm' };
const GRADES: { g: Grade; label: string; hint: string }[] = [
  { g: 1, label: 'Quên', hint: 'không nhớ ra' },
  { g: 2, label: 'Khó', hint: 'nhớ lờ mờ' },
  { g: 3, label: 'Nhớ', hint: 'nhớ đúng' },
  { g: 4, label: 'Dễ', hint: 'nhớ ngay' },
];

interface Settings {
  count: number;
  pause: number; // seconds to recall
  rate: number;
  readOptions: boolean;
  readExplain: boolean;
  readVi: boolean;
  showText: boolean;
}
const DEFAULTS: Settings = { count: 10, pause: 5, rate: 1, readOptions: true, readExplain: true, readVi: true, showText: true };
const STORE_KEY = 'trainer.listen';

function loadSettings(): Settings {
  try {
    return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}') as Partial<Settings>) };
  } catch {
    return DEFAULTS;
  }
}

/** crypto.randomUUID needs a secure context — the phone over LAN HTTP has none. */
function sessionId(): string {
  try {
    if (crypto.randomUUID) return `listen:${crypto.randomUUID()}`;
  } catch {
    // insecure context
  }
  return `listen:${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// ── speech ──────────────────────────────────────────────────────────────────

const synth = (): SpeechSynthesis | undefined => (typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : undefined);

/** Sentences of at most ~180 characters (long utterances get cut off in some browsers). */
export function speechChunks(text: string): string[] {
  const out: string[] = [];
  for (const s of text.replace(/\s+/g, ' ').trim().split(/(?<=[.!?;:])\s+/)) {
    let rest = s;
    while (rest.length > 180) {
      const cut = Math.max(rest.lastIndexOf(', ', 180), rest.lastIndexOf(' ', 180));
      const at = cut > 60 ? cut + 1 : 180;
      out.push(rest.slice(0, at).trim());
      rest = rest.slice(at).trim();
    }
    if (rest) out.push(rest);
  }
  return out;
}

function pickVoice(voices: SpeechSynthesisVoice[], lang: 'en' | 'vi'): SpeechSynthesisVoice | undefined {
  const list = voices.filter((v) => v.lang.toLowerCase().replace('_', '-').startsWith(lang));
  if (lang === 'en') return list.find((v) => /en-us/i.test(v.lang) && v.localService) ?? list.find((v) => /en-us/i.test(v.lang)) ?? list[0];
  return list.find((v) => v.localService) ?? list[0];
}

function useVoices(): { en?: SpeechSynthesisVoice; vi?: SpeechSynthesisVoice } {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() => synth()?.getVoices() ?? []);
  useEffect(() => {
    const s = synth();
    if (!s) return;
    const on = () => setVoices(s.getVoices());
    s.addEventListener?.('voiceschanged', on);
    const t = setTimeout(on, 600);
    return () => {
      s.removeEventListener?.('voiceschanged', on);
      clearTimeout(t);
    };
  }, []);
  return { en: pickVoice(voices, 'en'), vi: pickVoice(voices, 'vi') };
}

/** One utterance; resolves when it ends, fails, or after a generous timeout (some browsers never fire `end`). */
function speakOnce(text: string, voice: SpeechSynthesisVoice | undefined, lang: string, rate: number): Promise<void> {
  const s = synth();
  if (!s || !text) return Promise.resolve();
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    if (voice) u.voice = voice;
    u.lang = voice?.lang ?? lang;
    u.rate = rate;
    const done = () => {
      clearTimeout(t);
      resolve();
    };
    const t = setTimeout(done, 4000 + (text.length * 110) / rate);
    u.onend = done;
    u.onerror = done;
    s.speak(u);
  });
}

/** A few seconds of silence, looped while listening: browsers route headset / media keys only to a page playing media. */
function silentAudio(): HTMLAudioElement | undefined {
  try {
    const rate = 8000;
    const n = rate * 10;
    const buf = new ArrayBuffer(44 + n);
    const v = new DataView(buf);
    const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
    str(0, 'RIFF');
    v.setUint32(4, 36 + n, true);
    str(8, 'WAVE');
    str(12, 'fmt ');
    v.setUint32(16, 16, true);
    v.setUint16(20, 1, true); // PCM
    v.setUint16(22, 1, true); // mono
    v.setUint32(24, rate, true);
    v.setUint32(28, rate, true);
    v.setUint16(32, 1, true);
    v.setUint16(34, 8, true);
    str(36, 'data');
    v.setUint32(40, n, true);
    new Uint8Array(buf, 44).fill(128);
    const a = new Audio(URL.createObjectURL(new Blob([buf], { type: 'audio/wav' })));
    a.loop = true;
    return a;
  } catch {
    return undefined;
  }
}

// ── page ────────────────────────────────────────────────────────────────────

export function Listen() {
  const route = useRoute();
  const mode = route.query.get('mode') === 'briefing' ? 'briefing' : 'questions';
  const speechOk = !!synth();
  return (
    <div className="ls-wrap">
      <div className="page-head">
        <div>
          <h1>🎧 Nghe</h1>
          <p>Học rảnh tay: nghe đề, tự nhớ, nghe đáp án rồi tự chấm — khi đi đường, tập thể dục.</p>
        </div>
      </div>
      <Seg
        value={mode}
        onChange={(m) => navigate(m === 'briefing' ? '/listen?mode=briefing' : '/listen')}
        items={[
          { id: 'questions', label: '🎧 Câu hỏi ngắn' },
          { id: 'briefing', label: '📒 Bản tin sổ lỗi' },
        ]}
      />
      {!speechOk && <div className="alert warn small">⚠️ Trình duyệt này không đọc to được (thiếu speechSynthesis) — vẫn xem chữ và tự chấm được.</div>}
      {mode === 'briefing' ? <Briefing /> : <Questions />}
    </div>
  );
}

function Questions() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const voices = useVoices();
  const [items, setItems] = useState<ListenItem[]>();
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>('stem');
  const [count, setCount] = useState(0);
  const [paused, setPaused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState<ListenFinishResponse>();
  const [graded, setGraded] = useState<{ q: string; grade: Grade; t: number }[]>([]);
  const eng = useRef({ token: 0, items: [] as ListenItem[], idx: 0, phase: 'stem' as Phase, itemStart: 0, started: '', session: '', grades: [] as { q: string; grade: Grade; t: number }[], saved: false, audio: undefined as HTMLAudioElement | undefined });
  const live = useRef({ settings, voices });
  live.current = { settings, voices };
  const actions = useRef({ next: () => undefined as void, prev: () => undefined as void, toggle: () => undefined as void });

  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(settings));
    } catch {
      // private mode: settings are per visit
    }
  }, [settings]);

  const say = (text: string, lang: 'en' | 'vi', my: number) =>
    speechChunks(text).reduce<Promise<void>>(
      (p, c) => p.then(() => (eng.current.token === my ? speakOnce(c, lang === 'vi' ? live.current.voices.vi : live.current.voices.en, lang === 'vi' ? 'vi-VN' : 'en-US', live.current.settings.rate) : undefined)),
      Promise.resolve(),
    );

  const wait = (sec: number, my: number) =>
    new Promise<void>((resolve) => {
      let left = sec;
      setCount(left);
      const t = setInterval(() => {
        left -= 1;
        if (eng.current.token !== my || left <= 0) {
          clearInterval(t);
          setCount(0);
          resolve();
        } else setCount(left);
      }, 1000);
    });

  const play = async (i: number, from: Phase) => {
    const e = eng.current;
    const my = ++e.token;
    synth()?.cancel();
    const it = e.items[i];
    if (!it) return;
    e.idx = i;
    setIdx(i);
    setPaused(false);
    if (from === 'stem') e.itemStart = Date.now();
    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({ title: `Câu ${i + 1}/${e.items.length}`, artist: 'SAA-C03 Trainer · 🎧 Nghe', album: it.topic });
        navigator.mediaSession.playbackState = 'playing';
      } catch {
        // MediaMetadata missing
      }
    }
    const s = live.current.settings;
    for (const ph of PHASES.slice(PHASES.indexOf(from))) {
      if (e.token !== my) return;
      e.phase = ph;
      setPhase(ph);
      if (ph === 'stem') await say(it.stem, 'en', my);
      else if (ph === 'options' && s.readOptions) {
        for (const o of it.options) if (e.token === my) await say(`${o.key}. ${o.text}`, 'en', my);
      } else if (ph === 'recall') await wait(s.pause, my);
      else if (ph === 'answer') {
        const keys = it.options.filter((o) => it.answer.includes(o.key)).map((o) => `${o.key}. ${o.text}`);
        await say(`Answer: ${keys.join('. And ')}.`, 'en', my);
        if (s.readExplain && it.explanation) await say(it.explanation, 'en', my);
        if (s.readVi && it.vi && live.current.voices.vi) await say(it.vi, 'vi', my);
      }
    }
  };

  const save = async (opts: { keepalive?: boolean } = {}) => {
    const e = eng.current;
    if (e.saved || !e.grades.length) return;
    e.saved = true;
    const body = JSON.stringify({ sessionId: e.session, started: e.started, finished: new Date().toISOString(), items: e.grades });
    if (opts.keepalive) {
      void fetch('/api/listen/finish', { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json', 'X-Trainer': '1' }, body }).catch(() => undefined);
      return;
    }
    try {
      const r = await api.post<ListenFinishResponse>('/api/listen/finish', JSON.parse(body));
      setSaved(r);
    } catch (x) {
      e.saved = false;
      setError(`Chưa lưu được kết quả nghe: ${(x as Error).message}`);
    }
  };

  const stop = () => {
    const e = eng.current;
    e.token++;
    synth()?.cancel();
    e.audio?.pause();
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none';
  };

  const finish = () => {
    stop();
    void save();
    setPhase('grade');
    eng.current.idx = eng.current.items.length;
    setIdx(eng.current.items.length);
  };

  const grade = (g: Grade) => {
    const e = eng.current;
    const it = e.items[e.idx];
    if (!it || (e.phase !== 'answer' && e.phase !== 'grade')) return;
    const rec = { q: it.id, grade: g, t: Math.round((Date.now() - e.itemStart) / 1000) };
    e.grades = [...e.grades.filter((x) => x.q !== it.id), rec];
    setGraded(e.grades);
    if (e.idx + 1 < e.items.length) void play(e.idx + 1, 'stem');
    else finish();
  };

  const reveal = () => {
    const e = eng.current;
    if (e.phase === 'stem' || e.phase === 'options' || e.phase === 'recall') void play(e.idx, 'answer');
  };

  const toggle = () => {
    const e = eng.current;
    if (paused) {
      e.audio?.play().catch(() => undefined);
      void play(e.idx, e.phase === 'options' ? 'stem' : e.phase);
    } else {
      e.token++;
      synth()?.cancel();
      setPaused(true);
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
    }
  };

  actions.current = {
    next: () => (eng.current.phase === 'answer' || eng.current.phase === 'grade' ? grade(3) : reveal()),
    prev: () => (eng.current.phase === 'answer' || eng.current.phase === 'grade' ? grade(1) : void play(eng.current.idx, 'stem')),
    toggle,
  };

  const start = async () => {
    setLoading(true);
    setError(undefined);
    setSaved(undefined);
    try {
      const r = await api.get<ListenNext>(`/api/listen/next?n=${settings.count}`);
      const e = eng.current;
      Object.assign(e, { items: r.items, idx: 0, grades: [], saved: false, started: new Date().toISOString(), session: sessionId() });
      setGraded([]);
      setItems(r.items);
      if (!r.items.length) return;
      // started by a tap: the silent loop + the first utterance are allowed to play (iOS / Android autoplay rules)
      e.audio ??= silentAudio();
      e.audio?.play().catch(() => undefined);
      if ('mediaSession' in navigator) {
        const h = (a: MediaSessionAction, fn: () => void) => {
          try {
            navigator.mediaSession.setActionHandler(a, fn);
          } catch {
            // action not supported here
          }
        };
        h('play', () => actions.current.toggle());
        h('pause', () => actions.current.toggle());
        h('nexttrack', () => actions.current.next());
        h('previoustrack', () => actions.current.prev());
      }
      void play(0, 'stem');
    } catch (x) {
      setError((x as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const t = ev.target as HTMLElement | null;
      if (!eng.current.items.length || eng.current.idx >= eng.current.items.length || (t && /^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(t.tagName))) return;
      if (ev.key >= '1' && ev.key <= '4') grade(Number(ev.key) as Grade);
      else if (ev.key === ' ') {
        ev.preventDefault();
        actions.current.toggle();
      } else if (ev.key === 'Enter' || ev.key === 'ArrowRight') actions.current.next();
      else if (ev.key.toLowerCase() === 'r') void play(eng.current.idx, 'stem');
    };
    window.addEventListener('keydown', onKey);
    const onHide = () => void save({ keepalive: true });
    window.addEventListener('pagehide', onHide);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pagehide', onHide);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused]);

  useEffect(
    () => () => {
      stop();
      void save({ keepalive: true }); // leaving the page mid-session keeps what was graded
      if ('mediaSession' in navigator) for (const a of ['play', 'pause', 'nexttrack', 'previoustrack'] as MediaSessionAction[]) navigator.mediaSession.setActionHandler(a, null);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setSettings((s) => ({ ...s, [k]: v }));
  const running = !!items?.length && idx < items.length;
  const it = running ? items![idx] : undefined;
  const revealed = phase === 'answer' || phase === 'grade';

  if (!running) {
    const done = graded.length > 0;
    return (
      <div className="stack">
        {done && (
          <div className="card ls-card">
            <b>✅ Xong phiên nghe: {graded.length} câu · nhớ {graded.filter((g) => g.grade >= 3).length}</b>
            {saved ? (
              <div className="small">
                Đã lưu vào lịch sử (bài “Nghe”, tự chấm — không tính vào mức sẵn sàng). <a href={href(`/result/${encodeURIComponent(saved.id)}`)}>Xem bài</a>
              </div>
            ) : (
              <div className="small muted">Đang lưu…</div>
            )}
          </div>
        )}
        {items && !items.length && (
          <Empty icon="🎧" title="Hôm nay không còn câu ngắn nào để nghe">
            Các câu đến hạn / chưa thuộc có đề ≤ 40 từ đã được làm hôm nay. Thử “📒 Bản tin sổ lỗi”.
          </Empty>
        )}
        <ErrorBox error={error} />
        <div className="card ls-card">
          <b>Cài đặt</b>
          <div className="ls-settings">
            <label>
              Số câu
              <select value={settings.count} onChange={(e) => set('count', Number(e.target.value))}>
                {[5, 10, 20, 30].map((n) => (
                  <option key={n} value={n}>
                    {n} câu
                  </option>
                ))}
              </select>
            </label>
            <label>
              Thời gian tự nhớ
              <select value={settings.pause} onChange={(e) => set('pause', Number(e.target.value))}>
                {[3, 5, 8, 12].map((n) => (
                  <option key={n} value={n}>
                    {n} giây
                  </option>
                ))}
              </select>
            </label>
            <label>
              Tốc độ đọc
              <select value={settings.rate} onChange={(e) => set('rate', Number(e.target.value))}>
                {[0.8, 0.9, 1, 1.15, 1.3].map((n) => (
                  <option key={n} value={n}>
                    ×{n}
                  </option>
                ))}
              </select>
            </label>
            <label className="check">
              <input type="checkbox" checked={settings.readOptions} onChange={(e) => set('readOptions', e.target.checked)} /> Đọc các lựa chọn
            </label>
            <label className="check">
              <input type="checkbox" checked={settings.readExplain} onChange={(e) => set('readExplain', e.target.checked)} /> Đọc giải thích
            </label>
            <label className="check">
              <input type="checkbox" checked={settings.readVi} onChange={(e) => set('readVi', e.target.checked)} /> Đọc tóm tắt 🇻🇳
            </label>
            <label className="check">
              <input type="checkbox" checked={settings.showText} onChange={(e) => set('showText', e.target.checked)} /> Hiện chữ trên màn hình
            </label>
          </div>
          <div className="tiny muted">
            Giọng: {voices.en ? `🇺🇸 ${voices.en.name}` : '🇺🇸 mặc định'} · {voices.vi ? `🇻🇳 ${voices.vi.name}` : '🇻🇳 máy này chưa có giọng tiếng Việt (tóm tắt chỉ hiện chữ)'}
          </div>
          <button className="btn primary lg" onClick={() => void start()} disabled={loading}>
            {loading ? 'Đang chuẩn bị…' : done ? '▶ Nghe tiếp' : '▶ Bắt đầu nghe'}
          </button>
          <div className="tiny muted ins-wrap">
            Câu đến hạn ôn và câu chưa thuộc, đề ngắn (≤ 40 từ). Phím: <span className="kbd">1</span>–<span className="kbd">4</span> tự chấm ·{' '}
            <span className="kbd">Space</span> tạm dừng · <span className="kbd">Enter</span> hiện đáp án. Tai nghe: ⏯ tạm dừng / tiếp · ⏭ hiện đáp án, rồi chấm “Nhớ” · ⏮
            chấm “Quên”. Kết quả lưu như một bài “🎧 Nghe” (tự chấm: dùng cho lịch ôn FSRS, không tính vào mức sẵn sàng).
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="ls-progress" aria-hidden>
        <div style={{ width: `${(idx / items!.length) * 100}%` }} />
      </div>
      <div className="card ls-card">
        <div className="row between">
          <span className="ls-phase" aria-live="polite">
            {paused ? '⏸ Tạm dừng' : PHASE_LABEL[phase]} · câu {idx + 1}/{items!.length}
          </span>
          {it!.due && <span className="badge accent">đến hạn ôn</span>}
        </div>
        {settings.showText && <div className="ls-stem">{it!.stem}</div>}
        {settings.showText && (
          <ol className="ls-options">
            {it!.options.map((o) => (
              <li key={o.key} className={revealed && it!.answer.includes(o.key) ? 'ok' : ''}>
                {o.key}. {o.text}
              </li>
            ))}
          </ol>
        )}
        {phase === 'recall' && !paused && <div className="ls-count">{count}</div>}
        {revealed && (
          <div className="stack sm">
            <div className="tu-answer">
              ✅ {it!.options.filter((o) => it!.answer.includes(o.key)).map((o) => `${o.key}. ${o.text}`).join(' · ')}
            </div>
            {it!.explanation && <div className="small">{it!.explanation}</div>}
            {it!.vi && <div className="small">🇻🇳 {it!.vi}</div>}
          </div>
        )}
        {revealed ? (
          <div className="ls-grades">
            {GRADES.map((x) => (
              <button key={x.g} className={`btn g${x.g}`} onClick={() => grade(x.g)}>
                {x.g} · {x.label}
                <small>{x.hint}</small>
              </button>
            ))}
          </div>
        ) : (
          <button className="btn primary lg" onClick={reveal}>
            👁 Hiện đáp án ngay
          </button>
        )}
        <div className="ls-controls">
          <button className="btn" onClick={toggle}>
            {paused ? '▶ Tiếp' : '⏸ Tạm dừng'}
          </button>
          <button className="btn" onClick={() => void play(idx, 'stem')}>
            🔁 Đọc lại
          </button>
          <button className="btn" onClick={finish}>
            ⏹ Kết thúc & lưu
          </button>
        </div>
      </div>
      <ErrorBox error={error} />
      <div className="tiny muted ins-wrap">
        Đã chấm {graded.length} câu. Tai nghe: ⏯ tạm dừng · ⏭ {revealed ? 'chấm “Nhớ”' : 'hiện đáp án'} · ⏮ {revealed ? 'chấm “Quên”' : 'đọc lại'}.
      </div>
    </div>
  );
}

// ── 📒 briefing: the notebook read aloud (no AI) ────────────────────────────

function Briefing() {
  const voices = useVoices();
  const [entries, setEntries] = useState<NotebookEntry[]>();
  const [error, setError] = useState<string>();
  const [i, setI] = useState(-1);
  const token = useRef(0);
  const rate = useRef(loadSettings().rate);

  useEffect(() => {
    api
      .get<NotebookView>('/api/notebook')
      .then((v) => setEntries([...v.entries].sort((a, b) => Number(b.confident) - Number(a.confident) || b.count - a.count)))
      .catch((e: Error) => setError(e.message));
    return () => {
      token.current++;
      synth()?.cancel();
    };
  }, []);

  const read = async (k: number) => {
    const list = entries ?? [];
    const my = ++token.current;
    synth()?.cancel();
    for (let j = k; j < list.length && token.current === my; j++) {
      setI(j);
      const e = list[j];
      const parts: [string, 'vi' | 'en'][] = [
        [`Mục ${j + 1}. ${e.title || ''}`, 'vi'],
        [`Bạn nghĩ: ${e.misconception}`, 'vi'],
        [`Thực ra: ${e.rule}`, 'vi'],
        ...(e.cues.length ? ([[`Cues: ${e.cues.join('. ')}`, 'en']] as [string, 'en'][]) : []),
      ];
      for (const [text, lang] of parts) {
        for (const c of speechChunks(text)) if (token.current === my) await speakOnce(c, lang === 'vi' ? voices.vi : voices.en, lang === 'vi' ? 'vi-VN' : 'en-US', rate.current);
      }
      if (token.current === my) await new Promise((r) => setTimeout(r, 1200));
    }
    if (token.current === my) setI(-1);
  };
  const stopAll = () => {
    token.current++;
    synth()?.cancel();
    setI(-1);
  };

  if (error) return <ErrorBox error={error} />;
  if (!entries) return <div className="small muted">Đang tải sổ lỗi…</div>;
  if (!entries.length)
    return (
      <Empty icon="📒" title="Sổ lỗi còn trống">
        Mở <a href={href('/notes?tab=notebook')}>Tài liệu → 📒 Sổ lỗi</a> và bấm “📒 Cập nhật sổ”, hoặc dùng 🧑‍🏫 Gia sư ở một câu sai.
      </Empty>
    );
  const cur = i >= 0 ? entries[i] : undefined;
  return (
    <div className="stack">
      <div className="card ls-card">
        <div className="small">
          {entries.length} quy tắc (🔥 sai dù chắc chắn đọc trước). {voices.vi ? '' : 'Máy này chưa có giọng tiếng Việt — chữ vẫn hiện bên dưới.'}
        </div>
        {cur && (
          <div className="stack sm" aria-live="polite">
            <b>
              {cur.confident ? '🔥 ' : ''}
              {cur.title || cur.key}
            </b>
            <div className="nb-line">❌ Bạn nghĩ: {cur.misconception}</div>
            <div className="nb-line">✅ Thực ra: {cur.rule}</div>
            {cur.cues.length > 0 && <div className="small muted">🔎 {cur.cues.join(' · ')}</div>}
          </div>
        )}
        <div className="ls-controls">
          {i < 0 ? (
            <button className="btn primary lg" onClick={() => void read(0)}>
              ▶ Nghe bản tin
            </button>
          ) : (
            <>
              <button className="btn" onClick={() => void read(Math.max(0, i - 1))}>
                ⏮ Trước
              </button>
              <button className="btn" onClick={stopAll}>
                ⏹ Dừng
              </button>
              <button className="btn" onClick={() => (i + 1 < entries.length ? void read(i + 1) : stopAll())}>
                ⏭ Tiếp
              </button>
            </>
          )}
        </div>
      </div>
      <ol className="ls-options">
        {entries.map((e, k) => (
          <li key={e.key} className={k === i ? 'ok' : ''}>
            {e.confident ? '🔥 ' : ''}
            {e.title || e.key} — <span className="small">{e.rule}</span>
          </li>
        ))}
      </ol>
      <div className="tiny muted">
        Quản lý các mục ở <a href={href('/notes?tab=notebook')}>Tài liệu → 📒 Sổ lỗi</a>. Bản tin chỉ đọc lại sổ lỗi đã có — không gọi AI.
      </div>
    </div>
  );
}
