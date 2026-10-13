import io
import json
import random
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
import zipfile

from server import dice, generators, rules
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

    def test_encounter_difficulty(self):
        # 4 personajes de nivel 1 contra 4 goblins: 200 PX x2 = 400 -> mortal (umbral 400)
        r = rules.encounter([1, 1, 1, 1], ["1/4"] * 4)
        self.assertEqual(r["adjusted_xp"], 400)
        self.assertEqual(r["difficulty"], "mortal")
        self.assertEqual(r["xp_per_player"], 50)

    def test_small_party_raises_multiplier(self):
        self.assertEqual(rules.encounter([3, 3], ["1"])["multiplier"], 1.5)

    def test_unknown_cr(self):
        with self.assertRaises(ValueError):
            rules.encounter([1], ["99"])


class GeneratorTests(unittest.TestCase):
    def test_all_generators_return_text(self):
        for kind in generators.GENERATORS:
            out = generators.generate(kind, {}, random.Random(7))
            self.assertTrue(out["title"])


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

    def test_player_view_hides_secrets(self):
        _, combat = self.json_call("POST", "/api/combats", {
            "name": "Emboscada", "status": "active", "round": 1, "turn": 0,
            "combatants": [
                {"name": "Ana", "type": "jugador", "hp": 10, "maxHp": 12},
                {"name": "Goblin", "type": "enemigo", "hp": 3, "maxHp": 7},
                {"name": "Asesino", "type": "enemigo", "hp": 30, "maxHp": 30, "hidden": True},
            ]})
        self.json_call("PUT", "/api/settings", {"activeCombat": combat["id"]})
        _, view = self.json_call("GET", "/api/player")
        names = [c["name"] for c in view["combat"]["order"]]
        self.assertEqual(names, ["Ana", "Goblin"])
        self.assertEqual(view["combat"]["order"][1]["health"], "Malherido")
        self.assertNotIn("hp", view["combat"]["order"][1])

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
        self.assertEqual(r["adjusted_xp"], 300)

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

    def test_unknown_routes(self):
        self.assertEqual(self.call("GET", "/api/nada")[0], 404)
        self.assertEqual(self.call("PATCH", "/api/characters")[0], 501)
        self.assertEqual(self.call("PUT", "/api/characters")[0], 405)


if __name__ == "__main__":
    unittest.main()
