@echo off
REM One-shot publish to GitHub Pages. Needs the gh CLI, signed in once:
REM   winget install GitHub.cli
REM   gh auth login
setlocal
cd /d "%~dp0"

where gh >nul 2>nul
if errorlevel 1 (
  echo.
  echo   The GitHub CLI is not installed.
  echo   Run:  winget install GitHub.cli
  echo   Then: gh auth login
  echo.
  pause
  exit /b 1
)

git rev-parse --git-dir >nul 2>nul || git init

echo Committing any changes...
git add -A
git diff --cached --quiet || git commit -m "update locked"

git remote get-url origin >nul 2>nul
if errorlevel 1 (
  echo Creating the repository and pushing...
  gh repo create locked --public --source=. --remote=origin --push
) else (
  echo Pushing...
  git push -u origin HEAD
)

echo Turning on GitHub Pages...
for /f "delims=" %%b in ('git rev-parse --abbrev-ref HEAD') do set BRANCH=%%b
gh api -X POST repos/:owner/locked/pages -f "source[branch]=%BRANCH%" -f "source[path]=/" >nul 2>nul
if errorlevel 1 gh api -X PUT repos/:owner/locked/pages -f "source[branch]=%BRANCH%" -f "source[path]=/" >nul 2>nul

for /f "delims=" %%u in ('gh api repos/:owner/locked/pages --jq .html_url 2^>nul') do set URL=%%u
echo.
if defined URL (
  echo   Live at: %URL%
  echo   First build takes a minute or two.
) else (
  echo   Pushed. Turn on Pages at: Settings -^> Pages -^> Branch: %BRANCH% / root
)
echo.
pause
