"""Escenarios de combate sobre cuadrícula (casillas de 1,5 m, como en el Manual del Jugador 2024).

Un escenario guarda `tiles`, una cadena de cols × rows códigos de terreno (fila a fila), y `props`,
los objetos colocados encima. Este módulo define el catálogo de terrenos y objetos con sus reglas
(coste de movimiento, cobertura, luz) y los escenarios prediseñados. Los prediseñados se construyen
con un pequeño constructor determinista (misma semilla, mismo mapa) para que sean fáciles de leer,
de retocar y de comprobar en los tests.
"""
import heapq
import math
import random

# código: (nombre, coste, tipo)  coste 1 = normal, 2 = terreno difícil, None = no se puede pisar
TERRAIN = [
    (".", "Losas de piedra", 1, "suelo"),
    ("c", "Adoquines", 1, "suelo"),
    ("w", "Tablones de madera", 1, "suelo"),
    ("m", "Alfombra", 1, "suelo"),
    ("b", "Mármol ajedrezado", 1, "suelo"),
    ("o", "Mosaico", 1, "suelo"),
    ("J", "Tarima o estrado", 1, "suelo"),
    ("X", "Rejilla de hierro", 1, "suelo"),
    ("y", "Tablones rotos", 2, "suelo"),
    ("S", "Escaleras", 1, "suelo"),
    ("D", "Puerta", 1, "suelo"),
    ("=", "Puente o pasarela", 1, "suelo"),
    (",", "Hierba", 1, "natural"),
    ("j", "Flores", 1, "natural"),
    ("u", "Musgo", 1, "natural"),
    (":", "Tierra", 1, "natural"),
    ("e", "Campo arado", 1, "natural"),
    ("f", "Hojarasca", 1, "natural"),
    ("G", "Grava", 1, "natural"),
    ("s", "Arena", 1, "natural"),
    ("a", "Ceniza", 1, "natural"),
    ("n", "Nieve", 1, "natural"),
    ("k", "Nieve profunda", 2, "natural"),
    (";", "Maleza", 2, "natural"),
    ("r", "Raíces", 2, "natural"),
    ("K", "Juncos", 2, "natural"),
    ("%", "Escombros", 2, "natural"),
    ("p", "Barro", 2, "natural"),
    ("i", "Hielo", 2, "natural"),
    ("~", "Agua poco profunda", 2, "agua"),
    ("W", "Agua profunda", 2, "agua"),
    ("l", "Lava", 2, "peligro"),
    ("A", "Ácido", 2, "peligro"),
    ("P", "Ciénaga tóxica", 2, "peligro"),
    ("q", "Arenas movedizas", 2, "peligro"),
    ("v", "Abismo", None, "vacio"),
    ("#", "Muro de piedra", None, "muro"),
    ("B", "Muro de ladrillo", None, "muro"),
    ("H", "Pared de madera", None, "muro"),
    ("F", "Empalizada", None, "muro"),
    ("h", "Seto", None, "muro"),
    ("L", "Muro de hielo", None, "muro"),
    ("R", "Roca", None, "muro"),
    ("_", "Sin terreno (imagen de fondo)", 1, "suelo"),
]
TERRAIN_CODES = {t[0] for t in TERRAIN}
TERRAIN_COST = {t[0]: t[2] for t in TERRAIN}
HAZARD = {"l", "A", "P", "q"}

# código: (nombre, efecto, cobertura, radio de luz en casillas, oculto por defecto, grupo del editor)
#   efecto: bloquea (no se puede entrar), dificil (terreno difícil), peligro o nada
_N, _M, _K, _B, _T, _D, _F, _E, _R, _G, _S = ("Naturaleza", "Mobiliario", "Taberna y cocina", "Biblioteca y magia", "Piedra y templo",
                                             "Mazmorra", "Fuego y luz", "Exteriores y aldea", "Mar y río", "Guerra", "Secretos y trampas")
PROPS = [
    # naturaleza
    ("T", "Árbol", "bloquea", "tres cuartos", 0, False, _N),
    ("arbol_otono", "Árbol otoñal", "bloquea", "tres cuartos", 0, False, _N),
    ("P", "Pino", "bloquea", "tres cuartos", 0, False, _N),
    ("palmera", "Palmera", "bloquea", "media", 0, False, _N),
    ("arbol_muerto", "Árbol muerto", "bloquea", "media", 0, False, _N),
    ("tocon", "Tocón", "dificil", "media", 0, False, _N),
    ("b", "Arbusto", "dificil", "media", 0, False, _N),
    ("helecho", "Helechos", "dificil", "", 0, False, _N),
    ("x", "Tronco caído", "dificil", "media", 0, False, _N),
    ("r", "Roca", "bloquea", "tres cuartos", 0, False, _N),
    ("piedras", "Piedras sueltas", "dificil", "", 0, False, _N),
    ("estalagmita", "Estalagmita", "bloquea", "media", 0, False, _N),
    ("cactus", "Cactus", "bloquea", "media", 0, False, _N),
    ("M", "Seta gigante", "bloquea", "media", 0, False, _N),
    ("setas", "Setas pequeñas", "nada", "", 0, False, _N),
    ("flores", "Flores", "nada", "", 0, False, _N),
    ("nenufares", "Nenúfares", "nada", "", 0, False, _N),
    ("charco", "Charco", "nada", "", 0, False, _N),
    ("nido", "Nido", "dificil", "", 0, False, _N),
    ("Q", "Cristal", "bloquea", "media", 3, False, _N),
    # mobiliario
    ("t", "Mesa", "dificil", "media", 0, False, _M),
    ("mesa_redonda", "Mesa redonda", "dificil", "media", 0, False, _M),
    ("h", "Silla", "dificil", "", 0, False, _M),
    ("taburete", "Taburete", "nada", "", 0, False, _M),
    ("banco", "Banco", "dificil", "media", 0, False, _M),
    ("trono", "Trono", "bloquea", "media", 0, False, _M),
    ("k", "Cama", "dificil", "", 0, False, _M),
    ("armario", "Armario", "bloquea", "tres cuartos", 0, False, _M),
    ("q", "Estantería", "bloquea", "tres cuartos", 0, False, _M),
    ("escritorio", "Escritorio", "bloquea", "media", 0, False, _M),
    ("alfombra", "Alfombra (bajo los muebles)", "nada", "", 0, False, _M),
    ("banera", "Bañera", "bloquea", "media", 0, False, _M),
    ("biombo", "Biombo", "bloquea", "media", 0, False, _M),
    ("espejo", "Espejo", "bloquea", "", 0, False, _M),
    ("jarron", "Jarrón", "bloquea", "", 0, False, _M),
    ("maceta", "Maceta", "bloquea", "", 0, False, _M),
    ("C", "Caja", "bloquea", "media", 0, False, _M),
    # taberna y cocina
    ("z", "Mostrador", "bloquea", "media", 0, False, _K),
    ("B", "Barril", "bloquea", "media", 0, False, _K),
    ("tonel", "Tonel", "bloquea", "media", 0, False, _K),
    ("S", "Sacos", "dificil", "media", 0, False, _K),
    ("jarras", "Jarras y botellas", "dificil", "", 0, False, _K),
    ("comida", "Comida", "nada", "", 0, False, _K),
    ("caldero", "Caldero burbujeante", "bloquea", "media", 1, False, _K),
    ("horno", "Horno", "bloquea", "media", 2, False, _K),
    ("chimenea", "Chimenea (junto a un muro)", "bloquea", "", 4, False, _K),
    # biblioteca y magia
    ("libros", "Pila de libros", "dificil", "", 0, False, _B),
    ("atril", "Atril con libro", "bloquea", "", 0, False, _B),
    ("alquimia", "Mesa de alquimia", "bloquea", "media", 1, False, _B),
    ("bola_cristal", "Bola de cristal", "bloquea", "", 2, False, _B),
    ("telescopio", "Telescopio", "bloquea", "", 0, False, _B),
    ("runas", "Círculo rúnico", "nada", "", 2, False, _B),
    ("portal", "Portal mágico", "nada", "", 3, False, _B),
    # piedra y templo
    ("O", "Columna", "bloquea", "total", 0, False, _T),
    ("columna_rota", "Columna rota", "dificil", "media", 0, False, _T),
    ("obelisco", "Obelisco", "bloquea", "total", 0, False, _T),
    ("E", "Estatua", "bloquea", "tres cuartos", 0, False, _T),
    ("gargola", "Gárgola", "bloquea", "tres cuartos", 0, False, _T),
    ("Y", "Altar", "bloquea", "media", 0, False, _T),
    ("pila", "Pila de agua bendita", "bloquea", "media", 0, False, _T),
    ("campana", "Campana", "bloquea", "media", 0, False, _T),
    ("Z", "Sarcófago", "bloquea", "media", 0, False, _T),
    ("urna", "Urna funeraria", "bloquea", "media", 0, False, _T),
    ("G", "Lápida", "bloquea", "media", 0, False, _T),
    # mazmorra
    ("K", "Cofre", "bloquea", "media", 0, False, _D),
    ("X", "Tesoro", "dificil", "", 0, False, _D),
    ("g", "Jaula", "bloquea", "media", 0, False, _D),
    ("reja", "Reja", "bloquea", "media", 0, False, _D),
    ("cepo", "Cepo", "bloquea", "media", 0, False, _D),
    ("cadenas", "Cadenas", "nada", "", 0, False, _D),
    ("ataud", "Ataúd", "bloquea", "media", 0, False, _D),
    ("j", "Huesos", "nada", "", 0, False, _D),
    ("calaveras", "Montón de calaveras", "dificil", "", 0, False, _D),
    ("sangre", "Sangre", "nada", "", 0, False, _D),
    ("y", "Telaraña", "dificil", "", 0, False, _D),
    ("huevos", "Huevos de dragón", "dificil", "", 0, False, _D),
    # fuego y luz
    ("F", "Hoguera", "peligro", "", 6, False, _F),
    ("brasas", "Brasas", "peligro", "", 2, False, _F),
    ("L", "Brasero", "bloquea", "", 5, False, _F),
    ("a", "Antorcha", "nada", "", 4, False, _F),
    ("velas", "Candelabro", "nada", "", 3, False, _F),
    ("lampara", "Lámpara de aceite", "nada", "", 3, False, _F),
    ("farola", "Farola", "bloquea", "", 5, False, _F),
    ("forja", "Forja", "bloquea", "media", 3, False, _F),
    ("fuego_fatuo", "Fuego fatuo", "nada", "", 2, False, _F),
    # exteriores y aldea
    ("u", "Tienda de campaña", "bloquea", "total", 0, False, _E),
    ("puesto", "Puesto de mercado", "bloquea", "media", 0, False, _E),
    ("V", "Carro", "bloquea", "tres cuartos", 0, False, _E),
    ("carretilla", "Carretilla", "bloquea", "media", 0, False, _E),
    ("f", "Fuente", "bloquea", "media", 0, False, _E),
    ("o", "Pozo", "bloquea", "media", 0, False, _E),
    ("abrevadero", "Abrevadero", "bloquea", "media", 0, False, _E),
    ("valla", "Valla de madera", "bloquea", "media", 0, False, _E),
    ("muro_bajo", "Muro bajo", "dificil", "media", 0, False, _E),
    ("heno", "Bala de paja", "bloquea", "media", 0, False, _E),
    ("lena", "Pila de leña", "bloquea", "media", 0, False, _E),
    ("calabazas", "Calabazas", "dificil", "", 0, False, _E),
    ("espantapajaros", "Espantapájaros", "bloquea", "", 0, False, _E),
    ("cartel", "Poste indicador", "bloquea", "", 0, False, _E),
    ("n", "Yunque", "bloquea", "media", 0, False, _E),
    # mar y río
    ("barca", "Barca", "bloquea", "media", 0, False, _R),
    ("e", "Mástil", "bloquea", "total", 0, False, _R),
    ("timon", "Timón", "bloquea", "", 0, False, _R),
    ("ancla", "Ancla", "dificil", "", 0, False, _R),
    ("redes", "Redes de pesca", "dificil", "", 0, False, _R),
    ("cuerda", "Rollo de cuerda", "dificil", "", 0, False, _R),
    # guerra
    ("A", "Cañón", "bloquea", "media", 0, False, _G),
    ("catapulta", "Catapulta", "bloquea", "tres cuartos", 0, False, _G),
    ("balista", "Balista", "bloquea", "media", 0, False, _G),
    ("barricada", "Barricada", "bloquea", "tres cuartos", 0, False, _G),
    ("armero", "Armero", "bloquea", "media", 0, False, _G),
    ("diana", "Diana", "bloquea", "", 0, False, _G),
    ("maniqui", "Muñeco de prácticas", "bloquea", "media", 0, False, _G),
    ("estandarte", "Estandarte", "nada", "", 0, False, _G),
    ("armas", "Armas caídas", "nada", "", 0, False, _G),
    # secretos y trampas
    ("N", "Trampa", "nada", "", 0, True, _S),
    ("placa", "Placa de presión", "nada", "", 0, True, _S),
    ("dardos", "Trampa de dardos", "nada", "", 0, True, _S),
    ("puerta_secreta", "Puerta secreta", "nada", "", 0, True, _S),
    ("foso", "Foso de pinchos", "peligro", "", 0, False, _S),
    ("trampilla", "Trampilla", "nada", "", 0, False, _S),
    ("palanca", "Palanca", "nada", "", 0, False, _S),
]
PROP_CODES = {p[0] for p in PROPS}
BLOCKING = {p[0] for p in PROPS if p[2] == "bloquea"}
PROP_GROUPS = list(dict.fromkeys(p[6] for p in PROPS))

LIGHTS = [
    ("dia", "Pleno día"),
    ("penumbra", "Penumbra"),
    ("noche", "Noche (luz de las llamas)"),
    ("oscuridad", "Oscuridad total"),
]


# ------------------------------------------------------------------ constructor
class _Grid:
    def __init__(self, cols, rows, fill, seed):
        self.cols, self.rows = cols, rows
        self.t = [[fill] * cols for _ in range(rows)]
        self.props = []
        self.taken = set()
        self.spawns = {"party": [], "enemies": []}
        self.rng = random.Random(seed)

    def inside(self, x, y):
        return 0 <= x < self.cols and 0 <= y < self.rows

    def get(self, x, y):
        return self.t[y][x] if self.inside(x, y) else None

    def set(self, x, y, code, only=None):
        if self.inside(x, y) and (only is None or self.t[y][x] in only):
            self.t[y][x] = code

    def rect(self, x0, y0, x1, y1, code, only=None):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.set(x, y, code, only)

    def frame(self, x0, y0, x1, y1, code):
        for x in range(x0, x1 + 1):
            self.set(x, y0, code)
            self.set(x, y1, code)
        for y in range(y0, y1 + 1):
            self.set(x0, y, code)
            self.set(x1, y, code)

    def blob(self, cx, cy, r, code, only=None):
        """Mancha de bordes irregulares (charcas, claros, montones de escombros…)."""
        for y in range(int(cy - r - 2), int(cy + r + 3)):
            for x in range(int(cx - r - 2), int(cx + r + 3)):
                if math.hypot(x - cx, y - cy) <= r + self.rng.uniform(-0.7, 0.5):
                    self.set(x, y, code, only)

    def line(self, pts, width, code, only=None):
        """Trazo grueso por varios puntos (caminos, ríos, grietas de lava)."""
        rad = width / 2
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            steps = int(max(abs(x1 - x0), abs(y1 - y0)) * 3) or 1
            for i in range(steps + 1):
                px, py = x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps
                for y in range(int(py - rad - 1), int(py + rad + 2)):
                    for x in range(int(px - rad - 1), int(px + rad + 2)):
                        if math.hypot(x + 0.5 - (px + 0.5), y + 0.5 - (py + 0.5)) <= rad:
                            self.set(x, y, code, only)

    def noise(self, code, p, only):
        for y in range(self.rows):
            for x in range(self.cols):
                if self.t[y][x] in only and self.rng.random() < p:
                    self.t[y][x] = code

    def stamp(self, x0, y0, text):
        """Dibuja un bloque de texto; el espacio deja la casilla como estaba."""
        for dy, row in enumerate(text.strip("\n").split("\n")):
            for dx, ch in enumerate(row):
                if ch != " ":
                    self.set(x0 + dx, y0 + dy, ch)

    def stamp_props(self, x0, y0, text):
        """Objetos en forma de texto: '.' nada, '1' inicio del grupo, '2' inicio de los enemigos."""
        for dy, row in enumerate(text.strip("\n").split("\n")):
            for dx, ch in enumerate(row):
                x, y = x0 + dx, y0 + dy
                if ch == "1":
                    self.spawns["party"].append([x, y])
                elif ch == "2":
                    self.spawns["enemies"].append([x, y])
                elif ch != ".":
                    self.prop(ch, x, y)

    def walkable(self, x, y):
        code = self.get(x, y)
        return code is not None and TERRAIN_COST[code] is not None and code not in HAZARD and (x, y) not in self.taken

    def prop(self, k, x, y, w=1, h=1, hidden=None):
        cells = [(x + i, y + j) for i in range(w) for j in range(h)]
        if any(c in self.taken or not self.inside(*c) for c in cells):
            return False
        item = {"k": k, "c": x, "r": y}
        if w > 1 or h > 1:
            item.update(w=w, h=h)
        if hidden if hidden is not None else k == "N":
            item["hidden"] = True
        self.props.append(item)
        if k != "N":
            self.taken.update(cells)
        return True

    def scatter(self, k, n, on, area=None, spacing=1, w=1, h=1, avoid=None, tries=400):
        x0, y0, x1, y1 = area or (0, 0, self.cols - 1, self.rows - 1)
        placed = 0
        for _ in range(tries):
            if placed >= n:
                break
            x, y = self.rng.randint(x0, x1), self.rng.randint(y0, y1)
            cells = [(x + i, y + j) for i in range(w) for j in range(h)]
            if any(self.get(*c) not in on for c in cells):
                continue
            if avoid and any(avoid(*c) for c in cells):
                continue
            near = {(cx + dx, cy + dy) for cx, cy in cells for dx in range(-spacing, spacing + 1) for dy in range(-spacing, spacing + 1)}
            if near & self.taken or any((s[0], s[1]) in near for side in self.spawns.values() for s in side):
                continue
            if self.prop(k, x, y, w, h):
                placed += 1
        return placed

    def spawn_area(self, side, x0, y0, x1, y1, n=6):
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        cells = sorted(((x, y) for y in range(y0, y1 + 1) for x in range(x0, x1 + 1)),
                       key=lambda c: (math.hypot(c[0] - cx, c[1] - cy), c[1], c[0]))
        used = {tuple(c) for s in self.spawns.values() for c in s}
        for x, y in cells:
            if len(self.spawns[side]) >= n:
                break
            if self.walkable(x, y) and (x, y) not in used:
                self.spawns[side].append([x, y])

    def connect(self, a, b, floor):
        """Asegura un camino transitable de a hasta b abriendo paso: lava → escombros, roca → suelo."""
        a, b = tuple(a), tuple(b)
        dist, prev, pq = {a: 0}, {}, [(0, a)]
        while pq:
            d, cur = heapq.heappop(pq)
            if cur == b:
                break
            if d > dist[cur]:
                continue
            x, y = cur
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                code = self.get(nx, ny)
                if code is None:
                    continue
                step = 1 if self.walkable(nx, ny) else 4 if code in HAZARD else 60 if (nx, ny) in self.taken else 10
                if d + step < dist.get((nx, ny), math.inf):
                    dist[(nx, ny)] = d + step
                    prev[(nx, ny)] = cur
                    heapq.heappush(pq, (d + step, (nx, ny)))
        cur = b
        while cur in prev:
            x, y = cur
            if not self.walkable(x, y) and cur not in self.taken:
                self.set(x, y, "%" if self.get(x, y) in HAZARD else floor)
            cur = prev[cur]

    def cave(self, wall, floor, fill=0.46, steps=5):
        """Cueva orgánica con un autómata celular; se conserva solo la zona abierta más grande."""
        for y in range(self.rows):
            for x in range(self.cols):
                edge = x in (0, self.cols - 1) or y in (0, self.rows - 1)
                self.t[y][x] = wall if edge or self.rng.random() < fill else floor
        for _ in range(steps):
            nxt = [row[:] for row in self.t]
            for y in range(1, self.rows - 1):
                for x in range(1, self.cols - 1):
                    walls = sum(self.t[y + dy][x + dx] == wall for dy in (-1, 0, 1) for dx in (-1, 0, 1) if dx or dy)
                    nxt[y][x] = wall if walls >= 5 else floor if walls <= 3 else self.t[y][x]
            self.t = nxt
        regions, seen = [], set()
        for y in range(self.rows):
            for x in range(self.cols):
                if self.t[y][x] == floor and (x, y) not in seen:
                    stack, region = [(x, y)], []
                    seen.add((x, y))
                    while stack:
                        cx, cy = stack.pop()
                        region.append((cx, cy))
                        for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                            if self.get(nx, ny) == floor and (nx, ny) not in seen:
                                seen.add((nx, ny))
                                stack.append((nx, ny))
                    regions.append(region)
        keep = set(max(regions, key=len)) if regions else set()
        for y in range(self.rows):
            for x in range(self.cols):
                if self.t[y][x] == floor and (x, y) not in keep:
                    self.t[y][x] = wall

    def open_cells(self, codes, x0=0, x1=None):
        """Casillas libres ordenadas de la más espaciosa a la menos (lejos de muros)."""
        x1 = self.cols - 1 if x1 is None else x1
        out = []
        for y in range(1, self.rows - 1):
            for x in range(max(1, x0), min(self.cols - 1, x1 + 1)):
                if self.t[y][x] in codes:
                    space = sum(self.get(x + dx, y + dy) in codes for dx in range(-2, 3) for dy in range(-2, 3))
                    out.append((space, -abs(y - self.rows / 2), x, y))
        out.sort(reverse=True)
        return [(x, y) for _, _, x, y in out]

    def scene(self, sid, name, description, light):
        return {
            "id": f"p-{sid}", "preset": True, "name": name, "description": description,
            "cols": self.cols, "rows": self.rows, "light": light, "bg": "", "bgOpacity": 1,
            "tiles": "".join("".join(row) for row in self.t),
            "props": self.props, "spawns": self.spawns,
        }


# ------------------------------------------------------------- prediseñados
def _taberna():
    g = _Grid(26, 16, "w", 11)
    g.stamp(0, 0, """
##########################
#......Hwwwwwwwwwwwwwwwww#
#......Hwwwwwwwwwwwwwwwww#
#......Hwwwwwwwwwwwwwwwww#
#......Hwwwwwwwwwwwwwwwww#
#......Hwwwwwwwwwwwwwwwww#
#HHHDHHHwwwwwwwwwwwwwwwww#
#wwwwwwwwwwwwwwwwwwwwwwww#
#.mmmwwwwwwwwwwwwwwwwwwww#
#.mmmwwwwwwwwwwwwwwwwwwSS#
#.mmmwwwwwwwwwwwwwwwwwwSS#
#wwwwwwwwwwwwwwwwwwwwwwSS#
############DD############
cccccccccccccccccccccccccc
cccccccccccccccccccccccccc
cccccccccccccccccccccccccc
""")
    g.stamp_props(0, 0, """
..........................
.BB..CC...h......qqqqqqBB.
.B....C..hth...z........B.
..........h....z..........
.q.............zzzzzzzz...
.........2...2..h.h.h.h...
....................2.....
...........h..........2...
..........hth...hth.......
.F.........h.....h........
.........2...hth..........
..............h...2.......
..........................
..........B....C..........
......L....1111....L......
............11............
""")
    g.prop("S", 3, 3)
    g.prop("a", 12, 0)
    g.prop("a", 20, 0)
    return g.scene("taberna", "Taberna «El Jabalí Dorado»",
                   "Sala con barra, chimenea y almacén. Ideal para una pelea de taberna: el grupo entra desde la calle.", "penumbra")


def _bosque():
    g = _Grid(30, 20, ",", 21)
    g.noise(";", 0.1, {","})
    g.line([(8, -1), (10, 5), (9, 10), (12, 15), (11, 20)], 2.2, "~")
    g.line([(9.5, 4), (9.5, 7)], 1.2, "W", {"~"})
    g.line([(-1, 14), (6, 12.5), (12, 11.5), (19, 12), (24, 9), (30, 8)], 2, ":", {",", ";"})
    g.line([(-1, 14), (6, 12.5), (12, 11.5), (19, 12), (24, 9), (30, 8)], 2, "=", {"~", "W"})
    g.blob(20, 7, 3.5, ",", {";"})
    in_clearing = lambda x, y: math.hypot(x - 20, y - 7) < 4.5
    on_path = lambda x, y: g.get(x, y) in (":", "=")
    g.prop("T", 25, 2, 2, 2)
    g.prop("T", 2, 2, 2, 2)
    g.prop("x", 21, 15, 2, 1)
    g.spawn_area("party", 0, 12, 4, 15)
    g.spawn_area("enemies", 17, 4, 23, 10)
    g.scatter("T", 14, {",", ";"}, spacing=2, avoid=lambda x, y: in_clearing(x, y) or on_path(x, y))
    g.scatter("P", 6, {",", ";"}, spacing=2, avoid=lambda x, y: in_clearing(x, y))
    g.scatter("b", 12, {",", ";"}, spacing=1, avoid=on_path)
    g.scatter("r", 5, {",", ":"}, spacing=2)
    g.scatter("r", 3, {"~"}, spacing=2)
    return g.scene("bosque", "Claro del bosque",
                   "Arroyo con un puente de madera, maleza y árboles para esconderse. Emboscada en el claro.", "dia")


def _cripta():
    g = _Grid(28, 18, "#", 31)
    g.rect(8, 3, 19, 14, ".")
    g.rect(1, 8, 7, 9, ".")
    g.rect(1, 8, 1, 9, "S")
    g.rect(21, 5, 26, 12, ".")
    g.rect(20, 8, 20, 9, "D")
    g.rect(2, 2, 6, 5, ".")
    g.rect(4, 6, 4, 7, ".")
    g.rect(2, 12, 6, 15, ".")
    g.rect(4, 10, 4, 11, ".")
    g.blob(17.5, 13, 1.6, "%", {"."})
    g.blob(3, 15, 1.2, "%", {"."})
    for x in (10, 17):
        for y in (5, 8, 12):
            g.prop("O", x, y)
    g.prop("Z", 13, 6, 2, 1)
    g.prop("Z", 13, 11, 2, 1)
    g.prop("Y", 25, 8, 1, 2)
    g.prop("L", 24, 6)
    g.prop("L", 24, 11)
    g.prop("E", 22, 5)
    g.prop("E", 22, 12)
    g.prop("Z", 3, 13, 1, 2)
    g.prop("Z", 5, 13, 1, 2)
    g.prop("K", 6, 15)
    g.prop("y", 2, 2)
    g.prop("y", 6, 2)
    g.prop("y", 8, 3)
    g.prop("y", 19, 14)
    g.prop("N", 9, 9)
    for x, y in ((3, 7), (6, 10), (11, 2), (16, 2), (11, 15), (16, 15), (23, 4), (23, 13)):
        g.prop("a", x, y)
    g.spawn_area("party", 2, 8, 6, 9)
    g.spawn_area("enemies", 15, 6, 20, 11)
    g.scatter("j", 5, {"."}, area=(2, 2, 6, 5), spacing=0)
    g.scatter("j", 3, {"."}, area=(8, 3, 19, 14), spacing=1)
    return g.scene("cripta", "Cripta olvidada",
                   "Salas de piedra con columnas, sarcófagos y un altar. Hay una trampa oculta (solo la ve el máster).", "noche")


def _cueva():
    g = _Grid(30, 20, ":", 47)
    g.cave("R", ":", fill=0.45, steps=5)
    start = min(((x, y) for y in range(g.rows) for x in range(g.cols) if g.get(x, y) == ":"), key=lambda c: (c[0], abs(c[1] - 10)))
    g.line([(0, 10), (start[0], start[1])], 2, ":")
    g.noise("%", 0.06, {":"})
    spots = g.open_cells({":", "%"}, x0=16)
    fx, fy = spots[0]
    g.prop("F", fx, fy)
    pool = g.open_cells({":"}, x1=14)
    if pool:
        px, py = pool[len(pool) // 3]
        g.blob(px, py, 2.2, "~", {":", "%"})
        g.blob(px, py, 1, "W", {"~"})
    g.spawn_area("party", 0, 8, 5, 12)
    g.spawn_area("enemies", fx - 3, fy - 3, fx + 3, fy + 3)
    g.connect(g.spawns["party"][0], g.spawns["enemies"][0], ":")
    g.scatter("X", 2, {":"}, area=(fx - 5, fy - 5, fx + 5, fy + 5), spacing=1)
    g.scatter("K", 1, {":"}, area=(fx - 5, fy - 5, fx + 5, fy + 5), spacing=1)
    g.scatter("M", 5, {":", "%"}, spacing=2)
    g.scatter("Q", 3, {":"}, spacing=3)
    g.scatter("j", 4, {":", "%"}, spacing=1)
    g.scatter("r", 4, {":", "%"}, spacing=2)
    g.scatter("S", 2, {":"}, area=(fx - 5, fy - 5, fx + 5, fy + 5), spacing=1)
    return g.scene("cueva", "Cueva de los goblins",
                   "Túneles de roca, una charca subterránea, setas gigantes y la hoguera de la banda.", "noche")


def _puente():
    g = _Grid(30, 18, ",", 53)
    g.noise(";", 0.1, {","})
    g.line([(13.5, -1), (14.5, 5), (13.5, 11), (15, 18)], 4.2, "v")
    for y in (8, 9):
        g.rect(9, y, 20, y, "=", {"v"})
    g.line([(-1, 12), (5, 10.5), (10, 9)], 2, ":", {",", ";"})
    g.line([(20, 8.5), (24, 7), (30, 6)], 2, ":", {",", ";"})
    edge = lambda x, y: any(g.get(x + dx, y + dy) == "v" for dx in (-1, 0, 1) for dy in (-1, 0, 1))
    g.spawn_area("party", 0, 9, 4, 13)
    g.spawn_area("enemies", 23, 3, 28, 9)
    g.scatter("r", 9, {",", ";"}, spacing=1, avoid=lambda x, y: not edge(x, y) or g.get(x, y) == ":")
    g.scatter("T", 9, {",", ";"}, spacing=2, avoid=lambda x, y: edge(x, y) or g.get(x, y) == ":")
    g.scatter("P", 6, {",", ";"}, spacing=2, avoid=lambda x, y: edge(x, y))
    g.scatter("b", 8, {",", ";"}, spacing=1, avoid=lambda x, y: edge(x, y))
    return g.scene("puente", "Puente del desfiladero",
                   "Un puente colgante sobre un abismo. Quien cae no vuelve: cuidado con los empujones.", "dia")


def _campamento():
    g = _Grid(30, 20, ",", 61)
    g.noise(";", 0.12, {","})
    g.blob(15, 10, 7.5, ":", {",", ";"})
    g.frame(6, 3, 24, 16, "H")
    g.rect(6, 9, 6, 10, ":")
    g.rect(15, 3, 16, 3, "%")
    g.rect(24, 12, 24, 13, "%")
    g.rect(7, 4, 23, 15, ":", {",", ";"})
    for x, y in ((8, 5), (8, 13), (20, 5), (20, 13)):
        g.prop("u", x, y, 2, 2)
    g.prop("F", 15, 10)
    g.prop("x", 13, 9, 1, 2)
    g.prop("x", 17, 9, 1, 2)
    g.prop("V", 21, 8, 2, 3)
    g.prop("g", 11, 14)
    g.prop("a", 6, 8)
    g.prop("a", 6, 11)
    g.prop("K", 22, 15)
    g.spawn_area("party", 1, 8, 4, 11)
    g.spawn_area("enemies", 12, 6, 19, 14)
    g.scatter("C", 4, {":"}, area=(7, 4, 23, 15), spacing=1)
    g.scatter("B", 4, {":"}, area=(7, 4, 23, 15), spacing=1)
    g.scatter("S", 2, {":"}, area=(7, 4, 23, 15), spacing=1)
    g.scatter("T", 10, {",", ";"}, spacing=2)
    g.scatter("b", 8, {",", ";"}, spacing=1)
    return g.scene("campamento", "Campamento de bandidos",
                   "Empalizada de madera con tiendas, hoguera, un carro y un prisionero en una jaula.", "noche")


def _plaza():
    g = _Grid(30, 20, "c", 71)
    for x0, y0, x1, y1 in ((0, 0, 6, 3), (8, 0, 13, 2), (16, 0, 22, 3), (24, 0, 29, 2),
                           (0, 16, 5, 19), (7, 17, 13, 19), (16, 16, 22, 19), (24, 17, 29, 19)):
        g.rect(x0, y0, x1, y1, "#")
    for x, y in ((3, 3), (10, 2), (19, 3), (26, 2), (2, 16), (10, 17), (19, 16), (27, 17)):
        g.set(x, y, "D")
    for x, y in ((3, 6), (26, 6), (3, 13), (26, 13)):
        g.rect(x - 1, y - 1, x + 1, y + 1, ",")
        g.prop("T", x, y)
    g.prop("f", 14, 9, 2, 2)
    g.prop("o", 6, 10)
    for x, y in ((9, 6), (19, 6), (9, 13), (19, 13)):
        g.prop("t", x, y, 2, 1)
    g.prop("V", 23, 9, 3, 2)
    for x, y in ((12, 6), (8, 6), (21, 6), (8, 13), (12, 14), (22, 13)):
        g.prop("C" if (x + y) % 2 else "B", x, y)
    g.prop("S", 18, 7)
    g.prop("S", 11, 12)
    g.spawn_area("party", 0, 8, 2, 11)
    g.spawn_area("enemies", 16, 8, 21, 12)
    return g.scene("plaza", "Plaza del mercado",
                   "Calles adoquinadas, puestos, una fuente y casas alrededor. Persecuciones y emboscadas urbanas.", "dia")


def _barco():
    g = _Grid(32, 20, "W", 83)
    # barco del grupo (abajo)
    g.rect(4, 9, 24, 17, "w")
    for x, (y0, y1) in zip(range(25, 30), ((9, 17), (10, 16), (10, 16), (11, 15), (12, 14))):
        g.rect(x, y0, x, y1, "w")
    g.rect(3, 10, 3, 16, "w")
    # barco pirata (arriba)
    g.rect(8, 1, 21, 5, "w")
    g.rect(22, 2, 23, 4, "w")
    g.rect(7, 2, 7, 4, "w")
    deck = {(x, y) for y in range(g.rows) for x in range(g.cols) if g.get(x, y) == "w"}
    for x, y in deck:
        if any(g.get(x + dx, y + dy) == "W" for dx in (-1, 0, 1) for dy in (-1, 0, 1)):
            g.set(x, y, "H")
    g.rect(13, 5, 14, 9, "=")
    g.rect(20, 13, 21, 13, "S")
    for x, y in ((10, 13), (18, 13)):
        g.prop("e", x, y)
    g.prop("e", 14, 3)
    for x, y in ((7, 10), (17, 10), (7, 16), (17, 16)):
        g.prop("A", x, y)
    g.prop("A", 10, 4)
    g.prop("A", 18, 4)
    g.spawn_area("party", 5, 11, 12, 15)
    g.spawn_area("enemies", 9, 2, 20, 4)
    g.scatter("C", 3, {"w"}, area=(4, 10, 27, 16), spacing=1)
    g.scatter("B", 4, {"w"}, area=(4, 10, 27, 16), spacing=1)
    g.scatter("S", 2, {"w"}, area=(4, 10, 27, 16), spacing=1)
    g.scatter("B", 2, {"w"}, area=(8, 2, 22, 4), spacing=1)
    return g.scene("barco", "Abordaje en alta mar",
                   "Dos barcos unidos por una pasarela. Quien cae al agua profunda tendrá que nadar.", "dia")


def _templo():
    g = _Grid(28, 18, ",", 97)
    g.noise(";", 0.14, {","})
    g.rect(5, 3, 22, 14, ".")
    g.frame(5, 3, 22, 14, "#")
    for y in range(3, 15):
        for x in range(5, 23):
            if g.get(x, y) == "#" and g.rng.random() < 0.35:
                g.set(x, y, "%")
    g.rect(5, 8, 5, 9, "%")
    g.noise(",", 0.1, {"."})
    g.noise("%", 0.05, {"."})
    for x in (8, 11, 14, 17):
        for y in (6, 11):
            if g.rng.random() < 0.25:
                g.set(x, y, "%")
                g.prop("r", x, y)
            else:
                g.prop("O", x, y)
    g.prop("Y", 20, 8, 1, 2)
    g.prop("E", 21, 5)
    g.prop("E", 21, 12)
    g.prop("L", 19, 7)
    g.prop("L", 19, 10)
    g.spawn_area("party", 0, 7, 3, 10)
    g.spawn_area("enemies", 13, 6, 19, 11)
    g.scatter("T", 8, {",", ";"}, spacing=2, avoid=lambda x, y: 4 <= x <= 23 and 2 <= y <= 15)
    g.scatter("b", 10, {",", ";"}, spacing=1, avoid=lambda x, y: 5 <= x <= 22 and 3 <= y <= 14)
    g.scatter("j", 3, {"."}, area=(6, 4, 21, 13), spacing=1)
    return g.scene("templo", "Templo en ruinas",
                   "Columnas rotas, maleza entre las losas y un altar custodiado por dos estatuas.", "penumbra")


def _pantano():
    g = _Grid(30, 20, "p", 109)
    for _ in range(9):
        g.blob(g.rng.uniform(2, 27), g.rng.uniform(2, 17), g.rng.uniform(1.5, 3.2), "~")
    for _ in range(3):
        g.blob(g.rng.uniform(4, 25), g.rng.uniform(3, 16), g.rng.uniform(1, 1.8), "W", {"~"})
    for _ in range(5):
        g.blob(g.rng.uniform(2, 27), g.rng.uniform(2, 17), g.rng.uniform(1.2, 2.2), ",")
    g.noise(";", 0.25, {","})
    g.blob(23, 9, 4.2, ",")
    g.rect(20, 7, 24, 11, "H")
    g.rect(21, 8, 23, 10, "w")
    g.set(20, 9, "D")
    g.line([(-1, 10), (7, 10), (12, 7), (19, 9)], 1, "=", {"p", "~", "W", ",", ";"})
    g.prop("k", 23, 8)
    g.prop("t", 22, 10)
    g.prop("g", 21, 8)
    g.spawn_area("party", 0, 9, 4, 11)
    g.spawn_area("enemies", 15, 5, 26, 14)
    g.scatter("T", 5, {",", ";"}, spacing=2, avoid=lambda x, y: 18 <= x <= 26 and 6 <= y <= 12)
    g.scatter("x", 4, {"p", ","}, spacing=2)
    g.scatter("M", 4, {"p", ",", ";"}, spacing=2)
    g.scatter("b", 8, {",", ";"}, spacing=1)
    g.scatter("j", 3, {"p"}, spacing=2)
    return g.scene("pantano", "Ciénaga de los ahogados",
                   "Barro, aguas turbias y una cabaña de bruja al final de una pasarela. Casi todo es terreno difícil.", "penumbra")


def _guarida():
    g = _Grid(30, 20, ":", 131)
    g.cave("R", ".", fill=0.42, steps=4)
    start = min(((x, y) for y in range(g.rows) for x in range(g.cols) if g.get(x, y) == "."), key=lambda c: (c[0], abs(c[1] - 10)))
    g.line([(0, 10), (start[0], start[1])], 2, ".")
    g.line([(12, -1), (13, 6), (11, 12), (14, 20)], 1.3, "l", {"."})
    g.blob(19, 15, 1.6, "l", {"."})
    spots = g.open_cells({"."}, x0=17)
    tx, ty = spots[0]
    g.spawn_area("party", 0, 8, 5, 12)
    g.spawn_area("enemies", tx - 2, ty - 2, tx + 2, ty + 2, n=3)
    g.connect(g.spawns["party"][0], g.spawns["enemies"][0], ".")
    g.scatter("X", 6, {"."}, area=(tx - 4, ty - 4, tx + 4, ty + 4), spacing=0)
    g.scatter("K", 2, {"."}, area=(tx - 4, ty - 4, tx + 4, ty + 4), spacing=1)
    g.scatter("j", 6, {".", ":"}, spacing=1)
    g.scatter("r", 6, {"."}, spacing=2)
    g.scatter("Q", 2, {"."}, spacing=4)
    return g.scene("guarida", "Guarida del dragón",
                   "Caverna volcánica con ríos de lava y el tesoro amontonado del dragón.", "noche")


def _campo():
    g = _Grid(24, 16, ",", 151)
    g.noise(";", 0.06, {","})
    g.blob(12, 8, 2.5, ":", {",", ";"})
    g.spawn_area("party", 1, 5, 4, 10)
    g.spawn_area("enemies", 19, 5, 22, 10)
    g.scatter("r", 3, {",", ";"}, spacing=3)
    g.scatter("b", 4, {",", ";"}, spacing=2)
    g.scatter("T", 3, {",", ";"}, spacing=3)
    return g.scene("campo", "Campo abierto",
                   "Pradera casi despejada para cualquier escaramuza improvisada.", "dia")


PRESETS = [_taberna(), _bosque(), _cripta(), _cueva(), _puente(), _campamento(),
           _plaza(), _barco(), _templo(), _pantano(), _guarida(), _campo()]


def catalog() -> dict:
    """Todo lo que el tablero necesita: terrenos, objetos, luces y escenarios prediseñados."""
    return {
        "cell_m": 1.5,
        "terrain": [{"code": c, "name": n, "cost": cost, "kind": kind, "hazard": c in HAZARD} for c, n, cost, kind in TERRAIN],
        "props": [{"code": c, "name": n, "effect": e, "cover": cv, "light": li, "hidden": hid, "group": g} for c, n, e, cv, li, hid, g in PROPS],
        "prop_groups": PROP_GROUPS,
        "lights": [{"key": k, "name": n} for k, n in LIGHTS],
        "presets": PRESETS,
    }
