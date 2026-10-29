"""Servidor HTTP: ficheros estáticos, ficheros subidos y API JSON."""
import json
import mimetypes
import os
import shutil
import sys
import tempfile
import time
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

from . import api, backup, config
from .storage import JsonStore

mimetypes.add_type("text/javascript", ".js")
mimetypes.add_type("image/webp", ".webp")
mimetypes.add_type("image/svg+xml", ".svg")


class App:
    def __init__(self, data_dir=config.DATA_DIR):
        self.store = JsonStore(data_dir, config.COLLECTIONS)
        self.data_dir = Path(data_dir)
        self.upload_dir = self.data_dir / "uploads"


class Handler(SimpleHTTPRequestHandler):
    app: App = None

    def log_request(self, code="-", size="-"):  # la consola solo muestra peticiones fallidas
        if isinstance(code, int) and code >= 400:
            super().log_request(code, size)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    # -- despacho ----------------------------------------------------------
    def do_GET(self):
        path = urlsplit(self.path).path
        if path == "/api/backup":
            return self._export_backup()
        if path.startswith("/api/"):
            return self._api("GET", path)
        if path.startswith("/uploads/"):
            return self._upload_file(unquote(path[len("/uploads/"):]))
        return super().do_GET()

    def do_POST(self):
        path = urlsplit(self.path).path
        if path == "/api/backup":
            return self._import_backup()
        self._api("POST", path)

    def do_PUT(self):
        self._api("PUT", urlsplit(self.path).path)

    def do_DELETE(self):
        self._api("DELETE", urlsplit(self.path).path)

    # -- API ---------------------------------------------------------------
    def _api(self, method, path):
        try:
            route = api.match(method, path)
            if route is None:
                raise api.ApiError(404, "Ruta desconocida")
            fn, params = route
            status, data = fn(self.app, params, self._body(path))
            self._json(status, data)
        except api.ApiError as e:
            self._json(e.status, {"error": str(e)})
        except ConnectionError:  # el navegador se fue antes de recibir la respuesta: no hay a quién contestar
            self.close_connection = True
        except Exception as e:  # noqa: BLE001 - que el servidor no se caiga
            self.log_error("Error en %s %s: %r", method, path, e)
            self._json(500, {"error": "Error interno del servidor"})

    def _body(self, path):
        length = int(self.headers.get("Content-Length") or 0)
        if path == "/api/uploads":
            if length > config.MAX_UPLOAD_BYTES:
                raise api.ApiError(413, "Fichero demasiado grande")
            return self.rfile.read(length), unquote(self.headers.get("X-Filename", ""))
        if length > config.MAX_JSON_BYTES:
            raise api.ApiError(413, "Petición demasiado grande")
        if not length:
            return None
        try:
            return json.loads(self.rfile.read(length).decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            raise api.ApiError(400, "JSON no válido")

    def _json(self, status, data):
        payload = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    # -- copias de seguridad ---------------------------------------------------
    def _export_backup(self):
        with tempfile.TemporaryFile() as tmp:
            with self.app.store.lock:
                backup.export_zip(self.app.data_dir, tmp)
            size = tmp.tell()
            tmp.seek(0)
            name = f"mesa-dnd-{time.strftime('%Y-%m-%d')}.zip"
            self.send_response(200)
            self.send_header("Content-Type", "application/zip")
            self.send_header("Content-Disposition", f'attachment; filename="{name}"')
            self.send_header("Content-Length", str(size))
            self.end_headers()
            shutil.copyfileobj(tmp, self.wfile)

    def _import_backup(self):
        length = int(self.headers.get("Content-Length") or 0)
        if length > config.MAX_BACKUP_BYTES:
            return self._json(413, {"error": "Copia demasiado grande"})
        with tempfile.TemporaryFile() as tmp:
            remaining = length
            while remaining > 0:
                chunk = self.rfile.read(min(remaining, 1 << 20))
                if not chunk:
                    break
                tmp.write(chunk)
                remaining -= len(chunk)
            tmp.seek(0)
            try:
                with self.app.store.lock:
                    result = backup.import_zip(self.app.data_dir, tmp)
            except backup.BackupError as e:
                return self._json(400, {"error": str(e)})
        self._json(200, result)

    def _upload_file(self, name):
        path = self.app.upload_dir / name
        if not api.SAFE_UPLOAD.match(name) or not path.is_file():
            return self.send_error(404)
        data = path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", mimetypes.guess_type(name)[0] or "application/octet-stream")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


class Server(ThreadingHTTPServer):
    # En Windows SO_REUSEADDR deja que dos servidores compartan puerto sin avisar.
    allow_reuse_address = os.name != "nt"
    daemon_threads = True

    def handle_error(self, request, client_address):
        if not isinstance(sys.exc_info()[1], ConnectionError):  # un navegador que cierra la conexión no es un error
            super().handle_error(request, client_address)


def make_server(host, port, data_dir=config.DATA_DIR):
    handler = type("BoundHandler", (Handler,), {"app": App(data_dir)})
    return Server((host, port), partial(handler, directory=str(config.STATIC_DIR)))
