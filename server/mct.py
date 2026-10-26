"""Especies del «Manual para casi todo de D&D 5e» (V21.12.22) adaptadas a las reglas de 2024.

Solo entran las que el Manual del Jugador 2024 no tiene (el aasimar, el goliat, el orco, el tiefling… de 2024
prevalecen). Se usa la versión más reciente de cada una (Monstruos del Multiverso) y, como en 2024, las especies
no suben características (eso lo da el trasfondo); las velocidades van en metros y la magia innata se lanza
gratis una vez por descanso largo con INT, SAB o CAR. Resúmenes propios con la página del manual (MCT).
"""

MOTM = "Monstruos del Multiverso"
TAIL = "Elige INT, SAB o CAR como aptitud mágica para estos conjuros."


def _s(id, name, book, page, size, speed, darkvision, traits, group=MOTM, **extra):
    return {"id": id, "name": name, "origin": f"{book} · MCT p. {page}", "group": group, "size": size, "speed": speed,
            "darkvision": darkvision, "traits": [list(t) for t in traits], **extra}


def _claws(name, kind, dice="1d6"):
    return {"name": name, "ability": "fue", "damage": dice, "notes": f"{kind} · ataque sin armas"}


DV = ("Visión en la oscuridad", "18 m.")
DV36 = ("Visión en la oscuridad", "36 m.")
FEY_ANCESTRY = ("Ascendencia feérica", "Ventaja en las salvaciones para evitar o terminar el estado de hechizado.")
BIG = ("Constitución poderosa", "Cuentas como una categoría de tamaño mayor para la carga y para empujar, arrastrar o levantar.")
TRANCE = ("Trance", "No duermes: un descanso largo te lleva 4 horas de meditación. Al terminarlo ganas dos competencias con armas o herramientas a tu elección hasta el siguiente.")
OTHERS = "Otros libros"

SPECIES = [
    _s("aarakocra", "Aarakocra", MOTM, 49, "Mediano", 9, 0, [
        ("Vuelo", "Velocidad volando igual a tu velocidad, si no llevas armadura media ni pesada."),
        ("Garras", "Ataques sin armas de 1d6 + FUE cortante."),
        ("Invocador del viento", f"Desde el nivel 3 lanzas ráfaga de viento sin componentes materiales, 1 vez por descanso largo (y con espacios de nivel 2+). {TAIL}")],
        spells=[[3, "Ráfaga de viento", 1]], attacks=[_claws("Garras", "cortante")]),
    _s("osgo", "Osgo (bugbear)", MOTM, 52, "Mediano", 9, 18, [
        ("Tipo de criatura", "Humanoide; cuentas como goblinoide."), DV, FEY_ANCESTRY,
        ("Extremidades largas", "En tu turno, tus ataques cuerpo a cuerpo tienen 1,5 m más de alcance."), BIG,
        ("Furtivo", "Competencia en Sigilo y puedes moverte o quedarte en huecos para una criatura Pequeña sin apretarte."),
        ("Ataque sorpresa", "Si golpeas a una criatura sorprendida en tu primer turno de combate, le haces 2d6 de daño extra (1 vez por combate).")],
        skills=["sigilo"]),
    _s("centauro", "Centauro", MOTM, 53, "Mediano", 12, 0, [
        ("Tipo de criatura", "Feérico."),
        ("Afinidad natural", "Competencia en Medicina, Naturaleza, Supervivencia o Trato con animales."),
        ("Carga", "Si te mueves 9 m en línea recta y aciertas un ataque cuerpo a cuerpo con arma, puedes dar una coz con tus pezuñas como acción adicional."),
        ("Pezuñas", "Ataques sin armas de 1d6 + FUE contundente."),
        ("Estructura equina", "Cuentas como una categoría mayor para la carga, pero trepar con manos y pies te cuesta 4 casillas extra por cada una.")],
        skill_choice=["medicina", "naturaleza", "supervivencia", "trato_animales"], attacks=[_claws("Pezuñas", "contundente")]),
    _s("cambiaformas", "Cambiaformas (shifter)", MOTM, 54, "Mediano o Pequeño", 9, 18, [
        ("Tipo de criatura", "Feérico; desciendes de licántropos."),
        ("Instintos bestiales", "Competencia en Acrobacias, Atletismo, Intimidación o Supervivencia."), DV,
        ("Transformación", "Acción adicional: 1 minuto con aspecto bestial y PG temporales iguales al doble de tu bonificador por competencia, más el beneficio de tu linaje. Usos: tu bonificador por competencia por descanso largo.")],
        skill_choice=["acrobacias", "atletismo", "intimidacion", "supervivencia"],
        options_label="Linaje licántropo",
        options=[["Piel bestial", "Al transformarte, 1d6 PG temporales más y +1 a la CA."],
                 ["Dientes filosos", "Transformado, muerdes como acción adicional: 1d6 + FUE perforante."],
                 ["Patas veloces", "Transformado, +3 m de velocidad y, como reacción, te alejas 3 m de quien acabe su turno a tu lado."],
                 ["Cazador salvaje", "Transformado, ventaja en pruebas de SAB y nadie a 9 m te ataca con ventaja salvo que estés incapacitado."]],
        resources=[["Transformación", "pb", "largo", 1]]),
    _s("cambiante", "Cambiante (changeling)", MOTM, 55, "Mediano o Pequeño", 9, 0, [
        ("Tipo de criatura", "Feérico."),
        ("Instintos mutantes", "Competencia en dos de estas: Engaño, Interpretación, Intimidación, Perspicacia o Persuasión."),
        ("Cambiar de forma", "Como acción cambias tu aspecto y tu voz (también entre Mediano y Pequeño) hasta que vuelvas a tu forma real con otra acción. No copias a alguien que no hayas visto; tu equipo no cambia.")],
        skill_choice=["engano", "interpretacion", "intimidacion", "perspicacia", "persuasion"], skill_count=2),
    _s("duergar", "Duergar", MOTM, 56, "Mediano", 9, 36, [
        ("Tipo de criatura", "Humanoide; cuentas como enano."), DV36,
        ("Resistencia duergar", "Resistencia al veneno y ventaja contra el estado de envenenado."),
        ("Magia duergar", f"Agrandar/reducir (solo sobre ti) desde el nivel 3 e invisibilidad (solo sobre ti) desde el 5, cada uno 1 vez por descanso largo sin componentes materiales. {TAIL}"),
        ("Fortaleza psiónica", "Ventaja en las salvaciones contra ilusiones y contra quedar hechizado o paralizado.")],
        spells=[[3, "Agrandar/reducir", 1], [5, "Invisibilidad", 1]]),
    _s("eladrin", "Eladrín", MOTM, 57, "Mediano", 9, 18, [
        ("Tipo de criatura", "Humanoide; cuentas como elfo."), DV, FEY_ANCESTRY,
        ("Sentidos agudos", "Competencia en Percepción."), TRANCE,
        ("Paso feérico", "Acción adicional: te teletransportas 9 m a un sitio que veas. Usos: tu bonificador por competencia por descanso largo. Desde el nivel 3 suma el efecto de tu estación (CD 8 + competencia + INT, SAB o CAR).")],
        skills=["percepcion"],
        options_label="Estación",
        options=[["Otoño", "Tras teletransportarte, hasta dos criaturas a 3 m salvan SAB o quedan hechizadas 1 minuto (o hasta recibir daño)."],
                 ["Invierno", "Una criatura a 1,5 m antes de irte salva SAB o queda asustada hasta el final de tu siguiente turno."],
                 ["Primavera", "En vez de ti, teletransportas a una criatura voluntaria a 1,5 m a un sitio que veas a 9 m."],
                 ["Verano", "Tras teletransportarte, las criaturas que elijas a 1,5 m reciben fuego igual a tu bonificador por competencia."]],
        resources=[["Paso feérico", "pb", "largo", 1]]),
    _s("elfo_mar", "Elfo de mar", MOTM, 59, "Mediano", 9, 18, [
        ("Tipo de criatura", "Humanoide; cuentas como elfo."), DV, FEY_ANCESTRY,
        ("Sentidos agudos", "Competencia en Percepción."), TRANCE,
        ("Hijo del mar", "Velocidad nadando igual a tu velocidad, respiras aire y agua y tienes resistencia al frío."),
        ("Amigo del mar", "Comunicas ideas sencillas a cualquier bestia con velocidad nadando."),
        ("Entrenamiento de los elfos del mar", "Competencia con lanza, tridente, ballesta ligera y red.")],
        skills=["percepcion"]),
    _s("firbolg", "Firbolg", MOTM, 60, "Mediano", 9, 0, [
        ("Magia firbolg", "Lanzas detectar magia y disfrazarse (puedes parecer hasta 1 m más bajo), cada uno 1 vez por descanso corto o largo. INT, SAB o CAR como aptitud mágica."),
        ("Paso oculto", "Acción adicional: te vuelves invisible hasta el inicio de tu siguiente turno o hasta que ataques, hagas una tirada de daño u obligues a salvar. Usos: tu bonificador por competencia por descanso largo."),
        ("Complexión robusta", "Cuentas como una categoría mayor para la carga y para empujar, arrastrar o levantar."),
        ("Habla de las bestias y las hojas", "Te haces entender a grandes rasgos con bestias y plantas y tienes ventaja en las pruebas de CAR para influirlas.")],
        spells=[[1, "Detectar magia", 1, "corto"], [1, "Disfrazarse", 1, "corto"]], resources=[["Paso oculto", "pb", "largo", 1]]),
    _s("genasi", "Genasi", MOTM, 61, "Mediano o Pequeño", 9, 18, [
        ("Herencia elemental", "Desciendes de los genios: tu elemento te da resistencia, un don y magia (truco; conjuro de nivel 1 a nivel 3 y de nivel 2 a nivel 5, cada uno 1 vez por descanso largo). INT, SAB o CAR como aptitud mágica."), DV],
        options_label="Elemento",
        options=[["Aire", "Velocidad 10,5 m, resistencia al relámpago y aguantas la respiración sin límite. Agarre electrizante; caída de pluma y levitar."],
                 ["Agua", "Velocidad nadando igual a la tuya, respiras bajo el agua y resistencia al ácido. Salpicadura ácida; crear o destruir agua y caminar sobre el agua."],
                 ["Fuego", "Resistencia al fuego. Crear llama; manos ardientes y hoja de fuego."],
                 ["Tierra", "El terreno difícil no te frena al caminar. Guardia de cuchillas (también como acción adicional, tu bonificador por competencia por descanso largo); pasar sin rastro a nivel 5."]],
        lineage_speed={"Aire": 10.5},
        lineage_spells={"Aire": [[1, "Agarre electrizante"], [3, "Caída de pluma", 1], [5, "Levitar", 1]],
                        "Agua": [[1, "Salpicadura ácida"], [3, "Crear o destruir agua", 1], [5, "Caminar sobre el agua", 1]],
                        "Fuego": [[1, "Crear llama"], [3, "Manos ardientes", 1], [5, "Hoja de fuego", 1]],
                        "Tierra": [[1, "Guardia de cuchillas"], [5, "Pasar sin rastro", 1]]},
        lineage_resources={"Tierra": [["Guardia de cuchillas (acción adicional)", "pb", "largo", 1]]}),
    _s("githyanki", "Githyanki", MOTM, 63, "Mediano", 9, 0, [
        ("Saber astral", "Al terminar un descanso largo eliges una habilidad y un arma o herramienta en las que ganas competencia hasta el siguiente."),
        ("Resiliencia psíquica", "Resistencia al daño psíquico."),
        ("Psiónica githyanki", f"Mano de mago (la mano es invisible); salto desde el nivel 3 y paso brumoso desde el 5, cada uno 1 vez por descanso largo y sin componentes. {TAIL}")],
        spells=[[1, "Mano de mago"], [3, "Salto", 1], [5, "Paso brumoso", 1]]),
    _s("githzerai", "Githzerai", MOTM, 64, "Mediano", 9, 0, [
        ("Disciplina mental", "Ventaja en las salvaciones para evitar o terminar los estados de asustado y hechizado."),
        ("Resiliencia psíquica", "Resistencia al daño psíquico."),
        ("Psiónica githzerai", f"Mano de mago (invisible); escudo desde el nivel 3 y detectar pensamientos desde el 5, cada uno 1 vez por descanso largo y sin componentes. {TAIL}")],
        spells=[[1, "Mano de mago"], [3, "Escudo", 1], [5, "Detectar pensamientos", 1]]),
    _s("gnomo_profundidades", "Gnomo de las profundidades", MOTM, 65, "Pequeño", 9, 36, [
        ("Tipo de criatura", "Humanoide; cuentas como gnomo."), DV36,
        ("Resistencia gnoma a la magia", "Ventaja en las salvaciones de INT, SAB y CAR contra conjuros."),
        ("Camuflaje svirfneblin", "Te das ventaja en una prueba de Sigilo. Usos: tu bonificador por competencia por descanso largo."),
        ("Don svirfneblin", f"Disfrazarse desde el nivel 3 e indetectable desde el 5, cada uno 1 vez por descanso largo. {TAIL}")],
        spells=[[3, "Disfrazarse", 1], [5, "Indetectable", 1]], resources=[["Camuflaje svirfneblin", "pb", "largo", 1]]),
    _s("goblin", "Goblin", MOTM, 66, "Pequeño", 9, 18, [
        ("Tipo de criatura", "Humanoide; cuentas como goblinoide."), DV, FEY_ANCESTRY,
        ("Furia diminuta", "Al dañar a una criatura más grande que tú con un ataque o conjuro, le haces daño extra igual a tu bonificador por competencia (1 vez por turno). Usos: ese bonificador por descanso largo."),
        ("Escape ágil", "Destrabarte o Esconderte como acción adicional.")],
        resources=[["Furia diminuta", "pb", "largo", 1]]),
    _s("hada", "Hada", MOTM, 68, "Pequeño", 9, 0, [
        ("Tipo de criatura", "Feérico."),
        ("Vuelo", "Tus alas te dan velocidad volando igual a tu velocidad, si no llevas armadura media ni pesada."),
        ("Magia de las hadas", f"Saber druídico; fuego feérico desde el nivel 3 y agrandar/reducir desde el 5, cada uno 1 vez por descanso largo. {TAIL}")],
        spells=[[1, "Saber druídico"], [3, "Fuego feérico", 1], [5, "Agrandar/reducir", 1]]),
    _s("harengon", "Harengon", MOTM, 69, "Mediano o Pequeño", 9, 0, [
        ("Gatillo de liebre", "Sumas tu bonificador por competencia a la iniciativa."),
        ("Sentidos leporinos", "Competencia en Percepción."),
        ("Pata de la suerte", "Reacción al fallar una salvación de DES: sumas 1d4 (no si estás derribado o tu velocidad es 0)."),
        ("Salto de conejo", "Acción adicional: saltas tantos metros como 1,5 × tu bonificador por competencia sin provocar ataques de oportunidad. Usos: ese bonificador por descanso largo.")],
        skills=["percepcion"], resources=[["Salto de conejo", "pb", "largo", 1]]),
    _s("hobgoblin", "Hobgoblin", MOTM, 70, "Mediano", 9, 18, [
        ("Tipo de criatura", "Humanoide; cuentas como goblinoide."), DV, FEY_ANCESTRY,
        ("Fortuna de muchos", "Al fallar un ataque, una prueba o una salvación, sumas +1 por cada aliado que veas a 9 m (máximo +3). Usos: tu bonificador por competencia por descanso largo."),
        ("Don feérico", "Ayudar como acción adicional (usos: tu bonificador por competencia por descanso largo). Desde el nivel 3 añades hospitalidad (1d6 + competencia PG temporales a ambos), paso (+3 m de velocidad a ambos) o despecho (el objetivo de tu aliado tiene desventaja en su próximo ataque).")],
        resources=[["Fortuna de muchos", "pb", "largo", 1], ["Don feérico", "pb", "largo", 1]]),
    _s("kenku", "Kenku", MOTM, 71, "Mediano o Pequeño", 9, 0, [
        ("Falsificación experta", "Ventaja al copiar letra, artesanía y objetos ajenos."),
        ("Mimetismo", "Imitas sonidos y voces que hayas oído; detectarlo pide Perspicacia contra CD 8 + competencia + CAR."),
        ("Recuerdos de kenku", "Competencia en dos habilidades a tu elección y te das ventaja en una prueba de habilidad en la que seas competente. Usos: tu bonificador por competencia por descanso largo.")],
        skill_choice="any", skill_count=2, resources=[["Recuerdos de kenku", "pb", "largo", 1]]),
    _s("kobold", "Kobold", MOTM, 72, "Pequeño", 9, 18, [
        ("Tipo de criatura", "Humanoide de sangre dracónica."), DV,
        ("Grito dracónico", "Acción adicional: tus aliados y tú tenéis ventaja contra los enemigos a 3 m que te oigan hasta el inicio de tu siguiente turno. Usos: tu bonificador por competencia por descanso largo."),
        ("Legado kobold", "Elige un legado dracónico.")],
        options_label="Legado kobold",
        options=[["Astucia", "Competencia en Conocimiento arcano, Investigación, Juego de manos, Medicina o Supervivencia (apúntala en la ficha)."],
                 ["Desafío", "Ventaja en las salvaciones para evitar o terminar el estado de asustado."],
                 ["Hechicería dracónica", "Un truco de hechicero a tu elección (apúntalo en la ficha); INT, SAB o CAR como aptitud mágica."]],
        resources=[["Grito dracónico", "pb", "largo", 1]]),
    _s("hombre_lagarto", "Hombre lagarto", MOTM, 73, "Mediano", 9, 0, [
        ("Mordisco", "Ataques sin armas de 1d6 + FUE perforante."),
        ("Artesano astuto", "En un descanso corto, con huesos y piel de una criatura muerta, fabricas un escudo, un garrote, una jabalina o 1d4 dardos o agujas."),
        ("Aguantar la respiración", "Hasta 15 minutos; velocidad nadando igual a tu velocidad."),
        ("Intuición natural", "Competencia en dos de estas: Medicina, Naturaleza, Percepción, Sigilo, Supervivencia o Trato con animales."),
        ("Armadura natural", "Sin armadura, tu CA es 13 + DES (puedes usar escudo)."),
        ("Mandíbulas hambrientas", "Acción adicional: un mordisco que, si acierta, te da PG temporales iguales a tu bonificador por competencia. Usos: ese bonificador por descanso largo.")],
        skill_choice=["medicina", "naturaleza", "percepcion", "sigilo", "supervivencia", "trato_animales"], skill_count=2,
        natural_ac=13, attacks=[_claws("Mordisco", "perforante")], resources=[["Mandíbulas hambrientas", "pb", "largo", 1]]),
    _s("minotauro", "Minotauro", MOTM, 74, "Mediano", 9, 0, [
        ("Cuernos", "Ataques sin armas de 1d6 + FUE perforante."),
        ("Embestida", "Tras Correr y moverte 6 m, atacas con los cuernos como acción adicional."),
        ("Cuernos de empuje", "Tras acertar un ataque cuerpo a cuerpo de la acción de Ataque, acción adicional para empujar 3 m a una criatura no más de una categoría mayor (salvación de FUE, CD 8 + competencia + FUE)."),
        ("Recuerdos del laberinto", "Siempre sabes dónde está el norte y tienes ventaja en Supervivencia para orientarte o rastrear.")],
        attacks=[_claws("Cuernos", "perforante")]),
    _s("satiro", "Sátiro", MOTM, 76, "Mediano", 10.5, 0, [
        ("Tipo de criatura", "Feérico."),
        ("Embestida de carnero", "Ataques sin armas de 1d6 + FUE contundente con la cabeza y los cuernos."),
        ("Resistencia mágica", "Ventaja en las salvaciones contra conjuros."),
        ("Saltos alegres", "En cada salto sumas 1d8 × 30 cm a la distancia."),
        ("Juerguista", "Competencia en Interpretación, Persuasión y un instrumento musical.")],
        skills=["interpretacion", "persuasion"], tool="Un instrumento musical", attacks=[_claws("Cornada", "contundente")]),
    _s("shadar_kai", "Shadar-kai", MOTM, 77, "Mediano", 9, 18, [
        ("Tipo de criatura", "Humanoide; cuentas como elfo."), DV,
        ("Resistencia necrótica", "Resistencia al daño necrótico."),
        ("Bendición de la Reina Cuervo", "Acción adicional: te teletransportas 9 m a un sitio que veas (usos: tu bonificador por competencia por descanso largo). Desde el nivel 3, hasta el inicio de tu siguiente turno tienes resistencia a todo el daño."),
        ("Sentidos agudos", "Competencia en Percepción."), TRANCE],
        skills=["percepcion"], resources=[["Bendición de la Reina Cuervo", "pb", "largo", 1]]),
    _s("tabaxi", "Tabaxi", MOTM, 78, "Mediano o Pequeño", 9, 18, [
        DV, ("Agilidad felina", "En tu turno puedes duplicar tu velocidad; para repetirlo, antes tienes que pasar un turno sin moverte."),
        ("Garras de gato", "Velocidad trepando igual a tu velocidad y ataques sin armas de 1d6 + FUE cortante."),
        ("Talento felino", "Competencia en Percepción y Sigilo.")],
        skills=["percepcion", "sigilo"], attacks=[_claws("Garras", "cortante")]),
    _s("tortuga", "Tortuga (tortle)", MOTM, 79, "Mediano o Pequeño", 9, 0, [
        ("Garras", "Ataques sin armas de 1d6 + FUE cortante."),
        ("Aguantar la respiración", "Hasta 1 hora."),
        ("Armadura natural", "Tu caparazón te da CA 17 (la DES no cuenta); la armadura no te sirve, el escudo sí."),
        ("Caparazón defensivo", "Como acción te metes en el caparazón: +4 a la CA y ventaja en salvaciones de FUE y CON, pero derribado, velocidad 0, desventaja en DES y sin reacciones; sales con una acción adicional."),
        ("Instinto de supervivencia", "Competencia en Medicina, Naturaleza, Percepción, Sigilo, Supervivencia o Trato con animales.")],
        skill_choice=["medicina", "naturaleza", "percepcion", "sigilo", "supervivencia", "trato_animales"],
        natural_ac=17, natural_ac_flat=True, attacks=[_claws("Garras", "cortante")]),
    _s("triton", "Tritón", MOTM, 80, "Mediano", 9, 18, [
        DV, ("Anfibio", "Respiras aire y agua; velocidad nadando igual a tu velocidad."),
        ("Control del aire y del agua", f"Nube de oscurecimiento; ráfaga de viento desde el nivel 3 y caminar sobre el agua desde el 5; cada uno 1 vez por descanso largo. {TAIL}"),
        ("Emisario del mar", "Comunicas ideas sencillas a bestias, elementales y monstruosidades con velocidad nadando."),
        ("Guardián de las profundidades", "Resistencia al frío.")],
        spells=[[1, "Nube de oscurecimiento", 1], [3, "Ráfaga de viento", 1], [5, "Caminar sobre el agua", 1]]),
    _s("yuan_ti", "Yuan-ti", MOTM, 81, "Mediano o Pequeño", 9, 18, [
        DV, ("Conjuros serpentinos", f"Rociada venenosa; encantar animal a voluntad (solo serpientes); sugestión desde el nivel 3, 1 vez por descanso largo. {TAIL}"),
        ("Resistencia mágica", "Ventaja en las salvaciones contra conjuros."),
        ("Resiliencia al veneno", "Resistencia al veneno y ventaja contra el estado de envenenado.")],
        spells=[[1, "Rociada venenosa"], [1, "Encantar animal"], [3, "Sugestión", 1]]),

    # --- otros libros: versiones antiguas adaptadas a 2024 (sin aumentos de característica)
    _s("buhonido", "Búhonido (owlin)", "Strixhaven", 35, "Mediano o Pequeño", 9, 36, [
        ("Tipo de criatura", "Humanoide emparentado con los búhos gigantes del Feywild."),
        ("Vuelo", "Velocidad volando igual a tu velocidad, si no llevas armadura media ni pesada."),
        ("Plumas silenciosas", "Competencia en Sigilo."), DV36],
        group=OTHERS, skills=["sigilo"]),
    _s("grung", "Grung", "One Grung Above", 26, "Pequeño", 7.5, 0, [
        ("Anfibio", "Respiras aire y agua; velocidad trepando 7,5 m."),
        ("Vigilancia arbórea", "Competencia en Percepción."),
        ("Inmunidad al veneno", "Inmune al daño de veneno y al estado de envenenado."),
        ("Piel venenosa", "Quien te agarre o toque tu piel salva CON (CD 12) o queda envenenado 1 minuto. Untado en un arma perforante: el objetivo salva CON (CD 12) o recibe 2d4 de veneno."),
        ("Salto de rana", "Salto de longitud de 7,5 m y de altura de 4,5 m, con o sin carrerilla."),
        ("Dependencia del agua", "Si no pasas 1 hora sumergido al día, ganas 1 nivel de cansancio que solo quita la magia o otra hora en el agua.")],
        group=OTHERS, skills=["percepcion"]),
    _s("locathah", "Locathah", "Locathah Rising", 43, "Mediano", 9, 0, [
        ("Armadura natural", "Sin armadura, tu CA es 12 + DES (puedes usar escudo)."),
        ("Observador y atlético", "Competencia en Atletismo y Percepción; velocidad nadando 9 m."),
        ("Voluntad del leviatán", "Ventaja en las salvaciones contra quedar hechizado, asustado, paralizado, envenenado, aturdido o dormido."),
        ("Anfibio limitado", "Respiras aire y agua, pero tienes que sumergirte al menos cada 4 horas.")],
        group=OTHERS, skills=["atletismo", "percepcion"], natural_ac=12),
    _s("verdan", "Verdan", "Acquisitions Incorporated", 47, "Mediano", 9, 0, [
        ("Curación de sangre negra", "Al tirar dados de golpe, repites los 1 y los 2."),
        ("Telepatía limitada", "Hablas telepáticamente con criaturas a 9 m que sepan algún idioma (solo ideas sencillas)."),
        ("Persuasivo", "Competencia en Persuasión."),
        ("Perspicacia telepática", "Ventaja en las salvaciones de SAB y CAR.")],
        group=OTHERS, skills=["persuasion"]),
    _s("semielfo", "Semielfo", "Manual del Jugador 2014", 19, "Mediano", 9, 18, [
        DV, ("Ascendencia feérica", "Ventaja contra quedar hechizado y la magia no puede dormirte."),
        ("Versatilidad", "Competencia en dos habilidades a tu elección.")],
        group=OTHERS, skill_choice="any", skill_count=2),
    _s("semiorco", "Semiorco", "Manual del Jugador 2014", 21, "Mediano", 9, 18, [
        DV, ("Aguante incansable", "Si caes a 0 PG sin morir, te quedas a 1 PG (1 vez por descanso largo)."),
        ("Ataques salvajes", "Al hacer un crítico cuerpo a cuerpo con un arma, tiras un dado de daño del arma más."),
        ("Amenazador", "Competencia en Intimidación.")],
        group=OTHERS, skills=["intimidacion"], resources=[["Aguante incansable", 1, "largo", 1]]),
    _s("leonido", "Leónido", "Theros", 83, "Mediano", 10.5, 18, [
        DV, ("Garras", "Ataques sin armas de 1d4 + FUE cortante."),
        ("Instintos de cazador", "Competencia en Atletismo, Intimidación, Percepción o Supervivencia."),
        ("Rugido aterrador", "Acción adicional: las criaturas que elijas a 3 m que te oigan salvan SAB (CD 8 + competencia + CON) o quedan asustadas hasta el final de tu siguiente turno. 1 vez por descanso corto o largo.")],
        group=OTHERS, skill_choice=["atletismo", "intimidacion", "percepcion", "supervivencia"],
        attacks=[_claws("Garras", "cortante", "1d4")], resources=[["Rugido aterrador", 1, "corto", 1]]),
    _s("loxodon", "Loxodon", "Ravnica", 86, "Mediano", 9, 0, [
        BIG, ("Serenidad loxodon", "Ventaja en las salvaciones contra quedar hechizado o asustado."),
        ("Armadura natural", "Sin armadura, tu CA es 12 + CON (puedes usar escudo)."),
        ("Trompa", "Agarra, levanta (5 × FUE en libras), abre puertas o sirve de esnórquel; alcance 1,5 m. No empuña armas ni hace tareas finas."),
        ("Olfato agudo", "Ventaja en Percepción, Supervivencia e Investigación que dependan del olfato.")],
        group=OTHERS, natural_ac=12, natural_ac_ability="con"),
    _s("hibrido_simic", "Híbrido simic", "Ravnica", 88, "Mediano", 9, 18, [
        DV, ("Mejoras animales", "Eliges una mejora a nivel 1 y otra a nivel 5: apéndices de agarre (ataque sin armas 1d6 + FUE y agarrar como acción adicional), caparazón (+1 a la CA sin armadura pesada) o escupitajo ácido (acción, 9 m, salvación de DES contra CD 8 + competencia + CON, 2d10 de ácido; sube a 3d10 y 4d10 en los niveles 11 y 17; usos: tu modificador por CON por descanso largo).")],
        group=OTHERS, options_label="Mejora animal (nivel 1)",
        options=[["Aletas planeadoras", "Al caer restas hasta 30 m de caída y avanzas 60 cm en horizontal por cada 30 cm que caes."],
                 ["Trepador ágil", "Velocidad trepando igual a tu velocidad."],
                 ["Adaptación subacuática", "Respiras aire y agua y tienes velocidad nadando igual a tu velocidad."]]),
    _s("vedalken", "Vedalken", "Ravnica", 89, "Mediano", 9, 0, [
        ("Desapasionado", "Ventaja en las salvaciones de INT, SAB y CAR."),
        ("Precisión incansable", "Competencia en Conocimiento arcano, Historia, Interpretación, Investigación, Juego de manos o Medicina y en una herramienta; con ellas sumas 1d4 a las pruebas."),
        ("Parcialmente anfibio", "Respiras bajo el agua hasta 1 hora (1 vez por descanso largo).")],
        group=OTHERS, skill_choice=["arcanos", "historia", "interpretacion", "investigacion", "juego_manos", "medicina"],
        tool="Una herramienta a tu elección"),
    _s("dhampiro", "Dhampiro", "Ravenloft", 90, "Mediano o Pequeño", 10.5, 18, [
        ("Legado ancestral", "Competencia en dos habilidades a tu elección."), DV,
        ("Naturaleza inmortal", "No necesitas respirar."),
        ("Trepar como una araña", "Velocidad trepando igual a tu velocidad; desde el nivel 3 caminas por paredes y techos con las manos libres."),
        ("Mordedura vampírica", "Arma natural: 1d4 + CON perforante (ventaja si te falta la mitad de los PG o más). Al morder a una criatura viva puedes curarte lo infligido o sumarlo a tu siguiente prueba o ataque. Usos de ese refuerzo: tu bonificador por competencia por descanso largo.")],
        group=OTHERS, skill_choice="any", skill_count=2,
        attacks=[{"name": "Mordedura vampírica", "ability": "con", "damage": "1d4", "notes": "perforante · ventaja con la mitad de los PG o menos"}],
        resources=[["Mordedura vampírica (refuerzo)", "pb", "largo", 1]]),
    _s("sangre_maldita", "Sangre maldita (hexblood)", "Ravenloft", 92, "Mediano o Pequeño", 9, 18, [
        ("Tipo de criatura", "Feérico."), ("Legado ancestral", "Competencia en dos habilidades a tu elección."), DV,
        ("Prenda espeluznante", "Acción adicional: te quitas un mechón, una uña o un diente que queda imbuido hasta tu siguiente descanso largo: a 15 km o menos puedes mandar un mensaje telepático a quien lo lleve o ver y oír a través de él 1 minuto. 1 vez por descanso largo."),
        ("Magia maldita", "Disfrazarse y maleficio, cada uno 1 vez por descanso largo (y con espacios). INT, SAB o CAR como aptitud mágica.")],
        group=OTHERS, skill_choice="any", skill_count=2,
        spells=[[1, "Disfrazarse", 1], [1, "Maleficio", 1]], resources=[["Prenda espeluznante", 1, "largo", 1]]),
    _s("renacido", "Renacido", "Ravenloft", 94, "Mediano o Pequeño", 9, 0, [
        ("Legado ancestral", "Competencia en dos habilidades a tu elección."),
        ("Naturaleza no muerta", "Resistencia al veneno, ventaja contra enfermedades, envenenado y en las salvaciones contra muerte; no comes, ni bebes, ni respiras, ni duermes (la magia no puede dormirte) y descansas en 4 horas consciente."),
        ("Conocimientos de una vida pasada", "Tras ver el d20 de una prueba de habilidad, sumas 1d6. Usos: tu bonificador por competencia por descanso largo.")],
        group=OTHERS, skill_choice="any", skill_count=2, resources=[["Conocimientos de una vida pasada", "pb", "largo", 1]]),
]
