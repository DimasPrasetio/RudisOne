@echo off
rem Dipakai git sebagai GIT_ASKPASS di Windows (mode askpass di perkakas.mjs) dan sebagai pembungkus: askpass.cmd pat ^<layanan^>
node "%~dp0perkakas.mjs" %*
