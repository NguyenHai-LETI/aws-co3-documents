---
name: trainer
description: Vận hành app luyện thi AWS SAA-C03 (thư mục trainer/) — khởi động / dừng / khởi động lại server http://localhost:3003 và kiểm tra sức khoẻ hệ thống (server, ngân hàng câu hỏi, đề nguồn chưa nhập, ENRICH, lịch coach, đồng bộ, issue mở). Dùng khi người dùng muốn "chạy trainer", "mở app", "chạy server", "tắt server", "restart", "trainer có ổn không", "kiểm tra hệ thống".
argument-hint: "[start | stop | restart | status]"
---

Lệnh: `$ARGUMENTS` (trống = `start`). Server = `trainer/server/index.ts`, chỉ nghe `127.0.0.1`, cổng `PORT` (mặc định **3003**
— thay số cổng bên dưới nếu người dùng đặt `PORT`). Working directory = gốc repo. Mọi POST tới API cần header `X-Trainer: 1`.

## start

1. Đã chạy chưa: `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3003/api/meta`. `200` → báo URL rồi dừng.
   Cổng bị chiếm mà không trả `200` → tìm tiến trình giữ cổng (mục *stop*, bước 3) và báo người dùng — **không** kill tiến trình lạ.
2. `node --version` phải ≥ 22.18. Chưa có `trainer/node_modules` → chạy `npm install` trong `trainer/`.
   `npm install` có thể ghi lại `trainer/package-lock.json` chỉ vì khác phiên bản npm — nếu `git diff` chỉ là các trường như `libc`,
   hoàn tác bằng `git checkout -- trainer/package-lock.json`.
3. Khởi động **ở chế độ nền** (Bash `run_in_background`): `cd trainer && node server/index.ts`.
   Gọi thẳng `node`, **không qua `npm start`**: trên Windows, dừng tiến trình npm không dừng tiến trình node con, cổng vẫn bị giữ.
   Người dùng muốn tự mở trình duyệt → thêm biến môi trường `OPEN=1`.
4. Đợi tối đa ~20 giây tới khi `/api/meta` trả `200`, đọc log khởi động (`Bank: N câu / M pack · Kết quả: K bài · AI Coach: Claude Code …`).
   Báo: URL, số câu/pack, số bài, Claude Code có sẵn không. Không lên được → in log, đối chiếu `trainer/README.md` mục *Sự cố thường gặp*.

## stop

1. Lượt AI Coach đang chạy? `curl -s http://127.0.0.1:3003/api/coach` → trường `running` khác `null` → hỏi người dùng: đợi chạy xong,
   hay huỷ bằng `curl -s -X POST -H "X-Trainer: 1" http://127.0.0.1:3003/api/coach/cancel`. Dừng server giữa chừng có thể để lại
   tiến trình Claude chạy tiếp và ghi file.
2. Server do phiên này khởi động ở chế độ nền → dừng task đó, **rồi vẫn kiểm tra cổng** ở bước 3.
3. Tìm tiến trình giữ cổng, xác nhận đúng là server trainer (command line có `node` và `server/index.ts` hoặc `server\index.ts`) rồi mới dừng:
   - Windows (PowerShell):
     `Get-NetTCPConnection -LocalPort 3003 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Get-CimInstance Win32_Process -Filter "ProcessId=$_" | Select-Object ProcessId, CommandLine }`
     → `Stop-Process -Id <pid> -Force`
   - macOS / Linux: `lsof -nP -iTCP:3003 -sTCP:LISTEN` → `ps -o command= -p <pid>` → `kill <pid>`
   Command line không phải server trainer → báo người dùng, không kill.
4. Xác nhận: `/api/meta` không còn trả lời và không còn tiến trình nghe cổng 3003.

## restart

`stop` rồi `start`. Cần sau khi sửa code `trainer/server/`, `trainer/shared/` **hoặc `trainer/web/`**: từ v5 `node server/index.ts` phục vụ
giao diện đã build (tự build lại khi khởi động nếu code giao diện đổi), không còn tự nạp lại. `config.yaml`, ngân hàng câu hỏi, kết quả vẫn được
đọc lại khi thay đổi. Người dùng đang sửa code → gợi ý `npm run dev` trong `trainer/` (Vite HMR + tự khởi động lại server).
Muốn app luôn chạy nền và tự khởi động lại khi cập nhật → `npm run service -- install` (gỡ: `uninstall`).

## status — kiểm tra sức khoẻ

Chạy lần lượt (từ gốc repo; lệnh nào lỗi thì ghi nhận rồi chạy tiếp, không dừng):

| Kiểm tra | Lệnh / nguồn |
|----------|--------------|
| Server | `curl -s http://127.0.0.1:3003/api/meta`, `curl -s http://127.0.0.1:3003/api/coach` (lượt đang chạy, Claude Code, đăng nhập) |
| Ngân hàng | `node trainer/scripts/validate.ts` |
| Đề nguồn chưa nhập | `node trainer/scripts/import-practice-exams.ts --merge --dry-run` |
| ENRICH | `node trainer/scripts/enrich-batch.ts --status` |
| Độ phủ | `node trainer/scripts/coverage.ts` (chỉ lấy bảng domain và các task ⚠️) |
| Lịch coach | `node trainer/scripts/schedule.ts status` |
| Đồng bộ 2 máy | `node trainer/scripts/sync.ts --status` |
| Đề niêm phong | `node trainer/scripts/seal.ts --status` (không in id câu; lỗi file → báo người dùng, đừng tự sửa) |
| Lượt AI gần nhất | file `trainer/coach/runs/*.json` mới nhất theo tên (task, status, error) |
| Issue mở | dòng `- [ ]` trong `trainer/bank/issues.md` |
| Kế hoạch hiện hành | file mới nhất trong `trainer/coach/plans/` |
| Lần soát gần nhất | file mới nhất trong `trainer/coach/reviews/` (chưa có = chưa từng soát) |

Trả lời bằng một bảng ngắn (✅ / ⚠️ / ❌ + 1 dòng mỗi mục), rồi tối đa 3 việc nên làm, mỗi việc kèm lệnh hoặc skill:
`/trainer-import` (có câu chưa nhập) · `/trainer-coach` (issue mở hoặc bài mới chưa phân tích) · `/trainer-enrich` · `/trainer-review`
(có câu AI mới chưa soát) · `/trainer-coverage` (domain/task lệch).

Không sửa file dữ liệu (`trainer/bank`, `trainer/results`, `trainer/coach`) trong skill này.
