import { api } from './api.ts';
import { navigate } from './router.ts';
import { loadActive, startActive } from './session.ts';
import { toast } from '../components/ui.tsx';
import type { BuildTestRequest, Question, TestSession } from '../../shared/types.ts';

/** Builds a test on the server, stores it as the active test and opens the runner. */
export async function startTest(req: BuildTestRequest): Promise<boolean> {
  const current = loadActive();
  if (current && !window.confirm(`Bạn đang làm dở “${current.session.title}”. Bỏ bài đó để bắt đầu bài mới?`)) return false;
  try {
    const { session, questions } = await api.post<{ session: TestSession; questions: Question[] }>('/api/tests', req);
    startActive(session, questions);
    if (session.notes.length) toast(session.notes.join(' '));
    navigate('/run');
    return true;
  } catch (e) {
    toast(`Không tạo được bài test: ${(e as Error).message}`);
    return false;
  }
}
