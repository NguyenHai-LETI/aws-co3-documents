// bank/issues.md — a checklist of problems the learner reported from the review screen.
// The AI coach reads open items, fixes the question in its pack and ticks the box.
//   - [ ] 2026-10-16 · `03-v2-17` · wrong-key · I think C is also correct because …
//   - [x] 2026-10-16 · `03-v2-17` · wrong-key · … → ✅ 2026-10-17 coach: fixed answer to C
import fs from 'node:fs';
import { ISSUES_FILE } from '../config.ts';
import { localDateKey } from './time.ts';
import type { IssueItem } from '../../shared/types.ts';

const HEADER = `# 🐞 Question issues

Danh sách lỗi câu hỏi do người học báo từ màn hình xem kết quả.
AI Coach đọc các mục \`[ ]\`, kiểm tra lại câu hỏi trong pack tương ứng, sửa (giữ nguyên id) rồi đánh dấu \`[x]\`
và ghi kết quả xử lý sau dấu \`→\`.

Định dạng 1 dòng: \`- [ ] YYYY-MM-DD · \\\`question-id\\\` · loại · nội dung\`

<!-- issues -->
`;

const LINE = /^- \[( |x|X)\] (\d{4}-\d{2}-\d{2}) · `([^`]+)` · ([a-z-]+) · (.*)$/;

export function loadIssues(): IssueItem[] {
  if (!fs.existsSync(ISSUES_FILE)) return [];
  const items: IssueItem[] = [];
  fs.readFileSync(ISSUES_FILE, 'utf8')
    .split('\n')
    .forEach((line, i) => {
      const m = line.match(LINE);
      if (!m) return;
      const [note, resolution] = m[5].split(/\s+→\s+/, 2);
      items.push({ line: i + 1, open: m[1] === ' ', date: m[2], qid: m[3], type: m[4], note: note.trim(), resolution: resolution?.trim() });
    });
  return items;
}

export function addIssue(qid: string, type: string, note: string): IssueItem {
  if (!fs.existsSync(ISSUES_FILE)) fs.writeFileSync(ISSUES_FILE, HEADER);
  const clean = note.replace(/\s+/g, ' ').replace(/→/g, '->').trim() || '(không ghi chú)';
  const safeType = /^[a-z-]+$/.test(type) ? type : 'other';
  const line = `- [ ] ${localDateKey(new Date())} · \`${qid}\` · ${safeType} · ${clean}`;
  const text = fs.readFileSync(ISSUES_FILE, 'utf8');
  fs.writeFileSync(ISSUES_FILE, text.endsWith('\n') ? text + line + '\n' : text + '\n' + line + '\n');
  return loadIssues().reverse().find((x) => x.qid === qid)!;
}

export function ensureIssuesFile(): void {
  if (!fs.existsSync(ISSUES_FILE)) fs.writeFileSync(ISSUES_FILE, HEADER);
}
