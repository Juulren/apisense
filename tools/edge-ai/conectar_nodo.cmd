@echo off
rem Doble clic: busca el ESP32 conectado por USB y sube sus veredictos a Supabase (hace de gateway
rem mientras no hay LoRa). No guarda ni sube audio.
chcp 65001 >nul
cd /d "%~dp0"
set PYTHONIOENCODING=utf-8
if not exist data\nodo.cmd (
  echo Falta el archivo data\nodo.cmd con UPLINK_URL y DEV_EUI. Mira tools\edge-ai\README.md.
  pause
  exit /b 1
)
call data\nodo.cmd
echo Los veredictos se GUARDAN en %UPLINK_URL%
echo y pueden mandar avisos. Para detener, pulsa Ctrl+C o cierra la ventana.
python -m apisense_audio.bridge --port auto --url "%UPLINK_URL%" --dev-eui %DEV_EUI% --yes-store-real-rows --log data\puente.log
pause
