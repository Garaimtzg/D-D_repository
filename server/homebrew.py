"""Especies, clases y trasfondos propios (colección «homebrew»).

Se guardan tal cual las escribe el editor y aquí se convierten a la misma forma que las del Manual del Jugador
(phb2024), así el creador de personajes, la ficha y la subida de nivel las usan sin casos especiales. Todo lo que
llega del usuario se recorta y se valida: un dato raro se ignora en vez de romper la referencia.
"""
from . import phb2024

ABILITIES = ("fue", "des", "con", "int", "sab", "car")
SIZES = ("Pequeño", "Mediano", "Mediano o Pequeño", "Grande")
RESETS = ("corto", "largo")
CASTERS = {"full": phb2024.PREP_FULL, "half": phb2024.PREP_HALF,
           "pact": [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15]}
ARMOR = ("ligera", "media", "pesada", "escudo")
WEAPONS = ("sencilla", "marcial")
ARMOR_TEXT = {"ligera": "ligeras", "media": "medias", "pesada": "pesadas"}


def _txt(value, limit=200):
    return str(value or "").strip()[:limit]


def _num(value, lo, hi, default):
    try:
        n = float(value)
    except (TypeError, ValueError):
        return default
    n = max(lo, min(hi, n))
    return int(n) if n == int(n) else n


def _list(value):
    return value if isinstance(value, list) else []


def _uses(value):
    """Usos de un recurso: un número, «pb» (bonificador por competencia) o «mod:xxx» (modificador de característica)."""
    if value == "pb" or (isinstance(value, str) and value.startswith("mod:") and value[4:] in ABILITIES):
        return value
    return _num(value, 1, 20, 1)


def _skills(value):
    return [k for k in _list(value) if k in phb2024.ALL_SKILLS]


def species(doc: dict) -> dict:
    spell_names = {s["name"] for s in phb2024.SPELLS}
    traits = [[_txt(t.get("name"), 80), _txt(t.get("text"), 800)] for t in _list(doc.get("traits")) if isinstance(t, dict) and _txt(t.get("name"))]
    creature = _txt(doc.get("creature"), 60)
    if creature and creature.lower() != "humanoide":
        traits.insert(0, ["Tipo de criatura", f"{creature}."])
    out = {
        "id": f"hb-{doc['id']}", "homebrew_id": doc["id"], "name": _txt(doc.get("name"), 60) or "Especie sin nombre",
        "origin": "Personalizada", "group": "Personalizadas", "summary": _txt(doc.get("summary"), 300),
        "size": doc.get("size") if doc.get("size") in SIZES else "Mediano",
        "speed": _num(doc.get("speed"), 1.5, 30, 9), "darkvision": _num(doc.get("darkvision"), 0, 120, 0),
        "traits": traits,
        "skills": _skills(doc.get("skills")),
        "spells": [[_num(s.get("level"), 1, 20, 1), s["name"], *([_uses(s["uses"])] if s.get("uses") else [])]
                   for s in _list(doc.get("spells")) if isinstance(s, dict) and s.get("name") in spell_names],
        "resources": [[_txt(r.get("name"), 60), _uses(r.get("uses")), r.get("reset") if r.get("reset") in RESETS else "largo", _num(r.get("level"), 1, 20, 1)]
                      for r in _list(doc.get("resources")) if isinstance(r, dict) and _txt(r.get("name"))],
    }
    if _txt(doc.get("tool")):
        out["tool"] = _txt(doc.get("tool"), 80)
    choice = _skills(doc.get("skill_choice"))
    count = _num(doc.get("skill_count"), 0, 4, 0)
    if count:
        out["skill_choice"] = choice or "any"
        out["skill_count"] = count
    if _num(doc.get("natural_ac"), 0, 20, 0):
        out["natural_ac"] = _num(doc.get("natural_ac"), 10, 20, 13)
    if doc.get("hp_per_level"):
        out["hp_per_level"] = 1
    return out


def _features(entries):
    return [[_num(f.get("level"), 1, 20, 1), _txt(f.get("name"), 80), _txt(f.get("text"), 800)]
            for f in _list(entries) if isinstance(f, dict) and _txt(f.get("name"))]


def klass(doc: dict) -> dict:
    name = _txt(doc.get("name"), 60) or "Clase sin nombre"
    caster = doc.get("caster") if doc.get("caster") in CASTERS else None
    primary = [a for a in _list(doc.get("primary")) if a in ABILITIES][:2] or ["fue"]
    saves = [a for a in _list(doc.get("saves")) if a in ABILITIES][:2] or ["fue", "con"]
    sub_level = _num(doc.get("subclass_level"), 1, 20, 3)
    own = _features(doc.get("features"))
    subclasses = [(_txt(s.get("name"), 60), _features(s.get("features"))) for s in _list(doc.get("subclasses")) if isinstance(s, dict) and _txt(s.get("name"))]

    table = {lvl: [] for lvl in range(1, 21)}
    for lvl, fname, _ in own:
        table[lvl].append(fname)
    if subclasses:
        table[sub_level].append(f"Subclase de {name.lower()}")
        for lvl in sorted({lvl for _, feats in subclasses for lvl, _, _ in feats if lvl > sub_level}):
            table[lvl].append("Rasgo de subclase")
    if doc.get("asi", True):
        for lvl in (4, 8, 12, 16):
            table[lvl].append("Mejora de característica")
        table[19].append("Don épico")
    order = sorted(primary + [a for a in ("con", "des", "sab", "int", "car", "fue") if a not in primary], key=lambda a: (a not in primary,))
    standard = dict(zip(order, phb2024.STANDARD_ARRAY))
    armor = [a for a in _list(doc.get("armor_training")) if a in ARMOR]
    weapons = [w for w in _list(doc.get("weapon_training")) if w in WEAPONS]
    cantrips = _num(doc.get("cantrips"), 0, 6, 0) if caster else 0
    spell_list = _txt(doc.get("spell_list"), 40)
    return {
        "id": f"hb-{doc['id']}", "homebrew_id": doc["id"], "name": name, "page": None, "origin": "Personalizada",
        "gold": _num(doc.get("gold"), 0, 1000, 100), "hit_die": doc.get("hit_die") if doc.get("hit_die") in (6, 8, 10, 12) else 8,
        "primary": primary, "complexity": "Personalizada", "summary": _txt(doc.get("summary"), 300) or "Clase creada para esta campaña.",
        "saves": saves, "skills": {"choose": _num(doc.get("skills_choose"), 0, 6, 2), "from": _skills(doc.get("skills_from")) or list(phb2024.ALL_SKILLS)},
        "weapons": ("Armas " + " y ".join("sencillas" if w == "sencilla" else "marciales" for w in weapons)) if weapons else "Ninguna",
        "armor": ", ".join((["Armaduras " + " y ".join(ARMOR_TEXT[a] for a in armor if a != "escudo")] if set(armor) - {"escudo"} else [])
                           + (["escudos"] if "escudo" in armor else [])) or "Ninguna",
        "tools": _txt(doc.get("tools"), 120), "armor_training": armor, "weapon_training": weapons,
        "caster": caster, "spell_ability": doc.get("spell_ability") if caster and doc.get("spell_ability") in ABILITIES else (None if not caster else "int"),
        "spell_list": spell_list or None, "standard": standard,
        **({"cantrips": [cantrips + (lvl >= 4) + (lvl >= 10) for lvl in range(1, 21)]} if cantrips else {}),
        **({"prepared": CASTERS[caster]} if caster else {}),
        **({"masteries": [_num(doc.get("masteries"), 0, 6, 0)] * 20} if _num(doc.get("masteries"), 0, 6, 0) else {}),
        "columns": {},
        "resources": [{"name": _txt(r.get("name"), 60), "uses": _uses(r.get("uses")), "reset": r.get("reset") if r.get("reset") in RESETS else "largo",
                       **({"from": _num(r.get("level"), 1, 20, 1)} if _num(r.get("level"), 1, 20, 1) > 1 else {})}
                      for r in _list(doc.get("resources")) if isinstance(r, dict) and _txt(r.get("name"))],
        "subclasses": [s for s, _ in subclasses], "subclass_level": sub_level,
        "features": {lvl: names for lvl, names in table.items() if names},
        "feature_text": {**phb2024.COMMON, f"Subclase de {name.lower()}": phb2024.SUBCLASS_PICK, **{fname: text for _, fname, text in own}},
        "subclass_features": {s: feats for s, feats in subclasses},
        "subclass_source": {s: "Personalizada" for s, _ in subclasses},
        "choice": None, "style_level": None, "expertise": [], "kits": [], "subclass_unarmored": {},
    }


# Dotes de origen que puede dar un trasfondo (Iniciado en la magia con su lista, como en el manual)
ORIGIN_FEATS = [f["name"] for f in phb2024.FEATS if f["category"] == "origen" and f["name"] != "Iniciado en la magia"] +     [f"Iniciado en la magia ({lst})" for lst in ("clérigo", "druida", "mago")]


def background(doc: dict) -> dict:
    """Trasfondo propio con la misma forma que los de 2024: tres características, una dote de origen, dos habilidades,
    una herramienta y el equipo (o 50 po)."""
    abilities = list(dict.fromkeys(a for a in _list(doc.get("abilities")) if a in ABILITIES))[:3]
    abilities += [a for a in ABILITIES if a not in abilities][:3 - len(abilities)]
    skills = list(dict.fromkeys(_skills(doc.get("skills"))))[:2]
    items = []
    for line in str(doc.get("equipment") or "").splitlines()[:20]:
        qty, _, name = line.strip().partition(" ")
        if qty.isdigit() and name.strip():
            items.append([min(int(qty), 99), _txt(name, 80)])
        elif line.strip():
            items.append([1, _txt(line, 80)])
    return {
        "id": f"hb-{doc['id']}", "homebrew_id": doc["id"], "name": _txt(doc.get("name"), 60) or "Trasfondo sin nombre",
        "origin": "Personalizado", "summary": _txt(doc.get("summary"), 300),
        "abilities": [a for a in ABILITIES if a in abilities],
        "feat": doc.get("feat") if doc.get("feat") in ORIGIN_FEATS else "Habilidoso",
        "skills": skills, "tool": _txt(doc.get("tool"), 80) or "Una herramienta a elegir",
        "kit": {"items": items, "gold": _num(doc.get("gold"), 0, 50, 0)}, "kit_gold": 50,
    }


def merge(reference: dict, docs: list) -> dict:
    """Añade a la referencia las especies, clases y trasfondos propios guardados."""
    for doc in docs:
        if not isinstance(doc, dict) or "id" not in doc:
            continue
        if doc.get("kind") == "species":
            reference["species"].append(species(doc))
        elif doc.get("kind") == "class":
            reference["classes"].append(klass(doc))
        elif doc.get("kind") == "background":
            reference["backgrounds"].append(background(doc))
    return reference
