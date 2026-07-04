@echo off
echo ========================================
echo   DCC Music - Parando Servidores
echo ========================================
echo.

echo Procurando processos Node.js relacionados ao projeto...
for /f "tokens=2" %%a in ('netstat -ano ^| findstr :3000') do (
    echo Encontrado processo na porta 3000: %%a
    taskkill /F /PID %%a >nul 2>&1
    if !errorlevel! equ 0 (
        echo Processo %%a finalizado com sucesso!
    )
)

echo.
echo Verificando processos Next.js...
taskkill /F /FI "WINDOWTITLE eq *next*" >nul 2>&1

echo.
echo Servidores parados!
echo.
pause
