#!/bin/sh
# Arranca la Mesa de D&D en macOS o Linux:  sh iniciar.sh
cd "$(dirname "$0")" || exit 1
if command -v python3 >/dev/null 2>&1; then
  exec python3 app.py "$@"
elif command -v python >/dev/null 2>&1; then
  exec python app.py "$@"
else
  echo "No se ha encontrado Python. Instálalo desde https://www.python.org/downloads/"
  exit 1
fi
