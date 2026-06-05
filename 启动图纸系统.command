#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")"

APP_DIR="$(pwd)"
URL="http://127.0.0.1:4173/index.html"
SERVER_PID=""
BROWSER_PID=""
PROFILE_DIR=""
SERVER_LOG="${TMPDIR:-/tmp}/auto-drawing-server.log"
SERVER_ERR="${TMPDIR:-/tmp}/auto-drawing-server.err.log"

cleanup() {
  if [[ -n "${BROWSER_PID}" ]] && kill -0 "${BROWSER_PID}" 2>/dev/null; then
    kill "${BROWSER_PID}" 2>/dev/null || true
    wait "${BROWSER_PID}" 2>/dev/null || true
  fi
  if [[ -n "${SERVER_PID}" ]] && kill -0 "${SERVER_PID}" 2>/dev/null; then
    kill "${SERVER_PID}" 2>/dev/null || true
    wait "${SERVER_PID}" 2>/dev/null || true
  fi
  if [[ -n "${PROFILE_DIR}" && -d "${PROFILE_DIR}" ]]; then
    rm -rf "${PROFILE_DIR}"
  fi
}

stop_and_exit() {
  cleanup
  exit 0
}

trap cleanup EXIT
trap stop_and_exit HUP INT TERM

if [[ -x "${APP_DIR}/.venv/bin/python" ]]; then
  PYTHON_BIN="${APP_DIR}/.venv/bin/python"
elif command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN="$(command -v python3)"
elif command -v python >/dev/null 2>&1; then
  PYTHON_BIN="$(command -v python)"
else
  echo "未找到 Python。请先安装 Python，或在项目目录创建 .venv。"
  echo
  read -r -n 1 -s -p "按任意键退出..."
  echo
  exit 1
fi

EXISTING_PIDS="$(lsof -nP -iTCP:4173 -sTCP:LISTEN -t 2>/dev/null || true)"
if [[ -n "${EXISTING_PIDS}" ]]; then
  CAN_RESTART=1
  while IFS= read -r PID; do
    [[ -z "${PID}" ]] && continue
    CMD="$(ps -p "${PID}" -o command= 2>/dev/null || true)"
    if [[ "${CMD}" != *"${APP_DIR}/app/server.py"* ]]; then
      CAN_RESTART=0
    fi
  done <<< "${EXISTING_PIDS}"

  if [[ "${CAN_RESTART}" == "1" ]]; then
    echo "检测到旧图纸服务，正在重启..."
    while IFS= read -r PID; do
      [[ -z "${PID}" ]] && continue
      kill "${PID}" 2>/dev/null || true
    done <<< "${EXISTING_PIDS}"
    sleep 0.8
  else
    echo "端口 4173 已被其他程序占用。请先关闭占用程序后再双击本文件。"
    echo
    read -r -n 1 -s -p "按任意键退出..."
    echo
    exit 1
  fi
fi

echo "正在启动图纸服务..."
"${PYTHON_BIN}" app/server.py >"${SERVER_LOG}" 2>"${SERVER_ERR}" &
SERVER_PID="$!"

READY=0
for _ in {1..40}; do
  if ! kill -0 "${SERVER_PID}" 2>/dev/null; then
    echo "服务启动失败："
    cat "${SERVER_ERR}" 2>/dev/null || true
    echo
    read -r -n 1 -s -p "按任意键退出..."
    echo
    exit 1
  fi
  if curl -fsS "${URL}" >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 0.5
done

if [[ "${READY}" != "1" ]]; then
  echo "服务启动超时。日志位置：${SERVER_ERR}"
  echo
  read -r -n 1 -s -p "按任意键退出..."
  echo
  exit 1
fi

echo "服务已启动：${URL}"
echo "关闭打开的图纸窗口或这个终端窗口后，服务会自动关闭。"

BROWSER_BIN=""
for CANDIDATE in \
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  "${HOME}/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge" \
  "${HOME}/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge" \
  "/Applications/Chromium.app/Contents/MacOS/Chromium" \
  "${HOME}/Applications/Chromium.app/Contents/MacOS/Chromium" \
  "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" \
  "${HOME}/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"
do
  if [[ -x "${CANDIDATE}" ]]; then
    BROWSER_BIN="${CANDIDATE}"
    break
  fi
done

if [[ -n "${BROWSER_BIN}" ]]; then
  PROFILE_DIR="$(mktemp -d "${TMPDIR:-/tmp}/auto-drawing-browser.XXXXXX")"
  "${BROWSER_BIN}" --app="${URL}" --user-data-dir="${PROFILE_DIR}" --no-first-run >/dev/null 2>&1 &
  BROWSER_PID="$!"
  wait "${BROWSER_PID}" 2>/dev/null || true
else
  open "${URL}"
  echo
  echo "未找到 Chrome/Edge/Chromium/Brave，已用默认浏览器打开。"
  echo "关闭浏览器页面后，请回到这个窗口按任意键停止服务。"
  read -r -n 1 -s -p "按任意键停止服务..."
  echo
fi

echo "图纸服务已关闭。"
