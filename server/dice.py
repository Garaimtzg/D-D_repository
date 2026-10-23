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


def _given_rolls(entry, count: int, sides: int, label: str) -> tuple[list[int], bool]:
    """Dados físicos: cada dado ([3, 5]) o, en grupos sin «quedarse con», la suma ({"sum": 8})."""
    if isinstance(entry, dict):
        s = entry.get("sum")
        if not isinstance(s, int) or isinstance(s, bool) or not count <= s <= count * sides:
            raise DiceError(f"La suma de {label} va de {count} a {count * sides}")
        base, extra = divmod(s - count, count)  # se reparte para que cuadre el total
        return [1 + base + (1 if i < extra else 0) for i in range(count)], True
    if not isinstance(entry, list) or len(entry) != count:
        raise DiceError(f"Faltan valores: {label} son {count} dados")
    if not all(isinstance(v, int) and not isinstance(v, bool) and 1 <= v <= sides for v in entry):
        raise DiceError(f"Cada dado de {label} va de 1 a {sides}")
    return list(entry), False


def roll(expr: str, mode: str = "", rng: random.Random | None = None, given: list | None = None) -> dict:
    """given: valores de dados físicos, uno por grupo de dados de la tirada (ya con la ventaja aplicada)."""
    rng = rng or random
    src = (expr or "").strip().lower().replace(" ", "")
    if not src:
        raise DiceError("Escribe una tirada, por ejemplo 1d20+3")
    if given is not None and not isinstance(given, list):
        raise DiceError("Valores de dados no válidos")

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

        label = f"{count}d{sides}{keep_mode}{keep_n if keep_mode else ''}"
        summed = False
        if given is None:
            rolls = [rng.randint(1, sides) for _ in range(count)]
        else:
            n = sum(1 for p in parts if "sides" in p)
            if n >= len(given):
                raise DiceError(f"Faltan los valores de {label}")
            if keep_mode and isinstance(given[n], dict):
                raise DiceError(f"En {label} hay que poner cada dado")
            rolls, summed = _given_rolls(given[n], count, sides, label)
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
        if summed:
            parts[-1]["sum"] = True

    if given is not None and len(given) != sum(1 for p in parts if "sides" in p):
        raise DiceError("Sobran valores de dados")
    result = {"expr": expr.strip(), "mode": mode, "total": total, "parts": parts}
    if given is not None:
        result["physical"] = True
    d20 = [p for p in parts if p.get("sides") == 20]
    if len(d20) == 1 and len(d20[0]["kept"]) == 1:
        nat = d20[0]["rolls"][d20[0]["kept"][0]]
        result["natural"] = nat
        result["crit"] = "critico" if nat == 20 else "pifia" if nat == 1 else ""
    return result
