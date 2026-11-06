@echo off
title VoiceBridge - Live Speech-to-Speech Translation
echo =====================================================================
echo  VoiceBridge: Real-Time Call Translator (Telugu ^<^=^> Hindi)
echo  Starting Unified Server (Frontend + Translation Socket.IO Engine)
echo =====================================================================
echo.
cd /d "%~dp0backend"
if exist .venv\Scripts\python.exe (
    .venv\Scripts\python.exe main.py
) else if exist ..\venv\Scripts\python.exe (
    ..\venv\Scripts\python.exe main.py
) else (
    python main.py
)
pause
