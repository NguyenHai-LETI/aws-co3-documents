// Regenerates coach/snapshot.md (the learner digest the AI coach reads first).
// Usage: node trainer/scripts/snapshot.ts
import { loadConfig, SNAPSHOT_FILE, rel } from '../server/config.ts';
import { loadBank } from '../server/lib/bank.ts';
import { writeSnapshot } from '../server/lib/snapshot.ts';

const meta = writeSnapshot(loadBank(), loadConfig());
console.log(`✓ ${rel(SNAPSHOT_FILE)} — ${meta.attempts} bài, ${meta.answers} câu, mới từ kế hoạch gần nhất: ${JSON.stringify(meta.new_since_latest_plan)}`);
