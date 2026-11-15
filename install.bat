@echo off
rem Instala Mars Route en Windows: dependencias de app\ y version compilada.
cd /d "%~dp0app"
where node >nul 2>nul || (echo Falta Node.js. Instala Node 24 desde https://nodejs.org & pause & exit /b 1)
for /f "delims=" %%v in ('node -p "process.versions.node.split('.')[0]"') do set NODEMAJOR=%%v
if %NODEMAJOR% LSS 20 (echo Vite 8 necesita Node 20.19 o superior. El equipo usa 24. & pause & exit /b 1)
if not exist ..\.env copy ..\.env.example ..\.env >nul
echo 1/2 Instalando dependencias...
call npm install || (pause & exit /b 1)
echo 2/2 Compilando...
call npm run build || (pause & exit /b 1)
echo.
echo Listo. Para abrir Mars Route haz doble clic en iniciar.bat
pause
