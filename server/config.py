"""Rutas y límites de la aplicación."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STATIC_DIR = ROOT / "static"
DATA_DIR = ROOT / "data"

# Colecciones que se guardan como JSON en data/<nombre>.json
COLLECTIONS = ("characters", "combats", "maps", "notes", "quests", "tracks")

MAX_JSON_BYTES = 5 * 1024 * 1024
MAX_UPLOAD_BYTES = 60 * 1024 * 1024
MAX_BACKUP_BYTES = 2 * 1024 * 1024 * 1024
UPLOAD_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".gif", ".webp",          # mapas y retratos
    ".mp3", ".ogg", ".wav", ".m4a", ".flac",           # música
}
ROLL_LOG_SIZE = 100
