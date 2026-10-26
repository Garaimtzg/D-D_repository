"""Clase y subclases del «Manual para casi todo de D&D 5e» (V21.12.22) que el Manual del Jugador 2024 no tiene.

- El artificiero (Tasha) con sus cuatro especialistas, ajustado a las tablas de 2024: conjuros preparados como el
  paladín y el explorador, Don épico en el nivel 19.
- Las subclases de Xanathar, Tasha y otros libros, movidas a los niveles de subclase de 2024: lo que antes se ganaba
  en los niveles 1 o 2 llega en el 3; los conjuros de dominio, círculo y patrón quedan siempre preparados como en 2024;
  el Golpe divino o Lanzamiento potente del clérigo (nivel 8) no se suma porque ya lo da Golpes benditos (nivel 7).
  El ki pasa a ser puntos de concentración. Las subclases que repite 2024 (berserker, vida, ladrón…) no se tocan.
Resúmenes propios con la página del manual (MCT).
"""

ASI = "Mejora de característica"
SUB = "Rasgo de subclase"
PREP_HALF = [2, 3, 4, 5, 6, 6, 7, 7, 9, 9, 10, 10, 11, 11, 12, 12, 14, 14, 15, 15]


def _col(*pairs):
    """Columna de 20 niveles a partir de (nivel, valor)."""
    out, cur, it = [], None, iter(sorted(pairs))
    nxt = next(it, None)
    for lvl in range(1, 21):
        while nxt and nxt[0] <= lvl:
            cur, nxt = nxt[1], next(it, None)
        out.append(cur)
    return out


ARTIFICER = {
    "id": "artificiero", "gold": 150, "name": "Artificiero", "page": None, "origin": "Tasha · MCT p. 97", "hit_die": 8, "primary": ["int"],
    "complexity": "Alta", "summary": "Inventor que canaliza la magia a través de herramientas e infunde objetos con poderes mágicos.",
    "saves": ["con", "int"], "skills": {"choose": 2, "from": ["arcanos", "historia", "investigacion", "juego_manos", "medicina", "naturaleza", "percepcion"]},
    "weapons": "Armas sencillas", "armor": "Armaduras ligeras y medias, escudos",
    "tools": "Herramientas de ladrón, herramientas de hojalatero y unas herramientas de artesano",
    "armor_training": ["ligera", "media", "escudo"], "weapon_training": ["sencilla"],
    "caster": "half", "spell_ability": "int",
    "standard": {"fue": 10, "des": 13, "con": 14, "int": 15, "sab": 12, "car": 8},
    "cantrips": _col((1, 2), (10, 3), (14, 4)), "prepared": PREP_HALF,
    "columns": {"Infusiones conocidas": _col((2, 4), (6, 6), (10, 8), (14, 10), (18, 12)),
                "Objetos infundidos": _col((2, 2), (6, 3), (10, 4), (14, 5), (18, 6))},
    "resources": [{"name": "Destello de genio", "uses": "mod:int", "reset": "largo", "from": 7}],
    "subclasses": ["Alquimista", "Artillero", "Blindado", "Herrero de batalla"],
    "features": {1: ["Arreglo mágico", "Lanzamiento de conjuros"], 2: ["Infusión de objetos"], 3: ["La herramienta adecuada", "Subclase de artificiero"],
                 4: [ASI], 5: [SUB], 6: ["Pericia con herramientas"], 7: ["Destello de genio"], 8: [ASI], 9: [SUB], 10: ["Experto en objetos mágicos"],
                 11: ["Objeto almacén de conjuros"], 12: [ASI], 14: ["Erudito en objetos mágicos"], 15: [SUB], 16: [ASI],
                 18: ["Maestro en objetos mágicos"], 19: ["Don épico"], 20: ["Alma del artificio"]},
}
ARTIFICER_FEATURES = {
    "Arreglo mágico": "Con herramientas de ladrón o de artesano, como acción das a un objeto diminuto no mágico una propiedad: luz (1,5 m), un mensaje grabado de 6 s, un olor o sonido continuo o una imagen o texto. A la vez, tantos objetos como tu modificador por INT.",
    "Lanzamiento de conjuros": "Conjuros de artificiero con INT; tu canalizador son tus herramientas (o un objeto infundido). Espacios de semilanzador desde el nivel 1, trucos y conjuros preparados según la tabla (adaptada a 2024).",
    "Infusión de objetos": "Aprendes infusiones (columna de la tabla: arma mejorada, defensa mejorada, foco mejorado, réplica de un objeto mágico, sirviente homúnculo…). Al terminar un descanso largo infundes objetos no mágicos hasta el máximo de la tabla; duran hasta que los cambias.",
    "La herramienta adecuada": "Con 1 hora de trabajo (puede ser un descanso) creas unas herramientas de artesano no mágicas que desaparecen si repites el rasgo.",
    "Pericia con herramientas": "Doble bonificador por competencia en las pruebas con herramientas en las que eres competente.",
    "Destello de genio": "Reacción: tú o alguien a 9 m sumáis tu modificador por INT a una prueba de característica o salvación. Usos: tu modificador por INT por descanso largo.",
    "Experto en objetos mágicos": "Te sintonizas con hasta 4 objetos; fabricar objetos comunes o poco comunes te cuesta la mitad de oro y una cuarta parte del tiempo.",
    "Objeto almacén de conjuros": "Tras un descanso largo guardas en un arma o canalizador un conjuro de artificiero de nivel 1 o 2 de 1 acción; quien lo sostenga lo lanza con tu aptitud, hasta el doble de tu modificador por INT de veces (mínimo 2).",
    "Erudito en objetos mágicos": "Te sintonizas con hasta 5 objetos e ignoras los requisitos de clase, especie, conjuro y nivel para usarlos.",
    "Maestro en objetos mágicos": "Te sintonizas con hasta 6 objetos mágicos.",
    "Alma del artificio": "+1 a todas las salvaciones por cada objeto sintonizado y, si caes a 0 PG sin morir, como reacción terminas una infusión para quedarte a 1 PG.",
}
ARTIFICER_KIT = [([(1, "Armadura de cuero tachonado"), (1, "Martillo ligero"), (1, "Daga"), (1, "Ballesta ligera"), (20, "Virotes"),
                   (1, "Herramientas de ladrón"), (1, "Paquete de explorador de mazmorras")], 10)]
# Lista de conjuros del artificiero (Tasha), con los nombres del Manual del Jugador 2024; faltan los que no tiene
ARTIFICER_SPELLS = [
    "Salpicadura ácida", "Luces danzantes", "Descarga de fuego", "Guía", "Luz", "Mano de mago", "Reparar", "Mensaje", "Rociada venenosa",
    "Prestidigitación", "Rayo de escarcha", "Resistencia", "Agarre electrizante", "Piedad con los moribundos", "Látigo de espinas", "Elementalismo",
    "Alarma", "Curar heridas", "Detectar magia", "Disfrazarse", "Retirada expeditiva", "Fuego feérico", "Falsa vida", "Caída de pluma", "Grasa",
    "Identificar", "Salto", "Zancada prodigiosa", "Purificar comida y bebida", "Santuario", "Caldero burbujeante de Tasha",
    "Auxilio", "Alterar el propio aspecto", "Cerradura arcana", "Contorno borroso", "Llama permanente", "Visión en la oscuridad",
    "Potenciar característica", "Agrandar/reducir", "Calentar metal", "Invisibilidad", "Restablecimiento menor", "Levitar", "Boca mágica",
    "Arma mágica", "Protección contra veneno", "Truco de la cuerda", "Ver invisibilidad", "Trepar cual arácnido", "Telaraña",
    "Crear comida y agua", "Disipar magia", "Arma elemental", "Volar", "Glifo custodio", "Acelerar", "Protección contra energía", "Revivir",
    "Respirar bajo el agua", "Caminar sobre el agua", "Ojo arcano", "Fabricar", "Libertad de movimiento", "Cofre oculto de Leomund",
    "Mastín fiel de Mordenkainen", "Sanctasanctórum privado de Mordenkainen", "Esfera elástica de Otiluke", "Moldear la piedra", "Piel pétrea",
    "Invocar autómata", "Animar objetos", "Mano de Bigby", "Creación", "Restablecimiento mayor", "Muro de piedra",
]


def _spells(*rows):
    return "; ".join(f"nivel {lvl}: {s}" for lvl, s in rows) + " (siempre preparados; no cuentan para tu máximo)."


# clase -> subclase -> [(nivel, rasgo, qué hace)]; SOURCE dice de qué libro viene y la página del MCT
SUBCLASSES = {
    "artificiero": {
        "Alquimista": [
            (3, "Conjuros de alquimista", _spells((3, "curar heridas, rayo nauseabundo"), (5, "esfera flamígera, flecha ácida de Melf"),
                                                  (9, "forma gaseosa, curar heridas en masa"), (13, "marchitar, guarda contra la muerte"), (17, "nube aniquiladora, revivir a los muertos"))),
            (3, "Herramientas del oficio", "Competencia con los útiles de alquimista (u otras herramientas de artesano si ya la tenías)."),
            (3, "Elixir experimental", "Tras un descanso largo creas un elixir al azar (curar 2d4 + INT, +3 m de velocidad, +1 a la CA, +1d4 a ataques y salvaciones, vuelo 3 m o cambiar de aspecto). Uno más gastando un espacio (eliges el efecto); dos tras el descanso a nivel 6 y tres a nivel 15."),
            (5, "Erudición alquímica", "Con los útiles de alquimista como canalizador, sumas tu modificador por INT a una tirada de curación o de daño de ácido, fuego, necrótico o veneno."),
            (9, "Reactivos restauradores", "Tus elixires dan 2d6 + INT PG temporales y lanzas restablecimiento menor sin espacio tantas veces como tu modificador por INT por descanso largo."),
            (15, "Maestría química", "Resistencia al ácido y al veneno, inmune a envenenado; restablecimiento mayor y sanar sin espacio, 1 vez cada uno por descanso largo.")],
        "Artillero": [
            (3, "Conjuros de artillero", _spells((3, "escudo, ola atronadora"), (5, "rayo debilitante, romper"), (9, "bola de fuego, muro de viento"),
                                                 (13, "tormenta de hielo, muro de fuego"), (17, "cono de frío, muro de fuerza"))),
            (3, "Herramientas del oficio", "Competencia con herramientas de carpintero."),
            (3, "Cañón arcano", "Como acción creas un cañón pequeño o diminuto (CA 18, PG = 5 × nivel) 1 vez por descanso largo (o gastando un espacio). Acción adicional para activarlo a 18 m: lanzallamas (cono de 4,5 m, 2d8 fuego, salvación DES), balista de fuerza (ataque de conjuro a 36 m, 2d8 fuerza y empuja 1,5 m) o protector (1d8 + INT PG temporales a 3 m)."),
            (5, "Arma de fuego arcana", "Tallas sigilos en una varita, bastón o vara: lanzando con ella sumas 1d8 al daño de un conjuro de artificiero."),
            (9, "Cañón explosivo", "El daño del cañón sube 1d8 y puedes detonarlo como acción: 3d8 de fuerza a 6 m (salvación DES)."),
            (15, "Posición fortificada", "Tú y tus aliados tenéis cobertura media a 3 m del cañón y puedes tener dos cañones a la vez.")],
        "Blindado": [
            (3, "Conjuros de blindado", _spells((3, "proyectil mágico, ola atronadora"), (5, "imagen múltiple, romper"), (9, "patrón hipnótico, relámpago"),
                                                (13, "escudo de fuego, invisibilidad mejorada"), (17, "pasamuros, muro de fuerza"))),
            (3, "Herramientas del oficio", "Competencia con armaduras pesadas y herramientas de herrero."),
            (3, "Armadura arcana", "Como acción conviertes tu armadura en armadura arcana: sin requisito de FUE, te sirve de canalizador, no te la pueden quitar y te la pones o quitas como acción."),
            (3, "Modelo de armadura", "Guardián: guanteletes de 1d8 trueno (el golpeado tiene desventaja contra otros) y PG temporales iguales a tu nivel como acción adicional (usos: competencia por descanso largo). Infiltrado: descarga de 1d6 relámpago a 27/90 m (+1d6 una vez por turno), +1,5 m de velocidad y ventaja en Sigilo. Atacas con INT."),
            (5, "Ataque adicional", "Haces dos ataques con la acción de Ataque."),
            (9, "Modificaciones de armadura", "Peto, botas, casco y arma especial cuentan como objetos distintos para infundir; puedes infundir 2 objetos más si forman parte de la armadura."),
            (15, "Armadura perfeccionada", "Guardián: reacción para atraer 9 m a una criatura Enorme o menor (salvación FUE) y atacarla si llega a tu lado. Infiltrado: tus descargas hacen brillar al objetivo: desventaja contra ti, el siguiente ataque contra él tiene ventaja y +1d6.")],
        "Herrero de batalla": [
            (3, "Conjuros de herrero de batalla", _spells((3, "heroísmo, escudo"), (5, "castigo marcador, vínculo protector"), (9, "aura de vitalidad, conjurar andanada"),
                                                          (13, "aura de pureza, escudo de fuego"), (17, "castigo desterrador, curar heridas en masa"))),
            (3, "Herramientas del oficio", "Competencia con herramientas de herrero."),
            (3, "Listo para la batalla", "Competencia con armas marciales y, con armas mágicas, atacas y haces daño con INT."),
            (3, "Defensor de acero", "Creas un compañero constructo (CA 15, PG 2 + INT + 5 × nivel, 12 m) que actúa tras tu turno; con tu acción adicional ataca (1d8 + competencia de fuerza) o repara. Reacción: impone desventaja a un ataque contra otro a 1,5 m."),
            (5, "Ataque adicional", "Haces dos ataques con la acción de Ataque."),
            (9, "Choque arcano", "Al acertar con un arma mágica o tu defensor, 2d6 de fuerza extra o curas 2d6 a alguien a 9 m. Usos: tu modificador por INT por descanso largo."),
            (15, "Defensor mejorado", "El choque arcano pasa a 4d6, tu defensor gana +2 a la CA y su reacción hace 1d4 + INT de fuerza al atacante.")],
    },
    "barbaro": {
        "Senda del camorrista": [
            (3, "Armadura de camorrista", "En furia, con armadura de pinchos atacas con ella como acción adicional (1d4 perforante) y agarrar a alguien le hace 3 perforante."),
            (6, "Desenfreno temerario", "Al usar Ataque temerario en furia ganas PG temporales iguales a tu modificador por CON."),
            (10, "Carga de camorrista", "En furia puedes Correr como acción adicional."),
            (14, "Represalia punzante", "En furia y con la armadura de pinchos, quien te golpee cuerpo a cuerpo a 1,5 m recibe 3 perforante.")],
        "Senda del guardián ancestral": [
            (3, "Protectores ancestrales", "En furia, la primera criatura que golpeas cada turno tiene desventaja en ataques contra otros, y sus objetivos tienen resistencia a su daño."),
            (6, "Escudo espiritual", "En furia, reacción para reducir 2d6 el daño a una criatura que veas a 9 m (3d6 a nivel 10 y 4d6 a nivel 14)."),
            (10, "Consultar a los espíritus", "Lanzas augurio o clariviencia sin espacio (SAB), 1 vez por descanso corto o largo."),
            (14, "Ancestros vengativos", "Cuando el Escudo espiritual reduce un ataque, el atacante recibe ese mismo daño de fuerza.")],
        "Senda del heraldo de la tormenta": [
            (3, "Aura de tormenta", "En furia emanas un aura de 3 m (desierto: 2 de fuego a todos; mar: 1d6 relámpago a uno, salvación DES; tundra: PG temporales a los aliados). Se activa al enfurecerte y con una acción adicional."),
            (6, "Alma de la tormenta", "Desierto: resistencia al fuego e ignoras el calor; mar: resistencia al relámpago, respiras bajo el agua y nadas 9 m; tundra: resistencia al frío e ignoras el frío."),
            (10, "Tormenta protectora", "Las criaturas que elijas dentro de tu aura comparten tu resistencia."),
            (14, "Tormenta desatada", "Desierto: reacción para hacer fuego al que te golpee; mar: derribar al que golpeas; tundra: dejar con velocidad 0 a una criatura del aura.")],
        "Senda de la bestia": [
            (3, "Forma de la bestia", "Al enfurecerte eliges un arma natural: mordisco (1d8, te curas tu competencia una vez por turno si tienes menos de la mitad de PG), garras (1d6, un ataque extra con ellas) o cola (1d8, alcance 3 m y reacción para sumar 1d8 a tu CA)."),
            (6, "Alma bestial", "Tus armas naturales son mágicas y tras cada descanso eliges nadar y respirar bajo el agua, trepar por paredes y techos o saltar más lejos."),
            (10, "Furia infecciosa", "Al golpear con tus armas naturales en furia, salvación de SAB o el objetivo ataca a quien elijas o recibe 2d12 psíquico. Usos: competencia por descanso largo."),
            (14, "Llamada de la cacería", "Al enfurecerte, hasta tu modificador por CON en aliados ganan +1d6 de daño una vez por turno y tú 5 PG temporales por cada uno.")],
        "Senda de la magia salvaje": [
            (3, "Conciencia mágica", "Acción: sabes dónde hay conjuros y objetos mágicos a 18 m y su escuela. Usos: competencia por descanso largo."),
            (3, "Oleada salvaje", "Al enfurecerte tiras en la tabla de magia salvaje (d8): zarcillos necróticos, teletransporte, espíritu explosivo, arma de fuerza, luz que ciega, flores curativas, etc. CD 8 + competencia + CON."),
            (6, "Magia reforzada", "Acción: das a alguien +1d3 a ataques y pruebas 10 minutos o le devuelves un espacio de nivel 1d3. Usos: competencia por descanso largo."),
            (10, "Reacción inestable", "Reacción al recibir daño o fallar una salvación en furia: vuelves a tirar en la tabla de magia salvaje."),
            (14, "Oleada controlada", "Tiras dos veces en la tabla y eliges; con dos iguales, eliges cualquier efecto.")],
    },
    "bardo": {
        "Colegio de las espadas": [
            (3, "Competencias adicionales", "Armaduras medias y cimitarra; un arma cuerpo a cuerpo con la que seas competente te sirve de canalizador."),
            (3, "Estilo de combate", "Ganas la dote de estilo de combate Duelo o Combate con dos armas."),
            (3, "Floritura de la espada", "Con la acción de Ataque ganas 3 m de velocidad y, al acertar, gastas Inspiración bárdica para sumar el dado al daño y además a tu CA (defensiva), dañar a otro a 1,5 m (cortante) o empujar 1,5 m + dado (móvil)."),
            (6, "Ataque adicional", "Haces dos ataques con la acción de Ataque."),
            (14, "Floritura maestra", "Puedes usar una floritura tirando 1d6 en vez de gastar Inspiración bárdica.")],
        "Colegio de los susurros": [
            (3, "Cuchillas psíquicas", "Al acertar con un arma gastas Inspiración bárdica: +2d6 psíquico (3d6 a nivel 5, 5d6 a nivel 10, 8d6 a nivel 15), 1 vez por turno."),
            (3, "Palabras de terror", "Tras 1 minuto hablando a solas con un humanoide, salvación de SAB o queda asustado de ti u otro 1 hora (1 vez por descanso corto o largo)."),
            (6, "Manto de susurros", "Reacción al morir un humanoide a 9 m: capturas su sombra y puedes adoptar su aspecto 1 hora y saber lo que él contaría a un conocido (1 vez por descanso corto o largo)."),
            (14, "Saber sombrío", "Acción: susurras a una criatura a 9 m; salvación de SAB o queda hechizada 8 horas y te obedece temiendo que reveles su secreto (1 vez por descanso largo).")],
        "Colegio de los espíritus": [
            (3, "Susurros guía", "Aprendes el truco guía, con alcance 18 m."),
            (3, "Canalizador espiritual", "Vela, bola de cristal, calavera, tablero espiritista o baraja de tarokka como canalizador; desde el nivel 6 suma 1d6 al daño o la curación de tus conjuros de bardo."),
            (3, "Relatos del más allá", "Acción adicional: gastas Inspiración bárdica y tiras en la tabla de relatos con tu dado; luego, como acción, otorgas su efecto (daño, curación, teletransporte, ventaja…) a alguien a 9 m."),
            (6, "Sesión espiritista", "Ritual de 1 hora con hasta tu competencia en participantes: aprendes temporalmente un conjuro de adivinación o nigromancia de cualquier clase de nivel igual o menor al número de participantes."),
            (14, "Conexión mística", "Tiras dos veces en la tabla de relatos y eliges; con dos iguales, eliges cualquier relato.")],
        "Colegio de la creación": [
            (3, "Mota de potencial", "Al dar Inspiración bárdica creas una mota que añade un efecto: en una prueba, tira el dado otra vez y suma; en un ataque, estalla con trueno; en una salvación, PG temporales."),
            (3, "Interpretación de la creación", "Acción: creas un objeto no mágico de hasta 20 × tu nivel de bardo en po que dura tu competencia en horas (1 vez por descanso largo o con un espacio de nivel 2+)."),
            (6, "Interpretación animadora", "Acción: animas un objeto Grande o menor a 9 m 1 hora con el perfil de objeto danzante (1 vez por descanso largo o con un espacio de nivel 3+)."),
            (14, "Crescendo creativo", "Creas tantos objetos como tu modificador por CAR (mínimo 2), sin límite de valor.")],
        "Colegio de la elocuencia": [
            (3, "Lengua de plata", "En Engaño y Persuasión, un 9 o menos en el d20 cuenta como 10."),
            (3, "Palabras inquietantes", "Acción adicional: gastas Inspiración bárdica y una criatura a 18 m resta el dado a su siguiente salvación."),
            (6, "Inspiración infalible", "Si alguien usa tu Inspiración bárdica y falla, conserva el dado."),
            (6, "Discurso universal", "Acción: tantas criaturas como tu modificador por CAR te entienden 1 hora (1 vez por descanso largo o gastando un espacio)."),
            (14, "Elocuencia contagiosa", "Reacción cuando alguien acierta con tu Inspiración bárdica: otra criatura recibe un dado gratis. Usos: tu modificador por CAR por descanso largo.")],
    },
    "brujo": {
        "Patrón inmortal": [
            (3, "Conjuros del patrón", _spells((3, "falsa vida, rayo nauseabundo, ceguera/sordera, silencio"), (5, "fingir muerte, hablar con los muertos"),
                                               (7, "aura de vida, guarda contra la muerte"), (9, "conocer las leyendas, contagio"))),
            (3, "Entre los muertos", "Truco piedad con los moribundos, ventaja contra enfermedades y los muertos vivientes que te ataquen salvan SAB o eligen otro objetivo."),
            (6, "Desafiar a la muerte", "Al superar una salvación contra muerte o estabilizar a alguien recuperas 1d8 + CON PG (1 vez por descanso largo)."),
            (10, "Naturaleza imperecedera", "Aguantas la respiración sin límite, no necesitas comer, beber ni dormir y envejeces diez veces más despacio."),
            (14, "Vida indestructible", "Acción adicional: recuperas 1d8 + tu nivel de brujo PG y puedes reimplantar un miembro (1 vez por descanso corto o largo).")],
        "Patrón no muerto": [
            (3, "Conjuros del patrón", _spells((3, "perdición, falsa vida, ceguera/sordera, fuerza fantasmal"), (5, "corcel fantasma, hablar con los muertos"),
                                               (7, "guarda contra la muerte, invisibilidad mejorada"), (9, "nube aniquiladora, caparazón antivida"))),
            (3, "Forma del terror", "Acción adicional: 1 minuto con 1d10 + nivel de PG temporales, inmune a asustado y, una vez por turno al acertar, salvación de SAB o el objetivo se asusta. Usos: competencia por descanso largo."),
            (6, "Tocado por la tumba", "No comes, bebes ni respiras; una vez por turno cambias el daño de un ataque a necrótico (con un dado más en forma del terror)."),
            (10, "Envoltura necrótica", "Resistencia al necrótico (inmunidad en forma del terror). Al caer a 0 PG, reacción para quedarte a 1 PG y hacer 2d10 + nivel de necrótico a 9 m; ganas un nivel de cansancio (1 vez cada 1d4 descansos largos)."),
            (14, "Proyección espiritual", "Acción: proyectas tu espíritu hasta 1 hora (como concentración): resistencia a contundente, cortante y perforante, mismos sentidos y atraviesas objetos; tus conjuros de conjuración o nigromancia te curan la mitad del daño.")],
        "Filo maldito (hexblade)": [
            (3, "Conjuros del patrón", _spells((3, "escudo, castigo iracundo, contorno borroso, castigo marcador"), (5, "intermitencia, arma elemental"),
                                               (7, "asesino fantasmal, castigo debilitador"), (9, "castigo desterrador, cono de frío"))),
            (3, "Maldición del filo", "Acción adicional: maldices a una criatura a 18 m 1 minuto: +competencia al daño contra ella, crítico con 19-20 y, si muere, recuperas nivel + CAR PG (1 vez por descanso corto o largo)."),
            (3, "Guerrero maldito", "Armaduras medias, escudos y armas marciales; tras un descanso largo eliges un arma sin la propiedad a dos manos con la que atacas usando CAR."),
            (6, "Espectro maldito", "Al matar a un humanoide, su espíritu se alza como espectro a tus órdenes hasta tu siguiente descanso largo (PG temporales: la mitad de tu nivel; +CAR al ataque) (1 vez por descanso largo)."),
            (10, "Armadura de maleficios", "Reacción si el maldito te golpea: tira 1d6; con 4+ el ataque falla."),
            (14, "Señor de los maleficios", "Cuando muere el maldito, pasas la maldición a otra criatura a 9 m sin recuperar PG.")],
        "Patrón insondable": [
            (3, "Conjuros del patrón", _spells((3, "crear o destruir agua, ola atronadora, ráfaga de viento, silencio"), (5, "relámpago, tormenta de aguanieve"),
                                               (7, "controlar agua, invocar elemental (agua)"), (9, "mano de Bigby, cono de frío"))),
            (3, "Tentáculo de las profundidades", "Acción adicional: un tentáculo a 18 m durante 1 minuto; al crearlo y como acción adicional, ataque de conjuro de 1d8 frío que reduce 3 m la velocidad (2d8 a nivel 10). Usos: competencia por descanso largo."),
            (3, "Don del mar", "Velocidad nadando 12 m y respiras bajo el agua."),
            (6, "Alma oceánica", "Resistencia al frío y te entiendes con cualquier criatura que hable si ambos estáis sumergidos."),
            (6, "Espiral guardiana", "Reacción cuando alguien a 3 m del tentáculo recibe daño: lo reduces 1d8 (2d8 a nivel 10)."),
            (10, "Tentáculos atrapadores", "Siempre tienes preparado tentáculos negros de Evard y lo lanzas 1 vez gratis por descanso largo; mientras te concentras en él ganas PG temporales y el daño no rompe tu concentración."),
            (14, "Zambullida insondable", "Acción: teletransportas a ti y hasta cinco voluntarios a 9 m a un agua que hayas visto a 1,5 km (1 vez por descanso corto o largo).")],
        "Patrón genio": [
            (3, "Conjuros del patrón", "Siempre preparados: detectar el bien y el mal (nv 1), fuerza fantasmal (nv 2), crear comida y agua (nv 3), asesino fantasmal (nv 4), creación (nv 5) y deseo a nivel 17, más los de tu tipo de genio (dao: tierra; djinni: aire; efreeti: fuego; marid: agua)."),
            (3, "Vasija del genio", "Un objeto diminuto que es tu canalizador: puedes meterte dentro (Respiro embotellado, el doble de tu competencia en horas, 1 vez por descanso largo) y, una vez por turno, sumar tu competencia al daño como el de tu genio (contundente, trueno, fuego o frío)."),
            (6, "Don elemental", "Resistencia al daño de tu genio y vuelo de 9 m durante 10 minutos como acción adicional. Usos: competencia por descanso largo."),
            (10, "Vasija santuario", "Metes contigo hasta cinco voluntarios; 10 minutos dentro equivalen a un descanso corto y suman tu competencia a la curación."),
            (14, "Deseo limitado", "Acción: pides el efecto de un conjuro de nivel 6 o menor de 1 acción de cualquier lista, sin requisitos (1 vez cada 1d4 descansos largos).")],
    },
    "clerigo": {
        "Dominio del conocimiento": [
            (3, "Conjuros de dominio", _spells((3, "orden imperiosa, identificar, augurio, sugestión"), (5, "hablar con los muertos, indetectable"),
                                               (7, "ojo arcano, confusión"), (9, "conocer las leyendas, escudriñar"))),
            (3, "Bendiciones del conocimiento", "Dos idiomas y competencia con pericia en dos de Conocimiento arcano, Historia, Naturaleza o Religión."),
            (3, "Canalizar divinidad: saber de las eras", "Acción: competencia en una habilidad o herramienta durante 10 minutos."),
            (6, "Canalizar divinidad: leer pensamientos", "Acción: salvación de SAB de una criatura a 18 m; si falla, lees sus pensamientos superficiales 1 minuto y puedes lanzarle sugestión sin espacio."),
            (17, "Visiones del pasado", "Meditando, ves el pasado de un objeto que sostienes o del lugar donde estás (1 vez por descanso corto o largo).")],
        "Dominio de la naturaleza": [
            (3, "Conjuros de dominio", _spells((3, "encantar animal, hablar con los animales, piel robliza, crecimiento espinoso"), (5, "crecimiento vegetal, muro de viento"),
                                               (7, "dominar bestia, enredadera atrapadora"), (9, "plaga de insectos, zancada arbórea"))),
            (3, "Acólito de la naturaleza", "Un truco de druida y competencia en Naturaleza, Supervivencia o Trato con animales; además, armadura pesada."),
            (3, "Canalizar divinidad: hechizar animales y plantas", "Acción: bestias y plantas a 9 m que te vean salvan SAB o quedan hechizadas y amistosas 1 minuto."),
            (6, "Amortiguar los elementos", "Reacción: tú o alguien a 9 m ganáis resistencia a un daño de ácido, frío, fuego, relámpago o trueno."),
            (17, "Señor de la naturaleza", "Acción adicional: das órdenes a las criaturas hechizadas por tu Canalizar divinidad.")],
        "Dominio de la tempestad": [
            (3, "Conjuros de dominio", _spells((3, "nube de oscurecimiento, ola atronadora, ráfaga de viento, romper"), (5, "llamar al relámpago, tormenta de aguanieve"),
                                               (7, "controlar agua, tormenta de hielo"), (9, "ola destructora, plaga de insectos"))),
            (3, "Competencias adicionales", "Armas marciales y armadura pesada."),
            (3, "Ira de la tormenta", "Reacción si te golpean a 1,5 m: salvación de DES o 2d8 de relámpago o trueno. Usos: tu modificador por SAB por descanso largo."),
            (3, "Canalizar divinidad: ira destructiva", "Al hacer daño de relámpago o trueno, el daño es el máximo."),
            (6, "Golpe del rayo", "Cuando haces daño de relámpago a una criatura Grande o menor, la empujas hasta 3 m."),
            (17, "Hijo de la tormenta", "Velocidad volando igual a tu velocidad al aire libre.")],
        "Dominio de la forja": [
            (3, "Conjuros de dominio", _spells((3, "castigo abrasador, identificar, calentar metal, arma mágica"), (5, "arma elemental, protección contra energía"),
                                               (7, "fabricar, muro de fuego"), (9, "animar objetos, creación"))),
            (3, "Competencias adicionales", "Armadura pesada y herramientas de herrero."),
            (3, "Bendición de la forja", "Tras un descanso largo das +1 a un arma o armadura no mágica hasta el siguiente."),
            (3, "Canalizar divinidad: bendición del artesano", "Ritual de 1 hora: creas un objeto metálico de hasta 100 po fundiendo metal del mismo valor."),
            (6, "Alma de la forja", "Resistencia al fuego y +1 a la CA con armadura pesada."),
            (17, "Santo de la forja y el fuego", "Inmune al fuego y, con armadura pesada, resistencia a contundente, cortante y perforante no mágicos.")],
        "Dominio de la tumba": [
            (3, "Conjuros de dominio", _spells((3, "perdición, falsa vida, descanso apacible, rayo debilitante"), (5, "revivir, toque vampírico"),
                                               (7, "marchitar, guarda contra la muerte"), (9, "caparazón antivida, revivir a los muertos"))),
            (3, "Círculo de mortalidad", "Tus conjuros curan al máximo a quien está a 0 PG; piedad con los moribundos a 9 m y como acción adicional."),
            (3, "Ojos de la tumba", "Acción: detectas muertos vivientes a 18 m hasta tu siguiente turno. Usos: tu modificador por SAB por descanso largo."),
            (3, "Canalizar divinidad: camino a la tumba", "Acción: maldices a una criatura a 9 m; el siguiente ataque que la golpee le hace daño doble (vulnerabilidad)."),
            (6, "Centinela en las puertas de la muerte", "Reacción: conviertes un crítico contra ti o alguien a 9 m en un golpe normal. Usos: tu modificador por SAB por descanso largo."),
            (17, "Guardián de almas", "Cuando muere un enemigo a 18 m, tú o un aliado recuperáis PG iguales a sus dados de golpe (1 vez por ronda).")],
        "Dominio del saber arcano": [
            (3, "Conjuros de dominio", _spells((3, "detectar magia, proyectil mágico, arma mágica, aura mágica de Nystul"), (5, "disipar magia, círculo mágico"),
                                               (7, "ojo arcano, cofre oculto de Leomund"), (9, "vínculo planar, círculo de teletransporte"))),
            (3, "Iniciado arcano", "Competencia en Conocimiento arcano y dos trucos de mago que cuentan como de clérigo."),
            (3, "Canalizar divinidad: abjuración arcana", "Acción: un celestial, elemental, feérico o infernal a 9 m salva SAB o huye 1 minuto (desterrado si su VD es bajo para tu nivel)."),
            (6, "Destructor de conjuros", "Al curar a un aliado con un conjuro de nivel 1+, terminas un conjuro que le afecte de nivel igual o menor."),
            (17, "Maestría arcana", "Añades cuatro conjuros de mago (de niveles 6, 7, 8 y 9) a tus conjuros de dominio.")],
        "Dominio de la muerte": [
            (3, "Conjuros de dominio", _spells((3, "falsa vida, rayo nauseabundo, ceguera/sordera, rayo debilitante"), (5, "animar a los muertos, toque vampírico"),
                                               (7, "marchitar, guarda contra la muerte"), (9, "caparazón antivida, nube aniquiladora"))),
            (3, "Segador", "Armas marciales y un truco de nigromancia; tus trucos de nigromancia de un objetivo pueden afectar a dos a 1,5 m entre sí."),
            (3, "Canalizar divinidad: toque de la muerte", "Al acertar cuerpo a cuerpo, +5 + 2 × tu nivel de clérigo de daño necrótico."),
            (6, "Destrucción ineludible", "Tu daño necrótico ignora la resistencia."),
            (17, "Segador mejorado", "Tus conjuros de nigromancia de nivel 1 a 5 de un solo objetivo pueden afectar a dos.")],
        "Dominio del orden": [
            (3, "Conjuros de dominio", _spells((3, "orden imperiosa, heroísmo, inmovilizar persona, zona de la verdad"), (5, "palabra curativa en masa, ralentizar"),
                                               (7, "compulsión, localizar criatura"), (9, "comunión, dominar persona"))),
            (3, "Competencias adicionales", "Armadura pesada y competencia en Intimidación o Persuasión."),
            (3, "Voz de autoridad", "Si tu conjuro de nivel 1+ afecta a un aliado, este puede atacar como reacción a quien elijas."),
            (3, "Canalizar divinidad: exigencia del orden", "Acción: las criaturas que elijas a 9 m salvan SAB o quedan hechizadas hasta tu siguiente turno y sueltan lo que sostienen."),
            (6, "Encarnación de la ley", "Lanzas un conjuro de encantamiento de 1 acción como acción adicional. Usos: tu modificador por SAB por descanso largo."),
            (17, "Ira del orden", "Al hacer daño en tu turno con Golpes benditos, maldices al objetivo: el siguiente aliado que lo golpee añade 2d8 psíquico.")],
        "Dominio de la paz": [
            (3, "Conjuros de dominio", _spells((3, "heroísmo, santuario, auxilio, vínculo protector"), (5, "faro de esperanza, recado"),
                                               (7, "aura de pureza, esfera elástica de Otiluke"), (9, "restablecimiento mayor, vínculo telepático de Rary"))),
            (3, "Implemento de paz", "Competencia en Perspicacia, Interpretación o Persuasión."),
            (3, "Vínculo alentador", "Acción: vinculas a tantas criaturas como tu competencia 10 minutos; a 9 m entre sí suman 1d4 a una tirada por turno. Usos: competencia por descanso largo."),
            (3, "Canalizar divinidad: bálsamo de paz", "Acción: te mueves tu velocidad sin provocar ataques y curas 2d6 + SAB a cada criatura a la que pases a 1,5 m."),
            (6, "Vínculo protector", "Una criatura vinculada puede teletransportarse junto a otra que va a recibir daño y recibirlo en su lugar."),
            (17, "Vínculo expansivo", "El vínculo alcanza 18 m y quien recibe el daño por otro tiene resistencia.")],
        "Dominio del crepúsculo": [
            (3, "Conjuros de dominio", _spells((3, "fuego feérico, dormir, rayo de luna, ver invisibilidad"), (5, "aura de vitalidad, pequeña choza de Leomund"),
                                               (7, "aura de vida, invisibilidad mejorada"), (9, "círculo de poder, doble engañoso"))),
            (3, "Competencias adicionales", "Armas marciales y armadura pesada."),
            (3, "Ojos de la noche", "Visión en la oscuridad de 90 m; como acción la compartes 1 hora con tu modificador por SAB en criaturas (1 vez por descanso largo o gastando un espacio)."),
            (3, "Bendición del vigilante", "Acción: una criatura tiene ventaja en su siguiente tirada de iniciativa."),
            (3, "Canalizar divinidad: santuario crepuscular", "Acción: esfera de 9 m 1 minuto; quien acabe su turno dentro gana 1d6 + nivel de PG temporales o termina un efecto de asustado o hechizado."),
            (6, "Pasos de la noche", "Acción adicional en penumbra u oscuridad: vuelas 1 minuto. Usos: competencia por descanso largo."),
            (17, "Mortaja crepuscular", "Tú y tus aliados en la esfera tenéis cobertura media.")],
    },
    "druida": {
        "Círculo de los sueños": [
            (3, "Bálsamo de la Corte de Verano", "Reserva de d6 igual a tu nivel: acción adicional para gastar hasta la mitad de tu nivel en dados y curar a alguien a 36 m esa tirada (+1 PG temporal por dado)."),
            (6, "Hogar de luz de luna y sombra", "En un descanso creas una esfera de 9 m: +5 a Sigilo y Percepción y la luz de tus fuegos no se ve desde fuera."),
            (10, "Senderos ocultos", "Acción adicional: te teletransportas 18 m (o, con tu acción, a un voluntario 9 m). Usos: tu modificador por SAB por descanso largo."),
            (14, "Caminante de sueños", "Al terminar un descanso corto lanzas sin espacio ensueño, escudriñar o un círculo de teletransporte al sitio de tu último descanso largo (1 vez por descanso largo).")],
        "Círculo del pastor": [
            (3, "Habla del bosque", "Hablas silvano y entiendes a las bestias y ellas a ti."),
            (3, "Tótem espiritual", "Acción adicional: un espíritu a 18 m crea un aura de 9 m durante 1 minuto: oso (PG temporales y ventaja en FUE), halcón (reacción para dar ventaja a un ataque) o unicornio (detectar criaturas y curación extra). 1 vez por descanso corto o largo."),
            (6, "Invocador poderoso", "Tus bestias y feéricos invocados tienen 2 PG más por dado de golpe y sus armas naturales son mágicas."),
            (10, "Espíritu guardián", "Tus invocaciones que acaben su turno en el aura del tótem recuperan la mitad de tu nivel en PG."),
            (14, "Invocaciones leales", "Al caer a 0 PG o quedar incapacitado, conjuras cuatro bestias de VD 2 como conjurar animales de nivel 9 durante 1 hora (1 vez por descanso largo).")],
        "Círculo de las esporas": [
            (3, "Conjuros del círculo", "Toque helado y, siempre preparados: ceguera/sordera, rayo nauseabundo (nv 3), animar a los muertos, nube infecta… (nv 5), plaga, confusión (nv 7), nube aniquiladora, contagio (nv 9)."),
            (3, "Halo de esporas", "Reacción cuando alguien entra o empieza su turno a 3 m: salvación de CON o 1d4 necrótico (1d6 a nivel 6, 1d8 a nivel 10, 1d10 a nivel 14)."),
            (3, "Entidad simbiótica", "Gastas Forma salvaje para ganar 4 PG temporales por nivel durante 10 minutos: tu halo tira el dado dos veces y tus ataques cuerpo a cuerpo hacen +1d6 necrótico."),
            (6, "Infestación fúngica", "Reacción cuando muere una bestia o humanoide pequeño o mediano a 3 m: se alza como zombi 1 hora con 1 PG. Usos: tu modificador por SAB por descanso largo."),
            (10, "Esporas propagadas", "Con la entidad simbiótica, acción adicional para lanzar un cubo de 3 m de esporas a 9 m que hace el daño del halo durante 1 minuto."),
            (14, "Cuerpo fúngico", "No puedes quedar cegado, ensordecido, asustado ni envenenado y los críticos contra ti son golpes normales.")],
        "Círculo del fuego salvaje": [
            (3, "Conjuros del círculo", "Siempre preparados: manos ardientes, curar heridas, esfera flamígera, rayo abrasador (nv 3), revivir, muro de fuego… (nv 5), aura de vida, escudo de fuego (nv 7), golpe flamígero, curar heridas en masa (nv 9)."),
            (3, "Invocar espíritu del fuego salvaje", "Gastas Forma salvaje para invocar tu espíritu (2d6 de fuego a 3 m al aparecer, salvación DES). Actúa con tu acción adicional: ataque de llamas o teletransportar aliados entre llamas."),
            (6, "Vínculo mejorado", "Con el espíritu invocado, tus conjuros de fuego o curación suman 1d8 y pueden salir del espíritu."),
            (10, "Llamas cauterizantes", "Cuando muere una criatura a 9 m, deja una llama; reacción para curar o hacer 2d10 + SAB de fuego a quien entre en ella. Usos: competencia por descanso largo."),
            (14, "Resurgimiento llameante", "Al caer a 0 PG, si tu espíritu está a 36 m, cae él y tú recuperas la mitad de tus PG y te levantas (1 vez por descanso largo).")],
    },
    "explorador": {
        "Caminante del horizonte": [
            (3, "Conjuros del caminante", _spells((3, "protección contra el bien y el mal"), (5, "paso brumoso"), (9, "acelerar"), (13, "destierro"), (17, "círculo de teletransporte"))),
            (3, "Detectar portal", "Acción: sabes dónde está el portal planar más cercano a 1,5 km (1 vez por descanso corto o largo)."),
            (3, "Guerrero planar", "Acción adicional: tu siguiente golpe a una criatura a 9 m hace todo su daño de fuerza y +1d8 (2d8 a nivel 11)."),
            (7, "Paso etéreo", "Acción adicional: pasas al plano etéreo hasta el final de tu turno (1 vez por descanso corto o largo)."),
            (11, "Golpe lejano", "Con la acción de Ataque te teletransportas 3 m antes de cada ataque; si atacas a dos criaturas distintas, haces un ataque más contra una tercera."),
            (15, "Defensa espectral", "Reacción al recibir un ataque: resistencia a ese daño.")],
        "Asesino de monstruos": [
            (3, "Conjuros del asesino", _spells((3, "protección contra el bien y el mal"), (5, "zona de la verdad"), (9, "círculo mágico"), (13, "destierro"), (17, "inmovilizar monstruo"))),
            (3, "Sentido del cazador", "Acción: sabes las inmunidades, resistencias y vulnerabilidades de una criatura a 18 m. Usos: tu modificador por SAB por descanso largo."),
            (3, "Presa del asesino", "Acción adicional: marcas a una criatura a 18 m; el primer golpe que le das cada turno hace +1d6 hasta tu siguiente descanso corto o largo."),
            (7, "Defensa sobrenatural", "Sumas 1d6 a las salvaciones que te imponga tu presa y a escapar de su agarre."),
            (11, "Némesis de los magos", "Reacción: si alguien a 18 m lanza un conjuro o se teletransporta, salvación de SAB o falla (1 vez por descanso corto o largo)."),
            (15, "Contraataque del asesino", "Si tu presa te obliga a salvar, reacción para atacarla antes; si aciertas, superas la salvación.")],
        "Guardián del enjambre": [
            (3, "Conjuros del guardián", _spells((3, "mano de mago, fuego feérico"), (5, "telaraña"), (9, "forma gaseosa"), (13, "ojo arcano"), (17, "plaga de insectos"))),
            (3, "Enjambre reunido", "Una vez por turno al acertar: +1d6 perforante, empujas 4,5 m al objetivo (salvación de FUE) o te mueves 1,5 m sin provocar ataques."),
            (7, "Corriente ondulante", "Acción adicional: vuelo de 3 m y flotar durante 1 minuto. Usos: competencia por descanso largo."),
            (11, "Enjambre poderoso", "El daño sube a 1d8, el empujón también derriba y moverte te da cobertura media."),
            (15, "Dispersión del enjambre", "Reacción al recibir daño: resistencia y te teletransportas 9 m. Usos: competencia por descanso largo.")],
        "Guardadracos": [
            (3, "Don dracónico", "Truco taumaturgia y un idioma (dracónico u otro)."),
            (3, "Compañero dragón", "Acción: invocas a tu dragoncillo (o en lugar de un ataque desde el nivel 7); usa tu competencia, muerde con 1d6 + competencia y su daño elemental elegido; actúa con tu acción adicional. 1 vez por descanso largo o gastando un espacio."),
            (7, "Vínculo de colmillo y escama", "El dragón crece a Mediano, vuela, puede ser tu montura y su mordisco hace +1d6; tú ganas resistencia a su tipo de daño."),
            (11, "Aliento del guardadracos", "Acción: tú o el dragón exhaláis un cono de 9 m de 8d6 (10d6 a nivel 15), salvación de DES (1 vez por descanso largo o gastando un espacio de nivel 3+)."),
            (15, "Vínculo perfeccionado", "El dragón crece a Grande, su mordisco hace +2d6 y, como reacción, das resistencia a ti o a él contra un daño. Usos: competencia por descanso largo.")],
    },
    "guerrero": {
        "Arquero arcano": [
            (3, "Saber del arquero arcano", "Competencia en Conocimiento arcano o Naturaleza y el truco prestidigitación o saber druídico."),
            (3, "Disparo arcano", "Aprendes dos disparos (destierro, encantamiento, explosión, debilitante, agarre, perforante, buscador, sombra…) y otros a los niveles 7, 10, 15 y 18. Una vez por turno al disparar un arco; 2 usos por descanso corto o largo. CD 8 + competencia + INT."),
            (7, "Flecha mágica", "Tus flechas cuentan como mágicas."),
            (7, "Disparo curvo", "Acción adicional: si fallas con una flecha mágica, repites el ataque contra otro objetivo a 18 m."),
            (10, "Disparo arcano adicional", "Aprendes otra opción de Disparo arcano (y otra más en el nivel 15)."),
            (15, "Disparo siempre listo", "Si tiras iniciativa sin usos de Disparo arcano, recuperas uno."),
            (18, "Disparo arcano mejorado", "Aprendes otra opción y el daño extra de tus disparos arcanos aumenta (como indica cada opción).")],
        "Caballería": [
            (3, "Competencia adicional", "Una habilidad entre Historia, Interpretación, Perspicacia, Persuasión o Trato con animales, o un idioma."),
            (3, "Nacido para la silla", "Ventaja para no caer de la montura, caes de pie y montar o desmontar te cuesta 1,5 m."),
            (3, "Marca implacable", "Al golpear cuerpo a cuerpo marcas al objetivo: desventaja contra otros a 1,5 m de ti y, si daña a otro, ataque especial como acción adicional con +la mitad de tu nivel de daño. Usos de ese ataque: tu modificador por CON por descanso largo."),
            (7, "Maniobra defensiva", "Reacción: sumas 1d8 a la CA de alguien a 1,5 m contra un ataque y, si aun así acierta, resistencia. Usos: tu modificador por CON por descanso largo."),
            (10, "Mantener la línea", "Moverte 1,5 m dentro de tu alcance provoca ataque de oportunidad y, si golpeas, la velocidad del objetivo baja a 0."),
            (15, "Carga feroz", "Si te mueves 3 m en línea recta y golpeas, salvación de FUE o el objetivo cae derribado (1 vez por turno)."),
            (18, "Defensor vigilante", "Una reacción extra en cada turno ajeno, solo para ataques de oportunidad.")],
        "Samurái": [
            (3, "Competencia adicional", "Una habilidad entre Historia, Interpretación, Perspicacia o Persuasión, o un idioma."),
            (3, "Espíritu de lucha", "Acción adicional: ventaja en tus ataques este turno y 5 PG temporales (10 a nivel 10, 15 a nivel 15). Usos: competencia por descanso largo."),
            (7, "Cortesano elegante", "Sumas tu modificador por SAB a Persuasión y ganas competencia en salvaciones de SAB (o INT o CAR si ya la tenías)."),
            (10, "Espíritu incansable", "Si tiras iniciativa sin usos de Espíritu de lucha, recuperas uno."),
            (15, "Golpe rápido", "Una vez por turno, si tienes ventaja en un ataque, renuncias a ella para hacer un ataque más."),
            (18, "Fuerza antes que muerte", "Reacción al caer a 0 PG: haces un turno extra antes de quedar inconsciente (1 vez por descanso largo).")],
        "Caballero del dragón púrpura": [
            (3, "Grito de batalla", "Al usar Tomar aliento, hasta tres aliados a 18 m que te vean u oigan recuperan PG iguales a tu nivel de guerrero."),
            (7, "Enviado real", "Competencia en Persuasión (o en Interpretación, Intimidación, Perspicacia o Trato con animales) y pericia en Persuasión."),
            (10, "Oleada inspiradora", "Al usar Oleada de acción, un aliado a 18 m que te vea u oiga hace un ataque con arma como reacción."),
            (15, "Baluarte", "Al usar Indomable en una salvación de INT, SAB o CAR, un aliado a 18 m que falló la misma también la repite."),
            (18, "Oleada inspiradora mejorada", "Tu Oleada inspiradora deja atacar a dos aliados en lugar de uno.")],
        "Caballero rúnico": [
            (3, "Competencias adicionales", "Herramientas de herrero y hablas gigante."),
            (3, "Tallador de runas", "Aprendes dos runas (fuego, nubes, escarcha, piedra, colinas, tormenta…; 3 a nivel 7, 4 a nivel 10, 5 a nivel 15) que inscribes en armas o armaduras: cada una da un beneficio pasivo y un poder que usas 1 vez por descanso corto o largo."),
            (3, "Poder de los gigantes", "Acción adicional: 1 minuto Grande, ventaja en FUE y +1d6 de daño una vez por turno. Usos: competencia por descanso largo."),
            (7, "Escudo rúnico", "Reacción: un atacante que golpea a otro a 18 m repite su d20. Usos: competencia por descanso largo."),
            (10, "Gran estatura", "Creces 3d4 pulgadas y el daño de Poder de los gigantes sube a 1d8."),
            (15, "Maestro rúnico", "Cada runa se invoca dos veces por descanso corto o largo."),
            (18, "Gigante rúnico", "Poder de los gigantes sube a 1d10 y puedes hacerte Enorme (+1,5 m de alcance).")],
        "Caballero eco": [
            (3, "Manifestar eco", "Acción adicional: un eco tuyo a 4,5 m (CA 14 + competencia, 1 PG) que se mueve 9 m; puedes atacar desde su espacio y cambiarte con él por 4,5 m de movimiento."),
            (3, "Desatar encarnación", "Con la acción de Ataque, un ataque cuerpo a cuerpo más desde la posición del eco. Usos: tu modificador por CON por descanso largo."),
            (7, "Avatar eco", "Acción: ves y oyes a través del eco hasta 10 minutos (puede alejarse 300 m); mientras, estás ciego y sordo."),
            (10, "Mártir sombrío", "Reacción: el eco se teletransporta junto a alguien atacado y recibe el ataque (1 vez por descanso corto o largo)."),
            (15, "Recuperar potencial", "Cuando destruyen tu eco, ganas 2d6 + CON PG temporales. Usos: tu modificador por CON por descanso largo."),
            (18, "Ejército de uno", "Puedes tener dos ecos y, si tiras iniciativa sin usos de Desatar encarnación, recuperas uno.")],
    },
    "hechicero": {
        "Alma divina": [
            (3, "Magia divina", "Al aprender conjuros eliges de las listas de hechicero y clérigo; según tu afinidad (bien, mal, ley, caos o neutralidad) tienes siempre preparado curar heridas, infligir heridas, bendición, perdición o protección contra el bien y el mal."),
            (3, "Favorecido por los dioses", "Si fallas una salvación o un ataque, sumas 2d4 (1 vez por descanso corto o largo)."),
            (6, "Curación potenciada", "Gastas 1 punto de hechicería para repetir dados de curación tuyos o de un aliado a 1,5 m (1 vez por turno)."),
            (14, "Alas de otro mundo", "Acción adicional: alas espectrales con vuelo de 9 m hasta que las retires."),
            (18, "Recuperación sobrenatural", "Acción adicional con menos de la mitad de PG: recuperas la mitad de tus PG máximos (1 vez por descanso largo).")],
        "Magia sombría": [
            (3, "Ojos de la oscuridad", "Visión en la oscuridad de 36 m; conoces oscuridad y puedes lanzarla con 2 puntos de hechicería viendo a través de ella."),
            (3, "Fuerza de la tumba", "Al caer a 0 PG (no por radiante ni crítico), salvación de CAR (CD 5 + daño) para quedarte a 1 PG (1 vez por descanso largo)."),
            (6, "Sabueso del mal agüero", "Acción adicional y 3 puntos de hechicería: un sabueso sombrío (lobo terrible) persigue a una criatura a 36 m, que tiene desventaja en las salvaciones contra tus conjuros mientras esté a su lado."),
            (14, "Paso sombrío", "Acción adicional en penumbra u oscuridad: te teletransportas 36 m a otro punto en penumbra u oscuridad."),
            (18, "Forma umbría", "Acción adicional y 6 puntos de hechicería: 1 minuto con resistencia a todo salvo fuerza y radiante y atraviesas criaturas y objetos.")],
        "Hechicería de la tormenta": [
            (3, "Hablante del viento", "Hablas primordial (y sus dialectos)."),
            (3, "Magia tempestuosa", "Acción adicional antes o después de un conjuro de nivel 1+: vuelas 3 m sin provocar ataques."),
            (6, "Corazón de la tormenta", "Resistencia al relámpago y al trueno; tus conjuros de esos tipos hacen la mitad de tu nivel de daño a las criaturas que elijas a 3 m."),
            (6, "Guía de la tormenta", "Detienes la lluvia a tu alrededor y eliges hacia dónde sopla el viento."),
            (14, "Furia de la tormenta", "Reacción al recibir un golpe cuerpo a cuerpo: daño de relámpago igual a tu nivel y salvación de FUE o el atacante sale empujado 6 m."),
            (18, "Alma del viento", "Inmune al relámpago y al trueno, vuelo de 18 m y puedes repartir vuelo de 9 m a aliados durante 1 hora (1 vez por descanso corto o largo).")],
        "Hechicería lunar": [
            (3, "Encarnación lunar", "Conjuros siempre preparados por fase (luna llena, nueva y creciente, de nivel 1 a 5) y tras un descanso largo eliges fase; lanzas gratis 1 vez el de nivel 1 de esa fase."),
            (3, "Fuego lunar", "Truco llama sagrada, que puede afectar a dos criaturas a 1,5 m entre sí."),
            (6, "Bendiciones lunares", "La metamagia en conjuros de las escuelas de tu fase cuesta 1 punto menos. Usos: competencia por descanso largo."),
            (6, "Crecer y menguar", "Acción adicional y 1 punto de hechicería: cambias de fase; puedes lanzar gratis el conjuro de nivel 1 de cada fase una vez por descanso largo."),
            (14, "Potenciación lunar", "Llena: emites luz que da ventaja a Investigación y Percepción; nueva: ventaja en Sigilo y desventaja a los ataques contra ti en oscuridad; creciente: resistencia a necrótico y radiante."),
            (18, "Fenómeno lunar", "Acción adicional: llena ciega a 9 m y cura 3d8; nueva hace 3d10 necrótico y te vuelve invisible; creciente te teletransporta 18 m y te da resistencia (1 vez por descanso largo o con 5 puntos de hechicería).")],
    },
    "mago": {
        "Conjurador": [
            (3, "Erudito en conjuración", "Copiar conjuros de conjuración te cuesta la mitad de oro y tiempo."),
            (3, "Conjuración menor", "Acción: creas un objeto no mágico de hasta 90 cm y 5 kg a 3 m que dura 1 hora o hasta recibir daño."),
            (6, "Transposición benigna", "Acción: te teletransportas 9 m o te cambias con una criatura voluntaria Pequeña o Mediana (1 vez por descanso largo o tras lanzar un conjuro de conjuración)."),
            (10, "Conjuración concentrada", "El daño no rompe tu concentración en conjuros de conjuración."),
            (14, "Invocaciones duraderas", "Las criaturas que invocas o creas con conjuración tienen 30 PG temporales.")],
        "Encantador": [
            (3, "Erudito en encantamiento", "Copiar conjuros de encantamiento te cuesta la mitad de oro y tiempo."),
            (3, "Mirada hipnótica", "Acción: una criatura a 1,5 m salva SAB o queda hechizada, incapacitada y con velocidad 0 mientras mantengas la mirada cada turno."),
            (6, "Encanto instintivo", "Reacción: un atacante a 9 m salva SAB o desvía su ataque a otra criatura cercana."),
            (10, "Dividir encantamiento", "Tus conjuros de encantamiento de un objetivo pueden afectar a una segunda criatura."),
            (14, "Alterar recuerdos", "Las criaturas que hechizas no saben que lo estuvieron y puedes hacer que olviden 1 + CAR horas (salvación de INT).")],
        "Nigromante": [
            (3, "Erudito en nigromancia", "Copiar conjuros de nigromancia te cuesta la mitad de oro y tiempo."),
            (3, "Cosecha macabra", "Una vez por turno, al matar con un conjuro de nivel 1+, recuperas el doble de su nivel en PG (el triple si es de nigromancia)."),
            (6, "Siervos no muertos", "Añades animar a los muertos; anima un cuerpo más y tus muertos vivientes suman tu nivel a sus PG y tu competencia a su daño."),
            (10, "Acostumbrado a la no muerte", "Resistencia al necrótico y tus PG máximos no pueden reducirse."),
            (14, "Dominar muertos vivientes", "Acción: un muerto viviente a 18 m salva CAR (con ventaja si su INT es 8+) o queda a tus órdenes.")],
        "Transmutador": [
            (3, "Erudito en transmutación", "Copiar conjuros de transmutación te cuesta la mitad de oro y tiempo."),
            (3, "Alquimia menor", "Cambias temporalmente madera, piedra, hierro, cobre o plata en otro de esos materiales (30 cm³ cada 10 minutos)."),
            (6, "Piedra del transmutador", "Creas una piedra que da a su portador visión en la oscuridad, +3 m de velocidad, competencia en CON o una resistencia; la cambias al lanzar transmutaciones."),
            (10, "Cambiaformas", "Lanzas polimorfar sobre ti (bestia de VD 1 o menos) sin espacio, 1 vez por descanso corto o largo."),
            (14, "Maestro transmutador", "Consumes la piedra para transmutar un objeto, curar todas las maldiciones y venenos, restaurar la vida (como revivir) o rejuvenecer.")],
        "Magia de guerra": [
            (3, "Desvío arcano", "Reacción al recibir un golpe o fallar una salvación: +2 a la CA o +4 a la salvación; hasta tu siguiente turno solo lanzas trucos."),
            (3, "Astucia táctica", "Sumas tu modificador por INT a la iniciativa."),
            (6, "Oleada de poder", "Acumulas cargas (hasta tu modificador por INT; recuperas una tras descansar o al contrarrestar o disipar): una vez por turno, +la mitad de tu nivel de daño de fuerza a un conjuro."),
            (10, "Magia duradera", "Mientras te concentras, +2 a la CA y a todas las salvaciones."),
            (14, "Ráfaga desviada", "Al usar Desvío arcano, hasta tres criaturas a 18 m reciben la mitad de tu nivel de fuerza.")],
        "Cronurgia": [
            (3, "Cambio cronal", "Reacción: tras ver el resultado, obligas a repetir un ataque, prueba o salvación a alguien a 9 m (2 usos por descanso largo)."),
            (3, "Conciencia temporal", "Sumas tu modificador por INT a la iniciativa."),
            (6, "Estasis momentánea", "Acción: una criatura Grande o menor a 18 m salva CON o queda incapacitada con velocidad 0 hasta tu siguiente turno o hasta recibir daño. Usos: tu modificador por INT por descanso largo."),
            (10, "Suspensión arcana", "Al lanzar un conjuro de nivel 4 o menor lo guardas 1 hora en una cuenta que otro puede liberar como acción (1 vez por descanso corto o largo)."),
            (14, "Futuro convergente", "Reacción: decides que una tirada a 18 m acierta o falla por la mínima; ganas un nivel de cansancio que solo quita un descanso largo.")],
        "Graviturgia": [
            (3, "Ajustar densidad", "Acción: una criatura u objeto Grande o menor a 9 m pesa la mitad (+3 m de velocidad, salta el doble, desventaja en FUE) o el doble (−3 m, ventaja en FUE) durante 1 minuto con concentración; a nivel 10, hasta Enorme."),
            (6, "Pozo gravitatorio", "Al afectar a una criatura con un conjuro (voluntaria, impactada o que falle la salvación), la mueves 1,5 m."),
            (10, "Atracción violenta", "Reacción: +1d10 al daño de un ataque con arma de alguien a 18 m o +2d10 a una caída. Usos: tu modificador por INT por descanso largo."),
            (14, "Horizonte de sucesos", "Acción: campo de 9 m durante 1 minuto (concentración); los enemigos que empiecen su turno dentro salvan FUE o reciben 2d10 de fuerza y velocidad 0 (1 vez por descanso largo o con un espacio de nivel 3+).")],
        "Canción de la hoja": [
            (3, "Entrenamiento en guerra y canto", "Armaduras ligeras, un arma cuerpo a cuerpo a una mano y Interpretación."),
            (3, "Canción de la hoja", "Acción adicional, sin armadura media o pesada ni escudo: 1 minuto con +INT a la CA, +3 m de velocidad, ventaja en Acrobacias y +INT a las salvaciones de concentración. Usos: competencia por descanso largo."),
            (6, "Ataque adicional", "Dos ataques con la acción de Ataque; uno puede ser un truco."),
            (10, "Canción de defensa", "Con la canción activa, reacción para gastar un espacio y reducir el daño en 5 × su nivel."),
            (14, "Canción de victoria", "Con la canción activa, sumas tu modificador por INT al daño cuerpo a cuerpo.")],
        "Orden de los escribas": [
            (3, "Pluma mágica", "Acción adicional: creas una pluma sin tinta con la que copias conjuros a 2 minutos por nivel y borras lo escrito."),
            (3, "Libro de conjuros despierto", "Tu libro es canalizador; cambias el tipo de daño de un conjuro por el de otro del mismo nivel de tu libro y lanzas un ritual en su tiempo normal (1 vez por descanso largo)."),
            (6, "Manifestar la mente", "Acción adicional: la mente del libro flota a 18 m, ve y oye por ti y tus conjuros pueden salir de ella (competencia veces por descanso largo)."),
            (10, "Escriba maestro", "Tras un descanso largo creas un pergamino de un conjuro de nivel 1 o 2 de tu libro que se lanza un nivel por encima."),
            (14, "Uno con la palabra", "Ventaja en Conocimiento arcano y, con la mente manifestada, reacción para evitar todo el daño a cambio de perder temporalmente conjuros del libro.")],
    },
    "monje": {
        "Camino de la larga muerte": [
            (3, "Toque de la muerte", "Al dejar a 0 PG a una criatura a 1,5 m, ganas SAB + nivel de monje PG temporales."),
            (6, "Hora de la cosecha", "Acción: las criaturas a 9 m que te vean salvan SAB o quedan asustadas hasta tu siguiente turno."),
            (11, "Dominio de la muerte", "Al caer a 0 PG, gastas 1 punto de concentración para quedarte a 1 PG."),
            (17, "Toque de la larga muerte", "Acción: tocas a una criatura y gastas de 1 a 10 puntos de concentración; 2d10 necrótico por punto (mitad si salva CON).")],
        "Camino del maestro borracho": [
            (3, "Competencias adicionales", "Interpretación y suministros de cervecero."),
            (3, "Técnica ebria", "Al usar Ráfaga de golpes ganas Destrabarse y +3 m de velocidad ese turno."),
            (6, "Vaivén tambaleante", "Levantarte te cuesta 1,5 m y, si un ataque cuerpo a cuerpo te falla, 1 punto de concentración como reacción para que golpee a otra criatura a 1,5 m."),
            (11, "Suerte del borracho", "Con desventaja en una tirada, gastas 1 punto de concentración para anularla."),
            (17, "Frenesí embriagador", "La Ráfaga de golpes hace hasta tres ataques más si cada uno es contra una criatura distinta.")],
        "Camino del kensei": [
            (3, "Senda del kensei", "Eliges armas kensei (una cuerpo a cuerpo y una a distancia, sin pesada ni especial; vale el arco largo): son armas de monje; con un ataque desarmado ganas +2 a la CA y con las de distancia una acción adicional da +1d4 al daño. Herramientas de calígrafo o de pintor."),
            (6, "Uno con la hoja", "Tus armas kensei son mágicas y, al acertar, 1 punto de concentración suma tu dado de artes marciales al daño (1 vez por turno)."),
            (11, "Afilar la hoja", "Acción adicional: hasta 3 puntos de concentración dan ese bonificador a ataque y daño a un arma kensei durante 1 minuto."),
            (17, "Precisión infalible", "Una vez por turno, si fallas con un arma de monje, repites el ataque.")],
        "Camino del alma solar": [
            (3, "Rayo solar radiante", "Ataque de conjuro a distancia (9 m) con DES y daño radiante del dado de artes marciales; 1 punto de concentración para dos más como acción adicional."),
            (6, "Golpe del arco abrasador", "Tras la acción de Ataque, 2 puntos de concentración para lanzar manos ardientes como acción adicional (más puntos, más nivel)."),
            (11, "Estallido solar abrasador", "Acción: esfera de 6 m a 45 m con 2d6 radiante (salvación CON); hasta 3 puntos de concentración suman 2d6 cada uno."),
            (17, "Escudo solar", "Emites luz a 9 m y, como reacción al recibir un golpe cuerpo a cuerpo, haces 5 + SAB radiante al atacante.")],
        "Camino del yo astral": [
            (3, "Brazos del yo astral", "Acción adicional y 1 punto de concentración: brazos espectrales 10 minutos (al aparecer, dos dados de artes marciales de fuerza a 3 m); usas SAB para FUE y golpeas con ellos a 3 m con daño de fuerza."),
            (6, "Rostro del yo astral", "Acción adicional y 1 punto de concentración: 10 minutos viendo en la oscuridad mágica a 36 m, ventaja en Perspicacia e Intimidación y voz que llega a 180 m."),
            (11, "Cuerpo del yo astral", "Con brazos y rostro: reacción para reducir 1d10 + SAB daño elemental o de fuerza y +1 dado de artes marciales al golpear con los brazos."),
            (17, "Yo astral despierto", "Acción adicional y 5 puntos: +2 a la CA y tres ataques con los brazos al usar Ataque adicional, durante 10 minutos.")],
        "Camino del dragón ascendente": [
            (3, "Disciplina dracónica", "Repites un Intimidación o Persuasión fallido (1 vez por descanso largo), tus golpes pueden hacer ácido, frío, fuego, relámpago o veneno y hablas dracónico."),
            (3, "Aliento del dragón", "Sustituyes un ataque por un cono de 6 m o línea de 9 m de dos dados de artes marciales (tres a nivel 11), salvación de DES. Usos: competencia por descanso largo o 2 puntos de concentración."),
            (6, "Alas desplegadas", "Al usar Paso del viento ganas vuelo hasta el final del turno. Usos: competencia por descanso largo."),
            (11, "Aspecto del wyrm", "Acción adicional: aura de 3 m 1 minuto que asusta (salvación de SAB) o da resistencia a aliados (1 vez por descanso largo o 3 puntos)."),
            (17, "Aspecto ascendente", "Tu aliento puede ampliarse (cono de 18 m, cuatro dados) gastando 1 punto, ganas vista ciega 3 m y el daño de tu aura sube.")],
    },
    "paladin": {
        "Rompejuramentos": [
            (3, "Conjuros de rompejuramentos", _spells((3, "reprensión infernal, infligir heridas"), (5, "corona de locura, oscuridad"), (9, "animar a los muertos, maldición"),
                                                       (13, "marchitar, confusión"), (17, "contagio, dominar persona"))),
            (3, "Canalizar divinidad: controlar muertos vivientes", "Acción: un muerto viviente a 9 m salva SAB o te obedece 24 horas (no si su VD iguala o supera tu nivel)."),
            (3, "Canalizar divinidad: aspecto temible", "Acción: quien elijas a 9 m salva SAB o queda asustado 1 minuto (repite al recibir daño)."),
            (7, "Aura de odio", "Tú y los infernales y muertos vivientes a 3 m (9 m a nivel 18) sumáis tu modificador por CAR al daño cuerpo a cuerpo."),
            (15, "Resistencia sobrenatural", "Resistencia a contundente, cortante y perforante de armas no mágicas."),
            (20, "Señor del terror", "Acción: aura de 9 m 1 minuto: penumbra, 4d10 psíquico a los asustados que empiecen dentro y ataques sombríos de 3d10 necrótico como acción adicional (1 vez por descanso largo).")],
        "Juramento de la corona": [
            (3, "Conjuros de juramento", _spells((3, "orden imperiosa, duelo obligado"), (5, "vínculo protector, zona de la verdad"), (9, "aura de vitalidad, espíritus guardianes"),
                                                 (13, "destierro, guardián de la fe"), (17, "círculo de poder, geas"))),
            (3, "Canalizar divinidad: desafío del campeón", "Las criaturas que elijas a 9 m salvan SAB o no pueden alejarse más de 9 m de ti."),
            (3, "Canalizar divinidad: cambiar las tornas", "Acción adicional: las criaturas que elijas a 9 m con la mitad de PG o menos recuperan 1d6 + CAR."),
            (7, "Lealtad divina", "Reacción: recibes tú el daño que iba a recibir una criatura a 1,5 m (sin reducirlo)."),
            (15, "Espíritu inflexible", "Ventaja en las salvaciones contra paralizado y aturdido."),
            (20, "Campeón exaltado", "Acción: 1 hora con resistencia a contundente, cortante y perforante no mágicos y ventaja de tus aliados a 9 m en salvaciones contra muerte y de SAB (1 vez por descanso largo).")],
        "Juramento de conquista": [
            (3, "Conjuros de juramento", _spells((3, "armadura de Agathys, orden imperiosa"), (5, "inmovilizar persona, arma espiritual"), (9, "maldición, miedo"),
                                                 (13, "dominar bestia, piel pétrea"), (17, "nube aniquiladora, dominar persona"))),
            (3, "Canalizar divinidad: presencia conquistadora", "Acción: las criaturas que elijas a 9 m salvan SAB o quedan asustadas 1 minuto."),
            (3, "Canalizar divinidad: golpe guiado", "+10 a una tirada de ataque."),
            (7, "Aura de conquista", "Las criaturas asustadas de ti en un aura de 3 m (9 m a nivel 18) tienen velocidad 0 y reciben psíquico igual a la mitad de tu nivel al empezar su turno."),
            (15, "Reprensión desdeñosa", "Quien te golpea recibe tu modificador por CAR de daño psíquico."),
            (20, "Conquistador invencible", "Acción: 1 minuto con resistencia a todo, un ataque extra y críticos con 19-20 (1 vez por descanso largo).")],
        "Juramento de redención": [
            (3, "Conjuros de juramento", _spells((3, "santuario, dormir"), (5, "calmar emociones, inmovilizar persona"), (9, "contraconjuro, patrón hipnótico"),
                                                 (13, "esfera elástica de Otiluke, piel pétrea"), (17, "inmovilizar monstruo, muro de fuerza"))),
            (3, "Canalizar divinidad: emisario de paz", "Acción adicional: +5 a Persuasión durante 10 minutos."),
            (3, "Canalizar divinidad: reprender a los violentos", "Reacción cuando alguien a 9 m daña a otro: salvación de SAB o recibe el mismo daño radiante (la mitad si la supera)."),
            (7, "Aura del guardián", "Reacción: recibes tú el daño de una criatura a 3 m (9 m a nivel 18)."),
            (15, "Espíritu protector", "Si acabas tu turno en combate con menos de la mitad de PG, recuperas 1d6 + la mitad de tu nivel."),
            (20, "Emisario de la redención", "Resistencia a todo el daño de otras criaturas y quien te ataca recibe la mitad de ese daño en radiante (se pierde contra quien ataques).")],
        "Juramento de los vigilantes": [
            (3, "Conjuros de juramento", _spells((3, "alarma, detectar magia"), (5, "rayo de luna, ver invisibilidad"), (9, "contraconjuro, indetectable"),
                                                 (13, "aura de pureza, destierro"), (17, "inmovilizar monstruo, escudriñar"))),
            (3, "Canalizar divinidad: voluntad del vigilante", "Acción: tú y tu modificador por CAR en criaturas a 9 m tenéis ventaja en salvaciones de INT, SAB y CAR durante 1 minuto."),
            (3, "Canalizar divinidad: abjurar lo extraplanar", "Acción: aberraciones, celestiales, elementales, feéricos e infernales a 9 m salvan SAB o huyen 1 minuto."),
            (7, "Aura del centinela", "Tú y las criaturas que elijas a 3 m (9 m a nivel 18) sumáis tu competencia a la iniciativa."),
            (15, "Reprensión vigilante", "Reacción cuando tú o alguien a 9 m supera una salvación de INT, SAB o CAR: 2d8 + CAR de fuerza a quien la provocó."),
            (20, "Baluarte mortal", "Acción adicional: 1 minuto con visión verdadera 36 m, ventaja contra extraplanares y, al golpearlos, salvación de CAR o los destierras (1 vez por descanso largo o con un espacio de nivel 5).")],
    },
    "picaro": {
        "Inquisitivo": [
            (3, "Oído para el engaño", "En Perspicacia para detectar mentiras, un 7 o menos cuenta como 8."),
            (3, "Ojo para el detalle", "Acción adicional: Percepción para encontrar algo escondido o Investigación para descifrar pistas."),
            (3, "Combate perspicaz", "Acción adicional: Perspicacia contra Engaño; si ganas, Ataque furtivo contra ese objetivo sin ventaja durante 1 minuto."),
            (9, "Mirada firme", "Ventaja en Percepción e Investigación si no te mueves más de la mitad de tu velocidad."),
            (13, "Ojo infalible", "Acción: sientes ilusiones, cambiaformas y magia de engaño a 9 m. Usos: tu modificador por SAB por descanso largo."),
            (17, "Ojo para la debilidad", "Tu Ataque furtivo contra el objetivo de Combate perspicaz hace +3d6.")],
        "Cerebro": [
            (3, "Maestro de la intriga", "Útiles de disfraz y de falsificación, un juego y dos idiomas; imitas el habla y el acento tras oírlos 1 minuto."),
            (3, "Maestro de tácticas", "Ayudar como acción adicional, y el objetivo del ataque que ayudas puede estar a 9 m."),
            (9, "Manipulador perspicaz", "Tras 1 minuto observando a alguien, sabes si te supera en INT, SAB, CAR o niveles de clase (eliges dos)."),
            (13, "Desviar", "Reacción: si alguien a 1,5 m te da cobertura contra un ataque, el ataque le golpea a él."),
            (17, "Alma de engaño", "Nadie lee tus pensamientos sin permiso, puedes mostrar pensamientos falsos y la magia que detecta mentiras dice que eres sincero.")],
        "Batidor": [
            (3, "Escaramuzador", "Reacción cuando un enemigo acaba su turno a 1,5 m: te mueves la mitad de tu velocidad sin provocar ataques."),
            (3, "Superviviente", "Competencia con pericia en Naturaleza y Supervivencia."),
            (9, "Movilidad superior", "+3 m a tu velocidad (también al trepar y nadar)."),
            (13, "Maestro de la emboscada", "Ventaja en la iniciativa y la primera criatura que golpeas en el primer asalto es atacada con ventaja hasta tu siguiente turno."),
            (17, "Golpe repentino", "Con la acción de Ataque, un ataque más como acción adicional que puede usar Ataque furtivo (no dos veces contra el mismo objetivo).")],
        "Espadachín": [
            (3, "Juego de pies elegante", "Quien atacas cuerpo a cuerpo en tu turno no puede hacerte ataques de oportunidad ese turno."),
            (3, "Osadía temeraria", "Sumas tu modificador por CAR a la iniciativa y haces Ataque furtivo a quien esté a 1,5 m si no hay nadie más junto a ti (sin desventaja)."),
            (9, "Estilo", "Acción: Persuasión contra Perspicacia; un enemigo queda atado a ti 1 minuto (desventaja contra otros) y uno no hostil queda hechizado."),
            (13, "Maniobra elegante", "Acción adicional: ventaja en tu siguiente Acrobacias o Atletismo del turno."),
            (17, "Maestro duelista", "Si fallas un ataque, lo repites con ventaja (1 vez por descanso corto o largo).")],
    },
}

SOURCE = {
    "Alquimista": "Tasha · MCT p. 102", "Blindado": "Tasha · MCT p. 104", "Artillero": "Tasha · MCT p. 106", "Herrero de batalla": "Tasha · MCT p. 108",
    "Senda del camorrista": "Guía de la Costa de la Espada · MCT p. 121", "Senda del guardián ancestral": "Xanathar · MCT p. 123",
    "Senda del heraldo de la tormenta": "Xanathar · MCT p. 124", "Senda de la bestia": "Tasha · MCT p. 126", "Senda de la magia salvaje": "Tasha · MCT p. 128",
    "Colegio de las espadas": "Xanathar · MCT p. 140", "Colegio de los susurros": "Xanathar · MCT p. 142", "Colegio de los espíritus": "Ravenloft · MCT p. 143",
    "Colegio de la creación": "Tasha · MCT p. 145", "Colegio de la elocuencia": "Tasha · MCT p. 147",
    "Patrón inmortal": "Guía de la Costa de la Espada · MCT p. 158", "Patrón no muerto": "Ravenloft · MCT p. 159", "Filo maldito (hexblade)": "Xanathar · MCT p. 164",
    "Patrón insondable": "Tasha · MCT p. 165", "Patrón genio": "Tasha · MCT p. 167",
    "Dominio del conocimiento": "Manual del Jugador 2014 · MCT p. 179", "Dominio de la naturaleza": "Manual del Jugador 2014 · MCT p. 183",
    "Dominio de la tempestad": "Manual del Jugador 2014 · MCT p. 184", "Dominio de la forja": "Xanathar · MCT p. 189", "Dominio de la tumba": "Xanathar · MCT p. 190",
    "Dominio del saber arcano": "Guía de la Costa de la Espada · MCT p. 191", "Dominio de la muerte": "Guía del Dungeon Master 2014 · MCT p. 192",
    "Dominio del orden": "Tasha · MCT p. 194", "Dominio de la paz": "Tasha · MCT p. 195", "Dominio del crepúsculo": "Tasha · MCT p. 197",
    "Círculo de los sueños": "Xanathar · MCT p. 208", "Círculo del pastor": "Xanathar · MCT p. 209", "Círculo de las esporas": "Tasha · MCT p. 212",
    "Círculo del fuego salvaje": "Tasha · MCT p. 215",
    "Caminante del horizonte": "Xanathar · MCT p. 227", "Asesino de monstruos": "Xanathar · MCT p. 228", "Guardián del enjambre": "Tasha · MCT p. 233",
    "Guardadracos": "Fizban · MCT p. 237",
    "Arquero arcano": "Xanathar · MCT p. 250", "Caballería": "Xanathar · MCT p. 252", "Samurái": "Xanathar · MCT p. 254",
    "Caballero del dragón púrpura": "Guía de la Costa de la Espada · MCT p. 255", "Caballero rúnico": "Tasha · MCT p. 259", "Caballero eco": "Wildemount · MCT p. 262",
    "Alma divina": "Xanathar · MCT p. 274", "Magia sombría": "Xanathar · MCT p. 276", "Hechicería de la tormenta": "Xanathar · MCT p. 277",
    "Hechicería lunar": "Dragonlance · MCT p. 283",
    "Conjurador": "Manual del Jugador 2014 · MCT p. 294", "Encantador": "Manual del Jugador 2014 · MCT p. 295", "Nigromante": "Manual del Jugador 2014 · MCT p. 298",
    "Transmutador": "Manual del Jugador 2014 · MCT p. 299", "Magia de guerra": "Xanathar · MCT p. 302", "Cronurgia": "Wildemount · MCT p. 303",
    "Graviturgia": "Wildemount · MCT p. 305", "Canción de la hoja": "Tasha · MCT p. 306", "Orden de los escribas": "Tasha · MCT p. 307",
    "Camino de la larga muerte": "Guía de la Costa de la Espada · MCT p. 320", "Camino del maestro borracho": "Xanathar · MCT p. 322",
    "Camino del kensei": "Xanathar · MCT p. 323", "Camino del alma solar": "Xanathar · MCT p. 324", "Camino del yo astral": "Tasha · MCT p. 327",
    "Camino del dragón ascendente": "Fizban · MCT p. 329",
    "Rompejuramentos": "Guía del Dungeon Master 2014 · MCT p. 342", "Juramento de la corona": "Guía de la Costa de la Espada · MCT p. 343",
    "Juramento de conquista": "Xanathar · MCT p. 346", "Juramento de redención": "Xanathar · MCT p. 348", "Juramento de los vigilantes": "Tasha · MCT p. 352",
    "Inquisitivo": "Xanathar · MCT p. 363", "Cerebro": "Xanathar · MCT p. 365", "Batidor": "Xanathar · MCT p. 366", "Espadachín": "Xanathar · MCT p. 367",
}
# Defensa sin armadura que dan algunas subclases (como UNARMORED de features2024)
UNARMORED = {}
