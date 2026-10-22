"""Genera server/monsters2024.json: el bestiario del SRD 5.2.1 traducido al castellano.

Uso: python tools/build_bestiary.py SRD_CC_v5.2.1.pdf
(el PDF es libre, CC-BY-4.0: https://www.dndbeyond.com/srd). Hace falta pypdf.

Del PDF se toman los datos de cada bloque de estadísticas. Los nombres se traducen con los
diccionarios de abajo y el texto de reglas se resume en castellano a partir de los números
(ataque, daño, CD, recarga, estados que causa); la prosa completa no se traduce.
Si sale algún término sin traducir, el script lo avisa al final.
"""
import json
import re
import sys
from pathlib import Path

from pypdf import PdfReader

OUT = Path(__file__).resolve().parent.parent / "server" / "monsters2024.json"

# ------------------------------------------------------------------- lectura del PDF
SIZES_EN = "Tiny|Small|Medium|Large|Huge|Gargantuan"
TYPELINE = re.compile(rf"^((?:{SIZES_EN})(?: or (?:{SIZES_EN}))?) ([A-Z][a-z]+)(?: \(([^)]*)\))?, (.+)$")
ABIL = re.compile(r"(Str|Dex|Con|Int|Wis|Cha)\s+(\d+)\s+([+−-]?\d+)\s+([+−-]?\d+)", re.I)
SECTIONS = ("Traits", "Actions", "Bonus Actions", "Reactions", "Legendary Actions")
num = lambda s: int(s.replace("−", "-").replace("+", ""))


def marked_text(path, first_page=257):
    """Texto de los monstruos con los nombres de rasgos y acciones (negrita cursiva) entre ⟦ ⟧."""
    out = []
    for page in PdfReader(path).pages[first_page:]:
        state = {"bold": False}

        def vis(text, cm, tm, font, size):
            bi = bool(font) and "BoldItalic" in str(font.get("/BaseFont", ""))
            if bi and not state["bold"]:
                out.append("⟦")
                state["bold"] = True
            elif not bi and state["bold"] and text.strip():
                out.append("⟧")
                state["bold"] = False
            out.append(text)

        page.extract_text(visitor_text=vis)
        if state["bold"]:
            out.append("⟧")
        out.append("\n")
    text = "".join(out)
    text = re.sub(r"⟧(\s*)⟦", r"\1", text)
    text = re.sub(r"⟦(\s+)", r"\1⟦", text)
    text = re.sub(r"(\s+)⟧", r"⟧\1", text)
    text = text.replace("⟦⟧", "")
    return [l.rstrip() for l in text.split("\n")
            if not re.match(r"^(\d+|System Reference Document 5\.2\.1|Monsters A–Z|Animals)$", l.strip())]


def read_monsters(path):
    lines = marked_text(path)
    heads = [i for i, l in enumerate(lines) if TYPELINE.match(l.strip("⟦⟧ ")) and i + 1 < len(lines) and re.match(r"^AC \d+", lines[i + 1].strip())]
    out = []
    for k, i in enumerate(heads):
        end = heads[k + 1] - 1 if k + 1 < len(heads) else len(lines)
        name = next(l for l in reversed(lines[:i]) if l.strip()).strip()
        out.append(parse(name, TYPELINE.match(lines[i].strip("⟦⟧ ")), lines[i + 1:end]))
    return out


def parse(name, m, block):
    text = "\n".join(block)
    first = min((text.find(f"\n{s}\n") for s in SECTIONS if f"\n{s}\n" in text), default=len(text))
    head, rest = text[:first], text[first:]
    mon = {"name": name, "size": m.group(1), "type": m.group(2), "tags": m.group(3) or "", "alignment": m.group(4)}
    mon["ac"] = int(re.search(r"AC (\d+)", head).group(1))
    init = re.search(r"Initiative ([+−-]\d+)", head)
    mon["init"] = num(init.group(1)) if init else None
    hp = re.search(r"HP (\d+)(?: \(([^)]+)\))?", head)
    mon["hp"], mon["hpDice"] = int(hp.group(1)), (hp.group(2) or "").replace(" ", "")
    mon["speed"] = re.sub(r"\s+", " ", re.search(r"Speed (.+?)\n(?:MOD|Str)", head, re.S).group(1)).strip()
    mon["abilities"], mon["saveProf"] = {}, []
    for a, score, md, sv in ABIL.findall(head):
        mon["abilities"][a.lower()] = int(score)
        if sv.lstrip("+−-") != md.lstrip("+−-"):
            mon["saveProf"].append(a.lower())
    labels = "Skills|Resistances|Vulnerabilities|Immunities|Senses|Languages|Gear|CR"
    for key, label in (("skills", "Skills"), ("resist", "Resistances"), ("vuln", "Vulnerabilities"), ("immune", "Immunities"), ("senses", "Senses"), ("languages", "Languages")):
        f = re.search(rf"^{label} (.+?)(?=\n(?:{labels}) |\Z)", head, re.M | re.S)
        mon[key] = re.sub(r"\s+", " ", f.group(1)).strip() if f else ""
    mon["cr"] = re.search(r"CR (\S+)", head).group(1)
    mon["sections"] = {}
    for sec, body in re.findall(rf"\n({'|'.join(SECTIONS)})\n(.*?)(?=\n(?:{'|'.join(SECTIONS)})\n|\Z)", rest, re.S):
        body = re.sub(r"(\w)-\n(\w)", r"\1\2", body)
        body = re.sub(r"\s*\n\s*", " ", body).strip()
        entries = [{"name": nm.strip().rstrip("."), "text": tx.strip()} for nm, _, tx in (p.partition("⟧") for p in body.split("⟦")[1:])]
        intro = body.split("⟦")[0].strip()
        if intro:
            entries.insert(0, {"name": "", "text": intro})
        mon["sections"][sec] = entries
    return mon


# ------------------------------------------------------------------- vocabulario
SIZE = {"Tiny": "Diminuto", "Small": "Pequeño", "Medium": "Mediano", "Large": "Grande", "Huge": "Enorme", "Gargantuan": "Gargantuesco"}
TYPE = {"Aberration": "aberración", "Beast": "bestia", "Celestial": "celestial", "Construct": "constructo", "Dragon": "dragón",
        "Elemental": "elemental", "Fey": "feérico", "Fiend": "infernal", "Giant": "gigante", "Humanoid": "humanoide",
        "Monstrosity": "monstruosidad", "Ooze": "cieno", "Plant": "planta", "Undead": "muerto viviente"}
TAG = {"Angel": "ángel", "Chromatic": "cromático", "Cleric": "clérigo", "Demon": "demonio", "Devil": "diablo", "Dinosaur": "dinosaurio",
       "Druid": "druida", "Genie": "genio", "Goblinoid": "goblinoide", "Lycanthrope": "licántropo", "Metallic": "metálico", "Titan": "titán", "Wizard": "mago"}
ALIGN = {"Chaotic Evil": "caótico malvado", "Chaotic Good": "caótico bueno", "Chaotic Neutral": "caótico neutral", "Lawful Evil": "legal malvado",
         "Lawful Good": "legal bueno", "Lawful Neutral": "legal neutral", "Neutral": "neutral", "Neutral Evil": "neutral malvado",
         "Neutral Good": "neutral bueno", "Unaligned": "sin alineamiento"}
DAMAGE = {"Acid": "ácido", "Bludgeoning": "contundente", "Cold": "frío", "Fire": "fuego", "Force": "fuerza", "Lightning": "relámpago",
          "Necrotic": "necrótico", "Piercing": "perforante", "Poison": "veneno", "Psychic": "psíquico", "Radiant": "radiante",
          "Slashing": "cortante", "Thunder": "trueno"}
CONDITION = {"Blinded": "cegado", "Charmed": "hechizado", "Deafened": "ensordecido", "Exhaustion": "cansancio", "Frightened": "asustado",
             "Grappled": "agarrado", "Incapacitated": "incapacitado", "Invisible": "invisible", "Paralyzed": "paralizado",
             "Petrified": "petrificado", "Poisoned": "envenenado", "Prone": "derribado", "Restrained": "apresado", "Stunned": "aturdido",
             "Unconscious": "inconsciente"}
ABILITY = {"Strength": "FUE", "Dexterity": "DES", "Constitution": "CON", "Intelligence": "INT", "Wisdom": "SAB", "Charisma": "CAR"}
SKILL = {"Acrobatics": "Acrobacias", "Animal Handling": "Trato con animales", "Arcana": "Conocimiento arcano", "Athletics": "Atletismo",
         "Deception": "Engaño", "History": "Historia", "Insight": "Perspicacia", "Intimidation": "Intimidación", "Investigation": "Investigación",
         "Medicine": "Medicina", "Nature": "Naturaleza", "Perception": "Percepción", "Performance": "Interpretación", "Persuasion": "Persuasión",
         "Religion": "Religión", "Sleight of Hand": "Juego de manos", "Stealth": "Sigilo", "Survival": "Supervivencia"}
SENSE = {"Blindsight": "vista ciega", "Darkvision": "visión en la oscuridad", "Tremorsense": "sentir vibraciones", "Truesight": "visión verdadera",
         "Passive Perception": "Percepción pasiva"}
LANG = [  # el orden importa: frases antes que palabras
    ("Thieves’ Cant", "jerga de ladrones"), ("Deep Speech", "habla profunda"), ("Sign Language", "lengua de signos"),
    ("any one language (usually Common)", "un idioma cualquiera (normalmente común)"), ("any languages it knew in life", "los idiomas que conocía en vida"),
    ("the languages it knew in life", "los idiomas que conocía en vida"), ("all languages", "todos los idiomas"),
    ("Understands", "entiende"), ("understands", "entiende"), ("but can’t speak", "pero no habla"), ("but can't speak", "pero no habla"),
    ("plus two other languages", "y otros dos idiomas"), ("plus one other language", "y otro idioma"), ("plus any two languages", "y dos idiomas cualesquiera"),
    ("languages of its creator", "los idiomas de su creador"), ("the languages of its creator", "los idiomas de su creador"),
    ("telepathy", "telepatía"), ("Common", "común"), ("Draconic", "dracónico"), ("Abyssal", "abisal"), ("Infernal", "infernal"),
    ("Celestial", "celestial"), ("Sylvan", "silvano"), ("Elvish", "élfico"), ("Dwarvish", "enano"), ("Giant", "gigante"), ("Goblin", "goblin"),
    ("Gnomish", "gnomo"), ("Halfling", "mediano"), ("Orc", "orco"), ("Primordial", "primordial"), ("Aquan", "acuano"), ("Auran", "aurano"),
    ("Ignan", "ígneo"), ("Terran", "terrano"), ("Undercommon", "infracomún"), ("Druidic", "druídico"), ("Gnoll", "gnoll"), ("Sahuagin", "sahuagin"),
    ("Merfolk", "tritón"), ("None", "ninguno"), ("All", "todos"), ("and", "y"), ("Worg", "huargo"), ("Winter Wolf", "lobo invernal"),
    ("Sphinx", "esfinge"), ("Blink Dog", "perro intermitente"), ("Hell Hound", "sabueso infernal"), ("Grell", "grell"),
    ("one language of its choice", "un idioma a su elección"), ("any language", "cualquier idioma"), ("can’t speak", "no puede hablar"),
    ("can't speak", "no puede hablar"), ("its creator", "su creador"), ("it knew in life", "que conocía en vida"), ("of", "de"), ("languages", "idiomas"),
    ("language", "idioma"), ("but", "pero"), ("plus", "y"), ("the", ""), ("any", "cualquier"), ("other", "otro"), ("one", "uno"), ("two", "dos"),
]
COLOR = {"Black": ("negro", False), "Blue": ("azul", False), "Green": ("verde", False), "Red": ("rojo", False), "White": ("blanco", False),
         "Brass": ("latón", True), "Bronze": ("bronce", True), "Copper": ("cobre", True), "Gold": ("oro", True), "Silver": ("plata", True)}

MONSTER = {
    "Aboleth": "Aboleth", "Air Elemental": "Elemental de aire", "Animated Armor": "Armadura animada", "Animated Flying Sword": "Espada voladora animada",
    "Animated Rug of Smothering": "Alfombra asfixiante animada", "Ankheg": "Ankheg", "Assassin": "Asesino", "Awakened Shrub": "Arbusto despertado",
    "Awakened Tree": "Árbol despertado", "Axe Beak": "Picohacha", "Azer Sentinel": "Centinela azer", "Balor": "Balor", "Bandit": "Bandido",
    "Bandit Captain": "Capitán bandido", "Barbed Devil": "Diablo de púas", "Basilisk": "Basilisco", "Bearded Devil": "Diablo barbado", "Behir": "Behir",
    "Berserker": "Berserker", "Black Pudding": "Pudin negro", "Blink Dog": "Perro intermitente", "Bone Devil": "Diablo óseo",
    "Bugbear Stalker": "Acechador osgo", "Bugbear Warrior": "Guerrero osgo", "Bulette": "Bulette", "Centaur Trooper": "Soldado centauro",
    "Chain Devil": "Diablo de las cadenas", "Chimera": "Quimera", "Chuul": "Chuul", "Clay Golem": "Gólem de arcilla", "Cloaker": "Capa acechante",
    "Cloud Giant": "Gigante de las nubes", "Cockatrice": "Cocatriz", "Commoner": "Plebeyo", "Couatl": "Couatl", "Cultist": "Sectario",
    "Cultist Fanatic": "Sectario fanático", "Darkmantle": "Manto oscuro", "Death Dog": "Perro de la muerte", "Deva": "Deva", "Djinni": "Djinn",
    "Doppelganger": "Doppelganger", "Dragon Turtle": "Tortuga dragón", "Dretch": "Dretch", "Drider": "Drider", "Druid": "Druida", "Dryad": "Dríade",
    "Earth Elemental": "Elemental de tierra", "Efreeti": "Efreet", "Erinyes": "Erinia", "Ettercap": "Ettercap", "Ettin": "Ettin",
    "Fire Elemental": "Elemental de fuego", "Fire Giant": "Gigante de fuego", "Flesh Golem": "Gólem de carne", "Frost Giant": "Gigante de escarcha",
    "Shrieker Fungus": "Hongo chillón", "Violet Fungus": "Hongo violeta", "Gargoyle": "Gárgola", "Gelatinous Cube": "Cubo gelatinoso",
    "Ghast": "Ghast", "Ghost": "Fantasma", "Ghoul": "Necrófago", "Gibbering Mouther": "Bocón farfullante", "Glabrezu": "Glabrezu",
    "Gladiator": "Gladiador", "Gnoll Warrior": "Guerrero gnoll", "Goblin Minion": "Esbirro goblin", "Goblin Warrior": "Guerrero goblin",
    "Goblin Boss": "Jefe goblin", "Gorgon": "Gorgona", "Gray Ooze": "Cieno gris", "Green Hag": "Bruja verde", "Grick": "Grick", "Griffon": "Grifo",
    "Grimlock": "Grimlock", "Guardian Naga": "Naga guardiana", "Guard": "Guardia", "Guard Captain": "Capitán de la guardia",
    "Half-Dragon": "Semidragón", "Harpy": "Arpía", "Hell Hound": "Sabueso infernal", "Hezrou": "Hezrou", "Hill Giant": "Gigante de las colinas",
    "Hippogriff": "Hipogrifo", "Hobgoblin Warrior": "Guerrero hobgoblin", "Hobgoblin Captain": "Capitán hobgoblin", "Homunculus": "Homúnculo",
    "Horned Devil": "Diablo cornudo", "Hydra": "Hidra", "Ice Devil": "Diablo de hielo", "Imp": "Diablillo", "Incubus": "Íncubo",
    "Invisible Stalker": "Acechador invisible", "Iron Golem": "Gólem de hierro", "Knight": "Caballero", "Kobold Warrior": "Guerrero kobold",
    "Kraken": "Kraken", "Lamia": "Lamia", "Lemure": "Lémur", "Lich": "Liche", "Mage": "Mago", "Archmage": "Archimago", "Magmin": "Magmin",
    "Manticore": "Mantícora", "Marilith": "Marilith", "Medusa": "Medusa", "Dust Mephit": "Mefit de polvo", "Ice Mephit": "Mefit de hielo",
    "Magma Mephit": "Mefit de magma", "Steam Mephit": "Mefit de vapor", "Merfolk Skirmisher": "Hostigador tritón", "Merrow": "Merrow",
    "Mimic": "Mimeto", "Minotaur of Baphomet": "Minotauro de Baphomet", "Mummy": "Momia", "Mummy Lord": "Señor de las momias",
    "Nalfeshnee": "Nalfeshnee", "Night Hag": "Bruja de la noche", "Nightmare": "Pesadilla", "Noble": "Noble", "Ochre Jelly": "Gelatina ocre",
    "Ogre": "Ogro", "Oni": "Oni", "Otyugh": "Otyugh", "Owlbear": "Osolechuza", "Pegasus": "Pegaso", "Phase Spider": "Araña de fase",
    "Pirate": "Pirata", "Pirate Captain": "Capitán pirata", "Pit Fiend": "Diablo de la fosa", "Planetar": "Planetar", "Priest Acolyte": "Acólito",
    "Priest": "Sacerdote", "Pseudodragon": "Pseudodragón", "Purple Worm": "Gusano púrpura", "Quasit": "Quasit", "Rakshasa": "Rakshasa",
    "Remorhaz": "Remorhaz", "Roc": "Roc", "Roper": "Roper", "Rust Monster": "Monstruo corrosivo", "Sahuagin Warrior": "Guerrero sahuagin",
    "Salamander": "Salamandra", "Satyr": "Sátiro", "Scout": "Explorador", "Sea Hag": "Bruja marina", "Shadow": "Sombra",
    "Shambling Mound": "Montículo andante", "Shield Guardian": "Guardián escudo", "Skeleton": "Esqueleto", "Warhorse Skeleton": "Esqueleto de caballo de guerra",
    "Minotaur Skeleton": "Esqueleto de minotauro", "Solar": "Solar", "Specter": "Espectro", "Sphinx of Wonder": "Esfinge del asombro",
    "Sphinx of Lore": "Esfinge del saber", "Sphinx of Valor": "Esfinge del valor", "Spirit Naga": "Naga espiritual", "Sprite": "Duendecillo",
    "Spy": "Espía", "Stirge": "Stirge", "Stone Giant": "Gigante de piedra", "Stone Golem": "Gólem de piedra", "Storm Giant": "Gigante de las tormentas",
    "Succubus": "Súcubo", "Tarrasque": "Tarrasca", "Tough": "Matón", "Tough Boss": "Jefe matón", "Treant": "Treant", "Troll": "Trol",
    "Troll Limb": "Miembro de trol", "Unicorn": "Unicornio", "Vampire Familiar": "Familiar vampírico", "Vampire Spawn": "Engendro vampírico",
    "Vampire": "Vampiro", "Vrock": "Vrock", "Warrior Infantry": "Soldado de infantería", "Warrior Veteran": "Veterano",
    "Water Elemental": "Elemental de agua", "Werebear": "Hombre oso", "Wereboar": "Hombre jabalí", "Wererat": "Hombre rata",
    "Weretiger": "Hombre tigre", "Werewolf": "Hombre lobo", "Wight": "Tumulario", "Will-o’-Wisp": "Fuego fatuo", "Winter Wolf": "Lobo invernal",
    "Worg": "Huargo", "Wraith": "Aparición", "Wyvern": "Guiverno", "Xorn": "Xorn", "Zombie": "Zombi", "Ogre Zombie": "Zombi ogro",
    # animales
    "Allosaurus": "Alosaurio", "Ankylosaurus": "Anquilosaurio", "Ape": "Simio", "Archelon": "Arquelón", "Baboon": "Babuino", "Badger": "Tejón",
    "Bat": "Murciélago", "Black Bear": "Oso negro", "Blood Hawk": "Halcón sangriento", "Boar": "Jabalí", "Brown Bear": "Oso pardo",
    "Camel": "Camello", "Cat": "Gato", "Constrictor Snake": "Serpiente constrictora", "Crab": "Cangrejo", "Crocodile": "Cocodrilo", "Deer": "Ciervo",
    "Dire Wolf": "Lobo terrible", "Draft Horse": "Caballo de tiro", "Eagle": "Águila", "Elephant": "Elefante", "Elk": "Alce",
    "Flying Snake": "Serpiente voladora", "Frog": "Rana", "Goat": "Cabra", "Hawk": "Halcón", "Hippopotamus": "Hipopótamo",
    "Hunter Shark": "Tiburón cazador", "Hyena": "Hiena", "Jackal": "Chacal", "Killer Whale": "Orca", "Lion": "León", "Lizard": "Lagarto",
    "Mammoth": "Mamut", "Mastiff": "Mastín", "Mule": "Mula", "Octopus": "Pulpo", "Owl": "Búho", "Panther": "Pantera", "Piranha": "Piraña",
    "Plesiosaurus": "Plesiosaurio", "Polar Bear": "Oso polar", "Pony": "Poni", "Pteranodon": "Pteranodon", "Rat": "Rata", "Raven": "Cuervo",
    "Reef Shark": "Tiburón de arrecife", "Rhinoceros": "Rinoceronte", "Riding Horse": "Caballo de monta", "Saber-Toothed Tiger": "Tigre dientes de sable",
    "Scorpion": "Escorpión", "Seahorse": "Caballito de mar", "Spider": "Araña", "Tiger": "Tigre", "Triceratops": "Triceratops",
    "Tyrannosaurus Rex": "Tiranosaurio rex", "Venomous Snake": "Serpiente venenosa", "Vulture": "Buitre", "Warhorse": "Caballo de guerra",
    "Weasel": "Comadreja", "Wolf": "Lobo", "Centipede": "Ciempiés", "Fire Beetle": "Escarabajo de fuego", "Wasp": "Avispa", "Toad": "Sapo",
    "Wolf Spider": "Araña lobo", "Shark": "Tiburón",
}

ENTRY = {
    "Abduct": "Secuestrar", "Aberrant Ground": "Terreno aberrante", "Abyssal Glaive": "Guja abisal", "Acid Absorption": "Absorción de ácido",
    "Acid Breath": "Aliento de ácido", "Acid Spray": "Rociada de ácido", "Adhesive": "Adhesivo", "Agile": "Ágil", "Air Form": "Forma de aire",
    "Amorphous": "Amorfo", "Amphibious": "Anfibio", "Animate Trees": "Animar árboles", "Antennae": "Antenas", "Aquatic Charge": "Carga acuática",
    "Arcane Burst": "Estallido arcano", "Arcane Prowl": "Merodeo arcano", "Attach": "Adherirse", "Aura of Authority": "Aura de autoridad",
    "Aversion to Fire": "Aversión al fuego", "Baleful Command": "Orden funesta", "Banish": "Desterrar", "Barbed Hide": "Piel espinosa",
    "Battleaxe": "Hacha de guerra", "Beak": "Pico", "Beard": "Barba", "Beast of Burden": "Bestia de carga", "Beguile": "Embaucar",
    "Berserk": "Furia", "Bite": "Mordisco", "Bites": "Mordiscos", "Bladed Arm": "Brazo cortante", "Blazing Light": "Luz abrasadora",
    "Blinding Breath": "Aliento cegador", "Blinding Gaze": "Mirada cegadora", "Blinding Spittle": "Escupitajo cegador", "Blood Frenzy": "Frenesí de sangre",
    "Bloodied Frenzy": "Frenesí del herido", "Bloodied Fury": "Furia del herido", "Blurred Form": "Forma borrosa", "Bone Bow": "Arco de hueso",
    "Bone Cudgel": "Porra de hueso", "Boulder": "Roca", "Boulder Toss": "Lanzar roca", "Bound": "Atado", "Bubble Dash": "Carrera burbujeante",
    "Burn": "Quemadura", "Burning Hammer": "Martillo ardiente", "Burst of Ingenuity": "Arrebato de ingenio", "Captain’s Charm": "Encanto de capitán",
    "Celestial Restoration": "Restauración celestial", "Chain": "Cadena", "Channel Negative Energy": "Canalizar energía negativa", "Charge": "Carga",
    "Charged Tendril": "Zarcillo cargado", "Charging Horn": "Cuerno embestidor", "Charm": "Hechizar", "Chill": "Escalofrío", "Claw": "Garra",
    "Claws": "Garras", "Cloaked Flight": "Vuelo embozado", "Cloud of Insects": "Nube de insectos", "Club": "Garrote", "Cold Breath": "Aliento de frío",
    "Cold Gale": "Vendaval gélido", "Commanding Presence": "Presencia dominante", "Compression": "Compresión", "Confer Fire Resistance": "Conceder resistencia al fuego",
    "Conjure Infernal Chain": "Conjurar cadena infernal", "Constrict": "Constreñir", "Consume Life": "Consumir vida", "Consume Memories": "Consumir recuerdos",
    "Corrosive Form": "Forma corrosiva", "Corrupting Touch": "Toque corruptor", "Coven Magic": "Magia de aquelarre", "Create Specter": "Crear espectro",
    "Create Whirlwind": "Crear torbellino", "Crush": "Aplastar", "Cunning Action": "Acción astuta", "Cursed Touch": "Toque maldito", "Dagger": "Daga",
    "Darkness Aura": "Aura de oscuridad", "Deadly Leap": "Salto mortal", "Death Burst": "Estallido mortal", "Death Glare": "Mirada mortal",
    "Death Throes": "Estertores", "Deathless Agility": "Agilidad inmortal", "Deathless Strike": "Golpe inmortal", "Deathly Teleport": "Teletransporte mortal",
    "Deflect Missile": "Desviar proyectil", "Demonic Restoration": "Restauración demoníaca", "Destroy Metal": "Destruir metal", "Devilish Claw": "Garra diabólica",
    "Diabolical Restoration": "Restauración diabólica", "Disrupt Life": "Perturbar la vida", "Dissolving Pseudopod": "Seudópodo disolvente",
    "Divine Aid": "Ayuda divina", "Divine Awareness": "Percepción divina", "Dominate Mind": "Dominar mente", "Draconic Origin": "Origen dracónico",
    "Dragon’s Breath": "Aliento de dragón", "Draining Kiss": "Beso agotador", "Draining Swipe": "Zarpazo drenante", "Dread Command": "Orden terrible",
    "Dreadful Glare": "Mirada aterradora", "Earth Glide": "Deslizarse por la tierra", "Eldritch Burst": "Estallido sobrenatural",
    "Eldritch Restoration": "Restauración sobrenatural", "Elemental Restoration": "Restauración elemental", "Enchanting Bow": "Arco encantador",
    "Engulf": "Engullir", "Entangling Rope": "Cuerda enredadora", "Enthralling Panache": "Desparpajo cautivador", "Ephemeral": "Efímero",
    "Ethereal Jaunt": "Paseo etéreo", "Ethereal Sight": "Vista etérea", "Ethereal Stride": "Zancada etérea", "Etherealness": "Forma etérea",
    "Evasion": "Evasión", "Exalted Restoration": "Restauración exaltada", "Fear Aura": "Aura de miedo", "Fetid Cloud": "Nube fétida",
    "Fiendish Restoration": "Restauración infernal", "Fiendish Touch": "Toque infernal", "Fiery Bolt": "Saeta ígnea", "Fiery Mace": "Maza ígnea",
    "Fiery Rays": "Rayos ígneos", "Fire Absorption": "Absorción de fuego", "Fire Aura": "Aura de fuego", "Fire Breath": "Aliento de fuego",
    "Fire Form": "Forma de fuego", "Fist": "Puño", "Flame Spear": "Lanza de fuego", "Flame Sword": "Espada de fuego", "Flame Whip": "Látigo de fuego",
    "Fling": "Arrojar", "Flyby": "Vuelo rasante", "Flying Sword": "Espada voladora", "Fog Cloud": "Nube de niebla", "Force Bolt": "Saeta de fuerza",
    "Foreleg": "Pata delantera", "Freeze": "Congelar", "Freezing Burst": "Estallido gélido", "Frightening Gaze": "Mirada aterradora",
    "Frightful Presence": "Presencia pavorosa", "Frost Axe": "Hacha de escarcha", "Frost Breath": "Aliento de escarcha", "Gibbering": "Farfulla",
    "Giggling Magic": "Magia risueña", "Glare": "Mirada fulminante", "Gore": "Cornada", "Gouge": "Desgarrón", "Grab": "Agarrar",
    "Grave Strike": "Golpe sepulcral", "Great Bow": "Gran arco", "Greataxe": "Hacha a dos manos", "Greatclub": "Garrote grande", "Greater Magic Resistance": "Resistencia a la magia mayor",
    "Greatsword": "Espadón", "Guiding Light": "Luz guía", "Hail of Bark": "Granizo de corteza", "Hammer Throw": "Lanzar martillo",
    "Hand Crossbow": "Ballesta de mano", "Handaxe": "Hacha de mano", "Harpoon": "Arpón", "Hasten": "Apresurarse", "Heart Sight": "Ver el corazón",
    "Heat Aura": "Aura de calor", "Heated Blade": "Hoja candente", "Heavy Crossbow": "Ballesta pesada", "Hellfire Spellcasting": "Lanzamiento de conjuros infernal",
    "Hellish Restoration": "Restauración infernal", "Hold Breath": "Contener la respiración", "Holy Burst": "Estallido sagrado", "Holy Mace": "Maza sagrada",
    "Hooves": "Cascos", "Horrific Visage": "Rostro horripilante", "Horror Nimbus": "Halo de horror", "Hurl Flame": "Arrojar llamas",
    "Ice Spear": "Lanza de hielo", "Ice Walk": "Caminar sobre hielo", "Ice Wall": "Muro de hielo", "Ignited Illumination": "Iluminación encendida",
    "Illumination": "Iluminación", "Illusory Appearance": "Apariencia ilusoria", "Immutable Form": "Forma inmutable", "Incorporeal Movement": "Movimiento incorpóreo",
    "Incubus Form": "Forma de íncubo", "Infernal Glaive": "Guja infernal", "Infernal Sting": "Aguijón infernal", "Infernal Tail": "Cola infernal",
    "Ink Cloud": "Nube de tinta", "Inscrutable": "Inescrutable", "Invisibility": "Invisibilidad", "Iron Scent": "Olfato para el hierro",
    "Javelin": "Jabalina", "Jumper": "Saltador", "Lash": "Latigazo", "Leap": "Salto", "Legendary Resistance": "Resistencia legendaria",
    "Life Drain": "Drenar vida", "Light Crossbow": "Ballesta ligera", "Light Hammer": "Martillo ligero", "Light Sensitivity": "Sensibilidad a la luz",
    "Lightning Absorption": "Absorción de relámpagos", "Lightning Blade": "Hoja de relámpago", "Lightning Breath": "Aliento de relámpago",
    "Lightning Storm": "Tormenta de relámpagos", "Lightning Strike": "Golpe de relámpago", "Limited Amphibiousness": "Anfibio limitado",
    "Loathsome Limbs": "Miembros repugnantes", "Longbow": "Arco largo", "Longsword": "Espada larga", "Luring Song": "Canto seductor", "Mace": "Maza",
    "Magic Resistance": "Resistencia a la magia", "Magic Rope": "Cuerda mágica", "Magic of the Spider Queen": "Magia de la Reina Araña",
    "Mimicry": "Imitación", "Mind Invasion": "Invasión mental", "Mind Jolt": "Sacudida mental", "Mind-Rending Roar": "Rugido desgarramentes",
    "Misty Escape": "Huida brumosa", "Misty Step": "Paso brumoso", "Moan": "Gemido", "Mockery": "Burla", "Morningstar": "Lucero del alba",
    "Mucus Cloud": "Nube de mucosidad", "Multiattack": "Multiataque", "Multiple Heads": "Múltiples cabezas", "Necrotic Bow": "Arco necrótico",
    "Necrotic Ray": "Rayo necrótico", "Necrotic Strike": "Golpe necrótico", "Necrotic Sword": "Espada necrótica", "Needle Sword": "Espada aguja",
    "Nightmare": "Pesadilla", "Nightmare Haunting": "Acoso de pesadilla", "Nightmare Ray": "Rayo de pesadilla", "Nimble Escape": "Huida ágil",
    "Noxious Miasma": "Miasma nocivo", "Ocean Spear": "Lanza del océano", "Onslaught": "Embestida", "Ooze Cube": "Cubo de cieno",
    "Pack Tactics": "Táctica de manada", "Pact Blade": "Hoja de pacto", "Paralyzing Breath": "Aliento paralizante", "Paralyzing Tentacles": "Tentáculos paralizantes",
    "Paralyzing Touch": "Toque paralizante", "Parry": "Parada", "Petrifying Bite": "Mordisco petrificante", "Petrifying Breath": "Aliento petrificante",
    "Petrifying Gaze": "Mirada petrificante", "Phantasms": "Fantasmas", "Pike": "Pica", "Pincer": "Pinza", "Pistol": "Pistola",
    "Poison Breath": "Aliento venenoso", "Poison Burst": "Estallido venenoso", "Poison Ray": "Rayo venenoso", "Poisonous Spittle": "Escupitajo venenoso",
    "Possession": "Posesión", "Pounce": "Abalanzarse", "Probing Telepathy": "Telepatía indagadora", "Proboscis": "Probóscide", "Protection": "Protección",
    "Protective Magic": "Magia protectora", "Prowl": "Merodear", "Pseudopod": "Seudópodo", "Psychic Drain": "Drenaje psíquico", "Pummel": "Aporrear",
    "Pursuit": "Persecución", "Quick Grapple": "Agarre rápido", "Radiant Flame": "Llama radiante", "Radiant Horn": "Cuerno radiante",
    "Radiant Sword": "Espada radiante", "Radiant Teleport": "Teletransporte radiante", "Rake": "Arañazo", "Ram": "Embestir", "Rampage": "Desenfreno",
    "Rapier": "Estoque", "Reactive": "Reactivo", "Reactive Heads": "Cabezas reactivas", "Read Thoughts": "Leer pensamientos",
    "Redirect Attack": "Redirigir ataque", "Reel": "Recoger", "Reflective Carapace": "Caparazón reflectante", "Reflexive Antennae": "Antenas reflejas",
    "Regeneration": "Regeneración", "Rend": "Desgarrar", "Repulsion Breath": "Aliento de repulsión", "Restless Touch": "Toque incansable",
    "Riposte": "Contraataque", "Ritual Sickle": "Hoz ritual", "Roar": "Rugido", "Rock": "Roca", "Rock Launch": "Lanzar roca", "Rotting Fist": "Puño putrefacto",
    "Rotting Touch": "Toque putrefacto", "Running Leap": "Salto con carrerilla", "Scare": "Asustar", "Scimitar": "Cimitarra",
    "Scorching Sands": "Arenas abrasadoras", "Scratch": "Arañazo", "Searing Fork": "Horca abrasadora", "Sense Magic": "Percibir magia",
    "Shadow Stealth": "Sigilo sombrío", "Shape-Shift": "Cambiar de forma", "Shark Telepathy": "Telepatía con tiburones", "Shield Bash": "Golpe de escudo",
    "Shimmering Shield": "Escudo reluciente", "Shock": "Descarga", "Shortbow": "Arco corto", "Shortsword": "Espada corta", "Shred": "Despedazar",
    "Shriek": "Chillido", "Siege Monster": "Monstruo de asedio", "Slam": "Porrazo", "Slash": "Tajo", "Slaying Bow": "Arco asesino", "Sleep": "Dormir",
    "Sleep Breath": "Aliento de sueño", "Slow": "Ralentizar", "Slowing Breath": "Aliento ralentizador", "Smother": "Asfixiar", "Snake Hair": "Cabellera de serpientes",
    "Sonic Boom": "Estampido sónico", "Soul Bag": "Bolsa de almas", "Speak with Beasts and Plants": "Hablar con bestias y plantas", "Spear": "Lanza",
    "Spell Storing": "Almacenar conjuros", "Spellcasting": "Lanzamiento de conjuros", "Spider Climb": "Trepar cual arácnido", "Spirit Jar": "Vasija de espíritus",
    "Spiritual Weapon": "Arma espiritual", "Split": "Dividirse", "Spores": "Esporas", "Standing Leap": "Salto sin carrerilla", "Steam Breath": "Aliento de vapor",
    "Stench": "Hedor", "Sting": "Aguijón", "Stone Club": "Garrote de piedra", "Storm Blade": "Hoja de tormenta", "Storm Bolt": "Saeta de tormenta",
    "Storm Sword": "Espada de tormenta", "Stunning Screech": "Chillido aturdidor", "Succubus Form": "Forma de súcubo", "Sunlight Sensitivity": "Sensibilidad a la luz solar",
    "Sunlight Weakness": "Debilidad ante la luz solar", "Swallow": "Tragar", "Swarm": "Enjambre", "Swarm of Grasping Hands": "Enjambre de manos aferradoras",
    "Swoop": "Picado", "Tail": "Cola", "Tail Spike": "Púa de la cola", "Tail Stinger": "Aguijón de la cola", "Tail Swipe": "Coletazo", "Talons": "Garras",
    "Telepathic Bond": "Vínculo telepático", "Teleport": "Teletransporte", "Tentacle": "Tentáculo", "Tentacle Slam": "Latigazo de tentáculo",
    "Tentacles": "Tentáculos", "Thorn Burst": "Estallido de espinas", "Thunderbolt": "Rayo", "Thunderclap": "Trueno", "Thundercloud": "Nube de tormenta",
    "Thunderous Bellow": "Bramido atronador", "Thunderous Mace": "Maza atronadora", "Thunderous Slam": "Porrazo atronador", "Touch": "Toque",
    "Toxic Ink": "Tinta tóxica", "Training": "Adiestramiento", "Trample": "Pisotear", "Trampling Charge": "Carga arrolladora", "Transparent": "Transparente",
    "Trash Lob": "Lanzar basura", "Treasure Sense": "Olfato para el tesoro", "Tree Club": "Garrote de árbol", "Tree Stride": "Zancada arbórea",
    "Troll Spawn": "Engendro de trol", "Tunneler": "Excavador", "Tusk": "Colmillo", "Umbral Dagger": "Daga umbría", "Undead Fortitude": "Fortaleza de muerto viviente",
    "Undead Restoration": "Restauración de muerto viviente", "Unicorn’s Blessing": "Bendición del unicornio", "Unnerving Gaze": "Mirada inquietante",
    "Unsettling Visage": "Rostro perturbador", "Vampire Weakness": "Debilidades de vampiro", "Vampiric Connection": "Conexión vampírica", "Vanish": "Desvanecerse",
    "Verdant Wisp": "Fuego verde", "Vile Appearance": "Aspecto repugnante", "Vile Slime": "Limo inmundo", "Vine Lash": "Latigazo de enredadera",
    "Vine Staff": "Bastón de enredaderas", "Vortex": "Vórtice", "War Cry": "Grito de guerra", "Warhammer": "Martillo de guerra",
    "Water Breathing": "Respirar bajo el agua", "Water Form": "Forma de agua", "Water Susceptibility": "Vulnerabilidad al agua",
    "Weakening Breath": "Aliento debilitador", "Web": "Telaraña", "Web Strand": "Hebra de telaraña", "Web Walker": "Caminante de telarañas",
    "Weight of Years": "Peso de los años", "Whelm": "Abrumar", "Whirlwind": "Torbellino", "Whirlwind of Sand": "Torbellino de arena",
    "Wind Swipe": "Zarpazo de viento", "Wishes": "Deseos", "Withering Sword": "Espada marchitadora", "Withering Touch": "Toque marchitador",
    "World-Shaking Movement": "Movimiento sísmico",
}

PHRASES = [
    (r"\(with mind blank\)", "(con mente en blanco)"),
    (r"\(unimpeded by magical Darkness\)", "(la oscuridad mágica no la impide)"),
    (r"\(works only with creatures that understand (\w+)\)", r"(solo con criaturas que entiendan \1)"),
    (r"\(except from its vampire master\)", "(salvo por su amo vampiro)"),
    (r"entiende commands given in cualquier idioma", "entiende órdenes en cualquier idioma"),
    (r"\(doesn’t allow receiving creature to respond telepathically\)", "(quien la recibe no puede responder telepáticamente)"),
    (r"perforante damage from weapons wielded by creatures under the effect of a bless spell", "perforante de armas empuñadas por criaturas bajo el efecto de bendición"),
    (r"damage type chosen for the draconic origin trait below", "el tipo de daño de su origen dracónico"),
    (r"\((\w+) form only\)", lambda g: f"(solo en forma de {FORM.get(g.group(1).capitalize(), g.group(1))})"),
    (r"\bin (\w+) form\b", lambda g: f"en forma de {FORM.get(g.group(1).capitalize(), g.group(1))}"),
]


def tidy(text):
    for rx, rep in PHRASES:
        text = re.sub(rx, rep, text)
    return text


NUMBER = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8}
FORM = {"Bat": "murciélago", "Vampire": "vampiro", "Bear": "oso", "Boar": "jabalí", "Humanoid": "humanoide", "Rat": "rata", "Tiger": "tigre",
        "Wolf": "lobo", "Hybrid": "híbrida", "Object": "objeto"}
missing = set()


def ft(text):
    """«30 ft.» / «60-foot» / «1 mile» -> metros con coma decimal."""
    def m(x):
        v = round(int(x) * 0.3, 1)
        return f"{v:g}".replace(".", ",")
    text = re.sub(r"(\d+)/(\d+) ft\.?", lambda g: f"{m(g.group(1))}/{m(g.group(2))} m", text)
    text = re.sub(r"(\d+) ft\.?", lambda g: f"{m(g.group(1))} m", text)
    text = re.sub(r"(\d+)-foot", lambda g: f"{m(g.group(1))} m", text)
    return text


def monster_name(en):
    if en in MONSTER:
        return MONSTER[en]
    d = re.match(r"^(?:(Young|Adult|Ancient) )?(\w+) Dragon(?: (Wyrmling))?$", en)
    if d and d.group(2) in COLOR:
        color, metallic = COLOR[d.group(2)]
        base = f"dragón de {color}" if metallic else f"dragón {color}"
        if d.group(3):
            return f"Cría de {base}"
        age = {"Young": "joven", "Adult": "adulto", "Ancient": "anciano"}[d.group(1)]
        return f"{base[0].upper()}{base[1:]} {age}"
    g = re.match(r"^Giant (.+)$", en)
    if g and g.group(1) in MONSTER:
        return f"{MONSTER[g.group(1)]} gigante"
    missing.add(f"monstruo: {en}")
    return en


def paren(p):
    out = []
    for part in [x.strip() for x in re.split(r";", p)]:
        r = re.match(r"^Recharge (\d)(?:–(\d))?$", part)
        if r:
            out.append(f"recarga {r.group(1)}{'-' + r.group(2) if r.group(2) else ''}")
            continue
        if part == "Recharge after a Short or Long Rest":
            out.append("recarga tras descanso corto o largo")
            continue
        d = re.match(r"^(\d)/Day(?:, or (\d)/Day in Lair)?$", part)
        if d:
            out.append(f"{d.group(1)}/día" + (f", {d.group(2)}/día en guarida" if d.group(2) else ""))
            continue
        f = re.match(r"^(\w+)(?: or (\w+))? Form Only$", part)
        if f and f.group(1) in FORM:
            forms = [FORM[x] for x in f.groups() if x]
            out.append("solo en forma de " + " o ".join(forms))
            continue
        req = {"Requires Soul Bag": "requiere bolsa de almas", "Requires Magic Rope": "requiere cuerda mágica"}
        if part in req:
            out.append(req[part])
            continue
        missing.add(f"paréntesis: {part}")
        out.append(part)
    return ", ".join(out)


def entry_name(en):
    base, _, p = en.partition(" (")
    es = ENTRY.get(base)
    if es is None:
        missing.add(f"rasgo/acción: {base}")
        es = base
    return f"{es} ({paren(p.rstrip(')'))})" if p else es


def words(text, table):
    for k, v in sorted(table.items(), key=lambda kv: -len(kv[0])):
        text = re.sub(rf"\b{re.escape(k)}\b", v, text)
    return text


def languages(text):
    text = ft(text)
    for k, v in LANG:
        text = re.sub(rf"(?<![\w’]){re.escape(k)}(?![\w’])", v, text)
    return re.sub(r"\s+", " ", text).strip(" ;,")


def defenses(text):
    return words(words(text, DAMAGE), CONDITION).lower().replace(" and ", " y ")


def summarize(text):
    """Lo esencial de una entrada en castellano: ataque, salvación, daño, área y estados."""
    bits = []
    a = re.search(r"(Melee or Ranged|Melee|Ranged) Attack Roll: ([+−-]\d+)", text)
    if a:
        reach = re.search(r"reach (\d+) ft", text)
        rng = re.search(r"range ([\d/]+) ft", text)
        bits.append(f"{a.group(2).replace('−', '-')} al ataque" + (f", alcance {ft(reach.group(1) + ' ft.')}" if reach else "") + (f", distancia {ft(rng.group(1) + ' ft.')}" if rng else ""))
    s = re.search(r"(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) Saving Throw: DC (\d+)", text)
    if s:
        bits.append(f"salv. {ABILITY[s.group(1)]} CD {s.group(2)}")
    area = re.search(r"(\d+)-foot(?:-radius)? (Cone|Line|Sphere|Emanation|Cube|Cylinder)", text)
    if area:
        shape = {"Cone": "cono", "Line": "línea", "Sphere": "esfera", "Emanation": "emanación", "Cube": "cubo", "Cylinder": "cilindro"}[area.group(2)]
        bits.append(f"{shape} de {ft(area.group(1) + ' ft.')}")
    dmg = re.findall(r"\d+ \((\d+d\d+(?: [+−-] \d+)?)\) (\w+) damage", text)
    if dmg:
        bits.append(" + ".join(f"{d.replace(' ', '').replace('−', '-')} {DAMAGE.get(t, t.lower())}" for d, t in dmg[:2]))
    if s and re.search(r"Success: Half damage", text):
        bits.append("mitad si salva")
    conds = []
    for c in re.findall(r"(?<!n’t )(?<!not )(?:has|have|gains?) the (\w+) condition", text):
        if c in CONDITION and CONDITION[c] not in conds:
            conds.append(CONDITION[c])
    if conds:
        bits.append("deja " + ", ".join(conds))
    m = re.findall(r"makes (one|two|three|four|five|six|seven|eight) (.+?) attacks?", text)
    if m:
        parts = []
        for n, what in m:
            names = [entry_name(x.strip()) if x.strip() in ENTRY else None for x in re.split(r",? or |, ", what)]
            if all(names):
                parts.append(f"{NUMBER[n]} × " + " o ".join(names))
        if parts:
            bits.append("; ".join(parts))
    dc = re.search(r"spell save DC (\d+)", text)
    if dc:
        bits.append(f"CD de conjuros {dc.group(1)}")
    hit = re.search(r"\+(\d+) to hit with spell attacks", text)
    if hit:
        bits.append(f"+{hit.group(1)} a los ataques de conjuro")
    return "; ".join(bits)


def attack_of(entry):
    """Ataque con tirada para la ficha y el combate: bonificador, daño tirable y notas."""
    text = entry["text"]
    a = re.search(r"(Melee or Ranged|Melee|Ranged) Attack Roll: ([+−-]\d+)", text)
    if not a:
        return None
    dmg, cond_extra = [], []
    for mt in re.finditer(r"\d+ \((\d+d\d+(?: [+−-] \d+)?)\) (\w+) damage", text):
        after = text[mt.end():mt.end() + 12]
        (cond_extra if dmg and re.match(r"\s*(if|while|when|against)\b", after) else dmg).append((mt.group(1), mt.group(2)))
    flat = re.search(r"Hit: (\d+) (\w+) damage", text)
    notes = []
    reach = re.search(r"reach (\d+) ft", text)
    rng = re.search(r"range ([\d/]+) ft", text)
    if reach:
        notes.append(f"alcance {ft(reach.group(1) + ' ft.')}")
    if rng:
        notes.append(f"distancia {ft(rng.group(1) + ' ft.')}")
    if dmg:
        expr = "+".join(d.replace(" ", "").replace("−", "-") for d, _ in dmg[:2])
        notes.insert(0, " + ".join(DAMAGE.get(t, t.lower()) for _, t in dmg[:2]))
    elif flat:
        expr = flat.group(1)
        notes.insert(0, DAMAGE.get(flat.group(2), flat.group(2).lower()))
    else:
        expr = ""
    for d, t in cond_extra[:1]:
        notes.append(f"+{d.replace(' ', '')} {DAMAGE.get(t, t.lower())} si se cumple su condición")
    conds = [CONDITION[c] for c in re.findall(r"(?<!n’t )(?<!not )(?:has|have|gains?) the (\w+) condition", text) if c in CONDITION]
    if conds:
        notes.append("deja " + ", ".join(dict.fromkeys(conds)))
    return {"name": entry_name(entry["name"]), "bonus": num(a.group(2)), "damage": expr, "notes": " · ".join(notes)}


def save_action(entry):
    """Acción con salvación y daño (alientos, rayos…): se tira el daño, no un ataque."""
    s = re.search(r"(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) Saving Throw: DC (\d+)", entry["text"])
    dmg = re.findall(r"Failure: \d+ \((\d+d\d+(?: [+−-] \d+)?)\) (\w+) damage", entry["text"])
    if not s or not dmg or not entry["name"]:
        return None
    d, t = dmg[0]
    return {"name": entry_name(entry["name"]), "bonus": "", "save": f"{ABILITY[s.group(1)]} CD {s.group(2)}",
            "damage": d.replace(" ", "").replace("−", "-"), "notes": DAMAGE.get(t, t.lower()) + (" · mitad si salva" if "Half damage" in entry["text"] else "")}


SECTION_ES = {"Traits": "Rasgos", "Actions": "Acciones", "Bonus Actions": "Acciones adicionales", "Reactions": "Reacciones", "Legendary Actions": "Acciones legendarias"}


def translate(m):
    speeds = [ft(x.strip()) for x in m["speed"].split(",")]
    walk = re.match(r"^(\d+(?:,\d)?) m", speeds[0])
    extra = [words(x, {"Fly": "volar", "Swim": "nadar", "Climb": "trepar", "Burrow": "excavar", "hover": "levitar"}) for x in speeds[1:]]
    attacks, lines = [], []
    if m["skills"]:
        sk = words(m["skills"], SKILL)
        lines.append(f"Habilidades: {sk}.")
    if extra:
        lines.append(f"Otras velocidades: {', '.join(extra)}.")
    for key, label in (("vuln", "Vulnerabilidades"), ("resist", "Resistencias"), ("immune", "Inmunidades")):
        if m[key]:
            lines.append(f"{label}: {defenses(m[key])}.")
    if m["senses"]:
        lines.append(f"Sentidos: {words(ft(m['senses']), SENSE)}.")
    if m["languages"]:
        lines.append(f"Idiomas: {languages(m['languages'])}.")
    for sec, entries in m["sections"].items():
        items = []
        for e in entries:
            if not e["name"]:
                uses = re.search(r"Legendary Action Uses: (\d+)(?: \((\d+) in Lair\))?", e["text"])
                if uses:
                    items.append(f"{uses.group(1)} usos" + (f" ({uses.group(2)} en guarida)" if uses.group(2) else ""))
                continue
            atk = attack_of(e)
            if atk:
                attacks.append(atk)
            elif sec in ("Actions", "Bonus Actions", "Legendary Actions"):
                sv = save_action(e)
                if sv:
                    attacks.append(sv)
            info = summarize(e["text"])
            items.append(entry_name(e["name"]) + (f" ({info})" if info else ""))
        if items:
            lines.append(f"{SECTION_ES[sec]}: " + " · ".join(items) + ".")
    size = " o ".join(SIZE[s] for s in m["size"].split(" or "))
    creature = TYPE[m["type"]] + (f" ({', '.join(TAG.get(t.strip(), t.strip().lower()) for t in m['tags'].split(','))})" if m["tags"] else "")
    for t in m["tags"].split(","):
        if t.strip() and t.strip() not in TAG:
            missing.add(f"etiqueta: {t.strip()}")
    return {
        "name": monster_name(m["name"]), "en": m["name"], "cr": m["cr"], "ac": m["ac"], "hp": m["hp"], "hpDice": m["hpDice"],
        "speed": float(walk.group(1).replace(",", ".")) if walk else 0, "size": size,
        "creature": creature[0].upper() + creature[1:], "alignment": ALIGN.get(m["alignment"], m["alignment"].lower()),
        "init": m["init"], "saves": [{"str": "fue", "dex": "des", "wis": "sab", "cha": "car"}.get(k, k) for k in m["saveProf"]], "abilities": {"fue": m["abilities"]["str"], "des": m["abilities"]["dex"], "con": m["abilities"]["con"],
                                                               "int": m["abilities"]["int"], "sab": m["abilities"]["wis"], "car": m["abilities"]["cha"]},
        "attacks": attacks, "traits": tidy("\n".join(lines)),
    }


def main(pdf):
    monsters = [translate(m) for m in read_monsters(pdf)]
    monsters.sort(key=lambda x: x["name"])
    OUT.write_text(json.dumps(monsters, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{len(monsters)} monstruos -> {OUT}")
    if missing:
        print("Sin traducir:", sorted(missing))


if __name__ == "__main__":
    main(*sys.argv[1:])
