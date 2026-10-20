#!/usr/bin/env bash
# Start the SAA-C03 Trainer and open the browser (macOS / Linux). Usage: ./start.sh [--lan]   (PORT=4000 ./start.sh)
# --lan (or LAN=1): also open it to phones on the same Wi-Fi (access code / QR on the 🧰 Công cụ page).
# Installs npm packages when needed; if the app is already running, just opens it (and turns LAN access on if asked).
# Exit code 75 from the server = "restart me": ⇅ Đồng bộ brought newer app code and the learner pressed "Khởi động lại" —
# the loop below runs npm install when package-lock.json changed, then starts the server again (the open page reloads).
cd "$(dirname "$0")" || exit 1
PORT="${PORT:-3003}"
URL="http://localhost:$PORT"
WANT_LAN=0
for a in "$@"; do [ "$a" = "--lan" ] && WANT_LAN=1; done
case "${LAN:-}" in 1|true|yes|on) WANT_LAN=1 ;; esac
RESTART_CODE=75
NPM="${TRAINER_NPM:-npm}" # tests substitute a fake npm

pause_on_error() {
  # start.command (double-click) sets TRAINER_PAUSE=1 so the Terminal window stays readable
  if [ "${TRAINER_PAUSE:-}" = "1" ]; then read -r -p "Nhấn Enter để đóng cửa sổ…" _; fi
  exit 1
}

open_url() {
  if command -v open >/dev/null 2>&1; then open "$1"
  elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$1" >/dev/null 2>&1 &
  else echo "Mở trình duyệt: $1"; fi
}

# Finder / Dock launches get a minimal PATH: add the usual Node locations (Homebrew, Volta, nvm, fnm, asdf).
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.volta/bin:$HOME/.local/bin:$HOME/.asdf/shims:$PATH"
if ! command -v node >/dev/null 2>&1 && [ -s "$HOME/.nvm/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1
fi
if ! command -v node >/dev/null 2>&1 && command -v fnm >/dev/null 2>&1; then
  eval "$(fnm env)"
fi
if ! command -v node >/dev/null 2>&1; then
  echo "✗ Chưa cài Node.js (cần ≥ 22.18). Tải bản LTS tại https://nodejs.org rồi chạy lại."
  pause_on_error
fi
if ! node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>22||(a===22&&b>=18)?0:1)'; then
  echo "✗ Node $(node -v) quá cũ — cần ≥ 22.18 (chạy TypeScript trực tiếp). Cập nhật tại https://nodejs.org"
  pause_on_error
fi

# Already running on this port? Then only open the browser (LAN requested → switch it on through the API).
if command -v curl >/dev/null 2>&1 && curl -fsS -m 2 "http://127.0.0.1:$PORT/api/meta" >/dev/null 2>&1; then
  echo "✓ Trainer đã chạy sẵn → $URL"
  if [ "$WANT_LAN" = "1" ]; then
    if curl -fsS -m 10 -X POST -H 'X-Trainer: 1' -H 'Content-Type: application/json' -d '{"enabled":true}' "http://127.0.0.1:$PORT/api/lan" >/dev/null 2>&1; then
      echo "📱 Đã mở truy cập LAN — quét mã QR ở trang 🧰 Công cụ"
    fi
    open_url "$URL/#/tools"
  else
    open_url "$URL"
  fi
  exit 0
fi

# npm install when node_modules is missing or package-lock.json changed since the last install (e.g. after a sync).
STAMP="node_modules/.trainer-lock.json"
ensure_deps() {
  if [ ! -d node_modules ] || ! cmp -s package-lock.json "$STAMP"; then
    echo "→ Cài thư viện (npm install)…"
    if ! PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 "$NPM" install --no-audit --no-fund; then
      echo "✗ npm install thất bại — kiểm tra mạng rồi chạy lại."
      return 1
    fi
    cp package-lock.json "$STAMP" 2>/dev/null
  fi
  return 0
}
ensure_deps || pause_on_error

echo "→ Đang khởi động… (Ctrl+C hoặc đóng cửa sổ này để dừng)"
OPEN_NOW=1
RESTARTS=0
while :; do
  OPEN=$OPEN_NOW PORT="$PORT" TRAINER_LAUNCHER=1 node server/index.ts "$@"
  code=$?
  [ "$code" -eq "$RESTART_CODE" ] || break
  RESTARTS=$((RESTARTS + 1))
  if [ "$RESTARTS" -gt 20 ]; then
    echo "✗ Server xin khởi động lại quá nhiều lần liên tiếp — dừng. Chạy lại ./start.sh để thử tiếp."
    pause_on_error
  fi
  echo "↻ Khởi động lại để dùng bản mới…"
  OPEN_NOW=0 # the page that asked for the restart reloads by itself
  ensure_deps || pause_on_error
done
[ "$code" -eq 0 ] || pause_on_error
