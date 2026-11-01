"""Escenarios de exterior al azar: bosque, vado del río, ciénaga, desierto, paso nevado, costa, ruinas y campo de lava.

Cada bioma se construye con el mismo constructor determinista que los prediseñados (scenes._Grid): un ruido suave
reparte el terreno (maleza, hojarasca, nieve profunda…), los ríos y caminos serpentean, y la vegetación y las rocas
se dispersan con separación. Antes de dispersar nada se reserva un camino transitable entre la zona de inicio del
grupo y la de los enemigos, para que el escenario siempre se pueda jugar. Con la misma semilla sale el mismo mapa.
La descripción lleva una clave para el máster: qué hay, qué es terreno difícil o peligroso y qué acecha.
"""
import math
import random
from collections import deque

from .scenes import HAZARD, TERRAIN_COST, _Grid

SIZES = {"pequena": (24, 16), "mediana": (32, 22), "grande": (42, 28)}

# clave: (nombre, emoji para el selector, función)
KINDS = {}


def _kind(key, name):
    def deco(fn):
        KINDS[key] = (name, fn)
        return fn
    return deco


def generate(seed, size, kind):
    cols, rows = SIZES.get(size, SIZES["mediana"])
    name, fn = KINDS[kind]
    g = _Grid(cols, rows, ",", seed)
    sc = fn(g, seed)
    sc.pop("id")
    return {**sc, "preset": False, "seed": seed}


# ------------------------------------------------------------------ utilidades
class _Noise:
    """Ruido de valor suave (0..1) con dos octavas: manchas grandes con algo de detalle."""

    def __init__(self, rng, scale):
        self.seed = rng.randrange(1 << 30)
        self.scale = scale

    def _lattice(self, x, y):
        h = (x * 374761393 + y * 668265263 + self.seed * 1442695041) & 0xFFFFFFFF
        h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF
        return (h ^ (h >> 16)) / 0xFFFFFFFF

    def _value(self, x, y):
        xi, yi = math.floor(x), math.floor(y)
        xf, yf = x - xi, y - yi
        u, v = xf * xf * (3 - 2 * xf), yf * yf * (3 - 2 * yf)
        a, b = self._lattice(xi, yi), self._lattice(xi + 1, yi)
        c, d = self._lattice(xi, yi + 1), self._lattice(xi + 1, yi + 1)
        return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v

    def __call__(self, x, y):
        x, y = x / self.scale, y / self.scale
        return self._value(x, y) * 0.65 + self._value(x * 2.1 + 31.7, y * 2.1 + 11.3) * 0.35


def _paint_noise(g, noise, code, lo, hi, only):
    """Pinta `code` donde el ruido cae entre lo y hi (solo sobre los terrenos de `only`)."""
    for y in range(g.rows):
        for x in range(g.cols):
            if lo <= noise(x, y) < hi:
                g.set(x, y, code, only)


def _meander(g, rng, horizontal, wobble=0.35, start=None):
    """Puntos de una línea que cruza el mapa de un borde al opuesto, ondulando (ríos y caminos)."""
    length, across = (g.cols, g.rows) if horizontal else (g.rows, g.cols)
    pos = start if start is not None else rng.uniform(across * 0.3, across * 0.7)
    drift = 0.0
    pts = []
    for t in range(-1, length + 2, 2):
        drift = max(-1.2, min(1.2, drift + rng.uniform(-wobble, wobble) * 2))
        pos = max(2, min(across - 3, pos + drift))
        pts.append((t, pos) if horizontal else (pos, t))
    return pts


def _walk_ok(g, x, y):
    code = g.get(x, y)
    return code is not None and TERRAIN_COST[code] is not None and code not in HAZARD and (x, y) not in g.taken


def _reserve_path(g):
    """Abre y reserva caminos desde el grupo hasta cada casilla de inicio: nada se dispersa encima."""
    if not g.spawns["party"] or not g.spawns["enemies"]:
        return set()
    a = tuple(g.spawns["party"][0])
    floor = g.get(*a) if g.get(*a) not in (";", "K", "k") else ":"
    targets = [tuple(s) for side in ("enemies", "party") for s in g.spawns[side] if tuple(s) != a]
    for b in targets:
        g.connect(a, b, floor)
    prev, queue = {a: None}, deque([a])
    while queue:
        x, y = cur = queue.popleft()
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                n = (x + dx, y + dy)
                if n in prev or not _walk_ok(g, *n):
                    continue
                if dx and dy and not _walk_ok(g, x + dx, y) and not _walk_ok(g, x, y + dy):
                    continue
                prev[n] = cur
                queue.append(n)
    keep = set()
    for b in targets:
        cur = b if b in prev else None
        while cur and cur not in keep:
            keep.add(cur)
            cur = prev[cur]
    # un margen alrededor del camino y de las zonas de inicio, para que el paso no quede de una casilla
    for x, y in list(keep) + [a]:
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                keep.add((x + dx, y + dy))
    return keep


def _ends(g, rng):
    """Zonas de inicio a los dos lados del mapa (el grupo al oeste, los enemigos al este)."""
    my = g.rows // 2 + rng.randint(-2, 2)
    ey = g.rows // 2 + rng.randint(-3, 3)
    return (0, my - 2, 3, my + 2), (g.cols - 6, ey - 3, g.cols - 2, ey + 3)


def _finish(g, sid, name, lines, light, mood, threat):
    lines = [*lines, f"Lo que acecha: {threat}."]
    return g.scene(sid, name, "Clave (solo el máster):\n" + "\n".join(f"· {x}" for x in lines), light, mood)


# ------------------------------------------------------------------ biomas
@_kind("bosque", "Bosque profundo")
def _forest(g, seed):
    rng = g.rng
    n = _Noise(rng, 5)
    _paint_noise(g, n, ";", 0.62, 1, {","})
    _paint_noise(g, _Noise(rng, 4), "f", 0.66, 1, {","})
    _paint_noise(g, _Noise(rng, 3), "u", 0.74, 1, {",", "f"})
    road = _meander(g, rng, True)
    g.line(road, 1.6, ":")
    cx, cy = g.cols * rng.uniform(0.55, 0.7), g.rows * rng.uniform(0.35, 0.65)
    g.blob(cx, cy, 3.2, ",", {";", "f", "u"})
    p, e = _ends(g, rng)
    g.spawn_area("party", *p)
    g.spawn_area("enemies", int(cx) - 3, int(cy) - 3, int(cx) + 3, int(cy) + 3)
    keep = _reserve_path(g)
    clear = lambda x, y: (x, y) in keep or math.hypot(x - cx, y - cy) < 3.5 or g.get(x, y) == ":"
    trees = g.cols * g.rows // 14
    g.prop("T", int(cx) + 4, int(cy) - 4, 2, 2)
    g.scatter("T", trees, {",", ";", "f", "u"}, spacing=1, avoid=clear)
    g.scatter("P", trees // 3, {",", ";", "f"}, spacing=1, avoid=clear)
    g.scatter("arbol_otono", trees // 6, {",", "f"}, spacing=1, avoid=clear)
    g.scatter("b", trees // 2, {",", ";", "f"}, spacing=0, avoid=clear)
    g.scatter("x", 3, {",", "f", ";"}, w=2, spacing=1, avoid=clear)
    g.scatter("tocon", 4, {",", "f"}, spacing=1, avoid=clear)
    g.scatter("r", 4, {",", ";", "f"}, spacing=2, avoid=clear)
    g.scatter("helecho", 6, {",", "u", "f"}, spacing=0, avoid=lambda x, y: (x, y) in keep)
    g.scatter("setas", 4, {"u", "f"}, spacing=0, avoid=lambda x, y: (x, y) in keep)
    return _finish(g, f"bosque-{seed}", f"Bosque profundo {seed}",
                   ["Un sendero de tierra cruza el bosque de oeste a este.",
                    "La maleza es terreno difícil; los árboles dan cobertura de tres cuartos.",
                    "En el claro del este espera el encuentro."],
                   rng.choice(["penumbra", "dia"]), "natural",
                   rng.choice(["lobos hambrientos", "un oso lechuza", "bandidos emboscados en la maleza", "un dríada recelosa", "arañas gigantes en las copas"]))


@_kind("rio", "Vado del río")
def _ford(g, seed):
    rng = g.rng
    _paint_noise(g, _Noise(rng, 5), ";", 0.66, 1, {","})
    river = _meander(g, rng, False, start=g.cols * rng.uniform(0.42, 0.58))
    g.line(river, 4.2, "~")
    g.line(river, 2, "W", {"~"})
    # el vado: una franja donde el agua profunda se vuelve poco profunda
    fy = rng.randint(g.rows // 3, g.rows * 2 // 3)
    g.rect(0, fy - 1, g.cols - 1, fy + 1, "~", {"W"})
    # un puente de tablas más arriba o más abajo
    by = fy + (rng.choice([-1, 1]) * rng.randint(4, 6))
    by = max(2, min(g.rows - 3, by))
    g.rect(0, by, g.cols - 1, by, "=", {"~", "W"})
    for x in range(g.cols):  # juncos en la orilla
        for y in range(g.rows):
            if g.get(x, y) == "," and any(g.get(x + dx, y + dy) == "~" for dx in (-1, 0, 1) for dy in (-1, 0, 1)) and rng.random() < 0.35:
                g.set(x, y, "K")
    g.line([(-1, fy), (g.cols * 0.3, fy + rng.uniform(-1, 1)), (g.cols * 0.7, fy + rng.uniform(-1, 1)), (g.cols, fy)], 1.4, ":", {",", ";", "K"})
    p, e = _ends(g, rng)
    g.spawn_area("party", 0, fy - 2, 3, fy + 2)
    g.spawn_area("enemies", g.cols - 5, fy - 3, g.cols - 2, fy + 3)
    keep = _reserve_path(g)
    avoid = lambda x, y: (x, y) in keep or g.get(x, y) in (":", "=")
    g.scatter("r", 5, {"~"}, spacing=1, avoid=avoid)
    g.scatter("T", g.cols * g.rows // 40, {",", ";"}, spacing=2, avoid=avoid)
    g.scatter("b", g.cols * g.rows // 45, {",", ";"}, spacing=1, avoid=avoid)
    g.scatter("r", 3, {",", ";"}, spacing=2, avoid=avoid)
    g.scatter("nenufares", 3, {"~"}, spacing=1, avoid=avoid)
    return _finish(g, f"rio-{seed}", f"Vado del río {seed}",
                   ["El río corre de norte a sur; el centro es agua profunda (hay que nadar).",
                    "El vado y el puente de tablas son los únicos pasos a pie; el agua poco profunda es terreno difícil.",
                    "Las rocas del agua dan cobertura media."],
                   "dia", "natural",
                   rng.choice(["trolls bajo el puente", "una partida de gnolls al otro lado", "un cocodrilo gigante en el agua profunda", "guardias del peaje"]))


@_kind("cienaga", "Ciénaga")
def _swamp(g, seed):
    rng = g.rng
    g.rect(0, 0, g.cols - 1, g.rows - 1, "p")
    _paint_noise(g, _Noise(rng, 4), "~", 0.58, 1, {"p"})
    _paint_noise(g, _Noise(rng, 3), "W", 0.72, 1, {"~"})
    _paint_noise(g, _Noise(rng, 5), ",", 0.62, 1, {"p"})
    _paint_noise(g, _Noise(rng, 3), "P", 0.8, 1, {"p", "~"})
    for x in range(g.cols):
        for y in range(g.rows):
            if g.get(x, y) in ("p", ",") and any(g.get(x + dx, y + dy) in ("~", "W") for dx in (-1, 0, 1) for dy in (-1, 0, 1)) and rng.random() < 0.3:
                g.set(x, y, "K")
    walk = _meander(g, rng, True, wobble=0.25)
    g.line(walk, 1, "=", {"~", "W", "P"})
    g.line(walk, 1, ":", {"p", "K", ","})
    p, e = _ends(g, rng)
    g.spawn_area("party", *p)
    g.spawn_area("enemies", *e)
    keep = _reserve_path(g)
    avoid = lambda x, y: (x, y) in keep or g.get(x, y) in ("=", ":")
    g.scatter("arbol_muerto", g.cols * g.rows // 45, {"p", ",", "K"}, spacing=2, avoid=avoid)
    g.scatter("T", g.cols * g.rows // 90, {","}, spacing=2, avoid=avoid)
    g.scatter("x", 3, {"p", ","}, spacing=2, avoid=avoid)
    g.scatter("nenufares", 5, {"~"}, spacing=1, avoid=avoid)
    g.scatter("fuego_fatuo", 3, {"p", "~", ","}, spacing=3, avoid=avoid)
    g.scatter("M", 3, {",", "p"}, spacing=2, avoid=avoid)
    return _finish(g, f"cienaga-{seed}", f"Ciénaga {seed}",
                   ["Casi todo es barro y agua: terreno difícil. Una pasarela y un sendero cruzan de oeste a este.",
                    "Las manchas violáceas son ciénaga tóxica (peligro: CON CD 12 o envenenado).",
                    "Los fuegos fatuos dan algo de luz… y atraen a los incautos."],
                   "penumbra", "enfermizo",
                   rng.choice(["una bruja de los pantanos y sus sapos", "hombres lagarto", "un ahogado que no descansa", "un hidra joven", "mosquitos gigantes"]))


@_kind("desierto", "Dunas y oasis")
def _desert(g, seed):
    rng = g.rng
    g.rect(0, 0, g.cols - 1, g.rows - 1, "s")
    _paint_noise(g, _Noise(rng, 4), "G", 0.68, 1, {"s"})
    ox, oy = g.cols * rng.uniform(0.4, 0.6), g.rows * rng.uniform(0.35, 0.65)
    g.blob(ox, oy, 3.6, ",")
    g.blob(ox, oy, 2.0, "~")
    g.blob(ox, oy, 0.9, "W", {"~"})
    for _ in range(2):
        g.blob(rng.uniform(3, g.cols - 4), rng.uniform(2, g.rows - 3), rng.uniform(1, 1.6), "q", {"s"})
    p, e = _ends(g, rng)
    g.spawn_area("party", *p)
    g.spawn_area("enemies", *e)
    keep = _reserve_path(g)
    avoid = lambda x, y: (x, y) in keep
    g.scatter("palmera", 7, {","}, spacing=1, avoid=avoid)
    g.scatter("r", 3, {"s", "G"}, w=2, h=2, spacing=2, avoid=avoid)  # peñascos
    g.scatter("cactus", g.cols * g.rows // 70, {"s", "G"}, spacing=2, avoid=avoid)
    g.scatter("r", g.cols * g.rows // 70, {"s", "G"}, spacing=2, avoid=avoid)
    g.scatter("columna_rota", 3, {"s", "G"}, spacing=2, avoid=avoid)
    g.scatter("obelisco", 1, {"s"}, spacing=3, avoid=avoid)
    g.scatter("j", 3, {"s"}, spacing=2, avoid=avoid)
    return _finish(g, f"desierto-{seed}", f"Dunas y oasis {seed}",
                   ["Un oasis con palmeras en el centro: agua fresca, y el único sitio con sombra.",
                    "Los peñascos dan cobertura de tres cuartos; la grava no frena.",
                    "Cuidado con las arenas movedizas (peligro: FUE CD 12 o apresado)."],
                   "dia", "calido",
                   rng.choice(["un gusano púrpura joven bajo la arena", "jinetes nómadas", "una momia que despierta junto al obelisco", "escorpiones gigantes", "un genio enfadado"]))


@_kind("nieve", "Paso nevado")
def _snow(g, seed):
    rng = g.rng
    g.rect(0, 0, g.cols - 1, g.rows - 1, "n")
    # paredes del paso: roca arriba y abajo con un borde irregular
    top, bot = _Noise(rng, 3), _Noise(rng, 3)
    for x in range(g.cols):
        t = int(1 + top(x, 0) * g.rows * 0.22)
        b = int(1 + bot(x, 9) * g.rows * 0.22)
        g.rect(x, 0, x, t, "R")
        g.rect(x, g.rows - b - 1, x, g.rows - 1, "R")
    _paint_noise(g, _Noise(rng, 4), "k", 0.6, 1, {"n"})
    lx, ly = g.cols * rng.uniform(0.35, 0.65), g.rows * rng.uniform(0.4, 0.6)
    g.blob(lx, ly, 2.8, "i", {"n", "k"})
    p, e = _ends(g, rng)
    g.spawn_area("party", *p)
    g.spawn_area("enemies", *e)
    keep = _reserve_path(g)
    avoid = lambda x, y: (x, y) in keep
    g.scatter("P", g.cols * g.rows // 30, {"n", "k"}, spacing=1, avoid=avoid)
    g.scatter("r", g.cols * g.rows // 80, {"n", "k"}, spacing=2, avoid=avoid)
    g.scatter("arbol_muerto", 2, {"n"}, spacing=2, avoid=avoid)
    g.scatter("tocon", 3, {"n"}, spacing=1, avoid=avoid)
    if rng.random() < 0.6:
        g.scatter("F", 1, {"n"}, area=(1, 1, 8, g.rows - 2), spacing=1, avoid=avoid)
    return _finish(g, f"nieve-{seed}", f"Paso nevado {seed}",
                   ["Un paso de montaña entre paredes de roca.",
                    "La nieve profunda es terreno difícil; el lago helado también (resbala: DES CD 10 o derribado).",
                    "Los pinos dan cobertura de tres cuartos."],
                   "dia", "frio",
                   rng.choice(["un yeti", "lobos invernales", "un remorhaz bajo el hielo", "gigantes de escarcha de caza", "un ogro con un saco de botín"]))


@_kind("costa", "Playa y acantilado")
def _coast(g, seed):
    rng = g.rng
    shore = _Noise(rng, 4)
    for y in range(g.rows):
        edge = g.cols * (0.3 + shore(0, y) * 0.18)  # el mar entra por el oeste
        for x in range(g.cols):
            d = x - edge
            g.set(x, y, "W" if d < -3 else "~" if d < -1 else "s" if d < 3 else ",")
    _paint_noise(g, _Noise(rng, 4), ";", 0.66, 1, {","})
    # acantilado de roca al este, con un paso
    cliff = _Noise(rng, 3)
    gap = rng.randint(g.rows // 3, g.rows * 2 // 3)
    for y in range(g.rows):
        if abs(y - gap) <= 1:
            continue
        x0 = int(g.cols * (0.72 + cliff(y, 0) * 0.08))
        g.rect(x0, y, x0 + 1, y, "R")
    for _ in range(3):  # charcas de marea
        g.blob(rng.uniform(g.cols * 0.32, g.cols * 0.45), rng.uniform(2, g.rows - 3), 0.9, "~", {"s"})
    g.spawn_area("party", int(g.cols * 0.36), gap - 3, int(g.cols * 0.48), gap + 3)
    g.spawn_area("enemies", g.cols - 6, gap - 3, g.cols - 2, gap + 3)
    keep = _reserve_path(g)
    avoid = lambda x, y: (x, y) in keep
    g.scatter("barca", 1, {"s", "~"}, w=2, spacing=1, avoid=avoid)
    g.scatter("C", 3, {"s"}, spacing=1, avoid=avoid)
    g.scatter("B", 2, {"s"}, spacing=1, avoid=avoid)
    g.scatter("redes", 1, {"s"}, spacing=1, avoid=avoid)
    g.scatter("r", 6, {"~", "s"}, spacing=2, avoid=avoid)
    g.scatter("palmera", 4, {"s", ","}, spacing=2, avoid=avoid)
    g.scatter("T", g.cols * g.rows // 70, {",", ";"}, spacing=2, avoid=avoid)
    g.scatter("b", g.cols * g.rows // 70, {",", ";"}, spacing=1, avoid=avoid)
    return _finish(g, f"costa-{seed}", f"Playa y acantilado {seed}",
                   ["El mar al oeste: agua profunda más allá de la rompiente.",
                    "Restos de un naufragio en la arena (cajas y barriles: cobertura media).",
                    "Un único paso atraviesa el acantilado del este."],
                   "dia", "natural",
                   rng.choice(["contrabandistas", "sahuagines saliendo del agua", "un cangrejo gigante", "piratas que vuelven a por su botín", "una arpía en el acantilado"]))


@_kind("ruinas", "Ruinas en el bosque")
def _ruins(g, seed):
    rng = g.rng
    _paint_noise(g, _Noise(rng, 5), ";", 0.62, 1, {","})
    w, h = rng.randint(g.cols // 3, g.cols // 2), rng.randint(g.rows // 2, g.rows * 2 // 3)
    x0, y0 = rng.randint(g.cols // 3, g.cols - w - 2), rng.randint(1, g.rows - h - 1)
    g.rect(x0, y0, x0 + w - 1, y0 + h - 1, ".")
    g.frame(x0, y0, x0 + w - 1, y0 + h - 1, "#")
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            if g.get(x, y) == "#" and rng.random() < 0.38:
                g.set(x, y, "%")
    g.rect(x0, y0 + h // 2 - 1, x0, y0 + h // 2, "%")  # la entrada derrumbada del oeste
    inner = lambda x, y: x0 < x < x0 + w - 1 and y0 < y < y0 + h - 1
    _paint_noise(g, _Noise(rng, 2), ",", 0.66, 1, {"."})
    _paint_noise(g, _Noise(rng, 2), "u", 0.74, 1, {"."})
    g.prop("Y", x0 + w - 3, y0 + h // 2 - 1, 1, 2)
    g.prop("E", x0 + w - 3, y0 + 1)
    g.prop("E", x0 + w - 3, y0 + h - 2)
    p, _ = _ends(g, rng)
    g.spawn_area("party", *p)
    g.spawn_area("enemies", x0 + w - 7, y0 + h // 2 - 2, x0 + w - 4, y0 + h // 2 + 2)
    keep = _reserve_path(g)
    avoid = lambda x, y: (x, y) in keep
    for x in range(x0 + 2, x0 + w - 4, 3):
        for y in (y0 + 2, y0 + h - 3):
            if (x, y) not in keep and g.walkable(x, y):
                if rng.random() < 0.3:
                    g.prop("columna_rota", x, y)
                else:
                    g.prop("O", x, y)
    g.scatter("r", 3, {".", ","}, spacing=1, avoid=lambda x, y: avoid(x, y) or not inner(x, y))
    g.scatter("y", 3, {"."}, spacing=1, avoid=lambda x, y: avoid(x, y) or not inner(x, y))
    g.scatter("T", g.cols * g.rows // 35, {",", ";"}, spacing=1, avoid=lambda x, y: avoid(x, y) or (x0 - 1 <= x <= x0 + w and y0 - 1 <= y <= y0 + h))
    g.scatter("b", g.cols * g.rows // 40, {",", ";"}, spacing=1, avoid=lambda x, y: avoid(x, y) or inner(x, y))
    g.scatter("L", 2, {"."}, spacing=2, avoid=lambda x, y: avoid(x, y) or not inner(x, y))
    return _finish(g, f"ruinas-{seed}", f"Ruinas en el bosque {seed}",
                   ["Un templo antiguo con los muros medio caídos (los escombros son terreno difícil).",
                    "Las columnas dan cobertura total; el altar del fondo conserva algo de poder.",
                    "Dos braseros encendidos: alguien ha estado aquí hace poco."],
                   "penumbra", "misterio",
                   rng.choice(["cultistas en plena ceremonia", "un espectro atado al altar", "gárgolas que despiertan", "un basilisco", "trasgos saqueadores"]))


@_kind("volcan", "Campo de lava")
def _volcano(g, seed):
    rng = g.rng
    g.rect(0, 0, g.cols - 1, g.rows - 1, "a")
    _paint_noise(g, _Noise(rng, 4), "%", 0.66, 1, {"a"})
    for _ in range(2):
        flow = _meander(g, rng, False, wobble=0.45, start=rng.uniform(g.cols * 0.3, g.cols * 0.75))
        g.line(flow, rng.uniform(1.4, 2.4), "l", {"a", "%"})
    g.blob(rng.uniform(g.cols * 0.4, g.cols * 0.7), rng.uniform(3, g.rows - 4), 2.2, "l", {"a", "%"})
    p, e = _ends(g, rng)
    g.spawn_area("party", *p)
    g.spawn_area("enemies", *e)
    keep = _reserve_path(g)
    avoid = lambda x, y: (x, y) in keep
    g.scatter("brasas", 5, {"a"}, spacing=2, avoid=avoid)
    g.scatter("r", 3, {"a", "%"}, w=2, h=2, spacing=2, avoid=avoid)  # peñascos de basalto
    g.scatter("r", g.cols * g.rows // 60, {"a", "%"}, spacing=2, avoid=avoid)
    g.scatter("piedras", 5, {"a", "%"}, spacing=1, avoid=avoid)
    g.scatter("Q", 3, {"a", "%"}, spacing=3, avoid=avoid)
    g.scatter("arbol_muerto", 3, {"a"}, spacing=2, avoid=avoid)
    g.scatter("j", 4, {"a", "%"}, spacing=1, avoid=avoid)
    return _finish(g, f"volcan-{seed}", f"Campo de lava {seed}",
                   ["Ríos de lava cruzan el campo (peligro: 10d10 de fuego al entrar; el calor se nota a 1,5 m).",
                    "Los pedregales son terreno difícil; los peñascos de basalto dan cobertura.",
                    "Los cristales de obsidiana brillan en la oscuridad."],
                   "noche", "infernal",
                   rng.choice(["salamandras", "un dragón rojo joven", "mefits de magma", "azers forjadores", "un elemental de fuego desatado"]))
