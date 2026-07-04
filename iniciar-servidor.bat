@echo off
echo ========================================
echo   DCC Music - Iniciando Servidor
echo ========================================
echo.

cd /d "%~dp0"

echo Verificando Node.js...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ERRO: Node.js nao encontrado!
    echo Por favor, instale o Node.js primeiro.
    pause
    exit /b 1
)

echo Node.js encontrado!
echo.

echo Verificando dependencias...
if not exist "node_modules\" (
    echo Instalando dependencias...
    call npm install
    if %errorlevel% neq 0 (
        echo ERRO: Falha ao instalar dependencias!
        pause
        exit /b 1
    )
)

echo.
echo Iniciando servidor de desenvolvimento...
echo.
echo Servidor estara disponivel em: http://localhost:3000
echo.
echo Pressione CTRL+C para parar o servidor
echo.

call npm run dev

pause
