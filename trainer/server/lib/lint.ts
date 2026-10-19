// Deterministic item-writing-flaw checks for one question (owned by workstream [Q]).
// Used by: Bank → Chất lượng, `npm run validate -- --lint`, and the AI pipeline ([D]) to reject edits or generated
// questions that introduce new flaws (compare lintQuestion(before) vs lintQuestion(after) by `code`).
//
// Severity — what the AI pipeline does with a flaw an edit introduces:
//   high   = the item is broken or the answer can be read off without knowing AWS (duplicate options, "All of the
//            above", "Choose TWO" ≠ number of keys, option letters in the explanation) → the edit is rejected;
//   medium = a test-wise cue or a style flaw worth fixing (correct option longest, stem echo, absolute words,
//            unemphasized NOT, a/an cue, overlapping options) → warning;
//   low    = maintenance work for ENRICH (short explanation) → warning.
// Codes are stable: they are stored nowhere, but patch reports, the UI and `validate --lint` refer to them.
import { LETTER_REF_RE } from './pack-format.ts';
import { countWords } from '../../shared/timing.ts';
import type { BankState } from './bank.ts';
import type { LintFlaw, LintSeverity, LintSummary, Question, Taxonomy } from '../../shared/types.ts';

export type LintInput = Pick<Question, 'id' | 'stem' | 'options' | 'answer' | 'explanation'>;

export interface LintRule {
  code: string;
  severity: LintSeverity;
  label: string; // Vietnamese, short (rule list, summary)
  fix: string; // Vietnamese, how to fix (UI, validate --lint)
}

export const LINT_RULES: readonly LintRule[] = [
  { code: 'duplicate-options', severity: 'high', label: 'Hai phương án trùng nhau', fix: 'Viết lại một phương án thành một lựa chọn khác hẳn.' },
  { code: 'all-none-above', severity: 'high', label: '“Tất cả / Không phương án nào ở trên”', fix: 'Thay bằng một giải pháp cụ thể — app xáo thứ tự nên “ở trên”, “cả A và B” trỏ sai.' },
  { code: 'choose-count', severity: 'high', label: 'Số đáp án ≠ “Choose N”', fix: 'Sửa “(Choose TWO/THREE)” trong đề cho khớp số khoá trong **Answer:**.' },
  { code: 'letter-ref', severity: 'high', label: 'Giải thích nhắc chữ cái đáp án', fix: 'Gọi phương án bằng nội dung (“Read Replicas: …”), không bằng A/B/C.' },
  { code: 'longest-correct', severity: 'medium', label: 'Đáp án đúng dài nhất', fix: 'ENRICH “balance”: viết phương án nhiễu dài tương đương, cùng dáng câu.' },
  { code: 'stem-echo', severity: 'medium', label: 'Đáp án đúng lặp từ của đề', fix: 'Đưa từ đó vào cả phương án nhiễu, hoặc diễn đạt đáp án đúng khác đi.' },
  { code: 'absolute-terms', severity: 'medium', label: 'Từ tuyệt đối ở phương án nhiễu', fix: 'Bỏ “always/never/only/all/none/guarantee” khỏi phương án nhiễu — người học loại ngay.' },
  { code: 'negative-stem', severity: 'medium', label: 'Câu hỏi phủ định không nhấn mạnh', fix: 'Viết hoa NOT / EXCEPT / LEAST (như đề thật) hoặc hỏi theo hướng khẳng định.' },
  { code: 'grammar-cue', severity: 'medium', label: 'Mạo từ a/an lộ đáp án', fix: 'Kết thúc đề bằng câu hỏi trọn vẹn, không để “a/an” trước phương án.' },
  { code: 'overlapping-options', severity: 'medium', label: 'Phương án chồng lấn nhau', fix: 'Mỗi phương án phải loại trừ nhau — phương án dài chứa trọn phương án ngắn thì cũng “đúng”.' },
  { code: 'short-explanation', severity: 'low', label: 'Giải thích quá ngắn', fix: 'ENRICH “explain”: vì sao đúng + từng phương án nhiễu + tóm tắt 🇻🇳.' },
];

const RULE = new Map(LINT_RULES.map((r) => [r.code, r]));
const SEVERITY_RANK: Record<LintSeverity, number> = { high: 0, medium: 1, low: 2 };
const CODE_RANK = new Map(LINT_RULES.map((r, i) => [r.code, i]));

export const LONGEST_RATIO = 1.15;
export const SHORT_EXPLANATION_WORDS = 15;
const MAX_SUMMARY_QUESTIONS = 20; // full lists per rule: LintSummary.ids / lintQuestionsFor()

// ── text helpers ────────────────────────────────────────────────────────────

/** Lower-case text without Markdown emphasis, code ticks and link targets. */
function plain(text: string): string {
  return text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[`*~]|\b_+|_+\b/g, ' ')
    .toLowerCase();
}

function words(text: string): string[] {
  return plain(text).match(/[\p{L}\p{N}][\p{L}\p{N}'’@.-]*[\p{L}\p{N}]|[\p{L}\p{N}]/gu) ?? [];
}

/** Text compared for equality / containment: words only, single spaces. */
function norm(text: string): string {
  return words(text).join(' ');
}

const quote = (s: string) => `“${s}”`;
const correctKeys = (q: Pick<Question, 'answer'>) => new Set(q.answer);

// ── rules ───────────────────────────────────────────────────────────────────

/** The (a) correct option is longer than every distractor by ≥ `ratio` — length gives the answer away. */
export function correctIsLongest(q: Pick<Question, 'options' | 'answer'>, ratio = LONGEST_RATIO): boolean {
  if (q.options.length < 3 || !q.answer.length) return false;
  const len = (keys: (k: string) => boolean) => Math.max(0, ...q.options.filter((o) => keys(o.key)).map((o) => o.text.trim().length));
  const correct = len((k) => q.answer.includes(k));
  const other = len((k) => !q.answer.includes(k));
  return other > 0 && correct >= other * ratio;
}

function longestCorrect(q: LintInput): LintFlaw[] {
  if (!correctIsLongest(q)) return [];
  const right = q.options.filter((o) => q.answer.includes(o.key)).sort((a, b) => b.text.trim().length - a.text.trim().length)[0];
  const other = Math.max(...q.options.filter((o) => !q.answer.includes(o.key)).map((o) => o.text.trim().length));
  const pct = Math.round((right.text.trim().length / other - 1) * 100);
  return [flaw('longest-correct', `Đáp án đúng dài hơn mọi phương án nhiễu ${pct} % (${right.text.trim().length} vs ${other} ký tự) — có thể đoán nhờ độ dài`, right.key)];
}

// Words that carry no cue when shared by the stem and the key: function words, exam boilerplate, AWS generics.
const ECHO_IGNORE = new Set(
  (
    'a an the and or but if then than to of in on at by for with from into onto over under as is are was were be been being ' +
    'it its this that these those which what who whom whose when where how why all any each both few more most less least ' +
    'other some such no nor not only own same so too very can will just should must would could may might do does did done ' +
    'has have had having we you they their them our your i me my he she his her there here also per via use uses using used ' +
    'need needs needed require requires required requirement requirements want wants wanted company companies solution ' +
    'solutions architect architects aws amazon meet meets meeting best following provide provides provided option options ' +
    'choose select two three four five one new existing current currently service services feature features team teams ' +
    'application applications app apps workload workloads user users customer customers make makes ensure ensures allow ' +
    'allows run runs running way ways able within without across between after before while during should must cost ' +
    'effective most least operational overhead minimal minimum maximum highly ' +
    // generic verbs and AWS nouns that every option could use — echoing them is no cue
    'create creates created enable enables enabled continue continues configure configured set add adds keep keeps ' +
    'change changes changed move moves store stores stored request requests requested manage manages managed ' +
    'data instance instances group groups resource resources account accounts access specific multiple time times'
  ).split(' '),
);

/** Crude stem: one key for "encrypt / encrypted / encryption", "replicate / replication". */
const wordKey = (w: string) => (w.length > 6 ? w.slice(0, 6) : w);

function contentWords(text: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const w of words(text)) {
    const clean = w.replace(/['’]s$/, '').replace(/[.]+$/, '');
    if (clean.length < 3 && !/\d/.test(clean)) continue;
    if (ECHO_IGNORE.has(clean) || /^\d+(?:[.,]\d+)?$/.test(clean)) continue;
    const k = wordKey(clean);
    if (!out.has(k)) out.set(k, clean);
  }
  return out;
}

function stemEcho(q: LintInput): LintFlaw[] {
  const keys = correctKeys(q);
  const distractors = q.options.filter((o) => !keys.has(o.key));
  if (!distractors.length) return [];
  const stem = contentWords(q.stem.replace(/\((?:choose|select)[^)]*\)/gi, ' '));
  const other = new Set<string>();
  for (const o of distractors) for (const k of contentWords(o.text).keys()) other.add(k);
  for (const o of q.options.filter((x) => keys.has(x.key))) {
    const echo = [...contentWords(o.text)].filter(([k]) => stem.has(k) && !other.has(k)).map(([, w]) => w);
    if (echo.length) {
      return [flaw('stem-echo', `Chỉ đáp án đúng lặp lại ${echo.slice(0, 3).map(quote).join(', ')} của đề — có thể đoán nhờ từ trùng mà không cần kiến thức`, o.key)];
    }
  }
  return [];
}

// whole words only: "always-on", "all-at-once", "read-only" name things, they are no absolute claims
const ABSOLUTE_RE = /(?<![\w-])(always|never|only|all|none|guarantees?|guaranteed)(?![\w-])/i;

// names of AWS options that happen to start with "all" (Elastic Beanstalk "All at once", RI "All Upfront")
const ABSOLUTE_NAMES = /\ball[\s-]+(?:at[\s-]+once|upfront)\b/gi;

function absoluteTerms(q: LintInput): LintFlaw[] {
  const keys = correctKeys(q);
  const term = (text: string) => plain(text).replace(ABSOLUTE_NAMES, ' ').match(ABSOLUTE_RE)?.[1];
  if (q.options.some((o) => keys.has(o.key) && term(o.text))) return [];
  return q.options
    .filter((o) => !keys.has(o.key) && term(o.text))
    .map((o) => flaw('absolute-terms', `Phương án nhiễu ${o.key} dùng từ tuyệt đối ${quote(term(o.text)!)} mà đáp án đúng không có — dễ bị loại`, o.key));
}

/** The sentence that asks the question: the last one ending in "?", else the last sentence of the stem. */
function questionSentence(stem: string): string {
  const text = stem.replace(/\((?:choose|select)[^)]*\)/gi, ' ').replace(/\s+/g, ' ').trim();
  const parts = text.match(/[^.?!]+(?:[.?!]+|$)/g) ?? [text];
  const asked = parts.filter((p) => p.includes('?'));
  return (asked.length ? asked[asked.length - 1] : parts[parts.length - 1] ?? '').trim();
}

const emphasized = (sentence: string, index: number, word: string) =>
  word === word.toUpperCase() || /[*_]$/.test(sentence.slice(0, index)) || /^[*_]/.test(sentence.slice(index + word.length));

function negativeStem(q: LintInput): LintFlaw[] {
  const stem = q.stem.replace(/\s+/g, ' ');
  const hits: string[] = [];
  // EXCEPT / LEAST decide the answer wherever they stand ("…with the LEAST setup. Which service?")
  for (const m of stem.matchAll(/(?<![\w-])(except|least)(?![\w-])/gi)) {
    const before = stem.slice(0, m.index);
    if (/\bat\s+$/i.test(before) || /^\s*(?:-\s*)?privilege/i.test(stem.slice(m.index + m[1].length))) continue; // "at least", "least privilege"
    if (/\bexcept\s+(?:for|when|that|if)\b/i.test(stem.slice(m.index, m.index + 16)) && m[1].toLowerCase() === 'except') continue; // scenario detail
    if (!emphasized(stem, m.index, m[1])) hits.push(m[1]);
  }
  const s = questionSentence(q.stem);
  // "Which (of these) service(s) is not / does not / cannot …" — the negation belongs to the question itself: at most four
  // words after which/what, so "…where a failed consumer does not lose messages" (a clause) is no negative stem
  const neg = s.match(
    /\b(?:which|what|who)\b(?:\s+[\w-]+){0,4}?\s+(?:(?:is|are|was|were|does|do|did|would|will|should|could|can|must|might)\s+(not)|(cannot|can['’]t|isn['’]t|aren['’]t|doesn['’]t|don['’]t|won['’]t|wouldn['’]t|shouldn['’]t))\b/i,
  );
  if (neg && neg.index !== undefined) {
    const word = neg[1] ?? neg[2];
    const at = neg.index + neg[0].length - word.length;
    if (!emphasized(s, at, word)) hits.push(word);
  }
  if (!hits.length) return [];
  const w = hits[0];
  const what = /^least$/i.test(w) ? `Từ khoá đảo nghĩa câu hỏi ${quote(w)}` : `Câu hỏi phủ định ${quote(w)}`;
  return [flaw('negative-stem', `${what} không được nhấn mạnh — viết hoa ${w.toUpperCase()} như đề thật để người làm không đọc sót`)];
}

// Options that only make sense in a fixed order. Narrow on purpose (an AI edit that introduces one is rejected):
// prose such as "route tables of both of them", "all of these instances" or "Class B or C" must pass.
const POSITIONAL_RE = [
  // "All of the above", "None of the following", "Both of the options" — anywhere in the option
  /\b(?:all|none|both|either|neither)\s+of\s+the\s+(?:above|below|options|following|answers|choices)\b/i,
  // the whole option is "All", "None", "None of these", "Both of them"…
  /^(?:all|none|both|neither)(?:\s+of\s+(?:these|those|them|the\s+above))?$/i,
  // the whole option names other options by letter: "A and B", "Both A and C", "Options B and D", "A, B and C are correct"
  /^(?:(?:[Bb]oth|[Ee]ither|[Nn]either|[Oo]nly)\s+)?(?:(?:[Oo]ptions?|[Aa]nswers?|[Cc]hoices?)\s+)?[A-H](?:\s*(?:,|and|or|nor|&|\+)\s*(?:(?:[Oo]ptions?|[Aa]nswers?|[Cc]hoices?)\s+)?[A-H])+(?:\s+(?:are|is)\s+(?:correct|right|true|valid))?$/,
  // …or one option by its letter: "Option B", "Same as answer C" (a bare "A" stays legal — the DNS record type)
  /^(?:(?:[Ss]ame\s+as|[Oo]nly)\s+)?(?:[Oo]ption|[Aa]nswer|[Cc]hoice)\s+[A-H](?:\s+(?:is\s+)?(?:correct|right))?$/,
];

/** Option text as written, for whole-option patterns: trimmed, emphasis and a trailing period removed. */
const bare = (text: string) => text.replace(/[\s*_.!]+$/, '').replace(/^[\s*_]+/, '');

function allNoneAbove(q: LintInput): LintFlaw[] {
  return q.options
    .filter((o) => POSITIONAL_RE.some((re) => re.test(bare(o.text))))
    .map((o) => flaw('all-none-above', `Phương án ${o.key} ${quote(o.text.trim().slice(0, 60))} trỏ tới phương án khác — vô nghĩa khi app xáo thứ tự`, o.key));
}

// Identical options: compared on the raw text, case- and whitespace-insensitive, a trailing period ignored. Punctuation
// counts — "arn:aws:s3:::bucket/*", "arn:aws:s3:::bucket" and "arn:aws:s3:::*/bucket" are three different answers.
const sameText = (text: string) =>
  text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[\s.。]+$/, '');

function duplicateOptions(q: LintInput): LintFlaw[] {
  const seen = new Map<string, string>();
  const out: LintFlaw[] = [];
  for (const o of q.options) {
    const n = sameText(o.text);
    if (!n) continue;
    const first = seen.get(n);
    if (first) out.push(flaw('duplicate-options', `Phương án ${o.key} trùng nội dung với ${first}`, o.key));
    else seen.set(n, o.key);
  }
  return out;
}

const RANGE_RE = /(\d+(?:[.,]\d+)?)\s*(?:-|–|to)\s*(\d+(?:[.,]\d+)?)\s*([\p{L}%]*)/u;

function overlappingOptions(q: LintInput): LintFlaw[] {
  const opts = q.options.map((o) => ({ key: o.key, n: norm(o.text) }));
  for (const a of opts) {
    for (const b of opts) {
      if (a.key === b.key || !a.n || a.n === b.n) continue;
      // the whole shorter option (≥ 3 words) reappears inside a longer one: picking the longer one is "also right"
      if (a.n.split(' ').length >= 3 && ` ${b.n} `.includes(` ${a.n} `)) {
        return [flaw('overlapping-options', `Phương án ${b.key} chứa trọn phương án ${a.key} — hai lựa chọn không loại trừ nhau`, b.key)];
      }
    }
  }
  // numeric ranges of the same unit that overlap ("1–5 minutes" / "3–10 minutes")
  const ranges = q.options
    .map((o) => {
      const m = o.text.match(RANGE_RE);
      return m ? { key: o.key, lo: Number(m[1].replace(',', '.')), hi: Number(m[2].replace(',', '.')), unit: m[3].toLowerCase() } : undefined;
    })
    .filter((r): r is { key: string; lo: number; hi: number; unit: string } => !!r && r.lo < r.hi);
  for (let i = 0; i < ranges.length; i++) {
    for (let j = i + 1; j < ranges.length; j++) {
      const [a, b] = [ranges[i], ranges[j]];
      if (a.unit === b.unit && a.lo < b.hi && b.lo < a.hi) {
        return [flaw('overlapping-options', `Khoảng giá trị của ${a.key} và ${b.key} chồng lên nhau`, b.key)];
      }
    }
  }
  return [];
}

// Acronyms pronounced as words take "a" ("a NAT gateway"); letter-by-letter ones starting with a vowel sound take "an".
const WORD_ACRONYMS = new Set(['NAT', 'NACL', 'SAML', 'FIFO', 'RAID', 'SOAP', 'REST', 'LAMP', 'SIEM', 'SASL', 'MACsec']);

/** The article an option's first word takes in English ("an S3 bucket", "a unique key", "an hour"). */
export function articleFor(text: string): 'a' | 'an' | undefined {
  const w = text.trim().replace(/^[^\p{L}\p{N}]+/u, '').match(/^[\p{L}\p{N}][\p{L}\p{N}-]*/u)?.[0];
  if (!w) return undefined;
  if (/^[A-Z][A-Z0-9]{1,5}s?$/.test(w) && !WORD_ACRONYMS.has(w.replace(/s$/, ''))) return /^[AEFHILMNORSX]/.test(w) ? 'an' : 'a';
  if (/^\d/.test(w)) return /^(?:8|11|18|80+)(?!\d)/.test(w) ? 'an' : 'a';
  const l = w.toLowerCase();
  if (/^(?:eu|ewe|one|once|uni|use|usa|usu|ura|uti|ubi)/.test(l)) return 'a';
  if (/^(?:hour|honest|honou?r|heir)/.test(l)) return 'an';
  return /^[aeiou]/.test(l) ? 'an' : 'a';
}

function grammarCue(q: LintInput): LintFlaw[] {
  const m = q.stem.replace(/\((?:choose|select)[^)]*\)/gi, ' ').trim().match(/\b(a|an)\s*(?:_{2,}|…|\.{3})?\s*:?\s*$/i);
  if (!m) return [];
  const article = m[1].toLowerCase();
  const keys = correctKeys(q);
  const fits = (text: string) => articleFor(text) === article;
  const right = q.options.filter((o) => keys.has(o.key));
  const misfit = q.options.filter((o) => !keys.has(o.key) && !fits(o.text));
  if (!right.length || !right.every((o) => fits(o.text)) || !misfit.length) return [];
  return [flaw('grammar-cue', `Đề kết thúc bằng ${quote(m[1])}: đáp án đúng hợp mạo từ, còn ${misfit.map((o) => o.key).join(', ')} thì không — loại được nhờ ngữ pháp`, right[0].key)];
}

const COUNT_WORDS: Record<string, number> = { two: 2, three: 3, four: 4, five: 5, '2': 2, '3': 3, '4': 4, '5': 5 };
const COUNT = '(two|three|four|five|[2-5])';
const CHOOSE_TAIL = '(?:\\s+(?:answers?|options?|choices?|responses?))?\\s*\\.?';
// Only the instruction itself: "(Choose two.)" / "(Select TWO)" anywhere, or "Choose two." / "Select THREE" closing the
// stem as its own sentence — "Developers select 4 vCPUs…" or "must choose two AWS Regions" are part of the scenario.
const CHOOSE_PAREN_RE = new RegExp(`\\(\\s*(?:choose|select|pick)\\s+${COUNT}${CHOOSE_TAIL}\\s*\\)`, 'i');
const CHOOSE_END_RE = new RegExp(`(?:^|[.?!:]\\s+)(?:choose|select|pick)\\s+${COUNT}${CHOOSE_TAIL}\\s*$`, 'i');

/** The "(Choose N)" instruction of a stem: the count asked for and the text shown, or undefined. */
export function chooseInstruction(stem: string): { count: number; text: string } | undefined {
  const plainStem = stem.replace(/[*_`]/g, '').trim();
  const m = plainStem.match(CHOOSE_PAREN_RE) ?? plainStem.match(CHOOSE_END_RE);
  return m ? { count: COUNT_WORDS[m[1].toLowerCase()], text: m[0].replace(/^[.?!:]\s+/, '').trim() } : undefined;
}

function chooseCount(q: LintInput): LintFlaw[] {
  const ins = chooseInstruction(q.stem);
  const n = q.answer.length;
  if (ins) {
    if (ins.count !== n) return [flaw('choose-count', `Đề ghi ${quote(ins.text)} nhưng đáp án có ${n} khoá (${q.answer.join(', ')})`)];
    if (q.options.length <= n) return [flaw('choose-count', `Chọn ${n} đáp án nhưng chỉ có ${q.options.length} phương án`)];
    return [];
  }
  if (n > 1) return [flaw('choose-count', `Câu ${n} đáp án nhưng đề không ghi “(Choose ${n === 2 ? 'TWO' : n === 3 ? 'THREE' : n})”`)];
  return [];
}

function letterRef(q: LintInput): LintFlaw[] {
  const text = q.explanation.replace(/\*\*Answer:?\*\*.*$/m, '');
  const m = text.match(LETTER_REF_RE);
  if (!m) return [];
  return [flaw('letter-ref', `Giải thích nhắc chữ cái ${quote(m[0].trim())} — app xáo thứ tự phương án nên chữ cái trỏ sai`)];
}

function shortExplanation(q: LintInput): LintFlaw[] {
  const n = countWords(q.explanation ?? '');
  if (n >= SHORT_EXPLANATION_WORDS) return [];
  return [flaw('short-explanation', n ? `Giải thích chỉ ${n} từ (< ${SHORT_EXPLANATION_WORDS}) — chưa nói vì sao các phương án nhiễu sai` : 'Chưa có giải thích')];
}

function flaw(code: string, message: string, option?: string): LintFlaw {
  const f: LintFlaw = { code, severity: RULE.get(code)!.severity, message };
  if (option) f.option = option;
  return f;
}

const CHECKS: ((q: LintInput) => LintFlaw[])[] = [
  duplicateOptions,
  allNoneAbove,
  chooseCount,
  letterRef,
  longestCorrect,
  stemEcho,
  absoluteTerms,
  negativeStem,
  grammarCue,
  overlappingOptions,
  shortExplanation,
];

const byRank = (a: LintFlaw, b: LintFlaw) =>
  SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || (CODE_RANK.get(a.code) ?? 99) - (CODE_RANK.get(b.code) ?? 99) || (a.option ?? '').localeCompare(b.option ?? '');

/** Flaws of one question, most severe first. Pure function: no I/O. `tax` is accepted for future taxonomy-aware rules. */
export function lintQuestion(q: Pick<Question, 'id' | 'stem' | 'options' | 'answer' | 'explanation'>, _tax?: Taxonomy): LintFlaw[] {
  const input: LintInput = { id: q.id, stem: q.stem ?? '', options: q.options ?? [], answer: q.answer ?? [], explanation: q.explanation ?? '' };
  return CHECKS.flatMap((check) => check(input)).sort(byRank);
}

/** Flaws introduced by an edit: codes present after but not before (same code on the same option counts once). */
export function newFlaws(before: LintFlaw[], after: LintFlaw[]): LintFlaw[] {
  const seen = new Set(before.map((f) => `${f.code}|${f.option ?? ''}`));
  return after.filter((f) => !seen.has(`${f.code}|${f.option ?? ''}`));
}

// ── bank summary ────────────────────────────────────────────────────────────

/** Worst flaw first: questions with more severe flaws (then more flaws) sort first. */
function badness(flaws: LintFlaw[]): number[] {
  const n = { high: 0, medium: 0, low: 0 };
  for (const f of flaws) n[f.severity]++;
  return [n.high, n.medium, n.low];
}

let cache: { version: string; value: LintSummary } | undefined;

/** Lint every active question: per-rule counts, flagged ids per rule and the worst questions. Cached by bank version. */
export function lintBank(bank: BankState, opts: { cache?: boolean } = {}): LintSummary {
  const useCache = opts.cache !== false && !!bank.version;
  if (useCache && cache?.version === bank.version) return cache.value;
  const active = bank.questions.filter((q) => q.status === 'active');
  const byCode: LintSummary['byCode'] = {};
  for (const r of LINT_RULES) byCode[r.code] = { severity: r.severity, label: r.label, count: 0 };
  const ids: Record<string, string[]> = {};
  const bySeverity: Record<LintSeverity, number> = { high: 0, medium: 0, low: 0 };
  const flagged: { id: string; flaws: LintFlaw[]; rank: number[] }[] = [];
  for (const q of active) {
    const flaws = lintQuestion(q, bank.taxonomy);
    if (!flaws.length) continue;
    for (const code of new Set(flaws.map((f) => f.code))) {
      const rule = RULE.get(code)!;
      (byCode[code] ??= { severity: rule.severity, label: rule.label, count: 0 }).count++;
      (ids[code] ??= []).push(q.id);
    }
    bySeverity[flaws[0].severity]++;
    flagged.push({ id: q.id, flaws, rank: badness(flaws) });
  }
  flagged.sort((a, b) => b.rank[0] - a.rank[0] || b.rank[1] - a.rank[1] || b.rank[2] - a.rank[2] || a.id.localeCompare(b.id));
  const value: LintSummary = {
    checked: active.length,
    flagged: flagged.length,
    byCode,
    questions: flagged.slice(0, MAX_SUMMARY_QUESTIONS).map(({ id, flaws }) => ({ id, flaws })),
    bySeverity,
    ids,
  };
  if (useCache) cache = { version: bank.version, value };
  return value;
}

/** Every flagged active question for one rule (or all rules), worst first — the drill-down behind the summary cap. */
export function lintQuestionsFor(bank: BankState, code?: string): { id: string; flaws: LintFlaw[] }[] {
  const summary = lintBank(bank);
  const wanted = code ? new Set(summary.ids?.[code] ?? []) : undefined;
  return bank.questions
    .filter((q) => q.status === 'active' && (!wanted || wanted.has(q.id)))
    .map((q) => ({ id: q.id, flaws: lintQuestion(q, bank.taxonomy) }))
    .filter((x) => x.flaws.length)
    .sort((a, b) => {
      const [x, y] = [badness(a.flaws), badness(b.flaws)];
      return y[0] - x[0] || y[1] - x[1] || y[2] - x[2] || a.id.localeCompare(b.id);
    });
}
