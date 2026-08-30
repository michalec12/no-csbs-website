@echo off
set "PATH=C:\Program Files\nodejs;%PATH%"
cd /d "%~dp0..\site"
call "C:\Program Files\nodejs\npx.cmd" --yes serve . -l 4173
