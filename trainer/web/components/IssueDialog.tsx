import { useState } from 'react';
import { Modal, toast } from './ui.tsx';
import { api } from '../lib/api.ts';
import { ISSUE_TYPES } from '../../shared/labels.ts';

/** "Report a problem with this question" → appended to bank/issues.md for the AI coach. */
export function IssueDialog({ qid, onClose }: { qid: string | undefined; onClose: () => void }) {
  const [type, setType] = useState('wrong-key');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!qid) return;
    setBusy(true);
    try {
      await api.post('/api/issues', { qid, type, note });
      toast('Đã ghi vào bank/issues.md — AI Coach sẽ xử lý ở lần phân tích tới.');
      setNote('');
      onClose();
    } catch (e) {
      toast(`Lỗi: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={!!qid} onClose={onClose} title={<>🐞 Báo lỗi câu <code>{qid}</code></>}>
      <div className="stack">
        <label className="field">
          Loại vấn đề
          <select value={type} onChange={(e) => setType(e.target.value)}>
            {ISSUE_TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Mô tả (AI Coach sẽ đọc để kiểm tra & sửa)
          <textarea rows={4} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ví dụ: Mình nghĩ đáp án C cũng đúng vì RDS Proxy hỗ trợ IAM auth…" />
        </label>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn ghost" onClick={onClose}>
            Hủy
          </button>
          <button className="btn primary" disabled={busy} onClick={submit}>
            Gửi báo lỗi
          </button>
        </div>
      </div>
    </Modal>
  );
}
