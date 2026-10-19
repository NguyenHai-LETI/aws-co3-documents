// Applies an AI patch (coach/patches/<runId>.yaml) to the question bank — format in bank/SCHEMA.md §8.
// Usage: node trainer/scripts/apply-patch.ts <patch.yaml> [--dry-run] [--json]
//   - each item is checked (base hash, field rules, re-parse, lint: a new high-severity item-writing flaw — duplicate
//     options, "all/none of the above", Choose-N mismatch, option letters — rejects it; other new flaws are ⚠️ warnings);
//     failing items are reverted and reported
//   - exit code 1 when an item failed or the patch could not be read (fix the items and run again)
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, REPO_DIR } from '../server/config.ts';
import { applyPatch, formatPatchResult } from '../server/lib/patch.ts';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const asJson = args.includes('--json');
const file = args.find((a) => !a.startsWith('--'));

if (!file) {
  console.error('Dùng: node trainer/scripts/apply-patch.ts <coach/patches/<run_id>.yaml> [--dry-run] [--json]');
  process.exit(2);
}

// accept paths relative to the cwd, the repo root or the data root (trainer/)
const candidates = [path.resolve(file), path.resolve(REPO_DIR, file), path.resolve(DATA_DIR, file), path.resolve(DATA_DIR, file.replace(/^(\.\/)?trainer\//, ''))];
const abs = candidates.find((p) => fs.existsSync(p)) ?? candidates[0];

const result = applyPatch(abs, { dryRun });
if (asJson) console.log(JSON.stringify(result, null, 2));
else for (const line of formatPatchResult(result)) console.log(line);
process.exit(result.error || result.failed ? 1 : 0);
