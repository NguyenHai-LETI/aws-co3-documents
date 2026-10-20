import { api } from './api.ts';
import { navigate } from './router.ts';
import { loadActive, startActive } from './session.ts';
import { toast } from '../components/ui.tsx';
import type { BuildTestRequest, Question, TestSession } from '../../shared/types.ts';

/**
 * Builds a test on the server, stores it as the active test and opens the runner.
 * A full mock exam (`mode: 'exam'`) is the Pearson VUE simulation unless `pearson: false` is passed.
 * `mode: 'sealed'` (+ optional `form`, default the next sealed form) asks for confirmation first: a form measures only once.
 * `mode: 'diagnostic'` = 2 questions per exam-guide task (28); `count: 14` = 1 per task (a second run gets the other 14).
 */
export async function startTest(input: BuildTestRequest): Promise<boolean> {
  const req: BuildTestRequest = input.mode === 'exam' && input.pearson === undefined ? { ...input, pearson: true } : input;
  if (
    req.mode === 'sealed' &&
    !window.confirm(
      `Bắt đầu đề niêm phong${req.form ? ` ${req.form}` : ''}? Mỗi đề chỉ đo được một lần (mô phỏng Pearson, không tạm dừng) — hãy làm khi có đủ thời gian và không xem tài liệu.`,
    )
  ) {
    return false;
  }
  const current = loadActive();
  if (current && !window.confirm(`Bạn đang làm dở “${current.session.title}”. Bỏ bài đó để bắt đầu bài mới?`)) return false;
  try {
    const { session, questions } = await api.post<{ session: TestSession; questions: Question[] }>('/api/tests', req);
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
