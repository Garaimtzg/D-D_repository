"""Reglas de D&D 5e: tablas, cálculo de encuentros y textos de referencia."""
from fractions import Fraction
import math

ABILITIES = [
    {"key": "fue", "name": "Fuerza"},
    {"key": "des", "name": "Destreza"},
    {"key": "con", "name": "Constitución"},
    {"key": "int", "name": "Inteligencia"},
    {"key": "sab", "name": "Sabiduría"},
    {"key": "car", "name": "Carisma"},
]

SKILLS = [
    ("acrobacias", "Acrobacias", "des"), ("arcanos", "Arcanos", "int"),
    ("atletismo", "Atletismo", "fue"), ("engano", "Engaño", "car"),
    ("historia", "Historia", "int"), ("interpretacion", "Interpretación", "car"),
    ("intimidacion", "Intimidación", "car"), ("investigacion", "Investigación", "int"),
    ("juego_manos", "Juego de manos", "des"), ("medicina", "Medicina", "sab"),
    ("naturaleza", "Naturaleza", "int"), ("percepcion", "Percepción", "sab"),
    ("perspicacia", "Perspicacia", "sab"), ("persuasion", "Persuasión", "car"),
    ("religion", "Religión", "int"), ("sigilo", "Sigilo", "des"),
    ("supervivencia", "Supervivencia", "sab"), ("trato_animales", "Trato con animales", "sab"),
]

# Umbrales de PX por personaje (Guía del Dungeon Master 2014): fácil, media, difícil, mortal
XP_THRESHOLDS = {
    1: (25, 50, 75, 100), 2: (50, 100, 150, 200), 3: (75, 150, 225, 400),
    4: (125, 250, 375, 500), 5: (250, 500, 750, 1100), 6: (300, 600, 900, 1400),
    7: (350, 750, 1100, 1700), 8: (450, 900, 1400, 2100), 9: (550, 1100, 1600, 2400),
    10: (600, 1200, 1900, 2800), 11: (800, 1600, 2400, 3600), 12: (1000, 2000, 3000, 4500),
    13: (1100, 2200, 3400, 5100), 14: (1250, 2500, 3800, 5700), 15: (1400, 2800, 4300, 6400),
    16: (1600, 3200, 4800, 7200), 17: (2000, 3900, 5900, 8800), 18: (2100, 4200, 6300, 9500),
    19: (2400, 4900, 7300, 10900), 20: (2800, 5700, 8500, 12700),
}
DIFFICULTIES = ("fácil", "media", "difícil", "mortal")

CR_XP = {
    "0": 10, "1/8": 25, "1/4": 50, "1/2": 100, "1": 200, "2": 450, "3": 700, "4": 1100,
    "5": 1800, "6": 2300, "7": 2900, "8": 3900, "9": 5000, "10": 5900, "11": 7200,
    "12": 8400, "13": 10000, "14": 11500, "15": 13000, "16": 15000, "17": 18000,
    "18": 20000, "19": 22000, "20": 25000, "21": 33000, "22": 41000, "23": 50000,
    "24": 62000, "25": 75000, "26": 90000, "27": 105000, "28": 120000, "29": 135000,
    "30": 155000,
}

# PX totales para alcanzar cada nivel
LEVEL_XP = [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000,
            85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000]

_MULTIPLIERS = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5]


def ability_mod(score) -> int:
    return (int(score) - 10) // 2


def prof_bonus_level(level) -> int:
    return 2 + (max(1, min(20, int(level))) - 1) // 4


def prof_bonus_cr(cr) -> int:
    value = float(Fraction(str(cr)))
    return 2 if value < 1 else 2 + (math.ceil(value) - 1) // 4


def level_for_xp(xp) -> int:
    return sum(1 for need in LEVEL_XP if int(xp) >= need)


def _multiplier_index(count):
    if count <= 1: return 1
    if count == 2: return 2
    if count <= 6: return 3
    if count <= 10: return 4
    if count <= 14: return 5
    return 6


def encounter(party_levels, monster_crs) -> dict:
    """Dificultad de un encuentro según la Guía del DM (2014)."""
    levels = [max(1, min(20, int(l))) for l in party_levels]
    crs = [str(c) for c in monster_crs]
    unknown = [c for c in crs if c not in CR_XP]
    if unknown:
        raise ValueError(f"VD desconocido: {', '.join(unknown)}")
    thresholds = [sum(XP_THRESHOLDS[l][i] for l in levels) for i in range(4)]
    base_xp = sum(CR_XP[c] for c in crs)
    idx = _multiplier_index(len(crs))
    if levels and len(levels) < 3:
        idx += 1
    elif len(levels) >= 6:
        idx -= 1
    mult = _MULTIPLIERS[max(0, min(idx, len(_MULTIPLIERS) - 1))] if crs else 1
    adjusted = int(base_xp * mult)
    difficulty = "trivial"
    for name, limit in zip(DIFFICULTIES, thresholds):
        if adjusted >= limit:
            difficulty = name
    return {
        "thresholds": dict(zip(DIFFICULTIES, thresholds)),
        "base_xp": base_xp,
        "multiplier": mult,
        "adjusted_xp": adjusted,
        "difficulty": difficulty if levels else "—",
        "xp_per_player": base_xp // len(levels) if levels else 0,
    }


CONDITIONS = [
    ("Agarrado", "Velocidad 0. Termina si quien agarra queda incapacitado o te saca de su alcance."),
    ("Apresado", "Velocidad 0. Los ataques contra ti tienen ventaja y los tuyos desventaja. Desventaja en salvaciones de Destreza."),
    ("Asustado", "Desventaja en pruebas y ataques mientras veas la fuente del miedo. No puedes acercarte a ella voluntariamente."),
    ("Aturdido", "Incapacitado, no puedes moverte y hablas a trompicones. Fallas salvaciones de FUE y DES. Ataques contra ti con ventaja."),
    ("Cegado", "Fallas pruebas que dependan de la vista. Ataques contra ti con ventaja; los tuyos con desventaja."),
    ("Derribado", "Solo puedes arrastrarte. Desventaja en tus ataques. Cuerpo a cuerpo contra ti con ventaja; a distancia, con desventaja."),
    ("Ensordecido", "Fallas pruebas que dependan del oído."),
    ("Envenenado", "Desventaja en tiradas de ataque y pruebas de característica."),
    ("Hechizado", "No puedes atacar a quien te hechizó; tiene ventaja en pruebas sociales contigo."),
    ("Incapacitado", "No puedes hacer acciones ni reacciones."),
    ("Inconsciente", "Incapacitado y derribado; sueltas lo que llevas. Fallas salvaciones de FUE y DES. Ataques con ventaja; un impacto a 5 pies es crítico."),
    ("Invisible", "Los ataques contra ti tienen desventaja y los tuyos ventaja."),
    ("Paralizado", "Incapacitado, sin moverte. Fallas salvaciones de FUE y DES. Ataques con ventaja; un impacto a 5 pies es crítico."),
    ("Petrificado", "Convertido en piedra e incapacitado. Resistencia a todo el daño; inmune a veneno y enfermedad."),
    ("Concentrado", "Si recibes daño, salvación de CON CD 10 o la mitad del daño (lo mayor) para mantener el conjuro."),
    ("Bendecido", "+1d4 a ataques y salvaciones (Bendición)."),
    ("Marcado", "Marca del cazador / Maleficio u otro efecto de rastreo."),
]

EXHAUSTION = [
    "Desventaja en pruebas de característica",
    "Velocidad reducida a la mitad",
    "Desventaja en ataques y salvaciones",
    "PG máximos reducidos a la mitad",
    "Velocidad reducida a 0",
    "Muerte",
]

ACTIONS = [
    ("Atacar", "Un ataque con arma o sin armas (más con Ataque adicional)."),
    ("Lanzar un conjuro", "Conjuro con tiempo de lanzamiento de 1 acción."),
    ("Correr", "Ganas movimiento extra igual a tu velocidad."),
    ("Destrabarse", "Tu movimiento no provoca ataques de oportunidad este turno."),
    ("Esquivar", "Ataques contra ti con desventaja; ventaja en salvaciones de DES."),
    ("Ayudar", "Un aliado tiene ventaja en su próxima prueba o ataque contra un objetivo a 5 pies de ti."),
    ("Esconderse", "Prueba de Destreza (Sigilo)."),
    ("Prepararse", "Eliges un desencadenante y una reacción para responder a él."),
    ("Buscar", "Prueba de Sabiduría (Percepción) o Inteligencia (Investigación)."),
    ("Usar un objeto", "Interactuar con un segundo objeto o usar uno que requiera acción."),
    ("Agarrar / Empujar", "Prueba enfrentada de Atletismo contra Atletismo o Acrobacias."),
]

QUICK_RULES = [
    ("Clases de dificultad", "5 muy fácil · 10 fácil · 15 media · 20 difícil · 25 muy difícil · 30 casi imposible."),
    ("Cobertura", "Media: +2 a CA y salvaciones de DES. Tres cuartos: +5. Total: no se puede apuntar."),
    ("Salvaciones de muerte", "d20 al empezar tu turno a 0 PG: 10+ éxito, 9- fallo. 3 éxitos estable, 3 fallos muerte. 1 natural = 2 fallos; 20 natural = recuperas 1 PG."),
    ("Daño masivo", "Si el daño sobrante tras llegar a 0 PG iguala o supera tus PG máximos, mueres al instante."),
    ("Concentración", "Al recibir daño: salvación de CON con CD 10 o la mitad del daño, lo que sea mayor."),
    ("Críticos", "Tira el doble de dados de daño. 20 natural siempre impacta; 1 natural siempre falla."),
    ("Ventaja / desventaja", "Tira 2d20 y quédate con el mayor / menor. No se acumulan; si tienes ambas, se anulan."),
    ("Caída", "1d6 contundente por cada 10 pies (máximo 20d6). Caes derribado si recibes daño."),
    ("Descanso corto", "1 hora. Gasta dados de golpe: tira + mod. de CON y recupera esos PG."),
    ("Descanso largo", "8 horas. Recuperas todos los PG y la mitad de tus dados de golpe (mínimo 1)."),
    ("Luz", "Penumbra: desventaja en Percepción por vista. Oscuridad: estás cegado a efectos prácticos."),
    ("Contener la respiración", "1 + mod. de CON minutos (mínimo 30 s). Después, asfixia en mod. de CON asaltos."),
    ("Salto", "Longitud con carrerilla: tu Fuerza en pies. Altura: 3 + mod. de FUE pies. Sin carrerilla, la mitad."),
    ("Ritmo de viaje", "Rápido 30 millas/día (-5 Percepción pasiva) · Normal 24 · Lento 18 (puede usar Sigilo)."),
    ("Ataque de oportunidad", "Reacción cuando una criatura hostil que ves sale de tu alcance."),
    ("Dos armas", "Con arma ligera en cada mano: acción adicional para atacar con la otra, sin mod. al daño."),
    ("Monedas", "1 pp = 10 po · 1 po = 2 pe = 10 pa · 1 pa = 10 pc."),
]


def reference() -> dict:
    return {
        "abilities": ABILITIES,
        "skills": [{"key": k, "name": n, "ability": a} for k, n, a in SKILLS],
        "conditions": [{"name": n, "text": t} for n, t in CONDITIONS],
        "exhaustion": EXHAUSTION,
        "actions": [{"name": n, "text": t} for n, t in ACTIONS],
        "rules": [{"name": n, "text": t} for n, t in QUICK_RULES],
        "cr_xp": CR_XP,
        "level_xp": LEVEL_XP,
    }
