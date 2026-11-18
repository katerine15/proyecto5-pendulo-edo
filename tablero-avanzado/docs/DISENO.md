# Guía de diseño

## Dirección: hoja de laboratorio

El dashboard se parece a lo que es: una hoja de medidas de un laboratorio de física. Papel milimetrado,
tinta azul para el modelo lineal, lápiz rojo para el péndulo real, grafito para la solución exacta. Es una
herramienta de trabajo (el usuario compara y mide), así que prima que se lea rápido y sea consistente; la
personalidad está en los detalles: el transportador de grados, la estela de lápiz y los datos con puntos guía.

Por qué claro por defecto: se proyecta en un salón con luz ambiente. El tema oscuro («pizarra») se activa con el
botón o sigue al sistema si no hay preferencia guardada.

## Decisiones

| Qué | Decisión | Razón |
|---|---|---|
| Veredicto | Una frase con el dato dentro («A 90°, el modelo lineal subestima el período real en un 15.3 %»; error relativo a T, como la guía) | Responde la pregunta del proyecto; un número gigante con etiqueta es la plantilla genérica |
| Escena | Modelo 3D hecho en Blender (soporte de acero, base de madera, transportador) movido en vivo por los datos; respaldo SVG sin WebGL | Es el protagonista y se ve como un instrumento real; el modelo pesa 285 KB |
| Estructura | Barra lateral con vistas, barra superior y pestañas inferiores en móvil; paneles de un solo nivel | Se navega como una aplicación; los paneles agrupan sin anidar |
| Tipografía | Archivo (variable, ancho y peso), incluida en el proyecto | Una sola familia; funciona sin internet; cifras tabulares |
| Etiquetas | Sin mayúsculas sostenidas ni rótulos sobre cada título | El título ya dice de qué trata la zona |
| Datos | Lista con puntos guía (`Período real T ····· 2.3678 s`) | Se lee como una hoja de medidas |
| IA | Sin íconos de destellos; se llama «red neuronal» y muestra su error | Es un predictor numérico, y se dice como es |

## Color (todos los pares verificados en `frontend/src/design/tokens.test.ts`)

| Token | Claro | Oscuro | Significa |
|---|---|---|---|
| `--lin` | `#1d4ed8` | `#7ca2ff` | Aproximación **lineal** |
| `--real` | `#c62828` | `#ff7a6e` | Péndulo **real** |
| `--exact` | `#2b2b2b` | `#dadfe5` | Solución **exacta** |
| `--ok` / `--warn` / `--bad` | verde / ámbar / ciruela | — | Error < 1 % / < 5 % / ≥ 5 % |

El estado «mal» es ciruela y no rojo, para no confundirse con la serie del péndulo real. Cada fondo tiene su
color de texto pareado; el texto en oscuro es blanco roto, no `#fff`; todo texto y trazo cumple contraste
≥ 4.5:1 en ambos temas (24 pruebas automáticas).

## Movimiento (librería Motion, `motion/react`)

Todo movimiento responde a una acción o es la información misma (los péndulos). Curva común `[0.22, 1, 0.36, 1]`.

| Interacción | Componente | Detalle |
|---|---|---|
| Cambiar de vista | `ui/BlurViewTransition` | La saliente se desenfoca y se desvanece; la entrante entra desde escala 0.98 con desenfoque de 6 px que se aclara, en 300 ms |
| Menú lateral y pestañas | `ui/SegmentedTabs`, `layout/Shell` | Píldora activa que se desliza (`layoutId` único por grupo); flechas, Inicio y Fin del teclado |
| Cifras | `ui/AnimatedNumber` | Cuentan desde 0 al montar y desde el valor anterior al cambiar |
| Interruptores | `ui/Switch` | `role="switch"`, perilla con resorte |
| Botones | `whileTap` | Escala 0.95 al pulsar los ángulos predefinidos |
| Paneles | CSS | El borde se acentúa al pasar el cursor |

Con «reducir movimiento» activado en el sistema no hay escalado ni desenfoque (solo fundido), las cifras saltan
directo y la simulación arranca en pausa. Los péndulos se mueven escribiendo la rotación de cada brazo 3D en cada
cuadro, sin re-renderizar React.

## Modelo 3D (Blender → navegador)

`assets/blender/build_pendulum.py` construye el soporte, el brazo y el transportador y los exporta a
`frontend/public/models/pendulo.glb`. `Stage3D.tsx` carga el archivo con `GLTFLoader`, clona el brazo dos veces
(azul para el lineal, rojo para el real) y en cada cuadro asigna `arm.rotation.z = θ(t)` leído del store. El modelo
**no tiene animación grabada**: obedece a los datos, así que cambia en tiempo real con los controles.

## Reglas de gráficas (también son criterio de la rúbrica)

- Ejes con **nombre y unidad**: «Tiempo t (s)», «Ángulo θ (°)», «Error del período (%)».
- Leyenda siempre visible sobre la gráfica; el color es el mismo en toda la interfaz.
- Cursor sincronizado con la animación; al pasar el ratón se leen los valores exactos.
- Cada gráfica lleva una frase que dice qué concluir de ella.

## Accesibilidad

Foco visible, botones con `aria-label`, escena y gráficas con descripción, controles de teclado,
diseño responsivo (probado a 375 px).

## Fuentes de criterio

La dirección y las reglas salen de estas guías abiertas (se leyeron como texto; **no** se instalaron como
habilidades activas ni se ejecutó ningún script suyo):

- [Impeccable](https://github.com/pbakaus/impeccable) (Apache-2.0): modo «Operar» para herramientas, piso de calidad y lista de patrones genéricos a evitar.
- [UI/UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) (MIT): prioridades (accesibilidad y contraste primero) y reglas de gráficas.
- [LottieFiles motion-design](https://github.com/LottieFiles/motion-design-skill) (MIT): duraciones por tipo de elemento, curvas, y «el movimiento comunica estado».
- Patrones de interacción de un panel de referencia compartido en Reddit: transición con desenfoque, pestañas con `layoutId`, contador animado, interruptores con resorte.
- [jezweb color-palette](https://github.com/jezweb/claude-skills) (MIT): pares fondo/texto, modo oscuro y verificación WCAG.
- La habilidad `frontend-design` de Anthropic, ya instalada en el entorno.
