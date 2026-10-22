import io
import json
import random
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
        self.assertEqual(len(classes), 12)
        for c in classes:
            self.assertIn(c["hit_die"], (6, 8, 10, 12), c["name"])
            self.assertEqual(len(c["subclasses"]), 4, c["name"])
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
        self.assertEqual(len(self.d["species"]), 10)
        self.assertEqual(len(self.d["backgrounds"]), 16)
        for b in self.d["backgrounds"]:
            self.assertIn(b["feat"].split(" (")[0], feats, b["name"])
            self.assertTrue(set(b["skills"]) <= self.skills, b["name"])
            self.assertEqual(len(b["abilities"]), 3)

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

    def test_party_can_reach_the_enemies(self):
        for sc in scenes.PRESETS:
            with self.subTest(sc["id"]):
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

    def test_presets_are_deterministic(self):
        self.assertEqual(scenes._bosque(), scenes._bosque())
        self.assertEqual(scenes._cueva(), scenes._cueva())

    def test_catalog(self):
        cat = scenes.catalog()
        self.assertEqual(cat["cell_m"], 1.5)
        codes = {t["code"] for t in cat["terrain"]}
        self.assertTrue({".", ",", "#", "~", "v", "_"} <= codes)
        self.assertTrue(any(p["light"] for p in cat["props"]))


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

    def test_removed_network_routes(self):
        self.assertEqual(self.call("GET", "/api/player")[0], 404)
        self.assertEqual(self.call("GET", "/api/info")[0], 404)

    def test_unknown_routes(self):
        self.assertEqual(self.call("GET", "/api/nada")[0], 404)
        self.assertEqual(self.call("PATCH", "/api/characters")[0], 501)
        self.assertEqual(self.call("PUT", "/api/characters")[0], 405)


if __name__ == "__main__":
    unittest.main()
