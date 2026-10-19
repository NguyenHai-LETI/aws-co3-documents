#!/usr/bin/env node
// Stand-in for the Claude Code CLI in e2e tests — never calls a model. `--version` and `auth status` answer like the real
// CLI; `-p <prompt>` (cwd = repo root) writes the learner profile, as an analyze run would, recording what the run could
// see (result files on disk, attempts in the snapshot), then prints a stream-json transcript that ends in a success.
import fs from 'node:fs';

const argv = process.argv.slice(2);
if (argv[0] === '--version') {
  console.log('2.1.301 (Claude Code)');
  process.exit(0);
}
if (argv[0] === 'auth') {
  console.log(JSON.stringify({ loggedIn: true, authMethod: 'claude.ai', subscriptionType: 'max' }));
  process.exit(0);
}

const prompt = argv[argv.indexOf('-p') + 1] ?? '';
const runId = /run_id: (\S+)/.exec(prompt)?.[1] ?? '?';
const dir = 'trainer/results';
const results = fs.existsSync(dir) ? fs.readdirSync(dir, { recursive: true }).filter((f) => String(f).endsWith('.md')).length : 0;
let snapshotAttempts = '?';
try {
  snapshotAttempts = /^attempts: (\d+)/m.exec(fs.readFileSync('trainer/coach/snapshot.md', 'utf8'))?.[1] ?? '?';
} catch {
  // no snapshot
}
const say = (o) => process.stdout.write(JSON.stringify(o) + '\n');
say({ type: 'system', subtype: 'init', model: 'fake-claude', permissionMode: 'dontAsk' });
fs.writeFileSync('trainer/coach/learner-profile.md', `# Learner profile\n\nrun: ${runId}\nresults_on_disk: ${results}\nsnapshot_attempts: ${snapshotAttempts}\n`);
say({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Write', input: { file_path: 'trainer/coach/learner-profile.md' } }] } });
say({ type: 'result', subtype: 'success', is_error: false, total_cost_usd: 0, result: `fake run ${runId}`, permission_denials: [] });
