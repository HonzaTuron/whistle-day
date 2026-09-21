/**
 * Spanish pages for organising a padel tournament.
 *
 * Spain and Spanish-speaking America search for this in different words —
 * pista and cancha, cuadro and llave — and they are the same day. These pages
 * answer that search and then hand the wizard the format the page was about.
 *
 * Americano and mexicano are absent on purpose. They rotate partners and score
 * individuals, which Whistle.day does not generate. A page that wins "americano
 * pádel" and then cannot draw one costs more than it earns.
 *
 * Every count comes from the same functions the wizard quotes. The labels are
 * Spanish; the arithmetic is not retyped.
 */

import { roundTitle } from "../lib/bracket";
import { translate, type MessageKey, type Vars } from "../lib/i18n";
import {
  combinations,
  estimate,
  formatDuration,
  knockoutMatches,
  poolCount,
  poolSizes,
  presetById,
  type PresetId,
} from "../lib/presets";
import { bracketSize, byeCount, knockoutRounds, matchesEach, roundRobinRounds } from "./shape";
import type { Fact, Page } from "./types";

const es = (key: MessageKey, vars?: Vars) => translate("es", key, vars);

const GROUPS_PAIRS = 16;
const KNOCKOUT_PAIRS = 16;
const ROBIN_PAIRS = 8;

const CTA_NOTE =
  "Gratis, y no hay que crear una cuenta antes. Un minuto hasta el código QR.";

function path(teams: number): string {
  const rounds = knockoutRounds(teams);
  return Array.from({ length: rounds }, (_, i) => roundTitle(es, rounds - i)).join(" → ");
}

/** "unas 6 h 45 min en 2 pistas" — two courts, same assumption as the English pages. */
function duration(preset: PresetId, teams: number, courts = 2): string {
  const { minutes } = estimate(presetById(preset), teams, courts);
  const place = courts === 1 ? "pista" : "pistas";
  return `${formatDuration(es, minutes)} en ${courts} ${place}`;
}

function timeFact(preset: PresetId, teams: number): Fact {
  return {
    label: "Duración aproximada",
    value: duration(preset, teams),
    note: "25 minutos por partido, pistas en paralelo. En América la pista es la cancha: el mismo cuadrado.",
  };
}

function groupsFacts(pairs: number): Fact[] {
  const sizes = poolSizes(pairs);
  const even = sizes.every((size) => size === sizes[0]);
  const shape = even
    ? `${sizes.length} grupos de ${sizes[0]}`
    : `${sizes.length} grupos de ${sizes.join(", ")}`;
  return [
    {
      label: "Grupos",
      value: String(poolCount(pairs)),
      note: shape,
    },
    {
      label: "Partidos",
      value: String(presetById("groups").matches(pairs)),
      note: "Los de grupo más la eliminatoria que alimentan.",
    },
    {
      label: "Partidos asegurados",
      value: String(Math.min(...sizes) - 1),
      note: "Antes de que alguien pueda quedar afuera.",
    },
    timeFact("groups", pairs),
  ];
}

function knockoutFacts(pairs: number): Fact[] {
  const byes = byeCount(pairs);
  return [
    {
      label: "Partidos",
      value: String(knockoutMatches(pairs)),
      note: pairs >= 4 ? "Incluye el partido por el tercer puesto." : undefined,
    },
    {
      label: "Rondas",
      value: String(knockoutRounds(pairs)),
      note: path(pairs),
    },
    {
      label: "Byes",
      value: String(byes),
      note:
        byes === 0
          ? `${pairs} es potencia de dos, así que nadie se salta la primera ronda.`
          : `${byes} ${byes === 1 ? "pareja pasa" : "parejas pasan"} directo a la segunda ronda — el cuadro es de ${bracketSize(pairs)}.`,
    },
    timeFact("knockout", pairs),
  ];
}

function robinFacts(pairs: number): Fact[] {
  return [
    {
      label: "Partidos",
      value: String(combinations(pairs)),
      note: "Cada pareja se cruza una vez.",
    },
    {
      label: "Partidos cada una",
      value: String(matchesEach(pairs)),
      note: "Los mismos para todas, gane quien gane.",
    },
    {
      label: "Rondas",
      value: String(roundRobinRounds(pairs)),
      note:
        pairs % 2 === 0
          ? "Todas juegan en cada ronda."
          : "Un número impar deja a una pareja sin jugar cada ronda.",
    },
    timeFact("everyone", pairs),
  ];
}

const handoff = (preset: PresetId, teams: number) => ({
  preset,
  teams,
  sport: "padel",
  lang: "es" as const,
});

export const PADEL_ES_PAGES: Page[] = [
  {
    slug: "organizar-torneo-de-padel",
    kind: "guide",
    locale: "es",
    title: "Organizar un torneo de pádel: formatos, sorteo y pantalla",
    h1: "Cómo organizar un torneo de pádel",
    description:
      "Organiza un torneo de pádel por parejas: grupos y cuadro, eliminación directa o todos contra todos. Sorteo gratis y pantalla en el club.",
    lede:
      "Parejas fijas, el sorteo en un minuto, y la pantalla del club al día. Tres formatos que se pueden armar de verdad — y el americano, que no.",
    generator: handoff("groups", GROUPS_PAIRS),
    cta: "Crear el torneo",
    ctaNote: "Grupos y cuadro, el formato de un sábado de club. " + CTA_NOTE,
    howTo: [
      {
        name: "Anota las parejas",
        text: "Cada pareja es un equipo con dos nombres. El orden en que las anotas es el de cabezas de serie.",
      },
      {
        name: "Elige el formato",
        text: "Grupos y cuadro si quieres que todas jueguen varias veces. Cuadro directo si el día es corto. Todos contra todos si el campo es chico.",
      },
      {
        name: "Reparte las pistas",
        text: "En España se dice pista y en gran parte de América, cancha. Es el mismo sitio: pon las que tengas y el día se calcula contra ese número.",
      },
      {
        name: "Carga los resultados desde el teléfono",
        text: "El marcador se anota set a set al lado de la pista. No hace falta una cuenta para quien arbitra: un código QR basta.",
      },
      {
        name: "Deja la pantalla sola",
        text: "El enlace del proyector muestra qué se juega en cada pista, las tablas y el cuadro, y se actualiza solo.",
      },
    ],
    sections: [
      {
        heading: "Tres formatos, tres botones",
        body: [
          "El formato no es un detalle de la página: es lo que el botón de abajo le entrega al asistente. Cada variante abre el sorteo ya elegido, con pádel marcado, en español aunque el portátil esté en inglés.",
          "[Grupos y cuadro](/torneo-padel-grupos-y-cuadro) es el sábado de club: todas las parejas juegan unas cuantas veces y los dos primeros de cada grupo siguen. Es el que recomienda esta página, y el botón de arriba arma ese.",
          "[Cuadro eliminatorio](/cuadro-eliminatorio-padel) — la llave, si lo buscas así — es el día corto. Se pierde una vez y se acabó. Sirve cuando hay pocas pistas o el horario no da para grupos.",
          "[Todos contra todos](/torneo-padel-todos-contra-todos) es para un campo chico, del orden de ocho parejas. Una sola tabla, nadie se va a casa después de dos partidos.",
        ],
      },
      {
        heading: "Parejas, no jugadores sueltos",
        body: [
          "Una pareja de pádel se anota como un equipo con dos integrantes. El sorteo, las tablas y el cuadro trabajan sobre la pareja, que es lo que compite en un torneo de parejas fijas.",
          "El americano y el mexicano rotan de compañero cada ronda y puntúan a la persona, no a la pareja. Whistle.day no los genera. Si ese es el día que vas a dirigir, esta no es la herramienta: un botón que promete un americano y abre un cuadro de parejas fijas es peor que no tener página.",
        ],
      },
      {
        heading: "La pantalla del club",
        body: [
          "Casi todos los clubes ya tienen una pantalla. Apúntala al enlace del proyector y muestra qué hay en cada pista, las tablas y el cuadro, rotando sola. Desde el teléfono decides qué paneles salen y el cambio se ve al momento.",
          "La luz es el fondo por defecto. Un proyector no tiene negro: con las luces del club encendidas, una pantalla oscura se lava y se lleva el texto.",
        ],
      },
    ],
    faq: [
      {
        q: "¿Puedo organizar un americano o un mexicano?",
        a: "No. Esos formatos rotan de compañero y puntúan individuos, y Whistle.day no los genera. Grupos, cuadro y todos contra todos, con parejas fijas, sí.",
      },
      {
        q: "¿Pista o cancha?",
        a: "Las dos palabras nombran el mismo sitio. En España se dice pista; en Argentina, México, Chile y gran parte de América, cancha. En la app el nombre por defecto es cancha, y se puede renombrar a Pista 1 antes de empezar.",
      },
      {
        q: "¿Cuántas parejas puedo anotar?",
        a: "No hay tope. Dieciséis parejas en grupos salen como cuatro grupos de cuatro; los números se recalculan para las que anotes.",
      },
      {
        q: "¿Hace falta una cuenta?",
        a: "No para armar el día ni para cargar resultados. Un correo sirve después, si quieres recuperar el torneo en otro teléfono.",
      },
    ],
    related: [
      "torneo-padel-grupos-y-cuadro",
      "cuadro-eliminatorio-padel",
      "torneo-padel-todos-contra-todos",
      "generador-torneo-padel",
      "padel-tournament-generator",
    ],
  },

  {
    slug: "generador-torneo-padel",
    kind: "sport",
    locale: "es",
    title: "Generador de torneos de pádel: sorteo, tablas y pantalla",
    h1: "Generador de torneos de pádel",
    description:
      "Genera el sorteo de un torneo de pádel para cualquier número de parejas, repártelo en las pistas y muestra los resultados en vivo. Gratis.",
    lede:
      "Cualquier número de parejas, en grupos o en cuadro, repartidas en las pistas del club. Los resultados entran desde el teléfono y la pantalla se actualiza sola.",
    generator: handoff("groups", GROUPS_PAIRS),
    facts: groupsFacts(GROUPS_PAIRS),
    cta: "Crear el sorteo",
    ctaNote: CTA_NOTE,
    alternate: { hreflang: "en", slug: "padel-tournament-generator" },
    sections: [
      {
        heading: "Lo que arma, con dieciséis parejas",
        body: [
          "Dieciséis parejas es el ejemplo de arriba porque es el campo que un club reconoce: cuatro grupos de cuatro, tres partidos cada una, y un cuadro con los dos primeros de cada grupo. No es un tope. Anotas las que tengas y el asistente vuelve a cotizar partidos y horas contra esas y contra las pistas que pusiste.",
          "El botón abre ese formato — grupos y luego cuadro — con pádel ya elegido. Si el día es más corto, el mismo asistente tiene el cuadro directo y el todos contra todos; no estás encerrado en lo que decía la página.",
        ],
      },
      {
        heading: "Parejas fijas",
        body: [
          "Una pareja se anota como un equipo. El sorteo no reparte jugadores sueltos, así que un americano — compañero nuevo cada ronda, puntos al individuo — no sale de aquí. Si eso es lo que buscas, esta página no es la respuesta.",
        ],
      },
      {
        heading: "Del teléfono a la pantalla",
        body: [
          "Quien dirige el día no necesita un escritorio. Pone un partido en una pista, lo marca en vivo y carga el resultado set a set. La pantalla del club, apuntada al enlace, enseña las tablas y el cuadro sin que nadie la maneje.",
        ],
      },
    ],
    faq: [
      {
        q: "¿Genera un americano?",
        a: "No. El americano rota de compañero y puntúa individuos. Este generador sortea parejas fijas: grupos, cuadro o todos contra todos.",
      },
      {
        q: "¿Sirve en España y en América?",
        a: "Sí. Es el mismo torneo: en España la cancha se llama pista, y el nombre de cada una se puede cambiar. El texto de la app está en un español que se lee en los dos lados.",
      },
    ],
    related: [
      "organizar-torneo-de-padel",
      "torneo-padel-grupos-y-cuadro",
      "cuadro-eliminatorio-padel",
      "torneo-padel-todos-contra-todos",
      "padel-tournament-generator",
    ],
  },

  {
    slug: "torneo-padel-grupos-y-cuadro",
    kind: "format",
    locale: "es",
    title: "Torneo de pádel por grupos y cuadro: sorteo gratis",
    h1: "Torneo de pádel: grupos y cuadro",
    description:
      "Fase de grupos y eliminatoria para un torneo de pádel. Dieciséis parejas salen en cuatro grupos de cuatro, con los dos primeros al cuadro. Gratis.",
    lede:
      "Todas las parejas juegan unas cuantas veces, y los dos primeros de cada grupo siguen en el cuadro. Es el formato de un sábado de club, y el que esta página arma.",
    generator: handoff("groups", GROUPS_PAIRS),
    facts: groupsFacts(GROUPS_PAIRS),
    cta: "Crear grupos y cuadro",
    ctaNote: CTA_NOTE,
    sections: [
      {
        heading: "Por qué es el formato del sábado",
        body: [
          "Un cuadro directo manda a casa a la mitad del campo después de un partido. En un club eso es un mal sábado: la gente vino a jugar. Los grupos garantizan tres partidos a cada pareja de un grupo de cuatro, y el cuadro de después sigue teniendo una final.",
          "Con dieciséis parejas son cuatro grupos de cuatro. Ocho clasifican — los dos primeros de cada grupo — y el cuadro que les espera es de cuartos, semifinales, final y el partido por el tercer puesto. Doce parejas salen en tres grupos de cuatro: el asistente reparte lo que anotes y vuelve a decir cuántos partidos son.",
        ],
      },
      {
        heading: "Lo que decide la tabla",
        body: [
          "Dos parejas iguales en partidos ganados es el resultado normal de un grupo de cuatro, y los sets las separan. Cargar el marcador set a set, no solo quién ganó, es lo que hace defendible la tabla que luego siembra el cuadro.",
          "El desempate mira primero los puntos, después cómo les fue entre ellas, y después la diferencia de sets. Es el orden con el que el pádel abre, y se puede cambiar antes de empezar si el reglamento del club dice otra cosa.",
        ],
      },
    ],
    faq: [
      {
        q: "¿Cuántos partidos son dieciséis parejas?",
        a: "Los de arriba: los de los cuatro grupos de cuatro, más el cuadro de los ocho que clasifican, incluido el tercer puesto.",
      },
      {
        q: "¿Y si no somos dieciséis?",
        a: "El botón no te encierra en dieciséis. Anotas las parejas que hay y el formato se vuelve a cotizar. Por debajo de seis, los grupos no alcanzan y el asistente ofrece otra cosa.",
      },
    ],
    related: [
      "organizar-torneo-de-padel",
      "generador-torneo-padel",
      "cuadro-eliminatorio-padel",
      "torneo-padel-todos-contra-todos",
    ],
  },

  {
    slug: "cuadro-eliminatorio-padel",
    kind: "format",
    locale: "es",
    title: "Cuadro eliminatorio de pádel: llave y sorteo gratis",
    h1: "Cuadro eliminatorio de pádel",
    description:
      "Arma la llave de un torneo de pádel: eliminación directa, byes si el campo no es potencia de dos, y el tercer puesto. Gratis, sin cuenta.",
    lede:
      "Se pierde una vez y se acabó. El día más corto que un campo de pádel puede tener, y el que menos juega quien queda mal sorteado.",
    generator: handoff("knockout", KNOCKOUT_PAIRS),
    facts: knockoutFacts(KNOCKOUT_PAIRS),
    cta: "Crear el cuadro",
    ctaNote: CTA_NOTE,
    sections: [
      {
        heading: "Dieciséis parejas llenan el cuadro",
        body: [
          "Dieciséis es potencia de dos, así que el cuadro está lleno: todas juegan octavos y nadie tiene un bye. Es el caso limpio. El camino es octavos, cuartos, semifinales y final, más el partido por el tercer puesto.",
          "Doce parejas no llenan un cuadro de dieciséis, así que cuatro pasan directo a cuartos — los byes van a las cabezas de serie, arriba del sorteo, que es la única colocación que no lo deforma. El botón abre la eliminación directa; las parejas que anotes deciden si hay byes.",
        ],
      },
      {
        heading: "Llave, cuadro, la misma cosa",
        body: [
          "En España se dice cuadro. En gran parte de América se busca como llave. Es el mismo dibujo: una pareja, un camino, y quien pierde se va. No es un americano. El americano no tiene cuadro porque el compañero cambia cada ronda.",
        ],
      },
      {
        heading: "El día no se paraleliza al final",
        body: [
          "Una ronda de eliminación no empieza hasta que termina la anterior, así que la duración de arriba es optimista de una forma en que la de un todos contra todos no lo es. Las últimas rondas corren en menos pistas. Dos pistas es la suposición; una sola casi lo duplica.",
        ],
      },
    ],
    faq: [
      {
        q: "¿Cuántos byes hay con doce parejas?",
        a: `${byeCount(12)}. El cuadro se dibuja a ${bracketSize(12)} y las ${byeCount(12)} plazas libres son byes para las cabezas de serie, que entran en cuartos.`,
      },
      {
        q: "¿Incluye el tercer puesto?",
        a: "Sí, a partir de cuatro parejas. Es un partido más, no una ronda más: comparte ronda con la final.",
      },
    ],
    related: [
      "organizar-torneo-de-padel",
      "torneo-padel-grupos-y-cuadro",
      "generador-torneo-padel",
      "torneo-padel-todos-contra-todos",
    ],
  },

  {
    slug: "torneo-padel-todos-contra-todos",
    kind: "format",
    locale: "es",
    title: "Torneo de pádel todos contra todos: horario y tabla",
    h1: "Torneo de pádel todos contra todos",
    description:
      "Todos contra todos para un torneo de pádel: cada pareja juega contra cada una, con tabla en vivo. Ocho parejas son 28 partidos. Gratis.",
    lede:
      "Una sola tabla, sin eliminatoria. Cada pareja juega contra cada una y la tabla decide. El formato que cabe cuando el campo es chico y el punto del día es jugar.",
    generator: handoff("everyone", ROBIN_PAIRS),
    facts: robinFacts(ROBIN_PAIRS),
    cta: "Crear todos contra todos",
    ctaNote: CTA_NOTE,
    sections: [
      {
        heading: "Ocho parejas es el tamaño que cabe",
        body: [
          `Ocho parejas son ${combinations(ROBIN_PAIRS)} partidos, ${matchesEach(ROBIN_PAIRS)} cada una. En cuatro pistas es una mañana larga y defendible. Dieciséis parejas todos contra todos son ${combinations(16)} partidos: el asistente lo arma si lo pides, y la cotización te va a decir que no cabe en un día. Esta página usa ocho porque es el campo para el que el formato es la respuesta, no el problema.`,
          "Si quieres una final además de la tabla, el mismo campo puede correr como grupos y cuadro. Es el otro botón, no una casilla escondida.",
        ],
      },
      {
        heading: "La tabla es el trofeo",
        body: [
          "Sin cuadro, la diferencia de sets es lo que separa a dos parejas con las mismas victorias. Cargar el marcador de verdad, no solo el ganador, es lo que hace que la tabla final se pueda defender en la puerta del club.",
        ],
      },
    ],
    faq: [
      {
        q: "¿Cuántos partidos son ocho parejas?",
        a: "Veintiocho. Cada pareja se cruza una vez, y cada una juega siete.",
      },
      {
        q: "¿Y si somos un número impar?",
        a: "Alguien descansa cada ronda. El sorteo lo deja escrito; no es un hueco que tengas que resolver a mano.",
      },
    ],
    related: [
      "organizar-torneo-de-padel",
      "torneo-padel-grupos-y-cuadro",
      "generador-torneo-padel",
      "cuadro-eliminatorio-padel",
    ],
  },
];

/**
 * How the same day gets searched. The canonical page is the one above; these
 * redirect. Americano is not here — there is no page to send it to.
 */
export const PADEL_ES_ALIASES: Record<string, string> = {
  "organizar-torneo-padel": "organizar-torneo-de-padel",
  "como-organizar-un-torneo-de-padel": "organizar-torneo-de-padel",
  "torneo-de-padel-por-parejas": "organizar-torneo-de-padel",
  "generador-de-torneos-de-padel": "generador-torneo-padel",
  "sorteo-torneo-de-padel": "generador-torneo-padel",
  "sorteo-torneo-padel": "generador-torneo-padel",
  "cuadro-de-padel": "cuadro-eliminatorio-padel",
  "llave-de-padel": "cuadro-eliminatorio-padel",
  "llave-eliminatoria-padel": "cuadro-eliminatorio-padel",
  "todos-contra-todos-padel": "torneo-padel-todos-contra-todos",
};
