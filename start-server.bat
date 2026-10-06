@echo off
title 김기환 Local Development Server
echo ======================================================
echo Starting 김기환 Local Development Server...
echo ======================================================
cd /d "%~dp0"
"C:\Program Files\nodejs\node.exe" server.js
pause
