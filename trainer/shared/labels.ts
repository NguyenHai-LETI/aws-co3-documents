import type { FeedbackMode, TestMode } from './types.ts';

export interface ModeInfo {
  icon: string;
  label: string;
  desc: string;
}

export const MODE_INFO: Record<TestMode, ModeInfo> = {
  exam: { icon: '🎯', label: 'Thi thử SAA-C03', desc: '65 câu theo trọng số 4 domain (30/26/24/20); mô phỏng Pearson VUE: 15 câu thử nghiệm, màn hình Review cuối bài.' },
  topic: { icon: '📚', label: 'Theo chủ đề', desc: 'Chọn 1 hoặc nhiều chủ đề (Compute, Storage, Database…), lấy ngẫu nhiên.' },
  pack: { icon: '📦', label: 'Theo bộ đề', desc: 'Làm lại nguyên 1 bộ đề (V1, V2, bộ AI sinh, bộ từ tài liệu…).' },
  custom: { icon: '🛠️', label: 'Tùy chỉnh', desc: 'Lọc tự do theo domain, chủ đề, độ khó, service, tag, nguồn câu hỏi.' },
  'retry-wrong': { icon: '🔁', label: 'Làm lại câu sai', desc: 'Các câu mà lần làm gần nhất bạn trả lời sai.' },
  srs: { icon: '🧠', label: 'Ôn tập ngắt quãng', desc: 'Câu đến hạn ôn theo FSRS — câu sắp quên nhất trước, có giới hạn số câu mỗi ngày.' },
  new: { icon: '🆕', label: 'Câu chưa làm', desc: 'Chỉ lấy câu bạn chưa từng gặp — tăng độ phủ ngân hàng.' },
  flagged: { icon: '🚩', label: 'Đánh dấu / chưa chắc', desc: 'Câu bạn đã cắm cờ hoặc chọn “chưa chắc” ở lần gần nhất.' },
  weak: { icon: '💪', label: 'Củng cố điểm yếu', desc: 'Ưu tiên chủ đề/khái niệm có tỉ lệ đúng thấp và câu chưa thuộc.' },
  slow: { icon: '🐢', label: 'Luyện tốc độ', desc: 'Câu bạn từng làm chậm hơn 1.5× thời gian chuẩn.' },
  quick: { icon: '⚡', label: 'Luyện nhanh', desc: '10 câu ngẫu nhiên, xem đáp án ngay sau mỗi câu.' },
  coach: { icon: '🤖', label: 'Kế hoạch AI Coach', desc: 'Phiên luyện do AI Coach đề xuất sau khi phân tích kết quả.' },
  ids: { icon: '📌', label: 'Danh sách chọn sẵn', desc: 'Một danh sách câu cụ thể (chọn từ ngân hàng hoặc màn hình kết quả).' },
};

export const FEEDBACK_INFO: Record<FeedbackMode, ModeInfo> = {
  exam: { icon: '📝', label: 'Chấm cuối bài', desc: 'Như thi thật: chỉ xem đáp án sau khi nộp bài.' },
  practice: { icon: '💡', label: 'Xem đáp án ngay', desc: 'Kiểm tra từng câu, đọc giải thích ngay lập tức.' },
};

export const ISSUE_TYPES: { id: string; label: string }[] = [
  { id: 'wrong-key', label: 'Đáp án có vẻ sai' },
  { id: 'ambiguous', label: 'Câu hỏi mơ hồ / nhiều đáp án đúng' },
  { id: 'outdated', label: 'Kiến thức đã cũ' },
  { id: 'explanation', label: 'Giải thích chưa rõ / cần chi tiết hơn' },
  { id: 'metadata', label: 'Sai chủ đề / domain / tag' },
  { id: 'typo', label: 'Lỗi chính tả / định dạng' },
  { id: 'other', label: 'Khác' },
];
