import io
import json
import math
import random
import re
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
import zipfile
from pathlib import Path

from collections import deque

from server import dice, generators, rules, scenes
from server.handler import make_server
from server.storage import JsonStore


class DiceTests(unittest.TestCase):
    def test_simple_expression(self):
        r = dice.roll("2d6+3", rng=random.Random(1))
        self.assertEqual(r["total"], sum(r["parts"][0]["rolls"]) + 3)

    def test_keep_highest(self):
        r = dice.roll("4d6kh3", rng=random.Random(2))
        rolls = r["parts"][0]["rolls"]
        self.assertEqual(r["total"], sum(sorted(rolls)[1:]))

    def test_advantage_converts_d20(self):
        r = dice.roll("1d20+2", mode="adv", rng=random.Random(3))
        part = r["parts"][0]
        self.assertEqual(len(part["rolls"]), 2)
        self.assertEqual(r["natural"], max(part["rolls"]))
        self.assertEqual(r["total"], max(part["rolls"]) + 2)

    def test_disadvantage(self):
        r = dice.roll("d20", mode="dis", rng=random.Random(4))
        self.assertEqual(r["total"], min(r["parts"][0]["rolls"]))

    def test_percentile_and_negative(self):
        r = dice.roll("d%-1d4", rng=random.Random(5))
        self.assertEqual(r["parts"][0]["sides"], 100)
        self.assertLess(r["parts"][1]["value"], 0)

    def test_errors(self):
        for bad in ["", "hola", "1d20*3", "500d6", "1d1"]:
            with self.assertRaises(dice.DiceError, msg=bad):
                dice.roll(bad)

    def test_physical_dice(self):
        r = dice.roll("1d20+5", mode="adv", given=[[4, 20]])
        self.assertEqual((r["total"], r["natural"], r["crit"], r["physical"]), (25, 20, "critico", True))
        r = dice.roll("8d6+1d4+2", given=[{"sum": 29}, [3]])
        self.assertEqual(r["total"], 34)
        self.assertEqual((sum(r["parts"][0]["rolls"]), r["parts"][0]["sum"]), (29, True))
        self.assertEqual(dice.roll("4d6kh3", given=[[1, 6, 5, 3]])["total"], 14)
        for bad in ([[21]], [[0]], [[3, 4]], [], [[3], [4]], [{"sum": 21}], [True], "3"):
            with self.assertRaises(dice.DiceError, msg=bad):
                dice.roll("1d20", given=bad)
        with self.assertRaises(dice.DiceError):
            dice.roll("4d6kh3", given=[{"sum": 14}])  # «quedarse con» necesita cada dado
        with self.assertRaises(dice.DiceError):
            dice.roll("8d6", given=[{"sum": 49}])


class RulesTests(unittest.TestCase):
    def test_modifiers_and_proficiency(self):
        self.assertEqual(rules.ability_mod(8), -1)
        self.assertEqual(rules.ability_mod(15), 2)
        self.assertEqual(rules.prof_bonus_level(5), 3)
        self.assertEqual(rules.prof_bonus_cr("1/4"), 2)
        self.assertEqual(rules.prof_bonus_cr("10"), 4)
        self.assertEqual(rules.level_for_xp(2700), 4)

    def test_encounter_difficulty_2024_budget(self):
        # 4 personajes de nivel 1 (presupuesto bajo 200, moderado 300, alto 400) contra 4 goblins (50 PX cada uno)
        r = rules.encounter([1, 1, 1, 1], ["1/4"] * 4)
        self.assertEqual(r["xp"], 200)
        self.assertEqual(r["difficulty"], "bajo")
        self.assertEqual(r["budget"], {"bajo": 200, "moderado": 300, "alto": 400})
        self.assertEqual(rules.encounter([1, 1, 1, 1], ["1/2"] * 3)["difficulty"], "moderado")
        self.assertTrue(rules.encounter([1], ["2"])["over_high"])

    def test_unknown_cr(self):
        with self.assertRaises(ValueError):
            rules.encounter([1], ["99"])


class Phb2024Tests(unittest.TestCase):
    def setUp(self):
        from server import phb2024
        self.d = phb2024.data()
        self.skills = {k["key"] for k in self.d["skills"]}

    def test_classes(self):
        classes = self.d["classes"]
        self.assertEqual(len(classes), 13)  # las 12 del manual y el artificiero del MCT
        for c in classes:
            self.assertIn(c["hit_die"], (6, 8, 10, 12), c["name"])
            official = [x for x in c["subclasses"] if c["subclass_source"][x] == "Manual del Jugador 2024"]
            self.assertEqual(len(official if c["id"] != "artificiero" else c["subclasses"]), 4, c["name"])
            self.assertTrue(c["features"][1], c["name"])
            self.assertEqual(len(c["saves"]), 2)
            self.assertTrue(set(c["skills"]["from"]) <= self.skills, c["name"])
            self.assertEqual(sorted(c["standard"].values(), reverse=True), self.d["standard_array"], c["name"])
            for col in c.get("columns", {}).values():
                self.assertEqual(len(col), 20, c["name"])
            if c["caster"] in ("full", "half", "pact"):
                self.assertEqual(len(c["prepared"]), 20, c["name"])

    def test_origins(self):
        feats = {f["name"] for f in self.d["feats"]}
        self.assertEqual(len([s for s in self.d["species"] if s.get("page")]), 10)  # y las del MCT y de Euskal Herria
        self.assertEqual(len(self.d["backgrounds"]), 16)
        for b in self.d["backgrounds"]:
            self.assertIn(b["feat"].split(" (")[0], feats, b["name"])
            self.assertTrue(set(b["skills"]) <= self.skills, b["name"])
            self.assertEqual(len(b["abilities"]), 3)
            self.assertGreater(b["kit"]["gold"], 0, b["name"])
        spells = {s["name"] for s in self.d["spells"]}
        for s in self.d["species"]:
            entries = s.get("spells", []) + [e for opt in s.get("lineage_spells", {}).values() for e in opt]
            for _, name, *_ in entries:
                self.assertIn(name, spells, s["name"])
            self.assertTrue(set(s.get("lineage_spells", {})) <= {n for n, _ in s.get("options", [])}, s["name"])

    def test_every_feature_says_what_it_does(self):
        gear = {w["name"] for w in self.d["weapons"]} | {a["name"] for a in self.d["armor"]}
        for c in self.d["classes"]:
            for lvl, names in c["features"].items():
                for f in names:
                    self.assertTrue(f == "Rasgo de subclase" or c["feature_text"].get(f), (c["name"], f))
            self.assertEqual(set(c["subclass_features"]), set(c["subclasses"]), c["name"])
            sub_levels = {int(l) for l, fs in c["features"].items() if "Rasgo de subclase" in fs} | {3}
            for name, feats in c["subclass_features"].items():
                self.assertEqual({l for l, _, _ in feats}, sub_levels, name)
            self.assertTrue(any(n in gear for k in c["kits"] for _, n in k["items"]), c["name"])

    def test_equipment(self):
        masteries = {m["name"] for m in self.d["masteries"]}
        for w in self.d["weapons"]:
            self.assertIn(w["mastery"], masteries, w["name"])
        self.assertEqual(len(self.d["slots"]["full"]), 20)
        self.assertEqual([c["key"] for c in self.d["coins"]], ["pc", "pp", "pe", "po", "ppt"])


class SpellTests(unittest.TestCase):
    def test_spells_from_the_manual(self):
        from server import phb2024
        spells = {s["name"]: s for s in phb2024.SPELLS}
        self.assertGreater(len(spells), 380)
        self.assertEqual(len(spells), len(phb2024.SPELLS))  # sin duplicados
        fb = spells["Bola de fuego"]
        self.assertEqual((fb["level"], fb["save"], fb["damage"], fb["range"]), (3, "Destreza", "8d6 fuego", "45 m"))
        self.assertTrue(spells["Bendición"]["concentration"])
        classes = {c["name"] for c in phb2024.CLASSES}
        for s in phb2024.SPELLS:
            self.assertTrue(0 <= s["level"] <= 9 and s["time"] and s["range"] and s["duration"], s["name"])
            self.assertLessEqual(set(s["classes"]), classes, s["name"])
            self.assertTrue(239 <= s["page"] <= 343, s["name"])
            self.assertTrue(20 <= len(s["summary"]) <= 300, s["name"])  # descripción básica (resumen propio)
        self.assertTrue(spells["Detectar magia"]["ritual"] and not spells["Bola de fuego"]["ritual"])
        self.assertIn("Apariencia", spells)

    def test_spells_the_sheet_grants(self):
        from server import phb2024, spellcasting
        names = {s["name"] for s in phb2024.SPELLS}
        rows = [r for c in phb2024.CLASSES for r in c["class_spells"] + [x for v in c["subclass_spells"].values() for x in v]]
        rows += [r for v in spellcasting.LAND_SPELLS.values() for r in v]
        for lvl, spells in rows:
            self.assertTrue(1 <= lvl <= 20 and spells)
            self.assertLessEqual(set(spells), names)
        for g in spellcasting.FEAT_GRANTS.values():
            self.assertLessEqual({n for n, _ in g.get("spells", [])}, names)
        self.assertEqual(set(spellcasting.ALIASES_2014.values()) - names, set())
        feats = {f["name"] for f in phb2024.FEATS}
        self.assertLessEqual(set(spellcasting.FEAT_GRANTS), feats)
        cleric = next(c for c in phb2024.CLASSES if c["id"] == "clerigo")
        self.assertIn([3, ["Auxilio", "Bendición", "Curar heridas", "Restablecimiento menor"]], cleric["subclass_spells"]["Dominio de la vida"])
        self.assertTrue(cleric["subclass_spells"]["Dominio de la forja"])  # del MCT, leídos de su rasgo
        fighter = next(c for c in phb2024.CLASSES if c["id"] == "guerrero")
        ek = fighter["subclass_casting"]["Caballero arcano"]
        self.assertEqual((ek["caster"], len(ek["cantrips"]), len(ek["prepared"])), ("third", 20, 20))
        self.assertEqual(len(spellcasting.THIRD_SLOTS), 20)
        subs = {s for c in phb2024.CLASSES for s in c["subclasses"]}
        self.assertLessEqual(set(spellcasting.SUBCLASS_RESOURCES) | set(spellcasting.SUBCLASS_SPELLS), subs)
        items = {m["name"]: m for m in phb2024.MAGIC_ITEMS}
        self.assertLessEqual(set(spellcasting.ITEM_CHARGES), set(items))
        self.assertEqual((items["Varita de bolas de fuego"]["charges"], items["Varita de bolas de fuego"]["regain"]), (7, "1d6+1"))


class BestiaryTests(unittest.TestCase):
    def test_srd_bestiary_in_spanish(self):
        from server.monsters import MONSTERS
        self.assertGreater(len(MONSTERS), 300)
        names = [m["name"] for m in MONSTERS]
        self.assertEqual(len(names), len(set(names)))
        red = next(m for m in MONSTERS if m["name"] == "Dragón rojo adulto")
        self.assertEqual((red["ac"], red["hp"], red["cr"], red["size"]), (19, 256, "17", "Enorme"))
        breath = next(a for a in red["attacks"] if a["name"].startswith("Aliento de fuego"))
        self.assertEqual((breath["save"], breath["damage"]), ("DES CD 21", "17d6"))
        english = ("Bite", "Claw", "Multiattack", "damage", "Saving Throw", " ft.")
        for m in MONSTERS:
            self.assertEqual(set(m["abilities"]), {"fue", "des", "con", "int", "sab", "car"}, m["name"])
            self.assertIn(m["cr"], rules.CR_XP, m["name"])
            self.assertLessEqual(set(m["saves"]), {"fue", "des", "con", "int", "sab", "car"}, m["name"])
            for a in m["attacks"]:
                self.assertTrue(isinstance(a["bonus"], int) or a.get("save"), (m["name"], a))
            text = m["traits"] + " ".join(a["name"] + a["notes"] for a in m["attacks"])
            for word in english:
                self.assertNotIn(word, text, m["name"])


# Guía del Dungeon Master, «Estadísticas de monstruo por valor de desafío»: VD, CA, PG máx., ataque, daño por asalto máx., CD
CR_TABLE = [
    ("0", 13, 6, 3, 1, 13), ("1/8", 13, 35, 3, 3, 13), ("1/4", 13, 49, 3, 5, 13), ("1/2", 13, 70, 3, 8, 13),
    ("1", 13, 85, 3, 14, 13), ("2", 13, 100, 3, 20, 13), ("3", 13, 115, 4, 26, 13), ("4", 14, 130, 5, 32, 14),
    ("5", 15, 145, 6, 38, 15), ("6", 15, 160, 6, 44, 15), ("7", 15, 175, 6, 50, 15), ("8", 16, 190, 7, 56, 16),
    ("9", 16, 205, 7, 62, 16), ("10", 17, 220, 7, 68, 16), ("11", 17, 235, 8, 74, 17), ("12", 17, 250, 8, 80, 17),
    ("13", 18, 265, 8, 86, 18), ("14", 18, 280, 8, 92, 18), ("15", 18, 295, 8, 98, 18), ("16", 18, 310, 9, 104, 18),
    ("17", 19, 325, 10, 110, 19), ("18", 19, 340, 10, 116, 19), ("19", 19, 355, 10, 122, 19), ("20", 19, 400, 10, 140, 19),
    ("21", 19, 445, 11, 158, 20), ("22", 19, 490, 11, 176, 20), ("23", 19, 535, 11, 194, 20), ("24", 19, 580, 12, 212, 21),
]


def average(expr):
    """Daño medio de una expresión como «2d8+5+2d6»."""
    total = 0.0
    for sign, n, die, flat in re.findall(r"([+-]?)(?:(\d+)d(\d+)|(\d+))", expr.replace(" ", "")):
        v = int(n) * (int(die) + 1) / 2 if die else int(flat)
        total += -v if sign == "-" else v
    return total


def estimate_cr(m):
    """VD según la Guía del DM: media del VD defensivo (PG efectivos y CA) y el ofensivo (daño por asalto y ataque)."""
    cr = next(i for i, row in enumerate(CR_TABLE) if row[0] == m["cr"])
    tier = lambda by: 0 if by <= 7 else 1 if by <= 13 else 2 if by <= 19 else 3  # VD 1-4, 5-10, 11-16, 17+
    ehp = m["hp"] * ((2, 1.5, 1.25, 1)[tier(cr)] if m.get("resist") else 1) + m.get("lr", 0) * (10, 20, 30, 40)[tier(cr)]
    d = next(i for i, row in enumerate(CR_TABLE) if ehp <= row[2])
    d += math.trunc((m["ac"] - CR_TABLE[d][1]) / 2)
    hits = [a for a in m["attacks"] if a.get("per_turn") and not a.get("save")]
    routine = sum(average(a["damage"]) * a["per_turn"] for a in hits)
    bursts = [average(a["damage"]) * (2 if a.get("area") else 1) for a in m["attacks"] if a.get("save") and "recarga" in a["name"]]
    dpr = max([routine] + [(b + 2 * routine) / 3 for b in bursts])  # recarga: se usa una vez cada tres asaltos
    o = next(i for i, row in enumerate(CR_TABLE) if dpr <= row[4])
    o += math.trunc((max(a["bonus"] for a in hits) - CR_TABLE[o][3]) / 2)
    return round((d + o) / 2), cr


class EuskalTests(unittest.TestCase):
    def test_creatures_follow_the_dmg_challenge_table(self):
        from server.euskal import CREATURES
        self.assertGreaterEqual(len(CREATURES), 15)
        for m in CREATURES:
            got, want = estimate_cr(m)
            self.assertLessEqual(abs(got - want), 1, f"{m['name']}: VD {m['cr']} declarado, el cálculo da {CR_TABLE[got][0]}")
            abil = m["abilities"]
            pb = rules.prof_bonus_cr(m["cr"])
            for a in m["attacks"]:  # el bonificador sale de una característica más la competencia
                if not a.get("save"):
                    self.assertIn(a["bonus"] - pb, [(v - 10) // 2 for v in abil.values()], (m["name"], a["name"]))

    def test_estimator_on_official_monster(self):
        from server.monsters import MONSTERS
        giant = next(m for m in MONSTERS if m["name"] == "Gigante de las colinas")
        club = dict(giant["attacks"][0], per_turn=2)  # Multiataque: 2 garrotes
        self.assertEqual(CR_TABLE[estimate_cr({**giant, "attacks": [club]})[0]][0], "5")

    def test_playable_species(self):
        from server.euskal import SPECIES
        from server.phb2024 import SPELLS, data
        names = {s["name"] for s in SPELLS}
        self.assertTrue({s["id"] for s in SPECIES} <= {s["id"] for s in data()["species"]})
        for s in SPECIES:
            self.assertTrue(4 <= len(s["traits"]) <= 5, s["id"])
            for lvl, spell, *uses in s.get("spells", []):
                self.assertIn(spell, names, s["id"])
            for name, uses, reset, lvl in s.get("resources", []):
                self.assertIn(reset, ("corto", "largo"))


class MctTests(unittest.TestCase):
    """Material del «Manual para casi todo» adaptado a 2024 y contenido propio."""

    def test_species_fill_gaps_without_overriding_2024(self):
        from server import mct, phb2024
        official = {s["name"].split(" (")[0].lower() for s in phb2024.SPECIES}
        skills = set(phb2024.ALL_SKILLS)
        ids = [s["id"] for s in mct.SPECIES]
        self.assertEqual(len(ids), len(set(ids)))
        self.assertTrue({"firbolg", "hada", "genasi", "tabaxi"} <= set(ids))
        for s in mct.SPECIES:
            self.assertNotIn(s["name"].split(" (")[0].lower(), official, "2024 prevalece")
            self.assertEqual(s["speed"] * 2 % 3, 0, s["name"])  # metros: múltiplos de 1,5
            self.assertIn(s["darkvision"], (0, 18, 36), s["name"])
            for k in s.get("skills", []) + (s["skill_choice"] if isinstance(s.get("skill_choice"), list) else []):
                self.assertIn(k, skills, s["name"])
            for name, uses, reset, lvl in s.get("resources", []) + [r for rs in s.get("lineage_resources", {}).values() for r in rs]:
                self.assertTrue(uses == "pb" or isinstance(uses, int), s["name"])
                self.assertIn(reset, ("corto", "largo"))
            self.assertTrue(set(s.get("lineage_speed", {})) <= {n for n, _ in s.get("options", [])}, s["name"])

    def test_subclasses_and_artificer(self):
        from server import mct_classes, phb2024
        d = phb2024.data()
        for cid, subs in mct_classes.SUBCLASSES.items():
            for name in subs:
                self.assertIn(name, mct_classes.SOURCE, name)
        art = next(c for c in d["classes"] if c["id"] == "artificiero")
        self.assertEqual((art["caster"], art["spell_ability"], art["hit_die"]), ("half", "int", 8))
        self.assertGreater(sum("Artificiero" in s["classes"] for s in d["spells"]), 60)
        cleric = next(c for c in d["classes"] if c["id"] == "clerigo")
        self.assertIn("Dominio de la tempestad", cleric["subclasses"])
        self.assertNotIn(8, {l for feats in cleric["subclass_features"].values() for l, _, _ in feats})  # 2024: Golpes benditos

    def test_homebrew_is_normalised(self):
        from server import homebrew, rules
        ref = homebrew.merge(rules.reference(), [
            {"id": "s1", "kind": "species", "name": "Ent", "size": "Gigante", "speed": "rápido", "creature": "Planta",
             "traits": [{"name": "Corteza", "text": "Dura"}, {"text": "sin nombre"}], "skill_count": 1, "skill_choice": ["naturaleza", "nada"],
             "spells": [{"level": 3, "name": "Piel robliza", "uses": 1}, {"level": 1, "name": "Inventado"}],
             "resources": [{"name": "Raíces", "uses": "pb", "reset": "siempre"}]},
            {"id": "c1", "kind": "class", "name": "Tamborilero", "hit_die": 7, "caster": "half", "spell_ability": "car", "cantrips": 2,
             "features": [{"level": 1, "name": "Ritmo", "text": "x"}], "subclasses": [{"name": "Bombo", "features": [{"level": 3, "name": "Golpe", "text": "y"}]}]},
            {"id": "b1", "kind": "background", "name": "Pastor", "abilities": ["sab", "con", "sab", "fue", "car"], "feat": "Inventada",
             "skills": ["trato_animales", "supervivencia", "sigilo"], "equipment": "Cayado\n2 Mantas\n\n", "gold": 900},
            {"kind": "class"}, "basura"])
        sp, cl, bg = ref["species"][-1], ref["classes"][-1], ref["backgrounds"][-1]
        self.assertEqual((bg["id"], bg["abilities"], bg["feat"], bg["skills"]), ("hb-b1", ["fue", "con", "sab"], "Habilidoso", ["trato_animales", "supervivencia"]))
        self.assertEqual((bg["kit"], bg["kit_gold"]), ({"items": [[1, "Cayado"], [2, "Mantas"]], "gold": 50}, 50))
        from server import phb2024
        for s in ref["species"][:-1]:  # todas las del manual, el MCT y Euskal Herria tienen su descripción (la propia usa su resumen)
            self.assertTrue(len(s["lore"]) > 60 and s["height"] and s["lifespan"], s["id"])
        bigger = {s["id"] for s in ref["species"] if s.get("carry_bigger")}  # cuentan un tamaño más para la carga
        self.assertTrue({"goliat", "firbolg", "osgo"} <= bigger and "humano" not in bigger)
        self.assertIn("Capacidad de carga", {r["name"] for r in ref["rules"]})
        self.assertEqual(len(phb2024.BACKGROUNDS), 16)  # los 16 trasfondos del Manual del Jugador 2024
        feats = {f["name"] for f in phb2024.FEATS}
        for b in phb2024.BACKGROUNDS:
            self.assertIn(b["feat"].split(" (")[0], feats, b["name"])
        self.assertEqual((sp["id"], sp["size"], sp["speed"], sp["traits"][0][0]), ("hb-s1", "Mediano", 9, "Tipo de criatura"))
        self.assertEqual((sp["spells"], sp["skill_choice"], sp["resources"][0][2]), ([[3, "Piel robliza", 1]], ["naturaleza"], "largo"))
        self.assertEqual((cl["id"], cl["hit_die"], cl["caster"]), ("hb-c1", 8, "half"))
        self.assertIn("Subclase de tamborilero", cl["features"][3])
        self.assertEqual(cl["features"][19], ["Don épico"])
        self.assertEqual(cl["cantrips"][3], 3)


class GauekoTests(unittest.TestCase):
    def test_tables_use_real_creatures(self):
        from server import gaueko
        from server.euskal import CREATURES
        names = {c["name"] for c in CREATURES}
        entries = [e for lists in (gaueko.ENCOUNTERS, gaueko.DANGERS) for es in lists.values() for e in es]
        entries += [gaueko.GAUEKO, gaueko.GAUEKO_DOOR, gaueko.OLENTZERO, gaueko.SANJUAN_LAMIAS, gaueko.AATXE]
        for e in entries:
            for name, mode in e["creatures"]:
                self.assertIn(name, names, e["title"])
                self.assertIn(mode, ("uno", "grupo"))
        places = set(gaueko.TERRAINS) | {"casa"}
        for table in (gaueko.ENCOUNTERS, gaueko.DANGERS, gaueko.OMENS):
            self.assertTrue(places <= set(table), table)

    def test_night_bands_and_special_nights(self):
        from server import gaueko
        rng = random.Random(7)
        ctx = {"terrain": "bosque", "situation": "acampada"}
        self.assertEqual([gaueko.resolve(t, ctx, [3] * 4, rng)["band"] for t in (1, 9, 10, 14, 18, 21)],
                         ["calma", "calma", "presagio", "encuentro", "peligro", "gaueko"])
        self.assertEqual(gaueko.resolve(2, {**ctx, "challenged": True}, [3] * 4, rng)["title"], "Gaueko")
        self.assertEqual(gaueko.resolve(25, {**ctx, "situation": "casa"}, [3] * 4, rng)["title"], "Gaueko llama a la puerta")
        self.assertTrue(gaueko.resolve(15, {**ctx, "festival": "olentzero"}, [3] * 4, rng)["friendly"])
        self.assertEqual(gaueko.resolve(11, {"terrain": "rio", "festival": "sanjuan"}, [3] * 4, rng)["title"], "Lamias de San Juan")
        mods = dict(gaueko.modifiers({"terrain": "caserio", "situation": "viaje", "moon": "llena", "eguzkilore": True, "festival": "sanjuan"}))
        self.assertEqual(sum(mods.values()), 2 + 2 - 4 - 4)

    def test_encounters_fit_the_party(self):
        from server import gaueko
        for levels in ([1] * 4, [5] * 4, [10] * 5):
            budget = rules.encounter(levels, [])["budget"]["moderado"]
            for place, entries in gaueko.ENCOUNTERS.items():
                for e in entries:
                    got = gaueko._scale(e, levels, "moderado")
                    crs = [c["cr"] for c in got for _ in range(c["count"])]
                    if any(c["count"] > 1 for c in got):  # si se ha añadido alguno, cabe en el presupuesto
                        self.assertLessEqual(rules.encounter(levels, crs)["xp"], budget, (place, e["title"], levels))


class GeneratorTests(unittest.TestCase):
    def test_all_generators_return_text(self):
        for kind in generators.GENERATORS:
            out = generators.generate(kind, {}, random.Random(7))
            self.assertTrue(out["title"])


    def test_tavern_names_agree_in_gender(self):
        for seed in range(60):
            title = generators.tavern(random.Random(seed))["title"]
            article, noun = title.split()[:2]
            gender = dict(generators.TAVERN_A)[noun]
            self.assertEqual(article, "El" if gender == "m" else "La", title)
            if gender == "f":
                self.assertFalse(title.endswith(("Dorado", "Borracho", "Tuerto", "Dormido")), title)


class SceneTests(unittest.TestCase):
    """Los escenarios prediseñados deben ser válidos y jugables."""

    @staticmethod
    def walkable_cells(sc):
        cols, rows, t = sc["cols"], sc["rows"], sc["tiles"]
        blocked = {(p["c"] + i, p["r"] + j) for p in sc["props"] if p["k"] in scenes.BLOCKING
                   for i in range(p.get("w", 1)) for j in range(p.get("h", 1))}

        def ok(x, y):
            if not (0 <= x < cols and 0 <= y < rows):
                return False
            code = t[y * cols + x]
            return scenes.TERRAIN_COST[code] is not None and code not in scenes.HAZARD and (x, y) not in blocked
        return ok

    def test_presets_are_valid(self):
        ids = [sc["id"] for sc in scenes.PRESETS]
        self.assertEqual(len(ids), len(set(ids)))
        self.assertGreaterEqual(len(ids), 8)
        for sc in scenes.PRESETS:
            with self.subTest(sc["id"]):
                self.assertEqual(len(sc["tiles"]), sc["cols"] * sc["rows"])
                self.assertLessEqual(set(sc["tiles"]), scenes.TERRAIN_CODES)
                self.assertIn(sc["light"], [k for k, _ in scenes.LIGHTS])
                for p in sc["props"]:
                    self.assertIn(p["k"], scenes.PROP_CODES)
                    self.assertTrue(0 <= p["c"] and p["c"] + p.get("w", 1) <= sc["cols"])
                    self.assertTrue(0 <= p["r"] and p["r"] + p.get("h", 1) <= sc["rows"])
                self.assertGreaterEqual(len(sc["spawns"]["party"]), 4)
                self.assertGreaterEqual(len(sc["spawns"]["enemies"]), 3)

    def assert_reachable(self, sc):
        ok = self.walkable_cells(sc)
        for x, y in sc["spawns"]["party"] + sc["spawns"]["enemies"]:
            self.assertTrue(ok(x, y), (x, y))
        start = tuple(sc["spawns"]["party"][0])
        seen, queue = {start}, deque([start])
        while queue:
            x, y = queue.popleft()
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    n = (x + dx, y + dy)
                    if n in seen or not ok(*n) or (dx and dy and not ok(x + dx, y) and not ok(x, y + dy)):
                        continue
                    seen.add(n)
                    queue.append(n)
        for e in sc["spawns"]["enemies"]:
            self.assertIn(tuple(e), seen)
        return seen

    def test_party_can_reach_the_enemies(self):
        for sc in scenes.PRESETS:
            with self.subTest(sc["id"]):
                self.assert_reachable(sc)

    def test_random_dungeons_are_playable(self):
        from server import dungeon
        for kind in ("mazmorra", "cueva"):
            for size in dungeon.SIZES:
                for seed in range(1, 9):
                    with self.subTest(kind=kind, size=size, seed=seed):
                        sc = dungeon.generate(seed, size, kind)
                        self.assertEqual(len(sc["tiles"]), sc["cols"] * sc["rows"])
                        self.assertLessEqual(set(sc["tiles"]), scenes.TERRAIN_CODES)
                        seen = self.assert_reachable(sc)
                        if kind == "mazmorra":  # casi todo el suelo libre está conectado: ninguna sala queda aislada
                            ok = self.walkable_cells(sc)
                            free = {(x, y) for y in range(sc["rows"]) for x in range(sc["cols"]) if ok(x, y)}
                            self.assertGreaterEqual(len(seen & free) / len(free), 0.95)
        self.assertEqual(dungeon.generate(5)["tiles"], dungeon.generate(5)["tiles"])

    def test_random_outdoor_scenes_are_playable(self):
        # cada bioma (bosque, río, ciénaga, desierto, nieve, costa, ruinas, volcán) y tamaño: válido, con su clave
        # para el máster y un camino a pie desde el grupo hasta cada casilla de inicio de los enemigos
        from server import dungeon, wilds
        self.assertGreaterEqual(len(wilds.KINDS), 8)
        self.assertEqual({k["key"] for k in dungeon.kinds()}, {"mazmorra", "cueva"} | set(wilds.KINDS))
        moods = {k for k, _ in scenes.MOODS}
        for kind in wilds.KINDS:
            for size in wilds.SIZES:
                for seed in range(1, 6):
                    with self.subTest(kind=kind, size=size, seed=seed):
                        sc = dungeon.generate(seed, size, kind)
                        self.assertEqual(len(sc["tiles"]), sc["cols"] * sc["rows"])
                        self.assertLessEqual(set(sc["tiles"]), scenes.TERRAIN_CODES)
                        self.assertIn(sc["mood"], moods)
                        self.assertIn("Lo que acecha", sc["description"])
                        for p in sc["props"]:
                            self.assertIn(p["k"], scenes.PROP_CODES)
                        self.assertGreaterEqual(len(sc["spawns"]["party"]), 4)
                        self.assertGreaterEqual(len(sc["spawns"]["enemies"]), 3)
                        self.assert_reachable(sc)
            self.assertEqual(dungeon.generate(9, "mediana", kind), dungeon.generate(9, "mediana", kind))

    def test_presets_are_deterministic(self):
        self.assertEqual(scenes._bosque(), scenes._bosque())
        self.assertEqual(scenes._cueva(), scenes._cueva())

    def test_catalog(self):
        cat = scenes.catalog()
        self.assertEqual(cat["cell_m"], 1.5)
        codes = {t["code"] for t in cat["terrain"]}
        self.assertTrue({".", ",", "#", "~", "v", "_"} <= codes)
        self.assertTrue(any(p["light"] for p in cat["props"]))

    def test_presets_have_a_finish(self):
        # acabado de los prediseñados: adornos automáticos, ambiente, viñeta y cuadrícula válidos
        levels = {k for k, _ in scenes.DECOR_LEVELS}
        moods = {k for k, _ in scenes.MOODS}
        grids = {k for k, _ in scenes.GRIDS}
        for sc in scenes.PRESETS:
            with self.subTest(sc["id"]):
                self.assertIn(sc["autoDecor"], levels)
                self.assertIn(sc["mood"], moods)
                self.assertIn(sc["grid"], grids)
                self.assertIsInstance(sc["vignette"], bool)
                for d in sc["decals"]:
                    self.assertIn(d["k"], scenes.DECAL_CODES)
        self.assertGreater(len({sc["mood"] for sc in scenes.PRESETS}), 4)

    def test_catalog_lists_the_decoration(self):
        cat = scenes.catalog()
        self.assertGreaterEqual(len(cat["decals"]), 40)
        self.assertEqual(len({d["code"] for d in cat["decals"]}), len(cat["decals"]))
        self.assertEqual(set(cat["decal_groups"]), {d["group"] for d in cat["decals"]})
        self.assertEqual([lv["key"] for lv in cat["decor_levels"]], ["ninguna", "sutil", "normal", "recargada"])
        self.assertIn("natural", [m["key"] for m in cat["moods"]])
        self.assertEqual(cat["grids"][0]["key"], "linea")


class BestiaryEditTests(unittest.TestCase):
    """Habilidades del bestiario y ediciones de la mesa (criaturas y especies)."""

    def test_monsters_have_keys_and_skills(self):
        from server import monsters
        keys = [m["key"] for m in monsters.BASE]
        self.assertEqual(len(keys), len(set(keys)))
        wolf = monsters.BY_KEY["wolf"]
        # Lobo (VD 1/4, SAB 12, DES 15): Percepción +5 es pericia y Sigilo +4 competencia
        self.assertEqual(wolf["skills"], {"percepcion": 2, "sigilo": 1})
        with_line = [m for m in monsters.BASE if "Habilidades:" in (m.get("traits") or "")]
        self.assertTrue(all(m["skills"] for m in with_line))
        self.assertGreater(len(with_line), 200)

    def test_bestiary_edits_and_new_creatures(self):
        from server import monsters
        docs = [
            {"id": "e1", "base": "wolf", "name": "Lobo", "hp": 30, "cr": "1", "portrait": "/uploads/" + "a" * 32 + ".png",
             "skills": {"percepcion": 2, "sigilo": 2, "supervivencia": 1, "inventada": 1}},
            {"id": "n1", "name": "Lobo de ceniza", "cr": "2", "creature": "Elemental", "portrait": "https://malo.example/x.png",
             "attacks": [{"name": "Mordisco", "bonus": "5", "damage": "2d6+3"}, {"name": ""}]},
            {"id": "x1", "cr": "99"},
        ]
        cat = monsters.catalog(docs)
        self.assertEqual(len(cat), len(monsters.BASE) + 2)
        wolf = next(m for m in cat if m["key"] == "wolf")
        self.assertTrue(wolf["edited"])
        self.assertEqual((wolf["hp"], wolf["cr"]), (30, "1"))
        self.assertEqual(wolf["skills"], {"percepcion": 2, "sigilo": 2, "supervivencia": 1})
        self.assertIn("Habilidades: Percepción +5, Sigilo +6, Supervivencia +3.", wolf["traits"])  # línea reescrita
        self.assertTrue(wolf["portrait"].startswith("/uploads/"))
        self.assertEqual(wolf["en"], "Wolf")  # lo que no se edita sale de la original
        new = next(m for m in cat if m["key"] == "custom-n1")
        self.assertTrue(new["custom"])
        self.assertNotIn("portrait", new)  # solo imágenes subidas a la mesa
        self.assertEqual(new["attacks"], [{"name": "Mordisco", "bonus": 5, "damage": "2d6+3", "notes": ""}])
        self.assertEqual(next(m for m in cat if m["key"] == "custom-x1")["cr"], "1")  # VD imposible: 1

    def test_edited_species_replace_the_original(self):
        from server import homebrew, rules
        before = rules.reference()["species"]
        ref = homebrew.merge(rules.reference(), [{
            "id": "s1", "kind": "species", "base": "enano", "name": "Enano de las montañas", "size": "Mediano", "speed": 7.5, "darkvision": 36,
            "traits": [{"name": "Robustez", "text": "+2 PG por nivel."}], "skills": ["historia"], "image": "/uploads/" + "b" * 32 + ".jpg",
            "lore": "Mineros y herreros.", "spells": [{"level": 1, "name": "Luz", "uses": 1, "reset": "corto"}]}])
        self.assertEqual(len(ref["species"]), len(before))
        dwarf = next(s for s in ref["species"] if s["id"] == "enano")
        self.assertEqual((dwarf["name"], dwarf["speed"], dwarf["darkvision"], dwarf["page"]), ("Enano de las montañas", 7.5, 36, 190))
        self.assertTrue(dwarf["edited"])
        self.assertNotIn("hp_per_level", dwarf)  # el editor lo quitó: se quita también de la original
        self.assertEqual(dwarf["skills"], ["historia"])
        self.assertEqual(dwarf["spells"], [[1, "Luz", 1, "corto"]])
        self.assertTrue(dwarf["image"].startswith("/uploads/"))


class LanguagesAndMasteryTests(unittest.TestCase):
    """Idiomas por especie, clase y trasfondo (sin dos gratis) y estados de las maestrías de armas."""

    def test_languages_come_from_species_and_class(self):
        ref = rules.reference()
        species = {s["id"]: s for s in ref["species"]}
        self.assertEqual(species["elfo"]["languages"], ["Elfo"])
        self.assertEqual(species["duergar"]["languages"], ["Enano", "Infracomún"])
        self.assertEqual(species["humano"]["languages"], [])  # solo común
        self.assertTrue(all(isinstance(s["languages"], list) and "Común" not in s["languages"] for s in ref["species"]))
        classes = {c["id"]: c for c in ref["classes"]}
        self.assertEqual((classes["druida"]["languages"], classes["picaro"]["languages"], classes["guerrero"]["languages"]),
                         (["Druídico"], ["Jerga de ladrones"], []))

    def test_homebrew_emoji_and_languages(self):
        from server import homebrew
        ref = homebrew.merge(rules.reference(), [
            {"id": "a", "kind": "species", "name": "Gente zorro", "emoji": "🦊", "languages": ["Común", "Silvano", "Silvano", "Vulpino"]},
            {"id": "b", "kind": "background", "name": "Sabio de puerto", "languages": ["Primordial"]},
            {"id": "c", "kind": "species", "base": "orco", "name": "Orco", "emoji": "🐗", "languages": ["Orco", "Gigante"]},
        ])
        fox = next(s for s in ref["species"] if s["id"] == "hb-a")
        self.assertEqual((fox["emoji"], fox["languages"]), ("🦊", ["Silvano", "Vulpino"]))
        self.assertEqual(next(b for b in ref["backgrounds"] if b["id"] == "hb-b")["languages"], ["Primordial"])
        orc = next(s for s in ref["species"] if s["id"] == "orco")
        self.assertEqual((orc["emoji"], orc["languages"]), ("🐗", ["Orco", "Gigante"]))

    def test_mastery_states(self):
        ref = rules.reference()
        states = {m["name"]: m for m in ref["mastery_states"]}
        self.assertEqual(set(states), {"Debilitado", "Ralentizado", "Molestado", "Derribado"})
        masteries = {m["name"] for m in ref["masteries"]}
        self.assertTrue(all(m["mastery"] in masteries for m in ref["mastery_states"]))
        self.assertEqual((states["Debilitado"]["ends"], states["Molestado"]["ends"], states["Derribado"]["ends"]), ("inicio", "fin", ""))
        self.assertIn("Derribado", {c["name"] for c in ref["conditions"]})


class MobilePageTests(unittest.TestCase):
    def test_mobile_page_is_up_to_date(self):
        import importlib.util
        root = Path(__file__).resolve().parent.parent
        spec = importlib.util.spec_from_file_location("build_movil", root / "tools" / "build_movil.py")
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        current = (root / "static" / "dados-movil.html").read_text(encoding="utf-8")
        # Git en Windows puede cambiar los finales de línea al descargar el repositorio
        self.assertEqual(current.splitlines(), mod.build().splitlines(), "Ejecuta: python tools/build_movil.py")

    def test_mobile_page_is_self_contained(self):
        root = Path(__file__).resolve().parent.parent
        page = (root / "static" / "dados-movil.html").read_text(encoding="utf-8")
        self.assertNotIn("<script src", page)
        self.assertNotIn('rel="stylesheet"', page)
        self.assertIn("Dice3D", page)
        self.assertIn("DiceNotation", page)


class StorageTests(unittest.TestCase):
    def test_crud(self):
        with tempfile.TemporaryDirectory() as d:
            store = JsonStore(d, ["characters"])
            doc = store.create("characters", {"name": "Ana"})
            self.assertEqual(store.get("characters", doc["id"])["name"], "Ana")
            store.update("characters", doc["id"], {"name": "Bea"})
            self.assertEqual(store.list("characters")[0]["name"], "Bea")
            self.assertTrue(store.delete("characters", doc["id"]))
            self.assertEqual(store.list("characters"), [])
            with self.assertRaises(KeyError):
                store.list("../secretos")


class ApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.server = make_server("127.0.0.1", 0, data_dir=cls.tmp.name)
        cls.base = f"http://127.0.0.1:{cls.server.server_address[1]}"
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.tmp.cleanup()

    def call(self, method, path, body=None, raw=None, headers=None):
        data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
        req = urllib.request.Request(self.base + path, data=data, method=method, headers=headers or {})
        try:
            with urllib.request.urlopen(req) as res:
                return res.status, res.read()
        except urllib.error.HTTPError as e:
            return e.code, e.read()

    def test_client_that_leaves_does_not_log_errors(self):
        import contextlib
        import socket
        import struct
        import time
        err = io.StringIO()
        with contextlib.redirect_stderr(err):
            for _ in range(3):  # el navegador corta la conexión sin esperar la respuesta
                with socket.create_connection(("127.0.0.1", self.server.server_address[1])) as s:
                    s.setsockopt(socket.SOL_SOCKET, socket.SO_LINGER, struct.pack("ii", 1, 0))
                    s.sendall(b"GET /api/reference HTTP/1.1\r\nHost: x\r\n\r\n")
            time.sleep(0.5)
        self.assertEqual(err.getvalue(), "")
        self.assertEqual(self.call("GET", "/api/settings")[0], 200)

    def test_every_scene_piece_has_a_painter(self):
        # cada terreno y objeto del catálogo tiene su pintor en el tablero, y al revés
        from server import scenes
        js = (Path(__file__).resolve().parents[1] / "static" / "js" / "core" / "battlemap.js").read_text(encoding="utf-8")
        painters = set(re.findall(r"^\s+(\w+)\(ctx, x, y, w, hh, s[\w, ]*\) \{", js, re.M))
        tiles = {a or b for a, b in re.findall(r"^\s+(?:'([^']+)'|(\w)): \{ base", js, re.M)}
        self.assertEqual(painters, scenes.PROP_CODES)
        self.assertEqual(tiles, scenes.TERRAIN_CODES)
        # adornos y ambientes: cada uno del catálogo tiene su pintor en decor.js, y al revés
        decor = (Path(__file__).resolve().parents[1] / "static" / "js" / "core" / "decor.js").read_text(encoding="utf-8")
        decal_painters = set(re.findall(r"^  (\w+)\(ctx, s(?:, rand)?\) \{", decor, re.M))
        self.assertEqual(decal_painters, scenes.DECAL_CODES)
        moods = decor[decor.index("export const MOODS = {"):]
        moods = set(re.findall(r"^  (\w+): ", moods[:moods.index("};")], re.M))
        self.assertEqual(moods, {k for k, _ in scenes.MOODS})
        levels = re.search(r"export const DECOR_LEVEL = \{([^}]*)\}", decor).group(1)
        self.assertEqual(set(re.findall(r"(\w+):", levels)), {k for k, _ in scenes.DECOR_LEVELS})
        _, cat = self.json_call("GET", "/api/scene-catalog")
        self.assertEqual(set(cat["prop_groups"]), {p["group"] for p in cat["props"]})
        self.assertGreater(len(cat["props"]), 100)

    def test_second_launch_finds_the_open_table(self):
        import socket
        import app
        self.assertTrue(app.running_mesa(self.server.server_address[1]))
        with socket.socket() as s:  # un puerto libre: ahí no hay ninguna mesa
            s.bind(("127.0.0.1", 0))
            free = s.getsockname()[1]
        self.assertFalse(app.running_mesa(free))

    def json_call(self, *args, **kw):
        status, data = self.call(*args, **kw)
        return status, json.loads(data)

    def test_index_served(self):
        status, data = self.call("GET", "/")
        self.assertEqual(status, 200)
        self.assertIn(b"<html", data)

    def test_character_crud(self):
        status, ch = self.json_call("POST", "/api/characters", {"name": "Thorin", "type": "jugador"})
        self.assertEqual(status, 201)
        status, got = self.json_call("GET", f"/api/characters/{ch['id']}")
        self.assertEqual(got["name"], "Thorin")
        status, _ = self.json_call("DELETE", f"/api/characters/{ch['id']}")
        self.assertEqual(status, 200)
        status, _ = self.json_call("GET", f"/api/characters/{ch['id']}")
        self.assertEqual(status, 404)

    def test_world_compendium_and_session_prep(self):
        status, e = self.json_call("POST", "/api/wiki", {"name": "Anboto", "type": "lugar", "body": "Cueva de @[Mari]"})
        self.assertEqual(status, 201)
        status, s = self.json_call("POST", "/api/sessions", {"number": 1, "secrets": [{"text": "Mari vive en @[Anboto]", "done": False}]})
        self.assertEqual(status, 201)
        status, got = self.json_call("GET", "/api/wiki")
        self.assertIn("Anboto", [x["name"] for x in got])
        status, r = self.json_call("POST", "/api/relations", {"a": f"wiki:{e['id']}", "b": "char:x", "kind": "aliado"})
        self.assertEqual(status, 201)
        status, b = self.json_call("POST", "/api/bastions", {"name": "Torre", "facilities": [{"key": "biblioteca", "order": "investigar"}]})
        self.assertEqual(status, 201)
        for col, doc in (("wiki", e), ("sessions", s), ("relations", r), ("bastions", b)):
            self.assertEqual(self.json_call("DELETE", f"/api/{col}/{doc['id']}")[0], 200)

    def test_homebrew_reaches_the_reference(self):
        status, doc = self.json_call("POST", "/api/homebrew", {"kind": "species", "name": "Gente polilla", "speed": 9, "traits": [{"name": "Alas", "text": "Planeas"}]})
        self.assertEqual(status, 201)
        _, ref = self.json_call("GET", "/api/reference")
        self.assertIn(f"hb-{doc['id']}", [s["id"] for s in ref["species"]])
        self.assertEqual(self.json_call("DELETE", f"/api/homebrew/{doc['id']}")[0], 200)

    def test_night_route(self):
        status, r = self.json_call("POST", "/api/night", {"ctx": {"terrain": "monte", "situation": "viaje", "moon": "nueva"}})
        self.assertEqual((status, r["bonus"], "result" in r), (200, 3, False))
        status, r = self.json_call("POST", "/api/night", {"ctx": {"terrain": "monte"}, "total": 19, "levels": [6, 6, 6]})
        self.assertEqual((status, r["result"]["band"]), (200, "peligro"))
        self.assertTrue(r["result"]["creatures"])
        self.assertEqual(self.json_call("POST", "/api/night", {"ctx": {}, "total": "x"})[0], 400)
        status, r = self.json_call("POST", "/api/roll", {"expr": "2d20kh1+1", "dice": [[7, 13]]})
        self.assertEqual((status, r["total"], r["physical"]), (200, 14, True))
        self.assertEqual(self.json_call("POST", "/api/roll", {"expr": "1d6", "dice": [[9]]})[0], 400)

    def test_roll_and_log(self):
        status, r = self.json_call("POST", "/api/roll", {"expr": "1d20+1", "who": "DM"})
        self.assertEqual(status, 200)
        _, log = self.json_call("GET", "/api/rolls")
        self.assertEqual(log[-1]["id"], r["id"])
        status, err = self.json_call("POST", "/api/roll", {"expr": "patata"})
        self.assertEqual(status, 400)
        self.assertIn("error", err)

    def test_upload_roundtrip_and_validation(self):
        status, up = self.json_call("POST", "/api/uploads", raw=b"\x89PNGfake", headers={"X-Filename": "mapa.png"})
        self.assertEqual(status, 201)
        status, data = self.call("GET", up["url"])
        self.assertEqual((status, data), (200, b"\x89PNGfake"))
        status, _ = self.json_call("POST", "/api/uploads", raw=b"x", headers={"X-Filename": "virus.exe"})
        self.assertEqual(status, 400)
        status, _ = self.call("GET", "/uploads/..%2F..%2Fapp.py")
        self.assertEqual(status, 404)

    def test_encounter_endpoint(self):
        status, r = self.json_call("POST", "/api/encounter", {"levels": [2, 2, 2], "crs": ["1/2", "1/2"]})
        self.assertEqual(status, 200)
        self.assertEqual((r["xp"], r["difficulty"]), (200, "trivial"))

    def test_backup_roundtrip(self):
        _, ch = self.json_call("POST", "/api/characters", {"name": "Copia", "type": "pnj"})
        _, up = self.json_call("POST", "/api/uploads", raw=b"img", headers={"X-Filename": "m.png"})
        status, zipped = self.call("GET", "/api/backup")
        self.assertEqual(status, 200)
        self.json_call("DELETE", f"/api/characters/{ch['id']}")
        status, res = self.json_call("POST", "/api/backup", raw=zipped)
        self.assertEqual(status, 200)
        _, chars = self.json_call("GET", "/api/characters")
        self.assertIn("Copia", [c["name"] for c in chars])
        self.assertEqual(self.call("GET", up["url"]), (200, b"img"))
        self.assertTrue(res["previous"].startswith("antes-de-importar"))

    def test_backup_rejects_foreign_zip(self):
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as zf:
            zf.writestr("../../evil.json", "[]")
        status, err = self.json_call("POST", "/api/backup", raw=buf.getvalue())
        self.assertEqual(status, 400)
        status, _ = self.json_call("POST", "/api/backup", raw=b"no soy un zip")
        self.assertEqual(status, 400)

    def test_scene_catalog_and_custom_scenes(self):
        status, cat = self.json_call("GET", "/api/scene-catalog")
        self.assertEqual(status, 200)
        self.assertTrue(cat["presets"])
        status, sc = self.json_call("POST", "/api/scenes", {"name": "Sala", "cols": 8, "rows": 6, "tiles": "." * 48, "props": []})
        self.assertEqual(status, 201)
        _, listed = self.json_call("GET", "/api/scenes")
        self.assertEqual([x["name"] for x in listed], ["Sala"])

    def test_bestiary_collection_changes_the_monsters(self):
        status, doc = self.json_call("POST", "/api/bestiary", {"base": "wolf", "name": "Lobo gris", "hp": 15})
        self.assertEqual(status, 201)
        _, all_monsters = self.json_call("GET", "/api/monsters")
        wolf = next(m for m in all_monsters if m["key"] == "wolf")
        self.assertEqual((wolf["name"], wolf["hp"], wolf["editId"]), ("Lobo gris", 15, doc["id"]))
        self.json_call("DELETE", f"/api/bestiary/{doc['id']}")
        _, all_monsters = self.json_call("GET", "/api/monsters")
        self.assertEqual(next(m for m in all_monsters if m["key"] == "wolf")["name"], "Lobo")

    def test_removed_network_routes(self):
        self.assertEqual(self.call("GET", "/api/player")[0], 404)
        self.assertEqual(self.call("GET", "/api/info")[0], 404)

    def test_unknown_routes(self):
        self.assertEqual(self.call("GET", "/api/nada")[0], 404)
        self.assertEqual(self.call("PATCH", "/api/characters")[0], 501)
        self.assertEqual(self.call("PUT", "/api/characters")[0], 405)



class RemoteScreenTests(unittest.TestCase):
    """Pantalla de jugadores en otro ordenador: apagada de serie, con código, y sin secretos del máster."""

    def setUp(self):
        from server import remote
        self.remote = remote
        self.tmp = tempfile.TemporaryDirectory()
        self.server = make_server("127.0.0.1", 0, data_dir=self.tmp.name)
        self.base = f"http://127.0.0.1:{self.server.server_address[1]}"
        self.server.app.remote.bind_host = "127.0.0.1"  # en los tests, sin salir a la red
        self.server.app.remote.bind_ports = [0]
        threading.Thread(target=self.server.serve_forever, daemon=True).start()

    def tearDown(self):
        self.server.app.remote.stop()
        self.server.shutdown()
        self.server.server_close()
        self.tmp.cleanup()

    def call(self, base, method, path, body=None, headers=None, raw=None):
        data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
        req = urllib.request.Request(base + path, data=data, method=method, headers=headers or {})
        try:
            with urllib.request.urlopen(req, timeout=10) as res:
                return res.status, res.read()
        except urllib.error.HTTPError as e:
            return e.code, e.read()

    def dm(self, method, path, body=None, **kw):
        status, raw = self.call(self.base, method, path, body, **kw)
        return status, json.loads(raw or b"null")

    def turn_on(self, **show):
        _, st = self.dm("PUT", "/api/pantalla", {"on": True, **({"show": show} if show else {})})
        self.assertTrue(st["running"], st["error"])
        self.rbase = f"http://127.0.0.1:{st['port']}"
        self.code = st["code"]
        return st

    def players(self, path="/api/jugadores", method="GET", body=None, code=True):
        headers = {"X-Mesa-Codigo": self.code} if code is True else ({"X-Mesa-Codigo": code} if code else {})
        status, raw = self.call(self.rbase, method, path, body, headers=headers)
        try:
            return status, json.loads(raw)
        except ValueError:
            return status, raw

    def test_off_by_default_and_turns_on_and_off(self):
        _, st = self.dm("GET", "/api/pantalla")
        self.assertEqual((st["on"], st["running"], st["port"], st["urls"]), (False, False, None, []))
        self.assertIsNone(self.server.app.remote.server)  # nada escucha en la red hasta que el máster la enciende
        st = self.turn_on()
        self.assertRegex(st["code"], r"^[A-Z2-9]{6}$")
        self.assertTrue(st["urls"])
        _, again = self.dm("GET", "/api/pantalla")
        self.assertEqual(again["code"], st["code"])  # el código se mantiene
        _, st = self.dm("PUT", "/api/pantalla", {"on": False})
        self.assertFalse(st["running"])
        with self.assertRaises(OSError):
            urllib.request.urlopen(self.rbase + "/", timeout=2)

    def test_needs_the_code_and_only_serves_the_players_page(self):
        self.turn_on()
        status, page = self.call(self.rbase, "GET", "/")
        self.assertEqual(status, 200)
        self.assertIn(b"remote.js", page)
        self.assertEqual(self.call(self.rbase, "GET", "/js/main.js")[0], 200)
        self.assertEqual(self.players(code=False)[0], 401)
        self.assertEqual(self.players(code="ZZZZZZ")[0], 401)
        self.assertEqual(self.players()[0], 200)
        self.assertEqual(self.call(self.rbase, "GET", f"/api/jugadores?c={self.code.lower()}")[0], 200)
        self.assertEqual(self.call(self.rbase, "GET", "/api/jugadores", headers={"Cookie": f"otra=1; mesa_codigo={self.code}"})[0], 200)
        # nada del máster sale por la red, ni con el código
        for path in ("/api/characters", "/api/settings", "/api/pantalla", "/api/pantalla/vista", "/api/rolls", "/api/backup", "/api/monsters", "/api/notes"):
            self.assertEqual(self.players(path)[0], 403, path)
        for method in ("POST", "PUT", "DELETE"):
            self.assertEqual(self.players("/api/characters", method, {"name": "x"})[0], 403, method)
        self.assertEqual(self.players("/api/settings", "PUT", {"remote": {}})[0], 403)
        for path in ("/index.html", "/js/../index.html", "/js/%2e%2e/index.html", "/js/core/", "/dados-movil.html"):
            self.assertEqual(self.call(self.rbase, "GET", path)[0], 404, path)
        # un código nuevo echa a quien tuviera el anterior
        old = self.code
        _, st = self.dm("PUT", "/api/pantalla", {"newCode": True})
        self.assertNotEqual(st["code"], old)
        self.assertEqual(self.players(code=old)[0], 401)

    def make_table(self):
        """Una partida con secretos: enemigo oculto, trampa, notas, niebla y una tirada secreta."""
        preset = scenes.PRESETS[0]
        cols = preset["cols"]
        _, ana = self.dm("POST", "/api/characters", {"name": "Ana", "type": "jugador", "hp": 9, "maxHp": 12, "ac": 15, "notes": "secreto de Ana",
                                                   "portrait": "/uploads/" + "a" * 32 + ".png"})
        self.dm("POST", "/api/characters", {"name": "Villano", "type": "enemigo", "hp": 50, "maxHp": 50, "notes": "plan malvado"})
        combatants = [
            {"cid": "c1", "charId": ana["id"], "name": "Ana", "type": "jugador", "hp": 9, "maxHp": 12, "ac": 15, "init": 12, "conditions": []},
            {"cid": "c2", "name": "Asesino", "type": "enemigo", "hp": 30, "maxHp": 30, "init": 20, "hidden": True, "conditions": []},
            {"cid": "c3", "name": "Lobo", "type": "enemigo", "hp": 7, "maxHp": 20, "ac": 13, "init": 10, "conditions": [{"name": "Derribado", "rounds": 1}]},
            {"cid": "c4", "name": "Lobo 2", "type": "enemigo", "hp": 11, "maxHp": 11, "init": 8, "conditions": []},
        ]
        board = {"scene": preset["id"], "pos": {"c1": [1, 1], "c2": [3, 3], "c3": [2, 1], "c4": [10, 10]}, "moved": {},
                 "fog": {"on": True, "seen": [1 * cols + 1, 1 * cols + 2]}}
        _, combat = self.dm("POST", "/api/combats", {"name": "Emboscada", "status": "active", "round": 2, "turn": 2,
                                                      "combatants": combatants, "board": board, "log": ["El asesino espera"]})
        self.dm("POST", "/api/roll", {"expr": "1d20", "label": "Percepción secreta", "secret": True})
        self.dm("POST", "/api/roll", {"expr": "1d20", "label": "Ataque", "who": "Ana"})
        self.dm("PUT", "/api/settings", {"activeCombat": combat["id"], "playerMessage": "Huele a azufre", "clock": {"day": 3, "minutes": 600}})
        return combat

    def test_bundle_has_no_secrets(self):
        self.turn_on()
        self.make_table()
        _, b = self.players()
        text = json.dumps(b, ensure_ascii=False)
        for secret in ("Asesino", "secreto de Ana", "Villano", "plan malvado", "Percepción secreta", "El asesino espera", '"remote"'):
            self.assertNotIn(secret, text)
        c = b["combat"]
        self.assertEqual([x["name"] for x in c["combatants"]], ["Ana", "Lobo", "Lobo 2"])
        self.assertEqual(c["turn"], 1)  # le toca al lobo, contado sin el oculto
        ana, wolf, wolf2 = c["combatants"]
        self.assertEqual((ana["hp"], ana["maxHp"], ana["ac"]), (9, 12, 15))
        self.assertEqual((wolf["hp"], wolf["maxHp"]), (8, 20))  # 7/20 se ve como «maltrecho» (40 %), no el número
        self.assertNotIn("ac", wolf)
        self.assertEqual(wolf["conditions"], [{"name": "Derribado", "rounds": 1}])
        self.assertEqual(set(c["board"]["pos"]), {"c1", "c3"})  # el segundo lobo está bajo la niebla: ni su casilla
        self.assertEqual([r["label"] for r in b["rolls"]], ["Ataque"])
        self.assertEqual(b["settings"]["playerMessage"], "Huele a azufre")
        self.assertNotIn("remote", b["settings"])
        self.assertEqual(set(b["chars"][0]) & {"notes", "inventory", "spells"}, set())
        self.assertEqual(b["scene"]["id"], scenes.PRESETS[0]["id"])
        self.assertNotIn("description", b["scene"])
        # sin PG de los enemigos: solo si sigue en pie
        self.dm("PUT", "/api/pantalla", {"show": {"enemyHp": "no"}})
        _, b = self.players()
        wolf = b["combat"]["combatants"][1]
        self.assertEqual((wolf["hp"], wolf["maxHp"]), (1, None))
        # el máster ve lo mismo que ellos desde su ordenador
        _, preview = self.dm("GET", "/api/pantalla/vista")
        self.assertEqual(preview["version"], b["version"])

    def test_hidden_props_and_notes_of_custom_scenes(self):
        self.turn_on()
        _, sc = self.dm("POST", "/api/scenes", {"name": "Guarida", "cols": 4, "rows": 4, "tiles": "." * 16, "notes": "la trampa está en el centro",
                                                "props": [{"k": "B", "c": 0, "r": 0}, {"k": "T", "c": 2, "r": 2, "hidden": True}]})
        _, combat = self.dm("POST", "/api/combats", {"name": "x", "status": "active", "round": 1, "turn": 0, "combatants": [], "board": {"scene": sc["id"]}})
        self.dm("PUT", "/api/settings", {"activeCombat": combat["id"]})
        _, b = self.players()
        self.assertEqual(b["scene"]["props"], [{"k": "B", "c": 0, "r": 0}])
        self.assertNotIn("notes", b["scene"])
        self.assertEqual([s["id"] for s in b["scenes"]], [sc["id"]])
        status, cat = self.players("/api/scene-catalog")
        self.assertEqual(status, 200)
        self.assertTrue(all(not p.get("hidden") for s in cat["presets"] for p in s["props"]))
        self.assertTrue(all("description" not in s for s in cat["presets"]))
        self.assertEqual(self.players("/api/scene-catalog", code=False)[0], 401)

    def test_show_options(self):
        self.turn_on(map=False, rolls=False, narration=False, clock=False, party=False, dice=False)
        self.make_table()
        _, b = self.players()
        self.assertIsNone(b["map"])
        self.assertIsNone(b["scene"])
        self.assertEqual((b["combat"]["board"]["scene"], b["combat"]["board"]["pos"]), (None, {}))
        self.assertEqual((b["rolls"], b["chars"]), ([], []))
        self.assertNotIn("playerMessage", b["settings"])
        self.assertNotIn("clock", b["settings"])
        _, st = self.dm("PUT", "/api/pantalla", {"show": {"enemyHp": "exacto", "nada": True}})
        self.assertEqual(st["show"]["enemyHp"], "aprox")  # lo que no se conoce no entra
        self.assertNotIn("nada", st["show"])

    def test_uploads_only_if_they_are_on_screen(self):
        self.turn_on()
        shown = self.dm("POST", "/api/uploads", raw=b"\x89PNG mapa", headers={"X-Filename": "mapa.png"})[1]["url"]
        hidden = self.dm("POST", "/api/uploads", raw=b"\x89PNG secreto", headers={"X-Filename": "secreto.png"})[1]["url"]
        _, m = self.dm("POST", "/api/maps", {"name": "Valle", "url": shown, "tokens": [], "notes": "aquí hay un tesoro",
                                             "pins": [{"id": "p1", "x": 0.5, "y": 0.5, "label": "Cueva", "link": "wiki:x", "notes": "dragón"}]})
        self.dm("PUT", "/api/settings", {"tableMap": m["id"]})
        _, b = self.players()
        self.assertEqual(b["map"]["url"], shown)
        self.assertNotIn("aquí hay un tesoro", json.dumps(b, ensure_ascii=False))
        self.assertEqual(b["map"]["pins"], [])  # chinchetas «solo el máster» (lo normal)
        self.assertEqual(self.players(shown)[0], 200)
        self.assertEqual(self.call(self.rbase, "GET", shown)[0], 403)  # sin código, tampoco
        self.assertEqual(self.players(hidden)[0], 403)
        self.dm("PUT", f"/api/maps/{m['id']}", {**m, "pinsShow": "todos"})
        _, b = self.players()
        self.assertEqual(b["map"]["pins"], [{"id": "p1", "x": 0.5, "y": 0.5, "icon": None, "label": "Cueva"}])

    def test_players_rolls_are_public(self):
        self.turn_on()
        self.dm("POST", "/api/characters", {"name": "Ana", "type": "jugador", "hp": 9, "maxHp": 9})
        status, r = self.players("/api/roll", "POST", {"expr": "1d20+3", "label": "Ana: Sigilo", "who": "Ana", "secret": True})
        self.assertEqual(status, 200)
        self.assertEqual((r["secret"], r["remote"], r["who"]), (False, True, "Ana"))
        _, r = self.players("/api/roll", "POST", {"expr": "1d6", "who": "Máster"})
        self.assertEqual(r["who"], "Jugador")  # nadie se hace pasar por el máster
        self.assertEqual(self.players("/api/roll", "POST", {"expr": "hola"})[0], 400)
        self.assertEqual(self.players("/api/roll", "POST", {"expr": "1d6"}, code=False)[0], 403)
        _, log = self.dm("GET", "/api/rolls")
        self.assertEqual([x["who"] for x in log], ["Ana", "Jugador"])
        self.dm("PUT", "/api/pantalla", {"show": {"dice": False}})
        self.assertEqual(self.players("/api/roll", "POST", {"expr": "1d6"})[0], 403)

    def test_waiting_screen_black_screen_and_freeze(self):
        self.turn_on()
        _, a = self.dm("POST", "/api/maps", {"name": "Aldea", "url": "", "tokens": []})
        _, z = self.dm("POST", "/api/maps", {"name": "Mazmorra", "url": "", "tokens": []})
        self.dm("PUT", "/api/settings", {"tableMap": a["id"]})
        self.dm("PUT", "/api/pantalla", {"screen": "espera", "waitText": "Descanso de diez minutos", "waitImage": "/etc/passwd"})
        _, b = self.players()
        self.assertEqual((b["screen"], b["wait"]["text"], b["wait"]["image"]), ("espera", "Descanso de diez minutos", ""))
        self.assertNotIn("map", b)  # mientras esperan no se manda nada de la partida
        self.dm("PUT", "/api/pantalla", {"screen": "negro"})
        self.assertEqual(self.players()[1]["screen"], "negro")
        self.dm("PUT", "/api/pantalla", {"screen": "mesa", "frozen": True})
        self.dm("PUT", "/api/settings", {"tableMap": z["id"]})  # el máster prepara la mazmorra sin que la vean
        _, b = self.players()
        self.assertEqual((b["map"]["name"], b["frozen"]), ("Aldea", True))
        self.dm("PUT", "/api/pantalla", {"frozen": False})
        self.assertEqual(self.players()[1]["map"]["name"], "Mazmorra")

    def test_long_poll_waits_for_changes(self):
        import time
        self.turn_on()
        old, self.remote.LONG_POLL = self.remote.LONG_POLL, 5
        try:
            _, b = self.players()
            threading.Timer(0.6, lambda: self.dm("PUT", "/api/settings", {"tableWeather": "lluvia"})).start()
            t0 = time.time()
            _, b2 = self.players(f"/api/jugadores?v={b['version']}")
            self.assertLess(time.time() - t0, 4)  # contesta en cuanto cambia algo, sin esperar al final
            self.assertNotEqual(b2["version"], b["version"])
            self.assertEqual(b2["settings"]["tableWeather"], "lluvia")
            _, st = self.dm("GET", "/api/pantalla")
            self.assertEqual([c["ip"] for c in st["clients"]], ["127.0.0.1"])
        finally:
            self.remote.LONG_POLL = old

    def test_comes_back_on_after_restart(self):
        from server.handler import start_remote_if_on
        self.turn_on()
        self.server.app.remote.stop()  # como si se cerrara la mesa con la pantalla encendida
        self.assertIsNone(self.server.app.remote.server)
        start_remote_if_on(self.server)
        self.assertIsNotNone(self.server.app.remote.server)


if __name__ == "__main__":
    unittest.main()
