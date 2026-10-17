"""Arranca la mesa de D&D en este ordenador: python app.py  ->  http://localhost:8000"""
import argparse
import webbrowser

from server.config import DATA_DIR
from server.handler import make_server


def main():
    parser = argparse.ArgumentParser(description="Mesa de D&D")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--no-browser", action="store_true", help="No abrir el navegador")
    parser.add_argument("--data", default=str(DATA_DIR), help="Carpeta donde se guarda la campaña")
    args = parser.parse_args()

    host = "127.0.0.1"  # solo este ordenador
    server = None
    for port in range(args.port, args.port + 20):  # si el puerto está ocupado, prueba el siguiente
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
    if not args.no_browser:
        try:  # puede no haber navegador que abrir
            webbrowser.open(url)
        except Exception:  # noqa: BLE001
            pass
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nHasta la próxima partida.")


if __name__ == "__main__":
    main()
