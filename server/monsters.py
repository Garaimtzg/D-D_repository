"""Bestiario: los monstruos y animales del SRD 5.2.1 traducidos al castellano, más las criaturas
de la mitología de Euskal Herria (server/euskal.py), y las ediciones de la mesa (colección «bestiary»).

Contenido del System Reference Document 5.2.1 de Wizards of the Coast LLC (CC-BY-4.0,
https://www.dndbeyond.com/srd), traducido y resumido con tools/build_bestiary.py.
Velocidades y distancias en metros; los ataques con tirada llevan su bonificador y su daño,
y las acciones con salvación (alientos, rayos…) su CD y su daño.

Cada criatura lleva:
  · key: identificador estable (para enlazar las fichas con su modelo aunque se cambie el nombre).
  · skills: sus competencias en habilidades {clave: 1 competencia | 2 pericia}, sacadas de la línea
    «Habilidades: Percepción +5, Sigilo +4» (bonificador − modificador de característica, entre el
    bonificador por competencia de su VD). Así la ficha las marca en vez de dejarlas solo en el texto.
Las ediciones de la mesa se guardan aparte: una con «base» sustituye a esa criatura (cada lobo nuevo sale
así); una sin «base» es una criatura nueva. Todo lo que llega del usuario se recorta y se valida.
"""
import json
import math
import re
import unicodedata
from fractions import Fraction
from pathlib import Path

from .euskal import CREATURES
from .phb2024 import SKILLS

ABILITIES = ("fue", "des", "con", "int", "sab", "car")
SKILL_BY_NAME = {name.lower(): (key, ability) for key, name, ability in SKILLS}
SKILL_BY_NAME["arcanos"] = ("arcanos", "int")  # algunas criaturas lo llaman así
SKILL_NAME = {key: name for key, name, _ in SKILLS}
SKILL_ABILITY = {key: ability for key, _, ability in SKILLS}
CRS = ["0", "1/8", "1/4", "1/2"] + [str(n) for n in range(1, 31)]
SIZES = ("Diminuto", "Pequeño", "Mediano", "Grande", "Enorme", "Gargantuesco")
UPLOAD = re.compile(r"^/uploads/[a-f0-9]{32}\.[a-z0-9]{2,5}$")


def ability_mod(score) -> int:
    return (int(score or 10) - 10) // 2


def prof_bonus(cr) -> int:
    try:
        value = float(Fraction(str(cr)))
    except (ValueError, ZeroDivisionError):
        value = 0
    return 2 if value < 1 else 2 + (math.ceil(value) - 1) // 4


def slug(text) -> str:
    text = unicodedata.normalize("NFD", str(text)).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", text).strip("-")


def parse_skills(m) -> dict:
    """Competencias de la línea «Habilidades: …» del texto: {clave: 1 | 2}."""
    found = re.search(r"Habilidades:\s*([^\n]*)", m.get("traits") or "")
    if not found:
        return {}
    pb = prof_bonus(m.get("cr", "0"))
    out = {}
    for part in found.group(1).rstrip(".").split(","):
        hit = re.match(r"\s*(.+?)\s*([+-]\d+)", part)
        if not hit or hit.group(1).lower() not in SKILL_BY_NAME:
            continue
        key, ability = SKILL_BY_NAME[hit.group(1).lower()]
        extra = int(hit.group(2)) - ability_mod((m.get("abilities") or {}).get(ability, 10))
        out[key] = 2 if extra >= 2 * pb - 1 else 1  # el doble del bonificador (o casi): pericia
    return out


def skills_line(m) -> str:
    """La línea «Habilidades: …» a partir de las competencias (para que el texto no se quede viejo al editar)."""
    pb = prof_bonus(m.get("cr", "0"))
    parts = []
    for key, mult in m.get("skills", {}).items():
        bonus = ability_mod((m.get("abilities") or {}).get(SKILL_ABILITY[key], 10)) + pb * mult
        parts.append(f"{SKILL_NAME[key]} {'+' if bonus >= 0 else ''}{bonus}")
    return f"Habilidades: {', '.join(parts)}." if parts else ""


def _with_skills_line(traits, line):
    lines = [x for x in str(traits or "").split("\n") if not x.startswith("Habilidades:")]
    if line:  # va tras la leyenda (si la hay) y antes del resto, como en el bestiario
        at = 1 if lines and lines[0].startswith("Leyenda:") else 0
        lines.insert(at, line)
    return "\n".join(lines).strip()


def _base_key(m) -> str:
    return ("eu-" if m.get("source") else "") + slug(m.get("en") or m["name"])


BASE = []
for _m in json.loads(Path(__file__).with_name("monsters2024.json").read_text(encoding="utf-8")) + CREATURES:
    BASE.append({**_m, "key": _base_key(_m), "skills": parse_skills(_m)})
MONSTERS = BASE  # compatibilidad: el bestiario sin ediciones de la mesa
BY_KEY = {m["key"]: m for m in BASE}


# ------------------------------------------------------------------ ediciones de la mesa
def _txt(value, limit=200):
    return str(value if value is not None else "").strip()[:limit]


def _num(value, lo, hi, default):
    try:
        n = float(value)
    except (TypeError, ValueError):
        return default
    n = max(lo, min(hi, n))
    return int(n) if n == int(n) else n


def clean(doc: dict, base=None) -> dict:
    """Criatura con la forma del bestiario a partir de lo que guarda el editor (los huecos, de la original)."""
    base = base or {}
    get = lambda k, default=None: doc.get(k, base.get(k, default))  # noqa: E731
    abilities = get("abilities", {}) or {}
    out = {
        "name": _txt(get("name"), 80) or "Criatura sin nombre",
        "cr": str(get("cr", "1")) if str(get("cr", "1")) in CRS else "1",
        "ac": _num(get("ac"), 0, 40, 10), "hp": _num(get("hp"), 1, 3000, 1), "hpDice": _txt(get("hpDice"), 40),
        "speed": _num(get("speed"), 0, 60, 9), "size": get("size") if get("size") in SIZES else "Mediano",
        "creature": _txt(get("creature"), 60) or "Bestia", "alignment": _txt(get("alignment"), 60),
        "init": "" if get("init") in (None, "") else _num(get("init"), -10, 30, 0),
        "saves": [a for a in ABILITIES if a in (get("saves", []) or [])],
        "abilities": {a: _num(abilities.get(a), 1, 30, 10) for a in ABILITIES},
        "skills": {k: 2 if v == 2 else 1 for k, v in (get("skills", {}) or {}).items() if k in SKILL_NAME and v in (1, 2)},
        "attacks": [{"name": _txt(a.get("name"), 80), "bonus": "" if a.get("bonus") in (None, "") else _num(a.get("bonus"), -10, 30, 0),
                     "damage": _txt(a.get("damage"), 60), "notes": _txt(a.get("notes"), 200),
                     **({"save": _txt(a.get("save"), 40)} if a.get("save") else {})}
                    for a in (get("attacks", []) or []) if isinstance(a, dict) and _txt(a.get("name"))][:20],
    }
    out["traits"] = _with_skills_line(_txt(get("traits"), 6000), skills_line(out))
    for k, limit in (("en", 80), ("eu", 80), ("source", 60), ("lore", 1500)):
        if get(k):
            out[k] = _txt(get(k), limit)
    portrait = get("portrait")
    if isinstance(portrait, str) and UPLOAD.match(portrait):
        out["portrait"] = portrait
    look = get("look")
    if isinstance(look, dict) and len(json.dumps(look)) < 4000:
        out["look"] = look
    color = get("color")
    if isinstance(color, str) and re.match(r"^#[0-9a-fA-F]{6}$", color):
        out["color"] = color
    return out


def catalog(docs) -> list:
    """El bestiario con las ediciones de la mesa: las que tienen «base» sustituyen a su criatura (que conserva su
    key, así las fichas enlazadas la siguen encontrando); las demás son criaturas nuevas («custom»)."""
    docs = [d for d in docs if isinstance(d, dict) and d.get("id")]
    edits = {d["base"]: d for d in docs if d.get("base") in BY_KEY}
    out = []
    for m in BASE:
        d = edits.get(m["key"])
        out.append({**clean(d, m), "key": m["key"], "edited": True, "editId": d["id"]} if d else m)
    for d in docs:
        if d.get("base") not in BY_KEY:
            out.append({**clean(d), "key": f"custom-{d['id']}", "custom": True, "editId": d["id"]})
    return out
