"""Genera todas las figuras del proyecto, la tabla de períodos y la animación en cámara lenta.

Usa el mismo módulo que la API en tiempo real (app/figures), así que lo que ve en el dashboard y lo que sale de aquí es idéntico.

    cd backend
    PYTHONPATH=. uv run python scripts/generate_figures.py                    # carpeta ../figuras, tema claro
    PYTHONPATH=. uv run python scripts/generate_figures.py --theta0 60 --theme both --slow 0.2
    PYTHONPATH=. uv run python scripts/generate_figures.py --no-gif           # sin animación (más rápido)
"""
from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

from app.core.pendulum import Params
from app.figures import render as R
from app.figures import tables

ROOT = Path(__file__).resolve().parents[2]


def main() -> None:
    for stream in (sys.stdout, sys.stderr):  # las consolas de Windows usan cp1252 y no admiten θ₀ ni →
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", type=Path, default=ROOT / "figuras", help="carpeta de salida (por defecto ../figuras)")
    ap.add_argument("--theta0", type=float, default=90.0, help="ángulo de suelta en grados (por defecto 90)")
    ap.add_argument("--L", type=float, default=1.0, help="longitud en m")
    ap.add_argument("--g", type=float, default=9.81, help="gravedad en m/s²")
    ap.add_argument("--theme", choices=("light", "dark", "both"), default="light")
    ap.add_argument("--dpi", type=int, default=200, help="resolución de los PNG (por defecto 200)")
    ap.add_argument("--formats", nargs="+", default=["png", "svg"], choices=list(R.FORMATS))
    ap.add_argument("--slow", type=float, default=0.25, help="factor de cámara lenta de la animación (0.25 = 4× más lenta)")
    ap.add_argument("--seconds", type=float, default=8.0, help="duración del GIF en segundos")
    ap.add_argument("--fps", type=int, default=20)
    ap.add_argument("--no-gif", action="store_true", help="omitir la animación")
    a = ap.parse_args()

    p = Params(a.theta0, a.L, a.g)
    themes = ("light", "dark") if a.theme == "both" else (a.theme,)
    a.out.mkdir(parents=True, exist_ok=True)

    print(f"Parámetros: θ₀ = {a.theta0:g}°, L = {a.L:g} m, g = {a.g:g} m/s²   →   {a.out}\n")
    for theme in themes:
        suffix = "" if len(themes) == 1 else f"_{theme}"
        for name, (_, title, kind) in R.CATALOG.items():
            for fmt in a.formats:
                t0 = time.time()
                data = R.render(name, p, theme, fmt, a.dpi)
                (a.out / f"{name}{suffix}.{fmt}").write_bytes(data)
                print(f"  {name}{suffix}.{fmt:<4} {len(data) / 1024:7.0f} KB  {time.time() - t0:4.1f} s   {title} ({kind})")
        if not a.no_gif:
            t0 = time.time()
            data = R.render_gif(p, theme, a.slow, a.seconds, a.fps, 90)
            (a.out / f"animacion_camara_lenta{suffix}.gif").write_bytes(data)
            print(f"  animacion_camara_lenta{suffix}.gif {len(data) / 1024:5.0f} KB  {time.time() - t0:4.1f} s   {a.slow:g}× ({a.seconds:g} s)")

    rows = tables.period_table(a.L, a.g)
    (a.out / "tabla_periodos.csv").write_text(tables.to_csv(rows), encoding="utf-8")
    print(f"\nT₀ = {rows[0]['T0_lineal_s']:.4f} s")
    print(f"{'θ₀':>5} | {'T medido (RK4)':>14} | {'T exacto':>9} | {'error vs T':>10} | {'error vs T₀':>11}")
    for r in rows:
        print(f"{r['theta0_grados']:>4g}° | {r['T_medido_RK4_s']:>14.4f} | {r['T_exacto_s']:>9.4f} | {r['error_vs_T_pct']:>9.2f}% | {r['error_vs_T0_pct']:>10.2f}%")
    print(f"\nListo. Figuras en {a.out}")


if __name__ == "__main__":
    main()
