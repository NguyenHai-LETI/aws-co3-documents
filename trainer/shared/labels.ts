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
  sealed: { icon: '🔒', label: 'Đề niêm phong', desc: 'Mô phỏng Pearson với 50 câu chưa từng xuất hiện khi luyện — đo năng lực thật trên câu mới.' },
  diagnostic: { icon: '🧭', label: 'Chẩn đoán đầu vào', desc: '2 câu cho mỗi mục exam guide 1.1–4.4 (28 câu) — bản đồ xuất phát theo task.' },
  // [v5]
  today: { icon: '▶️', label: 'Học hôm nay', desc: 'Một phiên vừa quỹ phút của bạn: câu đến hạn, câu vừa sai, task yếu và câu mới, xen kẽ chủ đề. Dừng sớm không bị phạt.' },
  discriminate: { icon: '🔀', label: 'Phân biệt', desc: 'Các dịch vụ dễ nhầm (SNS↔SQS, DataSync↔Snow…) đặt cạnh nhau, đáp án luân phiên — kèm bảng so sánh.' },
  qualifier: { icon: '🎯', label: 'Đọc yêu cầu', desc: 'Cùng tình huống, đổi câu hỏi cuối (rẻ nhất / ít vận hành nhất / an toàn nhất…) — luyện đọc qualifier.' },
  yesterday: { icon: '☀️', label: 'Ôn lại lỗi hôm qua', desc: 'Câu sai / chưa chắc / phải xem gợi ý hôm qua — khoảng 5 phút, sau một giấc ngủ.' },
  retest: { icon: '🩹', label: 'Kiểm tra lại sau khi chữa', desc: 'Hỏi lại ngay các câu vừa chữa (đáp án được xáo) — câu vẫn sai được ưu tiên trong Học hôm nay.' },
  anki: { icon: '🃏', label: 'Ôn trên Anki', desc: 'Lượt ôn nhập từ Anki (tự chấm, không tính vào mức sẵn sàng).' },
  listen: { icon: '🎧', label: 'Nghe', desc: 'Nghe đọc câu ngắn, tự nhớ rồi tự chấm — học khi đi đường (không tính vào mức sẵn sàng).' },
  micro: { icon: '☕', label: 'Câu hỏi nhanh', desc: 'Từng câu ngắn trong lúc chờ (Claude Code), gom thành một bài mỗi ngày.' },
};

/** [v5] One-tap reasons for a wrong answer ("vì sao chọn"): Runner why-box and the result-page correction stepper. */
export const WHY_CHIPS: { id: string; label: string }[] = [
  { id: 'qualifier', label: 'Đọc sót yêu cầu (rẻ nhất / ít vận hành…)' },
  { id: 'confused', label: 'Nhầm hai dịch vụ' },
  { id: 'unknown', label: 'Chưa biết kiến thức này' },
  { id: 'distractor', label: 'Phương án nhiễu nghe hợp lý' },
  { id: 'guess', label: 'Đoán / hết giờ' },
  { id: 'slip', label: 'Bấm nhầm' },
];

/** [v5] Exam phases (goal.examDate) — banner titles; rules come from the server (ExamPhaseInfo.rules). */
export const PHASE_INFO: Record<string, ModeInfo> = {
  build: { icon: '🧱', label: 'Xây nền', desc: 'Còn hơn 2 tuần: học đều câu mới theo hạn mức ngày, ôn đúng lịch.' },
  measure: { icon: '📏', label: 'Đo & vá', desc: 'T−14…T−8: thi thử cách nhau 3–4 ngày, chữa bài, vá task yếu; câu mới chỉ cho domain còn thiếu.' },
  consolidate: { icon: '🧲', label: 'Củng cố', desc: 'T−7…T−3: dừng câu mới, ôn trước hạn câu có xác suất nhớ thấp vào ngày thi.' },
  light: { icon: '🌤️', label: 'Nhẹ', desc: 'T−2…T−1: tối đa 30 phút, chỉ ôn lỗi tự tin và cặp dễ nhầm, không thi thử dài.' },
  'exam-day': { icon: '🏁', label: 'Ngày thi', desc: 'Không học thêm: checklist giấy tờ, giờ check-in, nghỉ ngơi.' },
  after: { icon: '🎓', label: 'Sau ngày thi', desc: 'Ngày thi đã qua — cập nhật ngày thi mới nếu bạn thi lại.' },
};

/** Requirement categories of a stem (Question.requirements, SelectionFilters.requirements, stats byRequirement), display order. */
export const REQUIREMENTS = ['cost', 'ops', 'resilient', 'performance', 'secure', 'negative'] as const;

export const REQUIREMENT_INFO: Record<string, ModeInfo> = {
  cost: { icon: '💰', label: 'Chi phí', desc: 'Đề hỏi phương án tiết kiệm nhất (MOST cost-effective, lowest cost…).' },
  ops: { icon: '⚙️', label: 'Vận hành', desc: 'Đề hỏi phương án ít công vận hành nhất (LEAST operational overhead, fully managed…).' },
  resilient: { icon: '🛟', label: 'Sẵn sàng cao', desc: 'Đề hỏi tính sẵn sàng / chịu lỗi / khôi phục (highly available, fault-tolerant, RPO/RTO…).' },
  performance: { icon: '🚀', label: 'Hiệu năng', desc: 'Đề hỏi độ trễ / thông lượng (lowest latency, high throughput…).' },
  secure: { icon: '🔐', label: 'Bảo mật', desc: 'Đề hỏi phương án an toàn nhất (MOST secure, least privilege, encryption…).' },
  negative: { icon: '⛔', label: 'Phủ định', desc: 'Câu hỏi phủ định (NOT / EXCEPT / LEAST…) — dễ đọc nhầm.' },
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
