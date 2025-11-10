@echo off
echo ============================================================
echo MySQL Service Restart Script
echo ============================================================
echo.
echo This script will restart the MySQL service.
echo You need to run this as Administrator!
echo.
echo Press any key to continue or Ctrl+C to cancel...
pause > nul

echo.
echo [Step 1/3] Stopping MySQL80 service...
net stop MySQL80
if %errorlevel% neq 0 (
    echo ERROR: Failed to stop MySQL service. Make sure you run as Administrator!
    pause
    exit /b 1
)

echo.
echo [Step 2/3] Waiting 3 seconds...
timeout /t 3 /nobreak > nul

echo.
echo [Step 3/3] Starting MySQL80 service...
net start MySQL80
if %errorlevel% neq 0 (
    echo ERROR: Failed to start MySQL service!
    echo Check the error message above.
    echo You may need to check MySQL error logs at:
    echo C:\ProgramData\MySQL\MySQL Server 8.0\Data\
    pause
    exit /b 1
)

echo.
echo ============================================================
echo SUCCESS! MySQL service restarted.
echo ============================================================
echo.
echo Now try connecting with MySQL Workbench.
echo.
pause
