@echo off
setlocal EnableDelayedExpansion

REM ============================================================================
REM  R&A Labs - Docker runner for Windows
REM ============================================================================
REM  Usage:
REM    run-docker.bat              - build and start full stack (gateway on :80)
REM    run-docker.bat local        - start with containerized SQL Server (mssql)
REM                                uses docker-compose.yml + docker-compose.local.yml
REM                                .env is auto-created with DB_HOST=mssql
REM    run-docker.bat down         - stop and remove containers (keeps volumes)
REM    run-docker.bat down -v      - stop and remove containers + volumes
REM    run-docker.bat restart      - restart stack
REM    run-docker.bat logs         - tail logs (all services)
REM    run-docker.bat logs api     - tail logs for a single service
REM    run-docker.bat ps           - show compose status
REM    run-docker.bat clean        - down -v + prune dangling images
REM    run-docker.bat help         - show help
REM
REM  Prerequisites: Docker Desktop running, ports 80/443 free (or use local
REM  override). First run creates .env from deploy\.env.example if missing.
REM ============================================================================

set "COMPOSE_FILE=docker-compose.yml"
set "LOCAL_COMPOSE=docker-compose.local.yml"
set "USE_LOCAL=0"
set "CMD=%~1"
set "ARG2=%~2"
set "ARG3=%~3"
set "ARG4=%~4"

REM -- detect local mode (must be before help, handle "local" as first arg) ----
REM Using %~2 directly avoids the delayed-expansion pitfall of SHIFT inside a block
REM where %~1 is expanded at parse time before SHIFT takes effect.
if /I "%CMD%"=="local" (
    set "USE_LOCAL=1"
    set "CMD=%~2"
    set "ARG2=%~3"
    set "ARG3=%~4"
    set "ARG4=%~5"
)
if /I "%CMD%"=="--local" (
    set "USE_LOCAL=1"
    set "CMD=%~2"
    set "ARG2=%~3"
    set "ARG3=%~4"
    set "ARG4=%~5"
)
REM also allow "local" as second arg: e.g. "run-docker.bat up local"
if /I "%ARG2%"=="local" (
    set "USE_LOCAL=1"
    set "ARG2=%ARG3%"
    set "ARG3=%ARG4%"
    set "ARG4="
)
if /I "%ARG2%"=="--local" (
    set "USE_LOCAL=1"
    set "ARG2=%ARG3%"
    set "ARG3=%ARG4%"
    set "ARG4="
)

if /I "%CMD%"=="help" goto :help
if /I "%CMD%"=="-h" goto :help
if /I "%CMD%"=="--help" goto :help

if "%CMD%"=="" set "CMD=up"

REM -- resolve docker compose command (v2 vs v1) -------------------------------
set "DC=docker compose"
%DC% version >nul 2>&1
if errorlevel 1 (
    set "DC=docker-compose"
    %DC% version >nul 2>&1
    if errorlevel 1 (
        echo [ERROR] Docker Compose not found. Install Docker Desktop and ensure it is running.
        echo         https://docs.docker.com/desktop/install/windows-install/
        goto :end
    )
)

REM -- check docker daemon -----------------------------------------------------
docker info >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker daemon not reachable. Start Docker Desktop and wait until it says "Engine running".
    goto :end
)

REM -- ensure .env exists ------------------------------------------------------
if not exist ".env" (
    echo [INFO] .env not found - creating from deploy\.env.example ...
    if not exist "deploy\.env.example" (
        echo [ERROR] deploy\.env.example not found. Cannot create .env.
        goto :end
    )
    copy /Y "deploy\.env.example" ".env" >nul
    echo [INFO] .env created. Patching for local Docker use...

    REM Generate a secure JWT_SECRET (32+ chars) via PowerShell
    for /f "delims=" %%S in ('powershell -NoProfile -Command "$b=[byte[]]::new(48); [Security.Cryptography.RandomNumberGenerator]::Fill($b); [Convert]::ToBase64String($b)"') do set "GEN_JWT=%%S"
    if defined GEN_JWT (
        powershell -NoProfile -Command "(Get-Content '.env') -replace 'JWT_SECRET=.*','JWT_SECRET=!GEN_JWT!' | Set-Content '.env' -Encoding utf8"
        echo [INFO] JWT_SECRET generated.
    ) else (
        echo [WARN] Could not auto-generate JWT_SECRET. Edit .env and set JWT_SECRET to 32+ random chars.
    )

    if "%USE_LOCAL%"=="1" (
        REM Patch DB_HOST for containerized SQL Server
        powershell -NoProfile -Command "(Get-Content '.env') -replace 'DB_HOST=.*','DB_HOST=mssql' | Set-Content '.env' -Encoding utf8"
        REM Ensure a non-placeholder DB_PASSWORD
        findstr /C:"DB_PASSWORD=change-me" ".env" >nul 2>&1
        if not errorlevel 1 (
            for /f "delims=" %%P in ('powershell -NoProfile -Command "$b=[byte[]]::new(18); [Security.Cryptography.RandomNumberGenerator]::Fill($b); -join (([Convert]::ToBase64String($b) -replace '[^a-zA-Z0-9]','')[0..15]) + '!1Aa'"') do set "GEN_PW=%%P"
            if defined GEN_PW (
                powershell -NoProfile -Command "(Get-Content '.env') -replace 'DB_PASSWORD=.*','DB_PASSWORD=!GEN_PW!' | Set-Content '.env' -Encoding utf8"
                echo [INFO] DB_PASSWORD generated for local mssql container.
            )
        )
        echo [INFO] Patched .env for local mode: DB_HOST=mssql
    )

    echo.
    echo [ACTION] Review .env and update if needed:
    echo         - DB_PASSWORD  ^(used as SA password for mssql in local mode^)
    echo         - GITHUB_TOKEN / OPENAI_API_KEY ^(optional^)
    echo         - APP_DOMAIN / CERT_EMAIL ^(production^)
    echo.
)

REM -- validate JWT_SECRET not placeholder ------------------------------------
findstr /C:"JWT_SECRET=change-me" ".env" >nul 2>&1
if not errorlevel 1 (
    echo [WARN] .env still contains placeholder JWT_SECRET=change-me
    echo        Generate one with: powershell -Command "[Convert]::ToBase64String^(^(1..48|ForEach-Object{Get-Random -Max 256}^)^)"
    echo        and update .env before production use. Local dev will still start but auth may fail if secret is too short.
    echo.
)

if "%USE_LOCAL%"=="1" (
    if not exist "%LOCAL_COMPOSE%" (
        echo [ERROR] %LOCAL_COMPOSE% not found. Cannot start in local mode.
        goto :end
    )
    set "DC=%DC% -f %COMPOSE_FILE% -f %LOCAL_COMPOSE%"
    echo [INFO] Local mode: using %COMPOSE_FILE% + %LOCAL_COMPOSE%  (containerized SQL Server)
)

REM -- dispatch ---------------------------------------------------------------
if /I "%CMD%"=="up" goto :up
if /I "%CMD%"=="build" goto :up
if /I "%CMD%"=="start" goto :up
if /I "%CMD%"=="down" goto :down
if /I "%CMD%"=="stop" goto :down
if /I "%CMD%"=="restart" goto :restart
if /I "%CMD%"=="logs" goto :logs
if /I "%CMD%"=="ps" goto :ps
if /I "%CMD%"=="status" goto :ps
if /I "%CMD%"=="clean" goto :clean

echo [ERROR] Unknown command "%CMD%". Use "run-docker.bat help" for usage.
goto :end

REM ===========================================================================
:up
echo.
echo ======================================================================
echo  RALabs - Building and starting Docker stack
echo  Compose: %DC%
echo ======================================================================
echo.

REM Check port 80 availability (gateway)
powershell -NoProfile -Command "$c=Get-NetTCPConnection -LocalPort 80 -State Listen -ErrorAction SilentlyContinue; if($c){exit 1}else{exit 0}"
if errorlevel 1 (
    echo [WARN] Port 80 is already in use ^(IIS / Skype / another container^).
    echo        Gateway will fail to bind. Either:
    echo          - Stop the service using :80, or
    echo          - Access API directly at http://localhost:8080  ^(local mode exposes it^)
    echo          - Or change gateway ports in %COMPOSE_FILE%
    echo.
)

%DC% up -d --build
if errorlevel 1 (
    echo [ERROR] docker compose up failed. Check output above.
    goto :end
)

echo.
echo [INFO] Containers started. Waiting for API health check...
echo        (this can take 30-60s on first build, longer with mssql)
echo.

REM Poll health endpoint via gateway and direct API
set "HEALTH_OK=0"
for /L %%i in (1,1,30) do (
    timeout /t 5 /nobreak >nul
    REM Try direct API first (local mode exposes 8080), then gateway
    REM NOTE: parentheses in PowerShell if() must be escaped as ^( ^) inside a batch FOR block
    powershell -NoProfile -Command "try{ $r=Invoke-WebRequest -Uri http://localhost:8080/health -UseBasicParsing -TimeoutSec 5; if^($r.StatusCode -eq 200^){exit 0}else{exit 1}}catch{exit 1}" >nul 2>&1
    if not errorlevel 1 (
        set "HEALTH_OK=1"
        goto :health_done
    )
    powershell -NoProfile -Command "try{ $r=Invoke-WebRequest -Uri http://localhost/health -UseBasicParsing -TimeoutSec 5; if^($r.StatusCode -eq 200^){exit 0}else{exit 1}}catch{exit 1}" >nul 2>&1
    if not errorlevel 1 (
        set "HEALTH_OK=1"
        goto :health_done
    )
    echo   ... waiting attempt %%i/30
)

:health_done
echo.
%DC% ps
echo.
if "%HEALTH_OK%"=="1" (
    echo [OK] API is healthy!
) else (
    echo [WARN] API health check did not pass within timeout.
    echo        Check logs: run-docker.bat logs api
    echo        Or: %DC% logs api --tail=100
)

echo.
echo ======================================================================
echo  RALabs is running:
echo    Gateway (nginx)  : http://localhost
echo    Public site      : http://localhost/            (via gateway)
echo    Admin CMS        : http://localhost/admin/      (via gateway)
echo    Customer portal  : http://localhost/customer/   (via gateway)
echo    API direct       : http://localhost:8080        (local mode only)
echo    API via gateway  : http://localhost/api/v1/...
echo    Health           : http://localhost/health  or http://localhost:8080/health
echo    MCP tools        : http://localhost/mcp/tools
echo ======================================================================
echo  Useful commands:
echo    run-docker.bat logs        - tail all logs
echo    run-docker.bat logs api    - tail API logs
echo    run-docker.bat ps          - show status
echo    run-docker.bat down        - stop stack
echo    run-docker.bat down -v     - stop and remove DB volume
echo ======================================================================
goto :end

REM ===========================================================================
:down
echo.
if /I "%ARG2%"=="-v" (
    echo [INFO] Stopping stack and removing volumes...
    %DC% down -v
) else if /I "%ARG3%"=="-v" (
    echo [INFO] Stopping stack and removing volumes...
    %DC% down -v
) else (
    echo [INFO] Stopping stack (volumes preserved)...
    %DC% down
)
goto :end

REM ===========================================================================
:restart
echo [INFO] Restarting stack...
%DC% restart
if errorlevel 1 %DC% up -d
%DC% ps
goto :end

REM ===========================================================================
:logs
if "%ARG2%"=="" (
    echo [INFO] Tailing all logs (Ctrl+C to stop)...
    %DC% logs -f --tail=200
) else (
    echo [INFO] Tailing logs for %ARG2% (Ctrl+C to stop)...
    %DC% logs -f --tail=200 %ARG2%
)
goto :end

REM ===========================================================================
:ps
%DC% ps
echo.
%DC% ps -a 2>nul
goto :end

REM ===========================================================================
:clean
echo [WARN] This will remove containers, volumes, and dangling images.
choice /M "Continue"
if errorlevel 2 goto :end
%DC% down -v
docker image prune -f
echo [INFO] Clean complete.
goto :end

REM ===========================================================================
:help
echo.
echo RALabs Docker runner
echo ====================
echo Usage: run-docker.bat [local] [command] [options]
echo.
echo Commands:
echo   up, build, start   Build and start stack (default)
echo   down [-v]          Stop stack; -v also removes DB volume
echo   restart            Restart all services
echo   logs [service]     Tail logs (e.g. logs api)
echo   ps, status         Show container status
echo   clean              down -v + prune dangling images
echo   help               Show this help
echo.
echo Modes:
echo   run-docker.bat              Uses docker-compose.yml only.
echo                               Requires DB_HOST in .env to point to a
echo                               reachable SQL Server (e.g. external host
echo                               or host.docker.internal for RAJIB\SQLEXPRESS).
echo   run-docker.bat local        Uses docker-compose.yml + docker-compose.local.yml
echo                               Starts containerized SQL Server (mssql).
echo                               Auto-patches .env to DB_HOST=mssql on first run.
echo                               API exposed on http://localhost:8080
echo.
echo First run:
echo   - Copies deploy\.env.example to .env if missing
echo   - Auto-generates JWT_SECRET and DB_PASSWORD (local mode)
echo   - Edit .env to set GITHUB_TOKEN / OPENAI_API_KEY if needed
echo.
echo Ports:
echo   80/443  gateway (nginx) - all frontends + /api
echo   8080    API direct      - only in local mode
echo   1433    SQL Server      - only in local mode
echo.
echo Docs: docs/DEPLOYMENT.md
goto :end

REM ===========================================================================
:end
echo.
pause
endlocal
