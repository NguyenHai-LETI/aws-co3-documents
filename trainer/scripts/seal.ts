// npm run seal — sealed forms (A1): questions held back from practice to measure readiness on never-seen questions.
// Never prints a question id (honour system: the list lives in results/sealed.md).
// Usage:
//   npm run seal                                     status (same as --status)
//   npm run seal -- --forms 2 --size 50              create forms (only while no form is sealed; numbering continues)
//   npm run seal -- --release S1                     open a form early: its questions return to practice, no sealed score
//   npm run seal -- --reset [--forms N] [--size M]   forget every form, then create new ones (config exam.* or the flags;
//                                                    --forms 0 = none). Attempt files keep their sealed_form.
//   npm run seal -- --reset --force                  the same while results/sealed.md is broken (otherwise every write is
//                                                    refused until the file is fixed by hand, and its ids stay hidden)
import { loadConfig } from '../server/config.ts';
import { loadBank } from '../server/lib/bank.ts';
import { loadAttempts } from '../server/lib/results.ts';
import { SealedError, createForms, releaseForm, resetSealed, sealedError, sealedStatus, type CreateResult } from '../server/lib/sealed.ts';
import type { SealedFormSummary } from '../shared/types.ts';

const argv = process.argv.slice(2);
const flag = (name: string) => argv.includes(`--${name}`);
const opt = (name: string) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[i + 1] : undefined;
};
const num = (name: string): number | undefined => {
  const v = opt(name);
  if (v === undefined) {
    if (flag(name)) usage(`--${name} cần một số`);
    return undefined;
  }
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0) usage(`--${name} phải là số nguyên ≥ 0 (nhận "${v}")`);
  return n;
};

function usage(msg: string): never {
  console.error(`✗ ${msg}\n  Dùng: npm run seal -- [--status] [--forms N --size M] [--release S1] [--reset]`);
  process.exit(2);
}

const STATUS: Record<SealedFormSummary['status'], string> = { sealed: '🔒 niêm phong', used: '✅ đã làm   ', released: '🔓 đã mở sớm' };
const day = (iso?: string) => (iso ? iso.slice(0, 16).replace('T', ' ') : '');

function printStatus() {
  const s = sealedStatus();
  if (s.error) {
    console.log(`⛔ ${s.error}`);
    return;
  }
  if (!s.forms.length) {
    console.log('🔒 Chưa có đề niêm phong. Tạo: npm run seal -- --forms 2 --size 50 (hoặc config.yaml → exam.sealed_forms, tạo khi mở app).');
    return;
  }
  console.log(`🔒 Đề niêm phong — ${s.file ?? 'results/sealed.md'} (${s.size} câu/đề)`);
  for (const f of s.forms) {
    const extra = f.status === 'used' ? ` · ${day(f.usedAt)}${f.attempt ? ` · bài ${f.attempt}` : ''}` : f.status === 'released' ? ` · ${day(f.releasedAt)}` : '';
    console.log(`  ${f.id.padEnd(4)} ${STATUS[f.status]}  ${String(f.count).padStart(3)} câu${extra}`);
  }
  console.log(
    s.sealed
      ? `  Đang giữ riêng ${s.sealed} câu: không xuất hiện khi luyện, tìm kiếm, xuất Anki, danh sách Ngân hàng hay kế hoạch AI Coach.`
      : '  Không còn câu nào bị giữ riêng.',
  );
}

function printCreated(r: CreateResult) {
  const x = r.excluded;
  console.log(`✓ Đã tạo ${r.created.join(', ')} từ ${r.pool} câu đủ điều kiện (loại: ${x.outOfScope} ngoài phạm vi · ${x.siblings} có câu anh em · ${x.quality} chất lượng chưa ổn · ${x.unverified} câu AI chưa giải mù khớp · ${x.earlier} thuộc đề cũ · ${x.inactive} draft/retired).`);
  for (const n of r.notes) console.log(`  ⚠️ ${n}`);
}

try {
  const release = opt('release');
  if (flag('release') && !release) usage('--release cần mã đề, vd --release S1');
  const forms = num('forms');
  const size = num('size');
  if (release) {
    const f = releaseForm(release);
    console.log(`✓ Đã mở sớm ${f.id}: ${f.ids.length} câu trở lại các chế độ luyện (không có điểm niêm phong).`);
  } else if (flag('reset')) {
    resetSealed({ force: flag('force') });
    console.log('✓ Đã xoá mọi đề niêm phong (file kết quả cũ vẫn giữ nguyên).');
    const cfg = loadConfig();
    const want = forms ?? cfg.exam.sealed_forms;
    if (want > 0) printCreated(createForms(loadBank(), loadAttempts(cfg), cfg, { forms: want, size: size ?? cfg.exam.sealed_size }));
  } else if (forms !== undefined || size !== undefined) {
    if (forms === 0) usage('--forms 0 chỉ dùng cùng --reset');
    const cfg = loadConfig();
    printCreated(createForms(loadBank(), loadAttempts(cfg), cfg, { forms, size }));
  } else if (argv.some((a) => a.startsWith('--') && a !== '--status' && a !== '--force')) {
    usage(`không hiểu tham số: ${argv.join(' ')}`);
  }
  printStatus();
  if (sealedError()) process.exitCode = 1;
} catch (e) {
  if (e instanceof SealedError) {
    console.error(`✗ ${e.message}`);
    process.exit(1);
  }
  throw e;
}
