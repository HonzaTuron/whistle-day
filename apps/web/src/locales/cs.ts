import type { Catalog, Message } from "../lib/i18n";

/**
 * Czech.
 *
 * Typed as `Record<keyof Catalog, Message>`, so a key added to `en.ts` and
 * forgotten here is a compile error. Nothing is stubbed: an English sentence
 * on a Czech screen is worse than a wrong one, because nobody reports it.
 *
 * Three things to know when editing this file.
 *
 * **Plurals.** Czech has four categories and they are not the English two:
 * `one` is 1, `few` is 2–4, `other` is 0 and 5 upwards, and `many` is
 * decimals ("1,5 zápasu") — which nothing here counts in, so `many` is left
 * out. A form that reads right for 3 does not read right for 5.
 *
 * **Case.** A noun after a preposition is not in the nominative: "na kurtu",
 * "ze 3 skupin", "s 5 týmy". So a phrase that will be dropped into a sentence
 * carries its own preposition — see `count.courtsOn` — rather than being glued
 * on by the caller.
 *
 * **The words the hall uses.** A knockout bracket is a pavouk, a walkover is a
 * kontumace, seeding is nasazení. These are what a Czech organiser says out
 * loud, and the screen should not make them translate back.
 */
export const cs: Record<keyof Catalog, Message> = {
  // -------------------------------------------------------------------------
  // shared
  // -------------------------------------------------------------------------
  "common.loading": "Načítá se…",
  "common.done": "Hotovo",
  "common.back": "Zpět",
  "common.close": "Zavřít",
  "common.dismiss": "Zavřít",
  "common.cancel": "Zrušit",
  "common.retry": "Zkusit znovu",
  "common.remove": "Odebrat",
  "common.keep": "Ponechat",
  "common.copy": "Klepnutím zkopírujete",
  "common.copied": "Zkopírováno",
  "common.saving": "Ukládá se…",
  "common.notSaved": "neuloženo",
  "common.moment": "Okamžik…",
  "common.team": "Tým",
  "common.language": "Jazyk",

  "count.teams": {
    one: "{count} tým",
    few: "{count} týmy",
    other: "{count} týmů",
  },
  "count.courtsOn": {
    one: "na {count} kurtu",
    few: "na {count} kurtech",
    other: "na {count} kurtech",
  },

  // Z V R P B — the columns of a Czech table, in the order they are read.
  "table.played": "Z",
  "table.won": "V",
  "table.drawn": "R",
  "table.lost": "P",
  "table.sets": "Sety",
  "table.points": "B",
  "table.playedFull": "Zápasy",
  "table.wonFull": "Výhry",
  "table.drawnFull": "Remízy",
  "table.lostFull": "Prohry",
  "table.pointsFull": "Body",

  // -------------------------------------------------------------------------
  // errors
  // -------------------------------------------------------------------------
  "error.unreachable": "Nedaří se spojit se systémem.",
  "error.generic": "Něco se pokazilo.",
  "error.notWork": "To se nepovedlo.",
  "error.notSaved": "Nepodařilo se to uložit.",
  "error.notQueued": "Tohle se nepodařilo uložit.",
  "error.nothingHere": "Tady nic není.",
  "error.request": "Požadavek selhal ({status}).",
  "error.badScreenLink": "Tento odkaz na obrazovku neplatí.",
  "error.refusedResults": {
    one: "{count} výsledek byl odmítnut: {messages}",
    few: "{count} výsledky byly odmítnuty: {messages}",
    other: "{count} výsledků bylo odmítnuto: {messages}",
  },

  // -------------------------------------------------------------------------
  // the bar across the top of the landing and marketing pages
  // -------------------------------------------------------------------------
  "nav.label": "Sekce webu",
  "nav.formats": "Systémy",
  "nav.guides": "Návody",
  "nav.screens": "Obrazovky",
  "nav.print": "K vytištění",
  "nav.compare": "Srovnání",
  "nav.setUp": "Založit",

  // -------------------------------------------------------------------------
  // landing
  // -------------------------------------------------------------------------
  "landing.eyebrow": "Živé skóre rovnou na zeď",
  "landing.tagline": "Řiďte turnaj z mobilu a pusťte ho na zeď.",
  "landing.resume": "Zpět na {name}",
  "landing.setUp": "Založit turnaj",
  "landing.signIn": "Přihlásit se",
  "landing.howTitle": "Jak to funguje",
  "landing.step1Title": "Založte ho",
  "landing.step1Body":
    "Pojmenujte turnaj, přidejte týmy, vyberte systém. Za necelou minutu hotovo — účet není potřeba.",
  "landing.step2Title": "Odřiďte den",
  "landing.step2Body":
    "Rozdělte zápasy na kurty, označte, co se právě hraje, a zapisujte výsledky, jak přicházejí. Všechno z mobilu.",
  "landing.step3Title": "Pusťte to na zeď",
  "landing.step3Body":
    "Obrazovka pro projektor, která se aktualizuje sama — tabulky se přepočítají, pavouk se doplní, další švýcarské kolo se vylosuje samo.",
  "landing.demoCourt": "Kurt 2",
  "landing.demoLive": "Živě",
  "landing.demoHome": "Sokol Bystrc",
  "landing.demoAway": "Lokomotiva",
  "landing.demoCaption":
    "Zápas na projektoru: Sokol Bystrc a Lokomotiva mají po jednom setu a třetí se hraje za stavu 11-8.",
  "landing.statSetupValue": "60 s",
  "landing.statSetupLabel": "k odkazu a QR kódu",
  "landing.statFreeValue": "0",
  "landing.statFreeLabel": "účtů, reklam a limitů",
  "landing.statFormatsValue": "4",
  "landing.statFormatsLabel": "systémy v libovolném pořadí",
  "landing.statLiveValue": "0,2 s",
  "landing.statLiveLabel": "od sítě na zeď",
  "landing.formatsTitle": "Systémy",
  "landing.formatRoundRobin": "Každý s každým",
  "landing.formatRoundRobinBody":
    "Každý tým hraje se všemi ostatními. Ze skupin se postupuje do play-off.",
  "landing.formatSingleElim": "Vyřazovací pavouk",
  "landing.formatSingleElimBody":
    "Jedna prohra a končíte. Klasický pavouk, rovnou až do finále.",
  "landing.formatDoubleElim": "Dvojité vyřazení",
  "landing.formatDoubleElimBody":
    "Druhá šance: propadnete do pavouka poražených a můžete se probojovat zpátky.",
  "landing.formatSwiss": "Švýcarský systém",
  "landing.formatSwissBody":
    "Každé kolo se páruje podobné s podobným. Nikdo nevypadává — všechny týmy hrají všechna kola.",
  "landing.formatMore": "Jak to běží",
  "landing.sportsTitle": "Ať se hraje cokoli",
  "landing.sportsNote":
    "Losu je jedno, s čím se hraje. Stejný den, stejný mobil — tady je stránka pro ten váš sport.",
  "landing.sportVolleyball": "Volejbal",
  "landing.sportBeach": "Plážový volejbal",
  "landing.sportPadel": "Padel",
  "landing.sportPickleball": "Pickleball",
  "landing.sportBadminton": "Badminton",
  "landing.sportTableTennis": "Stolní tenis",
  "landing.sportFutsal": "Futsal",
  "landing.sportChess": "Šachy",
  "landing.sportEsports": "Esport",
  "landing.screenTitle": "Otevřít obrazovku",
  "landing.screenNote":
    "Zadejte kód z QR kódu u dveří, nebo z obrazovky pořadatele.",
  "landing.tokenPlaceholder": "kód obrazovky",
  "landing.projector": "Projektor",
  "landing.phone": "Mobil",
  "landing.footer": "Whistle.day — svobodný open-source nástroj na turnaje.",

  // -------------------------------------------------------------------------
  // account
  // -------------------------------------------------------------------------
  "account.signedIn": "Přihlášeno",
  "account.keepTitle": "Zachovejte si turnaj",
  "account.signInTitle": "Přihlásit se",
  "account.signedInAs":
    "Jako {email}. Přihlaste se tím kdekoli jinde a své turnaje tam máte s sebou.",
  "account.keepBody":
    "Cesta zpátky k vašemu turnaji je uložená v tomhle prohlížeči a nikde jinde — ať už jste ho zakládali vy, nebo jste dostali kód u dveří. E-mail a heslo jí dají ještě jedno místo, kde může být.",
  "account.signInBody":
    "Na tomhle zařízení nic založeného není. Přihlaste se a to, co řídíte odjinud, půjde s vámi.",
  "account.looking": "Hledá se…",
  "account.noTournaments": "Na tomhle účtu zatím žádné turnaje nejsou.",
  "account.email": "E-mail",
  "account.password": "Heslo",
  "account.save": "Uložit přístup",
  "account.haveAccount": "Účet už mám",
  "account.keepInstead": "Raději si nechat turnaj z tohoto zařízení",
  "account.switchWarning":
    "Přihlášením pod někým jiným tady necháte všechno, co je založené na tomhle zařízení. Na zdi to běží dál; tenhle prohlížeč jen přestane být cestou dovnitř.",
  "account.claimRefused":
    "Tuhle adresu na tomhle zařízení uložit nelze. Pokud je to už váš účet, přihlaste se jím — všechno založené tady běží dál a tenhle prohlížeč přestane být cestou dovnitř.",
  "claim.title": "{tournament} je váš",
  "claim.body":
    "Tenhle turnaj je založený na účtu, který zatím nikomu nepatří. Dejte na něj e-mail a heslo a je váš — los, výsledky i obrazovky, všechno.",
  "claim.accept": "Převzít",
  "claim.once":
    "Odkaz funguje jednou. Ten, kdo turnaj založil, k němu ztratí přístup ve chvíli, kdy to uděláte.",
  "claim.deadTitle": "Tenhle odkaz už neplatí",
  "claim.deadBody":
    "Byl použitý, vypršel, nebo to odkaz nikdy nebyl. Řekněte si o nový tomu, kdo vám ho poslal.",
  "claim.failed": "Nepovedlo se to. Nic se nezměnilo — zkuste to znovu.",

  "account.continueWith": "Pokračovat přes {provider}",
  "account.or": "nebo",
  "account.oauthFailed":
    "Nedokončilo se to. Nic se nezměnilo — všechno založené na tomhle zařízení tu pořád je a můžete to zkusit znovu nebo použít e-mail a heslo.",

  "status.draft": "rozpracovaný",
  "status.live": "běží",
  "status.finished": "dohraný",
  "status.archived": "archivovaný",

  // -------------------------------------------------------------------------
  // join
  // -------------------------------------------------------------------------
  "join.nothing": "Není kam se připojit",
  "join.expired": "Tato pozvánka vypršela, nebo nikdy neplatila.",
  "join.invalid": "Tato pozvánka neplatí.",
  "join.askForFresh": "Řekněte si tomu, kdo turnaj řídí, o nový kód.",
  "join.asked": "Máte {role}",
  "join.yourName": "Vaše jméno",
  "join.namePlaceholder": "Jana",
  "join.nameHint":
    "Aby ostatní poznali, kdo výsledek zapsal. Můžete nechat prázdné.",
  "join.joining": "Připojuje se…",
  "join.start": "Připojit se a začít",
  "join.failed": "K tomuto turnaji se nepodařilo připojit.",
  "join.warning":
    "Připojujete se na tomhle zařízení a bez účtu. Jediné, co vás odsud vyřadí, je vymazání prohlížeče.",

  // Doplňuje větu "Máte …" — proto infinitiv.
  "join.roleOrganizer": "pomáhat s řízením turnaje",
  "join.roleReferee": "rozhodovat zápasy",
  "join.roleScorer": "zapisovat skóre",

  // -------------------------------------------------------------------------
  // the wizard
  // -------------------------------------------------------------------------
  "wizard.step": "Krok {current} z {total}",
  "wizard.nameTitle": "Jak se bude jmenovat?",
  "wizard.nameHint": "Můžete to ještě změnit — než začnete, není nic konečné.",
  "wizard.namePlaceholder": "Podzimní pohár",
  "wizard.nameNext": "Přidat týmy",
  "wizard.nameBusy": "Moment…",
  "wizard.sportLegend": "Co se bude hrát?",
  "wizard.resume": "{name} je na tomhle zařízení rozdělaný{teams}.",
  "wizard.resumeTeams": {
    one: " — zadaný {count} tým",
    few: " — zadané {count} týmy",
    other: " — zadaných {count} týmů",
  },
  "wizard.resumeContinue": "Navázat na to",
  "wizard.resumeDiscard": "Založit něco nového",

  "wizard.teamsTitle": "{number}. tým",
  "wizard.teamsHint":
    "Přidávejte je po jednom. Pořadí, ve kterém je zadáte, je nasazení.",
  "wizard.teamsPlaceholder": "Název týmu",
  "wizard.teamsAdd": "Přidat tým",
  "wizard.teamsDuplicate": "Tým s tímhle názvem už máte.",
  "wizard.teamsShortLabel": "Zobrazí se na projektoru",
  "wizard.teamsRemove": "Odebrat {name}",
  "wizard.teamsMore": "Ještě {count} a můžeme začít",
  "wizard.teamsEnough": {
    one: "To jsou všichni — {count} tým",
    few: "To jsou všichni — {count} týmy",
    other: "To jsou všichni — {count} týmů",
  },

  "wizard.courtsTitle": "Kolik kurtů?",
  "wizard.courtsHint":
    "Na všech se hraje současně, takže tohle rozhoduje o tom, jak dlouho den potrvá.",
  "wizard.courtsNext": "Jak se to hraje",
  "wizard.courtsDefaultName": "Kurt {number}",
  "wizard.courtsFewer": "O kurt méně",
  "wizard.courtsMore": "O kurt více",
  "wizard.courtsDuplicate": "Dva kurty se jmenují stejně.",
  "wizard.courtsBlank": "Každý kurt potřebuje název.",

  "wizard.formatTitle": "Jak se to má hrát?",
  "wizard.formatHint": "{teams} {courts}.",
  "wizard.formatLegend": "Systém",
  "wizard.formatStart": "Spustit turnaj",
  "wizard.formatCost": {
    one: "≈ {count} zápas · zhruba {duration}",
    few: "≈ {count} zápasy · zhruba {duration}",
    other: "≈ {count} zápasů · zhruba {duration}",
  },
  "wizard.formatNeeds": {
    one: "Potřebuje aspoň {count} tým.",
    few: "Potřebuje aspoň {count} týmy.",
    other: "Potřebuje aspoň {count} týmů.",
  },
  "wizard.formatNote":
    "Nasazuje se v pořadí, ve kterém jste týmy přidali, takže první dva zadané se nemůžou potkat dřív než ve finále.",
  "wizard.launchStages": "Zakládá se…",
  "wizard.launchDraw": "Losuje se…",
  "wizard.launchScreen": "Otevírá se obrazovka…",
  "wizard.launchPublish": "Spouští se…",

  "wizard.doneEyebrow": "Právě běží",
  "wizard.doneFallbackName": "Váš turnaj",
  "wizard.doneCaption": "Naskenujte pro rozpis, tabulky a výsledky",
  "wizard.doneEnterResults": "Začít zapisovat výsledky",
  "wizard.doneOpenProjector": "Otevřít obrazovku pro projektor",
  "wizard.doneCopyProjector": "Zkopírovat odkaz na projektor",
  "wizard.doneProjectorCopied": "Odkaz na projektor zkopírován",
  "wizard.doneWarning":
    "Tenhle turnaj se řídí z tohoto zařízení — měnit ho může jenom tenhle prohlížeč.",
  "wizard.doneWarningLink": "Přidejte k němu e-mail",
  "wizard.doneWarningTail": "a přežije i ztracený mobil.",

  // -------------------------------------------------------------------------
  // formats offered by the wizard
  // -------------------------------------------------------------------------
  "preset.knockout.title": "Rovnou vyřazovací",
  "preset.knockout.tag": "Nejkratší",
  "preset.knockout.blurb":
    "Jedna prohra a končíte. Nejrychlejší cesta k vítězi a nejmíň odehraného času pro ty, kdo si špatně vylosují.",
  "preset.knockout.shape": "{round} až do finále, plus zápas o třetí místo",

  "preset.double.title": "Dvojité vyřazení",
  "preset.double.tag": "Dva životy",
  "preset.double.blurb":
    "Jedna prohra a propadáte do pavouka poražených; po druhé končíte. Nikdo nejede domů kvůli jednomu špatnému zápasu a den stejně končí jedním vítězem.",
  "preset.double.shape":
    "pavouk vítězů, pavouk poražených, který zachytí každého vyřazeného, a velké finále mezi nimi",

  "preset.groups.title": "Skupiny a pak play-off",
  "preset.groups.tag": "Doporučeno",
  "preset.groups.blurb":
    "Každý má jistých pár zápasů, první dva z každé skupiny jdou dál. To, co dělá většina jednodenních turnajů.",
  "preset.groups.shape": "{groups}, pak {round} pro první dva z každé",
  "preset.groups.even": {
    one: "{count} skupina po {size}",
    few: "{count} skupiny po {size}",
    other: "{count} skupin po {size}",
  },
  "preset.groups.uneven": {
    one: "{count} skupina po {sizes}",
    few: "{count} skupiny po {sizes}",
    other: "{count} skupin po {sizes}",
  },
  "preset.groups.sizesJoin": " a ",

  "preset.swiss.title": "Švýcarský systém",
  "preset.swiss.tag": "Velká pole",
  "preset.swiss.blurb":
    "Žádné skupiny a nikdo nevypadává. Všichni odehrají stejný počet zápasů, pokaždé proti týmu se stejnou bilancí — vyhrajete a potkáte vítěze, prohrajete a potkáte někoho, kdo prohrál. Tabulka se srovná sama a první čtyři si to rozdají.",
  "preset.swiss.shape": {
    one: "{count} kolo pro všech {teams}, pak semifinále pro první čtyři",
    few: "{count} kola pro všech {teams}, pak semifinále pro první čtyři",
    other: "{count} kol pro všech {teams}, pak semifinále pro první čtyři",
  },

  "preset.everyone.title": "Každý s každým",
  "preset.everyone.tag": "Nejdelší",
  "preset.everyone.blurb":
    "Jedna tabulka, žádné vyřazování. Každý tým hraje se všemi ostatními a rozhoduje tabulka — nikdo nejede domů po dvou zápasech.",
  "preset.everyone.shape": {
    one: "jedna skupina po {teams}, {count} zápas na tým, rozhoduje tabulka",
    few: "jedna skupina po {teams}, {count} zápasy na tým, rozhoduje tabulka",
    other: "jedna skupina po {teams}, {count} zápasů na tým, rozhoduje tabulka",
  },

  "preset.everyoneTwice.title": "Každý s každým dvakrát",
  "preset.everyoneTwice.tag": "Doma i venku",
  "preset.everyoneTwice.blurb":
    "Stejná jedna tabulka, odehraná dvakrát — každá dvojice se potká jednou doma a jednou venku. Nejspravedlivější výsledek, když na něj je čas.",
  "preset.everyoneTwice.shape": {
    one: "jedna skupina po {teams}, {count} zápas na tým, doma i venku",
    few: "jedna skupina po {teams}, {count} zápasy na tým, doma i venku",
    other: "jedna skupina po {teams}, {count} zápasů na tým, doma i venku",
  },

  "round.final": "finále",
  "round.semis": "semifinále",
  "round.quarters": "čtvrtfinále",
  "round.of16": "osmifinále",
  "round.of32": "šestnáctifinále",
  "round.of": "kolo s {size} týmy",

  "bracket.final": "Finále",
  "bracket.semis": "Semifinále",
  "bracket.quarters": "Čtvrtfinále",
  "bracket.round16": "Osmifinále",
  "bracket.round32": "Šestnáctifinále",
  "bracket.roundOf": "Kolo s {size} týmy",
  "bracket.thirdPlace": "O třetí místo",

  "duration.minutes": "{minutes} min",
  "duration.hours": "{hours} h",
  "duration.hoursMinutes": "{hours} h {minutes} min",

  // -------------------------------------------------------------------------
  // sports and how a table is worked out
  // -------------------------------------------------------------------------
  "sport.volleyball": "Volejbal",
  "sport.volleyball.hint": "Rozhodují sety a žádný zápas nekončí nerozhodně.",
  "sport.football": "Fotbal",
  "sport.football.hint": "Tři body za výhru, jeden za remízu.",
  "sport.basketball": "Basketbal",
  "sport.basketball.hint": "Dva za výhru, jeden za prohru, remízy nejsou.",
  "sport.other": "Něco jiného",
  "sport.other.hint":
    "Tři body za výhru, jeden za remízu. Když to nesedí, změňte to později.",

  "tiebreak.points": "Body",
  "tiebreak.points.hint": "Vlastní sloupec tabulky.",
  "tiebreak.head_to_head": "Vzájemné zápasy",
  "tiebreak.head_to_head.hint": "Jak si vedly shodné týmy mezi sebou.",
  "tiebreak.score_diff": "Rozdíl skóre",
  "tiebreak.score_diff.hint": "Nastřílené mínus obdržené.",
  "tiebreak.score_for": "Nastřílené",
  "tiebreak.score_for.hint": "Celkem nastřílené, ať už dostaly kolik chtěly.",
  "tiebreak.sub_diff": "Rozdíl míčů",
  "tiebreak.sub_diff.hint": "Napříč sety, tam kde se sety zapisují.",
  "tiebreak.wins": "Výhry",
  "tiebreak.wins.hint": "Vyhrané zápasy, bez ohledu na to, jak.",
  "tiebreak.seed": "Nasazení",
  "tiebreak.seed.hint": "Pořadí, ve kterém byly týmy zadány. Nikdy neskončí shodou.",
  "tiebreak.draw": "Los",
  "tiebreak.draw.hint": "Poslední možnost, rozhoduje se mimo aplikaci.",

  "tiebreak.inline.points": "body",
  "tiebreak.inline.head_to_head": "vzájemné zápasy",
  "tiebreak.inline.score_diff": "rozdíl setů",
  "tiebreak.inline.score_for": "vyhrané sety",
  "tiebreak.inline.sub_diff": "rozdíl míčů",
  "tiebreak.inline.wins": "výhry",
  "tiebreak.inline.seed": "nasazení",
  "tiebreak.inline.draw": "los",
  "tiebreak.note": "Shoda na bodech — rozhodly {criteria}.",
  "tiebreak.noteList": "{list} a pak {last}",

  // -------------------------------------------------------------------------
  // the organiser's board
  // -------------------------------------------------------------------------
  "board.progress": {
    one: "odehráno {played} z {count} zápasu",
    other: "odehráno {played} z {count} zápasů",
  },
  "board.screen": "Obrazovka",
  "board.setUp": "Nastavit",
  "board.teams": "Týmy",
  "board.scoring": "Bodování",
  "board.crew": "Tým pořadatelů",
  "board.tabTodo": "K odehrání",
  "board.tabDone": "Odehráno",
  "board.emptyTodo": "Všechny zápasy jsou zapsané.",
  "board.emptyDone": "Zatím žádné výsledky — první se zadává v K odehrání.",
  "board.queueSending": {
    one: "Odesílá se {count} výsledek…",
    few: "Odesílají se {count} výsledky…",
    other: "Odesílá se {count} výsledků…",
  },
  "board.queueOffline": {
    one: "{count} výsledek čeká na signál",
    few: "{count} výsledky čekají na signál",
    other: "{count} výsledků čeká na signál",
  },
  "board.queueWaiting": {
    one: "{count} výsledek čeká na odeslání",
    few: "{count} výsledky čekají na odeslání",
    other: "{count} výsledků čeká na odeslání",
  },
  "board.sendNow": "Odeslat hned",
  "board.stale": "Zobrazuje se poslední stav, který tenhle mobil viděl.",
  "board.organiser": "Pořadatel",
  "board.someone": "Někdo",
  "board.inviteFailed": "Nepodařilo se vytvořit kód pro připojení.",
  "board.groupNamed": "Skupina {name}",
  "board.live": "{count} živě",

  // -------------------------------------------------------------------------
  // one match
  // -------------------------------------------------------------------------
  "match.label": "Zápas",
  "match.walkover": "kontumace",
  "match.walkoverShort": "kont.",
  "match.recorded": "už zapsáno",
  "match.live": "živě",
  "match.liveBadge": "Živě",
  "match.enter": "Zapsat",
  "match.waiting": "Čeká",
  "match.unsent": "V tomhle mobilu, zatím neodesláno",
  "match.court": "Kurt",
  "match.starts": "Začátek",
  "match.onCourtNow": "Právě na kurtu",
  "match.takeOff": "Stáhnout z kurtu",
  "match.onCourtSaved":
    "Na kurtu {court} — uloženo. Dalším klepnutím ho z kurtu stáhnete.",
  "match.noCourtYet":
    "Zatím na žádném kurtu. Klepněte na některý a hned se to uloží.",
  "match.savesOnTap":
    "Kurt, čas i míče níž se ukládají hned při klepnutí. Jediné, co čeká na Uložit, je výsledek.",
  "match.clash": "{team} má ve stejnou dobu i {code} v {time}{court}.",
  "match.clashCourt": " na kurtu {court}",
  "match.save": "Uložit výsledek",
  "match.noShow": "Někdo se nedostavil",
  "match.clear": "Smazat výsledek",
  "match.clearing": "Maže se…",
  "match.clearAsk": "Smazat tenhle výsledek?",
  "match.clearNote":
    "{home} {homeScore}–{awayScore} {away} se smaže a všechno, co to poslalo do dalšího kola, se vrátí do čekání.",
  "match.keepIt": "Nechat být",
  "match.walkoverAsk": "Kdo bere výhru?",
  "match.walkoverNote":
    "Skóre se nezapisuje. Ve skupině vítěz bere body za výhru a nic dalšího.",
  "match.replaces":
    "Uložením se zapsaný výsledek přepíše. Tabulky a všechno, co se z nich nasazuje, se přepočítá.",
  "match.setInPlay":
    "{number}. set se ještě hraje, takže se nahoře nepočítá. Uložením zápas skončí a zapíše se {home}–{away}.",
  // Česky se formát říká počtem vítězných setů — „na dva vítězné sety“ je
  // anglické „best of three“. Proto se tady používá {count}, tedy kolik setů
  // zápas bere, a ne {bestOf}, kolik se jich vejde.
  "match.bestOf": {
    one: "Hraje se na jeden vítězný set.",
    few: "Hraje se na {count} vítězné sety, kdo je má první, bere zápas.",
    other: "Hraje se na {count} vítězných setů, kdo je má první, bere zápas.",
  },
  "match.notOverYet": {
    one: "{home}–{away} zápas nekončí — hraje se na vítězný set.",
    few: "{home}–{away} zápas nekončí — hraje se na {count} vítězné sety.",
    other: "{home}–{away} zápas nekončí — hraje se na {count} vítězných setů.",
  },
  "match.tooManySets": {
    one: "Zápas končí prvním vítězným setem, takže nemůže skončit {home}–{away}.",
    few: "Zápas končí na {count} vítězné sety, takže nemůže skončit {home}–{away}.",
    other: "Zápas končí na {count} vítězných setů, takže nemůže skončit {home}–{away}.",
  },
  "match.thatIsTheMatch": "A je konec: {home}–{away} pro {name}.",
  "match.scoreFor": "Skóre pro {name}",
  "match.oneFewerFor": "O jedna méně pro {name}",
  "match.oneMoreFor": "O jedna více pro {name}",

  "sets.title": "Míče v jednotlivých setech",
  "sets.add": "Přidat set",
  "sets.number": "{number}. set",
  "sets.inPlay": "hraje se",
  "sets.remove": "Odebrat {number}. set",
  "sets.sideLabel": "{name}, {number}. set",
  "sets.oneFewer": "O jedna méně, {label}",
  "sets.oneMore": "O jedna více, {label}",
  "sets.empty":
    "Nepovinné a ukládá se to průběžně, ne až s výsledkem. Když je vyplníte, skóre nahoře se z nich spočítá, rozhodování o shodě má čísla, která potřebuje, a zeď ukazuje zápas set po setu, dokud běží.",

  "history.entered": "zapsáno {score}",
  "history.changed": "změněno z {was} na {now}",
  "history.cleared": "smazáno {was}",
  "history.aWalkover": "kontumace",

  // -------------------------------------------------------------------------
  // who is playing
  // -------------------------------------------------------------------------
  "teams.label": "Týmy",
  "teams.who": "Kdo hraje",
  "teams.intro":
    "Vyřazením týmu se uzavřou všechny jeho zbylé zápasy a přepočítají se tabulky. Dá se to vrátit.",
  "teams.isOut": "{name} končí",
  "teams.hasLeft": {
    one: "Zbývá jim {count} zápas. Co s ním, není totéž co otázka, co s výsledky týmu {name}, které už na papíře jsou.",
    few: "Zbývají jim {count} zápasy. Co s nimi, není totéž co otázka, co s výsledky týmu {name}, které už na papíře jsou.",
    other:
      "Zbývá jim {count} zápasů. Co s nimi, není totéž co otázka, co s výsledky týmu {name}, které už na papíře jsou.",
  },
  "teams.nothingLeft":
    "Odehráli všechno, co měli, takže se tady rozhoduje jen o tom, jestli ty výsledky pořád platí.",
  "teams.forfeitTitle": "Zbytek kontumují",
  "teams.forfeitBody":
    "Co odehráli, platí. Každý zbylý zápas je kontumační výhra pro toho, kdo je měl potkat. Správně, když tým odchází pozdě odpoledne.",
  "teams.voidTitle": "Škrtnout jejich výsledky",
  "teams.voidBody":
    "Každý zápas, ve kterém kdy byli, vypadne z tabulky, i jejich soupeřům. Správně, když tým odstoupí brzy, aby nikdo nebyl v tabulce výš jen proto, že s nimi náhodou hrál.",
  "teams.neverMind": "Nechat být",
  "teams.outStruck": "Mimo · výsledky škrtnuty",
  "teams.outForfeited": "Mimo · zbytek kontumován",
  "teams.toPlay": {
    one: "zbývá {count}",
    other: "zbývá {count}",
  },
  "teams.putBack": "Vrátit zpět",
  "teams.out": "Vyřadit",
  "teams.add": "Přidat",
  "teams.adding": "Přidává se…",
  "teams.addLabel": "Název týmu, který dorazil",
  "teams.addPlaceholder": "Tým, který právě dorazil",
  "teams.addHint":
    "Půjde do skupiny, kde má nejmíň co dohánět, a zahraje si se všemi, kdo v ní už jsou. Do rozehraného pavouka přidat nejde.",
  "teams.addDuplicate": "{name} už hraje.",
  "teams.joinedPool": {
    one: "{name} je ve skupině {pool} a čeká ho {count} zápas.",
    few: "{name} je ve skupině {pool} a čekají ho {count} zápasy.",
    other: "{name} je ve skupině {pool} a čeká ho {count} zápasů.",
  },
  "teams.joinedField": "{name} je v poli a nalosuje se do dalšího kola.",
  "teams.joinedRedrawn": "{name} je v poli, {stage} se losoval znovu.",
  "teams.joinedWaiting": "{name} je v poli a bude v losování, až se bude losovat.",

  // -------------------------------------------------------------------------
  // the crew
  // -------------------------------------------------------------------------
  "crew.label": "Tým pořadatelů",
  "crew.title": "Kdo to řídí s vámi",
  "crew.intro":
    "Každý odsud může zapisovat výsledky ze svého mobilu. Role říká, kdo to je, ne na co smí sahat.",
  "crew.empty": "Zatím nikdo — řídíte to sami.",
  "crew.add": "Přidat někoho",
  "crew.referee": "Rozhodčí",
  "crew.refereeHint": "Řídí zápasy a zapisuje výsledky.",
  "crew.scorer": "Zapisovatel",
  "crew.scorerHint": "Zapisuje skóre, set po setu.",
  "crew.organizer": "Spolupořadatel",
  "crew.organizerHint": "Řídí den spolu s vámi.",
  "crew.scanThis": "Ať si to naskenují — není se kam registrovat.",
  "crew.pickRole": "Vyberte, co budou dělat, a objeví se kód.",
  "crew.replace": "Nahradit tenhle kód",
  "crew.working": "Pracuje se…",
  "crew.replaceNote":
    "Nahrazením přestane ten starý fungovat. Kdo už je na seznamu, zůstává — přišli dveřmi, ne kódem.",
  "crew.removeMember": "Odebrat {name}",
  "crew.thisPerson": "tuhle osobu",

  // -------------------------------------------------------------------------
  // what the wall shows
  // -------------------------------------------------------------------------
  "screen.label": "Obrazovka",
  "screen.fallbackName": "Obrazovka",
  "screen.savedAsYouTap":
    "Ukládá se při klepnutí a zeď to za okamžik převezme — je to náhled.",
  "screen.rotation": "Co ukazuje, v tomhle pořadí",
  "screen.move": "Přesunout {name}",
  "screen.onePanel":
    "Jediný panel, takže obrazovka zůstane na něm. Poděkování běží jako poslední.",
  "screen.dragToReorder":
    "Pořadí změníte tažením za úchyt. Poděkování běží jako poslední.",
  "screen.emptySkipped": "Panel, který nemá co ukázat, se sám přeskočí.",
  "screen.notShown": "Nezobrazuje se",
  "screen.tapToRestore": "Klepnutím ho vrátíte na konec.",
  "screen.dwell": "Každý panel vydrží",
  "screen.dwellSeconds": "{seconds} s",
  "screen.onlyShow": "Ukazovat jen",
  "screen.everyStage": "Všechny fáze",
  "screen.everyGroup": "Všechny skupiny",
  "screen.everyCourt": "Všechny kurty",
  "screen.stage": "Fáze",
  "screen.group": "Skupina",
  "screen.scopeNote":
    "Přesně na tohle je druhá obrazovka u dveří s jedním kurtem. Hlavní zeď chce všechno.",
  "screen.colour": "Barva",
  "screen.accent": "Doplňková barva",
  "screen.reset": "Výchozí",
  "screen.ground": "Pozadí",
  "screen.groundLight": "Světlé",
  "screen.groundDark": "Tmavé",
  "screen.groundNote":
    "Projektor neumí černou — při rozsvícené hale zšedne tmavá obrazovka a text s ní. Tmavé je na sál, kde se zhaslo.",

  "panel.now_playing": "Právě se hraje",
  "panel.now_playing.hint": "Živé zápasy.",
  "panel.stage_progress": "Průběh fáze",
  "panel.stage_progress.hint": "Kam se den dostal.",
  "panel.court_schedule": "Rozpis kurtů",
  "panel.court_schedule.hint": "Co je na kterém kurtu.",
  "panel.stage_table": "Tabulka napříč skupinami",
  "panel.stage_table.hint": "Všechny skupiny seřazené dohromady.",
  "panel.standings": "Tabulky skupin",
  "panel.standings.hint": "Jeden panel na skupinu.",
  "panel.bracket": "Pavouk",
  "panel.bracket.hint": "Vyřazovací část.",
  "panel.next_up": "Následuje",
  "panel.next_up.hint": "Zápasy, které se teprve hrají.",
  "panel.results": "Poslední výsledky",
  "panel.results.hint": "Co právě skončilo.",

  // -------------------------------------------------------------------------
  // how the table is worked out
  // -------------------------------------------------------------------------
  "scoring.label": "Bodování",
  "scoring.note":
    "Ukládá se při klepnutí. Tabulky se přepočítají, až přijde další výsledek ve skupině, takže ta, co je už na zdi, si do té doby drží svoje body.",
  "scoring.sport": "Sport",
  "scoring.byHand": "Nastaveno ručně. Klepnutím na sport se vrátí jeho vlastní čísla.",
  "scoring.points": "Body",
  "scoring.win": "Výhra",
  "scoring.draw": "Remíza",
  "scoring.loss": "Prohra",
  "scoring.drawsTitle": "Může zápas skončit nerozhodně?",
  "scoring.drawsAllowed": "Remízy povoleny",
  "scoring.somebodyWins": "Někdo musí vyhrát",
  "scoring.draws": "Remízy",
  "scoring.drawsYes":
    "Nerozhodné skóre je výsledek a obě strany berou body za remízu.",
  "scoring.drawsNo": "Nerozhodné skóre se při uložení výsledku odmítne.",
  "scoring.drawsTail":
    "Zápas ve vyřazovací části tak jako tak nerozhodně skončit nemůže — někdo musí postoupit.",
  "scoring.formatTitle": "Setů na zápas",
  "scoring.oneGame": "Jedna hra",
  "scoring.bestOfSets": {
    one: "Na vítězný set",
    few: "Na {count} vítězné sety",
    other: "Na {count} vítězných setů",
  },
  "scoring.formatNote": {
    one: "Zápas je jedno skóre a zapíše se to, co se zadá.",
    few: "Zápas končí, jakmile má někdo {count} sety; jiný výsledek se neuloží.",
    other: "Zápas končí, jakmile má někdo {count} setů; jiný výsledek se neuloží.",
  },
  "scoring.walkoverTitle": "Kontumace se počítá jako",
  "scoring.score": "Skóre",
  "scoring.walkoverNote":
    "Připíše se tomu, kdo se dostavil. Nula brání tomu, aby něčí absence někomu vylepšila rozdíl skóre; pravidla, která říkají 3-0, chtějí 3.",
  "scoring.tiebreakTitle": "Při shodě rozhoduje",
  "scoring.alwaysFirst": "Vždy první.",
  "scoring.tiebreakNote":
    "Pořadí změníte tažením za úchyt. Vzájemné zápasy se počítají jen mezi shodnými týmy, z toho, co spolu odehrály.",
  "scoring.notUsed": "Nepoužívá se",
  "scoring.oneFewer": "{label}: o jedna méně",
  "scoring.oneMore": "{label}: o jedna více",

  // -------------------------------------------------------------------------
  // the projector and the phone
  // -------------------------------------------------------------------------
  "projector.connecting": "Připojuje se…",
  "projector.nothingYet": "{name} — zatím není co ukázat",
  "projector.reconnecting": "obnovuje se spojení",
  "projector.partners": "Naši partneři",
  "projector.poweredBy": "Běží na Whistle.day",
  "projector.credit": "Bodování a obrazovky pro tenhle turnaj",
  "projector.crossPool": {
    one: "Pořadí napříč skupinami — zobrazen {count} tým",
    few: "Pořadí napříč skupinami — zobrazeny {count} týmy",
    other: "Pořadí napříč skupinami — zobrazeno {count} týmů",
  },
  "projector.set": "{number}. set · {home}–{away}",
  "projector.versus": "vs",
  "projector.versusShort": "–",

  "phone.offline": "offline",
  "phone.tabLive": "Živě",
  "phone.tabGroups": "Skupiny",
  "phone.tabBracket": "Pavouk",
  "phone.tabResults": "Výsledky",
  "phone.nothingLive": "Právě se nic nehraje.",
  "phone.nothingScheduled": "Žádné naplánované zápasy.",
  "phone.noResults": "Zatím žádné výsledky.",

  // -------------------------------------------------------------------------
  // names the app wrote into the database
  // -------------------------------------------------------------------------
  "label.bye": "Volný los",
  "label.tbd": "Neurčeno",
  "label.winner_of": "Vítěz {code}",
  "label.loser_of": "Poražený {code}",
  "label.pool_seed": "{pool}{position}",
  "label.pool_rank": "{rank}. {pool}",
  "label.best_of_rank": "{index} nejlepší na {place} místě",

  "pool.main": "Hlavní",
  "pool.winners": "Vítězové",
  "pool.losers": "Poražení",
  "pool.final": "Finále",
  "pool.consolation": "Útěcha",
  "pool.swiss": "Švýcarský systém",

  "stage.groups": "Skupiny",
  "stage.group": "Skupina",
  "stage.playoff": "Play-off",
  "stage.swiss": "Švýcarský systém",
  "stage.double_elim": "Dvojité vyřazení",

  "display.mainScreen": "Hlavní obrazovka",

  // Czech writes every ordinal as the number and a full stop, so all four
  // forms are the same. They exist because English needs st/nd/rd/th.
  "ordinal.one": "{n}.",
  "ordinal.two": "{n}.",
  "ordinal.few": "{n}.",
  "ordinal.other": "{n}.",
};
