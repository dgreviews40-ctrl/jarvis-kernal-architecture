@echo off
chcp 65001 >nul
title JARVIS Embedding Server
cls

echo +============================================================+
echo ^|            JARVIS CUDA Embedding Server                    ^|
echo +============================================================+
echo.

:: Check if Python is available
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found! Please install Python 3.8+
    pause
    exit /b 1
)

echo [OK] Python found
echo.

:: Check if required packages are installed
echo Checking dependencies...

python -c "import sentence_transformers" 2>nul
set ST_AVAILABLE=%errorlevel%

python -c "import flask" 2>nul
set FLASK_AVAILABLE=%errorlevel%

python -c "import flask_cors" 2>nul
set CORS_AVAILABLE=%errorlevel%

if %ST_AVAILABLE% neq 0 (
    echo [INFO] Installing sentence-transformers...
    pip install sentence-transformers
    if errorlevel 1 (
        echo [ERROR] Failed to install sentence-transformers
        pause
        exit /b 1
    )
)

if %FLASK_AVAILABLE% neq 0 (
    echo [INFO] Installing flask...
    pip install flask
    if errorlevel 1 (
        echo [ERROR] Failed to install flask
        pause
        exit /b 1
    )
)

if %CORS_AVAILABLE% neq 0 (
    echo [INFO] Installing flask-cors...
    pip install flask-cors
    if errorlevel 1 (
        echo [ERROR] Failed to install flask-cors
        pause
        exit /b 1
    )
)

echo [OK] Dependencies installed
echo.

:: Check for CUDA
echo Checking CUDA availability...
python -c "import torch; print('CUDA available:', torch.cuda.is_available())"
echo.

:: Start the server
echo Starting Embedding Server on port 5002...
echo Press Ctrl+C to stop
echo.

python embedding_server.py

if errorlevel 1 (
    echo.
    echo [ERROR] Server crashed or failed to start
    pause
)
