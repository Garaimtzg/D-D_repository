"""Reglas de D&D (edición 2024): cálculos y datos de referencia para la interfaz.

Los datos del Manual del Jugador están en phb2024.py; aquí van los cálculos.
"""
from fractions import Fraction
import math

from . import phb2024

SKILLS = phb2024.SKILLS
LEVEL_XP = phb2024.LEVEL_XP
XP_BUDGET = phb2024.XP_BUDGET
DIFFICULTIES = ("bajo", "moderado", "alto")

# PX por valor de desafío (igual en las reglas de 2024)
CR_XP = {
    "0": 10, "1/8": 25, "1/4": 50, "1/2": 100, "1": 200, "2": 450, "3": 700, "4": 1100,
    "5": 1800, "6": 2300, "7": 2900, "8": 3900, "9": 5000, "10": 5900, "11": 7200,
    "12": 8400, "13": 10000, "14": 11500, "15": 13000, "16": 15000, "17": 18000,
    "18": 20000, "19": 22000, "20": 25000, "21": 33000, "22": 41000, "23": 50000,
    "24": 62000, "25": 75000, "26": 90000, "27": 105000, "28": 120000, "29": 135000,
    "30": 155000,
}


def ability_mod(score) -> int:
    return (int(score) - 10) // 2


def prof_bonus_level(level) -> int:
    return 2 + (max(1, min(20, int(level))) - 1) // 4


def prof_bonus_cr(cr) -> int:
    value = float(Fraction(str(cr)))
    return 2 if value < 1 else 2 + (math.ceil(value) - 1) // 4


def level_for_xp(xp) -> int:
    return sum(1 for need in LEVEL_XP if int(xp) >= need)


def encounter(party_levels, monster_crs) -> dict:
    """Dificultad de un combate con el presupuesto de PX de 2024 (sin multiplicadores):
    se suman los PX de los monstruos y se comparan con el presupuesto del grupo."""
    levels = [max(1, min(20, int(l))) for l in party_levels]
    crs = [str(c) for c in monster_crs]
    unknown = [c for c in crs if c not in CR_XP]
    if unknown:
        raise ValueError(f"VD desconocido: {', '.join(unknown)}")
    budget = [sum(XP_BUDGET[l][i] for l in levels) for i in range(3)]
    xp = sum(CR_XP[c] for c in crs)
    difficulty = "trivial"
    for name, limit in zip(DIFFICULTIES, budget):
        if xp >= limit:
            difficulty = name
    return {
        "budget": dict(zip(DIFFICULTIES, budget)),
        "xp": xp,
        "over_high": bool(levels) and xp > budget[2],  # por encima del presupuesto alto: muy peligroso
        "difficulty": difficulty if levels else "—",
        "xp_per_player": xp // len(levels) if levels else 0,
    }


def reference() -> dict:
    out = phb2024.data()
    out["cr_xp"] = CR_XP
    return out
