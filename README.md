# Mesa de D&D

Herramienta para dirigir partidas de Dungeons & Dragons (5e) con tus amigos. Servidor en Python
(solo librería estándar, sin instalar nada) y una interfaz web en HTML, CSS y JavaScript.

## Arrancar

La mesa funciona como una web **local**: se ejecuta en el ordenador del máster y no necesita
internet ni cuentas. Todo (fichas, combates, mapas, música…) se guarda en la carpeta `data/` de ese ordenador.

1. Instala Python 3.10 o posterior desde [python.org](https://www.python.org/downloads/)
   (en Windows, marca **«Add python.exe to PATH»**).
2. Descarga o clona esta carpeta.
3. **Windows:** doble clic en `Iniciar Mesa DnD.bat`. **macOS / Linux:** `sh iniciar.sh`.

Se abre el navegador en `http://localhost:8000` (si ese puerto está ocupado, usa el siguiente libre).
Para cerrar la mesa, cierra la ventana negra de la consola.

### Jugar todos en un mismo ordenador

- El máster usa la app normal (`localhost:8000`).
- El botón **Pantalla jugadores** abre `player.html` en otra ventana: llévala a un segundo monitor
  o a la tele (F11 o «Pantalla completa»). Ahí solo se ve lo que el máster comparte: el mapa elegido,
  la iniciativa (sin PG de los enemigos ni los ocultos), la hora, los mensajes y las tiradas públicas.
- Si solo hay una pantalla, alterna entre las dos ventanas; las tiradas secretas y las notas no salen en la de jugadores.

### Cada uno con su propia copia

Cualquiera puede descargarse la carpeta y tener su mesa local para dirigir sus partidas.
En **Herramientas → Campaña** puedes **descargar una copia** (.zip con todo) y **cargarla** en otro
ordenador, por ejemplo para pasar la campaña a otro máster o hacer copias de seguridad.
Al cargar una copia, la campaña anterior se guarda automáticamente en `data/backups/`.

### Opciones avanzadas

```bash
python app.py --port 9000          # otro puerto
python app.py --data otra_campana  # varias campañas en carpetas distintas
python app.py --lan                # que otros dispositivos de la misma wifi abran la pantalla de jugadores
python app.py --no-browser         # no abrir el navegador
```

Las fuentes decorativas se cargan de Google Fonts; sin internet se usan las del sistema y todo sigue funcionando.

## Qué incluye

| Sección | Para qué sirve |
| --- | --- |
| **Personajes** | Fichas completas de jugadores, personajes de la historia (PNJ) y enemigos: características, salvaciones, habilidades con competencia/pericia, ataques, conjuros y espacios, recursos, inventario y monedas, estados, agotamiento, salvaciones de muerte, retrato. Todo se tira con un clic. Bestiario SRD para crear enemigos al momento, duplicar fichas, descansos de grupo y reparto de PX. |
| **Combate** | Prepara encuentros con fichas, monstruos del bestiario o participantes rápidos. Calcula la dificultad, tira iniciativa, lleva turnos y rondas, daño/curación con PG temporales, estados con duración, concentración (avisa de la CD), salvaciones de muerte, daño en área con salvación automática, enemigos ocultos y registro. Al terminar reparte la experiencia. |
| **Mapas** | Sube una imagen como mapa, haz zoom y desplázate. Con un botón se muestra en la pantalla de jugadores. |
| **Dados** | Bandeja de dados, expresiones (`2d6+3`, `4d6kh3`, `d%`), ventaja/desventaja, tiradas secretas, favoritos e historial compartido. |
| **Herramientas** | Copia de seguridad de la campaña (descargar/cargar .zip), generadores (PNJ, nombres, tabernas, botín, ganchos, clima, baratijas), calculadora de encuentros, reloj del mundo, temporizador de turno y de sesión, mensaje a los jugadores, conversor de monedas, reparto de botín, tablas aleatorias propias y calculadora de viajes. |
| **Notas** | Diario de campaña por sesiones con búsqueda y etiquetas, y tablero de misiones. |
| **Música** | Sube tus canciones, organízalas por ambiente y reprodúcelas mientras navegas por la app. |
| **Reglas** | Estados, acciones de combate, reglas rápidas, agotamiento, habilidades y tablas de PX, con buscador. |
| **Pantalla de jugadores** | `player.html`: el mapa que muestres, el orden de iniciativa (sin PG exactos de los enemigos ni los ocultos), la hora del mundo, tus mensajes y las tiradas públicas. |

## Estructura

```
app.py                  arranque (argumentos de línea de comandos)
Iniciar Mesa DnD.bat    arranque con doble clic en Windows
iniciar.sh              arranque en macOS / Linux
server/
  config.py             rutas y límites
  handler.py            servidor HTTP: estáticos, subidas y API
  api.py                rutas de la API JSON
  storage.py            almacén JSON (un fichero por colección)
  backup.py             exportar / importar la campaña en .zip
  dice.py               intérprete de tiradas
  rules.py              tablas y reglas 5e, cálculo de encuentros
  generators.py         generadores aleatorios
  monsters.py           bestiario SRD
static/
  index.html            app del máster
  player.html           pantalla de jugadores
  css/                  base, componentes, secciones y pantalla de jugadores
  js/main.js            navegación
  js/core/              api, dom, reglas, dados, audio
  js/views/             una sección por fichero
tests/                  pruebas del servidor
```

Para añadir una sección nueva, crea `static/js/views/mi-seccion.js` exportando
`{ id, title, icon, mount(root) }` y añádela a la lista `VIEWS` de `static/js/main.js`.

## Pruebas

```bash
python -m unittest discover tests
```

El bestiario usa contenido del SRD 5.1 (licencia CC-BY-4.0, Wizards of the Coast).
