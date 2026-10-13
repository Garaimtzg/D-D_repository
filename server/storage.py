"""Almacén JSON sencillo: un fichero por colección, escrituras atómicas."""
import json
import os
import threading
import time
import uuid
from pathlib import Path


class JsonStore:
    def __init__(self, data_dir: Path, collections):
        self.dir = Path(data_dir)
        self.dir.mkdir(parents=True, exist_ok=True)
        self.collections = set(collections)
        self._lock = threading.RLock()

    @property
    def lock(self):
        """Bloqueo para operaciones que tocan toda la carpeta (copias de seguridad)."""
        return self._lock

    # -- utilidades internas -------------------------------------------------
    def _path(self, name):
        if name not in self.collections and not name.startswith("_"):
            raise KeyError(name)
        return self.dir / f"{name}.json"

    def _read(self, name, default):
        path = self._path(name)
        if not path.exists():
            return default
        with path.open(encoding="utf-8") as f:
            return json.load(f)

    def _write(self, name, data):
        path = self._path(name)
        tmp = path.with_suffix(".tmp")
        with tmp.open("w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=1)
        os.replace(tmp, path)

    # -- colecciones (listas de documentos con id) ---------------------------
    def list(self, name):
        with self._lock:
            return self._read(name, [])

    def get(self, name, item_id):
        return next((d for d in self.list(name) if d.get("id") == item_id), None)

    def create(self, name, doc: dict):
        with self._lock:
            items = self._read(name, [])
            now = time.time()
            doc = {**doc, "id": doc.get("id") or uuid.uuid4().hex[:12], "created": now, "updated": now}
            if any(d["id"] == doc["id"] for d in items):
                raise ValueError("id duplicado")
            items.append(doc)
            self._write(name, items)
            return doc

    def update(self, name, item_id, doc: dict):
        with self._lock:
            items = self._read(name, [])
            for i, old in enumerate(items):
                if old.get("id") == item_id:
                    items[i] = {**doc, "id": item_id, "created": old.get("created"), "updated": time.time()}
                    self._write(name, items)
                    return items[i]
            return None

    def delete(self, name, item_id):
        with self._lock:
            items = self._read(name, [])
            kept = [d for d in items if d.get("id") != item_id]
            if len(kept) == len(items):
                return False
            self._write(name, kept)
            return True

    # -- documentos sueltos (ajustes, registro de tiradas) -------------------
    def get_doc(self, name, default=None):
        with self._lock:
            return self._read("_" + name, default if default is not None else {})

    def set_doc(self, name, value):
        with self._lock:
            self._write("_" + name, value)
            return value
