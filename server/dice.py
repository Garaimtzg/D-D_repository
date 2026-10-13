"""Tiradas de dados con notación estándar.

Ejemplos: "d20", "1d20+5", "2d6+1d4-1", "4d6kh3" (quedarse con los 3 más altos),
"2d20kl1" (desventaja), "d%" (d100). El modo "adv"/"dis" convierte el primer d20
suelto en ventaja o desventaja.
"""
import random
import re

MAX_DICE = 200
MAX_SIDES = 1000

_TERM = re.compile(r"([+-]?)\s*(?:(\d*)d(\d+|%)(?:(kh|kl|k)(\d+))?|(\d+))", re.I)


class DiceError(ValueError):
    pass


def roll(expr: str, mode: str = "", rng: random.Random | None = None) -> dict:
    rng = rng or random
    src = (expr or "").strip().lower().replace(" ", "")
    if not src:
        raise DiceError("Escribe una tirada, por ejemplo 1d20+3")

    pos, parts, total, adv_used = 0, [], 0, False
    while pos < len(src):
        m = _TERM.match(src, pos)
        if not m or m.end() == pos:
            raise DiceError(f"No entiendo «{src[pos:]}»")
        if pos > 0 and not m.group(1):
            raise DiceError("Separa los términos con + o -")
        pos = m.end()
        sign = -1 if m.group(1) == "-" else 1

        if m.group(6) is not None:  # constante
            value = int(m.group(6))
            parts.append({"term": f"{'-' if sign < 0 else '+'}{value}", "value": sign * value})
            total += sign * value
            continue

        count = int(m.group(2) or 1)
        sides = 100 if m.group(3) == "%" else int(m.group(3))
        keep_mode, keep_n = (m.group(4) or "").lower(), int(m.group(5) or 0)
        if keep_mode == "k":
            keep_mode = "kh"
        if mode in ("adv", "dis") and not adv_used and sides == 20 and count == 1 and not keep_mode:
            count, keep_mode, keep_n, adv_used = 2, ("kh" if mode == "adv" else "kl"), 1, True
        if not (1 <= count <= MAX_DICE) or not (2 <= sides <= MAX_SIDES):
            raise DiceError(f"Como mucho {MAX_DICE} dados de {MAX_SIDES} caras")

        rolls = [rng.randint(1, sides) for _ in range(count)]
        kept_idx = list(range(count))
        if keep_mode:
            keep_n = max(1, min(keep_n, count))
            order = sorted(range(count), key=lambda i: rolls[i], reverse=(keep_mode == "kh"))
            kept_idx = sorted(order[:keep_n])
        value = sign * sum(rolls[i] for i in kept_idx)
        total += value
        label = f"{count}d{sides}{keep_mode}{keep_n if keep_mode else ''}"
        parts.append({
            "term": f"{'-' if sign < 0 else '+'}{label}",
            "sides": sides,
            "rolls": rolls,
            "kept": kept_idx,
            "value": value,
        })

    result = {"expr": expr.strip(), "mode": mode, "total": total, "parts": parts}
    d20 = [p for p in parts if p.get("sides") == 20]
    if len(d20) == 1 and len(d20[0]["kept"]) == 1:
        nat = d20[0]["rolls"][d20[0]["kept"][0]]
        result["natural"] = nat
        result["crit"] = "critico" if nat == 20 else "pifia" if nat == 1 else ""
    return result
