"""Saca del texto del Manual del Jugador 2024 los datos de cada conjuro (no su descripción).

Uso: python extract_spells.py spells_raw.txt salida.json primera_pagina_pdf
(spells_raw.txt sale de: pdftotext -raw -enc UTF-8 -f 238 -l 345 manual.pdf spells_raw.txt)
Datos: nombre, nivel, escuela, clases, tiempo, ritual, alcance, componentes, coste del material,
duración, concentración, salvación, tipo de ataque, dados de daño o curación y página.
"""
import json
import re
import sys

SCHOOLS = "Abjuración|Adivinación|Conjuración|Encantamiento|Evocación|Ilusionismo|Ilusión|Nigromancia|Transmutación"
HEAD = re.compile(rf"^(?:(?P<school>{SCHOOLS}) de nivel\s*(?P<lvl>\d)|Truco de (?P<cschool>{SCHOOLS.lower()}))\s*\((?P<classes>[^)]+)\)", re.M)
ABIL = "Fuerza|Destreza|Constitución|Inteligencia|Sabiduría|Carisma"
FIXES = {"Escupo": "Escudo", "A los aventureros para la grandeza favor divino": "Favor divino",
         "A una corte vampírica localizar objeto": "Localizar objeto", "As alterar los recuerdos": "Alterar los recuerdos",
         "Mole sombría arma espiritual": "Arma espiritual", "Una poción mágica calmar emociones": "Calmar emociones"}
PROPER = {"bigby", "leomund", "drawmij", "mordenkainen", "otiluke", "tasha", "evard", "melf", "nystul", "rary", "tenser", "jallarzi", "otto", "yolande", "agathys", "hadar"}
DAMAGE_TYPES = {"ácido", "contundente", "cortante", "frío", "fuego", "fuerza", "necrótico", "perforante", "psíquico", "radiante", "relámpago", "trueno", "veneno"}
DAMAGE_FIX = {"Proyectil mágico": "1d4+1 fuerza"}  # en el PDF el dado sale mal reconocido
JUNK = re.compile(r"^(?:cap[ií]tulo 7 \| conjuros|\d+ xx|\d+|pg|\||“|\")\s*", re.I)  # cabeceras, números de página, comillas


def sentence(name):
    name = re.sub(r"\s+", " ", name.strip())
    while JUNK.match(name):
        name = JUNK.sub("", name, count=1)
    name = name[:1].upper() + name[1:].lower()
    name = " ".join(w.capitalize() if w in PROPER else w for w in name.split(" "))
    return FIXES.get(name, name)


def is_name(line):
    return 0 < len(line) <= 45 and not re.search(r"[.:;,)]$", line)


def field(text, label, nxt):
    m = re.search(rf"{label}\S*:\s*(.+?)\s*(?:{nxt}\S*:|$)", text, re.S)
    return re.sub(r"\s+", " ", m.group(1)).strip() if m else ""


def main(src, dst, first):
    pages = open(src, encoding="utf-8").read().split("\f")
    text, page_at = "", []
    for i, pg in enumerate(pages):
        text += pg + "\n"
        page_at.append((len(text), int(first) - 2 + i))  # el PDF va 2 páginas por delante del libro

    def page_of(pos):
        return next(book for end, book in page_at if pos < end)

    heads = list(HEAD.finditer(text))
    out = []
    for k, m in enumerate(heads):
        before = text[:m.start()].rstrip().split("\n")
        name = before[-1].strip()
        if not is_name(name):  # el nombre va justo encima del encabezado
            continue
        prev = before[-2].strip() if len(before) > 1 else ""
        if prev and is_name(prev) and sum(ch.islower() for ch in prev) <= 2:  # nombre en dos líneas
            name = f"{prev} {name}"
        end = heads[k + 1].start() if k + 1 < len(heads) else len(text)
        body = text[m.end():end]
        time = field(body, "Tiempo de lanzam", "Alcance")
        rng = field(body, "Alcance", "Componentes")
        comp_full = field(body, "Componentes", "Duración")
        dur_m = re.search(r"Duración:\s*([^\n]+)", body)
        dur, desc = "", body
        if dur_m:
            dur, desc = dur_m.group(1).strip(), body[dur_m.end():]
            if re.search(r"(hasta|,)$", dur):  # la duración sigue en la línea siguiente
                nxt = desc.lstrip("\n").split("\n", 1)
                dur, desc = f"{dur} {nxt[0].strip()}", nxt[1] if len(nxt) > 1 else ""
        flat = re.sub(r"\s+", " ", desc)
        cost = re.search(r"(\d[\d.]*) po", comp_full)
        letters = ", ".join(x for x in ("V", "S", "M") if re.search(rf"(^|[ ,]){x}([ ,(]|$)", comp_full))
        save = re.search(rf"salvación de ({ABIL})", flat)
        attack = "cac" if "ataque de conjuro cuerpo a cuerpo" in flat else "dist" if "ataque de conjuro a distancia" in flat else ""
        dmg = re.search(r"(\d+d\d+(?:\s*\+\s*\d+)?)\s+de\s+daño\s+(?:de\s+)?(?!adicional|extra|que|por|igual)(\w+)", flat)  # el daño principal
        time = re.sub(r"\s*,?\s*o\s*(?:un\s+)?ritual", "", time.replace("adicionál", "adicional"))
        if time.startswith("Reacción"):
            time = "Reacción"
        if rng.startswith("Lanzador"):
            rng = rng.split(" (")[0] if "(" in rng[:20] else "Lanzador"
        heal = re.search(r"recupera[^.]{0,60}?(\d+d\d+)", flat)
        out.append({
            "name": sentence(name),
            "level": int(m.group("lvl") or 0),
            "school": m.group("school") or m.group("cschool").capitalize(),
            "classes": [c.strip().capitalize() for c in re.sub(r"\s+", " ", m.group("classes")).split(",")],
            "time": re.sub(r"[^\wáéíóúñ)]+$", "", re.sub(r",? o ritual", "", time).split(", que realizas")[0])[:60],
            "ritual": "ritual" in time,
            "range": re.sub(r"\s*[*|].*$", "", rng)[:40].replace("36m", "36 m"),
            "components": letters,
            "cost": f"{cost.group(1)} po{' (se consume)' if 'consume' in comp_full else ''}" if cost else "",
            "duration": dur.rstrip(" ."),
            "concentration": dur.startswith("Concentración"),
            "save": save.group(1) if save else "",
            "attack": attack,
            "damage": DAMAGE_FIX.get(sentence(name)) or (f"{dmg.group(1).replace(' ', '')} {dmg.group(2).lower().rstrip('y')}" if dmg and dmg.group(2).lower().rstrip('y') in DAMAGE_TYPES else ""),
            "heal": heal.group(1) if heal and not dmg else "",
            "page": page_of(m.start()),
        })
    out.sort(key=lambda s: s["name"])
    json.dump(out, open(dst, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print(len(out), "conjuros")


if __name__ == "__main__":
    main(*sys.argv[1:])
