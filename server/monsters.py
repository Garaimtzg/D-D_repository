"""Bestiario: los monstruos y animales del SRD 5.2.1 traducidos al castellano, más las criaturas
de la mitología de Euskal Herria (server/euskal.py).

Contenido del System Reference Document 5.2.1 de Wizards of the Coast LLC (CC-BY-4.0,
https://www.dndbeyond.com/srd), traducido y resumido con tools/build_bestiary.py.
Velocidades y distancias en metros; los ataques con tirada llevan su bonificador y su daño,
y las acciones con salvación (alientos, rayos…) su CD y su daño.
"""
import json
from pathlib import Path

from .euskal import CREATURES

MONSTERS = json.loads(Path(__file__).with_name("monsters2024.json").read_text(encoding="utf-8")) + CREATURES
