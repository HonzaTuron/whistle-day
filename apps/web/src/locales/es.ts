import type { Catalog, Message } from "../lib/i18n";

/**
 * Spanish, for Spain and Spanish-speaking America, in one catalog.
 *
 * Typed as `Record<keyof Catalog, Message>`, so a key added to `en.ts` and
 * forgotten here is a compile error. Nothing is stubbed: an English sentence
 * on a Spanish screen is worse than a wrong one, because nobody reports it.
 *
 * **One language, two continents.** `es-ES` and `es-AR` are the same locale
 * here. The wording is the overlap: tú, never vosotros and never vos. A phone
 * is a teléfono, not a móvil or a celular. The place a match is played is a
 * cancha in the app — understood in a hall on either side of the Atlantic —
 * and a padel page may still say pista, which is what a Spanish club calls
 * the same square. Pádel keeps the accent.
 *
 * **Plurals.** Spanish has the English two: `one` is 1, `other` is 0 and 2
 * up. A form that is right for 1 is wrong for 0.
 */
export const es: Record<keyof Catalog, Message> = {
  // -------------------------------------------------------------------------
  // shared
  // -------------------------------------------------------------------------
  "common.loading": "Cargando…",
  "common.done": "Listo",
  "common.back": "Atrás",
  "common.close": "Cerrar",
  "common.dismiss": "Cerrar",
  "common.cancel": "Cancelar",
  "common.retry": "Reintentar",
  "common.remove": "Quitar",
  "common.keep": "Dejarlo",
  "common.copy": "Toca para copiar",
  "common.copied": "Copiado",
  "common.saving": "Guardando…",
  "common.notSaved": "no se guardó",
  "common.moment": "Un momento…",
  "common.team": "Equipo",
  "common.language": "Idioma",

  "count.teams": {
    one: "{count} equipo",
    other: "{count} equipos",
  },
  "count.courtsOn": {
    one: "en {count} cancha",
    other: "en {count} canchas",
  },
  "count.courtsOn.pitches": {
    one: "en {count} campo",
    other: "en {count} campos",
  },
  "count.courtsOn.tables": {
    one: "en {count} mesa",
    other: "en {count} mesas",
  },

  // J G E P — the columns a Spanish table is read in. P is perdidos, not
  // puntos; the points column keeps Pts so the two are not the same letter.
  "table.played": "J",
  "table.won": "G",
  "table.drawn": "E",
  "table.lost": "P",
  "table.sets": "Sets",
  "table.points": "Pts",
  "table.playedFull": "Jugados",
  "table.wonFull": "Ganados",
  "table.drawnFull": "Empatados",
  "table.lostFull": "Perdidos",
  "table.pointsFull": "Puntos",

  // -------------------------------------------------------------------------
  // errors
  // -------------------------------------------------------------------------
  "error.unreachable": "No se llega al sistema de resultados.",
  "error.generic": "Algo salió mal.",
  "error.notWork": "Eso no funcionó.",
  "error.notSaved": "No se pudo guardar.",
  "error.notQueued": "Eso no se pudo guardar.",
  "error.nothingHere": "No hay nada aquí.",
  "error.request": "La solicitud falló ({status}).",
  "error.badScreenLink": "Este enlace de pantalla no es válido.",
  "error.refusedResults": {
    one: "Se rechazó {count} resultado: {messages}",
    other: "Se rechazaron {count} resultados: {messages}",
  },

  // -------------------------------------------------------------------------
  // the bar across the top of the landing and marketing pages
  // -------------------------------------------------------------------------
  "nav.label": "Secciones del sitio",
  "nav.formats": "Formatos",
  "nav.guides": "Guías",
  "nav.screens": "Pantallas",
  "nav.print": "Imprimir",
  "nav.compare": "Comparar",
  "nav.mcp": "MCP",
  "nav.setUp": "Crear",
  "nav.privacy": "Privacidad",
  "nav.terms": "Términos",
  "nav.deletion": "Borrar datos",

  // -------------------------------------------------------------------------
  // landing
  // -------------------------------------------------------------------------
  "landing.title": "Whistle.day — Organizador de torneos gratis",
  "landing.description":
    "Organizador de torneos gratis. Sortea grupos, un cuadro o un suizo, dirige el día desde el teléfono y pon los resultados en la pantalla. Sin cuenta y sin anuncios.",
  "landing.eyebrow": "Resultados en vivo, en la pantalla",
  "landing.tagline": "Organiza un torneo desde el teléfono y ponlo en la pantalla.",
  "landing.resume": "Volver a {name}",
  "landing.setUp": "Crear un torneo",
  "landing.signIn": "Entrar",
  "landing.howTitle": "Cómo funciona",
  "landing.step1Title": "Ármalo",
  "landing.step1Body":
    "Ponle nombre, anota los equipos y elige el formato. En menos de un minuto, sin cuenta.",
  "landing.step2Title": "Dirige el día",
  "landing.step2Body":
    "Pon los partidos en cancha, marca lo que se está jugando y carga los resultados cuando salen. Todo desde el teléfono.",
  "landing.step3Title": "Ponlo en la pantalla",
  "landing.step3Body":
    "Una pantalla que se actualiza sola: las tablas se rehacen, el cuadro se completa y la siguiente ronda suiza se sortea.",
  "landing.demoCourt": "Cancha 2",
  "landing.demoLive": "En vivo",
  "landing.demoHome": "Halcones",
  "landing.demoAway": "Molino",
  "landing.demoCaption":
    "Un partido en la pantalla: Halcones y Molino van un set a uno, y el tercero se está jugando 11-8.",
  "landing.statSetupValue": "60s",
  "landing.statSetupLabel": "hasta el enlace y el código QR",
  "landing.statFreeValue": "0",
  "landing.statFreeLabel": "cuentas, anuncios o topes",
  "landing.statFormatsValue": "4",
  "landing.statFormatsLabel": "formatos, en cualquier orden",
  "landing.statLiveValue": "0,2s",
  "landing.statLiveLabel": "de la cancha a la pantalla",
  "landing.formatsTitle": "Formatos",
  "landing.formatRoundRobin": "Todos contra todos",
  "landing.formatRoundRobinBody":
    "Cada equipo juega contra cada uno. Los grupos alimentan la eliminatoria.",
  "landing.formatSingleElim": "Eliminación directa",
  "landing.formatSingleElimBody":
    "Pierdes una vez y quedas afuera. El cuadro clásico, de una.",
  "landing.formatDoubleElim": "Doble eliminación",
  "landing.formatDoubleElimBody":
    "Una segunda vida: caes al cuadro de perdedores y puedes volver.",
  "landing.formatSwiss": "Suizo",
  "landing.formatSwissBody":
    "Cada ronda empareja a quien va igual. Nadie queda afuera: todos juegan todas las rondas.",
  "landing.formatMore": "Ver cómo se juega",
  "landing.sportsTitle": "Sea lo que se esté jugando",
  "landing.sportsNote":
    "Al sorteo no le importa la pelota. El mismo día, el mismo teléfono. Esta es la página del tuyo.",
  "landing.sportVolleyball": "Voleibol",
  "landing.sportBeach": "Vóley playa",
  "landing.sportPadel": "Pádel",
  "landing.sportPickleball": "Pickleball",
  "landing.sportBadminton": "Bádminton",
  "landing.sportTableTennis": "Tenis de mesa",
  "landing.sportFutsal": "Futsal",
  "landing.sportChess": "Ajedrez",
  "landing.sportEsports": "Esports",
  "landing.screenTitle": "Abrir una pantalla",
  "landing.screenNote":
    "Escribe el código del QR de la puerta, o el de la pantalla del organizador.",
  "landing.tokenPlaceholder": "código de pantalla",
  "landing.projector": "Proyector",
  "landing.phone": "Teléfono",
  "landing.agentsTitle": "También sirve para agentes",
  "landing.agentsNote":
    "Whistle.day también es un servidor MCP: apunta Claude, ChatGPT o cualquier cliente MCP y un agente puede crear un torneo, anotar equipos y canchas, sortear una fase y cerrar partidos solo.",
  "landing.agentsLink": "Ver el servidor MCP",
  "landing.footer": "Whistle.day, un organizador de torneos gratis.",
  "landing.smithery": "Whistle.day en Smithery",

  // -------------------------------------------------------------------------
  // account
  // -------------------------------------------------------------------------
  "account.signedIn": "Sesión iniciada",
  "account.keepTitle": "Conserva tu torneo",
  "account.signInTitle": "Entrar",
  "account.signedInAs":
    "Como {email}. Entra con ese correo en otro dispositivo para retomar tus torneos allí.",
  "account.keepBody":
    "La forma de volver a tu torneo vive en este navegador y en ningún otro sitio — lo hayas creado tú o te hayan dado un código en la puerta. Un correo y una contraseña le dan otro lugar donde vivir.",
  "account.keepBodyNamed":
    "La forma de volver a {name} vive en este navegador y en ningún otro sitio — lo hayas creado tú o te hayan dado un código en la puerta. Un correo y una contraseña le dan otro lugar donde vivir.",
  "account.signInBody":
    "En este dispositivo no hay nada armado. Entra y lo que dirijas desde otro viene contigo.",
  "account.looking": "Buscando…",
  "account.noTournaments": "Todavía no hay torneos en esta cuenta.",
  "account.email": "Correo",
  "account.password": "Contraseña",
  "account.save": "Guardar el acceso",
  "account.haveAccount": "Ya tengo una cuenta",
  "account.keepInstead": "Conservar el torneo de este dispositivo",
  "account.switchWarning":
    "Entrar como otra persona deja atrás lo que esté armado en este dispositivo. Sigue en la pantalla; este navegador deja de ser la entrada.",
  "account.claimRefused":
    "Ese correo no se puede guardar en este dispositivo. Si ya es tu cuenta, entra con él: lo armado aquí sigue en vivo y este navegador deja de ser la entrada.",
  "account.signOut": "Salir",
  "account.deleteTitle": "Cuenta borrada",
  "account.deleteButton": "Borrar cuenta",
  "account.deleteConfirmTitle": "¿Borrar esta cuenta?",
  "account.deleteConfirmPrompt": {
    one: "Esto borra para siempre tu cuenta y {count} torneo que es tuyo. No hay forma de recuperarlos.",
    other: "Esto borra para siempre tu cuenta y {count} torneos que son tuyos. No hay forma de recuperarlos.",
  },
  "account.deleteConfirmButton": "Sí, borrar para siempre",
  "account.deleted": "Tu cuenta y todos los datos asociados se borraron para siempre.",
  "account.termsNotice": "Al continuar, aceptas nuestros",
  "account.termsOfService": "Términos del servicio",
  "account.privacyPolicy": "Política de privacidad",
  "account.and": "y",
  "claim.title": "{tournament} es tuyo",
  "claim.body":
    "Este torneo se armó en una cuenta que todavía no es de nadie. Ponle un correo y una contraseña y es tuyo: el sorteo, los resultados y las pantallas, todo.",
  "claim.accept": "Quedármelo",
  "claim.once":
    "El enlace sirve una vez. Quien armó el torneo pierde el acceso en el momento en que haces esto.",
  "claim.deadTitle": "Este enlace ya no vale",
  "claim.deadBody":
    "Ya se usó, caducó, o nunca fue un enlace. Pide otro a quien te lo mandó.",
  "claim.failed": "Eso no funcionó. No cambió nada — inténtalo de nuevo.",
  "claim.finishing": "Quedándomelo…",

  "connect.title": "{client} quiere conectarse",
  "connect.unnamedClient": "Una app",
  "connect.body":
    "Podrá ver y gestionar los torneos que son tuyos o en los que estás de mesa — lo mismo que entrar en la web.",
  "connect.signInPrompt": "Entra primero para permitirlo.",
  "connect.signInLink": "Entrar",
  "connect.approve": "Permitir",
  "connect.deny": "Ahora no",
  "connect.denied": "Rechazado. Puedes cerrar esta pestaña.",
  "connect.deadTitle": "Este enlace ya no vale",
  "connect.deadBody":
    "Ya se usó, caducó, o nunca fue un enlace. Vuelve a lo que estabas conectando e inténtalo de nuevo.",
  "connect.failed": "Eso no funcionó. No cambió nada — inténtalo de nuevo.",

  "recover.forgotTitle": "Restablecer la contraseña",
  "recover.forgotBody":
    "Escribe el correo de tu cuenta y te mandamos un enlace para elegir una contraseña nueva.",
  "recover.forgotLink": "¿Olvidaste la contraseña?",
  "recover.sendLink": "Enviar el enlace",
  "recover.backToSignIn": "Volver a entrar",
  "recover.sent":
    "Si ese correo tiene una cuenta, el enlace va en camino. Dale un minuto, y mira el spam.",
  "recover.sendFailed": "Ahora no se pudo enviar. Inténtalo en un momento.",
  "recover.mismatch": "Las dos contraseñas no coinciden.",
  "recover.resetTitle": "Elige una contraseña nueva",
  "recover.resetBody": "Para la cuenta a la que se envió el enlace.",
  "recover.newPassword": "Contraseña nueva",
  "recover.confirmPassword": "Escríbela otra vez",
  "recover.setPassword": "Guardar contraseña",
  "recover.doneTitle": "Contraseña cambiada",
  "recover.doneBody": "Entra con tu correo y la contraseña nueva.",
  "recover.toSignIn": "Entrar",
  "recover.deadTitle": "Este enlace caducó",
  "recover.deadBody":
    "Un enlace de restablecimiento dura menos de una hora y sirve una vez. Pide otro desde la pantalla de entrada.",
  "recover.tryAgain": "Volver a entrar",
  "recover.verifyNudge":
    "Este correo todavía no está confirmado, así que un restablecimiento no tendría a dónde ir.",
  "recover.verifyResent": "Enviado. Busca el enlace de confirmación en tu bandeja.",
  "recover.resend": "Enviarlo otra vez",

  "verify.doneTitle": "Correo confirmado",
  "verify.doneBody": "Esta dirección ya puede devolverte a la cuenta.",
  "verify.deadTitle": "Este enlace caducó",
  "verify.deadBody":
    "Los enlaces de confirmación no duran para siempre. Entra y envía uno nuevo desde tu cuenta.",
  "verify.toAccount": "Ir a tu cuenta",

  "account.continueWith": "Continuar con {provider}",
  "account.or": "o",
  "account.oauthFailed":
    "Eso no terminó. No cambió nada — lo armado en este dispositivo sigue aquí, y puedes intentarlo de nuevo o usar un correo y una contraseña.",

  "status.draft": "borrador",
  "status.live": "en curso",
  "status.finished": "terminado",
  "status.archived": "archivado",

  // -------------------------------------------------------------------------
  // join
  // -------------------------------------------------------------------------
  "join.nothing": "Nada a lo que unirse",
  "join.expired": "Esta invitación caducó, o nunca fue válida.",
  "join.invalid": "Esta invitación no es válida.",
  "join.askForFresh": "Pide un código nuevo a quien dirige el día.",
  "join.asked": "Te pidieron {role}",
  "join.yourName": "Tu nombre",
  "join.namePlaceholder": "Ana",
  "join.nameHint": "Para que los demás sepan quién cargó un resultado. Puedes dejarlo en blanco.",
  "join.joining": "Uniéndote…",
  "join.start": "Unirme y empezar",
  "join.failed": "No se pudo unir a este torneo.",
  "join.warning":
    "Te unes en este dispositivo, sin cuenta. Borrar este navegador es lo único que te deja afuera.",

  "join.roleOrganizer": "ayudar a dirigirlo",
  "join.roleReferee": "arbitrar",
  "join.roleScorer": "anotar",

  // -------------------------------------------------------------------------
  // the wizard
  // -------------------------------------------------------------------------
  "wizard.step": "Paso {current} de {total}",
  "wizard.nameTitle": "¿Cómo se llama?",
  "wizard.nameHint": "Puedes cambiarlo después — nada queda cerrado hasta que empiezas.",
  "wizard.namePlaceholder": "Copa del club",
  "wizard.nameNext": "Anotar los equipos",
  "wizard.nameBusy": "Un segundo…",
  "wizard.sportLegend": "¿Qué se juega?",
  "wizard.resume": "{name} está a medias en este dispositivo{teams}.",
  "wizard.resumeTeams": {
    one: " — {count} equipo anotado",
    other: " — {count} equipos anotados",
  },
  "wizard.resumeContinue": "Retomar eso",
  "wizard.resumeDiscard": "Empezar otra cosa",

  "wizard.teamsTitle": "Equipo {number}",
  "wizard.teamsHint": "Anótalos de a uno. El orden en que los anotas es el orden de cabezas de serie.",
  "wizard.teamsPlaceholder": "Nombre del equipo",
  "wizard.teamsAdd": "Añadir equipo",
  "wizard.teamsDuplicate": "Ya tienes un equipo con ese nombre.",
  "wizard.teamsShortLabel": "Así se ve en la pantalla",
  "wizard.teamsRemove": "Quitar {name}",
  "wizard.teamsMore": "Faltan {count} para empezar",
  "wizard.teamsEnough": {
    one: "Están todos — {count} equipo",
    other: "Están todos — {count} equipos",
  },

  "wizard.courtsTitle": "¿Cuántas canchas?",
  "wizard.courtsTitle.pitches": "¿Cuántos campos?",
  "wizard.courtsTitle.tables": "¿Cuántas mesas?",
  "wizard.courtsHint":
    "Los partidos corren en todas a la vez, así que esto es lo que decide cuánto dura el día.",
  "wizard.courtsNext": "Cómo se juega",
  "wizard.courtsDefaultName": "Cancha {number}",
  "wizard.courtsDefaultName.pitches": "Campo {number}",
  "wizard.courtsDefaultName.tables": "Mesa {number}",
  "wizard.courtsFewer": "Una cancha menos",
  "wizard.courtsFewer.pitches": "Un campo menos",
  "wizard.courtsFewer.tables": "Una mesa menos",
  "wizard.courtsMore": "Una cancha más",
  "wizard.courtsMore.pitches": "Un campo más",
  "wizard.courtsMore.tables": "Una mesa más",
  "wizard.courtsDuplicate": "Dos canchas tienen el mismo nombre.",
  "wizard.courtsDuplicate.pitches": "Dos campos tienen el mismo nombre.",
  "wizard.courtsDuplicate.tables": "Dos mesas tienen el mismo nombre.",
  "wizard.courtsBlank": "Cada cancha necesita un nombre.",
  "wizard.courtsBlank.pitches": "Cada campo necesita un nombre.",
  "wizard.courtsBlank.tables": "Cada mesa necesita un nombre.",

  "wizard.formatTitle": "¿Cómo debería correr?",
  "wizard.formatHint": "{teams} {courts}.",
  "wizard.formatLegend": "Formato",
  "wizard.formatStart": "Empezar el torneo",
  "wizard.formatCost": {
    one: "≈ {count} partido · unos {duration}",
    other: "≈ {count} partidos · unos {duration}",
  },
  "wizard.formatNeeds": {
    one: "Hacen falta al menos {count} equipo.",
    other: "Hacen falta al menos {count} equipos.",
  },
  "wizard.formatNote":
    "Cabezas de serie en el orden en que anotaste los equipos, así que los dos primeros no pueden cruzarse antes de la final.",
  "wizard.launchStages": "Armándolo…",
  "wizard.launchDraw": "Haciendo el sorteo…",
  "wizard.launchScreen": "Abriendo una pantalla…",
  "wizard.launchPublish": "Pasando a en vivo…",

  "wizard.doneEyebrow": "Ya en vivo",
  "wizard.doneFallbackName": "Tu torneo",
  "wizard.doneCaption": "Escanea para el horario, las tablas y los resultados",
  "wizard.doneEnterResults": "Admin — empezar el torneo",
  "wizard.doneOpenProjector": "Abrir la pantalla del proyector",
  "wizard.doneProjectorNote": "Lo que muestra se puede cambiar cuando el día ya corre.",
  "wizard.doneCopyProjector": "Copiar el enlace del proyector",
  "wizard.doneProjectorCopied": "Enlace del proyector copiado",
  "wizard.doneWarning":
    "Este torneo se dirige desde este dispositivo — este navegador es el único que puede cambiarlo.",
  "wizard.doneWarningLink": "Ponle un correo",
  "wizard.doneWarningTail": "y sobrevive a un teléfono perdido.",

  // -------------------------------------------------------------------------
  // formats offered by the wizard
  // -------------------------------------------------------------------------
  "preset.knockout.title": "Eliminación directa",
  "preset.knockout.tag": "El más corto",
  "preset.knockout.blurb":
    "Pierdes una vez y quedas afuera. La forma más rápida de tener un ganador, y el que menos juega quien queda mal sorteado.",
  "preset.knockout.shape": "{round} hasta la final, más el partido por el tercer puesto",

  "preset.double.title": "Doble eliminación",
  "preset.double.tag": "Dos vidas",
  "preset.double.blurb":
    "Pierdes una vez y caes al cuadro de perdedores; pierdes dos y quedas afuera. Nadie se va a casa por un mal partido, y el día igual termina con un ganador.",
  "preset.double.shape":
    "un cuadro de ganadores, el de perdedores que recoge a quien cae, y una gran final entre los dos",

  "preset.groups.title": "Grupos y eliminatoria",
  "preset.groups.tag": "Recomendado",
  "preset.groups.blurb":
    "Todos tienen unos partidos asegurados, y pasan los dos primeros de cada grupo. Lo que hace la mayoría de los torneos de un día.",
  "preset.groups.shape": "{groups}, y luego {round} para los dos primeros de cada uno",
  "preset.groups.even": {
    one: "{count} grupo de {size}",
    other: "{count} grupos de {size}",
  },
  "preset.groups.uneven": {
    one: "{count} grupo de {sizes}",
    other: "{count} grupos de {sizes}",
  },
  "preset.groups.sizesJoin": " y ",

  "preset.swiss.title": "Rondas suizas",
  "preset.swiss.tag": "Campos grandes",
  "preset.swiss.blurb":
    "Sin grupos y nadie eliminado. Todos juegan los mismos partidos, cada uno contra un equipo con el mismo registro — ganas y te toca un ganador, pierdes y te toca alguien que perdió. La tabla se ordena sola, y los cuatro primeros lo definen.",
  "preset.swiss.shape": {
    one: "{count} ronda para los {teams}, y luego semifinales para los cuatro primeros",
    other: "{count} rondas para los {teams}, y luego semifinales para los cuatro primeros",
  },

  "preset.everyone.title": "Todos contra todos",
  "preset.everyone.tag": "El más largo",
  "preset.everyone.blurb":
    "Una tabla, sin eliminatoria. Cada equipo juega contra cada uno y la tabla decide — nadie se va a casa después de dos partidos.",
  "preset.everyone.shape": {
    one: "un grupo de {teams}, {count} partido cada uno, decide la tabla",
    other: "un grupo de {teams}, {count} partidos cada uno, decide la tabla",
  },

  "preset.everyoneTwice.title": "Todos contra todos, dos veces",
  "preset.everyoneTwice.tag": "Ida y vuelta",
  "preset.everyoneTwice.blurb":
    "La misma tabla, jugada dos veces — cada pareja se cruza una vez de ida y una de vuelta. El resultado más justo que un día puede dar, cuando hay tiempo.",
  "preset.everyoneTwice.shape": {
    one: "un grupo de {teams}, {count} partido cada uno, ida y vuelta",
    other: "un grupo de {teams}, {count} partidos cada uno, ida y vuelta",
  },

  "round.final": "una final",
  "round.semis": "semifinales",
  "round.quarters": "cuartos de final",
  "round.of16": "los octavos de final",
  "round.of32": "los dieciseisavos de final",
  "round.of": "una ronda de {size}",

  "bracket.final": "Final",
  "bracket.semis": "Semifinales",
  "bracket.quarters": "Cuartos",
  "bracket.round16": "Octavos",
  "bracket.round32": "Dieciseisavos",
  "bracket.roundOf": "Ronda de {size}",
  "bracket.thirdPlace": "Tercer puesto",

  "duration.minutes": "{minutes} min",
  "duration.hours": "{hours} h",
  "duration.hoursMinutes": "{hours} h {minutes} min",

  // -------------------------------------------------------------------------
  // sports and how a table is worked out
  // -------------------------------------------------------------------------
  "sport.volleyball": "Voleibol",
  "sport.volleyball.hint": "Deciden los sets, y ningún partido termina empatado.",
  "sport.football": "Fútbol",
  "sport.football.hint": "Tres por ganar, uno por empatar.",
  "sport.basketball": "Baloncesto",
  "sport.basketball.hint": "Dos por ganar, uno por perder, y no hay empates.",
  "sport.tennis": "Tenis",
  "sport.tennis.hint": "Deciden los sets, y ningún partido termina empatado.",
  "sport.padel": "Pádel",
  "sport.padel.hint": "Deciden los sets, y ningún partido termina empatado.",
  "sport.badminton": "Bádminton",
  "sport.badminton.hint": "Deciden los sets, y ningún partido termina empatado.",
  "sport.table_tennis": "Tenis de mesa",
  "sport.table_tennis.hint": "Deciden los sets, y ningún partido termina empatado.",
  "sport.handball": "Balonmano",
  "sport.handball.hint": "Dos por ganar, uno por empatar.",
  "sport.other": "Otra cosa",
  "sport.other.hint": "Tres por ganar, uno por empatar. Cámbialo después si no es así.",
  "wizard.setsLegend": "¿Cuántos sets?",
  "wizard.setsOf": "Al mejor de {count}",
  "wizard.setsSingle": "Lo decide un solo marcador",
  "wizard.decidedLegend": "¿Cómo se decide un partido?",
  "wizard.customSportLegend": "Ponle nombre",
  "wizard.customSportPlaceholder": "Pickleball, dodgeball, ajedrez…",
  "wizard.customDraws": "Se permiten empates",

  "tiebreak.points": "Puntos",
  "tiebreak.points.hint": "La columna de la tabla.",
  "tiebreak.head_to_head": "Entre ellos",
  "tiebreak.head_to_head.hint": "Cómo les fue a los empatados, unos contra otros.",
  "tiebreak.score_diff": "Diferencia",
  "tiebreak.score_diff.hint": "Anotados menos recibidos.",
  "tiebreak.score_for": "Anotados",
  "tiebreak.score_for.hint": "El total anotado, sin importar cuántos entraron.",
  "tiebreak.sub_diff": "Diferencia de puntos",
  "tiebreak.sub_diff.hint": "A lo largo de los sets, cuando se anotan.",
  "tiebreak.wins": "Victorias",
  "tiebreak.wins.hint": "Partidos ganados, sin mirar cómo.",
  "tiebreak.seed": "Orden",
  "tiebreak.seed.hint": "El orden en que se anotaron los equipos. Nunca empata.",
  "tiebreak.draw": "Sorteo",
  "tiebreak.draw.hint": "El último recurso, decidido fuera de la app.",

  "tiebreak.inline.points": "puntos",
  "tiebreak.inline.head_to_head": "el enfrentamiento entre ellos",
  "tiebreak.inline.score_diff": "la diferencia de sets",
  "tiebreak.inline.score_for": "los sets ganados",
  "tiebreak.inline.sub_diff": "la diferencia de puntos",
  "tiebreak.inline.wins": "las victorias",
  "tiebreak.inline.seed": "el orden de inscripción",
  "tiebreak.inline.draw": "un sorteo",
  "tiebreak.note": "Iguales en puntos — los separa {criteria}.",
  "tiebreak.noteList": "{list} y después {last}",

  // -------------------------------------------------------------------------
  // the organiser's board
  // -------------------------------------------------------------------------
  "board.progress": {
    one: "{played} de {count} partido cargado",
    other: "{played} de {count} partidos cargados",
  },
  "board.screen": "Pantalla",
  "board.setUp": "Armado",
  "board.teams": "Equipos",
  "board.scoring": "Puntuación",
  "board.crew": "Mesa",
  "board.sponsors": "Sponsors",
  "board.tabTodo": "Por jugar",
  "board.tabDone": "Jugados",
  "board.emptyTodo": "Todos los partidos están cargados.",
  "board.emptyDone": "Todavía no hay resultados — el primero se carga desde Por jugar.",
  "board.queueSending": {
    one: "Enviando {count} resultado…",
    other: "Enviando {count} resultados…",
  },
  "board.queueOffline": {
    one: "{count} resultado esperando señal",
    other: "{count} resultados esperando señal",
  },
  "board.queueWaiting": {
    one: "{count} resultado por enviar",
    other: "{count} resultados por enviar",
  },
  "board.sendNow": "Enviar ahora",
  "board.stale": "Mostrando el último tablero que vio este teléfono.",
  "board.organiser": "Organizador",
  "board.someone": "Alguien",
  "board.inviteFailed": "No se pudo crear un código para unirse.",
  "board.groupNamed": "Grupo {name}",
  "board.live": "{count} en vivo",

  // -------------------------------------------------------------------------
  // one match
  // -------------------------------------------------------------------------
  "match.label": "Partido",
  "match.walkover": "W.O.",
  "match.walkoverShort": "W.O.",
  "match.recorded": "ya cargado",
  "match.live": "en vivo",
  "match.liveBadge": "En vivo",
  "match.enter": "Cargar",
  "match.waiting": "En espera",
  "match.unsent": "En este teléfono, todavía sin enviar",
  "match.court": "Cancha",
  "match.court.pitches": "Campo",
  "match.court.tables": "Mesa",
  "match.starts": "Empieza",
  "match.onCourtNow": "En cancha ahora",
  "match.onCourtNow.pitches": "En el campo ahora",
  "match.onCourtNow.tables": "En la mesa ahora",
  "match.takeOff": "Sacarlo",
  "match.takeOff.pitches": "Sacarlo",
  "match.takeOff.tables": "Sacarlo",
  "match.onCourtSaved": "En {court} — guardado. Tócalo otra vez para sacarlo.",
  "match.onCourtSaved.pitches": "En {court} — guardado. Tócalo otra vez para sacarlo del campo.",
  "match.onCourtSaved.tables": "En {court} — guardado. Tócalo otra vez para sacarlo de la mesa.",
  "match.noCourtYet": "Todavía no está en una cancha. Toca una y se guarda al momento.",
  "match.noCourtYet.pitches": "Todavía no está en un campo. Toca uno y se guarda al momento.",
  "match.noCourtYet.tables": "Todavía no está en una mesa. Toca una y se guarda al momento.",
  "match.savesOnTap":
    "La cancha, la hora y los puntos de abajo se guardan al tocarlos. El resultado es lo único que espera a Guardar.",
  "match.savesOnTap.pitches":
    "El campo, la hora y los puntos de abajo se guardan al tocarlos. El resultado es lo único que espera a Guardar.",
  "match.savesOnTap.tables":
    "La mesa, la hora y los puntos de abajo se guardan al tocarlos. El resultado es lo único que espera a Guardar.",
  "match.clash": "{team} también está en {code} a las {time}{court}.",
  "match.clashCourt": " en {court}",
  "match.clashCourt.pitches": " en {court}",
  "match.clashCourt.tables": " en {court}",
  "match.save": "Guardar resultado",
  "match.noShow": "Alguien no se presentó",
  "match.clear": "Borrar el resultado",
  "match.clearing": "Borrando…",
  "match.clearAsk": "¿Quitar este resultado?",
  "match.clearNote":
    "Se borra {home} {homeScore}–{awayScore} {away}, y lo que haya metido en una ronda posterior vuelve a espera.",
  "match.keepIt": "Dejarlo",
  "match.walkoverAsk": "¿Quién se lleva el partido?",
  "match.walkoverNote":
    "No se anota marcador. En un grupo el ganador se lleva los puntos de una victoria y nada más.",
  "match.replaces":
    "Guardar reemplaza el resultado cargado. Las tablas y lo que se haya sembrado desde ellas se rehacen.",
  "match.setInPlay":
    "El set {number} sigue en juego, así que no cuenta arriba. Guardar cierra el partido y anota {home}–{away}.",
  "match.bestOf": {
    one: "Al mejor de {bestOf}: el partido es de quien gane un set.",
    other: "Al mejor de {bestOf}: el partido es del primero que gane {count} sets.",
  },
  "match.notOverYet": {
    one: "{home}–{away} no cierra un partido al mejor de {bestOf} — se gana con un set.",
    other: "{home}–{away} no cierra un partido al mejor de {bestOf} — se gana a {count} sets.",
  },
  "match.tooManySets": {
    one: "Un partido al mejor de {bestOf} se cierra con un set, así que no puede terminar {home}–{away}.",
    other: "Un partido al mejor de {bestOf} se cierra a {count} sets, así que no puede terminar {home}–{away}.",
  },
  "match.thatIsTheMatch": "Ese es el partido: {home}–{away} para {name}.",
  "match.scoreFor": "Marcador de {name}",
  "match.oneFewerFor": "Uno menos para {name}",
  "match.oneMoreFor": "Uno más para {name}",

  "sets.title": "Puntos de cada set",
  "sets.add": "Añadir un set",
  "sets.number": "Set {number}",
  "sets.inPlay": "en juego",
  "sets.remove": "Quitar el set {number}",
  "sets.sideLabel": "{name}, set {number}",
  "sets.oneFewer": "Uno menos, {label}",
  "sets.oneMore": "Uno más, {label}",
  "sets.empty":
    "Opcional, y se guardan al anotarlos, no con el resultado. Llénalos y el marcador de arriba se cuenta desde ellos, el desempate tiene los números que necesita, y la pantalla muestra el partido set a set mientras está en juego.",

  "history.entered": "cargó {score}",
  "history.changed": "cambió {was} por {now}",
  "history.cleared": "borró {was}",
  "history.aWalkover": "un W.O.",

  // -------------------------------------------------------------------------
  // who is playing
  // -------------------------------------------------------------------------
  "teams.label": "Equipos",
  "teams.who": "Quién juega",
  "teams.intro":
    "Sacar a un equipo cierra cada partido que le queda y rehace las tablas. Se puede deshacer.",
  "teams.isOut": "{name} está afuera",
  "teams.hasLeft": {
    one: "Les queda {count} partido. Qué pasa con él no es la misma pregunta que qué pasa con los resultados de {name} que ya están en la planilla.",
    other:
      "Les quedan {count} partidos. Qué pasa con ellos no es la misma pregunta que qué pasa con los resultados de {name} que ya están en la planilla.",
  },
  "teams.nothingLeft":
    "Ya jugaron todo lo que tenían, así que esto solo decide si esos resultados siguen contando.",
  "teams.forfeitTitle": "Pierden el resto por W.O.",
  "teams.forfeitBody":
    "Lo que jugaron queda. Cada partido que les queda es un W.O. para quien les tocaba. Sirve cuando un equipo se va tarde.",
  "teams.voidTitle": "Anular sus resultados",
  "teams.voidBody":
    "Cada partido en el que estuvieron sale de la tabla, también para sus rivales. Sirve cuando un equipo se baja temprano, para que nadie quede clasificado por haberles tocado.",
  "teams.neverMind": "Mejor no",
  "teams.outStruck": "Afuera · resultados anulados",
  "teams.outForfeited": "Afuera · el resto por W.O.",
  "teams.toPlay": {
    one: "{count} por jugar",
    other: "{count} por jugar",
  },
  "teams.putBack": "Devolver",
  "teams.out": "Afuera",
  "teams.add": "Añadir",
  "teams.adding": "Añadiendo…",
  "teams.addLabel": "Nombre del equipo que se suma",
  "teams.addPlaceholder": "Un equipo que acaba de llegar",
  "teams.addHint":
    "Entran al grupo con menos por recuperar y juegan contra todos los que ya están. Una eliminatoria ya jugada no acepta uno.",
  "teams.addDuplicate": "{name} ya está jugando.",
  "teams.joinedPool": {
    one: "{name} está en el grupo {pool}, con {count} partido por jugar.",
    other: "{name} está en el grupo {pool}, con {count} partidos por jugar.",
  },
  "teams.joinedField": "{name} está adentro, y entra en el sorteo de la próxima ronda.",
  "teams.joinedRedrawn": "{name} está adentro, y {stage} se sorteó de nuevo.",
  "teams.joinedWaiting": "{name} está adentro, y estará en el sorteo cuando se haga.",

  // -------------------------------------------------------------------------
  // the crew
  // -------------------------------------------------------------------------
  "crew.label": "Mesa",
  "crew.title": "Quién dirige esto contigo",
  "crew.intro":
    "Todos los de aquí pueden cargar resultados desde su propio teléfono. El rol es quiénes son, no qué se les permite tocar.",
  "crew.empty": "Todavía nadie — lo estás dirigiendo solo.",
  "crew.add": "Añadir a alguien",
  "crew.referee": "Árbitro",
  "crew.refereeHint": "Dirige partidos y carga resultados.",
  "crew.scorer": "Anotador",
  "crew.scorerHint": "Lleva el marcador, set a set.",
  "crew.organizer": "Coorganizador",
  "crew.organizerHint": "Dirige el día junto a ti.",
  "crew.scanThis": "Solo hay que escanear el código QR — no hace falta registrarse.",
  "crew.pickRole": "Elige qué van a hacer y aparece un código.",
  "crew.replace": "Reemplazar código",
  "crew.working": "Trabajando…",
  "crew.replaceNote":
    "Reemplazarlo deja de hacer funcionar el anterior. Quien ya está en la lista se queda — entró por la puerta, no es el código.",
  "crew.removeMember": "Quitar a {name}",
  "crew.thisPerson": "esta persona",

  // -------------------------------------------------------------------------
  // what the wall shows
  // -------------------------------------------------------------------------
  "screen.label": "Pantalla",
  "screen.fallbackName": "Pantalla",
  "screen.savedAsYouTap":
    "Se guarda al tocar, y la pantalla lo sigue en un momento — es la vista previa.",
  "screen.rotation": "Qué muestra, en orden",
  "screen.move": "Mover {name}",
  "screen.onePanel": "Un solo panel, así que la pantalla se queda en él. Los créditos van al final.",
  "screen.dragToReorder": "Arrastra un asa para reordenar. Los créditos van al final.",
  "screen.emptySkipped": "Un panel sin nada que mostrar se salta solo.",
  "screen.notShown": "No se muestra",
  "screen.tapToRestore": "Toca uno para devolverlo al final.",
  "screen.dwell": "Cada panel se queda",
  "screen.dwellSeconds": "{seconds}s",
  "screen.onlyShow": "Mostrar solo",
  "screen.everyStage": "Todas las fases",
  "screen.everyGroup": "Todos los grupos",
  "screen.everyCourt": "Todas las canchas",
  "screen.everyCourt.pitches": "Todos los campos",
  "screen.everyCourt.tables": "Todas las mesas",
  "screen.stage": "Fase",
  "screen.group": "Grupo",
  "screen.scopeNote":
    "Una segunda pantalla en la puerta, con una sola cancha, es para lo que está esto. La pantalla principal las quiere todas.",
  "screen.scopeNote.pitches":
    "Una segunda pantalla en la puerta, con un solo campo, es para lo que está esto. La pantalla principal los quiere todos.",
  "screen.scopeNote.tables":
    "Una segunda pantalla en la puerta, con una sola mesa, es para lo que está esto. La pantalla principal las quiere todas.",
  "screen.colour": "Color",
  "screen.accent": "Color de acento",
  "screen.reset": "Restablecer",
  "screen.ground": "Fondo",
  "screen.groundLight": "Claro",
  "screen.groundDark": "Oscuro",
  "screen.groundNote":
    "Un proyector no tiene negro — con las luces del club encendidas, una pantalla oscura se vuelve gris y el texto se va con ella. El oscuro es para una sala con la luz baja.",

  // -------------------------------------------------------------------------
  // who is on the closing panel
  // -------------------------------------------------------------------------
  "sponsors.label": "Sponsors",
  "sponsors.title": "Quién sale en el panel final",
  "sponsors.intro":
    "Se muestra en el último panel de la pantalla cuando tu suscripción está activa. Con un nombre basta para añadir uno — el logo puede venir después.",
  "sponsors.empty": "Todavía no hay sponsors.",
  "sponsors.addName": "Nombre del sponsor",
  "sponsors.addTier": "Socio principal, pelota oficial…",
  "sponsors.addLogo": "Añadir un logo",
  "sponsors.add": "Añadir",
  "sponsors.adding": "Añadiendo…",
  "sponsors.addHint": "PNG, JPG, SVG o WebP, hasta 2MB.",
  "sponsors.changeLogo": "Cambiar el logo de {name}",
  "sponsors.moveUp": "Subir a {name}",
  "sponsors.moveDown": "Bajar a {name}",
  "sponsors.removeSponsor": "Quitar a {name}",

  "panel.now_playing": "En juego",
  "panel.now_playing.hint": "Los partidos en vivo.",
  "panel.stage_progress": "Avance de la fase",
  "panel.stage_progress.hint": "Hasta dónde llegó el día.",
  "panel.court_schedule": "Horario de canchas",
  "panel.court_schedule.pitches": "Horario de campos",
  "panel.court_schedule.tables": "Horario de mesas",
  "panel.court_schedule.hint": "Qué hay en cada cancha.",
  "panel.court_schedule.hint.pitches": "Qué hay en cada campo.",
  "panel.court_schedule.hint.tables": "Qué hay en cada mesa.",
  "panel.stage_table": "Tablas cruzadas",
  "panel.stage_table.hint": "Todos los grupos rankeados juntos.",
  "panel.standings": "Tablas de grupo",
  "panel.standings.hint": "Un panel por grupo.",
  "panel.bracket": "Cuadro",
  "panel.bracket.hint": "La eliminatoria.",
  "panel.next_up": "Siguiente",
  "panel.next_up.hint": "Los partidos que faltan.",
  "panel.results": "Últimos resultados",
  "panel.results.hint": "Lo que acaba de terminar.",

  // -------------------------------------------------------------------------
  // how the table is worked out
  // -------------------------------------------------------------------------
  "scoring.label": "Puntuación",
  "scoring.note":
    "Se guarda al tocar. Las tablas se rehacen cuando cae el siguiente resultado de un grupo, así que una que ya está en la pantalla conserva sus puntos hasta entonces.",
  "scoring.sport": "Deporte",
  "scoring.byHand": "Puesto a mano. Tocar un deporte devuelve sus propios números.",
  "scoring.points": "Puntos",
  "scoring.win": "Victoria",
  "scoring.draw": "Empate",
  "scoring.loss": "Derrota",
  "scoring.drawsTitle": "¿Un partido puede terminar empatado?",
  "scoring.drawsAllowed": "Se permiten empates",
  "scoring.somebodyWins": "Alguien gana",
  "scoring.draws": "Empates",
  "scoring.drawsYes": "Un marcador empatado es un resultado, y los dos se llevan los puntos del empate.",
  "scoring.drawsNo": "Un marcador empatado se rechaza al guardar el resultado.",
  "scoring.drawsTail":
    "Un partido de eliminatoria nunca termina empatado, de una forma ni de la otra — alguien tiene que pasar.",
  "scoring.formatTitle": "Sets por partido",
  "scoring.oneGame": "Un juego",
  "scoring.bestOfSets": "Al mejor de {bestOf}",
  "scoring.formatNote": {
    one: "Un partido es un solo marcador, y la planilla anota lo que se cargue.",
    other:
      "Un partido termina cuando alguien ha ganado {count} sets, y un resultado que diga otra cosa se rechaza.",
  },
  "scoring.walkoverTitle": "Un W.O. cuenta como",
  "scoring.score": "Marcador",
  "scoring.walkoverNote":
    "Se lo lleva quien se presentó. Cero evita que una ausencia infle la diferencia de nadie; un reglamento que dice 3-0 quiere 3.",
  "scoring.tiebreakTitle": "Cuando hay empate, ordenar por",
  "scoring.alwaysFirst": "Siempre primero.",
  "scoring.tiebreakNote":
    "Arrastra un asa para reordenar. El enfrentamiento entre ellos se calcula solo entre los empatados, con lo que jugaron unos contra otros.",
  "scoring.notUsed": "No se usa",
  "scoring.oneFewer": "{label}: uno menos",
  "scoring.oneMore": "{label}: uno más",

  // -------------------------------------------------------------------------
  // the projector and the phone
  // -------------------------------------------------------------------------
  "projector.connecting": "Conectando…",
  "projector.nothingYet": "{name} — todavía no hay nada que mostrar",
  "projector.reconnecting": "reconectando",
  "projector.mobileHint": "Resultados en vivo en tu teléfono",
  "projector.partners": "Nuestros socios",
  "projector.poweredBy": "Con Whistle.day",
  "projector.credit": "Resultados y pantallas de este torneo",
  "projector.crossPool": {
    one: "Ranking cruzado — {count} entrada",
    other: "Ranking cruzado — {count} entradas",
  },
  "projector.set": "set {number} · {home}–{away}",
  "projector.versus": "vs",
  "projector.versusShort": "v",

  "phone.offline": "sin conexión",
  "phone.tabLive": "En vivo",
  "phone.tabGroups": "Grupos",
  "phone.tabBracket": "Cuadro",
  "phone.tabResults": "Resultados",
  "phone.nothingLive": "Ahora mismo no se está jugando nada.",
  "phone.nothingScheduled": "No hay partidos programados.",
  "phone.noResults": "Todavía no hay resultados.",

  // -------------------------------------------------------------------------
  // names the app wrote into the database
  // -------------------------------------------------------------------------
  "label.bye": "Bye",
  "label.tbd": "Por definir",
  "label.winner_of": "Ganador {code}",
  "label.loser_of": "Perdedor {code}",
  "label.pool_seed": "{pool}{position}",
  "label.pool_rank": "{rank}. {pool}",
  "label.best_of_rank": "{index} mejor {place}",

  "pool.main": "Principal",
  "pool.winners": "Ganadores",
  "pool.losers": "Perdedores",
  "pool.final": "Final",
  "pool.consolation": "Consolación",
  "pool.swiss": "Suizo",

  "stage.groups": "Grupos",
  "stage.group": "Grupo",
  "stage.playoff": "Eliminatoria",
  "stage.swiss": "Suizo",
  "stage.double_elim": "Doble eliminación",

  "display.mainScreen": "Pantalla principal",

  // Spanish writes every ordinal as the number and º, so all four forms agree.
  "ordinal.one": "{n}.º",
  "ordinal.two": "{n}.º",
  "ordinal.few": "{n}.º",
  "ordinal.other": "{n}.º",
};
