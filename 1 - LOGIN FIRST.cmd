@echo off
title Sign in to GitHub
set "GH=%LOCALAPPDATA%\Microsoft\WinGet\Links\gh.exe"
if not exist "%GH%" set "GH=gh"

echo.
echo   This signs the GitHub CLI in to your account.
echo   Claude cannot do this step - it needs your password.
echo.
echo   Pick:  GitHub.com  ^>  HTTPS  ^>  Yes (authenticate Git)
echo          ^>  Login with a web browser
echo.
echo   It shows a one-time code, then opens github.com.
echo   Paste the code there and you are done.
echo.
pause

"%GH%" auth login

echo.
"%GH%" auth status
echo.
echo   If that says "Logged in", run  2 - PUBLISH.cmd  next.
echo.
pause
