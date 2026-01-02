@echo off
echo Finding PostgreSQL installation...
echo.

REM Try common PostgreSQL installation paths
if exist "C:\Program Files\PostgreSQL\16\bin\psql.exe" (
    set PSQL="C:\Program Files\PostgreSQL\16\bin\psql.exe"
    goto found
)
if exist "C:\Program Files\PostgreSQL\15\bin\psql.exe" (
    set PSQL="C:\Program Files\PostgreSQL\15\bin\psql.exe"
    goto found
)
if exist "C:\Program Files\PostgreSQL\14\bin\psql.exe" (
    set PSQL="C:\Program Files\PostgreSQL\14\bin\psql.exe"
    goto found
)
if exist "C:\Program Files\PostgreSQL\13\bin\psql.exe" (
    set PSQL="C:\Program Files\PostgreSQL\13\bin\psql.exe"
    
    goto found
)

echo PostgreSQL not found in standard locations.
echo Please install PostgreSQL or use pgAdmin.
echo.
pause
exit /b 1

:found
echo Found PostgreSQL at %PSQL%
echo.
echo Creating repaircoin_test database...
echo You will be prompted for your PostgreSQL password.
echo.

%PSQL% -U postgres -c "CREATE DATABASE repaircoin_test;"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo SUCCESS! Database created.
    echo ========================================
    echo.
    echo Next steps:
    echo 1. Edit backend\.env.test - Fix PRIVATE_KEY on line 23
    echo 2. Edit backend\.env.test - Update DB_PASSWORD on line 29
    echo 3. Run: set NODE_ENV=test ^&^& npm run migrate
    echo 4. Run: npm test tests/customer/customer.comprehensive.test.ts
) else (
    echo.
    echo Failed to create database.
    echo Please check your password and try again.
)

echo.
pause
