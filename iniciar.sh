#!/usr/bin/env bash
# Abre Mars Route compilado en http://localhost:4173 (agrega --host para verlo desde el celular en tu red).
cd "$(dirname "$0")/app"
[ -d dist ] || { echo "Primero corre ./install.sh"; exit 1; }
URL="http://localhost:4173"
( sleep 3; if command -v xdg-open >/dev/null; then xdg-open "$URL"; elif command -v open >/dev/null; then open "$URL"; fi ) >/dev/null 2>&1 &
echo "Abriendo $URL  (Ctrl+C para detener)"
npx vite preview --port 4173 --strictPort "$@"
