"""Arranca la mesa de D&D.

    python app.py              -> http://localhost:8000 (solo en este ordenador)
    python app.py --lan        -> accesible desde móviles y otros equipos de la misma wifi
"""
import argparse
import webbrowser

from server.config import DATA_DIR
from server.handler import make_server
from server.network import lan_ip


def main():
    parser = argparse.ArgumentParser(description="Mesa de D&D")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--lan", action="store_true", help="Escuchar en la red local")
    parser.add_argument("--no-browser", action="store_true", help="No abrir el navegador")
    parser.add_argument("--data", default=str(DATA_DIR), help="Carpeta donde se guarda la campaña")
    args = parser.parse_args()

    host = "0.0.0.0" if args.lan else "127.0.0.1"
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
    if args.lan:
        print(f"Pantalla de jugadores para tus amigos: http://{lan_ip()}:{port}/player.html")
        print(f"Mesa del máster desde el móvil:        http://{lan_ip()}:{port}/")
    if not args.no_browser:
        try:  # en el móvil (Termux, a-Shell) puede no haber navegador que abrir
            webbrowser.open(url)
        except Exception:  # noqa: BLE001
            pass
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nHasta la próxima partida.")


if __name__ == "__main__":
    main()
