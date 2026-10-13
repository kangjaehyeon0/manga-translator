@echo off
chcp 65001 > nul
title MangaTrans Frontend (Vite)
echo ========================================================
echo   MangaTrans Frontend (React + Vite + Tailwind CSS)
echo ========================================================
cd /d "%~dp0frontend"

if not exist node_modules (
    echo [INFO] node_modules를 설치합니다...
    call npm.cmd install
)

echo [INFO] Vite 프론트엔드 개발 서버 시작 중: http://localhost:5173
call npm.cmd run dev
pause
