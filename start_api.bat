@echo off
title MR.SmartUSEME — YOLO API
cd /d "%~dp0"

echo ============================================
echo   MR.SmartUSEME — AI Waste Recognition API
echo ============================================
echo.

REM Check if flask-cors is installed; if not, install requirements
python -c "import flask_cors" >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Installing required packages...
    pip install -r requirements.txt
    echo.
)

echo [INFO] Starting YOLO API server on http://localhost:5000
echo [INFO] Keep this window open while using the UI.
echo [INFO] Press Ctrl+C to stop.
echo.

python yolo_api.py

pause
