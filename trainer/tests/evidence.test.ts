// Unit tests for the statistical shield (shared/evidence.ts): Beta quantiles against closed forms, shrinkage,
// verdicts that need evidence, needMore, rate comparisons. Pure functions — no data root. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as ev from '../shared/evidence.ts';

const close = (a: number, b: number, eps = 1e-9, msg = '') => assert.ok(Math.abs(a - b) < eps, `${msg} ${a} ≈ ${b}`);

test('lnGamma and the Beta CDF match closed forms', () => {
  close(ev.lnGamma(1), 0, 1e-12);
  close(ev.lnGamma(0.5), Math.log(Math.sqrt(Math.PI)), 1e-12);
  close(ev.lnGamma(10), Math.log(362880), 1e-10);
  for (const x of [0.05, 0.3, 0.5, 0.8, 0.99]) close(ev.betaCdf(x, 2, 2), 3 * x * x - 2 * x ** 3, 1e-12, `I_${x}(2,2)`);
  close(ev.betaCdf(0.4, 1, 1), 0.4, 1e-12);
  assert.equal(ev.betaCdf(0, 3, 4), 0);
  assert.equal(ev.betaCdf(1, 3, 4), 1);
});

test('Beta quantiles: known values (uniform, Beta(1,b), Beta(a,1), arcsine, large parameters)', () => {
  close(ev.betaQuantile(0.1, 1, 1), 0.1);
  close(ev.betaQuantile(0.9, 1, 1), 0.9);
  close(ev.betaQuantile(0.1, 1, 5), 1 - Math.pow(0.9, 1 / 5));
  close(ev.betaQuantile(0.9, 3, 1), Math.pow(0.9, 1 / 3));
  close(ev.betaQuantile(0.1, 0.5, 0.5), Math.sin((Math.PI * 0.1) / 2) ** 2);
  close(ev.betaQuantile(0.5, 2, 2), 0.5);
  // large posteriors: the quantile inverts the CDF
  for (const [a, b] of [
    [500, 300],
    [1500.5, 2.5],
    [0.2, 9.8],
    [7, 3],
  ] as const) {
    for (const q of [0.1, 0.9]) close(ev.betaCdf(ev.betaQuantile(q, a, b), a, b), q, 1e-7, `B(${a},${b}) q${q}`);
  }
  close(ev.zFor(0.8), 1.2815515655, 1e-8);
  close(ev.zFor(0.95), 1.959963985, 1e-8);
});

test('estimate: shrinks toward the prior, 80 % interval around the posterior mean, narrower with more answers', () => {
  const e0 = ev.estimate(0, 0, { p: 0.7, k: 10 });
  close(e0.shrunk, 0.7, 1e-12);
  assert.equal(e0.raw, 0);
  assert.ok(e0.lo < 0.7 && e0.hi > 0.7);
  // posterior Beta(7, 3) → its own quantiles
  close(e0.lo, ev.betaQuantile(0.1, 7, 3), 1e-12);
  const few = ev.estimate(2, 4, { p: 0.7, k: 10 });
  close(few.shrunk, (2 + 7) / 14, 1e-12);
  assert.equal(few.raw, 0.5);
  const many = ev.estimate(50, 100, { p: 0.7, k: 10 });
  assert.ok(many.hi - many.lo < few.hi - few.lo, 'more answers → narrower interval');
  assert.ok(many.shrunk < few.shrunk && many.shrunk > 0.5, 'the raw rate wins with more data');
  // degenerate input never throws
  const odd = ev.estimate(5, 3, { p: 1.5, k: -1 });
  assert.ok(odd.lo >= 0 && odd.hi <= 1 && Number.isFinite(odd.shrunk));
});

test('verdict: only when the interval excludes the base rate, never from the prior alone', () => {
  const base = 0.7;
  assert.equal(ev.verdict(ev.estimate(0, 4, { p: 0.2, k: 10 }), base), 'unknown', 'fewer than MIN_VERDICT_ANSWERS own answers');
  assert.equal(ev.verdict(ev.estimate(10, 20, { p: base, k: 10 }), base), 'below');
  assert.equal(ev.verdict(ev.estimate(29, 30, { p: base, k: 10 }), base), 'above');
  assert.equal(ev.verdict(ev.estimate(28, 40, { p: base, k: 10 }), base), 'same', 'a narrow interval around the base');
  assert.equal(ev.verdict(ev.estimate(4, 6, { p: base, k: 10 }), base), 'unknown');
});

test('needMore: 0 once decided, decreasing with more answers at a fixed off-base rate, capped', () => {
  const base = 0.7;
  assert.equal(ev.needMore(10, 20, base), 0);
  let prev = Infinity;
  for (const n of [4, 6, 8, 10, 12, 14, 16]) {
    const m = ev.needMore(0.4 * n, n, base);
    assert.ok(m <= prev, `needMore(${n}) = ${m} ≤ ${prev}`);
    prev = m;
  }
  assert.ok(ev.needMore(0.4 * 6, 6, base) > 0);
  // a bigger gap needs fewer answers
  assert.ok(ev.needMore(1, 5, base) < ev.needMore(3, 5, base));
  // right at the base: enough answers to call it "same"
  const same = ev.needMore(0, 0, base);
  assert.ok(same > 0 && same < 60, `${same}`);
  assert.ok(ev.needMore(3.4, 5, 0.7) <= ev.NEED_MAX);
  // the prediction is roughly right: after needMore more answers at the same rate a verdict holds
  const m = ev.needMore(4, 10, base);
  const e = ev.estimate(4 + 0.4 * m * 1.2, 10 + m * 1.2, { p: base, k: 10 });
  assert.notEqual(ev.verdict(e, base), 'unknown');
  assert.equal(ev.undecidedText(12.4), 'chưa đủ dữ liệu — cần ~12 câu nữa');
});

test('evidenceOf, weakFirst, compareRates', () => {
  const e = ev.evidenceOf(5, 20, 0.75);
  assert.equal(e.verdict, 'below');
  assert.equal(e.needMore, 0);
  const rows = [
    { key: 'a', lo: 60, attempts: 10 },
    { key: 'b', lo: 40, attempts: 3 },
    { key: 'c', lo: 40, attempts: 30 },
  ];
  assert.deepEqual([...rows].sort(ev.weakFirst).map((r) => r.key), ['c', 'b', 'a']);
  const tired = ev.compareRates(14, 16, 6, 16); // first quarter 14/16 vs last 6/16
  assert.equal(tired.verdict, 'above');
  assert.ok(tired.lo > 0);
  const noise = ev.compareRates(10, 16, 8, 16);
  assert.equal(noise.verdict, 'unknown');
  assert.ok(noise.needMore > 0);
  assert.equal(ev.compareRates(3, 4, 1, 4).verdict, 'unknown', 'too few answers on a side');
  assert.equal(ev.compareRates(700, 1000, 705, 1000).verdict, 'same');
});

test('R1 #6: base rates of 0 or 1 are clamped like the prior — a perfect bucket of a perfect learner is not "below"', () => {
  assert.notEqual(ev.evidenceOf(8, 8, 1).verdict, 'below');
  assert.notEqual(ev.evidenceOf(0, 8, 0).verdict, 'above');
  assert.equal(ev.evidenceOf(0, 20, 1).verdict, 'below');
  assert.ok(Number.isFinite(ev.needMore(3, 4, 1)) && ev.needMore(3, 4, 1) >= 1);
});
