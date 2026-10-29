#!/usr/bin/env bash
set -euo pipefail
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
adb logcat -c
adb shell am start -n ru.hackerkombat.offline/.MainActivity
sleep 30
adb shell uiautomator dump /sdcard/window.xml >/dev/null || true
adb shell cat /sdcard/window.xml > /tmp/hk-ui.xml || true
adb logcat -d -s HKOffline:E chromium:E AndroidRuntime:E > /tmp/hk-log.txt
# Surface diagnostics in GitHub Checks API as well as the log.
python3 - <<'PY'
from pathlib import Path
for label, file in [('UI', '/tmp/hk-ui.xml'), ('LOG', '/tmp/hk-log.txt')]:
    text = Path(file).read_text(errors='replace')[-12000:].replace('%', '%25').replace('\n', '%0A').replace('\r', '%0D')
    print(f'::warning title={label}::{text}')
PY
