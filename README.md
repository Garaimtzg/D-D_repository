# Mesa de D&D

Una mesa de rol para jugar a Dungeons & Dragons **en un solo ordenador**, todos juntos, con las reglas
del **Manual del Jugador de 2024** (edición en español): combates sobre un tablero con cuadrícula y
escenarios listos para usar, dados 3D que ruedan de verdad, iniciativa, fichas de personaje con creador
paso a paso, música, ambientes y efectos de sonido.

Servidor en Python (solo la librería estándar, no hay que instalar nada) e interfaz en HTML, CSS y JavaScript.
Todo se guarda en local, en la carpeta `data/`.

## Arrancar

1. Instala Python 3.10 o posterior desde [python.org](https://www.python.org/downloads/)
   (en Windows, marca **«Add python.exe to PATH»**).
2. **Windows:** doble clic en **`Mesa DnD.vbs`**: se abre el navegador y la mesa funciona por detrás, sin ventana.
   Para cerrarla, `Cerrar Mesa DnD.bat` (o apaga el ordenador; lo guardado no se pierde).
   Si prefieres ver la ventana con los mensajes, `Iniciar Mesa DnD.bat` (la mesa se cierra al cerrar la ventana).
   **macOS / Linux:** `sh iniciar.sh`.

Se abre el navegador en `http://localhost:8000` (si el puerto está ocupado, usa el siguiente libre). Si la mesa ya estaba
abierta, volver a arrancarla solo abre el navegador. Sin ventana, los mensajes quedan en `data/mesa.log`.
Para que arranque sola al encender el ordenador, copia `Mesa DnD.vbs` en la carpeta de Inicio de Windows
(Win + R y escribe `shell:startup`).

## Cómo se juega

- **Mesa** es la pantalla principal: el mapa (o el tablero de combate con cuadrícula) sobre un tapete,
  las fichas de los personajes encima, la iniciativa del combate en una cinta, el grupo con sus PG y la bandeja de dados.
- En **Combate** prepara el encuentro y elige un **escenario**: las fichas se colocan solas en sus zonas
  de inicio. Al empezar, la Mesa muestra ese tablero y se centra en quien tiene el turno.
- Pulsa **Modo jugadores** para ponerla a pantalla completa sin secretos: se ocultan los PG exactos
  de los enemigos, los enemigos ocultos, las trampas del tablero y las tiradas secretas. Sal con `Esc`.
- En la bandeja, elige **quién tira**: los dados toman el color de su ficha y aparecen sus ataques.
- `Mayús + clic` sobre el mapa hace una onda para señalar un punto a toda la mesa.
- **Prueba de grupo** (en el panel del grupo de la Mesa o en Personajes): todos tiran la misma habilidad o salvación contra una CD;
  si al menos la mitad la supera, el grupo tiene éxito. La **pantalla del máster** reúne CA, PG, pasivas, CD de conjuros y salvaciones.
- **Niebla de guerra** en el tablero (botón de la nube o tecla `N`): las fichas de los jugadores descubren lo que ven a 12 m
  (los muros tapan) y el máster revela u oculta zonas arrastrando. En el modo jugadores es opaca y esconde a los enemigos.
- En la ficha, la lista de **conjuros** (trucos y por niveles) permite **lanzarlos**: con el espacio que elijas (los dados suben
  solos al lanzarlo a más nivel), con un **uso gratis** (dotes, especie, subclase, castigo divino…), como **ritual** o con el arcanum
  místico del brujo; marca la concentración y tira ataque y daño. Al pasar el ratón sale la **descripción básica** y al pulsar el
  nombre, la carta completa. **+ Truco**, **+ Conjuro** y **+ Extra** (de otra fuente: invocación, libro de pactos, objeto o regalo
  del DM, con los usos gratis que quieras) abren un buscador con la descripción de cada conjuro.
- **Dados físicos**: si la mesa tira dados de verdad, pulsa el botón 🎲 de la barra de arriba (o el panel de Dados) para que la app
  pida lo que ha salido en vez de tirar: solo para los personajes jugadores (los enemigos los sigue tirando la app) o para todo.
  Sirve en cualquier tirada (ataques, daño, salvaciones, iniciativa, pruebas de grupo…): escribe cada dado, o la suma en los grupos
  grandes (8d6), y la app suma los modificadores, aplica la ventaja y avisa de los críticos. «Que tire la app» la tira por ti.
- **Avatares vivos**: la cara del muñeco cambia con su estado: tirita y luego ojo morado y gesto de dolor con pocos PG,
  ojos en X a 0 PG, corazones si está hechizado, espirales si está aturdido, verde si está envenenado, venda si está cegado,
  tumbado si está derribado, ojeras con cansancio… Y celebra un crítico, se lamenta de una pifia y hace una mueca al recibir daño.

### Atajos

| Tecla | Acción |
| --- | --- |
| `/` | Escribir una tirada (`2d6+3`, `4d6kh3`, `d%`…) |
| `1` … `9` | Ir a cada sección |
| `Mayús` / `Alt` + clic en el d20 | Tirar con ventaja / desventaja |
| `Intro` / `Mayús + Intro` en una casilla de PG | Daño / curación |
| Doble clic en el mapa | Ajustar el mapa a la pantalla |
| Clic derecho en una ficha del mapa | Quitarla |
| `M` / `R` / `A` sobre el tablero | Mover fichas / regla / áreas de efecto |
| `Esc` sobre el tablero | Quitar la regla, el área y la selección |
| `Ctrl + Z` / `Ctrl + Y` en el editor de escenarios | Deshacer / rehacer |

## Qué incluye

| Sección | Para qué sirve |
| --- | --- |
| **Mesa** | Mapa con zoom y fichas arrastrables, cinta de iniciativa con anuncio de turno, grupo, bandeja de dados, últimas tiradas, reloj del mundo, narración en pergamino y **clima** sobre el tablero (lluvia, tormenta con relámpagos, nieve, niebla, brasas) con su sonido. **Dibujo a mano alzada** sobre el mapa (colores, goma, borrar todo) y las **chinchetas** del mapa, visibles solo para el máster, para todos u ocultas. En un submapa, el botón **«Volver a…»** sobre el tablero lleva al mapa del que cuelga (por el camino de chinchetas por el que entraste o al mapa que tiene una chincheta hacia él), también en el modo jugadores. |
| **Combate** | Encuentros con fichas, bestiario o participantes rápidos; dificultad con el presupuesto de PX de 2024, iniciativa, turnos y rondas, daño y curación con números flotantes, estados con duración, concentración, salvaciones de muerte, daño en área, enemigos ocultos y crónica. Al ganar, reparto de PX. **Tablero con cuadrícula**: fichas por casillas (las criaturas grandes ocupan 2×2; las pequeñas, una casilla como las medianas; las **diminutas, un cuarto**: caben hasta cuatro en una casilla, y se puede atravesar a una criatura diminuta o a quien sea dos tamaños mayor o menor), alcance de movimiento con terreno difícil, metros movidos por turno, regla, áreas de efecto (esfera, cubo, cono, línea y emanación) que señalan a los afectados, **puertas** que se abren y cierran con un clic (bloquean el paso y la vista mientras están cerradas), y pantalla completa. |
| **Escenarios** | 12 tableros prediseñados (taberna, bosque, cripta, cueva, puente, campamento, plaza, barco, templo, ciénaga, guarida del dragón y campo abierto), un editor para personalizarlos o crear los tuyos y «usar en un combate»: **44 terrenos** (losas, mármol ajedrezado, mosaico, tarima, rejilla, tablones rotos, hierba, flores, musgo, hojarasca, grava, ceniza, campo arado, nieve profunda, juncos, raíces, agua, lava, ácido, ciénaga tóxica, arenas movedizas y muros de piedra, ladrillo, madera, empalizada, seto, hielo o roca) y **122 objetos** en 11 grupos plegables (naturaleza, mobiliario, taberna y cocina, biblioteca y magia, piedra y templo, mazmorra, fuego y luz, exteriores y aldea, mar y río, guerra, secretos y trampas), cada uno con su efecto en el movimiento, su cobertura y su luz (los mágicos, con su color). Las alfombras, la sangre, las runas o las trampillas van en el suelo, debajo de los muebles. También luz, zonas de inicio e imagen de fondo. **Dibujo de calidad de mapa impreso**: el agua, la hierba, la tierra, el barro, la nieve o la lava siguen **contornos curvos y orgánicos** (vectoriales: nítidos también en la imagen de 300 ppp) aunque las reglas sigan siendo por casillas, con **orillas** de espuma, bordes incandescentes en la lava y cuevas de paredes curvas que se oscurecen hacia dentro; manchas de color a gran escala (adiós a la repetición casilla a casilla), tarimas de tablones largos con juntas al tresbolillo, sombra junto a los muros y contorno de tinta, y árboles y arbustos con volumen. **Luces con sombras de verdad**: antorchas, braseros, hogueras o farolas alumbran hasta donde llega su vista y los muros, las puertas cerradas, las columnas o los mástiles proyectan sombra (en combate, al abrir una puerta la luz entra en la sala). **Herramientas de diseño**: **Sala** (arrastra un rectángulo: muro alrededor y suelo dentro; las salas con el mismo suelo se unen), **Trazo** (ríos, caminos o pasillos de 1 a 5 casillas de ancho) y **Dispersar** (bosque, matorral, rocas, cueva, ruinas, cementerio, desierto, ciénaga o agua por una zona, con densidad). **41 adornos** en 6 grupos (grietas, guijarros, charcos, telarañas, paja, monedas, sangre, matas, hojas, setas, juncos, nenúfares, escarcha, costras de lava, runas, glifos y cristales que dan luz…) que **salen solos según el terreno** (ninguno, sutiles, normales o muchos, con «Otra variación»; se adaptan al repintar) o se siembran con el **pincel de adornos** (uno o un puñado, con tamaño y giro al azar), libres, sin casilla fija y sin efecto en el movimiento. **Elegir y mover** objetos y adornos (R gira, Supr borra, Ctrl + D duplica), **objetos girados** 90°, 180° o 270° con vista previa antes de soltarlos, buscador de objetos y adornos, **ambiente** de color (cálido, frío, sombrío, misterio, enfermizo, infernal, sepia), viñeta y **estilo de cuadrícula** (líneas, puntos, cruces o sin cuadrícula). **Descargar como imagen** de alta resolución (PNG de 96, 150 o 300 píxeles por casilla; a 300 ppp cada casilla mide 2,54 cm para imprimir y jugar con miniaturas), para los jugadores o con lo oculto del máster, con las letras y números de las casillas en el borde. **Escenario al azar** en tres tamaños: mazmorra (salas unidas por pasillos, puertas, trampas, tesoro, guardianes y jefe, con la clave de cada sala), cueva y **8 exteriores** (bosque profundo, vado del río, ciénaga, dunas y oasis, paso nevado, playa y acantilado, ruinas en el bosque y campo de lava) con su clave para el máster (qué hay, qué es terreno difícil o peligroso y qué acecha). Siempre hay un camino a pie del grupo a cada enemigo y la misma semilla da el mismo mapa. |
| **Personajes** | Jugadores, personajes de la historia y enemigos como cartas. **Creador paso a paso** del Manual 2024: clase (con Orden divina u Orden primigenia, también el **artificiero**), trasfondo, especie (tamaño y linaje; 54 especies entre las del manual, las del «Manual para casi todo» y las de Euskal Herria, más las **propias**; los 16 trasfondos del manual más los **propios**), idiomas, características, estilo de combate, mejoras de característica o dotes de los niveles 4, 8…, subclase y **equipo inicial** (opción A con sus objetos o el oro). Las armas pasan a la lista de ataques y la armadura a la CA. **Subida de nivel guiada**. La ficha imita una hoja en pergamino: características, salvaciones, habilidades, CA automática (armadura, escudo, Defensa sin armadura de clase o subclase, armadura natural; sigue a la DES con el límite de cada armadura), PG (dado de golpe + CON; al cambiar la CON cambian los PG de todos los niveles), dados de golpe, cansancio, inspiración heroica, ataques con armas del manual y sus maestrías, aliento dracónico y golpe sin armas del monje calculados solos, conjuros con espacios por clase (también los lanzadores de un tercio: Caballero arcano y Embaucador arcano), los **siempre preparados** de la clase, la subclase (dominios, juramentos, patrones, círculos; la tierra según el terreno), la especie y las dotes (Iniciado en la magia, Influencia feérica y sombría, Lanzador ritual… con lo que dejan elegir), que no cuentan para el máximo, recursos por nivel de la clase, la subclase y las dotes (dados de supremacía, Pasos feéricos, puntos de suerte…), la velocidad y los PG que suman las dotes, inventario con monedas (pc, pp, pe, po, ppt), **capacidad de carga** (FUE × 7,5 kg según el tamaño, el doble para arrastrar, levantar o empujar, y un tamaño más con Constitución poderosa y parecidos) con el peso que lleva y lo que supone, y **objetos mágicos** del SRD con su sintonía (máximo 3) y sus **cargas**, que se recuperan al amanecer como dice cada objeto (1d6+1 una varita…), **todos los rasgos de clase y de subclase con lo que hacen**, **aspecto y personalidad** (edad, género —masculino, femenino, no binario u otro—, altura, peso, descripción física y personalidad, también en el creador), una **descripción de cada especie** con su altura típica y su esperanza de vida (en la ficha, el creador y Reglas) y un aviso de **lo que falta por elegir** (maestrías, pericia, trucos, conjuros preparados, estilo de combate…). Todo se tira con un clic. **Aspecto** (pulsa el retrato): cara dibujada con piel, ojos, 11 peinados, 11 expresiones, orejas (elfo, gato…), marcas (pecas, cicatriz, pintura de guerra…), cuernos, barba y bigote, ropa con su color, sombreros con su color (también txapela), gafas, objetos en la mano, cualquier emoji y fondo; todos los colores con selector libre. O una imagen propia. |
| **Mapas** | Galería de imágenes para poner sobre la mesa, con notas privadas y **chinchetas** que enlazan con el compendio, con fichas o con otro mapa (de la región entras en la ciudad, y con «Volver a…» sales). |
| **Dados** | Bandeja con dados 3D, constructor de tiradas, favoritos, generador de características, historial, «la suerte del d20» y **dados físicos** (apuntar lo que sale en la mesa). |
| **Notas** | Diario de campaña con aspecto de libro (con la fecha del mundo), **preparación de sesiones** con los ocho pasos del «máster perezoso» de Sly Flourish (los secretos que no salen pasan solos a la sesión siguiente; el comienzo y el «Anteriormente…» se leen en la mesa) y tablón de misiones con notas que se arrastran entre columnas. |
| **Mundo** | **Compendio** de lugares, facciones, objetos, deidades e historia: escribe @ para enlazar entradas, fichas, mapas o misiones; cada entrada muestra quién la menciona, en qué mapas está, lo que contiene y unos secretos solo para el máster, y se puede **mostrar en la mesa** con su imagen. **Calendario** del mundo (Euskal Herria, gregoriano, fantasía o el tuyo) con lunas, estaciones, festivos y sucesos, unido al reloj del mundo, y **cronología**. **Relaciones** entre fichas y entradas (familia, pareja, aliados, enemigos, rivales, a quién sirven, a qué pertenecen; también secretas) vistas como una **red** y como **árbol familiar**. **Bastiones** de las reglas de 2024: instalaciones especiales según el nivel, órdenes, defensores, oro y un turno de bastión cada 7 días con la tabla de sucesos (resumen orientativo: los detalles, en la Guía del DM 2024). |
| **Herramientas** | Copia de la campaña (.zip), generadores (PNJ, tabernas, botín, ganchos, clima…), calculadora de encuentros, reloj (con la **noche de Gaueko**), temporizadores, narración, tablas aleatorias propias, monedas, botín, viajes y dados para el móvil. |
| **Música** | Tus canciones por escenas (taberna, combate, jefe…), disco que gira y visualizador; ambientes sintetizados sin ficheros: lluvia, viento, hoguera, cueva y taberna; y un panel de **efectos** de un clic (espadas, trueno, explosión, fanfarria…). |
| **Minijuegos** | Para tabernas y descansos, con el muñeco de cada jugador: el cerdo (dados 3D), carrera de bichos con apuestas, ganzúa, pulso a dos teclas, **herri kirolak** y acertijos. |
| **Reglas** | Manual del Jugador 2024 con buscador: estados, acciones, cuadrícula y áreas, clases y subclases (pasa el ratón por un rasgo para ver qué hace), especies, trasfondos, dotes, **los 390 conjuros** (nivel, tiempo, alcance, duración, concentración, ritual, salvación y daño, filtrables por clase y nivel, con su descripción básica al pasar el ratón o pulsar el nombre), armas con maestrías, armaduras, monedas y tablas de PX. **258 objetos mágicos** del SRD 5.2.1 en castellano, filtrables por tipo, rareza y sintonía, con uno al azar para el botín. Resúmenes propios con la página del manual. |

### Del «Manual para casi todo» (adaptado a 2024)

Lo que el Manual del Jugador 2024 no trae, sacado del «Manual para casi todo de D&D 5e» (V21.12.22) y adaptado a 2024. Donde los dos coinciden manda 2024: el aasimar, el goliat, el orco, el tiefling, el elfo o el bárbaro berserker son los de 2024.

- **40 especies más**: las 27 de *Monstruos del Multiverso* (aarakocra, osgo, centauro, cambiaformas, cambiante, duergar, eladrín, elfo de mar, **firbolg**, genasi, githyanki, githzerai, gnomo de las profundidades, goblin, **hada**, harengon, hobgoblin, kenku, kobold, hombre lagarto, minotauro, sátiro, shadar-kai, tabaxi, tortuga, tritón y yuan-ti) y 13 de otros libros (búhonido, grung, locathah, verdan, semielfo, semiorco, leónido, loxodon, híbrido simic, vedalken, dhampiro, sangre maldita y renacido). Como en 2024, no suben características (lo hace el trasfondo), van en metros y su magia se lanza gratis una vez por descanso largo; la ficha calcula sus recursos, conjuros, ataques naturales y armadura natural.
- **El artificiero** con sus cuatro especialistas (alquimista, artillero, blindado y herrero de batalla), con la tabla de conjuros preparados de 2024 y Don épico en el nivel 19.
- **67 subclases más** de Xanathar, Tasha, la Guía de la Costa de la Espada, Ravenloft, Fizban y otros libros, movidas a los niveles de subclase de 2024 (lo que se ganaba en los niveles 1 y 2 llega en el 3; los conjuros de dominio, círculo y patrón quedan siempre preparados; el ki pasa a ser puntos de concentración). Cada una indica su libro y la página del manual.

### Especies, clases y trasfondos propios

En el creador de personajes, **Nueva especie**, **Nueva clase** y **Nuevo trasfondo** abren un editor. El trasfondo, como los de 2024: tres características, una dote de origen, dos habilidades, una herramienta y su equipo (o 50 po). Especies y clases: rasgos, tamaño, velocidad, visión, habilidades, magia y recursos de la especie; dado de golpe, salvaciones, competencias, tipo de lanzador y lista de conjuros, rasgos por nivel, recursos y subclases de la clase. Las mejoras de característica, el Don épico y los espacios de conjuro se ponen solos. Se usan igual que las del manual (ficha, subida de nivel, Reglas) y se editan o borran desde su tarjeta.

### Mitología de Euskal Herria

Material propio de esta app, inspirado en las leyendas que recogió José Miguel de Barandiaran:

- **Bestiario**: 18 criaturas para usar como enemigos, de VD 1/4 a 18: iratxo, txakur beltza, lamiña,
  akerbeltz, enjambre de galtzagorris, gizotso, sorgina, inguma, jentil, aatxe, basajaun, Tartalo,
  Ehiztari beltza (el Cazador Negro), Gaueko, Odei, Mikelats, Sugaar y el herensuge de siete cabezas.
  Cada una trae su leyenda, rasgos, acciones listas para tirar y detalles para la partida (el anillo
  parlante de Tartalo, la fórmula contra Inguma, las campanas que espantan a Odei…). Sus cifras siguen
  la tabla de VD de la Guía del Dungeon Master y las pruebas comprueban que cada VD cuadra.
  En el bestiario busca «vasca»; en Combate tienen su propio grupo.
- **Especies jugables**: jentil, lamiña, basajaun e iratxo, con el mismo «presupuesto» que las especies
  del manual (un rasgo fuerte, otros menores y magia en los niveles 3 y 5).
- **La noche es de Gaueko** («Gaua gauekoentzat, eguna egunekoentzat»): cuando el reloj del mundo pasa a la noche, aparece el aviso,
  y desde el reloj de la Mesa (🌑) o de Herramientas se tira la noche. Cuentan la luna (llena o nueva), la hora, la tormenta de la mesa,
  dónde están (bosque, monte, río, cueva, caserío, camino), si viajan, acampan o duermen bajo techo, un eguzkilore en la puerta
  y si alguien ha desafiado a la noche. Puede pasar tranquila, dejar un presagio, traer un encuentro (lamias, perros negros,
  Inguma en las casas, un akelarre, Tartalo, el Cazador Negro…) o al propio Gaueko. Las noches de San Juan las lamias salen a peinarse
  y las hogueras protegen el pueblo; la de Olentzero puede traer regalos. Cada encuentro trae su salida según la tradición, se ajusta
  al nivel del grupo y se convierte en combate (con su tablero) en un clic.
- **Herri kirolak** (en Minijuegos): aizkolari (cortar el tronco alternando golpes y dándose la vuelta a mitad), harri-jasotzaile
  (subir la piedra al hombro en tres tiempos durante 30 segundos) y sokatira (Gorriak contra Urdinak, cada uno con su tecla y
  al ritmo del bombo). La Fuerza y la Constitución de la ficha ayudan; quien más puntos sume se lleva la **txapela**, también en su ficha.

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
Mesa DnD.vbs               arranque sin ventana en Windows (Cerrar Mesa DnD.bat la cierra)
Iniciar Mesa DnD.bat       arranque con la ventana de mensajes en Windows (iniciar.sh en macOS / Linux)
server/                    servidor HTTP, API JSON, almacén, copias .zip, dados, reglas, generadores, bestiario
  phb2024.py               datos del Manual del Jugador 2024 (clases, especies, trasfondos, dotes, equipo inicial…)
  features2024.py          qué hace cada rasgo de clase y de subclase (resúmenes propios)
  euskal.py                criaturas y especies de la mitología de Euskal Herria
  mct.py, mct_classes.py   especies, artificiero y subclases del «Manual para casi todo» adaptados a 2024
  homebrew.py              convierte las especies, clases y trasfondos propios al formato del manual
  lore.py                  descripción breve de cada especie (con palabras propias), altura y esperanza de vida
  spellcasting.py          conjuros siempre preparados, usos gratis, recursos de subclase, lanzadores de un tercio,
                           lo que dan las dotes y las cargas de los objetos mágicos
  scenes.py                terrenos, objetos y escenarios prediseñados del tablero
  dungeon.py               mazmorras y cuevas al azar con su clave
  gaueko.py                la noche de Gaueko: modificadores, presagios y encuentros nocturnos
  magicitems2024.json      objetos mágicos del SRD 5.2.1 en castellano (generado)
static/
  index.html               la aplicación
  dados-movil.html         página de dados para el móvil (generada, no editar)
  css/                     base, componentes, barra, mesa, personajes, combate y demás secciones
  js/main.js               navegación, barras y atajos
  js/lib/dice3d.js         motor de dados 3D (también va dentro de dados-movil.html)
  js/lib/dicenotation.js   intérprete de tiradas para el móvil
  js/core/                 api, dom, reglas, dados, combate, sonido, música, ambientes, clima, atmósfera
  js/core/battlemap.js     tablero con cuadrícula: dibujo, fichas, regla, áreas, movimiento y edición
  js/core/board.js         une un combate con su tablero (posiciones, colocación automática)
  js/core/calendar.js      calendario del mundo: fechas, semanas, estaciones, lunas y festivos
  js/core/mentions.js      enlaces @[Nombre] entre notas, compendio, fichas y mapas
  js/views/                una sección por fichero (spellui.js: descripción, carta y buscador de conjuros)
movil/                     fuentes de la página del móvil
tools/build_movil.py       genera static/dados-movil.html
tools/extract_spells.py    saca los datos de los conjuros del PDF del Manual (server/spells2024.json)
tools/build_bestiary.py    traduce el bestiario del SRD 5.2.1 (server/monsters2024.json)
tools/build_magic_items.py traduce los objetos mágicos del SRD 5.2.1 (server/magicitems2024.json)
tests/                     pruebas
```

Para añadir una sección, crea `static/js/views/mi-seccion.js` exportando `{ id, title, icon, hint, mount(root) }`
y añádela a `static/js/main.js`. Si cambias el motor de dados o `movil/`, regenera la página del móvil:

```bash
python tools/build_movil.py
python -m unittest discover tests
```

## Licencias

Este trabajo incluye material del System Reference Document 5.2.1 («SRD 5.2.1») de Wizards of the Coast LLC,
disponible en https://www.dndbeyond.com/srd. El SRD 5.2.1 tiene licencia Creative Commons Reconocimiento 4.0
Internacional, disponible en https://creativecommons.org/licenses/by/4.0/legalcode. El bestiario (323 monstruos y
animales) está traducido al castellano y resumido a partir de ese documento con `tools/build_bestiary.py`, y los
258 objetos mágicos, con `tools/build_magic_items.py`.

El material del «Manual para casi todo» (recopilación de libros oficiales de la 5.ª edición) también se resume con palabras propias y remite a su página (MCT p. X).
Las reglas, clases y conjuros del Manual del Jugador 2024 se resumen con palabras propias y remiten a la página del manual;
los bastiones, con palabras propias a partir de la Guía del Dungeon Master 2024.
Las criaturas y especies de Euskal Herria son creación de esta app a partir de la mitología vasca tradicional.
