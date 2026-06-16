@echo off
cd /d "%~dp0"
echo Installation en cours...
npm install
echo.
echo Initialisation de la base de donnees...
node seed.js
echo.
echo Demarrage du serveur...
start http://localhost:3000
npm start
