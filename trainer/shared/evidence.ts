// [v5 · λ] Statistical shield for every automatic verdict ("chủ đề yếu", stamina, calibration, weak picks, snapshot
// tables): accuracy shrunk toward the learner's own base rate, an 80 % interval, a verdict only when the interval excludes
// the base rate, and how many more answers would likely settle it. Pure functions (no imports): server, UI and snapshot
// share them.
//
// Model: Beta prior centred on the parent rate p with strength k pseudo-answers (default 10) → posterior
//   Beta(correct + p·k, wrong + (1 − p)·k). shrunk = posterior mean; [lo, hi] = its 10 % / 90 % quantiles (80 % level).
//   Hierarchy (stats.ts): service → its taxonomy topic → overall · task → its domain → overall · anything else → overall;
//   the parent's shrunk rate is the child's prior mean, the learner's overall rate stays the comparison base.
// Verdict vs the base rate b (needs ≥ MIN_VERDICT_ANSWERS own answers — a prior alone never decides):
//   hi < b → below · lo > b → above · [lo, hi] ⊂ [b − SAME_MARGIN, b + SAME_MARGIN] → same · otherwise unknown.
// needMore: answers still needed before a verdict is likely, if new answers come at the current shrunk rate (normal
//   approximation of the posterior width; 0 = decided now, capped at NEED_MAX).
// compareRates: two independent rates (first vs last quarter, sure vs unsure, long vs short): difference of the two
//   posteriors (Jeffreys prior Beta(½, ½)), normal approximation, same 80 % level — a verdict only when the interval of
//   the difference excludes 0.
import type { EvidenceVerdict } from './types.ts';

export interface Prior {
  p: number; // base rate 0..1 (the learner's overall accuracy, or the parent bucket's shrunk rate)
  k: number; // strength in pseudo-answers (default 10)
}

export interface Estimate {
  raw: number; // correct / n (0 when n = 0), 0..1
  shrunk: number; // posterior mean, 0..1
  lo: number; // lower bound of the interval, 0..1
  hi: number; // upper bound
  n: number;
}

/** Prior strength in pseudo-answers. */
export const PRIOR_K = 10;
/** Interval level used everywhere (80 %). */
export const LEVEL = 0.8;
/** Own answers a bucket needs before any verdict (the prior alone never decides). */
export const MIN_VERDICT_ANSWERS = 5;
/** 'same': the whole interval lies within ± this of the base rate (10 points). */
export const SAME_MARGIN = 0.1;
/** needMore is capped here ("cần ~500 câu nữa" already means "not with this bank"). */
export const NEED_MAX = 500;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
/** Prior means are kept off 0 / 1 so both Beta parameters stay positive. */
const clampP = (p: number) => Math.min(0.99, Math.max(0.01, Number.isFinite(p) ? p : 0.5));

// ── special functions (Numerical Recipes 3rd ed. §6.1, §6.4, §6.14) ─────────

const LG_COF = [
  57.1562356658629235, -59.5979603554754912, 14.1360979747417471, -0.491913816097620199, 0.339946499848118887e-4, 0.465236289270485756e-4, -0.983744753048795646e-4,
  0.158088703224912494e-3, -0.210264441724104883e-3, 0.217439618115212643e-3, -0.16431810653676389e-3, 0.844182239838527433e-4, -0.261908384015814087e-4,
  0.368991826595316234e-5,
];

/** ln Γ(x), x > 0 (Lanczos, |error| < 1e-15). */
export function lnGamma(x: number): number {
  let y = x;
  let tmp = x + 5.2421875;
  tmp = (x + 0.5) * Math.log(tmp) - tmp;
  let ser = 0.999999999999997092;
  for (const c of LG_COF) ser += c / ++y;
  return tmp + Math.log((2.5066282746310005 * ser) / x);
}

const EPS = 1e-15;
const FPMIN = 1e-300;

/** Continued fraction of the incomplete beta function (modified Lentz). */
function betacf(a: number, b: number, x: number): number {
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m < 10_000; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) <= EPS) break;
  }
  return h;
}

/** Regularized incomplete beta I_x(a, b) = P(X ≤ x) for X ~ Beta(a, b). */
export function betaCdf(x: number, a: number, b: number): number {
  if (!(a > 0) || !(b > 0)) return NaN;
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(lnGamma(a + b) - lnGamma(a) - lnGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? (bt * betacf(a, b, x)) / a : 1 - (bt * betacf(b, a, 1 - x)) / b;
}

/** Quantile of Beta(a, b): the x with I_x(a, b) = q (Halley-corrected Newton from a good start, bisection fallback). */
export function betaQuantile(q: number, a: number, b: number): number {
  if (!(a > 0) || !(b > 0) || !Number.isFinite(q)) return NaN;
  if (q <= 0) return 0;
  if (q >= 1) return 1;
  const a1 = a - 1;
  const b1 = b - 1;
  let x: number;
  if (a >= 1 && b >= 1) {
    const pp = q < 0.5 ? q : 1 - q;
    const t = Math.sqrt(-2 * Math.log(pp));
    let z = (2.30753 + t * 0.27061) / (1 + t * (0.99229 + t * 0.04481)) - t;
    if (q < 0.5) z = -z;
    const al = (z * z - 3) / 6;
    const h = 2 / (1 / (2 * a - 1) + 1 / (2 * b - 1));
    const w = (z * Math.sqrt(al + h)) / h - (1 / (2 * b - 1) - 1 / (2 * a - 1)) * (al + 5 / 6 - 2 / (3 * h));
    x = a / (a + b * Math.exp(2 * w));
  } else {
    const lna = Math.log(a / (a + b));
    const lnb = Math.log(b / (a + b));
    const t = Math.exp(a * lna) / a;
    const u = Math.exp(b * lnb) / b;
    const w = t + u;
    x = q < t / w ? Math.pow(a * w * q, 1 / a) : 1 - Math.pow(b * w * (1 - q), 1 / b);
  }
  const afac = -lnGamma(a) - lnGamma(b) + lnGamma(a + b);
  for (let j = 0; j < 12; j++) {
    if (!(x > 0 && x < 1)) break;
    const err = betaCdf(x, a, b) - q;
    let t = Math.exp(a1 * Math.log(x) + b1 * Math.log(1 - x) + afac);
    const u = err / t;
    t = u / (1 - 0.5 * Math.min(1, u * (a1 / x - b1 / (1 - x))));
    x -= t;
    if (x <= 0) x = 0.5 * (x + t);
    if (x >= 1) x = 0.5 * (x + t + 1);
    if (Math.abs(t) < 1e-10 * x && j > 0) break;
  }
  // rare non-convergence (extreme parameters): plain bisection on the CDF
  if (!(x > 0 && x < 1) || Math.abs(betaCdf(x, a, b) - q) > 1e-7) {
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 80; i++) {
      const mid = (lo + hi) / 2;
      if (betaCdf(mid, a, b) < q) lo = mid;
      else hi = mid;
    }
    x = (lo + hi) / 2;
  }
  return x;
}

/** z of the two-sided normal interval at `level` (0.8 → 1.2816) — Acklam's inverse normal CDF, |rel. error| < 1.2e-9. */
export function zFor(level: number): number {
  const p = Math.min(1 - 1e-12, Math.max(0.5, (1 + level) / 2));
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  if (p <= 1 - 0.02425) {
    const q = p - 0.5;
    const r = q * q;
    return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  const q = Math.sqrt(-2 * Math.log(1 - p));
  return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
}

// ── estimate / verdict / needMore ───────────────────────────────────────────

/** Shrunk estimate + `level` interval: posterior Beta(correct + p·k, n − correct + (1 − p)·k). */
export function estimate(correct: number, n: number, prior: Prior = { p: 0.5, k: PRIOR_K }, level = LEVEL): Estimate {
  const nn = Math.max(0, Number.isFinite(n) ? n : 0);
  const c = Math.min(nn, Math.max(0, Number.isFinite(correct) ? correct : 0));
  const p = clampP(prior.p);
  const k = Math.max(0.1, Number.isFinite(prior.k) ? prior.k : PRIOR_K);
  const a = c + p * k;
  const b = nn - c + (1 - p) * k;
  const tail = (1 - Math.min(0.999, Math.max(0.01, level))) / 2;
  return {
    raw: nn > 0 ? c / nn : 0,
    shrunk: a / (a + b),
    lo: clamp01(betaQuantile(tail, a, b)),
    hi: clamp01(betaQuantile(1 - tail, a, b)),
    n: nn,
  };
}

/** Below / above / same as the base rate — only when the interval allows it (see the header). */
export function verdict(e: Estimate, rate: number): EvidenceVerdict {
  if (!(e.n >= MIN_VERDICT_ANSWERS) || !Number.isFinite(rate)) return 'unknown';
  const base = clampP(rate); // a learner at 0 % / 100 % so far: compare with 1 % / 99 %, like the prior
  if (e.hi < base) return 'below';
  if (e.lo > base) return 'above';
  if (e.lo >= base - SAME_MARGIN && e.hi <= base + SAME_MARGIN) return 'same';
  return 'unknown';
}

/**
 * Answers still needed before a verdict is likely, assuming new answers come at the current shrunk rate (the posterior
 * mean then stays put while the interval narrows ~ 1/√(n + k)). 0 = a verdict already holds. `prior` defaults to the base.
 */
export function needMore(correct: number, n: number, base: number, prior: Prior = { p: base, k: PRIOR_K }, level = LEVEL): number {
  const e = estimate(correct, n, prior, level);
  if (verdict(e, base) !== 'unknown') return 0;
  base = clampP(base);
  const k = Math.max(0.1, Number.isFinite(prior.k) ? prior.k : PRIOR_K);
  const s = Math.min(0.999, Math.max(0.001, e.shrunk));
  const z = zFor(level);
  const spread = z * z * s * (1 - s); // half-width² × (posterior strength + 1)
  const gap = Math.abs(s - base);
  let total = Infinity; // posterior strength (n + m + k) at which a verdict is likely
  if (gap > 1e-9) total = Math.min(total, spread / (gap * gap) - 1); // the interval stops covering the base
  if (gap < SAME_MARGIN - 1e-9) total = Math.min(total, spread / (SAME_MARGIN - gap) ** 2 - 1); // narrow enough around it
  if (!Number.isFinite(total)) return NEED_MAX;
  const more = Math.max(MIN_VERDICT_ANSWERS - e.n, Math.ceil(total - k - e.n), 1);
  return Math.min(NEED_MAX, more);
}

export interface Evidence extends Estimate {
  verdict: EvidenceVerdict;
  needMore: number;
}

/** Everything a bucket shows: estimate (0..1), verdict vs `base`, needMore (prior mean = `prior.p`, default the base). */
export function evidenceOf(correct: number, n: number, base: number, prior: Prior = { p: base, k: PRIOR_K }): Evidence {
  const e = estimate(correct, n, prior);
  const v = verdict(e, base);
  return { ...e, verdict: v, needMore: v === 'unknown' ? needMore(correct, n, base, prior) : 0 };
}

// ── helpers for the UI, selection and the coach snapshot ────────────────────

/** Copy for an undecided verdict. */
export function undecidedText(more: number): string {
  return `chưa đủ dữ liệu — cần ~${Math.max(1, Math.round(more))} câu nữa`;
}

/**
 * Weak lists: pessimistic lower bound first (shrunk / raw accuracy when there is no bound), then more answers, then key.
 * Works on Bucket (0..100 fields) and Estimate (0..1) alike — only the order matters.
 */
export function weakFirst<T extends { lo?: number; shrunk?: number; accuracy?: number; attempts?: number; n?: number; key?: string }>(a: T, b: T): number {
  const low = (x: T) => x.lo ?? x.shrunk ?? x.accuracy ?? 0;
  const n = (x: T) => x.attempts ?? x.n ?? 0;
  return low(a) - low(b) || n(b) - n(a) || String(a.key ?? '').localeCompare(String(b.key ?? ''));
}

export interface RateComparison {
  diff: number; // rate 1 − rate 2, −1..1 (posterior means, Jeffreys prior)
  lo: number; // interval of the difference
  hi: number;
  verdict: EvidenceVerdict; // 'below' = rate 1 below rate 2 · 'above' · 'same' (|diff| surely < SAME_MARGIN) · 'unknown'
  needMore: number; // answers per side still needed before a verdict is likely (0 = decided)
}

/** Is rate 1 (c1 / n1) really different from rate 2 (c2 / n2)? Normal approximation of two Beta(½ + c, ½ + n − c) posteriors. */
export function compareRates(c1: number, n1: number, c2: number, n2: number, level = LEVEL): RateComparison {
  const post = (c: number, n: number) => {
    const a = Math.max(0, c) + 0.5;
    const b = Math.max(0, n - c) + 0.5;
    return { m: a / (a + b), v: (a * b) / ((a + b) ** 2 * (a + b + 1)) };
  };
  const x = post(c1, n1);
  const y = post(c2, n2);
  const z = zFor(level);
  const diff = x.m - y.m;
  const sd = Math.sqrt(x.v + y.v);
  const lo = Math.max(-1, diff - z * sd);
  const hi = Math.min(1, diff + z * sd);
  let v: EvidenceVerdict = 'unknown';
  if (Math.min(n1, n2) >= MIN_VERDICT_ANSWERS) {
    if (hi < 0) v = 'below';
    else if (lo > 0) v = 'above';
    else if (lo >= -SAME_MARGIN && hi <= SAME_MARGIN) v = 'same';
  }
  let more = 0;
  if (v === 'unknown') {
    // per side, at the current rates: variance of the difference ≈ (p1·q1 + p2·q2) / N
    const pq = x.m * (1 - x.m) + y.m * (1 - y.m);
    const g = Math.abs(diff);
    let per = Infinity;
    if (g > 1e-9) per = Math.min(per, (z * z * pq) / (g * g));
    if (g < SAME_MARGIN - 1e-9) per = Math.min(per, (z * z * pq) / (SAME_MARGIN - g) ** 2);
    const have = Math.min(n1, n2);
    more = Number.isFinite(per) ? Math.min(NEED_MAX, Math.max(1, MIN_VERDICT_ANSWERS - have, Math.ceil(per - have))) : NEED_MAX;
  }
  return { diff, lo, hi, verdict: v, needMore: more };
}
