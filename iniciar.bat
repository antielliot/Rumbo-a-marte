@echo off
rem Abre Mars Route compilado en http://localhost:4173
cd /d "%~dp0app"
if not exist dist (echo Primero ejecuta install.bat & pause & exit /b 1)
start "" http://localhost:4173
echo Mars Route en http://localhost:4173  (cierra esta ventana para detenerlo)
call npx vite preview --port 4173 --strictPort
