"""Direcciones de red para conectar móviles al ordenador del máster."""
import socket


def lan_ip():
    """IP de este equipo en la red local (sin enviar nada: UDP no conecta de verdad)."""
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
        try:
            s.connect(("10.255.255.255", 1))
            return s.getsockname()[0]
        except OSError:
            return "127.0.0.1"


def info(host, port):
    lan = host in ("0.0.0.0", "")
    base = f"http://{lan_ip()}:{port}" if lan else None
    return {
        "lan": lan,
        "port": port,
        "master": f"{base}/" if base else None,
        "player": f"{base}/player.html" if base else None,
    }
