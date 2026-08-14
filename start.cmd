@echo off
title locked
cd /d "%~dp0"
start "" http://localhost:5180
node server.js
