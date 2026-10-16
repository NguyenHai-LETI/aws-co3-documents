#!/bin/sh
# Lịch chạy AI Coach tự động trên macOS (launchd) — vài lần mỗi ngày theo trainer/config.yaml → coach.schedule.
#   sh trainer/scripts/schedule.sh install     # cài / cập nhật lịch
#   sh trainer/scripts/schedule.sh status      # xem trạng thái + log gần nhất
#   sh trainer/scripts/schedule.sh run         # chạy ngay 1 lần qua launchd
#   sh trainer/scripts/schedule.sh uninstall   # gỡ lịch
# Mỗi lượt gọi `node trainer/scripts/coach-run.ts --trigger schedule` (tự bỏ qua nếu không có bài làm/issue mới).
set -e

LABEL="com.saa-trainer.coach"
DIR="$(cd "$(dirname "$0")/.." && pwd)"
REPO="$(cd "$DIR/.." && pwd)"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG="$DIR/coach/runs/launchd.log"
NODE="$(command -v node || true)"
DOMAIN="gui/$(id -u)"

if [ "$(uname)" != "Darwin" ]; then
  echo "Script này dành cho macOS (launchd). Trên Linux dùng crontab, ví dụ:"
  echo "  30 8,12,21 * * * cd $REPO && $(command -v node) trainer/scripts/coach-run.ts --trigger schedule >> $LOG 2>&1"
  exit 1
fi

times() {
  "$NODE" --input-type=module -e "
    import { loadConfig } from '$DIR/server/config.ts';
    console.log(loadConfig().coach.schedule.join(' '));
  "
}

case "${1:-status}" in
  install)
    [ -n "$NODE" ] || { echo "Không tìm thấy node trong PATH"; exit 1; }
    mkdir -p "$HOME/Library/LaunchAgents" "$DIR/coach/runs"
    ENTRIES=""
    for t in $(times); do
      H=$(echo "$t" | cut -d: -f1 | sed 's/^0//'); M=$(echo "$t" | cut -d: -f2 | sed 's/^0//')
      ENTRIES="$ENTRIES
      <dict><key>Hour</key><integer>${H:-0}</integer><key>Minute</key><integer>${M:-0}</integer></dict>"
    done
    cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE</string>
    <string>$DIR/scripts/coach-run.ts</string>
    <string>--trigger</string>
    <string>schedule</string>
  </array>
  <key>WorkingDirectory</key><string>$REPO</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>$(dirname "$NODE"):/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
    <key>HOME</key><string>$HOME</string>
  </dict>
  <key>StartCalendarInterval</key>
  <array>$ENTRIES
  </array>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
</dict>
</plist>
EOF
    launchctl bootout "$DOMAIN" "$PLIST" 2>/dev/null || true
    launchctl bootstrap "$DOMAIN" "$PLIST"
    echo "✓ Đã cài lịch AI Coach: $(times) (sửa giờ ở trainer/config.yaml rồi chạy lại install)"
    echo "  plist: $PLIST"
    echo "  log:   $LOG"
    ;;
  uninstall)
    launchctl bootout "$DOMAIN" "$PLIST" 2>/dev/null || true
    rm -f "$PLIST"
    echo "✓ Đã gỡ lịch AI Coach"
    ;;
  run)
    launchctl kickstart -k "$DOMAIN/$LABEL"
    echo "▶ Đã kích hoạt — xem log: tail -f $LOG"
    ;;
  status)
    if [ -f "$PLIST" ]; then
      echo "✓ Lịch đã cài ($PLIST) — giờ chạy theo config: $(times)"
      launchctl print "$DOMAIN/$LABEL" 2>/dev/null | grep -E "state =|last exit code|runs =" || echo "  (launchd chưa nạp job — chạy lại install)"
      [ -f "$LOG" ] && { echo "--- log gần nhất ---"; tail -n 15 "$LOG"; }
    else
      echo "✗ Chưa cài lịch. Chạy: sh trainer/scripts/schedule.sh install"
    fi
    ;;
  *)
    echo "Dùng: sh trainer/scripts/schedule.sh install|status|run|uninstall"
    exit 1
    ;;
esac
