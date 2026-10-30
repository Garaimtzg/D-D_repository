"""Descripción breve de cada especie para la ficha y el creador: cómo es ese pueblo según el trasfondo habitual
de D&D (con palabras propias), su altura típica y cuánto suele vivir. Las de Euskal Herria siguen la mitología vasca.
id de la especie: (descripción, altura, esperanza de vida)"""

SPECIES_LORE = {
    # Manual del Jugador 2024
    "aasimar": ("Mortales con una chispa de los Planos Superiores en el alma, a menudo guiados por un mensajero celestial que les habla en "
                "sueños. Parecen humanos, pero en los momentos de tensión dejan ver su origen: ojos que brillan, un halo o luz bajo la piel. "
                "Muchos se sienten llamados a enfrentarse al mal, aunque no todos lo logran.",
                "1,2-2,1 m (0,6-1,2 m si son Pequeños)", "unos 160 años"),
    "draconido": ("Descendientes de los dragones, con escamas, hocico y el aliento de su linaje (cromático, metálico o de gema). Ponen el "
                  "honor del clan por encima de todo, se exigen mucho y desprecian el fracaso. No tienen alas, pero los más veteranos "
                  "pueden desplegar unas de energía durante un rato.", "1,5-2,1 m", "unos 80 años"),
    "elfo": ("Pueblo antiguo y mágico que, según sus leyendas, nació de la sangre del dios Corellon. Viven siglos, se toman la vida con calma "
             "y recuerdan lo que otros olvidan; en vez de dormir, meditan en un trance. Sus linajes (altos elfos, elfos de los bosques y "
             "drows) se adaptaron a lugares muy distintos.", "1,5-1,8 m", "unos 750 años"),
    "enano": ("Gente recia que, según sus mitos, salió de la fragua de un dios. Viven en fortalezas excavadas en las montañas o en grandes "
              "ciudades subterráneas, valoran el buen oficio, la familia y los juramentos, y no olvidan una ofensa. Sienten la piedra "
              "como algo vivo y aguantan venenos que tumbarían a otros.", "1,2-1,5 m", "unos 350 años"),
    "gnomo": ("Pequeños, curiosos y con una energía que no se agota. Les encantan los inventos, las ilusiones, los acertijos y las bromas, "
              "y suelen vivir en madrigueras bajo colinas boscosas o en barrios de artesanos. Los gnomos del bosque hablan con los "
              "animales; los de las rocas fabrican pequeños mecanismos.", "0,9-1,2 m", "unos 400 años"),
    "goliat": ("Descendientes de los gigantes: altos, fuertes y con la piel moteada como la piedra. Llevan en la sangre un don de algún "
               "linaje gigante (de las nubes, del fuego, de la escarcha…) y pueden crecer durante un rato. Viven para superarse y lo "
               "convierten todo en una competición, también consigo mismos.", "2,1-2,4 m", "unos 80 años"),
    "humano": ("La gente más extendida y variada del multiverso. Viven poco comparados con elfos o enanos y quizá por eso son ambiciosos, "
               "inquietos y capaces de adaptarse a cualquier lugar: fundan reinos, cambian de costumbres de una generación a otra y se "
               "mezclan con todos.", "1,2-2,1 m (0,6-1,2 m si son Pequeños)", "menos de 100 años"),
    "mediano": ("Gente menuda, afable y con una suerte famosa. Prefieren la vida tranquila de la aldea, la buena mesa y los amigos, pero "
                "cuando algo amenaza a los suyos sacan un valor sorprendente. Pasan desapercibidos con facilidad y se esconden detrás "
                "de cualquiera más grande.", "0,6-0,9 m", "unos 150 años"),
    "orco": ("Según su tradición, el dios Gruumsh los creó para recorrer el mundo y aguantar donde otros caen. Son fuertes, resisten lo "
             "que haga falta y pueden lanzarse a la carrera con una descarga de adrenalina. Muchos viven entre otros pueblos como "
             "guardias, exploradores o artesanos, y valoran la resistencia y la lealtad.", "1,8-2,1 m", "como los humanos, unos 80 años"),
    "tiefling": ("Personas marcadas por la herencia de los Planos Inferiores: cuernos, cola, ojos de colores llamativos y un legado "
                 "infernal, abisal o ctónico que les da magia. Muchos cargan con la desconfianza de los demás, pero su sangre no decide "
                 "su destino.", "1,2-2,1 m (0,9-1,2 m si son Pequeños)", "algo más que los humanos"),
    # Manual para casi todo: Monstruos del Multiverso
    "aarakocra": ("Gente pájaro del Plano Elemental del Aire, con alas, plumas y garras. Aman el cielo abierto, se agobian bajo techo y "
                  "llevan mal pasar mucho tiempo en tierra; muchos vigilan las alturas al servicio de los Señores del Viento.",
                  "unos 1,5 m (y muy ligeros)", "unos 30 años"),
    "osgo": ("Goblinoides grandes, peludos y de brazos largos que, según la leyenda, vinieron de los Parajes Feéricos. A pesar de su "
             "tamaño se mueven en silencio, adoran las emboscadas y alcanzan más lejos de lo que parece.", "1,8-2,4 m", "unos 80 años"),
    "centauro": ("Mitad humanoides y mitad caballos, unidos a los Parajes Feéricos y a las llanuras salvajes. Viajan en manadas, son "
                 "veloces y fuertes, y llevan mal los espacios cerrados y las escaleras.", "1,8-2,1 m hasta la cabeza", "unos 100 años"),
    "cambiaformas": ("Descendientes de licántropos que llevan una bestia dentro: durante un rato pueden dejarla salir y volverse más "
                     "salvajes, con garras, colmillos o la piel más dura según su linaje. Suelen ser independientes y vivir cerca de la "
                     "naturaleza.", "1,5-1,8 m", "unos 70 años"),
    "cambiante": ("Pueden cambiar de aspecto a voluntad y adoptar la cara y la voz de otras personas; su forma real es pálida y de rasgos "
                  "difusos. Muchos llevan varias identidades a la vez y viven entre otros pueblos sin que nadie lo sepa.",
                  "1,5-1,8 m", "como los humanos"),
    "duergar": ("Enanos de la Infraoscuridad endurecidos por siglos de esclavitud bajo los azotamentes. Son sombríos, desconfiados y muy "
                "trabajadores, y conservan poderes psiónicos que les dejan crecer o volverse invisibles un momento.",
                "1,2-1,5 m", "unos 350 años"),
    "eladrin": ("Elfos de los Parajes Feéricos que cambian con las estaciones: su ánimo y su magia pasan de la alegría de la primavera a "
                "la melancolía del otoño o la frialdad del invierno. Saltan distancias cortas a través del mundo feérico.",
                "1,5-1,8 m", "unos 750 años"),
    "elfo_mar": ("Elfos que aprendieron a vivir bajo las olas: respiran agua y aire, nadan como peces y se entienden con las criaturas "
                 "marinas. Desconfían de la gente de la superficie que ensucia sus aguas.", "1,5-1,8 m", "unos 750 años"),
    "firbolg": ("Gigantes menores de los bosques, amables y discretos, que prefieren pasar desapercibidos y cuidar de la naturaleza. "
                "Hablan con plantas y animales y pueden volverse invisibles un momento.", "1,8-2,4 m", "unos 500 años"),
    "genasi": ("Mortales con sangre de genios en los que se nota su elemento: los de aire tienen el pelo como una brisa, los de tierra la "
               "piel como la piedra, los de fuego el cabello en llamas y los de agua la piel siempre húmeda. Cada uno lleva un poco de "
               "magia elemental.", "1,5-1,8 m", "unos 120 años"),
    "githyanki": ("Antiguos esclavos de los azotamentes que se liberaron y se asentaron en el Plano Astral. Son guerreros disciplinados, "
                  "orgullosos y despiadados con sus enemigos, montan dragones rojos y dominan poderes psiónicos.",
                  "1,5-1,8 m", "unos 100 años"),
    "githzerai": ("Los otros herederos de la rebelión contra los azotamentes: eligieron una vida monástica en el Limbo, donde ordenan el "
                  "caos con la mente. Son serenos, austeros y muy disciplinados.", "1,5-1,8 m", "unos 100 años"),
    "gnomo_profundidades": ("Gnomos de la Infraoscuridad (svirfneblin), serios y cautos por necesidad. Su piel gris se confunde con la "
                            "roca, adoran las gemas y saben ocultarse y engañar a la vista de sus enemigos.", "0,9-1,2 m", "unos 250 años"),
    "goblin": ("Goblinoides pequeños, astutos y escurridizos, a menudo sometidos por sus primos más grandes. Sacan partido de su tamaño: "
               "se esconden, se escapan y castigan a quien los subestima.", "0,9-1,2 m", "unos 60 años"),
    "hada": ("Pequeñas criaturas de los Parajes Feéricos con alas de insecto o de mariposa y una magia caprichosa. Son curiosas, alegres "
             "y algo imprevisibles; para ellas las promesas y los nombres tienen poder.", "0,6-1,2 m", "muy variable: algunas viven siglos"),
    "harengon": ("Gente conejo de los Parajes Feéricos, de reflejos rápidos y piernas poderosas. Son alegres, inquietos y amantes de la "
                 "libertad, y siempre parecen tener la suerte de su parte cuando hay que esquivar.", "0,6-1,8 m", "como los humanos"),
    "hobgoblin": ("Goblinoides disciplinados, organizados en legiones y con un fuerte sentido del honor y de la jerarquía. Ayudan a sus "
                  "aliados con una suerte feérica heredada y rinden más cuando luchan en equipo.", "1,5-1,8 m", "como los humanos"),
    "kenku": ("Gente cuervo sin alas que, según la leyenda, perdió su propia voz y solo puede imitar los sonidos que oye. Tienen una "
              "memoria prodigiosa, copian con facilidad y hablan con frases y ruidos prestados.", "1,2-1,5 m", "unos 60 años"),
    "kobold": ("Pequeños reptiles emparentados con los dragones, a los que veneran. Trabajan en grupo, preparan trampas ingeniosas y se "
               "apoyan unos en otros para compensar su tamaño.", "0,6-0,9 m", "unos 120 años"),
    "hombre_lagarto": ("Reptiles de los pantanos con una mente práctica y fría: ven el mundo en términos de comida, amenaza y "
                       "supervivencia. Aprovechan todo lo que cazan, nadan muy bien y su piel escamosa les sirve de armadura.",
                       "1,5-1,8 m", "unos 60 años"),
    "minotauro": ("Gente toro de gran fuerza, con cuernos que usan para embestir. En muchos mundos tienen culturas marineras o guerreras "
                  "muy orgullosas; otros cargan con la leyenda del laberinto.", "1,8-2,1 m", "como los humanos"),
    "satiro": ("Feéricos con cuernos y patas de cabra, amantes de la música, el vino y la fiesta. Son ágiles, saltan mucho y resisten "
               "bien la magia.", "1,2-1,8 m", "como los humanos"),
    "shadar_kai": ("Elfos unidos al Páramo Sombrío, pálidos y de ánimo sombrío, al servicio de la Reina Cuervo. La sombra les deja "
                   "desvanecerse y aparecer en otro lugar.", "1,5-1,8 m", "unos 750 años"),
    "tabaxi": ("Gente felina curiosa por naturaleza: coleccionan historias, objetos raros y secretos. Son veloces en ráfagas cortas, "
               "trepan con sus garras y ven bien en la penumbra.", "1,5-1,8 m", "como los humanos"),
    "tortuga": ("Gente tortuga que lleva la casa a cuestas: su caparazón los protege y les deja dormir en cualquier parte. Les gusta "
                "viajar y conocer mundo.", "1,5-1,8 m", "unos 50 años"),
    "triton": ("Guardianes de las profundidades del océano, venidos del Plano Elemental del Agua. Son nobles y algo altivos con la gente "
               "de la superficie, y dominan una magia de agua y viento.", "1,5-1,8 m", "unos 200 años"),
    "yuan_ti": ("Humanoides con rasgos de serpiente, herederos de antiguos imperios entregados a dioses serpiente. Resisten la magia y "
                "el veneno y suelen ser fríos y calculadores.", "1,5-1,8 m", "como los humanos"),
    # Manual para casi todo: otros libros
    "buhonido": ("Gente búho de los Parajes Feéricos, con plumas que apagan el ruido y alas para planear. Son estudiosos y nocturnos, "
                 "y ven bien en la oscuridad.", "0,9-2,1 m", "como los humanos"),
    "grung": ("Ranas pequeñas y venenosas de las selvas, con una sociedad dividida en castas según el color de la piel. Necesitan "
              "mantenerse húmedas para estar bien.", "unos 0,9 m", "unos 50 años"),
    "locathah": ("Gente pez de las costas, resistente y orgullosa, que ha sufrido el yugo de otros pueblos del mar. Respiran bajo el "
                 "agua y fuera de ella necesitan humedad.", "1,5-1,8 m", "unos 80 años"),
    "verdan": ("Goblinoides transformados por una magia caótica: su piel es verde y su cuerpo sigue cambiando con los años. Son curiosos "
               "y sociables y se comunican con facilidad por telepatía.", "0,9-1,8 m (crecen con la edad)",
               "desconocida: su pueblo es muy reciente"),
    "semielfo": ("Hijos de humanos y elfos con un pie en cada mundo: heredan la gracia élfica y la ambición humana. Suelen hacer de "
                 "puente entre pueblos, aunque a veces no se sienten de ninguno.", "1,5-1,8 m", "unos 180 años"),
    "semiorco": ("Hijos de humanos y orcos, fuertes y muy resistentes. A menudo tienen que demostrar más que los demás y muchos se ganan "
                 "su sitio como guerreros, guardias o aventureros.", "1,5-2,1 m", "unos 75 años"),
    "leonido": ("Gente león de las llanuras de Theros, orgullosa y valiente, que vive en manadas. Su rugido hace temblar a sus enemigos.",
                "1,8-2,1 m", "unos 100 años"),
    "loxodon": ("Gente elefante de Ravnica, serena, paciente y de memoria enorme. Su piel gruesa los protege, usan la trompa como una "
                "mano más y viven mucho.", "2,1-2,4 m", "unos 450 años"),
    "hibrido_simic": ("Humanoides modificados por los magos biólogos del gremio Simic de Ravnica, con injertos animales: aletas, garras, "
                      "membranas para planear o caparazón.", "1,5-1,8 m", "como la especie de la que vienen"),
    "vedalken": ("Gente de piel azul de Ravnica, analítica y perfeccionista: para ellos todo se puede mejorar. Son serenos, curiosos y "
                 "desconfían de la improvisación.", "1,8-2 m", "unos 350 años"),
    "dhampiro": ("Mortales tocados por el vampirismo sin llegar a ser muertos vivientes. Sienten sed de la vitalidad ajena, trepan por "
                 "paredes y techos y muerden para recuperar fuerzas.", "según su pueblo de origen", "indefinida: apenas envejecen"),
    "sangre_maldita": ("Personas transformadas por el pacto con una bruja: les crecen rasgos de bruja y pueden fabricar un talismán "
                       "mágico. Muchas buscan entender quién les dio su poder y a qué precio.", "según su pueblo de origen",
                       "indefinida: dejan de envejecer"),
    "renacido": ("Personas que murieron y volvieron, con recuerdos rotos de su vida anterior. No necesitan comer ni dormir como los "
                 "demás y a veces recuperan de golpe un saber olvidado.", "según su pueblo de origen", "desconocida"),
    # Euskal Herria (material propio, basado en la mitología vasca)
    "jentil": ("Los jentilak de la mitología vasca: gigantes paganos de los montes que levantaron dólmenes y lanzaban rocas de cumbre a "
               "cumbre. Cuenta la leyenda que desaparecieron cuando llegó el cristianismo, pero en esta mesa siguen vivos: fuertes, "
               "orgullosos y unidos a sus montañas.", "2-2,4 m", "unos 200 años"),
    "lamina": ("Las lamiak, espíritus de ríos, fuentes y cuevas con pies de ánade. Se peinan con peines de oro a la orilla del agua, "
               "levantan puentes y caseríos en una sola noche y ayudan a quien las respeta, pero no perdonan a quien les roba.",
               "1,2-1,8 m (0,9-1,2 m si son Pequeñas)", "siglos: son espíritus"),
    "basajaun": ("Los señores del bosque: grandes, peludos y de andar firme por el monte. Protegen los rebaños y avisan a los pastores con "
                 "su grito cuando se acerca una tormenta o el lobo; la leyenda cuenta que San Martín Txiki les robó el secreto del trigo y de la sierra.",
                 "1,9-2,3 m", "siglos"),
    "iratxo": ("Los iratxoak, duendecillos traviesos de la casa y del monte. De noche hacen las faenas de quien los acoge… o lo revuelven "
               "todo si se aburren; son escurridizos y difíciles de atrapar.", "0,6-0,9 m", "siglos: son espíritus"),
}
