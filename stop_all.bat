@echo off
chcp 65001 > nul
echo ========================================================
echo   MangaTrans 서비스 종료 중...
echo ========================================================

echo [1/2] 포트 8000 (백엔드 FastAPI) 프로세스 종료...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000') do (
    taskkill /f /pid %%a > nul 2>&1
)

echo [2/2] 포트 5173 (프론트엔드 Vite) 프로세스 종료...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173') do (
    taskkill /f /pid %%a > nul 2>&1
)

echo ========================================================
echo   모든 MangaTrans 서버가 정상적으로 종료되었습니다!
echo ========================================================
timeout /t 3
