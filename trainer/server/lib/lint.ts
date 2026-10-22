// Deterministic item-writing-flaw checks for one question (owned by workstream [Q]).
// Used by: Bank → Chất lượng, `npm run validate -- --lint`, and the AI pipeline ([D]) to reject edits or generated
// questions that introduce new flaws (compare lintQuestion(before) vs lintQuestion(after) by `code`).
//
// Severity — what the AI pipeline does with a flaw an edit introduces:
//   high   = the item is broken or the answer can be read off without knowing AWS (duplicate options, "All of the
//            above", "Choose TWO" ≠ number of keys, option letters in the explanation) → the edit is rejected;
//   medium = a test-wise cue or a style flaw worth fixing (correct option longest, stem echo, absolute words,
//            unemphasized NOT, a/an cue, overlapping options) → warning;
//   low    = maintenance work for ENRICH (short explanation, a distractor naming an out-of-scope service) → warning.
// Codes are stable: they are stored nowhere, but patch reports, the UI and `validate --lint` refer to them.
// Taxonomy-aware rules (oos-answer, oos-distractor: services marked `scope: out` — [v6] or `scope: legacy`; [v5] stale-fact:
// taxonomy `currency:`) run only when `tax` is passed. [v5] family-options needs the other members of the question's
// family (`ctx.family`, see lintContext()): lintBank, validate and the drawer route pass them; a lone question is never flagged.
// [v6] Exam-spec rules (stem-short, options-bare, no-criterion, explanation-coverage, doc-url-missing, options-nonparallel;
// SCHEMA §6b) hold new AI / document questions to the exam-grade bar: they run only on "exam-spec" questions — origin
// ai | doc, difficulty medium | hard, `created` on or after `ctx.examSpecSince` (default config quality.exam_spec_since;
// '' = off). Older and hand-written questions are never flagged by them; none of them is high (they never reject an edit).
import { CONFIG_FILE, loadConfig } from '../config.ts';
import { stemRequirements, type BankState } from './bank.ts'; // used at call time only (bank.ts reaches this module through sealed.ts)
import { detectServices } from './classify.ts';
import { fileSig } from './index-db.ts';
import { LETTER_REF_RE } from './pack-format.ts';
import { legacySet, outOfScopeIn } from './taxonomy.ts';
import { EXAM_LIKE_OPTION_WORDS, EXAM_LIKE_STEM_WORDS } from '../../shared/realism.ts';
import { hasCriterion } from '../../shared/tier.ts';
import { countWords } from '../../shared/timing.ts';
import type { LintFlaw, LintSeverity, LintSummary, Question, Taxonomy } from '../../shared/types.ts';

/** What the rules read. [v6] origin / difficulty / created (exam-spec scope), refs, words and requirements are optional:
 *  the full Question carries them; without them the exam-spec rules do not run. */
export type LintInput = Pick<Question, 'id' | 'stem' | 'options' | 'answer' | 'explanation'> &
  Partial<Pick<Question, 'origin' | 'difficulty' | 'created' | 'refs' | 'words' | 'requirements'>>;

export interface LintRule {
  code: string;
  severity: LintSeverity;
  label: string; // Vietnamese, short (rule list, summary)
  fix: string; // Vietnamese, how to fix (UI, validate --lint)
  examSpec?: boolean; // [v6] runs only on exam-spec questions (AI / document, medium / hard, created ≥ quality.exam_spec_since)
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
  {
    code: 'oos-answer',
    severity: 'medium',
    label: 'Đáp án là dịch vụ ngoài phạm vi đề',
    fix: 'Đề thật không hỏi dịch vụ ngoài phạm vi (danh sách chính thức SAA-C03) hay đã bị gỡ khỏi danh sách in-scope: retire câu (status: retired) hoặc viết lại để đáp án là dịch vụ trong phạm vi.',
  },
  {
    code: 'family-options',
    severity: 'medium',
    label: 'Câu cùng họ không chung bộ phương án',
    fix: 'Các câu cùng `family:` phải dùng y nguyên một bộ phương án và chỉ khác câu hỏi cuối (yêu cầu) — chép lại bộ phương án chung, hoặc bỏ `family:`.',
  },
  {
    code: 'stale-fact',
    severity: 'medium',
    label: 'Kiến thức có thể đã lỗi thời',
    fix: 'Đối chiếu tài liệu AWS (URL trong thông báo): sửa theo tên / giới hạn hiện hành, viết “tên mới (tên cũ)” — hoặc chạy kiểm chứng bằng tài liệu AWS (🧪 Giải mù).',
  },
  // [v6] exam-spec rules: only AI / document questions, medium / hard, created on or after quality.exam_spec_since
  {
    code: 'stem-short',
    severity: 'medium',
    examSpec: true,
    label: 'Đề ngắn hơn đề thật',
    fix: 'Viết đề thành tình huống ≥ 55 từ như đề thật: bối cảnh công ty → hiện trạng → ràng buộc cứng → câu hỏi đóng có tiêu chí.',
  },
  {
    code: 'options-bare',
    severity: 'medium',
    examSpec: true,
    label: 'Phương án quá ngắn',
    fix: 'Mỗi phương án là một giải pháp hoàn chỉnh 1–2 câu (dịch vụ + cấu hình), trung bình ≥ 8 từ — không để tên dịch vụ trần.',
  },
  {
    code: 'no-criterion',
    severity: 'medium',
    examSpec: true,
    label: 'Đề không nêu tiêu chí chọn',
    fix: 'Kết thúc đề bằng câu hỏi có tiêu chí: qualifier (MOST cost-effective, LEAST operational overhead, MOST secure…) hoặc “Which solution will meet these requirements?” sau các ràng buộc.',
  },
  {
    code: 'explanation-coverage',
    severity: 'medium',
    examSpec: true,
    label: 'Giải thích bỏ sót phương án nhiễu',
    fix: 'Mỗi phương án nhiễu một dòng riêng “- <nội dung phương án>: vì sao sai” (gọi bằng nội dung, không bằng chữ cái).',
  },
  { code: 'short-explanation', severity: 'low', label: 'Giải thích quá ngắn', fix: 'ENRICH “explain”: vì sao đúng + từng phương án nhiễu + tóm tắt 🇻🇳.' },
  {
    code: 'oos-distractor',
    severity: 'low',
    label: 'Phương án nhiễu là dịch vụ ngoài phạm vi',
    fix: 'ENRICH “distractors”: thay bằng dịch vụ trong phạm vi hay bị nhầm với đáp án đúng — dịch vụ ngoài phạm vi (hay đã bị gỡ khỏi danh sách in-scope) bị loại ngay.',
  },
  {
    code: 'doc-url-missing',
    severity: 'low',
    examSpec: true,
    label: 'Thiếu link tài liệu AWS',
    fix: 'Thêm URL tài liệu chính thức (https://docs.aws.amazon.com/… hoặc https://aws.amazon.com/…) vào refs hoặc cuối giải thích để kiểm chứng được đáp án.',
  },
  {
    code: 'options-nonparallel',
    severity: 'low',
    examSpec: true,
    label: 'Phương án không cùng dạng',
    fix: 'Viết mọi phương án cùng một dạng: cùng mở đầu bằng động từ hành động (“Use…”, “Configure…”) hoặc cùng là cụm danh từ.',
  },
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

/**
 * The "(Choose N)" instruction of a stem: the count asked for and the text shown, or undefined. [v6] The real exam writes
 * "(Select TWO.)", the bank "(Choose TWO)" (what the app writes): both, any case, with or without the period.
 */
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

/** [v6] "ngoài phạm vi đề thi (X)" for `scope: out` services, "đã bị gỡ khỏi danh sách in-scope của đề (Y)" for `scope: legacy`. */
function scopeText(services: string[], tax: Taxonomy, outText: string): string {
  const legacy = legacySet(tax);
  const out = services.filter((s) => !legacy.has(s));
  const gone = services.filter((s) => legacy.has(s));
  return [out.length ? `${outText} (${out.join(', ')})` : '', gone.length ? `đã bị gỡ khỏi danh sách in-scope của đề (${gone.join(', ')})` : ''].filter(Boolean).join('; ');
}

/**
 * Exam scope (taxonomy `scope: out` = the official out-of-scope list; [v6] `scope: legacy` = dropped from the official
 * in-scope list or retired, treated the same): a correct option naming such a service makes the whole question off-exam
 * (oos-answer); otherwise each distractor naming one is an easy give-away (oos-distractor).
 */
function scopeFlaws(q: LintInput, tax?: Taxonomy): LintFlaw[] {
  if (!tax) return [];
  const keys = correctKeys(q);
  const named = q.options.map((o) => ({ o, services: outOfScopeIn(o.text, tax) })).filter((x) => x.services.length);
  const right = named.filter((x) => keys.has(x.o.key));
  if (right.length) {
    const services = [...new Set(right.flatMap((x) => x.services))];
    return [flaw('oos-answer', `Đáp án đúng nêu dịch vụ ${scopeText(services, tax, 'ngoài phạm vi đề thi')} — đề thật SAA-C03 không hỏi dịch vụ này`, right[0].o.key)];
  }
  return named.map((x) => flaw('oos-distractor', `Phương án nhiễu ${x.o.key} nêu dịch vụ ${scopeText(x.services, tax, 'ngoài phạm vi')} — loại được ngay vì đề thật không dùng`, x.o.key));
}

// ── [v5] qualifier families and stale facts ─────────────────────────────────

/** Bank context of a lint run: the members of the question's qualifier family (bank order, the question included). */
export interface LintContext {
  family?: Pick<Question, 'id' | 'stem' | 'options' | 'answer'>[];
  examSpecSince?: string; // [v6] YYYY-MM-DD from which AI / document questions are exam-spec ('' = off); default config quality.exam_spec_since
}

/** The family members of `q` (non-retired, bank order) — the context lintQuestion needs for `family-options`. */
export function lintContext(bank: Pick<BankState, 'questions'>, q: Pick<Question, 'id' | 'family'>): LintContext | undefined {
  if (!q.family) return undefined;
  const family = bank.questions.filter((x) => x.family === q.family && x.status !== 'retired');
  return family.length > 1 ? { family } : undefined;
}

const optionSet = (q: Pick<Question, 'options'>) => q.options.map((o) => sameText(o.text)).sort().join('\u0000');

/**
 * Qualifier family (C6): every member shows one identical option set (letters may differ) and asks a different final
 * question. The family's set is the one most members share (ties: the first member in bank order).
 */
export function familyFlaws(q: LintInput, family: Pick<Question, 'id' | 'stem' | 'options' | 'answer'>[]): LintFlaw[] {
  const others = family.filter((m) => m.id !== q.id);
  if (!others.length) return [];
  const members = family.some((m) => m.id === q.id) ? family : [q, ...family];
  const counts = new Map<string, { n: number; first: number }>();
  members.forEach((m, i) => {
    const k = optionSet(m);
    const c = counts.get(k);
    if (c) c.n++;
    else counts.set(k, { n: 1, first: i });
  });
  const common = [...counts.entries()].sort((a, b) => b[1].n - a[1].n || a[1].first - b[1].first)[0][0];
  const out: LintFlaw[] = [];
  if (optionSet(q) !== common) {
    const ref = members.find((m) => optionSet(m) === common)!;
    out.push(flaw('family-options', `Bộ phương án khác bộ chung của họ (như ${ref.id}) — câu cùng họ chỉ được khác câu hỏi cuối`));
  }
  const asked = norm(questionSentence(q.stem));
  const twin = others.find((m) => norm(questionSentence(m.stem)) === asked);
  if (twin) out.push(flaw('family-options', `Câu hỏi cuối giống hệt ${twin.id} — câu cùng họ phải hỏi một yêu cầu khác (chi phí / vận hành / bảo mật …)`));
  return out;
}

const currencyMemo = new WeakMap<Taxonomy, { fact: NonNullable<Taxonomy['currency']>[number]; re: RegExp; unless?: RegExp }[]>();

function currencyRules(tax: Taxonomy) {
  let m = currencyMemo.get(tax);
  if (!m) {
    m = [];
    for (const fact of tax.currency ?? []) {
      try {
        if (fact?.pattern) m.push({ fact, re: new RegExp(fact.pattern, 'i'), ...(fact.unless ? { unless: new RegExp(fact.unless, 'i') } : {}) });
      } catch {
        // a malformed pattern is no rule
      }
    }
    currencyMemo.set(tax, m);
  }
  return m;
}

/** stale-fact: the text states something AWS changed since (taxonomy `currency:`, each with its official source). */
function staleFacts(q: LintInput, tax?: Taxonomy): LintFlaw[] {
  if (!tax?.currency?.length) return [];
  const text = [q.stem, ...q.options.map((o) => o.text), q.explanation].join('\n');
  return currencyRules(tax)
    .filter(({ re, unless }) => re.test(text) && !unless?.test(text))
    .map(({ fact }) => flaw('stale-fact', `Có thể đã lỗi thời (${fact.id}): ${fact.fact} — từ ${fact.since}, nguồn ${fact.url}`));
}

// ── [v6] exam-spec rules (SCHEMA §6b) ───────────────────────────────────────

const DATE_RE = /^\d{4}-\d{2}-\d{2}/;
let specMemo: { sig: string; since: string } | undefined;

/** config quality.exam_spec_since as YYYY-MM-DD ('' = off, also for a malformed value); config.yaml re-read only when it changes. */
export function examSpecSince(): string {
  const sig = fileSig(CONFIG_FILE);
  if (specMemo?.sig !== sig) {
    const v: unknown = loadConfig().quality?.exam_spec_since;
    const s = v instanceof Date ? v.toISOString() : String(v ?? '').trim();
    specMemo = { sig, since: DATE_RE.test(s) ? s.slice(0, 10) : '' };
  }
  return specMemo.since;
}

const specCandidate = (q: Partial<Pick<Question, 'origin' | 'difficulty' | 'created'>>) =>
  (q.origin === 'ai' || q.origin === 'doc') && (q.difficulty === 'medium' || q.difficulty === 'hard') && !!q.created && DATE_RE.test(q.created);

/**
 * Exam-spec question: written by the AI or from documents (origin ai | doc), medium / hard, created on or after `since`
 * (default config quality.exam_spec_since; '' = no question is exam-spec).
 */
export function isExamSpec(q: Partial<Pick<Question, 'origin' | 'difficulty' | 'created'>>, since: string = examSpecSince()): boolean {
  return !!since && specCandidate(q) && q.created!.slice(0, 10) >= since;
}

function stemShort(q: LintInput, tax?: Taxonomy): LintFlaw[] {
  const min = tax?.timing?.long_form_min_words ?? EXAM_LIKE_STEM_WORDS;
  const n = typeof q.words === 'number' && q.words >= 0 ? q.words : countWords(q.stem);
  if (n >= min) return [];
  return [flaw('stem-short', `Đề chỉ ${n} từ (< ${min}) — câu chuẩn đề thi là một tình huống đầy đủ: bối cảnh, hiện trạng, ràng buộc rồi câu hỏi`)];
}

function optionsBare(q: LintInput): LintFlaw[] {
  if (!q.options.length) return [];
  const avg = q.options.reduce((s, o) => s + countWords(o.text), 0) / q.options.length;
  if (avg >= EXAM_LIKE_OPTION_WORDS) return [];
  return [flaw('options-bare', `Phương án dài trung bình ${avg.toFixed(1).replace('.', ',')} từ (< ${EXAM_LIKE_OPTION_WORDS}) — đề thật dùng câu hành động hoàn chỉnh (dịch vụ + cấu hình), không phải tên dịch vụ trần`)];
}

function noCriterion(q: LintInput, tax?: Taxonomy): LintFlaw[] {
  // re-parsed questions (AI drafts, patched blocks) carry no computed `requirements`: same rule as bank.ts annotate()
  const requirements = q.requirements ?? (tax ? stemRequirements(q.stem, tax) : undefined);
  if (hasCriterion({ stem: q.stem, options: q.options, requirements })) return [];
  return [flaw('no-criterion', 'Đề không nêu tiêu chí chọn (qualifier như MOST cost-effective / LEAST operational overhead, hay “…meet these requirements?”) — nhiều phương án cùng chạy được thì không biết chọn theo tiêu chí nào')];
}

/** A bullet line naming one option by its content: "- Read replicas: …", "* **SSE-C** — …", "1. Snapshots : …" (not "https:"). */
const isOptionLine = (line: string) => /^\s*(?:[-*+•]|\d+[.)])\s+\S[^\n]*?(?::(?:\s|$)|\s[—–]\s)/.test(line);

function explanationCoverage(q: LintInput): LintFlaw[] {
  const keys = correctKeys(q);
  const distractors = q.options.filter((o) => !keys.has(o.key)).length;
  if (!distractors) return [];
  const lines = q.explanation.split('\n').filter(isOptionLine).length;
  if (lines >= distractors) return [];
  return [flaw('explanation-coverage', `Giải thích có ${lines} dòng “- …:” cho ${distractors} phương án nhiễu — mỗi phương án nhiễu cần một dòng riêng nói vì sao sai`)];
}

const AWS_DOC_URL = /https:\/\/(?:docs\.)?aws\.amazon\.com(?![\w.-])/i;

function docUrlMissing(q: LintInput): LintFlaw[] {
  if (AWS_DOC_URL.test(q.explanation) || (q.refs ?? []).some((r) => AWS_DOC_URL.test(r))) return [];
  return [flaw('doc-url-missing', 'Giải thích và refs chưa có URL tài liệu AWS (https://docs.aws.amazon.com/… hoặc https://aws.amazon.com/…) — không kiểm chứng được đáp án')];
}

// Imperative verbs that open an action option ("Use …", "Set up …", "Turn on …"). Left out on purpose: words that also
// open AWS noun phrases — "Read replicas", "Route 53", "Spread / Partition placement group", "Block Public Access",
// "Mount targets", "Transfer Acceleration", "Tag / Filter policies", "Patch Manager", "Snapshot", "Load balancer"…
const ACTION_VERBS = new Set(
  (
    'use configure create deploy enable set migrate store launch add move replace implement attach turn run schedule ' +
    'allocate allow apply assign associate assume automate back build buy call capture centralize change choose collect ' +
    'compress connect consolidate containerize convert copy decrease define delete deliver deny designate detach disable ' +
    'distribute divide do download encrypt enforce establish export expose extend generate give grant import increase ' +
    'ingest insert install integrate invoke isolate keep leverage limit lower make merge modify monitor offload ' +
    'orchestrate pick place point poll prefetch promote protect provide provision publish purchase put query raise ' +
    'rearchitect rebuild reboot redeploy redirect reduce refactor register rehost remove rename replatform replicate ' +
    'request require reserve resize restore restrict retain rewrite rotate save scale select send shift ship specify ' +
    'split start stop stream submit subscribe suspend switch sync synchronize take terminate toggle track transform ' +
    'trigger tune update upgrade upload validate verify write'
  ).split(' '),
);
// noun phrases that open with one of those verbs (AWS feature names)
const VERB_LED_NAMES = /^(?:run\s+command|launch\s+(?:templates?|configurations?|wizard)|change\s+(?:sets?|manager|calendar)|schedule\s+expressions?)\b/i;

/**
 * Shape of an option's opening: 'verb' (an action: "Use…", "Configure…") or 'noun' (clearly a noun phrase: an article,
 * Amazon / AWS, a product name or acronym such as "S3", "DynamoDB", "gp3", "Route 53", a taxonomy service such as
 * "Aurora"). Anything else is undecided — a capitalised common word ("Dedicated Hosts", "Local disk", "Peer the VPCs")
 * can be either, so it never counts (no false alarm on noun-phrase sets).
 */
function optionShape(text: string, tax?: Taxonomy): 'verb' | 'noun' | undefined {
  const t = text.replace(/[*_`]/g, '').replace(/^[^\p{L}\p{N}]+/u, '');
  const first = t.match(/^[\p{L}\p{N}][\p{L}\p{N}'’/-]*/u)?.[0];
  if (!first) return undefined;
  if (VERB_LED_NAMES.test(t) || /^route\s+53\b/i.test(t)) return 'noun';
  if (ACTION_VERBS.has(first.toLowerCase())) return 'verb';
  if (/^(?:a|an|the|amazon|aws)$/i.test(first)) return 'noun';
  if (/^(?:SSH|RDP)$/.test(first)) return undefined; // used as verbs ("SSH into the instance")
  if (/\d/.test(first) || (first.match(/\p{Lu}/gu)?.length ?? 0) >= 2) return 'noun';
  return tax && detectServices(first, tax).length ? 'noun' : undefined;
}

function optionsNonparallel(q: LintInput, tax?: Taxonomy): LintFlaw[] {
  const keys = correctKeys(q);
  const right = q.options.filter((o) => keys.has(o.key));
  const wrong = q.options.filter((o) => !keys.has(o.key));
  if (!right.length || wrong.length < 2) return [];
  const shape = optionShape(right[0].text, tax);
  if (!shape || right.some((o) => optionShape(o.text, tax) !== shape)) return [];
  const odd = wrong.filter((o) => optionShape(o.text, tax) === (shape === 'verb' ? 'noun' : 'verb'));
  if (odd.length < 2) return [];
  const opening = quote(`${right[0].text.trim().split(/\s+/).slice(0, 2).join(' ')} …`);
  const others = `${odd.length} phương án nhiễu (${odd.map((o) => o.key).join(', ')})`;
  const what = shape === 'verb' ? `Đáp án đúng mở đầu bằng động từ ${opening} còn ${others} là cụm danh từ` : `Đáp án đúng là cụm danh từ ${opening} còn ${others} mở đầu bằng động từ`;
  return [flaw('options-nonparallel', `${what} — phương án khác dạng nhau làm lộ đáp án`, right[0].key)];
}

const EXAM_SPEC_CHECKS: ((q: LintInput, tax?: Taxonomy) => LintFlaw[])[] = [stemShort, optionsBare, noCriterion, explanationCoverage, docUrlMissing, optionsNonparallel];

/** Pack-level exam-spec checks (validate): only packs with at least this many exam-spec questions… */
export const PACK_SPEC_MIN_QUESTIONS = 8;
/** …want ≥ 20 % multiple-response questions (the real exam: ~20–30 % "(Select TWO.)")… */
export const PACK_SPEC_MIN_MULTI = 0.2;
/** …and the key strictly the longest option in ≤ 25 % of them (chance with 4 options; AWS samples: 1 key in 13). */
export const PACK_SPEC_MAX_LONGEST_KEY = 0.25;

/** The (a) correct option is strictly longer than every distractor (characters). */
const keyIsLongest = (q: Pick<Question, 'options' | 'answer'>) => {
  const len = (right: boolean) => Math.max(0, ...q.options.filter((o) => q.answer.includes(o.key) === right).map((o) => o.text.trim().length));
  const other = len(false);
  return other > 0 && len(true) > other;
};

const pctOf = (n: number, total: number) => Math.round((100 * n) / total);

/** [v6] Warnings for one pack's exam-spec questions (Vietnamese, one line each); [] below PACK_SPEC_MIN_QUESTIONS. */
export function packSpecWarnings(qs: readonly Pick<Question, 'options' | 'answer'>[]): string[] {
  const n = qs.length;
  if (n < PACK_SPEC_MIN_QUESTIONS) return [];
  const out: string[] = [];
  const multi = qs.filter((q) => q.answer.length > 1).length;
  if (multi / n < PACK_SPEC_MIN_MULTI) {
    out.push(`${multi}/${n} câu chuẩn đề là câu nhiều đáp án (${pctOf(multi, n)} % < ${pctOf(PACK_SPEC_MIN_MULTI, 1)} %) — đề thật có khoảng 20–30 % câu “(Select TWO.)”: viết thêm câu chọn 2–3 đáp án`);
  }
  const longest = qs.filter(keyIsLongest).length;
  if (longest / n > PACK_SPEC_MAX_LONGEST_KEY) {
    out.push(`Đáp án đúng là phương án dài nhất ở ${longest}/${n} câu chuẩn đề (${pctOf(longest, n)} % > ${pctOf(PACK_SPEC_MAX_LONGEST_KEY, 1)} %) — người học đoán được nhờ độ dài: cân lại độ dài các phương án (ENRICH “balance”)`);
  }
  return out;
}

function flaw(code: string, message: string, option?: string): LintFlaw {
  const f: LintFlaw = { code, severity: RULE.get(code)!.severity, message };
  if (option) f.option = option;
  return f;
}

const CHECKS: ((q: LintInput, tax?: Taxonomy) => LintFlaw[])[] = [
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
  scopeFlaws,
  staleFacts,
];

const byRank = (a: LintFlaw, b: LintFlaw) =>
  SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || (CODE_RANK.get(a.code) ?? 99) - (CODE_RANK.get(b.code) ?? 99) || (a.option ?? '').localeCompare(b.option ?? '');

/**
 * Flaws of one question, most severe first. Pure function: no I/O — except [v6] reading quality.exam_spec_since from
 * config.yaml (memoized) for an AI / document medium-hard question when `ctx.examSpecSince` is not given. With `tax`,
 * also the exam-scope rules (oos-*); [v6] exam-spec questions (isExamSpec) also get the exam-spec rules.
 */
export function lintQuestion(q: LintInput, tax?: Taxonomy, ctx?: LintContext): LintFlaw[] {
  const input: LintInput = { id: q.id, stem: q.stem ?? '', options: q.options ?? [], answer: q.answer ?? [], explanation: q.explanation ?? '' };
  const flaws = CHECKS.flatMap((check) => check(input, tax));
  if (ctx?.family?.length) flaws.push(...familyFlaws(input, ctx.family));
  if (specCandidate(q) && isExamSpec(q, ctx?.examSpecSince ?? examSpecSince())) {
    const spec: LintInput = { ...input, refs: q.refs ?? [], words: q.words, requirements: q.requirements };
    flaws.push(...EXAM_SPEC_CHECKS.flatMap((check) => check(spec, tax)));
  }
  return flaws.sort(byRank);
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

/** Cache key part for an exclusion set (sealed questions): the sorted ids. */
const excludeKey = (exclude?: ReadonlySet<string>) => (exclude?.size ? [...exclude].sort().join(',') : '');

/**
 * Lint every active question: per-rule counts, flagged ids per rule and the worst questions. Cached by bank version
 * ([v6] and the exam-spec date: config quality.exam_spec_since unless `opts.examSpecSince`).
 * `exclude` (sealed questions) are left out of every number and list.
 */
export function lintBank(bank: BankState, opts: { cache?: boolean; exclude?: ReadonlySet<string>; examSpecSince?: string } = {}): LintSummary {
  const since = opts.examSpecSince ?? examSpecSince();
  const useCache = opts.cache !== false && !!bank.version;
  const key = `${bank.version}|${excludeKey(opts.exclude)}|${since}`;
  if (useCache && cache?.version === key) return cache.value;
  const active = bank.questions.filter((q) => q.status === 'active' && !opts.exclude?.has(q.id));
  const byCode: LintSummary['byCode'] = {};
  for (const r of LINT_RULES) byCode[r.code] = { severity: r.severity, label: r.label, count: 0 };
  const ids: Record<string, string[]> = {};
  const bySeverity: Record<LintSeverity, number> = { high: 0, medium: 0, low: 0 };
  const flagged: { id: string; flaws: LintFlaw[]; rank: number[] }[] = [];
  for (const q of active) {
    const flaws = lintQuestion(q, bank.taxonomy, { ...lintContext(bank, q), examSpecSince: since });
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
  if (useCache) cache = { version: key, value };
  return value;
}

/** Every flagged active question for one rule (or all rules), worst first — the drill-down behind the summary cap. */
export function lintQuestionsFor(bank: BankState, code?: string, exclude?: ReadonlySet<string>): { id: string; flaws: LintFlaw[] }[] {
  const since = examSpecSince();
  const summary = lintBank(bank, { exclude, examSpecSince: since });
  const wanted = code ? new Set(summary.ids?.[code] ?? []) : undefined;
  return bank.questions
    .filter((q) => q.status === 'active' && !exclude?.has(q.id) && (!wanted || wanted.has(q.id)))
    .map((q) => ({ id: q.id, flaws: lintQuestion(q, bank.taxonomy, { ...lintContext(bank, q), examSpecSince: since }) }))
    .filter((x) => x.flaws.length)
    .sort((a, b) => {
      const [x, y] = [badness(a.flaws), badness(b.flaws)];
      return y[0] - x[0] || y[1] - x[1] || y[2] - x[2] || a.id.localeCompare(b.id);
    });
}
