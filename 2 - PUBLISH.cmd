@echo off
title Publish locked
setlocal
cd /d "%~dp0"

set "GH=%LOCALAPPDATA%\Microsoft\WinGet\Links\gh.exe"
if not exist "%GH%" set "GH=gh"

"%GH%" auth status >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Not signed in yet. Run  "1 - LOGIN FIRST.cmd"  first.
  echo.
  pause
  exit /b 1
)

echo Committing any changes...
git add -A
git diff --cached --quiet || git commit -m "update locked"

git remote get-url origin >nul 2>nul
if errorlevel 1 (
  echo Creating the repository and pushing...
  "%GH%" repo create locked --public --source=. --remote=origin --push
  if errorlevel 1 goto :failed
) else (
  echo Pushing...
  git push -u origin main
  if errorlevel 1 goto :failed
)

echo Turning on GitHub Pages...
"%GH%" api -X POST repos/:owner/locked/pages -f "source[branch]=main" -f "source[path]=/" >nul 2>nul
if errorlevel 1 "%GH%" api -X PUT repos/:owner/locked/pages -f "source[branch]=main" -f "source[path]=/" >nul 2>nul

for /f "delims=" %%u in ('"%GH%" api repos/:owner/locked/pages --jq .html_url 2^>nul') do set "URL=%%u"

echo.
if defined URL (
  echo   ============================================
  echo     Live at:  %URL%
  echo   ============================================
  echo   The first build takes a minute or two.
  echo   Opening it now...
  timeout /t 3 >nul
  start "" "%URL%"
) else (
  echo   Pushed. Switch Pages on at:
  echo   Settings -^> Pages -^> Branch: main / root
)
echo.
pause
exit /b 0

:failed
echo.
echo   Push failed - see the message above.
echo.
pause
exit /b 1
