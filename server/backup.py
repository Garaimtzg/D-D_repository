"""Copias de seguridad de la campaña: toda la carpeta de datos en un .zip."""
import re
import time
import zipfile
from pathlib import Path

# Solo se exportan/importan los JSON de la campaña y los ficheros subidos.
ALLOWED = re.compile(r"^(?:_?[a-z]+\.json|uploads/[a-f0-9]{32}\.[a-z0-9]{2,5})$")


class BackupError(ValueError):
    pass


def _members(data_dir: Path):
    for path in sorted(data_dir.glob("*.json")):
        yield path, path.name
    uploads = data_dir / "uploads"
    if uploads.is_dir():
        for path in sorted(uploads.iterdir()):
            name = f"uploads/{path.name}"
            if path.is_file() and ALLOWED.match(name):
                yield path, name


def export_zip(data_dir, fileobj):
    data_dir = Path(data_dir)
    with zipfile.ZipFile(fileobj, "w") as zf:
        for path, name in _members(data_dir):
            # Imágenes y audio ya vienen comprimidos; los JSON sí se comprimen.
            method = zipfile.ZIP_DEFLATED if name.endswith(".json") else zipfile.ZIP_STORED
            zf.write(path, name, compress_type=method)


def import_zip(data_dir, fileobj) -> dict:
    """Sustituye la campaña actual por la del .zip. Antes guarda una copia automática."""
    data_dir = Path(data_dir)
    try:
        zf = zipfile.ZipFile(fileobj)
    except zipfile.BadZipFile:
        raise BackupError("El fichero no es un .zip válido")
    with zf:
        names = [n for n in zf.namelist() if not n.endswith("/")]
        bad = [n for n in names if not ALLOWED.match(n)]
        if bad:
            raise BackupError(f"El .zip no parece una copia de la Mesa de D&D ({bad[0]})")
        if not any(n.endswith(".json") for n in names):
            raise BackupError("La copia está vacía")

        backups = data_dir / "backups"
        backups.mkdir(parents=True, exist_ok=True)
        auto = backups / f"antes-de-importar-{time.strftime('%Y%m%d-%H%M%S')}.zip"
        with auto.open("wb") as f:
            export_zip(data_dir, f)

        for path, _ in list(_members(data_dir)):
            path.unlink()
        (data_dir / "uploads").mkdir(parents=True, exist_ok=True)
        for name in names:
            (data_dir / name).write_bytes(zf.read(name))
    return {"files": len(names), "previous": auto.name}
