"""Objetos mágicos del SRD 5.2.1 en castellano: lee el PDF y escribe server/magicitems2024.json.

Uso: python tools/build_magic_items.py SRD_CC_v5.2.1.pdf
Del PDF salen el tipo, la rareza, la sintonía y la página; el nombre y el resumen en castellano están
en TRANSLATIONS (resúmenes propios, no el texto completo). Contenido del System Reference Document 5.2.1
de Wizards of the Coast LLC (CC-BY-4.0, https://www.dndbeyond.com/srd).
"""
import json
import re
import sys
from pathlib import Path

from pypdf import PdfReader

TYPES = r"(?:Armor|Weapon|Wondrous Item|Potion|Ring|Rod|Scroll|Staff|Wand)"
RAR = r"(?:Very Rare|Uncommon|Common|Rare|Legendary|Artifact|Rarity Varies)"
HEAD = re.compile(rf"^({TYPES})\s*(?:\(([^)]*)\))?,\s*((?:{RAR}(?:\s*\([^)]*\))?(?:,?\s*(?:or\s+)?)?)+)")

TYPE_ES = {"Armor": "Armadura", "Weapon": "Arma", "Wondrous Item": "Objeto maravilloso", "Potion": "Poción", "Ring": "Anillo",
           "Rod": "Cetro", "Scroll": "Pergamino", "Staff": "Bastón", "Wand": "Varita"}
RARITY_ES = {"Common": "común", "Uncommon": "poco común", "Rare": "raro", "Very Rare": "muy raro", "Legendary": "legendario",
             "Artifact": "artefacto", "Rarity Varies": "rareza variable"}
DETAIL_ES = {
    "Any Ammunition": "cualquier munición", "Any Light, Medium, or Heavy": "ligera, media o pesada",
    "Any Medium or Heavy, Except Hide Armor": "media o pesada, salvo de pieles", "Any Melee Weapon": "cualquier arma cuerpo a cuerpo",
    "Any Simple or Martial": "cualquier arma sencilla o marcial", "Battleaxe, Greataxe, or Halberd": "hacha de guerra, hacha a dos manos o alabarda",
    "Chain Mail or Chain Shirt": "cota de malla o camisa de malla", "Dagger": "daga",
    "Glaive, Greatsword, Longsword, Rapier, Scimitar, Sickle, or Shortsword": "guja, espadón, espada larga, estoque, cimitarra, hoz o espada corta",
    "Glaive, Greatsword, Longsword, Rapier, Scimitar, or Shortsword": "guja, espadón, espada larga, estoque, cimitarra o espada corta",
    "Glaive, Greatsword, Longsword, or Scimitar": "guja, espadón, espada larga o cimitarra", "Greatclub": "garrote grande",
    "Greatsword, Longsword, Rapier, Scimitar, or Shortsword": "espadón, espada larga, estoque, cimitarra o espada corta",
    "Half Plate Armor or Plate Armor": "media armadura o armadura de placas", "Javelin": "jabalina", "Longbow or Shortbow": "arco largo o arco corto",
    "Longsword": "espada larga", "Mace": "maza", "Maul or Warhammer": "maza a dos manos o martillo de guerra", "Plate Armor": "armadura de placas",
    "Quarterstaff": "bastón", "Scale Mail": "cota de escamas", "Scimitar": "cimitarra", "Shield": "escudo",
    "Studded Leather Armor": "armadura de cuero tachonado", "Trident": "tridente", "Warhammer": "martillo de guerra",
}
WHO_ES = {"Wizard": "mago", "Paladin": "paladín", "Druid": "druida", "Spellcaster": "lanzador de conjuros", "Cleric": "clérigo",
          "Bard": "bardo", "Sorcerer": "hechicero", "Warlock": "brujo", "Dwarf or a Creature Attuned to a Belt of Dwarvenkind": "enano (o quien lleve un Cinturón de los enanos)"}

# nombre en inglés: (nombre en castellano, resumen)
TRANSLATIONS = {
    "Adamantine Armor": ("Armadura de adamantina", "Reforzada con adamantina: cualquier crítico contra ti se convierte en un impacto normal."),
    "Ammunition, +1, +2, or +3": ("Munición +1, +2 o +3", "Bonificador al ataque y al daño según su rareza; pierde la magia al acertar. Suele aparecer en lotes de 10 o 20."),
    "Ammunition of Slaying": ("Munición asesina", "Hecha contra un tipo de criatura: si la daña, salvación de CON CD 17 o 6d10 de fuerza extra (mitad si salva). Después deja de ser mágica."),
    "Amulet of Health": ("Amuleto de salud", "Tu Constitución pasa a ser 19 mientras lo llevas (no hace nada si ya la tienes así de alta)."),
    "Amulet of Proof against Detection and Location": ("Amuleto contra la detección y la localización", "No pueden fijarte como objetivo los conjuros de adivinación ni verte sensores de escudriñamiento salvo que tú quieras."),
    "Amulet of the Planes": ("Amuleto de los planos", "Acción de magia y prueba de Conocimiento arcano CD 15 para lanzar desplazamiento entre planos al lugar que nombres; si fallas, acabas en un sitio al azar con quien esté a 4,5 m."),
    "Animated Shield": ("Escudo animado", "Acción adicional: el escudo flota y te protege 1 minuto como si lo empuñaras, con las manos libres."),
    "Apparatus of the Crab": ("Aparato del cangrejo", "Un barril de hierro que se convierte en un vehículo-cangrejo sumergible con pinzas, manejado con diez palancas."),
    "Armor, +1, +2, or +3": ("Armadura +1, +2 o +3", "Bonificador a la CA según su rareza mientras la llevas."),
    "Armor of Invulnerability": ("Armadura de invulnerabilidad", "Resistencia a daño contundente, cortante y perforante; 1 vez al día, inmunidad a ese daño durante 10 minutos."),
    "Armor of Resistance": ("Armadura de resistencia", "Resistencia a un tipo de daño (lo elige el máster o se tira) mientras la llevas."),
    "Armor of Vulnerability": ("Armadura de vulnerabilidad", "Resistencia a daño contundente, cortante o perforante, pero maldita: vulnerabilidad a los otros dos y no te la puedes quitar."),
    "Arrow-Catching Shield": ("Escudo atrapaflechas", "+2 a la CA contra ataques a distancia; con tu reacción, los ataques a distancia contra criaturas cercanas pasan a ser contra ti."),
    "Bag of Beans": ("Bolsa de alubias", "Alubias mágicas: plantadas y regadas producen un efecto al azar, a veces maravilloso y a veces terrible."),
    "Bag of Devouring": ("Bolsa devoradora", "Parece una bolsa de contención, pero es la boca de una criatura extradimensional que se traga lo que se mete."),
    "Bag of Holding": ("Bolsa de contención", "Por dentro es mucho más grande: hasta 500 libras sin pasar de 64 pies cúbicos y siempre pesa 15 libras. Dentro de otro espacio extradimensional, se rasga."),
    "Bag of Tricks": ("Bolsa de trucos", "Saca una bolita peluda y lánzala: se convierte en un animal al azar que te obedece hasta el siguiente amanecer (3 cargas)."),
    "Bead of Force": ("Cuenta de fuerza", "Lanzada a 18 m, estalla en una esfera de 3 m: salvación de DES CD 15 o 5d4 de fuerza y quedar atrapado en una esfera de fuerza 1 minuto."),
    "Bead of Nourishment": ("Cuenta de alimento", "Se deshace en la boca y alimenta como un día de raciones."),
    "Belt of Dwarvenkind": ("Cinturón de los enanos", "Sabes enano, ventaja en Persuasión con enanos, visión en la oscuridad 18 m, resistencia al veneno y ventaja contra envenenado."),
    "Belt of Giant Strength": ("Cinturón de fuerza de gigante", "Tu Fuerza pasa a ser la del gigante del cinturón: 21 (colinas), 23 (escarcha o piedra), 25 (fuego), 27 (nubes) o 29 (tormentas)."),
    "Berserker Axe": ("Hacha del berserker", "+1 al ataque y al daño y +1 PG máximo por nivel, pero maldita: cuando te hieren, salvación de SAB CD 15 o atacas a lo más cercano."),
    "Boots of Elvenkind": ("Botas élficas", "Tus pasos no hacen ruido y tienes ventaja en Sigilo."),
    "Boots of Levitation": ("Botas de levitación", "Puedes lanzar levitar sobre ti a voluntad."),
    "Boots of Speed": ("Botas de velocidad", "Acción adicional: duplican tu velocidad y dan desventaja a los ataques de oportunidad contra ti durante 10 minutos al día."),
    "Boots of Striding and Springing": ("Botas de zancadas y brincos", "Tu velocidad es como mínimo 9 m sin importar la carga o la armadura, y saltas el triple 1 vez por turno."),
    "Boots of the Winterlands": ("Botas de las tierras invernales", "Resistencia al frío, ignoras el terreno difícil de hielo y nieve y aguantas el frío extremo."),
    "Bowl of Commanding Water Elementals": ("Cuenco para dominar elementales de agua", "Lleno de agua, invoca un elemental de agua que te obedece 1 hora (1 vez al día)."),
    "Bracers of Archery": ("Brazales de arquería", "Competencia con arcos largo y corto y +2 al daño con ellos."),
    "Bracers of Defense": ("Brazales de defensa", "+2 a la CA si no llevas armadura ni escudo."),
    "Brazier of Commanding Fire Elementals": ("Brasero para dominar elementales de fuego", "Invoca un elemental de fuego que te obedece 1 hora (1 vez al día)."),
    "Brooch of Shielding": ("Broche de escudo", "Resistencia al daño de fuerza e inmunidad a proyectil mágico."),
    "Broom of Flying": ("Escoba voladora", "Vuela a 15 m con hasta 200 libras (más lenta con más peso) y acude sola si la llamas."),
    "Candle of Invocation": ("Vela de invocación", "Encendida, da ventaja en ataques, salvaciones y pruebas a las criaturas de un alineamiento y repone espacios a sus clérigos; también puede abrir una puerta a otro plano."),
    "Cape of the Mountebank": ("Capa del charlatán", "Lanza puerta dimensional 1 vez al día, desapareciendo en una nube de humo."),
    "Carpet of Flying": ("Alfombra voladora", "Vuela con sus pasajeros a una velocidad que depende de su tamaño y la carga."),
    "Censer of Controlling Air Elementals": ("Incensario para dominar elementales de aire", "Invoca un elemental de aire que te obedece 1 hora (1 vez al día)."),
    "Chime of Opening": ("Campanilla de apertura", "Al tocarla lanza abrir sobre una cerradura o tapa a 36 m (10 usos)."),
    "Circlet of Blasting": ("Diadema de estallidos", "Lanza rayo abrasador (+5 al ataque) 1 vez al día."),
    "Cloak of Arachnida": ("Capa arácnida", "Resistencia al veneno, trepar como una araña, sin quedar atrapado en telarañas y telaraña 1 vez al día."),
    "Cloak of Displacement": ("Capa de desplazamiento", "Los ataques contra ti tienen desventaja hasta que recibes daño; vuelve a funcionar al empezar tu turno."),
    "Cloak of Elvenkind": ("Capa élfica", "Desventaja en Percepción para percibirte y ventaja en tus pruebas de Sigilo."),
    "Cloak of Invisibility": ("Capa de invisibilidad", "Con la capucha puesta y 1 carga quedas invisible 1 hora; 3 cargas que se recuperan al amanecer."),
    "Cloak of Protection": ("Capa de protección", "+1 a la CA y a las salvaciones."),
    "Cloak of the Bat": ("Capa del murciélago", "Ventaja en Sigilo; en penumbra vuelas a 12 m y puedes convertirte en murciélago 1 vez al día."),
    "Cloak of the Manta Ray": ("Capa de la mantarraya", "Respiras bajo el agua y nadas a 18 m."),
    "Crystal Ball": ("Bola de cristal", "Lanza escudriñamiento (CD 17)."),
    "Crystal Ball of Mind Reading": ("Bola de cristal de lectura mental", "Escudriñamiento y además detectar pensamientos en lo que ves a través del sensor."),
    "Crystal Ball of Telepathy": ("Bola de cristal de telepatía", "Escudriñamiento y además telepatía con quien ves y sugestión 1 vez al día."),
    "Crystal Ball of True Seeing": ("Bola de cristal de visión verdadera", "Escudriñamiento con visión verdadera de 36 m alrededor del sensor."),
    "Cube of Force": ("Cubo de fuerza", "Cada cara crea una barrera de fuerza distinta gastando cargas (36 cargas)."),
    "Cubic Gate": ("Portal cúbico", "Sus caras llevan a planos distintos: abre un portal o lanza desplazamiento entre planos sobre una criatura."),
    "Dagger of Venom": ("Daga venenosa", "+1 al ataque y al daño; 1 vez al día la impregnas de veneno: salvación de CON CD 15 o 2d10 de veneno y envenenado 1 minuto."),
    "Dancing Sword": ("Espada danzante", "Acción adicional: la lanzas al aire y ataca sola durante unos asaltos antes de volver a tu mano."),
    "Decanter of Endless Water": ("Jarra de agua inagotable", "Mana agua dulce o salada en chorro, fuente o géiser que empuja."),
    "Deck of Illusions": ("Baraja de ilusiones", "Cada carta lanzada crea la ilusión de una criatura hasta que se disipa."),
    "Defender": ("Defensora", "+3 al ataque y al daño; puedes pasar parte del bonificador a tu CA en cada turno."),
    "Demon Armor": ("Armadura demoníaca", "+1 a la CA, sabes abisal y tus golpes sin armas hacen 1d8 cortante con +1, pero maldita: desventaja contra demonios."),
    "Dimensional Shackles": ("Grilletes dimensionales", "Impiden a la criatura que retienen salir por medios extradimensionales (teletransporte, viaje planar)."),
    "Dragon Orb": ("Orbe del dragón", "Artefacto: controla y atrae dragones y concentra un poder enorme, con un precio."),
    "Dragon Scale Mail": ("Cota de escamas de dragón", "+1 a la CA, ventaja contra la Presencia terrible y el aliento de dragones y resistencia al daño de su tipo; localiza dragones 1 vez al día."),
    "Dragon Slayer": ("Matadragones", "+1 al ataque y al daño y 3d6 extra contra dragones."),
    "Dust of Disappearance": ("Polvo de desaparición", "Tú y quien esté a 3 m quedáis invisibles 2d4 minutos (un uso)."),
    "Dust of Dryness": ("Polvo de sequedad", "Convierte hasta un cubo de 4,5 m de agua en una bolita; romperla devuelve el agua. Daña a los elementales de agua."),
    "Dust of Sneezing and Choking": ("Polvo de estornudar y asfixiar", "Parece polvo de desaparición, pero hace que tú y los cercanos no podáis respirar ni actuar bien."),
    "Dwarven Plate": ("Armadura de placas enana", "+2 a la CA y reacción para reducir 3 m un empujón contra tu voluntad."),
    "Dwarven Thrower": ("Lanzador enano", "+3 al ataque y al daño; se lanza a 6/18 m y vuelve; +1d8 (o 2d8 contra gigantes) al lanzarlo."),
    "Efficient Quiver": ("Carcaj eficiente", "Tres compartimentos extradimensionales: 60 flechas, 18 jabalinas y 6 objetos largos sin pasar de 2 libras."),
    "Efreeti Bottle": ("Botella del efrit", "Al abrirla aparece un efrit que puede servirte, concederte deseos o atacarte."),
    "Elemental Gem": ("Gema elemental", "Al romperla invocas un elemental del tipo de la gema que te obedece."),
    "Elixir of Health": ("Elixir de salud", "Cura enfermedades mágicas y termina cegado, ensordecido, paralizado y envenenado."),
    "Elven Chain": ("Cota de malla élfica", "+1 a la CA y cuentas como entrenado en ella aunque no lo estés."),
    "Energy Bow": ("Arco de energía", "+1 al ataque y al daño y dispara flechas de fuerza sin munición; puede hacer una escalera o una cuerda de energía."),
    "Eversmoking Bottle": ("Botella de humo perpetuo", "Abierta, llena de humo espeso una zona de 18 m."),
    "Eyes of Charming": ("Ojos hechizadores", "Lanza hechizar persona (CD 13) con 3 cargas."),
    "Eyes of Minute Seeing": ("Ojos de visión minuciosa", "Ves los detalles más pequeños a 30 cm: ventaja en Investigación al examinar."),
    "Eyes of the Eagle": ("Ojos de águila", "Ventaja en Percepción que dependa de la vista y ves detalles a 1,5 km."),
    "Feather Token": ("Prenda de pluma", "Un uso con efectos distintos según el tipo: ancla, ave, abanico, barco, árbol o látigo."),
    "Figurine of Wondrous Power": ("Figurilla de poder maravilloso", "Una estatuilla que se convierte en una criatura (león, cuervo, cabra…) que te obedece durante un tiempo."),
    "Flame Tongue": ("Lengua de fuego", "Acción adicional: la hoja arde (luz y +2d6 de fuego al acertar)."),
    "Folding Boat": ("Barca plegable", "Una caja que se convierte en un bote o en un barco pequeño y vuelve a ser caja."),
    "Frost Brand": ("Marca de escarcha", "+1d6 de frío al acertar, resistencia al fuego y luz en el frío; puede apagar llamas cercanas."),
    "Gauntlets of Ogre Power": ("Guanteletes de fuerza de ogro", "Tu Fuerza pasa a ser 19 mientras los llevas."),
    "Gem of Brightness": ("Gema de brillo", "Da luz, lanza un rayo cegador o un destello en cono (50 cargas)."),
    "Gem of Seeing": ("Gema de visión", "Visión verdadera de 36 m durante 10 minutos (3 cargas)."),
    "Giant Slayer": ("Matagigantes", "+1 al ataque y al daño; contra gigantes, 2d6 extra y salvación de FUE CD 15 o derribado."),
    "Glamoured Studded Leather": ("Cuero tachonado ilusorio", "+1 a la CA y puede parecer ropa normal u otra armadura."),
    "Gloves of Missile Snaring": ("Guantes atrapaproyectiles", "Reacción: reduces el daño de un ataque a distancia en 1d10 + DES y puedes atraparlo."),
    "Gloves of Swimming and Climbing": ("Guantes de nadar y trepar", "Nadas y trepas a tu velocidad y +5 a Atletismo para ello."),
    "Gloves of Thievery": ("Guantes del ladrón", "Invisibles mientras los llevas y +5 a Juego de manos."),
    "Goggles of Night": ("Anteojos nocturnos", "Visión en la oscuridad 18 m (o 18 m más si ya la tenías)."),
    "Hammer of Thunderbolts": ("Martillo de los truenos", "+1 al ataque y al daño; lanzado hace un trueno extra; con cinturón y guanteletes de fuerza aturde y mata gigantes."),
    "Handy Haversack": ("Petate práctico", "Mochila extradimensional: lo que buscas siempre está arriba."),
    "Hat of Disguise": ("Sombrero del disfraz", "Lanza disfrazarse a voluntad."),
    "Hat of Many Spells": ("Sombrero de muchos conjuros", "Canalizador de mago que suma a la CD y puede soltar un conjuro al azar de otra clase."),
    "Headband of Intellect": ("Cinta de intelecto", "Tu Inteligencia pasa a ser 19 mientras la llevas."),
    "Helm of Brilliance": ("Yelmo de brillantez", "Lleno de gemas que lanzan bola de fuego, muro de fuego, luz del día y otros; resistencia al fuego."),
    "Helm of Comprehending Languages": ("Yelmo de comprender idiomas", "Lanza comprensión idiomática a voluntad."),
    "Helm of Telepathy": ("Yelmo de telepatía", "Telepatía a 9 m y detectar pensamientos o sugestión (CD 13) 1 vez al día."),
    "Helm of Teleportation": ("Yelmo de teletransporte", "Lanza teletransporte (3 cargas)."),
    "Holy Avenger": ("Vengadora sagrada", "+3 al ataque y al daño, 2d10 radiante extra contra infernales y muertos vivientes, y aura de ventaja contra conjuros."),
    "Horn of Blasting": ("Cuerno de estallido", "Cono de 9 m: salvación de CON CD 15 o 5d8 de trueno y ensordecido; puede explotarte en la mano."),
    "Horn of Valhalla": ("Cuerno del Valhalla", "Llama a guerreros espíritu que luchan a tu lado (más cuanto mejor sea el cuerno)."),
    "Horseshoes of a Zephyr": ("Herraduras del céfiro", "La montura camina sobre el aire a ras de suelo, sin dejar huella ni cansarse."),
    "Horseshoes of Speed": ("Herraduras de velocidad", "+9 m a la velocidad de la montura."),
    "Immovable Rod": ("Cetro inamovible", "Pulsas el botón y queda fijo en el aire aguantando hasta 8.000 libras."),
    "Instant Fortress": ("Fortaleza instantánea", "Una estatuilla que crece hasta ser una torre de adamantina de 6 × 6 m."),
    "Ioun Stone": ("Piedra Ioun", "Orbita tu cabeza y da un beneficio según su tipo (+1 a la CA, a una característica, conjuros, etc.)."),
    "Iron Bands": ("Bandas de hierro", "Lanzada, se convierte en bandas que apresan a una criatura Enorme o menor."),
    "Iron Flask": ("Frasco de hierro", "Atrapa a una criatura de otro plano para liberarla después a tu servicio."),
    "Javelin of Lightning": ("Jabalina de relámpago", "Su daño puede ser de relámpago; 1 vez al día se convierte en un relámpago en línea de 4d6."),
    "Lantern of Revealing": ("Linterna de revelación", "Su luz hace visibles a las criaturas y objetos invisibles."),
    "Luck Blade": ("Hoja de la suerte", "+1 al ataque, al daño y a las salvaciones, una repetición al día y puede contener deseos."),
    "Mace of Disruption": ("Maza disruptora", "2d6 radiante extra a infernales y muertos vivientes; con 25 PG o menos, salvación o destruidos."),
    "Mace of Smiting": ("Maza aplastante", "+1 al ataque y al daño (+3 contra constructos) y daño extra con un 20 natural."),
    "Mace of Terror": ("Maza del terror", "Una onda de miedo: salvación de SAB CD 15 o asustados 1 minuto (3 cargas)."),
    "Mantle of Spell Resistance": ("Manto de resistencia a conjuros", "Ventaja en las salvaciones contra conjuros."),
    "Manual of Bodily Health": ("Manual de salud corporal", "Tras 48 horas de estudio, tu Constitución sube 2 (máximo 30) y el libro pierde su magia un siglo."),
    "Manual of Gainful Exercise": ("Manual de ejercicio provechoso", "Tras 48 horas de estudio, tu Fuerza sube 2 (máximo 30)."),
    "Manual of Golems": ("Manual de gólems", "Contiene lo necesario para construir un gólem de un tipo concreto (tiempo, oro y conocimientos)."),
    "Manual of Quickness of Action": ("Manual de rapidez de acción", "Tras 48 horas de estudio, tu Destreza sube 2 (máximo 30)."),
    "Marvelous Pigments": ("Pigmentos maravillosos", "Lo que pintas con ellos se vuelve real (objetos y terreno, no criaturas)."),
    "Medallion of Thoughts": ("Medallón de pensamientos", "Lanza detectar pensamientos (CD 13) con 5 cargas."),
    "Mirror of Life Trapping": ("Espejo atrapavidas", "Quien se mira en él puede quedar atrapado en una de sus celdas."),
    "Mithral Armor": ("Armadura de mithral", "Ligera y flexible: sin desventaja en Sigilo ni requisito de Fuerza."),
    "Mysterious Deck": ("Baraja misteriosa", "Al sacar cartas ocurren efectos poderosos y peligrosos, para bien o para mal (la famosa baraja de muchas cosas)."),
    "Necklace of Adaptation": ("Collar de adaptación", "Respiras en cualquier entorno y tienes ventaja contra gases y venenos inhalados."),
    "Necklace of Fireballs": ("Collar de bolas de fuego", "Cada cuenta lanzada es una bola de fuego (puedes lanzar varias juntas)."),
    "Necklace of Prayer Beads": ("Collar de cuentas de oración", "Cuentas que lanzan bendición, curar heridas, restablecimiento mayor y otros conjuros divinos."),
    "Nine Lives Stealer": ("Robavidas", "+2 al ataque y al daño; con un 20 natural, puede matar a una criatura con menos de 100 PG (cargas limitadas)."),
    "Oathbow": ("Arco juramentado", "Juras a un enemigo: ventaja contra él y 3d6 extra, pero desventaja con otras armas hasta que muera."),
    "Oil of Etherealness": ("Aceite de eterealidad", "Untado, te vuelves etéreo 1 hora."),
    "Oil of Sharpness": ("Aceite de afilado", "Un arma cortante o perforante (o munición) gana +3 al ataque y al daño 1 hora."),
    "Oil of Slipperiness": ("Aceite resbaladizo", "Untado, libertad de movimiento 8 horas; en el suelo, como el conjuro grasa."),
    "Pearl of Power": ("Perla de poder", "Recuperas un espacio de conjuro de nivel 3 o menor 1 vez al día."),
    "Periapt of Health": ("Amuleto de salud vigorosa", "Recuperas 2d4 + 2 PG 1 vez al día y tienes ventaja contra enfermedades."),
    "Periapt of Proof against Poison": ("Amuleto contra el veneno", "Inmunidad al veneno y al estado de envenenado."),
    "Periapt of Wound Closure": ("Amuleto de cerrar heridas", "Te estabilizas solo y tus dados de golpe curan el doble."),
    "Philter of Love": ("Filtro de amor", "Quedas hechizado por la primera criatura que veas en los 10 minutos siguientes."),
    "Pipes of Haunting": ("Flauta encantada", "Música inquietante: salvación de SAB CD 15 o asustados 1 minuto (3 cargas)."),
    "Pipes of the Sewers": ("Flauta de las alcantarillas", "Las ratas no te atacan y puedes llamar enjambres de ratas que te obedecen."),
    "Plate Armor of Etherealness": ("Armadura de placas etérea", "Te permite volverte etéreo 1 vez al día."),
    "Portable Hole": ("Agujero portátil", "Una tela que se convierte en un agujero extradimensional de 3 m de hondo. Dentro de otro espacio extradimensional, se rasga."),
    "Potion of Animal Friendship": ("Poción de amistad animal", "Lanzas amistad animal de nivel 3 (CD 13)."),
    "Potion of Clairvoyance": ("Poción de clarividencia", "Efecto de clarividencia sin concentración."),
    "Potion of Climbing": ("Poción de trepar", "Trepas a tu velocidad 1 hora y ventaja para trepar."),
    "Potion of Diminution": ("Poción de reducción", "Efecto de «reducir» de agrandar/reducir durante 1d4 horas."),
    "Potion of Flying": ("Poción de vuelo", "Vuelas a tu velocidad 1 hora."),
    "Potion of Gaseous Form": ("Poción de forma gaseosa", "Efecto de forma gaseosa durante 1 hora."),
    "Potion of Giant Strength": ("Poción de fuerza de gigante", "Tu Fuerza pasa a la del gigante 1 hora (de 21 a 29 según el tipo)."),
    "Potion of Growth": ("Poción de crecimiento", "Efecto de «agrandar» de agrandar/reducir durante 10 minutos."),
    "Potions of Healing": ("Pociones de curación", "Normal 2d4 + 2 PG; mayor 4d4 + 4; superior 8d4 + 8; suprema 10d4 + 20."),
    "Potion of Heroism": ("Poción de heroísmo", "10 PG temporales y efecto de bendición 1 hora."),
    "Potion of Invisibility": ("Poción de invisibilidad", "Invisible 1 hora o hasta que ataques o lances un conjuro."),
    "Potion of Invulnerability": ("Poción de invulnerabilidad", "Resistencia a todo el daño durante 1 minuto."),
    "Potion of Longevity": ("Poción de longevidad", "Rejuveneces 1d6 + 6 años; cada poción más arriesga que envejezcas de golpe."),
    "Potion of Mind Reading": ("Poción de lectura mental", "Efecto de detectar pensamientos (CD 13) durante 10 minutos."),
    "Potion of Poison": ("Poción de veneno", "Parece beneficiosa, pero es veneno: daño y envenenado."),
    "Potion of Resistance": ("Poción de resistencia", "Resistencia a un tipo de daño durante 1 hora."),
    "Potion of Speed": ("Poción de velocidad", "Efecto de acelerar 1 minuto sin el letargo final."),
    "Potion of Vitality": ("Poción de vitalidad", "Quita el cansancio y el envenenado; 24 horas curándote el máximo con los dados de golpe."),
    "Potion of Water Breathing": ("Poción de respirar bajo el agua", "Respiras bajo el agua 24 horas."),
    "Quarterstaff of the Acrobat": ("Bastón del acróbata", "+2 al ataque y al daño; da luz, se alarga como pértiga y te ayuda a hacer piruetas."),
    "Ring of Animal Influence": ("Anillo de influencia animal", "Lanza amistad animal, hablar con los animales o terror contra bestias (3 cargas)."),
    "Ring of Djinni Summoning": ("Anillo de invocar djinn", "Invoca a un djinni que te sirve 1 hora al día."),
    "Ring of Elemental Command": ("Anillo de dominio elemental", "Dominio sobre los elementales de un plano y conjuros de ese elemento."),
    "Ring of Evasion": ("Anillo de evasión", "Reacción y 1 carga: superas una salvación de DES fallada (3 cargas)."),
    "Ring of Feather Falling": ("Anillo de caída de pluma", "Caes a 18 m por asalto y no recibes daño por la caída."),
    "Ring of Free Action": ("Anillo de libertad de acción", "El terreno difícil no te frena y la magia no puede reducir tu velocidad, paralizarte ni apresarte."),
    "Ring of Invisibility": ("Anillo de invisibilidad", "Te haces invisible a voluntad hasta que te lo quites o decidas aparecer."),
    "Ring of Jumping": ("Anillo de salto", "Lanza saltar sobre ti a voluntad."),
    "Ring of Mind Shielding": ("Anillo de escudo mental", "Nadie lee tu mente ni sabe si mientes, y puedes guardar tu alma en él al morir."),
    "Ring of Protection": ("Anillo de protección", "+1 a la CA y a las salvaciones."),
    "Ring of Regeneration": ("Anillo de regeneración", "Recuperas 1d6 PG cada 10 minutos y te vuelven a crecer los miembros perdidos."),
    "Ring of Resistance": ("Anillo de resistencia", "Resistencia a un tipo de daño según su gema."),
    "Ring of Shooting Stars": ("Anillo de estrellas fugaces", "Luces danzantes, luz, fuego feérico, relámpagos esféricos y estrellas fugaces (6 cargas)."),
    "Ring of Spell Storing": ("Anillo de almacenar conjuros", "Guarda hasta 5 niveles de conjuros para lanzarlos después."),
    "Ring of Spell Turning": ("Anillo de devolver conjuros", "Ventaja contra conjuros; los de nivel 7 o menos que salvas pueden volverse contra quien los lanzó."),
    "Ring of Swimming": ("Anillo de natación", "Nadas a 12 m."),
    "Ring of Telekinesis": ("Anillo de telequinesis", "Lanza telequinesis a voluntad."),
    "Ring of the Ram": ("Anillo del carnero", "Golpe de fuerza a distancia que daña y empuja (3 cargas)."),
    "Ring of Three Wishes": ("Anillo de los tres deseos", "Lanza deseo; tiene 3 cargas."),
    "Ring of Warmth": ("Anillo de calor", "Reduce en 2d8 el daño de frío que recibes y aguantas el frío extremo."),
    "Ring of Water Walking": ("Anillo de caminar sobre el agua", "Lanza caminar sobre el agua sobre ti a voluntad."),
    "Ring of X-ray Vision": ("Anillo de visión de rayos X", "Ves a través de la materia sólida a 9 m durante 1 minuto."),
    "Robe of Eyes": ("Túnica de ojos", "Ves en todas direcciones, visión en la oscuridad 36 m y ves lo invisible y lo etéreo."),
    "Robe of Scintillating Colors": ("Túnica de colores centelleantes", "Sus colores aturden a quien la mira (3 cargas)."),
    "Robe of Stars": ("Túnica de estrellas", "+1 a las salvaciones, proyectil mágico de nivel 5 con sus estrellas y viaje al plano astral."),
    "Robe of the Archmagi": ("Túnica del archimago", "CA 15 + DES sin armadura, ventaja contra conjuros y +2 a la CD y al ataque de tus conjuros."),
    "Robe of Useful Items": ("Túnica de objetos útiles", "Parches que se convierten en objetos de verdad: daga, linterna, cuerda, foso…"),
    "Rod of Absorption": ("Cetro de absorción", "Reacción: absorbe un conjuro dirigido solo a ti y guarda su energía para tus conjuros."),
    "Rod of Alertness": ("Cetro de alerta", "Ventaja en Percepción e iniciativa, conjuros de detección y un aura que protege a los aliados."),
    "Rod of Lordly Might": ("Cetro de poder señorial", "Maza +3 con seis botones que la convierten en espada, hacha, lanza, escalera y más."),
    "Rod of Resurrection": ("Cetro de resurrección", "Lanza sanar o resurrección (5 cargas)."),
    "Rod of Rulership": ("Cetro de autoridad", "Las criaturas a 36 m deben salvar SAB CD 15 o quedan hechizadas 8 horas (1 vez al día)."),
    "Rod of Security": ("Cetro de seguridad", "Te lleva a ti y a hasta 199 criaturas a un semiplano paradisíaco durante días."),
    "Rope of Climbing": ("Cuerda de trepar", "Se mueve, se ata y se anuda sola a tus órdenes."),
    "Rope of Entanglement": ("Cuerda enmarañadora", "Apresa a una criatura a 6 m (salvación para escapar)."),
    "Scarab of Protection": ("Escarabajo de protección", "+1 a la CA, ventaja contra conjuros y anula efectos de muerte o de nigromancia (12 cargas)."),
    "Scimitar of Speed": ("Cimitarra de velocidad", "+2 al ataque y al daño y un ataque extra como acción adicional."),
    "Sending Stones": ("Piedras de recado", "Un par: con una lanzas recado a quien tenga la otra 1 vez al día."),
    "Sentinel Shield": ("Escudo centinela", "Ventaja en iniciativa y Percepción."),
    "Shield, +1, +2, or +3": ("Escudo +1, +2 o +3", "Bonificador extra a la CA según su rareza."),
    "Shield of Missile Attraction": ("Escudo atraeproyectiles", "Resistencia a los ataques a distancia, pero maldito: atrae los ataques a distancia cercanos."),
    "Shield of the Cavalier": ("Escudo del caballero", "+2 a la CA, empujones con el escudo y protección para los aliados cercanos."),
    "Slippers of Spider Climbing": ("Zapatillas de trepar como una araña", "Caminas por paredes y techos a tu velocidad (no en superficies resbaladizas)."),
    "Sovereign Glue": ("Pegamento soberano", "Une dos objetos para siempre; solo lo deshacen el solvente universal o un deseo."),
    "Spellguard Shield": ("Escudo antimagia", "Ventaja contra conjuros y efectos mágicos; los ataques de conjuro contra ti tienen desventaja."),
    "Spell Scroll": ("Pergamino de conjuro", "Contiene un conjuro que se lanza leyéndolo; su rareza y CD dependen del nivel del conjuro."),
    "Sphere of Annihilation": ("Esfera de aniquilación", "Una esfera negra que destruye todo lo que toca; se puede intentar controlar con Conocimiento arcano."),
    "Staff of Charming": ("Bastón de hechizar", "Lanza hechizar persona, orden imperiosa y comprensión idiomática y devuelve encantamientos (10 cargas)."),
    "Staff of Fire": ("Bastón de fuego", "Resistencia al fuego y lanza manos ardientes, bola de fuego o muro de fuego (10 cargas)."),
    "Staff of Frost": ("Bastón de escarcha", "Resistencia al frío y lanza cono de frío, nube de oscurecimiento, tormenta de hielo o muro de hielo (10 cargas)."),
    "Staff of Healing": ("Bastón de curación", "Lanza curar heridas, restablecimiento menor o curar en masa (10 cargas)."),
    "Staff of Power": ("Bastón de poder", "Bastón +2, +2 a la CA, salvaciones y ataques de conjuro, conjuros ofensivos y golpe de retribución (20 cargas)."),
    "Staff of Striking": ("Bastón de golpear", "Bastón +3 que gasta cargas para hacer 1d6 de fuerza extra por carga (10 cargas)."),
    "Staff of Swarming Insects": ("Bastón de enjambres de insectos", "Nubes de insectos y conjuros como plaga de insectos (10 cargas)."),
    "Staff of the Magi": ("Bastón de los magos", "Bastón +2, conjuros poderosos, absorbe conjuros y puede romperse en una explosión devastadora (50 cargas)."),
    "Staff of the Python": ("Bastón de la pitón", "Lanzado, se convierte en una serpiente constrictora gigante que te obedece."),
    "Staff of the Woodlands": ("Bastón de los bosques", "Bastón +2, +2 a ataques de conjuro y conjuros de naturaleza; puede volverse un árbol."),
    "Staff of Thunder and Lightning": ("Bastón de truenos y relámpagos", "Bastón +2 con relámpago, trueno, rayo y estallido atronador 1 vez al día cada uno."),
    "Staff of Withering": ("Bastón marchitador", "Al acertar gastas 1 carga: 2d10 necrótico y desventaja en pruebas de FUE o CON (3 cargas)."),
    "Stone of Controlling Earth Elementals": ("Piedra para dominar elementales de tierra", "Invoca un elemental de tierra que te obedece 1 hora (1 vez al día)."),
    "Stone of Good Luck (Luckstone)": ("Piedra de la suerte", "+1 a las pruebas de característica y a las salvaciones."),
    "Sun Blade": ("Espada del sol", "Una empuñadura que crea una hoja de luz: +2, daño radiante, 1d8 extra a muertos vivientes y luz solar."),
    "Sword of Life Stealing": ("Espada robavidas", "Con un 20 natural, 15 de daño necrótico extra y tú ganas esos PG temporales."),
    "Sword of Sharpness": ("Espada afilada", "Daño máximo contra objetos; con un 20 natural, 14 cortante extra y puede cortar un miembro."),
    "Sword of Wounding": ("Espada hiriente", "2d6 necrótico extra y la herida impide curarse hasta tu siguiente turno (salvación de CON CD 15)."),
    "Talisman of Pure Good": ("Talismán del bien puro", "Daña a infernales y muertos vivientes y puede abrir una grieta que engulle a una criatura malvada."),
    "Talisman of the Sphere": ("Talismán de la esfera", "Ventaja y más control al manejar una esfera de aniquilación."),
    "Talisman of Ultimate Evil": ("Talismán del mal supremo", "Daña a quien no es malvado y puede abrir una grieta que engulle a una criatura buena."),
    "Thunderous Greatclub": ("Garrote grande atronador", "Tu Fuerza pasa a ser 20, +1d8 de trueno y un golpe atronador contra el suelo."),
    "Tome of Clear Thought": ("Tomo del pensamiento claro", "Tras 48 horas de estudio, tu Inteligencia sube 2 (máximo 30)."),
    "Tome of Leadership and Influence": ("Tomo de liderazgo e influencia", "Tras 48 horas de estudio, tu Carisma sube 2 (máximo 30)."),
    "Tome of Understanding": ("Tomo de la comprensión", "Tras 48 horas de estudio, tu Sabiduría sube 2 (máximo 30)."),
    "Trident of Fish Command": ("Tridente de dominar peces", "Lanza dominar bestia (CD 15) sobre bestias acuáticas (3 cargas)."),
    "Universal Solvent": ("Solvente universal", "Disuelve cualquier adhesivo, incluso el pegamento soberano."),
    "Vicious Weapon": ("Arma despiadada", "2d6 de daño extra del tipo del arma a cualquier criatura a la que aciertes."),
    "Vorpal Sword": ("Espada vorpal", "+3 al ataque y al daño, ignora la resistencia cortante y con un 20 natural puede cortar la cabeza."),
    "Wand of Binding": ("Varita de atadura", "Lanza inmovilizar monstruo o inmovilizar persona (CD 17) y ayuda a escapar (7 cargas)."),
    "Wand of Enemy Detection": ("Varita de detectar enemigos", "Durante 1 minuto sabes en qué dirección está el enemigo más cercano a 18 m (7 cargas)."),
    "Wand of Fear": ("Varita de miedo", "Lanza orden imperiosa («huye») o un cono de terror (CD 15, 7 cargas)."),
    "Wand of Fireballs": ("Varita de bolas de fuego", "Lanza bola de fuego (CD 15) de nivel 3 o más gastando cargas (7 cargas)."),
    "Wand of Lightning Bolts": ("Varita de relámpagos", "Lanza relámpago (CD 15) de nivel 3 o más gastando cargas (7 cargas)."),
    "Wand of Magic Detection": ("Varita de detectar magia", "Lanza detectar magia (3 cargas)."),
    "Wand of Magic Missiles": ("Varita de proyectiles mágicos", "Lanza proyectil mágico de nivel 1 o más gastando cargas (7 cargas)."),
    "Wand of Paralysis": ("Varita de parálisis", "Rayo: salvación de CON CD 15 o paralizado 1 minuto (7 cargas)."),
    "Wand of Polymorph": ("Varita de polimorfar", "Lanza polimorfar (CD 15) (7 cargas)."),
    "Wand of Secrets": ("Varita de secretos", "Señala puertas secretas y trampas a 18 m (3 cargas)."),
    "Wand of the War Mage, +1, +2, or +3": ("Varita del mago de guerra +1, +2 o +3", "Bonificador a los ataques de conjuro según su rareza e ignoras la cobertura media."),
    "Wand of Web": ("Varita de telarañas", "Lanza telaraña (CD 13) (7 cargas)."),
    "Wand of Wonder": ("Varita de maravillas", "Gasta una carga y ocurre un efecto al azar: desde una bola de fuego hasta una lluvia de mariposas."),
    "Weapon, +1, +2, or +3": ("Arma +1, +2 o +3", "Bonificador al ataque y al daño según su rareza."),
    "Weapon of Warning": ("Arma de alerta", "Tú y tus aliados a 9 m tenéis ventaja en iniciativa y no os sorprenden dormidos."),
    "Well of Many Worlds": ("Pozo de muchos mundos", "Una tela que abre un portal a un lugar al azar de otro plano."),
    "Wind Fan": ("Abanico de viento", "Lanza ráfaga de viento (CD 13); cada uso extra al día puede romperlo."),
    "Winged Boots": ("Botas aladas", "Vuelas a 9 m durante 1 hora por carga (4 cargas)."),
    "Wings of Flying": ("Alas de vuelo", "La capa se convierte en alas: vuelas a 18 m durante 1 hora al día."),
}


def parse(pdf):
    reader = PdfReader(pdf)
    text, starts = "", []
    for i in range(208, 255):  # «Magic Items A–Z», páginas 209-255 del documento
        t = reader.pages[i].extract_text() or ""
        t = re.sub(r"^(System Reference Document 5\.2\.1|\d+)\s*$", "", t, flags=re.M)
        starts.append((len(text), i + 1))
        text += t + "\n"
    lines = text.split("\n")
    offsets, pos = [], 0
    for l in lines:
        offsets.append(pos)
        pos += len(l) + 1
    heads = []
    for i, l in enumerate(lines):
        if not re.match(rf"^{TYPES}\s*[(,]", l.strip()) or not HEAD.match(" ".join(x.strip() for x in lines[i:i + 4])):
            continue
        name = lines[i - 1].strip()
        if i >= 2 and lines[i - 2].strip() and name[:1].islower():  # nombre partido en dos líneas
            name = f"{lines[i - 2].strip()} {name}"
        heads.append((i, re.sub(r"\s+", " ", name)))
    out = []
    for k, (i, name) in enumerate(heads):
        end = heads[k + 1][0] - 1 if k + 1 < len(heads) else len(lines)
        block = re.sub(r"\s+", " ", " ".join(x.strip() for x in lines[i:end]))
        m = HEAD.match(block)
        rarities, attune = [], None
        for r, extra in re.findall(rf"({RAR})(?:\s*\(([^)]*)\))?", m.group(3)):
            if extra.startswith("Requires Attunement"):
                attune = extra[len("Requires Attunement"):].strip()
                extra = ""
            rarities.append([r, extra])
        if attune is None:
            a = re.match(r"\s*\(Requires Attunement( by [^)]*)?\)", block[m.end():])
            attune = (a.group(1) or "").strip() if a else None
        page = next(n for off, n in reversed(starts) if off <= offsets[i])
        if name and not name.endswith("table."):
            out.append({"en": name, "type": m.group(1), "detail": m.group(2) or "", "rarity": rarities, "attune": attune, "page": page})
    return out


def attune_es(att):
    """None = sin sintonía; "" = sintonía; "de un mago" = sintonía solo para esa clase o especie."""
    if att is None:
        return None
    who = att[5:] if att.startswith("by a ") else ""
    if not who:
        return ""
    if who in WHO_ES:
        return f"de un {WHO_ES[who]}"
    names = [WHO_ES.get(p, p) for p in (w.strip() for w in re.split(r",\s*(?:or\s+)?|\s+or\s+", who)) if p]
    return "de un " + (f"{', '.join(names[:-1])} o {names[-1]}" if len(names) > 1 else names[0])


def translate(it):
    es, summary = TRANSLATIONS[it["en"]]
    extra = {"Silver or Brass": "plata o latón", "Bronze": "bronce", "Iron": "hierro"}
    rarity = ", ".join(f"{RARITY_ES[r]} ({extra.get(x, x)})" if x else RARITY_ES[r] for r, x in it["rarity"])
    attune = attune_es(it["attune"])
    return {"name": es, "en": it["en"], "type": TYPE_ES[it["type"]], "detail": DETAIL_ES.get(it["detail"], it["detail"].lower()),
            "rarity": rarity, "rarityKey": it["rarity"][0][0], "attune": attune, "summary": summary, "page": it["page"]}


def main(pdf):
    items = parse(pdf)
    missing = [it["en"] for it in items if it["en"] not in TRANSLATIONS]
    if missing:
        raise SystemExit(f"Sin traducir: {missing}")
    data = sorted((translate(it) for it in items), key=lambda x: x["name"])
    dst = Path(__file__).resolve().parent.parent / "server" / "magicitems2024.json"
    dst.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(len(data), "objetos ->", dst)


if __name__ == "__main__":
    main(sys.argv[1])
