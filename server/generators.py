"""Generadores aleatorios para improvisar en mitad de la partida."""
import random

NAMES = {
    "humano": (["Aldric", "Brena", "Corin", "Dalia", "Edrik", "Fiona", "Gareth", "Helena", "Iván", "Jimena",
                "Lope", "Marta", "Nuño", "Olalla", "Rodrigo", "Sancha", "Tomás", "Urraca"],
               ["Robledo", "Ferrán", "de la Vega", "Montoro", "Salazar", "Hierro", "Valdés", "Campos"]),
    "elfo": (["Aelar", "Caelynn", "Erevan", "Ilphas", "Lia", "Mirelle", "Naivara", "Quarion", "Sariel",
              "Thamior", "Valanthe", "Yrlissa"],
             ["Amakiir", "Galanodel", "Holimion", "Liadon", "Meliamne", "Siannodel", "Xiloscient"]),
    "enano": (["Adrik", "Bardryn", "Dagnal", "Eberk", "Gunnloda", "Hlin", "Kildrak", "Orsik", "Riswynn",
               "Thorin", "Vistra"],
              ["Martillo de Roca", "Barbafuego", "Picohondo", "Yunque Negro", "Gorunn", "Torunn"]),
    "mediano": (["Alton", "Bree", "Cade", "Daisy", "Eldon", "Lavinia", "Merric", "Pip", "Rosie", "Wellby"],
                ["Brushgather", "Altohueco", "Buenbarril", "Pieligero", "Tealeaf", "Matorral"]),
    "orco": (["Dench", "Feng", "Gell", "Holg", "Imsh", "Krusk", "Ovak", "Shautha", "Thokk", "Volen", "Yevelda"],
             ["Rompehuesos", "Colmillo Rojo", "del Clan Ceniza", "Mataosos", "Puño de Piedra"]),
    "dracónido": (["Arjhan", "Balasar", "Daar", "Kava", "Kriv", "Medrash", "Nala", "Sora", "Torinn", "Uadjit"],
                  ["Clethtinthiallor", "Daardendrian", "Kepeshkmolik", "Myastan", "Yarjerit"]),
    "tiefling": (["Akmenos", "Bryseis", "Damakos", "Kallista", "Lerissa", "Mordai", "Orianna", "Skamos",
                  "Esperanza", "Penitencia", "Canción"],
                 ["", "", "del Abismo", "Sinnombre"]),
    "gnomo": (["Alston", "Bimpnottin", "Boddynock", "Carlin", "Ellyjobell", "Fonkin", "Nissa", "Orryn", "Zook"],
              ["Beren", "Daergel", "Garrick", "Nackle", "Timbers", "Turen"]),
}

OCCUPATIONS = ["tabernera", "herrero", "guardia del pueblo", "sacerdotisa", "mercader ambulante", "cazador",
               "alquimista", "bardo errante", "contrabandista", "escriba", "granjera", "noble venido a menos",
               "mercenario retirado", "curandera", "ladrón de poca monta", "pescador", "cartógrafa", "juglar"]
TRAITS = ["habla a gritos", "no mira a los ojos", "ríe de todo", "desconfía de los magos",
          "colecciona dientes", "tararea sin parar", "muy educado, demasiado", "cojea de una pierna",
          "huele a incienso", "siempre está comiendo", "repite la última palabra", "tiene un loro",
          "usa refranes inventados", "le falta un dedo", "susurra al hablar", "gesticula muchísimo"]
MOTIVATIONS = ["saldar una deuda", "vengar a su hermano", "huir del pueblo", "encontrar a su hija",
               "hacerse rico", "proteger un secreto familiar", "ganarse el perdón de un dios",
               "ascender en el gremio", "recuperar una reliquia robada", "vivir tranquilo"]
SECRETS = ["trabaja para el villano", "es un cambiaformas", "robó a los aventureros ayer",
           "sabe dónde está la entrada oculta", "debe dinero a la Mano Negra", "es noble de incógnito",
           "mató a alguien hace años", "oye una voz en sueños", "no tiene ningún secreto", "es un espía del rey"]

# (nombre, género) y (masculino, femenino): «El Grifo Dorado», «La Sirena Dorada»
TAVERN_A = [("Jabalí", "m"), ("Grifo", "m"), ("Dragón", "m"), ("Barril", "m"), ("Cuervo", "m"), ("Ciervo", "m"),
            ("Sirena", "f"), ("Caldero", "m"), ("Lobo", "m"), ("Yunque", "m"), ("Jarra", "f"), ("Rosa", "f"), ("Lechuza", "f")]
TAVERN_B = [("Dorado", "Dorada"), ("Borracho", "Borracha"), ("Tuerto", "Tuerta"), ("Risueño", "Risueña"),
            ("de Plata", "de Plata"), ("Dormido", "Dormida"), ("Ahumado", "Ahumada"), ("Errante", "Errante"),
            ("Herrumbroso", "Herrumbrosa"), ("Bailarín", "Bailarina")]
TAVERN_DISH = ["estofado de cordero", "pan negro y queso curado", "trucha a la brasa", "gachas con miel",
               "costillas de jabalí", "sopa de ajo", "empanada de setas", "pollo con ciruelas"]

HOOKS = [
    "Un niño entrega una carta sellada con el emblema del grupo… escrita hace cien años.",
    "Las vacas del pueblo aparecen cada mañana mirando al bosque.",
    "Un mercader ofrece una fortuna por escoltar una caja que no se puede abrir.",
    "El pozo del pueblo ha empezado a devolver objetos perdidos.",
    "Un caballero moribundo jura que el grupo le mató la semana pasada.",
    "Desaparecen las campanas de todas las iglesias de la comarca.",
    "Un mapa tatuado aparece en la espalda de uno de los personajes tras dormir.",
    "Los muertos del cementerio han sido enterrados de nuevo… boca abajo.",
    "Una bruja ofrece una cura a cambio de un recuerdo feliz.",
    "Una caravana llega al pueblo sin conductor y con los caballos aterrados.",
    "El alcalde contrata al grupo para encontrar a su doble, que gobierna mejor que él.",
    "Una estrella cae cerca del pueblo y no deja de cantar.",
]

WEATHER = {
    "templado": ["Despejado y templado", "Nubes altas, brisa suave", "Llovizna intermitente",
                 "Niebla espesa por la mañana", "Tormenta con aparato eléctrico", "Viento fuerte del norte"],
    "frio": ["Helada al amanecer", "Nevada ligera", "Ventisca (visibilidad 30 pies)", "Cielo gris y frío seco",
             "Granizo breve", "Frío extremo: CON CD 10 cada hora sin abrigo"],
    "calido": ["Sol abrasador", "Calor bochornoso", "Tormenta de verano repentina", "Viento caliente y polvo",
               "Calor extremo: CON CD 5 (+1/h) sin agua", "Noche templada y estrellada"],
}

TRINKETS = ["un dado que siempre saca 3", "un ojo de cristal que parpadea", "una llave sin cerradura conocida",
            "una moneda con dos caras iguales", "un mechón de pelo atado con cinta roja", "una brújula que señala a casa",
            "una muñeca de trapo sin boca", "un frasco con una tormenta diminuta", "un diente de dragón tallado",
            "una carta de amor sin destinatario", "una campanilla que no suena", "una pluma que escribe sola"]

LOOT_ITEMS = {
    1: ["Poción de curación (2d4+2)", "Pergamino de Proyectil mágico", "Daga de plata", "Cuerda de seda (50 pies)",
        "Antorcha eterna", "Bolsa de canicas", "Kit de sanador", "Gema de 10 po", "Capa de viaje élfica"],
    2: ["Poción de curación mayor (4d4+4)", "Arma +1", "Botas élficas", "Bolsa de contención", "Gema de 100 po",
        "Anillo de salto", "Varita de proyectiles mágicos", "Pergamino de Bola de fuego"],
    3: ["Poción de curación superior (8d4+8)", "Arma +2", "Armadura +1", "Capa de desplazamiento",
        "Anillo de protección", "Gema de 500 po", "Bastón de la víbora"],
    4: ["Poción de curación suprema (10d4+20)", "Arma +3", "Armadura +2", "Vara de absorción",
        "Gema de 5000 po", "Manual de salud corporal"],
}
LOOT_COINS = {1: ("5d6", "pc", "4d6", "pa", "2d6", "po"), 2: ("4d6", "pa", "6d6", "po", "1d6", "pp"),
              3: ("4d6", "po", "8d6", "po", "3d6", "pp"), 4: ("12d6", "po", "8d6", "pp", "4d6", "pp")}


def _dice(rng, spec):
    n, s = spec.split("d")
    return sum(rng.randint(1, int(s)) for _ in range(int(n)))


def name(race="", rng=None):
    rng = rng or random.Random()
    race = race if race in NAMES else rng.choice(list(NAMES))
    first, last = NAMES[race]
    full = f"{rng.choice(first)} {rng.choice(last)}".strip()
    return {"title": full, "text": race.capitalize(), "race": race}


def npc(race="", rng=None):
    rng = rng or random.Random()
    n = name(race, rng)
    occupation = rng.choice(OCCUPATIONS)
    text = (f"{n['race'].capitalize()}, {occupation}. Rasgo: {rng.choice(TRAITS)}. "
            f"Quiere {rng.choice(MOTIVATIONS)}. Secreto: {rng.choice(SECRETS)}.")
    return {"title": n["title"], "text": text, "race": n["race"], "occupation": occupation}


def tavern(rng=None):
    rng = rng or random.Random()
    noun, gender = rng.choice(TAVERN_A)
    masc, fem = rng.choice(TAVERN_B)
    title = f"El {noun} {masc}" if gender == "m" else f"La {noun} {fem}"
    owner = name("", rng)["title"]
    text = (f"Lo regenta {owner}. Plato del día: {rng.choice(TAVERN_DISH)}. "
            f"Habitación: {rng.choice([2, 5, 8])} pp la noche. Rumor: {rng.choice(HOOKS)}")
    return {"title": title, "text": text}


def loot(tier=1, rng=None):
    rng = rng or random.Random()
    tier = max(1, min(4, int(tier)))
    coins = LOOT_COINS[tier]
    money = ", ".join(f"{_dice(rng, coins[i])} {coins[i + 1]}" for i in range(0, 6, 2))
    items = rng.sample(LOOT_ITEMS[tier], k=rng.randint(1, 3))
    return {"title": f"Botín (nivel {['1-4', '5-10', '11-16', '17-20'][tier - 1]})",
            "text": f"{money}. Objetos: {'; '.join(items)}."}


def hook(rng=None):
    rng = rng or random.Random()
    return {"title": "Gancho de aventura", "text": rng.choice(HOOKS)}


def weather(climate="templado", rng=None):
    rng = rng or random.Random()
    climate = climate if climate in WEATHER else "templado"
    return {"title": "Clima", "text": rng.choice(WEATHER[climate])}


def trinket(rng=None):
    rng = rng or random.Random()
    return {"title": "Baratija", "text": rng.choice(TRINKETS).capitalize() + "."}


GENERATORS = {
    "nombre": lambda p, rng: name(p.get("race", ""), rng),
    "pnj": lambda p, rng: npc(p.get("race", ""), rng),
    "taberna": lambda p, rng: tavern(rng),
    "botin": lambda p, rng: loot(p.get("tier", 1), rng),
    "gancho": lambda p, rng: hook(rng),
    "clima": lambda p, rng: weather(p.get("climate", "templado"), rng),
    "baratija": lambda p, rng: trinket(rng),
}


def generate(kind, params=None, rng=None):
    if kind not in GENERATORS:
        raise KeyError(kind)
    return {"kind": kind, **GENERATORS[kind](params or {}, rng or random.Random())}
