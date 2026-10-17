"""Genera static/dados-movil.html: la página de dados para el móvil en un único fichero.

Incrusta el motor de dados 3D y el intérprete de tiradas de la app (static/js/lib) junto con
movil/movil.css y movil/movil.js, para que funcione abriendo el fichero sin servidor ni internet.

    python tools/build_movil.py
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "static" / "dados-movil.html"
PARTS = {
    "/*{{CSS}}*/": ROOT / "movil" / "movil.css",
    "/*{{DICE3D}}*/": ROOT / "static" / "js" / "lib" / "dice3d.js",
    "/*{{NOTATION}}*/": ROOT / "static" / "js" / "lib" / "dicenotation.js",
    "/*{{APP}}*/": ROOT / "movil" / "movil.js",
}


def build() -> str:
    page = (ROOT / "movil" / "plantilla.html").read_text(encoding="utf-8")
    for marker, path in PARTS.items():
        code = path.read_text(encoding="utf-8")
        if "</script" in code.lower() or "</style" in code.lower():
            raise ValueError(f"{path.name} no se puede incrustar: contiene una etiqueta de cierre")
        if marker not in page:
            raise ValueError(f"Falta el marcador {marker} en la plantilla")
        page = page.replace(marker, code.strip())
    return page


def main():
    OUTPUT.write_text(build(), encoding="utf-8", newline="\n")
    print(f"Generado {OUTPUT.relative_to(ROOT)} ({OUTPUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
