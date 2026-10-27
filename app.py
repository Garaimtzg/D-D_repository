"""Arranca la mesa de D&D en este ordenador: python app.py  ->  http://localhost:8000"""
import argparse
import json
import sys
import urllib.request
import webbrowser
from pathlib import Path

from server.config import DATA_DIR
from server.handler import make_server


def running_mesa(port):
    """¿Hay ya una mesa abierta en ese puerto? Así un segundo doble clic no arranca otra sobre la misma campaña."""
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/settings", timeout=1) as r:
            return r.status == 200 and isinstance(json.load(r), dict)
    except (OSError, ValueError):
        return False


def open_browser(url, args):
    if not args.no_browser:
        try:  # puede no haber navegador que abrir
            webbrowser.open(url)
        except Exception:  # noqa: BLE001
            pass


def main():
    parser = argparse.ArgumentParser(description="Mesa de D&D")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--no-browser", action="store_true", help="No abrir el navegador")
    parser.add_argument("--data", default=str(DATA_DIR), help="Carpeta donde se guarda la campaña")
    args = parser.parse_args()

    if sys.stdout is None:  # sin ventana (pythonw, «Mesa DnD.vbs»): los mensajes van a data/mesa.log
        Path(args.data).mkdir(parents=True, exist_ok=True)
        sys.stdout = sys.stderr = open(Path(args.data) / "mesa.log", "w", encoding="utf-8", buffering=1)

    host = "127.0.0.1"  # solo este ordenador
    server = None
    for port in range(args.port, args.port + 20):  # si el puerto está ocupado, prueba el siguiente
        if running_mesa(port):
            print(f"La mesa ya estaba abierta en http://localhost:{port}")
            return open_browser(f"http://localhost:{port}", args)
        try:
            server = make_server(host, port, data_dir=args.data)
            break
        except OSError:
            continue
    if server is None:
        raise SystemExit(f"No hay ningún puerto libre entre {args.port} y {args.port + 19}.")
    port = server.server_address[1]
    url = f"http://localhost:{port}"
    print(f"Mesa de D&D en {url}  (Ctrl+C para salir)")
    open_browser(url, args)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nHasta la próxima partida.")


if __name__ == "__main__":
    main()
