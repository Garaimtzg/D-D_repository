"""Pantalla de jugadores en otro ordenador (opcional).

Mientras no se activa, todo sigue como siempre: la mesa solo escucha en este ordenador (127.0.0.1) y nada se ve
desde la red. Al activarla, el máster abre una segunda entrada en la red local (otro puerto) que solo sirve:

  · la página de los jugadores (static/jugadores.html) y los ficheros de la interfaz (/js, /css, el icono);
  · «lo que ve la mesa de los jugadores», que se compone aquí, en el servidor, a partir de lo guardado y de lo que el
    máster ha elegido mostrar: sin enemigos ocultos, sin PG exactos de los enemigos (aproximados o nada), sin trampas
    ni puertas secretas, sin notas del máster, sin tiradas secretas y sin los enemigos que tapa la niebla;
  · las imágenes que aparecen en eso (el mapa, los retratos, la imagen que se enseña) y ninguna otra;
  · las tiradas de dados que hagan los jugadores (siempre públicas), si el máster lo permite; con dados físicos,
    si el máster lo activa, apuntan lo que ha salido y la app suma, aplica la ventaja y avisa de los críticos.

Todo lo demás de la API devuelve 403 desde la red: las fichas, las notas, el compendio o los combates enteros nunca
salen de este ordenador. Para entrar hace falta el código que muestra el máster (cookie «mesa_codigo»).
El máster puede congelar lo que ven (para preparar el siguiente mapa sin que lo vean) o poner una pantalla de espera.
"""
import hashlib
import hmac
import json
import mimetypes
import posixpath
import re
import secrets
import socket
import threading
import time
from functools import partial
from http.server import SimpleHTTPRequestHandler
from urllib.parse import parse_qs, unquote, urlsplit

from . import config, dice, scenes

DEFAULT_SHOW = {
    "map": True,          # el mapa o el tablero de combate
    "initiative": True,   # la cinta de iniciativa
    "party": True,        # el grupo con sus PG
    "enemyHp": "aprox",   # PG de los enemigos: "aprox" (sano / herido / malherido) o "no"
    "rolls": True,        # las últimas tiradas públicas
    "clock": True,        # reloj y calendario del mundo
    "weather": True,      # el clima sobre el tablero
    "narration": True,    # la narración y la imagen que enseña el máster
    "dice": True,         # que puedan tirar dados desde su ordenador
    "physical": False,    # que allí apunten lo que sale en sus dados físicos (la app suma y avisa de los críticos)
}
SCREENS = ("mesa", "espera", "negro")
CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"  # sin 0/O ni 1/I/L, que se confunden al dictarlo
UPLOAD_RE = re.compile(r"/uploads/([a-f0-9]{32}\.[a-z0-9]{2,5})")
STATIC_PREFIXES = ("/js/", "/css/")
STATIC_FILES = {"/icon.svg", "/jugadores.html"}
LONG_POLL = 20  # segundos que espera una petición de la pantalla de jugadores antes de contestar «sin cambios»


def new_code():
    return "".join(secrets.choice(CODE_CHARS) for _ in range(6))


def lan_ips():
    """IP de este ordenador en la red local (sin enviar nada: el UDP no conecta de verdad)."""
    ips = []
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
        try:
            s.connect(("10.255.255.255", 1))
            ips.append(s.getsockname()[0])
        except OSError:
            pass
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            ip = info[4][0]
            if ip not in ips and not ip.startswith("127."):
                ips.append(ip)
    except OSError:
        pass
    return ips or ["127.0.0.1"]


# ------------------------------------------------------------------ lo que ven los jugadores
def _approx_hp(hp, max_hp):
    """PG aproximados, como en el modo jugadores: lleno, 70 %, 40 %, 15 % o caído."""
    if not max_hp:
        return None
    r = (hp or 0) / max(1, max_hp)
    return max_hp * (1 if r >= 1 else 0.7 if r > 0.5 else 0.4 if r > 0.25 else 0.15 if r > 0 else 0)


def _conds(x):
    return [{"name": k.get("name"), "rounds": k.get("rounds")} if isinstance(k, dict) else {"name": k, "rounds": None}
            for k in x.get("conditions") or []]


def public_combatant(x, enemy_hp):
    out = {k: x.get(k) for k in ("cid", "charId", "name", "type", "color", "portrait", "look", "size", "init", "concentration")}
    out["conditions"] = _conds(x)
    out["hidden"] = False
    if x.get("type") == "jugador":
        out.update({k: x.get(k) for k in ("hp", "maxHp", "tempHp", "ac", "deathSaves", "speed", "exhaustion", "initBonus")})
    elif enemy_hp == "aprox":
        out.update(hp=_approx_hp(x.get("hp"), x.get("maxHp")), maxHp=x.get("maxHp"), tempHp=0)
    else:  # sin PG: solo si está en pie (1) o ha caído (0), sin máximo para que no salga barra de vida
        out.update(hp=0 if (x.get("hp") or 0) <= 0 else 1, maxHp=None, tempHp=0)
    return out


def public_scene(sc):
    """Escenario sin lo que solo ve el máster: objetos ocultos (trampas, puertas secretas), descripción, notas y
    las zonas de inicio (dirían por dónde van a aparecer los enemigos)."""
    if not sc:
        return None
    out = {k: v for k, v in sc.items() if k not in ("description", "notes", "spawns", "created", "updated")}
    out["props"] = [p for p in sc.get("props") or [] if not p.get("hidden")]
    return out


def public_combat(c, scene, enemy_hp):
    visible = [x for x in c.get("combatants") or [] if not x.get("hidden")]
    turn = c.get("turn", 0)
    all_c = c.get("combatants") or []
    current = all_c[turn] if 0 <= turn < len(all_c) else None
    board = c.get("board") or {}
    fog = board.get("fog") if isinstance(board.get("fog"), dict) else None
    seen = set(fog.get("seen") or []) if fog and fog.get("on") else None
    cols = (scene or {}).get("cols") or 0
    pos = {}
    for x in visible:
        p = (board.get("pos") or {}).get(x.get("cid"))
        if not p:
            continue
        # bajo la niebla los jugadores no ven a los enemigos: ni siquiera se envía dónde están
        if seen is not None and x.get("type") != "jugador" and cols and (p[1] * cols + p[0]) not in seen:
            continue
        pos[x["cid"]] = p
    return {
        "id": c.get("id"), "name": c.get("name"), "status": c.get("status"), "round": c.get("round"),
        "turn": visible.index(current) if current in visible else -1,
        "combatants": [public_combatant(x, enemy_hp) for x in visible],
        "board": {"scene": board.get("scene"), "pos": pos, "moved": board.get("moved") or {},
                  "fog": {"on": bool(fog and fog.get("on")), "seen": sorted(seen) if seen is not None else []},
                  "doors": board.get("doors") or []},
        "log": [],
    }


def public_map(m, hidden_cids):
    if not m:
        return None
    pins = []
    if m.get("pinsShow") == "todos":  # chinchetas «para todos»: solo dónde están y su nombre
        pins = [{"id": p.get("id"), "x": p.get("x"), "y": p.get("y"), "icon": p.get("icon"), "label": p.get("label") or p.get("name") or ""}
                for p in m.get("pins") or []]
    return {
        "id": m.get("id"), "name": m.get("name"), "url": m.get("url"), "tokenSize": m.get("tokenSize"),
        "tokens": [t for t in m.get("tokens") or [] if t.get("cid") not in hidden_cids],
        "drawings": m.get("drawings") or [], "pins": pins, "pinsShow": "todos" if pins else "master",
    }


def public_character(ch):
    keys = ("id", "name", "type", "color", "portrait", "look", "hp", "maxHp", "tempHp", "ac", "abilities", "skills", "level", "cls",
            "race", "exhaustion", "deathSaves", "initBonus", "speed")
    out = {k: ch.get(k) for k in keys}
    out["conditions"] = [k for k in ch.get("conditions") or [] if isinstance(k, str)]
    out["attacks"] = [{k: a.get(k) for k in ("name", "bonus", "damage", "save", "notes")} for a in ch.get("attacks") or []][:6]
    return out


def compose(store, cfg):
    """Lo que ve ahora la pantalla de jugadores, ya sin secretos."""
    settings = store.get_doc("settings", {})
    show = {**DEFAULT_SHOW, **(cfg.get("show") or {})}
    screen = cfg.get("screen") if cfg.get("screen") in SCREENS else "mesa"
    out = {"screen": screen, "show": show, "campaign": settings.get("campaignName", ""),
           "wait": {"text": str(cfg.get("waitText") or "")[:300], "image": cfg.get("waitImage") or ""}}
    if screen != "mesa":
        return out
    pub = {k: settings.get(k) for k in ("tableMap", "shownMap", "activeCombat", "tableView", "ping") if settings.get(k) is not None}
    if show["weather"]:
        pub["tableWeather"] = settings.get("tableWeather") or ""
    if show["narration"]:
        pub["playerMessage"] = settings.get("playerMessage") or ""
        pub["playerImage"] = settings.get("playerImage") or ""
    if show["clock"] and settings.get("clock"):
        pub["clock"] = settings["clock"]
        cal = settings.get("calendar") or {}
        pub["calendar"] = {k: cal[k] for k in ("preset", "months", "weekdays", "year", "start", "moon", "moonOffset") if k in cal}
    combat = None
    scene = None
    hidden = set()  # combatientes ocultos: tampoco salen sus fichas en el mapa
    if settings.get("activeCombat"):
        c = store.get("combats", settings["activeCombat"])
        if c and c.get("status") == "active":
            sid = (c.get("board") or {}).get("scene")
            raw_scene = next((s for s in scenes.PRESETS if s["id"] == sid), None) or (store.get("scenes", sid) if sid else None)
            scene = public_scene(raw_scene) if show["map"] else None
            combat = public_combat(c, raw_scene, show["enemyHp"])
            if not show["map"]:  # sin tablero: ni el escenario ni dónde está cada uno
                combat["board"] = {"scene": None, "pos": {}, "moved": {}, "fog": {"on": False, "seen": []}, "doors": []}
            hidden = {x.get("cid") for x in c.get("combatants") or [] if x.get("hidden")}
    shown = settings.get("tableMap") or settings.get("shownMap")
    out.update(
        settings=pub,
        combat=combat,
        map=public_map(store.get("maps", shown), hidden) if show["map"] and shown else None,
        scenes=[scene] if scene and not str(scene.get("id", "")).startswith("p-") else [],
        scene=scene,
        chars=[public_character(ch) for ch in store.list("characters") if ch.get("type") == "jugador"] if show["party"] or show["dice"] else [],
        rolls=[r for r in store.get_doc("rolls", []) if not r.get("secret")][-12:] if show["rolls"] else [],
    )
    return out


def public_catalog():
    """El catálogo del tablero sin lo que solo ve el máster en los prediseñados."""
    cat = scenes.catalog()
    return {**cat, "presets": [public_scene(s) for s in cat["presets"]]}


def version_of(bundle):
    return hashlib.sha1(json.dumps(bundle, sort_keys=True, ensure_ascii=False).encode("utf-8")).hexdigest()[:16]


# ------------------------------------------------------------------ servidor de la red
class RemoteManager:
    """Arranca y para la entrada de red de los jugadores y guarda lo que el máster elige mostrar."""

    def __init__(self, app, main_port):
        self.app = app
        self.main_port = main_port
        self.server = None
        self.thread = None
        self.error = ""
        self.clients = {}  # ip -> última vez que preguntó
        self.frozen = None  # lo que ven mientras está congelada
        self.bind_host = "0.0.0.0"  # toda la red local (los tests usan 127.0.0.1)
        self.bind_ports = None  # None: el siguiente puerto libre tras el de la mesa (hasta 10 más)

    # -- configuración (en los ajustes de la campaña) --------------------------------
    def config(self):
        cfg = self.app.store.get_doc("settings", {}).get("remote") or {}
        return {"on": False, "show": dict(DEFAULT_SHOW), "screen": "mesa", "waitText": "", "waitImage": "", "frozen": False, **cfg,
                "show": {**DEFAULT_SHOW, **(cfg.get("show") or {})}}

    def _save(self, cfg):
        with self.app.store.lock:
            settings = self.app.store.get_doc("settings", {})
            settings["remote"] = cfg
            self.app.store.set_doc("settings", settings)

    def update(self, patch):
        if not isinstance(patch, dict):
            raise ValueError("Se esperaba un objeto")
        cfg = self.config()
        if isinstance(patch.get("show"), dict):
            for k, v in patch["show"].items():
                if k in DEFAULT_SHOW:
                    cfg["show"][k] = v if k == "enemyHp" and v in ("aprox", "no") else bool(v) if k != "enemyHp" else cfg["show"][k]
        if patch.get("screen") in SCREENS:
            cfg["screen"] = patch["screen"]
        if "waitText" in patch:
            cfg["waitText"] = str(patch["waitText"] or "")[:300]
        if "waitImage" in patch:
            cfg["waitImage"] = patch["waitImage"] if isinstance(patch["waitImage"], str) and UPLOAD_RE.fullmatch(patch["waitImage"] or "") else ""
        if patch.get("newCode") or not cfg.get("code"):
            cfg["code"] = new_code()
        if "frozen" in patch:
            cfg["frozen"] = bool(patch["frozen"])
            self.frozen = compose(self.app.store, {**cfg, "frozen": False}) if cfg["frozen"] else None
        if "on" in patch:
            cfg["on"] = bool(patch["on"])
        self._save(cfg)
        if cfg["on"]:
            self.start()
        else:
            self.stop()
        return self.status()

    def status(self):
        cfg = self.config()
        now = time.time()
        port = self.server.server_address[1] if self.server else None
        return {
            "on": cfg["on"], "running": self.server is not None, "port": port, "code": cfg.get("code", ""),
            "urls": [f"http://{ip}:{port}/" for ip in lan_ips()] if port else [],
            "clients": [{"ip": ip, "ago": round(now - t)} for ip, t in list(self.clients.items()) if now - t < 45],
            "show": cfg["show"], "screen": cfg["screen"], "waitText": cfg["waitText"], "waitImage": cfg["waitImage"],
            "frozen": cfg["frozen"], "error": self.error,
        }

    def bundle(self):
        cfg = self.config()
        if cfg["frozen"]:
            if self.frozen is None:  # tras reiniciar la mesa, lo congelado es lo de ahora
                self.frozen = compose(self.app.store, {**cfg, "frozen": False})
            data = self.frozen
        else:
            data = compose(self.app.store, cfg)
        return {**data, "frozen": cfg["frozen"], "version": version_of(data)}

    def check_code(self, code):
        expected = self.config().get("code") or ""
        return bool(expected) and hmac.compare_digest(str(code or "").upper().encode(), expected.encode())

    # -- arrancar y parar ---------------------------------------------------------
    def start(self):
        if self.server:
            return
        from .handler import Server  # aquí para no importarnos en círculo
        handler = type("RemoteBoundHandler", (RemoteHandler,), {"manager": self})
        ports = self.bind_ports if self.bind_ports is not None else list(range(self.main_port + 1, self.main_port + 11))
        for p in ports:
            try:
                self.server = Server((self.bind_host, p), partial(handler, directory=str(config.STATIC_DIR)))
                break
            except OSError as e:
                self.error = f"No se ha podido abrir la red ({e})"
        if not self.server:
            return
        self.error = ""
        self.thread = threading.Thread(target=self.server.serve_forever, name="pantalla-jugadores", daemon=True)
        self.thread.start()

    def stop(self):
        if not self.server:
            return
        server, self.server = self.server, None
        server.shutdown()
        server.server_close()
        self.clients.clear()


class RemoteHandler(SimpleHTTPRequestHandler):
    """Lo único que se sirve a la red local. Cualquier otra cosa: 403 o 404."""

    manager: RemoteManager = None

    def log_request(self, code="-", size="-"):  # la consola de la mesa no se llena con lo que piden desde la red
        if isinstance(code, int) and code >= 500:
            super().log_request(code, size)

    def log_error(self, format, *args):  # noqa: A002 - el nombre lo pone http.server
        if not format.startswith("code "):  # los 403/404 que se contestan a propósito no son errores
            super().log_error(format, *args)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()

    def _code(self):
        q = parse_qs(urlsplit(self.path).query)
        if q.get("c"):
            return q["c"][0]
        if self.headers.get("X-Mesa-Codigo"):
            return self.headers["X-Mesa-Codigo"]
        for part in (self.headers.get("Cookie") or "").split(";"):
            k, _, v = part.strip().partition("=")
            if k == "mesa_codigo":
                return unquote(v)
        return ""

    def _json(self, status, data):
        payload = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self):
        path = posixpath.normpath(unquote(urlsplit(self.path).path))  # «/js/../index.html» no cuela
        if path in ("/", "/jugadores"):
            self.path = "/jugadores.html"
            return super().do_GET()
        if path.startswith(STATIC_PREFIXES) or path in STATIC_FILES:
            return super().do_GET()
        if path == "/favicon.ico":
            return self.send_error(404)
        authorized = self.manager.check_code(self._code())
        if path == "/api/jugadores":
            if not authorized:
                return self._json(401, {"error": "Código incorrecto"})
            self.manager.clients[self.client_address[0]] = time.time()
            since = parse_qs(urlsplit(self.path).query).get("v", [""])[0]
            deadline = time.time() + LONG_POLL
            while True:  # espera a que algo cambie (o a que pase un rato) para no preguntar a lo loco
                data = self.manager.bundle()
                if data["version"] != since or time.time() >= deadline or not self.manager.server:
                    return self._json(200, data)
                time.sleep(0.4)
        if path == "/api/scene-catalog":
            return self._json(200, public_catalog()) if authorized else self._json(401, {"error": "Código incorrecto"})
        if path.startswith("/uploads/"):
            name = path[len("/uploads/"):]
            # solo las imágenes que aparecen en lo que ven ahora (el mapa, los retratos, la imagen que se enseña)
            shown = set(UPLOAD_RE.findall(json.dumps(self.manager.bundle(), ensure_ascii=False)))
            if not authorized or name not in shown:
                return self.send_error(403)
            path_on_disk = self.manager.app.upload_dir / name
            if not path_on_disk.is_file():
                return self.send_error(404)
            data = path_on_disk.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", mimetypes.guess_type(name)[0] or "application/octet-stream")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return None
        return self.send_error(403 if path.startswith("/api/") else 404)

    def do_POST(self):
        path = urlsplit(self.path).path
        if path != "/api/roll":
            return self.send_error(403)
        if not self.manager.check_code(self._code()) or not self.manager.config()["show"]["dice"]:
            return self._json(403, {"error": "El máster no deja tirar dados desde este ordenador"})
        length = int(self.headers.get("Content-Length") or 0)
        if length > 4096:
            return self._json(413, {"error": "Petición demasiado grande"})
        try:
            body = json.loads(self.rfile.read(length).decode("utf-8") or "{}")
            # lo que sale en los dados físicos solo se acepta si el máster los ha activado en esta pantalla
            # (si no, cualquiera podría «apuntar» un 20 en vez de dejar tirar a la app)
            if body.get("dice") is not None and not self.manager.config()["show"]["physical"]:
                return self._json(403, {"error": "El máster no ha activado los dados físicos en esta pantalla"})
            result = dice.roll(str(body.get("expr", ""))[:60], str(body.get("mode", "")), given=body.get("dice"))
        except (UnicodeDecodeError, json.JSONDecodeError, AttributeError):
            return self._json(400, {"error": "JSON no válido"})
        except dice.DiceError as e:
            return self._json(400, {"error": str(e)})
        players = {ch.get("name") for ch in self.manager.app.store.list("characters") if ch.get("type") == "jugador"}
        who = str(body.get("who", ""))[:40]
        result.update(id=secrets.token_hex(4), time=time.time(), who=who if who in players else "Jugador",
                      label=str(body.get("label", ""))[:80], secret=False, remote=True)  # desde la red, siempre a la vista
        store = self.manager.app.store
        with store.lock:
            log = store.get_doc("rolls", [])
            log.append(result)
            store.set_doc("rolls", log[-config.ROLL_LOG_SIZE:])
        return self._json(200, result)

    def list_directory(self, path):  # nada de listar carpetas: solo se sirven ficheros concretos
        self.send_error(404)
        return None

    def do_PUT(self):
        self.send_error(403)

    def do_DELETE(self):
        self.send_error(403)

    def do_HEAD(self):
        self.send_error(405)
