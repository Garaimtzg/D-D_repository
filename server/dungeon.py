"""Mazmorras al azar para el tablero, al estilo de donjon o del «One Page Dungeon» de watabou.

Salas rectangulares unidas por pasillos (un árbol de expansión mínima más algún bucle), puertas donde
el pasillo entra en una sala y un contenido para cada sala según su papel: entrada, guarida del jefe,
biblioteca, cripta, almacén, santuario, cuartel, derrumbe, charca o sala con trampas. También hay
cuevas, hechas con el autómata celular de los escenarios. Devuelve un escenario como los prediseñados,
con la clave de las salas en la descripción. La misma semilla da siempre la misma mazmorra.
"""
import math
import random

from .scenes import _Grid

SIZES = {"pequena": (30, 22, 6), "mediana": (40, 28, 9), "grande": (52, 36, 13)}

# papel: (nombre, qué hay, objetos [(código, cuántos)], suelo especial)
ROOMS = [
    ("biblioteca", "Biblioteca polvorienta", "Estanterías con libros podridos; un tomo útil (Investigación CD 13).", [("q", 4), ("t", 1), ("h", 2)]),
    ("cripta", "Cripta", "Sarcófagos sellados; uno está vacío.", [("Z", 3), ("j", 3), ("y", 2)]),
    ("almacen", "Almacén", "Barriles y cajas; raciones, aceite y cuerda.", [("B", 3), ("C", 4), ("S", 2)]),
    ("santuario", "Santuario profanado", "Un altar manchado y dos estatuas con los rostros borrados.", [("Y", 1), ("E", 2), ("L", 1)]),
    ("cuartel", "Cuartel", "Camastros, una mesa con dados y restos de comida.", [("k", 3), ("t", 1), ("h", 2)]),
    ("derrumbe", "Sala derrumbada", "El techo se vino abajo: escombros y polvo (terreno difícil).", [("j", 2)]),
    ("charca", "Sala inundada", "Agua estancada hasta las rodillas (terreno difícil).", [("y", 1)]),
    ("trampas", "Pasillo de las trampas", "Placas de presión ocultas (Percepción CD 15; DES CD 13 o 2d6 perforante).", [("j", 2)]),
    ("forja", "Forja abandonada", "Un yunque frío y herramientas oxidadas.", [("n", 1), ("L", 1), ("B", 1)]),
    ("celdas", "Celdas", "Jaulas oxidadas; en una hay un prisionero o unos huesos.", [("g", 3), ("j", 2)]),
]
TREASURE = ["un cofre con 2d6 × 10 po", "una gema de 50 po bajo una losa suelta", "una poción de curación",
            "un pergamino de conjuro de nivel 1", "un arma bien forjada", "un saco con 3d6 × 10 pp"]
MONSTERS = ["guardianes", "no muertos", "un cubo gelatinoso", "goblins", "una bestia hambrienta", "cultistas", "arañas gigantes"]


def generate(seed=None, size="mediana", kind="mazmorra"):
    seed = seed if seed not in (None, "") else random.randrange(1, 10**6)
    cols, rows, n_rooms = SIZES.get(size, SIZES["mediana"])
    return (_cave if kind == "cueva" else _rooms)(int(seed), cols, rows, n_rooms)


def _rooms(seed, cols, rows, n_rooms):
    g = _Grid(cols, rows, "#", seed)
    rng = g.rng
    rooms = []
    for _ in range(400):
        if len(rooms) >= n_rooms:
            break
        w, h = rng.randint(4, 8), rng.randint(4, 7)
        x, y = rng.randint(1, cols - w - 2), rng.randint(1, rows - h - 2)
        if all(x > r[0] + r[2] + 1 or r[0] > x + w + 1 or y > r[1] + r[3] + 1 or r[1] > y + h + 1 for r in rooms):
            rooms.append((x, y, w, h))
    for x, y, w, h in rooms:
        g.rect(x, y, x + w - 1, y + h - 1, ".")
    center = lambda r: (r[0] + r[2] // 2, r[1] + r[3] // 2)
    # árbol de expansión mínima (Prim) y un par de bucles para que no todo sea lineal
    linked, edges = {0}, []
    while len(linked) < len(rooms):
        a, b = min(((i, j) for i in linked for j in range(len(rooms)) if j not in linked),
                   key=lambda e: math.dist(center(rooms[e[0]]), center(rooms[e[1]])))
        edges.append((a, b))
        linked.add(b)
    extra = [(i, j) for i in range(len(rooms)) for j in range(i + 1, len(rooms)) if (i, j) not in edges and (j, i) not in edges]
    rng.shuffle(extra)
    edges += sorted(extra, key=lambda e: math.dist(center(rooms[e[0]]), center(rooms[e[1]])))[:max(1, len(rooms) // 4)]
    inside = lambda c, r: any(x <= c < x + w and y <= r < y + h for x, y, w, h in rooms)
    lanes = set()  # el camino de cada pasillo, también dentro de las salas: ahí no se ponen muebles
    for a, b in edges:
        (x0, y0), (x1, y1) = center(rooms[a]), center(rooms[b])
        path = [(x, y0) for x in _span(x0, x1)] + [(x1, y) for y in _span(y0, y1)] if rng.random() < 0.5 \
            else [(x0, y) for y in _span(y0, y1)] + [(x, y1) for x in _span(x0, x1)]
        lanes.update(path)
        for x, y in path:
            if not inside(x, y):
                g.set(x, y, ".")
    # puertas: donde un pasillo toca una sala y tiene muro a los dos lados
    for x, y, w, h in rooms:
        ring = [(c, y - 1) for c in range(x, x + w)] + [(c, y + h) for c in range(x, x + w)] \
            + [(x - 1, r) for r in range(y, y + h)] + [(x + w, r) for r in range(y, y + h)]
        for c, r in ring:
            if g.get(c, r) != "." or inside(c, r):
                continue
            horiz = g.get(c - 1, r) == "#" and g.get(c + 1, r) == "#"
            vert = g.get(c, r - 1) == "#" and g.get(c, r + 1) == "#"
            if (horiz or vert) and rng.random() < 0.75:
                g.set(c, r, "D")
    # papeles: entrada, guarida del jefe (la más lejana) y el resto al azar
    order = sorted(range(len(rooms)), key=lambda i: center(rooms[i])[0])
    entrance = order[0]
    boss = max(range(len(rooms)), key=lambda i: math.dist(center(rooms[i]), center(rooms[entrance])))
    kinds = rng.sample(ROOMS, k=min(len(ROOMS), len(rooms)))
    free = lambda c, r: any((c + dx, r + dy) in lanes for dx in (-1, 0, 1) for dy in (-1, 0, 1))
    key, k_i = [], 0
    for n, i in enumerate(sorted(range(len(rooms)), key=lambda i: (i != entrance, i != boss, center(rooms[i]))), 1):
        x, y, w, h = rooms[i]
        area = (x, y, x + w - 1, y + h - 1)
        n = f"{n} ({_where(center(rooms[i]), cols, rows)})"
        if i == entrance:
            g.set(x, y + h // 2, "S")
            g.spawn_area("party", *area)
            key.append(f"{n}. Entrada: escaleras que bajan desde la superficie.")
            g.prop("a", x, y)
            continue
        if i == boss:
            g.spawn_area("enemies", *area)
            g.scatter("K", 1, {"."}, area=area, spacing=0, avoid=free)
            g.scatter("O", 2 if w * h > 30 else 0, {"."}, area=area, spacing=1, avoid=free)
            key.append(f"{n}. Guarida del jefe: {rng.choice(MONSTERS)} y {rng.choice(TREASURE)}.")
            for c, r in ((x, y), (x + w - 1, y)):
                g.prop("a", c, r)
            continue
        role, title, text, props = kinds[k_i % len(kinds)]
        k_i += 1
        if role == "derrumbe":
            g.blob(x + w / 2, y + h / 2, min(w, h) / 2, "%", {"."})
        elif role == "charca":
            g.blob(x + w / 2, y + h / 2, min(w, h) / 2.2, "~", {"."})
        elif role == "trampas":
            g.scatter("N", 3, {"."}, area=area, spacing=0)
        for code, count in props:
            g.scatter(code, count, {".", "%", "~"}, area=area, spacing=0, avoid=free)
        extra_note = f" Hay {rng.choice(MONSTERS)}." if rng.random() < 0.35 else ""
        loot = f" Escondido: {rng.choice(TREASURE)}." if rng.random() < 0.3 else ""
        key.append(f"{n}. {title}: {text}{extra_note}{loot}")
    g.scatter("a", len(rooms), {"."}, spacing=2)
    return _custom(g.scene(f"mazmorra-{seed}", f"Mazmorra {seed}", "Clave de las salas (solo el máster):\n" + "\n".join(key), "oscuridad"), seed)


def _cave(seed, cols, rows, n_rooms):
    g = _Grid(cols, rows, "R", seed)
    g.cave("R", ":", fill=0.45)
    open_cells = g.open_cells({":"})
    if not open_cells:
        return _rooms(seed, cols, rows, n_rooms)
    left = min(open_cells, key=lambda c: c[0])
    right = max(open_cells, key=lambda c: c[0])
    g.blob(cols * 0.5, rows * 0.5, 2.2, "~", {":"})
    g.noise("%", 0.04, {":"})
    g.scatter("M", 4, {":"}, spacing=1)
    g.scatter("Q", 3, {":"}, spacing=2)
    g.scatter("j", 5, {":"}, spacing=0)
    g.scatter("y", 3, {":"}, spacing=1)
    g.spawn_area("party", left[0] - 2, left[1] - 2, left[0] + 2, left[1] + 2)
    g.spawn_area("enemies", right[0] - 2, right[1] - 2, right[0] + 2, right[1] + 2)
    if g.walkable(*right):
        g.prop("X", *right)
    if g.spawns["party"] and g.spawns["enemies"]:
        g.connect(g.spawns["party"][0], g.spawns["enemies"][0], ":")
    rng = g.rng
    key = [f"Entrada al oeste. En el fondo, al este: {rng.choice(MONSTERS)} junto a {rng.choice(TREASURE)}.",
           "Los cristales dan algo de luz; el agua es poco profunda (terreno difícil)."]
    return _custom(g.scene(f"cueva-{seed}", f"Cueva {seed}", "Clave (solo el máster):\n" + "\n".join(key), "oscuridad"), seed)


def _custom(sc, seed):
    """Un escenario propio (sin id: lo pone el almacén al guardarlo)."""
    sc.pop("id")
    return {**sc, "preset": False, "seed": seed}


def _where(c, cols, rows):
    """Dónde cae una sala en el mapa, para encontrarla con la clave: «noroeste», «centro»…"""
    ns = "norte" if c[1] < rows / 3 else "sur" if c[1] > rows * 2 / 3 else ""
    ew = "oeste" if c[0] < cols / 3 else "este" if c[0] > cols * 2 / 3 else ""
    return (ns + ew if ns and ew else ns or ew) or "centro"


def _span(a, b):
    return range(a, b + 1) if a <= b else range(a, b - 1, -1)
