import { api } from './api.ts';
import { navigate } from './router.ts';
import { loadActive, startActive } from './session.ts';
import { toast } from '../components/ui.tsx';
import { sealedToConfirm } from '../components/onboarding/rules.ts';
import type { BuildTestRequest, Question, TestSession } from '../../shared/types.ts';

/** "Start the sealed form?" — a form measures only once (its first submit is the score on new questions). */
function confirmSealed(form: string): boolean {
  return window.confirm(
    `Bắt đầu đề niêm phong${form ? ` ${form}` : ''}? Mỗi đề chỉ đo được một lần (mô phỏng Pearson, không tạm dừng) — hãy làm khi có đủ thời gian và không xem tài liệu.`,
  );
}

/** "Drop the unfinished test?" — a sealed form dropped half-way stays sealed, but the questions already seen are no longer new. */
function confirmDrop(s: TestSession): boolean {
  return window.confirm(
    s.sealedForm
      ? `Bạn đang làm dở đề niêm phong ${s.sealedForm}. Bỏ bài thì đề vẫn niêm phong, nhưng những câu đã xem sẽ không còn là câu mới khi làm lại — nếu đã xem nhiều câu, hãy bấm “Mở sớm” cho đề này (Thống kê → 🔒 Đề niêm phong). Vẫn bỏ bài để bắt đầu bài mới?`
      : `Bạn đang làm dở “${s.title}”. Bỏ bài đó để bắt đầu bài mới?`,
  );
}

/**
 * Builds a test on the server, stores it as the active test and opens the runner.
 * A full mock exam (`mode: 'exam'`) is the Pearson VUE simulation unless `pearson: false` is passed.
 * A sealed exam asks for confirmation first — `mode: 'sealed'` (+ optional `form`, default the next sealed form) before it
 * is built, and any other request (an AI / onboarding plan session) as soon as the built session turns out to be one
 * (building a test changes nothing on the server, so a declined one is simply dropped).
 * `mode: 'diagnostic'` = 2 questions per exam-guide task (28); `count: 14` = 1 per task (a second run gets the other 14).
 */
export async function startTest(input: BuildTestRequest): Promise<boolean> {
  const req: BuildTestRequest = input.mode === 'exam' && input.pearson === undefined ? { ...input, pearson: true } : input;
  const before = sealedToConfirm(req);
  if (before !== undefined && !confirmSealed(before)) return false;
  const current = loadActive();
  if (current && !confirmDrop(current.session)) return false;
  try {
    const { session, questions } = await api.post<{ session: TestSession; questions: Question[] }>('/api/tests', req);
    const after = sealedToConfirm(req, session);
    if (after !== undefined && !confirmSealed(after)) return false;
    const known = questions.filter((q): q is Question => !!q);
    if (!known.length) throw new Error('Server không trả về câu hỏi nào.');
    startActive(session, known, req);
    if (session.notes?.length) toast(session.notes.join(' '));
    navigate('/run');
    return true;
  } catch (e) {
    toast(`Không tạo được bài test: ${(e as Error).message}`);
    return false;
  }
}
