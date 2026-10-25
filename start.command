#!/bin/zsh
set -e
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo 'Для запуска нужен Node.js 20 или новее.'
  echo 'После установки откройте этот файл повторно.'
  read -r 'ARZU_WAIT?Нажмите Enter для выхода...'
  exit 1
fi
node scripts/build.mjs
echo 'Откройте в браузере: http://127.0.0.1:4173'
echo 'Чтобы остановить локальный сервер, нажмите Ctrl+C.'
node scripts/serve.mjs
