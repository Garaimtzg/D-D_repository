"""Rutas de la API JSON. Cada función recibe (app, params, body) y devuelve (estado, datos)."""
import re
import time
import uuid

from . import config, dice, dungeon, gaueko, generators, homebrew, rules, scenes
from .monsters import MONSTERS

SAFE_UPLOAD = re.compile(r"^[a-f0-9]{32}\.[a-z0-9]{2,5}$")


class ApiError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status


def _require_dict(body):
    if not isinstance(body, dict):
        raise ApiError(400, "Se esperaba un objeto JSON")
    return body


# -- colecciones genéricas ---------------------------------------------------
def list_items(app, p, body):
    return 200, app.store.list(p["col"])


def create_item(app, p, body):
    return 201, app.store.create(p["col"], _require_dict(body))


def get_item(app, p, body):
    item = app.store.get(p["col"], p["id"])
    if item is None:
        raise ApiError(404, "No encontrado")
    return 200, item


def update_item(app, p, body):
    item = app.store.update(p["col"], p["id"], _require_dict(body))
    if item is None:
        raise ApiError(404, "No encontrado")
    return 200, item


def delete_item(app, p, body):
    if not app.store.delete(p["col"], p["id"]):
        raise ApiError(404, "No encontrado")
    return 200, {"ok": True}


# -- dados ----------------------------------------------------------------
def roll(app, p, body):
    body = _require_dict(body)
    try:
        result = dice.roll(str(body.get("expr", "")), str(body.get("mode", "")), given=body.get("dice"))
    except dice.DiceError as e:
        raise ApiError(400, str(e))
    result.update(id=uuid.uuid4().hex[:8], time=time.time(),
                  who=str(body.get("who", ""))[:40], label=str(body.get("label", ""))[:80],
                  secret=bool(body.get("secret")))
    log = app.store.get_doc("rolls", [])
    log.append(result)
    app.store.set_doc("rolls", log[-config.ROLL_LOG_SIZE:])
    return 200, result


def list_rolls(app, p, body):
    return 200, app.store.get_doc("rolls", [])


def clear_rolls(app, p, body):
    app.store.set_doc("rolls", [])
    return 200, {"ok": True}


# -- reglas, generadores, bestiario --------------------------------------
def reference(app, p, body):
    return 200, homebrew.merge(rules.reference(), app.store.list("homebrew"))  # con las especies y clases propias


def monsters(app, p, body):
    return 200, MONSTERS


def generate(app, p, body):
    try:
        return 200, generators.generate(p["kind"], body if isinstance(body, dict) else {})
    except KeyError:
        raise ApiError(404, "Generador desconocido")


def scene_catalog(app, p, body):
    return 200, scenes.catalog()


def make_dungeon(app, p, body):
    body = body if isinstance(body, dict) else {}
    try:
        seed = int(body.get("seed") or 0) or None
    except (TypeError, ValueError):
        raise ApiError(400, "La semilla debe ser un número")
    return 200, dungeon.generate(seed, body.get("size", "mediana"), body.get("kind", "mazmorra"))


def night(app, p, body):
    """Tirada de la noche: modificadores y, si llega el total del d20, lo que pasa."""
    body = _require_dict(body)
    ctx = body.get("ctx") if isinstance(body.get("ctx"), dict) else {}
    mods = gaueko.modifiers(ctx)
    out = {"mods": mods, "bonus": sum(v for _, v in mods)}
    total = body.get("total")
    if total is not None:
        if not isinstance(total, int) or isinstance(total, bool):
            raise ApiError(400, "El total de la tirada tiene que ser un número")
        levels = body.get("levels") if isinstance(body.get("levels"), list) else []
        out["result"] = gaueko.resolve(total, ctx, [l for l in levels if isinstance(l, int) and 1 <= l <= 20])
    return 200, out


def encounter(app, p, body):
    body = _require_dict(body)
    try:
        return 200, rules.encounter(body.get("levels", []), body.get("crs", []))
    except (ValueError, TypeError) as e:
        raise ApiError(400, str(e))


# -- ajustes compartidos (mapa mostrado, combate activo, reloj...) -------
def get_settings(app, p, body):
    return 200, app.store.get_doc("settings", {})


def put_settings(app, p, body):
    current = app.store.get_doc("settings", {})
    current.update(_require_dict(body))
    return 200, app.store.set_doc("settings", current)


# -- subida de ficheros ---------------------------------------------------
def upload(app, p, body):
    raw, filename = body
    ext = ("." + filename.rsplit(".", 1)[-1].lower()) if "." in filename else ""
    if ext not in config.UPLOAD_EXTENSIONS:
        raise ApiError(400, f"Tipo de fichero no permitido ({ext or 'sin extensión'})")
    if not raw:
        raise ApiError(400, "Fichero vacío")
    app.upload_dir.mkdir(parents=True, exist_ok=True)
    stored = uuid.uuid4().hex + ext
    (app.upload_dir / stored).write_bytes(raw)
    return 201, {"url": f"/uploads/{stored}", "name": filename, "size": len(raw)}


def delete_upload(app, p, body):
    if not SAFE_UPLOAD.match(p["name"]):
        raise ApiError(400, "Nombre no válido")
    path = app.upload_dir / p["name"]
    if path.exists():
        path.unlink()
    return 200, {"ok": True}


_COL = "(?P<col>" + "|".join(config.COLLECTIONS) + ")"
ROUTES = [
    ("GET", r"/api/reference", reference),
    ("GET", r"/api/monsters", monsters),
    ("POST", r"/api/roll", roll),
    ("GET", r"/api/rolls", list_rolls),
    ("DELETE", r"/api/rolls", clear_rolls),
    ("POST", r"/api/generate/(?P<kind>\w+)", generate),
    ("POST", r"/api/encounter", encounter),
    ("POST", r"/api/night", night),
    ("GET", r"/api/scene-catalog", scene_catalog),
    ("POST", r"/api/dungeon", make_dungeon),
    ("GET", r"/api/settings", get_settings),
    ("PUT", r"/api/settings", put_settings),
    ("POST", r"/api/uploads", upload),
    ("DELETE", r"/api/uploads/(?P<name>[^/]+)", delete_upload),
    ("GET", rf"/api/{_COL}", list_items),
    ("POST", rf"/api/{_COL}", create_item),
    ("GET", rf"/api/{_COL}/(?P<id>[\w-]+)", get_item),
    ("PUT", rf"/api/{_COL}/(?P<id>[\w-]+)", update_item),
    ("DELETE", rf"/api/{_COL}/(?P<id>[\w-]+)", delete_item),
]
ROUTES = [(m, re.compile(rf"^{pattern}$"), fn) for m, pattern, fn in ROUTES]


def match(method, path):
    """Devuelve (función, parámetros) o None. Lanza 405 si la ruta existe con otro método."""
    path_exists = False
    for m, rx, fn in ROUTES:
        found = rx.match(path)
        if found:
            if m == method:
                return fn, found.groupdict()
            path_exists = True
    if path_exists:
        raise ApiError(405, "Método no permitido")
    return None
