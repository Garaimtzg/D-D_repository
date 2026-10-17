# Mesa de D&D

Una mesa de rol para jugar a Dungeons & Dragons (5e) **en un solo ordenador**, todos juntos:
mapa con fichas que se arrastran, dados 3D que ruedan de verdad, combates con iniciativa,
fichas de personaje, música, ambientes y efectos de sonido.

Servidor en Python (solo la librería estándar, no hay que instalar nada) e interfaz en HTML, CSS y JavaScript.
Todo se guarda en local, en la carpeta `data/`.

## Arrancar

1. Instala Python 3.10 o posterior desde [python.org](https://www.python.org/downloads/)
   (en Windows, marca **«Add python.exe to PATH»**).
2. **Windows:** doble clic en `Iniciar Mesa DnD.bat`. **macOS / Linux:** `sh iniciar.sh`.

Se abre el navegador en `http://localhost:8000` (si el puerto está ocupado, usa el siguiente libre).
Para cerrar la mesa, cierra la ventana negra de la consola.

## Cómo se juega

- **Mesa** es la pantalla principal: el mapa sobre un tapete, las fichas de los personajes encima,
  la iniciativa del combate en una cinta, el grupo con sus PG y la bandeja de dados.
- Pulsa **Modo jugadores** para ponerla a pantalla completa sin secretos: se ocultan los PG exactos
  de los enemigos, los enemigos ocultos y las tiradas secretas. Sal con `Esc`.
- En la bandeja, elige **quién tira**: los dados toman el color de su ficha y aparecen sus ataques.
- `Mayús + clic` sobre el mapa hace una onda para señalar un punto a toda la mesa.

### Atajos

| Tecla | Acción |
| --- | --- |
| `/` | Escribir una tirada (`2d6+3`, `4d6kh3`, `d%`…) |
| `1` … `9` | Ir a cada sección |
| `Mayús` / `Alt` + clic en el d20 | Tirar con ventaja / desventaja |
| `Intro` / `Mayús + Intro` en una casilla de PG | Daño / curación |
| Doble clic en el mapa | Ajustar el mapa a la pantalla |
| Clic derecho en una ficha del mapa | Quitarla |

## Qué incluye

| Sección | Para qué sirve |
| --- | --- |
| **Mesa** | Mapa con zoom y fichas arrastrables, cinta de iniciativa con anuncio de turno, grupo, bandeja de dados, últimas tiradas, reloj del mundo, narración en pergamino y **clima** sobre el tablero (lluvia, tormenta con relámpagos, nieve, niebla, brasas) con su sonido. |
| **Combate** | Encuentros con fichas, bestiario o participantes rápidos; medidor de dificultad, iniciativa, turnos y rondas, daño y curación con números flotantes, estados con duración, concentración, salvaciones de muerte, daño en área, enemigos ocultos y crónica. Al ganar, reparto de PX. |
| **Personajes** | Jugadores, personajes de la historia y enemigos como cartas. La ficha imita una hoja en pergamino: características, salvaciones, habilidades, CA, PG, dados de golpe, ataques, conjuros con espacios, recursos, inventario con monedas, rasgos y notas. Todo se tira con un clic. |
| **Mapas** | Galería de imágenes para poner sobre la mesa, con notas privadas. |
| **Dados** | Bandeja con dados 3D, constructor de tiradas, favoritos, generador de características, historial y «la suerte del d20». |
| **Notas** | Diario de campaña con aspecto de libro y tablón de misiones con notas que se arrastran entre columnas. |
| **Herramientas** | Copia de la campaña (.zip), generadores (PNJ, tabernas, botín, ganchos, clima…), calculadora de encuentros, reloj, temporizadores, narración, tablas aleatorias propias, monedas, botín, viajes y dados para el móvil. |
| **Música** | Tus canciones por escenas (taberna, combate, jefe…), disco que gira y visualizador; ambientes sintetizados sin ficheros: lluvia, viento, hoguera, cueva y taberna. |
| **Reglas** | Estados, acciones, reglas rápidas, CD, agotamiento y tablas de PX con buscador. |

### Sonido

Todo el sonido se genera en el navegador, sin ficheros: dados que chocan, espadas, gong al cambiar
de ronda, redoble de iniciativa, golpes, curación, monedas, fanfarrias de victoria y de subida de
nivel, truenos… Se activa o se silencia con el altavoz de la barra lateral.

## Dados en el móvil

`static/dados-movil.html` es una página de dados **autónoma**: un único fichero que funciona sin
servidor ni internet, con los mismos dados 3D, sonido, vibración, «agitar para tirar» e historial.
Descárgala desde **Herramientas → Dados en el móvil**, pásala al móvil y ábrela en el navegador.

## Guardar y compartir la campaña

Todo se guarda solo en `data/`. En **Herramientas → Campaña** puedes **descargar una copia** (.zip con
fichas, combates, notas, mapas y música) y **cargarla** en otro ordenador. Al cargar una copia, la
campaña anterior se guarda antes en `data/backups/`.

```bash
python app.py --port 9000          # otro puerto
python app.py --data otra_campana  # varias campañas en carpetas distintas
python app.py --no-browser         # no abrir el navegador
```

Las fuentes decorativas se cargan de Google Fonts; sin internet se usan las del sistema y todo sigue funcionando.

## Estructura

```
app.py                     arranque
Iniciar Mesa DnD.bat       arranque con doble clic en Windows (iniciar.sh en macOS / Linux)
server/                    servidor HTTP, API JSON, almacén, copias .zip, dados, reglas, generadores, bestiario
static/
  index.html               la aplicación
  dados-movil.html         página de dados para el móvil (generada, no editar)
  css/                     base, componentes, barra, mesa, personajes, combate y demás secciones
  js/main.js               navegación, barras y atajos
  js/lib/dice3d.js         motor de dados 3D (también va dentro de dados-movil.html)
  js/lib/dicenotation.js   intérprete de tiradas para el móvil
  js/core/                 api, dom, reglas, dados, combate, sonido, música, ambientes, clima, atmósfera
  js/views/                una sección por fichero
movil/                     fuentes de la página del móvil
tools/build_movil.py       genera static/dados-movil.html
tests/                     pruebas
```

Para añadir una sección, crea `static/js/views/mi-seccion.js` exportando `{ id, title, icon, hint, mount(root) }`
y añádela a `static/js/main.js`. Si cambias el motor de dados o `movil/`, regenera la página del móvil:

```bash
python tools/build_movil.py
python -m unittest discover tests
```

El bestiario usa contenido del SRD 5.1 (licencia CC-BY-4.0, Wizards of the Coast).
