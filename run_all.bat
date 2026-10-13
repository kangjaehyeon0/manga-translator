@echo off
chcp 65001 > nul
title MangaTrans Launcher
echo ========================================================
echo   MangaTrans 풀스택 서비스 실행기
echo ========================================================
echo [1/2] 백엔드 서버(FastAPI) 시작...
start "MangaTrans Backend" run_backend.bat

timeout /t 2 > nul

echo [2/2] 프론트엔드 서버(Vite) 시작...
start "MangaTrans Frontend" run_frontend.bat

echo ========================================================
echo   서비스가 시작되었습니다!
echo   - Backend:  http://localhost:8000
echo   - Frontend: http://localhost:5173
echo ========================================================
timeout /t 5
