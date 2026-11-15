#!/usr/bin/env bash
# Instala Mars Route: dependencias de app/ y versión compilada.
set -e
cd "$(dirname "$0")/app"
command -v node >/dev/null 2>&1 || { echo "Falta Node.js. Instala Node 24 (ver .nvmrc) desde https://nodejs.org"; exit 1; }
MAJOR=$(node -p "process.versions.node.split('.')[0]")
if [ "$MAJOR" -lt 20 ]; then echo "Tienes Node $(node -v). Vite 8 necesita Node 20.19 o superior (el equipo usa 24)."; exit 1; fi
[ -f ../.env ] || cp ../.env.example ../.env  # VITE_NASA_API_KEY (DONKI); vacío usa DEMO_KEY
echo "1/2 Instalando dependencias (npm install)..."
npm install
echo "2/2 Compilando (npm run build)..."
npm run build
echo ""
echo "Listo. Para abrir Mars Route corre ./iniciar.sh"
