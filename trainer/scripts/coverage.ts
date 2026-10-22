// Bank coverage vs the SAA-C03 exam guide (for /trainer-coverage): domains vs exam weights, questions per
// task statement, services without questions, likely misclassified questions.
// [v6] + tiers A/B/C vs the 280 tier-A target (per domain / task, multiple-response share in tier A) and the `scope: legacy`
// services (questions naming them in a correct option / a wrong option / anywhere). --json prints the same Coverage object.
// Usage: node trainer/scripts/coverage.ts [--json]
import { loadBank } from '../server/lib/bank.ts';
import { computeCoverage, coverageMarkdown } from '../server/lib/coverage.ts';

const cov = computeCoverage(loadBank());
console.log(process.argv.includes('--json') ? JSON.stringify(cov, null, 2) : coverageMarkdown(cov));
