"""«Gaua gauekoentzat, eguna egunekoentzat»: la noche es para los de la noche y el día para los del día.

Tirada de la noche con criaturas de la mitología vasca (server/euskal.py): un d20 con modificadores por
la luna, la hora, el clima, las fiestas, el sitio y lo que hace el grupo. Según el total la noche pasa
tranquila, deja un presagio, trae un encuentro o despierta al propio Gaueko. Los encuentros se ajustan al
presupuesto de PX del grupo. Textos propios a partir de la mitología vasca tradicional.
"""
import random

from . import euskal, rules

TERRAINS = {  # clave: (nombre, escenario del tablero para el combate)
    "bosque": ("🌲 Bosque", "p-bosque"),
    "monte": ("⛰️ Monte y pastos", "p-campo"),
    "rio": ("🌊 Río, fuente o puente", "p-pantano"),
    "cueva": ("🕳️ Cueva o sima", "p-cueva"),
    "caserio": ("🏡 Caserío o aldea", "p-plaza"),
    "camino": ("🛤️ Camino o cruce", "p-campo"),
}
SITUATIONS = {"viaje": ("Viajan de noche", 2), "acampada": ("Acampan al raso", 0), "casa": ("Duermen bajo techo", -5)}
BANDS = [(9, "calma"), (13, "presagio"), (17, "encuentro"), (20, "peligro"), (999, "gaueko")]

CALM = [
    "La noche pasa tranquila. Solo se oye el viento entre las hayas y, muy lejos, el cencerro de una oveja.",
    "Una lechuza ulula toda la noche, pero nada se acerca. Al alba, el rocío lo cubre todo.",
    "Nada perturba el descanso. Quien hace la guardia ve cruzar una estrella fugaz.",
    "Las brasas crepitan; un zorro curioso husmea el campamento y se marcha.",
]
OMENS = {
    "*": ("Un viento helado apaga el fuego de golpe y una voz parece pronunciar vuestros nombres.",
          "Si alguien contesta o se burla de la noche, Gaueko ya sabe dónde estáis: la próxima tirada, con «han desafiado a la noche»."),
    "bosque": ("Huellas enormes de pies descalzos rodean el claro. Por la mañana, el rebaño más cercano sigue intacto.",
               "Basajaun ha pasado de guardia. Si el grupo respeta el bosque, quizá les avise de un peligro."),
    "monte": ("Ladridos de perros en el monte, cada vez más cerca y luego más lejos, aunque no se ve a ningún pastor.",
              "Son los perros del Cazador Negro (Ehiztari beltza). Mejor no gritarles nada."),
    "rio": ("En una piedra de la fuente brilla un peine de oro olvidado.",
            "Es de una lamia. Si alguien se lo lleva, la próxima noche junto al agua la lamia vendrá a reclamarlo."),
    "cueva": ("De la boca de la cueva sale un mugido grave y un aliento caliente.",
              "Algo grande duerme dentro: Aatxe, Tartalo o algo peor. Entrar de noche es buscarse problemas."),
    "caserio": ("Las gallinas cacarean a medianoche y la puerta del establo amanece abierta, con las crines de los caballos trenzadas.",
                "Travesuras de iratxos o de sorginak. Un cuenco de leche en el umbral suele calmarlos."),
    "camino": ("En el cruce flota una lucecita a la altura de un hombre que se aleja si os acercáis.",
               "Quien la sigue se extravía: Supervivencia CD 13 o el grupo pierde 1d4 horas."),
    "casa": ("Algo rasca la contraventana toda la noche; por la mañana hay tres arañazos en la puerta.",
             "Mientras nadie abra, no pasa nada más."),
}


def _e(title, text, dm, *creatures, friendly=False):
    """Encuentro: creatures son (nombre del bestiario, "uno" | "grupo"); el grupo se ajusta a los PX."""
    return {"title": title, "text": text, "dm": dm, "creatures": list(creatures), "friendly": friendly}


IRATXOS = _e("Iratxoak", "Risitas entre los helechos y lucecitas que cambian de sitio: unos iratxos han decidido divertirse con vosotros.",
             "Un cuenco de leche o un trozo de pan los deja contentos (y quizá ayuden con alguna tarea). Si se les ofende, enredan el equipo y extravían al grupo.",
             ("Iratxo", "grupo"))
GIZOTSO = _e("Gizotso", "Cadenas que se arrastran entre los árboles y un aullido que no es del todo de lobo.",
             "En luna llena no huye. De día es alguien del pueblo: buen gancho para investigar quién es.", ("Gizotso", "grupo"))
DOGS = _e("Txakur beltzak", "Una jauría de perros negros como la pez baja ladrando; sus ojos brillan como brasas.",
          "Si el grupo se tumba en el suelo y deja pasar la cacería (Sigilo en grupo CD 13), los perros siguen de largo.", ("Txakur beltza", "grupo"))
GALTZAGORRIS = _e("Galtzagorriak", "Decenas de duendecillos de calzones rojos salen de una rendija gritando «Zer egin? Zer egin?» («¿Qué hacemos?»).",
                  "Si no se les da trabajo sin parar, lo revuelven todo. El truco de siempre: encargarles algo imposible, como llevar agua en un cesto.",
                  ("Enjambre de galtzagorris", "uno"))
LAMIA = _e("Lamiña", "A la luz de la luna, una mujer se peina con un peine de oro en la orilla. Al moverse se le ven los pies de pato.",
           "Hace tratos (un puente en una noche a cambio de algo muy querido) y odia que le roben el peine. Desaparece al cantar el gallo.", ("Lamiña", "uno"))
INGUMA = _e("Inguma", "Quien duerme siente un peso en el pecho y una mano fría en la garganta: Inguma se ha colado por una rendija.",
            "Cada durmiente: salvación de Constitución CD 13 o se despierta sin el beneficio del descanso largo. Se le ahuyenta con la vieja fórmula "
            "que le manda contar las estrellas del cielo, las hierbas del campo y la arena de la playa antes de volver.", ("Inguma", "uno"))
AKELARRE = _e("Akelarre", "Arde una hoguera y varias sorginak bailan alrededor de un macho cabrío negro: es un akelarre.",
              "Interrumpirlo se paga caro; espiarlo puede revelar los secretos de la comarca. Todas huyen al primer canto del gallo.",
              ("Akerbeltz", "uno"), ("Sorgina", "grupo"))
HUNTER = _e("Ehiztari beltza", "Cuernos de caza en plena noche y una jauría de perros negros: el Cazador Negro, el cura que dejó la misa a medias por una liebre, sigue cazando para siempre.",
            "No conviene burlarse de la cacería. Se la esquiva metiéndose bajo techo o cruzando agua corriente.",
            ("Ehiztari beltza", "uno"), ("Txakur beltza", "grupo"))
TARTALO = _e("Tartalo", "Un pastor de un solo ojo, alto como un roble, os invita a resguardaros del frío en su cueva.",
             "Quiere asaros. En la leyenda un pastor lo cegó con un asador al rojo y escapó escondido bajo un carnero: premia las ideas así.", ("Tartalo", "uno"))
BASAJAUN = _e("Basajaun", "Un gigante peludo, con una melena hasta los pies y un bastón, os corta el paso.",
              "No es malvado: si el grupo le muestra respeto y no daña el bosque, avisa de un peligro cercano. Si se le ofende, lucha.", ("Basajaun", "uno"))
JENTILAK = _e("Jentilak", "Peñascos enormes cruzan el valle de monte a monte: los jentilak juegan a lanzarse piedras.",
              "Si nadie les molesta, siguen jugando. Si alguien les grita, las piedras cambian de blanco.", ("Jentil", "grupo"))
LAMIAS = _e("Lamias", "Varias lamias trabajan en silencio levantando un puente de piedra antes de que cante el gallo.",
            "Si alguien imita el canto del gallo (Interpretación CD 15), creen que amanece y huyen dejando el puente sin terminar: le faltará una piedra para siempre.",
            ("Lamiña", "grupo"))
AATXE = _e("Aatxe", "Entre relámpago y relámpago, un novillo rojo cierra el camino y muge: nadie debería estar fuera esta noche.",
           "Aatxe castiga a los malhechores y obliga a la gente honrada a volver a casa. Si el grupo da media vuelta, no ataca.", ("Aatxe", "uno"))

ENCOUNTERS = {
    "bosque": [IRATXOS, GIZOTSO], "monte": [DOGS, _e("Akerbeltz", "Un macho cabrío negro guarda un rebaño en el puerto y bala amenazante.",
                                                     "Solo ataca a quien dañe o robe el ganado. Si se le respeta, el rebaño que protege no enferma.", ("Akerbeltz", "uno"))],
    "rio": [LAMIA], "cueva": [GALTZAGORRIS, IRATXOS], "caserio": [_e("Sorginak", "Por la chimenea de un caserío abandonado sale humo verde y se oye cantar en voz baja.",
                                                                     "Si están en akelarre con Akerbeltz, añade uno. Huyen al primer canto del gallo.", ("Sorgina", "grupo")), GALTZAGORRIS],
    "camino": [GIZOTSO, DOGS], "casa": [INGUMA, GALTZAGORRIS, IRATXOS],
}
DANGERS = {
    "bosque": [HUNTER, BASAJAUN], "monte": [TARTALO, JENTILAK, HUNTER], "rio": [LAMIAS], "cueva": [TARTALO, AKELARRE],
    "caserio": [AKELARRE, INGUMA], "camino": [GIZOTSO, HUNTER], "casa": [INGUMA],
}
GAUEKO = _e("Gaueko", "El viento se para de golpe. Una sombra más negra que la noche llena el camino y una voz grave dice: "
            "«Gaua gauekoentzat, eguna egunekoentzat» (la noche, para los de la noche; el día, para los del día).",
            "Gaueko castiga a quien anda de noche sin necesidad o se burla de él. Para un grupo de nivel bajo no es un combate: "
            "salvación de Sabiduría CD 15 o Asustado hasta el amanecer, y quien lo desafió sale arrastrado por el viento (1d6 × 3 m y 3d10 de daño contundente). "
            "Volver a casa o refugiarse en una ermita lo detiene.", ("Gaueko", "uno"))
GAUEKO_DOOR = _e("Gaueko llama a la puerta", "A medianoche golpean la puerta tres veces. Fuera no hay nadie, pero el viento dice vuestros nombres.",
                 "Mientras nadie abra ni conteste, no puede entrar. Si alguien sale, Gaueko lo está esperando.")
OLENTZERO = _e("Olentzero", "Un carbonero enorme baja del monte con un saco al hombro y la cara tiznada: es Olentzero, el último de los jentilak, y viene sonriendo.",
               "Encuentro amistoso: cada personaje recibe un regalito (una poción de curación, una brasa que no se apaga, castañas asadas que dan 1d4 PG temporales). "
               "A quien se haya portado mal, solo le deja carbón.", friendly=True)
SANJUAN_LAMIAS = _e("Lamias de San Juan", "Es la noche de San Juan: en la orilla, las lamias se peinan con peines de oro y cantan bajito.",
                    "Esta noche están de buen humor: quien les hable con respeto puede pedirles un favor. A quien les robe un peine lo perseguirán siempre.",
                    ("Lamiña", "grupo"))


def modifiers(ctx: dict) -> list:
    """[(motivo, modificador)] de la tirada de la noche."""
    out = []
    terrain = ctx.get("terrain") if ctx.get("terrain") in TERRAINS else "camino"
    label, value = SITUATIONS.get(ctx.get("situation"), SITUATIONS["acampada"])
    if value:
        out.append((label, value))
    if ctx.get("moon") == "llena":
        out.append(("Luna llena: las criaturas de la noche andan inquietas", 2))
    elif ctx.get("moon") == "nueva":
        out.append(("Luna nueva: noche cerrada, la preferida de Gaueko", 1))
    if ctx.get("late"):
        out.append(("Entre la medianoche y el canto del gallo", 1))
    if ctx.get("storm"):
        out.append(("Tormenta: la noche de Aatxe", 1))
    if ctx.get("festival") == "sanjuan":
        out.append(("Hogueras de San Juan: el fuego protege el pueblo", -4) if terrain == "caserio" and ctx.get("situation") != "casa"
                   else ("Noche de San Juan: lamias y sorginak salen", 2))
    elif ctx.get("festival") == "larga":
        out.append(("La noche más larga del año", 2))
    if ctx.get("eguzkilore"):
        out.append(("Eguzkilore en la puerta: los seres de la noche tienen que contarle todos los pelillos y amanece antes", -4))
    return out


def _scale(entry, levels, target):
    """Cantidad de cada criatura: las «uno» van solas y el resto llena el presupuesto de PX hasta «target»."""
    by_name = {c["name"]: c for c in euskal.CREATURES}
    fixed = [by_name[n]["cr"] for n, mode in entry["creatures"] if mode == "uno"]
    out = []
    for name, mode in entry["creatures"]:
        cr = by_name[name]["cr"]
        count = 1
        if mode == "grupo" and levels:
            budget = rules.encounter(levels, [])["budget"][target]
            while count < 8 and rules.encounter(levels, fixed + [cr] * (count + 1))["xp"] <= budget:
                count += 1
        out.append({"name": name, "count": count, "cr": cr})
    return out


def resolve(total: int, ctx: dict, levels=(), rng=random) -> dict:
    terrain = ctx.get("terrain") if ctx.get("terrain") in TERRAINS else "camino"
    place = "casa" if ctx.get("situation") == "casa" else terrain
    band = next(name for top, name in BANDS if total <= top)
    if ctx.get("challenged"):
        band = "gaueko"
    entry = None
    if band == "gaueko":
        entry = GAUEKO_DOOR if place == "casa" else GAUEKO
    elif ctx.get("festival") == "olentzero" and band in ("encuentro", "peligro"):
        entry, band = OLENTZERO, "amistoso"
    elif ctx.get("festival") == "sanjuan" and place == "rio" and band != "calma":
        entry, band = SANJUAN_LAMIAS, "encuentro"
    elif band == "encuentro":
        entry = rng.choice(ENCOUNTERS[place])
    elif band == "peligro":
        entry = rng.choice(DANGERS[place] + ([AATXE] if ctx.get("storm") and place != "casa" else []))
    if entry is None:
        text, dm = OMENS[rng.choice([place, "*"])] if band == "presagio" else (rng.choice(CALM), "")
        return {"band": band, "title": "Un presagio" if band == "presagio" else "Noche tranquila", "text": text, "dm": dm,
                "creatures": [], "difficulty": None, "scene": TERRAINS[terrain][1], "friendly": False}
    levels = [int(x) for x in levels if str(x).isdigit()]
    creatures = _scale(entry, levels, "alto" if band in ("peligro", "gaueko") else "moderado")
    difficulty = rules.encounter(levels, [c["cr"] for c in creatures for _ in range(c["count"])]) if creatures and levels else None
    return {"band": band, "title": entry["title"], "text": entry["text"], "dm": entry["dm"], "creatures": creatures,
            "difficulty": difficulty, "scene": TERRAINS[terrain][1], "friendly": entry["friendly"]}


def info() -> dict:
    """Lo que necesita el diálogo: sitios y situaciones."""
    return {"terrains": [[k, v[0]] for k, v in TERRAINS.items()], "situations": [[k, v[0], v[1]] for k, v in SITUATIONS.items()]}
