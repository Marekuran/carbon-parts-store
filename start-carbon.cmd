@echo off
cd /d "%~dp0"
start "" /min node server.mjs
timeout /t 1 /nobreak >nul
start "" "http://127.0.0.1:4173/"
