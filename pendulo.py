"""
Proyecto 5 - El péndulo: ¿cuándo vale la aproximación lineal?
Ecuaciones Diferenciales, Unidad 3 - Colegio Mayor del Cauca

QUÉ HACE ESTE PROGRAMA
----------------------
Compara dos ecuaciones del péndulo simple (masa m colgada de un hilo de largo L):

    péndulo real:    θ'' + (g/L)·sen θ = 0     → no es lineal (por el sen θ)
    modelo lineal:   θ'' + (g/L)·θ     = 0     → es lineal (se cambió sen θ por θ)

El modelo lineal sale de la serie de Taylor  sen θ = θ − θ³/6 + θ⁵/120 − …
quedándose solo con el primer término (Punto 3 del ejercicio a mano).

RELACIÓN CON EL EJERCICIO A MANO
--------------------------------
Punto 1 (a mano): se resolvió  θ'' + (g/L)θ = 0  con  θ(0) = θ₀,  θ'(0) = 0:
    ecuación característica  r² + g/L = 0  →  r = ±iω,  ω = √(g/L)
    solución general         θ(t) = C₁ cos(ωt) + C₂ sen(ωt)
    condiciones iniciales    C₁ = θ₀,  C₂ = 0
    solución particular      θ(t) = θ₀ cos(ωt)
    período                  ωT₀ = 2π  →  T₀ = 2π√(L/g) = 2.0061 s
  En el código: la función exacta_lineal() es esa fórmula, y T0 es ese período.

Punto 2 (a mano): T₀ no depende de θ₀, pero el péndulo real sí.
  En el código: medir_periodo() mide el período real para cada θ₀ y muestra que crece.

Punto 3 (a mano): Taylor y error relativo a 10° (0.51 %) y 90° (57.08 %).
  En el código: grafica_error_periodo() muestra cómo ese error se refleja en el período,
  y encuentra el ángulo donde el error del período pasa del 1 % (≈ 23°).

CÓMO SE EJECUTA
---------------
    pip install -r requirements.txt
    python pendulo.py

Genera las gráficas, la tabla y la animación en la carpeta "figuras/".
"""

# ----------------------------------------------------------------------------
# LIBRERÍAS
# ----------------------------------------------------------------------------
import os                         # para crear la carpeta de resultados
import sys                        # para configurar la salida de texto
if hasattr(sys.stdout, "reconfigure"):  # la consola de Windows viene en cp1252 y no imprime θ
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import numpy as np                # cálculo numérico: arreglos, sen, cos, raíz, π
import matplotlib
matplotlib.use("Agg")            # "Agg" guarda las gráficas como archivos sin abrir ventanas
import matplotlib.pyplot as plt   # para dibujar las gráficas
from matplotlib.animation import FuncAnimation, PillowWriter  # para la animación GIF


# ============================================================================
# 1. PARÁMETROS DEL SISTEMA
#    Son los datos del enunciado. Si se cambian aquí, todo se recalcula solo.
# ============================================================================
g = 9.81                          # gravedad [m/s²]  (¡9.81, no 9.8!)
L = 1.0                           # longitud del hilo [m]
w = np.sqrt(g / L)                # ω = √(g/L) = 3.1321 rad/s: frecuencia natural (Punto 1)
T0 = 2 * np.pi * np.sqrt(L / g)   # T₀ = 2π√(L/g) = 2.0061 s: período del modelo lineal (Punto 1)
h = 1e-3                          # paso de integración de RK4: 0.001 s (cada cuánto avanza el tiempo)

ANGULOS = [10, 45, 90, 150]       # amplitudes θ₀ que pide el enunciado [grados]
CARPETA = "figuras"               # carpeta donde se guardan los resultados


# ============================================================================
# 2. LAS DOS ECUACIONES COMO SISTEMAS DE PRIMER ORDEN
#
#    RK4 solo sabe resolver ecuaciones de PRIMER orden (con una sola derivada).
#    Nuestra ecuación es de SEGUNDO orden (θ''), así que se parte en dos:
#
#        u = θ      (el ángulo)
#        v = θ'     (la velocidad angular)
#
#    Entonces:
#        u' = θ' = v
#        v' = θ'' = −(g/L)·sen θ = −(g/L)·sen u     (péndulo real)
#        v' = θ'' = −(g/L)·θ     = −(g/L)·u         (modelo lineal)
#
#    Cada función recibe el tiempo t y el vector y = [u, v],
#    y devuelve las derivadas [u', v'].
# ============================================================================
def F_real(t, y):
    """Péndulo real:  u' = v,  v' = −(g/L)·sen(u)."""
    u, v = y                                   # separa el vector: u = ángulo, v = velocidad
    return np.array([v, -(g / L) * np.sin(u)])  # [u', v']


def F_lineal(t, y):
    """Modelo lineal:  u' = v,  v' = −(g/L)·u   (sen u cambiado por u)."""
    u, v = y
    return np.array([v, -(g / L) * u])


# ============================================================================
# 3. INTEGRADOR RUNGE-KUTTA DE ORDEN 4 (RK4), el del esqueleto de la guía
#
#    Idea: conocemos y en el instante t y queremos y en t + h.
#    En vez de usar una sola pendiente (como Euler), RK4 calcula 4 pendientes:
#       k1: pendiente al inicio del paso
#       k2: pendiente a la mitad del paso, usando k1
#       k3: pendiente a la mitad del paso, usando k2
#       k4: pendiente al final del paso, usando k3
#    y avanza con un promedio ponderado:  y(t+h) = y(t) + h/6·(k1 + 2k2 + 2k3 + k4)
#    Las de la mitad pesan el doble. El error por paso es del orden de h⁵: muy preciso.
#
#    Parámetros:
#       F   función con las derivadas (F_real o F_lineal)
#       y0  condición inicial [θ₀, θ'(0)]
#       t0, tf  tiempo inicial y final
#       h   tamaño del paso
#    Devuelve:
#       t   vector de tiempos
#       Y   matriz: columna 0 = ángulo θ(t), columna 1 = velocidad θ'(t)
# ============================================================================
def rk4(F, y0, t0, tf, h):
    t = np.arange(t0, tf + h / 2, h)          # tiempos t0, t0+h, t0+2h, … hasta tf
    Y = np.zeros((len(t), len(y0)))           # matriz vacía para guardar la solución
    Y[0] = y0                                 # primera fila = condición inicial
    for i in range(len(t) - 1):               # avanza un paso a la vez
        y, ti = Y[i], t[i]                    # estado y tiempo actuales
        k1 = F(ti, y)                         # pendiente al inicio
        k2 = F(ti + h / 2, y + h / 2 * k1)    # pendiente en la mitad (con k1)
        k3 = F(ti + h / 2, y + h / 2 * k2)    # pendiente en la mitad (con k2)
        k4 = F(ti + h, y + h * k3)            # pendiente al final (con k3)
        Y[i + 1] = y + h / 6 * (k1 + 2 * k2 + 2 * k3 + k4)  # promedio ponderado
    return t, Y


# ============================================================================
# 4. SOLUCIÓN EXACTA DEL MODELO LINEAL  →  es el resultado del PUNTO 1 a mano
#
#    θ(t) = θ₀·cos(ωt),   con ω = √(g/L)
#
#    Sirve para VERIFICAR el programa: si RK4 aplicado a F_lineal da lo mismo
#    que esta fórmula, entonces el integrador está bien hecho y se puede
#    confiar en él para el péndulo real (que no tiene una fórmula tan sencilla).
# ============================================================================
def exacta_lineal(t, theta0):
    return theta0 * np.cos(w * t)


# ============================================================================
# 5. MEDIR EL PERÍODO DEL PÉNDULO REAL  →  apoya el PUNTO 2
#
#    El péndulo se suelta desde el reposo en θ₀ (velocidad v = 0).
#    Baja, pasa por el centro y sube hasta el otro extremo, donde se detiene
#    otra vez (v = 0). Ese instante es la MITAD del período: T/2.
#
#    Cómo se encuentra:
#      - Al bajar, la velocidad es negativa (v < 0).
#      - En el otro extremo pasa de negativa a positiva: ahí cruza por cero.
#      - El cruce cae entre dos pasos de tiempo, así que se interpola con una
#        recta entre los dos puntos para hallar el instante exacto t*.
#      - Período: T = 2·t*.
# ============================================================================
def medir_periodo(theta0_grados):
    theta0 = np.radians(theta0_grados)          # ¡siempre en radianes! (sen θ ≈ θ solo vale en radianes)
    # Integra el péndulo real durante 3·T0 (alcanza de sobra para ver medio período)
    t, Y = rk4(F_real, np.array([theta0, 0.0]), 0.0, 3 * T0, h)
    v = Y[:, 1]                                 # columna de la velocidad θ'(t)
    for i in range(1, len(v) - 1):
        if v[i] < 0 and v[i + 1] >= 0:          # v pasa de negativa a positiva: llegó al otro extremo
            # Interpolación lineal: punto donde la recta entre (t[i], v[i]) y (t[i+1], v[i+1]) vale 0
            t_cero = t[i] - v[i] * (t[i + 1] - t[i]) / (v[i + 1] - v[i])
            return 2 * t_cero                   # el cruce es T/2, entonces T = 2·t*
    raise RuntimeError("No se encontró el cero de la velocidad: aumente tf")


# ============================================================================
# 6. GRÁFICAS Y TABLA
# ============================================================================
def grafica_verificacion():
    """GRÁFICA 1. Verificación: RK4 sobre el modelo lineal contra la solución exacta θ₀cos(ωt).

    Si las dos curvas quedan una encima de la otra (y su diferencia es diminuta),
    el integrador está bien programado.
    """
    theta0 = np.radians(45)                                      # caso de prueba: 45°
    t, Y = rk4(F_lineal, np.array([theta0, 0.0]), 0.0, 10.0, h)  # solución numérica
    exacta = exacta_lineal(t, theta0)        # solución exacta, en el MISMO vector de tiempos
    error = np.abs(Y[:, 0] - exacta)         # diferencia punto a punto

    fig, (a1, a2) = plt.subplots(2, 1, figsize=(9, 6.5), sharex=True)
    # Arriba: las dos curvas superpuestas (la exacta gruesa y transparente, la numérica punteada)
    a1.plot(t, np.degrees(exacta), lw=4, alpha=.35, label="exacta  θ0·cos(ωt)")
    a1.plot(t, np.degrees(Y[:, 0]), "--", lw=1.5, label="numérica (RK4, h = 0.001 s)")
    a1.set_ylabel("ángulo θ [grados]")
    a1.set_title("Verificación: modelo lineal, θ0 = 45°")
    a1.legend(loc="upper right"); a1.grid(alpha=.3)
    # Abajo: la diferencia en escala logarítmica (para poder ver números tan pequeños como 1e-11)
    a2.semilogy(t[1:], error[1:], color="tab:red")
    a2.set_xlabel("tiempo [s]"); a2.set_ylabel("|numérica − exacta| [rad]")
    a2.set_title("Diferencia entre las dos curvas (escala logarítmica)")
    a2.grid(alpha=.3, which="both")
    fig.tight_layout()
    fig.savefig(f"{CARPETA}/1_verificacion_lineal.png", dpi=150)
    plt.close(fig)
    return error.max()                       # se imprime en consola: ~1e-11 rad


def grafica_comparacion():
    """GRÁFICA 2. Péndulo real contra modelo lineal para 10°, 45°, 90° y 150°.

    A 10° las curvas casi coinciden; a 150° el real se atrasa mucho (Punto 2).
    """
    fig, ejes = plt.subplots(2, 2, figsize=(11, 7), sharex=True)   # cuadrícula 2×2
    for ax, d in zip(ejes.flat, ANGULOS):                           # un cuadro por ángulo
        theta0 = np.radians(d)
        t, Yr = rk4(F_real, np.array([theta0, 0.0]), 0.0, 10.0, h)  # real: con RK4
        ax.plot(t, np.degrees(exacta_lineal(t, theta0)), label="lineal (exacta)")  # lineal: fórmula del Punto 1
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
    """TABLA. Período real y error porcentual para los 4 ángulos del enunciado.

    Se dan las dos formas de calcular el error, porque el enunciado dice "frente a T₀"
    pero los valores de referencia dividen entre el período real T:
        error vs T0 = (T − T₀)/T₀ · 100
        error vs T  = (T − T₀)/T  · 100
    """
    filas = []
    print(f"\nT0 (lineal) = {T0:.4f} s\n")
    print(f"{'θ0':>5} | {'T real [s]':>10} | {'error vs T0':>11} | {'error vs T':>10}")
    print("-" * 47)
    for d in ANGULOS:
        T = medir_periodo(d)                 # período real medido con RK4
        e_T0 = 100 * (T - T0) / T0           # error dividiendo entre T₀
        e_T = 100 * (T - T0) / T             # error dividiendo entre T real
        filas.append((d, T, e_T0, e_T))
        print(f"{d:>4}° | {T:>10.4f} | {e_T0:>10.2f}% | {e_T:>9.2f}%")
    # Guarda la tabla en un archivo CSV (se abre con Excel)
    with open(f"{CARPETA}/tabla_periodos.csv", "w", encoding="utf-8") as f:
        f.write("theta0_grados,T_real_s,error_vs_T0_pct,error_vs_T_pct\n")
        for d, T, a, b in filas:
            f.write(f"{d},{T:.4f},{a:.2f},{b:.2f}\n")
    return filas


def grafica_error_periodo():
    """GRÁFICA 3. Error del período contra la amplitud, de 1° a 170°, y el umbral del 1 %.

    Muestra la consecuencia del Punto 3: cuanto más grande θ₀, peor es sen θ ≈ θ
    y más se separa el período real de T₀.
    """
    angulos = np.arange(1, 171, 1)                       # 1°, 2°, …, 170°
    errores = np.array([100 * (medir_periodo(d) - T0) / T0 for d in angulos])  # error de cada uno

    # Umbral: primer ángulo donde el error pasa de 1 %.
    # Está entre dos ángulos enteros, así que se interpola con una recta entre ellos.
    i = np.argmax(errores > 1.0)                         # índice del primer error mayor a 1 %
    umbral = angulos[i - 1] + (1.0 - errores[i - 1]) * (angulos[i] - angulos[i - 1]) / (errores[i] - errores[i - 1])

    # Dos cuadros: el rango completo y un acercamiento de 1° a 40° para ver el cruce del 1 %
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(12, 4.8))
    for ax, xmax in ((a1, 170), (a2, 40)):
        m = angulos <= xmax
        ax.plot(angulos[m], errores[m], lw=2, label="error del período")
        ax.axhline(1.0, color="tab:red", ls="--", label="1 %")                 # línea horizontal del 1 %
        ax.axvline(umbral, color="gray", ls=":", label=f"umbral ≈ {umbral:.1f}°")  # línea vertical del umbral
        ax.set_xlabel("amplitud θ0 [grados]")
        ax.set_ylabel("(T − T0) / T0  [%]")
        ax.grid(alpha=.3); ax.legend(loc="upper left")
    a1.set_title("Error del período lineal, 1° a 170°")
    a2.set_title("Zoom: 1° a 40°")
    a2.set_ylim(0, 3.5)
    fig.tight_layout()
    fig.savefig(f"{CARPETA}/3_error_periodo.png", dpi=150)
    plt.close(fig)
    return umbral                                        # ≈ 22.8°


def animacion(theta0_grados=90, duracion=12.0, fps=25):
    """ANIMACIÓN. Los dos péndulos lado a lado, soltados al mismo tiempo desde θ₀.

    El de la izquierda sigue el modelo lineal y el de la derecha el real.
    Con 90° se ve claro cómo el real se va quedando atrás.
    """
    theta0 = np.radians(theta0_grados)
    t, Yr = rk4(F_real, np.array([theta0, 0.0]), 0.0, duracion, h)  # real: RK4
    cada = int(round(1 / (fps * h)))           # RK4 da 1000 puntos por segundo; el GIF usa 25: se salta de 40 en 40
    t, real = t[::cada], Yr[::cada, 0]
    lineal = exacta_lineal(t, theta0)          # lineal: fórmula del Punto 1

    fig, ax = plt.subplots(figsize=(8, 4.6))
    ax.set_xlim(-3.2, 3.2); ax.set_ylim(-1.4, 0.45)
    ax.set_aspect("equal"); ax.axis("off")     # misma escala en x y y, sin ejes
    cx = {"lineal": -1.6, "real": 1.6}         # posición horizontal de cada punto de suspensión
    for nombre, x in cx.items():
        ax.plot([x - .3, x + .3], [0, 0], color="k", lw=3)   # el soporte
        ax.text(x, 0.22, "lineal  θ'' + (g/L)θ = 0" if nombre == "lineal" else "real  θ'' + (g/L)sen θ = 0",
                ha="center", fontsize=10)
    # Elementos que se mueven: los dos hilos y las dos masas
    hilo_l, = ax.plot([], [], color="0.3", lw=1.5)
    hilo_r, = ax.plot([], [], color="0.3", lw=1.5)
    bola_l, = ax.plot([], [], "o", ms=18, color="tab:blue")
    bola_r, = ax.plot([], [], "o", ms=18, color="tab:orange")
    texto = ax.text(0, -1.3, "", ha="center", fontsize=11)

    def cuadro(k):
        """Dibuja el cuadro número k de la animación."""
        for hilo, bola, x0, th in ((hilo_l, bola_l, cx["lineal"], lineal[k]),
                                   (hilo_r, bola_r, cx["real"], real[k])):
            # Posición de la masa a partir del ángulo: x = L·sen θ, y = −L·cos θ
            x, y = x0 + L * np.sin(th), -L * np.cos(th)
            hilo.set_data([x0, x], [0, y]); bola.set_data([x], [y])
        texto.set_text(f"θ0 = {theta0_grados}°    t = {t[k]:5.2f} s    "
                       f"diferencia de ángulo = {np.degrees(lineal[k] - real[k]):+6.1f}°")
        return hilo_l, hilo_r, bola_l, bola_r, texto

    anim = FuncAnimation(fig, cuadro, frames=len(t), interval=1000 / fps, blit=True)
    anim.save(f"{CARPETA}/4_animacion_{theta0_grados}grados.gif", writer=PillowWriter(fps=fps))
    plt.close(fig)


# ============================================================================
# 7. PROGRAMA PRINCIPAL: se ejecuta al correr  python pendulo.py
#    (no se ejecuta cuando otro archivo hace "import pendulo", como las pruebas)
# ============================================================================
if __name__ == "__main__":
    os.makedirs(CARPETA, exist_ok=True)                 # crea "figuras/" si no existe
    print(f"w = {w:.4f} rad/s    T0 = {T0:.4f} s")       # Punto 1: ω = 3.1321, T₀ = 2.0061

    err = grafica_verificacion()                        # gráfica 1
    print(f"Verificación lineal: diferencia máxima numérica vs exacta = {err:.2e} rad")

    grafica_comparacion()                               # gráfica 2
    tabla_periodos()                                    # tabla en consola y CSV
    umbral = grafica_error_periodo()                    # gráfica 3
    print(f"\nEl error del período supera el 1 % a partir de θ0 ≈ {umbral:.1f}°")

    print("\nGenerando animación (tarda unos segundos)...")
    animacion(90)                                       # GIF a 90°
    print(f"Listo. Revise la carpeta '{CARPETA}/'.")
