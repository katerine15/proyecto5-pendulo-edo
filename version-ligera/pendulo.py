"""
Proyecto 5 - El péndulo: ¿cuándo vale la aproximación lineal?
Ecuaciones Diferenciales, Unidad 3 - Colegio Mayor del Cauca

Compara el péndulo real (no lineal) con su aproximación lineal:

    real:    theta'' + (g/L) sen(theta) = 0
    lineal:  theta'' + (g/L) theta      = 0

Solución exacta del modelo lineal (deducida a mano):
    theta(t) = theta0 * cos(w t),   w = sqrt(g/L),   T0 = 2*pi*sqrt(L/g)

Ejecutar:  python pendulo.py
Genera todas las gráficas y la animación en la carpeta "figuras/".
"""

import os
import numpy as np
import matplotlib
matplotlib.use("Agg")            # para guardar archivos sin abrir ventanas
import matplotlib.pyplot as plt
from matplotlib.animation import FuncAnimation, PillowWriter

# ---------------------------------------------------------------
# 1. PARÁMETROS DEL SISTEMA (se pueden cambiar aquí)
# ---------------------------------------------------------------
g = 9.81                         # gravedad [m/s^2]
L = 1.0                          # longitud del hilo [m]
w = np.sqrt(g / L)               # frecuencia angular natural [rad/s]
T0 = 2 * np.pi * np.sqrt(L / g)  # período del modelo lineal [s]
h = 1e-3                         # paso de integración [s]

ANGULOS = [10, 45, 90, 150]      # amplitudes que pide el enunciado [grados]
CARPETA = "figuras"


# ---------------------------------------------------------------
# 2. LAS DOS ECUACIONES COMO SISTEMAS DE PRIMER ORDEN
#    u = theta (ángulo),  v = theta' (velocidad angular)
#    u' = v,   v' = -(g/L) * sen(u)   ó   v' = -(g/L) * u
# ---------------------------------------------------------------
def F_real(t, y):
    u, v = y
    return np.array([v, -(g / L) * np.sin(u)])


def F_lineal(t, y):
    u, v = y
    return np.array([v, -(g / L) * u])


# ---------------------------------------------------------------
# 3. INTEGRADOR RUNGE-KUTTA DE ORDEN 4 (el del esqueleto de la guía)
# ---------------------------------------------------------------
def rk4(F, y0, t0, tf, h):
    t = np.arange(t0, tf + h / 2, h)
    Y = np.zeros((len(t), len(y0)))
    Y[0] = y0
    for i in range(len(t) - 1):
        y, ti = Y[i], t[i]
        k1 = F(ti, y)
        k2 = F(ti + h / 2, y + h / 2 * k1)
        k3 = F(ti + h / 2, y + h / 2 * k2)
        k4 = F(ti + h, y + h * k3)
        Y[i + 1] = y + h / 6 * (k1 + 2 * k2 + 2 * k3 + k4)
    return t, Y


# ---------------------------------------------------------------
# 4. SOLUCIÓN EXACTA DEL MODELO LINEAL (la que se dedujo a mano)
# ---------------------------------------------------------------
def exacta_lineal(t, theta0):
    return theta0 * np.cos(w * t)


# ---------------------------------------------------------------
# 5. MEDIR EL PERÍODO: el péndulo sale del reposo (v = 0) en theta0.
#    La velocidad vuelve a ser cero en el otro extremo, a los T/2.
#    Buscamos el primer cambio de signo de v y interpolamos linealmente.
# ---------------------------------------------------------------
def medir_periodo(theta0_grados):
    theta0 = np.radians(theta0_grados)          # ¡siempre en radianes!
    t, Y = rk4(F_real, np.array([theta0, 0.0]), 0.0, 3 * T0, h)
    v = Y[:, 1]
    for i in range(1, len(v) - 1):
        if v[i] < 0 and v[i + 1] >= 0:          # v pasa de negativa a positiva
            t_cero = t[i] - v[i] * (t[i + 1] - t[i]) / (v[i + 1] - v[i])
            return 2 * t_cero
    raise RuntimeError("No se encontró el cero de la velocidad: aumente tf")


# ---------------------------------------------------------------
# 6. GRÁFICAS
# ---------------------------------------------------------------
def grafica_verificacion():
    """Numérica vs exacta del modelo lineal: deben superponerse."""
    theta0 = np.radians(45)
    t, Y = rk4(F_lineal, np.array([theta0, 0.0]), 0.0, 10.0, h)
    exacta = exacta_lineal(t, theta0)               # mismo vector de tiempos
    error = np.abs(Y[:, 0] - exacta)

    fig, (a1, a2) = plt.subplots(2, 1, figsize=(9, 6.5), sharex=True)
    a1.plot(t, np.degrees(exacta), lw=4, alpha=.35, label="exacta  θ0·cos(ωt)")
    a1.plot(t, np.degrees(Y[:, 0]), "--", lw=1.5, label="numérica (RK4, h = 0.001 s)")
    a1.set_ylabel("ángulo θ [grados]")
    a1.set_title("Verificación: modelo lineal, θ0 = 45°")
    a1.legend(loc="upper right"); a1.grid(alpha=.3)
    a2.semilogy(t[1:], error[1:], color="tab:red")
    a2.set_xlabel("tiempo [s]"); a2.set_ylabel("|numérica − exacta| [rad]")
    a2.set_title("Diferencia entre las dos curvas (escala logarítmica)")
    a2.grid(alpha=.3, which="both")
    fig.tight_layout()
    fig.savefig(f"{CARPETA}/1_verificacion_lineal.png", dpi=150)
    plt.close(fig)
    return error.max()


def grafica_comparacion():
    """Péndulo real vs lineal para los cuatro ángulos."""
    fig, ejes = plt.subplots(2, 2, figsize=(11, 7), sharex=True)
    for ax, d in zip(ejes.flat, ANGULOS):
        theta0 = np.radians(d)
        t, Yr = rk4(F_real, np.array([theta0, 0.0]), 0.0, 10.0, h)
        ax.plot(t, np.degrees(exacta_lineal(t, theta0)), label="lineal (exacta)")
        ax.plot(t, np.degrees(Yr[:, 0]), label="real (numérica)")
        ax.set_title(f"θ0 = {d}°"); ax.grid(alpha=.3)
        ax.set_ylabel("θ [grados]")
    for ax in ejes[1]:
        ax.set_xlabel("tiempo [s]")
    fig.suptitle("Péndulo real vs aproximación lineal (L = 1 m)")
    fig.tight_layout(rect=(0, 0, 1, 0.92))
    fig.legend(*ejes[0, 0].get_legend_handles_labels(), loc="upper center",
               bbox_to_anchor=(0.5, 0.955), ncol=2, frameon=False)
    fig.savefig(f"{CARPETA}/2_real_vs_lineal.png", dpi=150)
    plt.close(fig)


def tabla_periodos():
    """Tabla con el período real y el error frente a T0."""
    filas = []
    print(f"\nT0 (lineal) = {T0:.4f} s\n")
    print(f"{'θ0':>5} | {'T real [s]':>10} | {'error vs T0':>11} | {'error vs T':>10}")
    print("-" * 47)
    for d in ANGULOS:
        T = medir_periodo(d)
        e_T0 = 100 * (T - T0) / T0
        e_T = 100 * (T - T0) / T
        filas.append((d, T, e_T0, e_T))
        print(f"{d:>4}° | {T:>10.4f} | {e_T0:>10.2f}% | {e_T:>9.2f}%")
    with open(f"{CARPETA}/tabla_periodos.csv", "w", encoding="utf-8") as f:
        f.write("theta0_grados,T_real_s,error_vs_T0_pct,error_vs_T_pct\n")
        for d, T, a, b in filas:
            f.write(f"{d},{T:.4f},{a:.2f},{b:.2f}\n")
    return filas


def grafica_error_periodo():
    """Error del período vs amplitud y ángulo donde supera el 1 %."""
    angulos = np.arange(1, 171, 1)
    errores = np.array([100 * (medir_periodo(d) - T0) / T0 for d in angulos])

    # primer ángulo donde el error pasa del 1 %, interpolando entre dos puntos
    i = np.argmax(errores > 1.0)
    umbral = angulos[i - 1] + (1.0 - errores[i - 1]) * (angulos[i] - angulos[i - 1]) / (errores[i] - errores[i - 1])

    fig, (a1, a2) = plt.subplots(1, 2, figsize=(12, 4.8))
    for ax, xmax in ((a1, 170), (a2, 40)):
        m = angulos <= xmax
        ax.plot(angulos[m], errores[m], lw=2, label="error del período")
        ax.axhline(1.0, color="tab:red", ls="--", label="1 %")
        ax.axvline(umbral, color="gray", ls=":", label=f"umbral ≈ {umbral:.1f}°")
        ax.set_xlabel("amplitud θ0 [grados]")
        ax.set_ylabel("(T − T0) / T0  [%]")
        ax.grid(alpha=.3); ax.legend(loc="upper left")
    a1.set_title("Error del período lineal, 1° a 170°")
    a2.set_title("Zoom: 1° a 40°")
    a2.set_ylim(0, 3.5)
    fig.tight_layout()
    fig.savefig(f"{CARPETA}/3_error_periodo.png", dpi=150)
    plt.close(fig)
    return umbral


def animacion(theta0_grados=90, duracion=12.0, fps=25):
    """Los dos péndulos lado a lado, soltados al mismo tiempo."""
    theta0 = np.radians(theta0_grados)
    t, Yr = rk4(F_real, np.array([theta0, 0.0]), 0.0, duracion, h)
    cada = int(round(1 / (fps * h)))           # cuadros a saltar
    t, real = t[::cada], Yr[::cada, 0]
    lineal = exacta_lineal(t, theta0)

    fig, ax = plt.subplots(figsize=(8, 4.6))
    ax.set_xlim(-3.2, 3.2); ax.set_ylim(-1.4, 0.45)
    ax.set_aspect("equal"); ax.axis("off")
    cx = {"lineal": -1.6, "real": 1.6}
    for nombre, x in cx.items():
        ax.plot([x - .3, x + .3], [0, 0], color="k", lw=3)
        ax.text(x, 0.22, "lineal  θ'' + (g/L)θ = 0" if nombre == "lineal" else "real  θ'' + (g/L)sen θ = 0",
                ha="center", fontsize=10)
    hilo_l, = ax.plot([], [], color="0.3", lw=1.5)
    hilo_r, = ax.plot([], [], color="0.3", lw=1.5)
    bola_l, = ax.plot([], [], "o", ms=18, color="tab:blue")
    bola_r, = ax.plot([], [], "o", ms=18, color="tab:orange")
    texto = ax.text(0, -1.3, "", ha="center", fontsize=11)

    def cuadro(k):
        for hilo, bola, x0, th in ((hilo_l, bola_l, cx["lineal"], lineal[k]),
                                   (hilo_r, bola_r, cx["real"], real[k])):
            x, y = x0 + L * np.sin(th), -L * np.cos(th)
            hilo.set_data([x0, x], [0, y]); bola.set_data([x], [y])
        texto.set_text(f"θ0 = {theta0_grados}°    t = {t[k]:5.2f} s    "
                       f"diferencia de ángulo = {np.degrees(lineal[k] - real[k]):+6.1f}°")
        return hilo_l, hilo_r, bola_l, bola_r, texto

    anim = FuncAnimation(fig, cuadro, frames=len(t), interval=1000 / fps, blit=True)
    anim.save(f"{CARPETA}/4_animacion_{theta0_grados}grados.gif", writer=PillowWriter(fps=fps))
    plt.close(fig)


# ---------------------------------------------------------------
# 7. PROGRAMA PRINCIPAL
# ---------------------------------------------------------------
if __name__ == "__main__":
    os.makedirs(CARPETA, exist_ok=True)
    print(f"w = {w:.4f} rad/s    T0 = {T0:.4f} s")

    err = grafica_verificacion()
    print(f"Verificación lineal: diferencia máxima numérica vs exacta = {err:.2e} rad")

    grafica_comparacion()
    tabla_periodos()
    umbral = grafica_error_periodo()
    print(f"\nEl error del período supera el 1 % a partir de θ0 ≈ {umbral:.1f}°")

    print("\nGenerando animación (tarda unos segundos)...")
    animacion(90)
    print(f"Listo. Revise la carpeta '{CARPETA}/'.")
