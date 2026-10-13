@echo off
chcp 65001 > nul
title MangaTrans Backend Server
echo ========================================================
echo   MangaTrans Backend Server (FastAPI + Gemini 3.8 Flash)
echo ========================================================
cd /d "%~dp0backend"

if not exist venv (
    echo [INFO] Python 가상환경을 생성하고 의존성을 설치합니다...
    python -m venv venv
    call venv\Scripts\activate.bat
    pip install -r requirements.txt
) else (
    call venv\Scripts\activate.bat
)

echo [INFO] FastAPI 백엔드 서버 시작 중: http://localhost:8000
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
pause
