"""Magia que la ficha se apunta sola según el Manual del Jugador 2024: conjuros siempre preparados de clases y
subclases, usos gratis y recursos de las subclases, los lanzadores de un tercio (Caballero arcano y Embaucador
arcano), lo que dan las dotes y las cargas de los objetos mágicos. Todo con los nombres de spells2024.json."""
import re

# Conjuros siempre preparados que da la propia clase: [nivel de clase, [conjuros]]
CLASS_SPELLS = {
    "druida": [[1, ["Hablar con los animales"]]],           # Druídico
    "explorador": [[1, ["Marca del cazador"]]],             # Enemigo predilecto
    "paladin": [[2, ["Castigo divino"]], [5, ["Hallar corcel"]]],  # Castigo de paladín, Corcel fiel
}

# Conjuros siempre preparados de cada subclase: [nivel de clase, [conjuros]]. No cuentan para el máximo.
SUBCLASS_SPELLS = {
    # bardo
    "Colegio del glamour": [[3, ["Hechizar persona", "Imagen múltiple"]], [6, ["Orden imperiosa"]]],
    # bárbaro (Portavoz de los animales y Hablante de la naturaleza: solo como rituales)
    "Senda del corazón salvaje": [[3, ["Hablar con los animales", "Sentidos de la bestia"]], [10, ["Comunión con la naturaleza"]]],
    # brujo
    "Patrón celestial": [[3, ["Auxilio", "Curar heridas", "Saeta guía", "Restablecimiento menor", "Luz", "Llama sagrada"]],
                         [5, ["Luz del día", "Revivir"]], [7, ["Guardián de la fe", "Muro de fuego"]],
                         [9, ["Restablecimiento mayor", "Invocar celestial"]]],
    "Patrón feérico": [[3, ["Calmar emociones", "Fuego feérico", "Paso brumoso", "Fuerza fantasmal", "Dormir"]],
                       [5, ["Desplazamiento", "Crecimiento vegetal"]], [7, ["Dominar bestia", "Invisibilidad mejorada"]],
                       [9, ["Dominar persona", "Apariencia"]]],
    "Patrón infernal": [[3, ["Manos ardientes", "Orden imperiosa", "Rayo abrasador", "Sugestión"]],
                        [5, ["Bola de fuego", "Nube apestosa"]], [7, ["Escudo de fuego", "Muro de fuego"]],
                        [9, ["Geas", "Plaga de insectos"]]],
    "Patrón primigenio": [[3, ["Detectar pensamientos", "Susurros discordantes", "Fuerza fantasmal", "Risa horrible de Tasha"]],
                          [5, ["Clarividencia", "Hambre de Hadar"]], [7, ["Confusión", "Invocar aberración"]],
                          [9, ["Alterar los recuerdos", "Telequinesis"]], [10, ["Maleficio"]]],
    # clérigo
    "Dominio de la guerra": [[3, ["Saeta guía", "Arma mágica", "Escudo de fe", "Arma espiritual"]],
                             [5, ["Manto del cruzado", "Espíritus guardianes"]], [7, ["Escudo de fuego", "Libertad de movimiento"]],
                             [9, ["Inmovilizar monstruo", "Golpe de viento acerado"]]],
    "Dominio de la luz": [[3, ["Manos ardientes", "Fuego feérico", "Rayo abrasador", "Ver invisibilidad"]],
                          [5, ["Luz del día", "Bola de fuego"]], [7, ["Ojo arcano", "Muro de fuego"]],
                          [9, ["Golpe flamígero", "Escudriñar"]]],
    "Dominio de la vida": [[3, ["Auxilio", "Bendición", "Curar heridas", "Restablecimiento menor"]],
                           [5, ["Palabra de curación en masa", "Revivir"]], [7, ["Aura de vida", "Guarda contra la muerte"]],
                           [9, ["Restablecimiento mayor", "Curar heridas en masa"]]],
    "Dominio del engaño": [[3, ["Hechizar persona", "Disfrazarse", "Invisibilidad", "Pasar sin rastro"]],
                           [5, ["Patrón hipnótico", "Indetectable"]], [7, ["Confusión", "Puerta dimensional"]],
                           [9, ["Dominar persona", "Alterar los recuerdos"]]],
    # druida (el Círculo de la tierra va por terreno: LAND_SPELLS)
    "Círculo de la luna": [[3, ["Curar heridas", "Rayo de luna", "Voluta estelar"]], [5, ["Conjurar animales"]],
                           [7, ["Fuente de luz lunar"]], [9, ["Curar heridas en masa"]]],
    "Círculo del mar": [[3, ["Nube de oscurecimiento", "Ráfaga de viento", "Rayo de escarcha", "Hacer añicos", "Ola atronadora"]],
                        [5, ["Relámpago", "Respirar bajo el agua"]], [7, ["Controlar agua", "Tormenta de hielo"]],
                        [9, ["Conjurar elemental", "Inmovilizar monstruo"]]],
    "Círculo de las estrellas": [[3, ["Guía", "Saeta guía"]]],
    # explorador
    "Acechador en la penumbra": [[3, ["Disfrazarse"]], [5, ["Truco de la cuerda"]], [9, ["Terror"]],
                                 [13, ["Invisibilidad mejorada"]], [17, ["Apariencia"]]],
    "Errante feérico": [[3, ["Hechizar persona"]], [5, ["Paso brumoso"]], [9, ["Invocar feérico"]],
                        [13, ["Puerta dimensional"]], [17, ["Engañar"]]],
    # guerrero y pícaro
    "Guerrero psiónico": [[18, ["Telequinesis"]]],
    "Embaucador arcano": [[3, ["Mano de mago"]]],
    # hechicero
    "Hechicería aberrante": [[3, ["Brazos de Hadar", "Calmar emociones", "Detectar pensamientos", "Susurros discordantes", "Fragmento mental"]],
                             [5, ["Hambre de Hadar", "Recado"]], [7, ["Tentáculos negros de Evard", "Invocar aberración"]],
                             [9, ["Enlace telepático de Rary", "Telequinesis"]]],
    "Hechicería dracónica": [[3, ["Alterar el propio aspecto", "Orbe cromático", "Orden imperiosa", "Aliento de dragón"]],
                             [5, ["Terror", "Volar"]], [7, ["Ojo arcano", "Hechizar monstruo"]],
                             [9, ["Conocer las leyendas", "Invocar dragón"]]],
    "Hechicería mecánica": [[3, ["Auxilio", "Alarma", "Restablecimiento menor", "Protección contra el bien y el mal"]],
                            [5, ["Disipar magia", "Protección contra energía"]], [7, ["Libertad de movimiento", "Invocar autómata"]],
                            [9, ["Restablecimiento mayor", "Muro de fuerza"]]],
    # mago
    "Abjurador": [[10, ["Contrahechizo", "Disipar magia"]]],
    "Ilusionista": [[3, ["Ilusión menor"]], [6, ["Invocar bestia", "Invocar feérico"]]],
    # monje (la oscuridad de Artes sombrías cuesta 1 punto de concentración)
    "Guerrero de la sombra": [[3, ["Ilusión menor", "Oscuridad"]]],
    "Guerrero de los elementos": [[3, ["Elementalismo"]]],
    # paladín
    "Juramento de entrega": [[3, ["Protección contra el bien y el mal", "Escudo de fe"]], [5, ["Auxilio", "Zona de la verdad"]],
                             [9, ["Señal de esperanza", "Disipar magia"]], [13, ["Libertad de movimiento", "Guardián de la fe"]],
                             [17, ["Comunión", "Golpe flamígero"]]],
    "Juramento de gloria": [[3, ["Saeta guía", "Heroísmo"]], [5, ["Potenciar característica", "Arma mágica"]],
                            [9, ["Acelerar", "Protección contra energía"]], [13, ["Compulsión", "Libertad de movimiento"]],
                            [17, ["Conocer las leyendas", "Presencia regia de Yolande"]]],
    "Juramento de los antiguos": [[3, ["Golpe apresador", "Hablar con los animales"]], [5, ["Paso brumoso", "Rayo de luna"]],
                                  [9, ["Crecimiento vegetal", "Protección contra energía"]], [13, ["Tormenta de hielo", "Piel pétrea"]],
                                  [17, ["Comunión con la naturaleza", "Paso arbóreo"]]],
    "Juramento de venganza": [[3, ["Perdición", "Marca del cazador"]], [5, ["Inmovilizar persona", "Paso brumoso"]],
                              [9, ["Acelerar", "Protección contra energía"]], [13, ["Destierro", "Puerta dimensional"]],
                              [17, ["Inmovilizar monstruo", "Escudriñar"]]],
    # del MCT con el texto en otro formato (el resto se lee de su rasgo con mct_spells)
    "Círculo de las esporas": [[3, ["Toque helado", "Sordera/ceguera", "Rayo nauseabundo"]], [5, ["Animar a los muertos", "Nube apestosa"]],
                               [7, ["Marchitar", "Confusión"]], [9, ["Nube aniquiladora", "Contagio"]]],
    "Círculo del fuego salvaje": [[3, ["Manos ardientes", "Curar heridas", "Esfera de llamas", "Rayo abrasador"]],
                                  [5, ["Crecimiento vegetal", "Revivir"]], [7, ["Aura de vida", "Escudo de fuego"]],
                                  [9, ["Golpe flamígero", "Curar heridas en masa"]]],
    "Patrón genio": [[3, ["Detectar el bien y el mal", "Fuerza fantasmal"]], [5, ["Crear comida y agua"]], [7, ["Asesino fantasmal"]],
                     [9, ["Creación"]], [17, ["Deseo"]]],
}

# Círculo de la tierra: tras cada descanso largo eliges terreno y tienes preparados sus conjuros
LAND_SPELLS = {
    "Árido": [[3, ["Contorno borroso", "Manos ardientes", "Descarga de fuego"]], [5, ["Bola de fuego"]], [7, ["Marchitar"]], [9, ["Muro de piedra"]]],
    "Polar": [[3, ["Nube de oscurecimiento", "Inmovilizar persona", "Rayo de escarcha"]], [5, ["Tormenta de aguanieve"]], [7, ["Tormenta de hielo"]], [9, ["Cono de frío"]]],
    "Templado": [[3, ["Paso brumoso", "Agarre electrizante", "Dormir"]], [5, ["Relámpago"]], [7, ["Libertad de movimiento"]], [9, ["Paso arbóreo"]]],
    "Tropical": [[3, ["Salpicadura ácida", "Rayo nauseabundo", "Telaraña"]], [5, ["Nube apestosa"]], [7, ["Polimorfar"]], [9, ["Plaga de insectos"]]],
}

# Conjuros que la subclase deja elegir de otras listas: [nivel, cuántos, listas]
SUBCLASS_PICKS = {
    "Colegio del conocimiento": [[6, 2, ["Clérigo", "Druida", "Mago"], "Descubrimientos mágicos"]],
}
# Listas que se suman a la de la clase (Secretos mágicos del bardo): [nivel, listas]
CLASS_EXTRA_LISTS = {"bardo": [10, ["Clérigo", "Druida", "Mago"]]}

# Lanzadores de un tercio: espacios por nivel de clase (MdJ p. 117 y p. 179)
THIRD_SLOTS = [[], [], [2], [3], [3], [3], [4, 2], [4, 2], [4, 2], [4, 3], [4, 3], [4, 3], [4, 3, 2], [4, 3, 2], [4, 3, 2],
               [4, 3, 3], [4, 3, 3], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 1]]
_THIRD_PREP = [0, 0, 3, 4, 4, 4, 5, 6, 6, 7, 8, 8, 9, 10, 10, 11, 11, 11, 12, 13]
SUBCLASS_CASTING = {
    "Caballero arcano": {"caster": "third", "spell_ability": "int", "spell_list": "Mago",
                         "cantrips": [0, 0] + [2] * 7 + [3] * 11, "prepared": _THIRD_PREP},
    # mano de mago va aparte (siempre preparada): estos son los otros trucos
    "Embaucador arcano": {"caster": "third", "spell_ability": "int", "spell_list": "Mago",
                          "cantrips": [0, 0] + [2] * 7 + [3] * 11, "prepared": _THIRD_PREP},
}

# Recursos de clase que faltaban (mismo formato que "resources" de cada clase)
CLASS_RESOURCES = {
    "brujo": [{"name": f"Arcanum místico (nivel {n})", "uses": 1, "reset": "largo", "from": lvl}
              for n, lvl in ((6, 11), (7, 13), (8, 15), (9, 17))],
    "mago": [{"name": "Conjuros característicos (gratis)", "uses": 2, "reset": "corto", "from": 20}],
}

# Recursos de las subclases. "uses": número, "pb", "mod:x", "level+1" o {nivel: usos}. Los que dicen «gratis» y
# el nombre de un conjuro se gastan desde el botón de ese conjuro.
_DICE = {3: 4, 5: 6, 9: 8, 13: 10, 17: 12}
SUBCLASS_RESOURCES = {
    "Senda del berserker": [{"name": "Presencia intimidante", "uses": 1, "reset": "largo", "from": 14}],
    "Senda del fanático": [{"name": "Guerrero de los dioses (d12)", "uses": {3: 4, 6: 5, 12: 6, 17: 7}, "reset": "largo"},
                           {"name": "Presencia ferviente", "uses": 1, "reset": "largo", "from": 10},
                           {"name": "Furia de los dioses", "uses": 1, "reset": "largo", "from": 14}],
    "Colegio del glamour": [{"name": "Magia cautivadora", "uses": 1, "reset": "largo"},
                            {"name": "Manto de majestad", "uses": 1, "reset": "largo", "from": 6}],
    "Patrón celestial": [{"name": "Luz sanadora (d6)", "uses": "level+1", "reset": "largo"},
                         {"name": "Venganza ardiente", "uses": 1, "reset": "largo", "from": 14}],
    "Patrón feérico": [{"name": "Pasos feéricos (paso brumoso gratis)", "uses": "mod:car", "reset": "largo"}],
    "Patrón infernal": [{"name": "La suerte del oscuro", "uses": "mod:car", "reset": "largo", "from": 6},
                        {"name": "Arrastrar por el infierno", "uses": 1, "reset": "largo", "from": 14}],
    "Patrón primigenio": [{"name": "Combatiente clarividente", "uses": 1, "reset": "corto", "from": 6}],
    "Dominio de la guerra": [{"name": "Sacerdote guerrero", "uses": "mod:sab", "reset": "corto"}],
    "Dominio de la luz": [{"name": "Fulgor protector", "uses": "mod:sab", "reset": "largo", "reset_from": {6: "corto"}},
                          {"name": "Halo de luz", "uses": "mod:sab", "reset": "largo", "from": 17}],
    "Círculo de la luna": [{"name": "Paso de la luz lunar", "uses": "mod:sab", "reset": "largo", "from": 10}],
    "Círculo de la tierra": [{"name": "Recuperación natural (conjuro de círculo gratis)", "uses": 1, "reset": "largo", "from": 6}],
    "Círculo de las estrellas": [{"name": "Mapa estelar (saeta guía gratis)", "uses": "mod:sab", "reset": "largo"},
                                 {"name": "Presagio cósmico", "uses": "mod:sab", "reset": "largo", "from": 6}],
    "Acechador en la penumbra": [{"name": "Golpe pavoroso", "uses": "mod:sab", "reset": "largo"}],
    "Errante feérico": [{"name": "Refuerzos feéricos (invocar feérico gratis)", "uses": 1, "reset": "largo", "from": 11},
                        {"name": "Errante brumoso (paso brumoso gratis)", "uses": "mod:sab", "reset": "largo", "from": 15}],
    "Maestro del combate": [{"name": "Dados de supremacía", "uses": {3: 4, 7: 5, 15: 6}, "reset": "corto"},
                            {"name": "Conoce a tu enemigo", "uses": 1, "reset": "largo", "from": 7}],
    "Guerrero psiónico": [{"name": "Dados de energía psiónica", "uses": _DICE, "reset": "corto1"},
                          {"name": "Bastión de fuerza", "uses": 1, "reset": "largo", "from": 15},
                          {"name": "Maestro telequinético (telequinesis gratis)", "uses": 1, "reset": "largo", "from": 18}],
    "Hechicería de magia salvaje": [{"name": "Mareas del caos", "uses": 1, "reset": "largo"},
                                    {"name": "Sobrecarga domada", "uses": 1, "reset": "largo", "from": 18}],
    "Hechicería dracónica": [{"name": "Alas de dragón", "uses": 1, "reset": "largo", "from": 14},
                             {"name": "Compañero dragón (invocar dragón gratis)", "uses": 1, "reset": "largo", "from": 18}],
    "Hechicería mecánica": [{"name": "Restablecer equilibrio", "uses": "mod:car", "reset": "largo"},
                            {"name": "Trance de orden", "uses": 1, "reset": "largo", "from": 14},
                            {"name": "Cabalgata mecánica", "uses": 1, "reset": "largo", "from": 18}],
    "Hechicería aberrante": [{"name": "Implosión deformadora", "uses": 1, "reset": "largo", "from": 18}],
    "Adivino": [{"name": "Presagio (d20 guardados)", "uses": {3: 2, 14: 3}, "reset": "largo"}],
    "Ilusionista": [{"name": "Criaturas fantasmales (invocar bestia gratis)", "uses": 1, "reset": "largo", "from": 6},
                    {"name": "Criaturas fantasmales (invocar feérico gratis)", "uses": 1, "reset": "largo", "from": 6},
                    {"name": "Yo ilusorio", "uses": 1, "reset": "corto", "from": 10}],
    "Guerrero de la mano abierta": [{"name": "Plenitud de cuerpo", "uses": "mod:sab", "reset": "largo", "from": 6}],
    "Guerrero de la misericordia": [{"name": "Ráfaga de curación y aflicción", "uses": "mod:sab", "reset": "largo", "from": 11},
                                    {"name": "Mano de misericordia suprema", "uses": 1, "reset": "largo", "from": 17}],
    "Juramento de entrega": [{"name": "Halo sagrado", "uses": 1, "reset": "largo", "from": 20}],
    "Juramento de gloria": [{"name": "Defensa gloriosa", "uses": "mod:car", "reset": "largo", "from": 15},
                            {"name": "Leyenda viviente", "uses": 1, "reset": "largo", "from": 20}],
    "Juramento de los antiguos": [{"name": "Centinela imperecedero", "uses": 1, "reset": "largo", "from": 15},
                                  {"name": "Campeón ancestral", "uses": 1, "reset": "largo", "from": 20}],
    "Juramento de venganza": [{"name": "Ángel vengador", "uses": 1, "reset": "largo", "from": 20}],
    "Embaucador arcano": [{"name": "Ladrón de conjuros", "uses": 1, "reset": "largo", "from": 17}],
    "Rebanaalmas": [{"name": "Dados de energía psiónica", "uses": _DICE, "reset": "corto1"},
                    {"name": "Velo psíquico", "uses": 1, "reset": "largo", "from": 13},
                    {"name": "Desgarro mental", "uses": 1, "reset": "largo", "from": 17}],
}

# Lo que dan las dotes (por el principio del nombre: «Iniciado en la magia (clérigo)» usa «Iniciado en la magia»).
#   spells: [conjuro, usos gratis por descanso largo]; picks: conjuros a elegir; resources: [nombre, usos, recuperación]
#   speed (m) y hp se suman a la ficha. "lists": "paren" = la lista que dice el paréntesis de la dote.
FEAT_GRANTS = {
    "Iniciado en la magia": {"picks": [{"label": "Trucos", "level": 0, "count": 2, "lists": "paren"},
                                       {"label": "Conjuro de nivel 1", "level": 1, "count": 1, "lists": "paren", "free": 1}]},
    "Influencia feérica": {"spells": [["Paso brumoso", 1]],
                           "picks": [{"label": "Conjuro de nivel 1 de adivinación o encantamiento", "level": 1, "count": 1,
                                      "schools": ["Adivinación", "Encantamiento"], "free": 1}]},
    "Influencia sombría": {"spells": [["Invisibilidad", 1]],
                           "picks": [{"label": "Conjuro de nivel 1 de ilusionismo o nigromancia", "level": 1, "count": 1,
                                      "schools": ["Ilusionismo", "Nigromancia"], "free": 1}]},
    "Telepático": {"spells": [["Detectar pensamientos", 1]]},
    "Telequinético": {"spells": [["Mano de mago", 0]]},
    "Lanzador ritual": {"picks": [{"label": "Rituales de nivel 1", "level": 1, "count": "pb", "ritual": True}],
                        "resources": [["Ritual rápido", 1, "largo"]]},
    "Afortunado": {"resources": [["Puntos de suerte", "pb", "largo"]]},
    "Chef": {"resources": [["Golosinas del chef", "pb", "largo"]]},
    "Azote de magos": {"resources": [["Mente protegida", 1, "corto"]]},
    "Don del recuerdo de conjuros": {"resources": [["Recuerdo de conjuros", 1, "largo"]]},
    "Don de la recuperación": {"resources": [["Último aliento", 1, "largo"], ["Dados de recuperación (d10)", 10, "largo"]]},
    "Don del destino": {"resources": [["Mejorar el destino", 1, "corto"]]},
    "Veloz": {"speed": 3},
    "Don de la velocidad": {"speed": 9},
    "Don de la fortaleza": {"hp": 40},
}

# Objetos mágicos con cargas: (cargas, las que recupera al amanecer; "" = no se recargan, "todas" = todas)
ITEM_CHARGES = {
    "Anillo de estrellas fugaces": (6, "1d6"), "Anillo de evasión": (3, "1d3"), "Anillo de influencia animal": (3, "1d3"),
    "Anillo de los tres deseos": (3, ""), "Anillo del carnero": (3, "1d3"), "Bastón de curación": (10, "1d6+4"),
    "Bastón de enjambres de insectos": (10, "1d6+4"), "Bastón de escarcha": (10, "1d6+4"), "Bastón de fuego": (10, "1d6+4"),
    "Bastón de golpear": (10, "1d6+4"), "Bastón de hechizar": (10, "1d8+2"), "Bastón de los magos": (50, "4d6+2"),
    "Bastón de poder": (20, "2d8+4"), "Bastón marchitador": (3, "1d3"), "Bolsa de trucos": (3, "1d3"), "Botas aladas": (4, "1d4"),
    "Capa de invisibilidad": (3, "todas"), "Cetro de resurrección": (5, "1"), "Cubo de fuerza": (36, "1d20"),
    "Escarabajo de protección": (12, ""), "Flauta encantada": (3, "1d3"), "Gema de brillo": (50, ""), "Gema de visión": (3, "1d3"),
    "Maza del terror": (3, "1d3"), "Medallón de pensamientos": (5, "1d4"), "Ojos hechizadores": (3, "1d3"),
    "Tridente de dominar peces": (3, "1d3"), "Túnica de colores centelleantes": (3, "1d3"), "Varita de atadura": (7, "1d6+1"),
    "Varita de bolas de fuego": (7, "1d6+1"), "Varita de detectar enemigos": (7, "1d6+1"), "Varita de detectar magia": (3, "1d3"),
    "Varita de maravillas": (7, "1d6+1"), "Varita de miedo": (7, "1d6+1"), "Varita de parálisis": (7, "1d6+1"),
    "Varita de polimorfar": (7, "1d6+1"), "Varita de proyectiles mágicos": (7, "1d6+1"), "Varita de relámpagos": (7, "1d6+1"),
    "Varita de secretos": (3, "1d3"), "Varita de telarañas": (7, "1d6+1"), "Yelmo de teletransporte": (3, "1d3"),
}

# Nombres de la 5.ª edición (los que usa el «Manual para casi todo») -> nombres del Manual del Jugador 2024
ALIASES_2014 = {
    "castigo debilitador": "Castigo abrumador", "castigo iracundo": "Castigo furioso", "castigo marcador": "Castigo brillante",
    "ceguera/sordera": "Sordera/ceguera", "conjurar andanada": "Conjurar descarga de proyectiles", "contraconjuro": "Contrahechizo",
    "corona de locura": "Corona de la locura", "círculo de teletransporte": "Círculo de teletransportación",
    "descanso apacible": "Dulce descanso", "doble engañoso": "Engañar", "duelo obligado": "Duelo forzado",
    "enredadera atrapadora": "Enredadera", "esfera flamígera": "Esfera de llamas", "faro de esperanza": "Señal de esperanza",
    "intermitencia": "Desplazamiento", "maldición": "Imponer maldición", "miedo": "Terror",
    "palabra curativa en masa": "Palabra de curación en masa", "rayo debilitante": "Rayo debilitador",
    "revivir a los muertos": "Alzar a los muertos", "romper": "Hacer añicos", "vínculo planar": "Atadura planar",
    "vínculo telepático de Rary": "Enlace telepático de Rary", "zancada arbórea": "Paso arbóreo",
}


def mct_spells(features, names):
    """Conjuros siempre preparados de una subclase del MCT, sacados del texto «nivel 3: a, b; nivel 5: …»."""
    out = []
    for _lvl, name, text in features:
        if name.startswith("Conjuros") and "siempre preparados" in text:
            for lvl, lst in re.findall(r"nivel (\d+): ([^;(]+)", text):
                found = [names.get(x.strip().rstrip(".").lower()) or ALIASES_2014.get(x.strip().rstrip("."))
                         for x in lst.split(",")]
                out.append([int(lvl), [n for n in found if n]])
    return out


def enrich(classes, subclasses, feats, items, spells):
    """Añade todo lo anterior a las clases, dotes y objetos del manual (lo llama phb2024 al cargar)."""
    names = {s["name"].lower(): s["name"] for s in spells}
    for c in classes:
        subs = subclasses.get(c["id"], {})
        c["resources"] = c.get("resources", []) + CLASS_RESOURCES.get(c["id"], [])
        c["class_spells"] = CLASS_SPELLS.get(c["id"], [])
        c["subclass_spells"] = {s: SUBCLASS_SPELLS.get(s) or mct_spells(subs.get(s, []), names) for s in c["subclasses"]}
        c["subclass_spells"] = {s: v for s, v in c["subclass_spells"].items() if v}
        if c["id"] == "druida":
            c["subclass_spell_options"] = {"Círculo de la tierra": {"label": "Terreno", "options": LAND_SPELLS}}
        c["subclass_picks"] = {s: SUBCLASS_PICKS[s] for s in c["subclasses"] if s in SUBCLASS_PICKS}
        c["subclass_resources"] = {s: SUBCLASS_RESOURCES[s] for s in c["subclasses"] if s in SUBCLASS_RESOURCES}
        c["subclass_casting"] = {s: SUBCLASS_CASTING[s] for s in c["subclasses"] if s in SUBCLASS_CASTING}
        c["extra_lists"] = CLASS_EXTRA_LISTS.get(c["id"])
    for f in feats:
        if f["name"] in FEAT_GRANTS:
            f["grants"] = FEAT_GRANTS[f["name"]]
    for it in items:
        if it["name"] in ITEM_CHARGES:
            it["charges"], it["regain"] = ITEM_CHARGES[it["name"]]
