/**
 * Czech marketing pages targeting low-competition search queries:
 * - "pavouk turnaje generátor"
 * - "rozpis každý s každým tabulka"
 * - "švýcarský systém turnaj rozpis"
 * - "generátor turnajů"
 * - printable sheets in Czech ("pavouk turnaje k vytištění", "rozpis každý s každým k vytištění")
 */

import { factsForCs, roundRobinGrid, singleElimGrid } from "./shape";
import type { Page } from "./types";

export const CZECH_HUB: Page = {
  slug: "generator-turnaju",
  kind: "hub",
  locale: "cs",
  title: "Generátor turnajů zdarma: pavouk, skupiny i každý s každým",
  h1: "Generátor turnajů online a zdarma",
  description:
    "Vytvořte pavouka turnaje, základní skupiny nebo rozpis každý s každým za 1 minutu. Živé výsledky v mobilu i na projektoru. Zdarma a bez registrace.",
  lede:
    "Zadejte seznam týmů a časový rámec. Whistle.day automaticky rozlosuje zápasy na kurty, vytvoří rozpis i QR kód pro hráče. Po zadání výsledků z mobilu se tabulky i pavouk okamžitě samy přepočítají.",
  generator: { preset: "groups", teams: 8, lang: "cs" },
  alternate: { hreflang: "en", slug: "tournament-generator" },
  teamGrids: [singleElimGrid("cs"), roundRobinGrid("cs")],
  sections: [
    {
      heading: "Vyberte formát podle času, ne podle složitých názvů",
      body: [
        "Většina turnajových aplikací se ptá na počet skupin a postupový klíč dřív, než znáte harmonogram. Skutečné rozhodnutí je přitom jednoduché: kolik máte k dispozici kurtů, kolik hodin máte v hale a kolik zápasů si má každý tým zahrát.",
        "**Vyřazovací pavouk (play-off)** je nejrychlejší cesta k vítězi, ale polovina týmů končí po prvním zápase. **Rozpis každý s každým** je nejspravedlivější, ale zabere nejvíce zápasů. **Základní skupiny s postupem do play-off** jsou zlatý standard většiny jednodenních turnajů – každý má zaručeno několik zápasů a den vrcholí finálovým pavoukem. **Švýcarský systém** se hodí tam, kde máte hodně účastníků a nechcete nikoho vyřadit.",
        "Ať zvolíte jakýkoliv systém, přesný počet zápasů i odhadovaný čas konce vidíte předem, spočítaný pro váš počet týmů a hřišť.",
      ],
    },
    {
      heading: "Živé řízení dne, nejen vytištěný papír",
      body: [
        "Rozlosovat turnaj na papír je snadné. Těžší jsou čtyři hodiny potom: který zápas se hraje na kterém kurtu, kdo píská, kdo vyhrál a co to udělá s postupovou tabulkou.",
        "Whistle.day je postaven přesně pro průběh turnaje. Zapisovat výsledky můžete přímo z telefonu u kurtu. Systém okamžitě přepočítá minitabulky, posune vítěze do dalšího kola pavouka a aktualizuje promítání na zeď přes projektor nebo televizi.",
      ],
    },
    {
      heading: "Zcela zdarma a bez nutnosti registrace",
      body: [
        "Nemusíte vyplňovat žádný registrační formulář ani zadávat platební kartu. Kliknete na vytvoření turnaje a můžete začít. Pro uložení nebo otevření na jiném zařízení stačí později zadat e-mail.",
      ],
    },
  ],
  faq: [
    {
      q: "Je generátor turnajů skutečně zdarma?",
      a: "Ano. Všechny formáty turnajů (pavouk, každý s každým, skupiny, švýcarský systém), neomezený počet týmů, zobrazení pro projektor i mobilní zobrazení pro diváky jsou zcela zdarma.",
    },
    {
      q: "Musím se předem registrovat?",
      a: "Ne. Založíte turnaj během minuty a systém vám vygeneruje odkaz pro správu a QR kód pro hráče. Účet si můžete propojit kdykoliv později.",
    },
    {
      q: "Mohou hráči sledovat průběžné výsledky na mobilu?",
      a: "Ano. Každý turnaj má unikátní QR kód a odkaz na mobilní přehled výsledků a tabulek. Hráči i diváci mají aktuální skóre ihned ve svém telefonu.",
    },
  ],
  related: [
    "pavouk-turnaje-generator",
    "rozpis-kazdy-s-kazdym-tabulka",
    "svycarsky-system-turnaj-rozpis",
    "skupiny-a-play-off-generator",
    "printable/pavouk-turnaje",
    "printable/rozpis-kazdy-s-kazdym",
  ],
};

export const CZECH_FORMAT_PAGES: Page[] = [
  {
    slug: "pavouk-turnaje-generator",
    kind: "format",
    locale: "cs",
    title: "Pavouk turnaje generátor: vyřazovací systém a play-off zdarma",
    h1: "Pavouk turnaje generátor",
    description:
      "Generátor pavouka pro libovolný počet týmů (4 až 32). Automatické vyřešení volných losů (byes), zápas o 3. místo, živé výsledky zdarma.",
    lede:
      "Klasický vyřazovací systém (KO systém, play-off pavouk). Prohraješ a končíš. Generátor automaticky doplní volné losy (byes) do nejbližší mocniny 2 a férově nasadí favority.",
    generator: { preset: "knockout", teams: 8, lang: "cs" },
    alternate: { hreflang: "en", slug: "single-elimination-bracket-generator" },
    teamGrids: [singleElimGrid("cs")],
    facts: factsForCs("knockout", 8),
    sections: [
      {
        heading: "Jak fungují volné losy (byes) v pavouku turnaje",
        body: [
          "Vyřazovací pavouk potřebuje mocninu dvou: 4, 8, 16 nebo 32 týmů. Většina turnajů má ale jiný počet účastníků (např. 6, 10, 12 nebo 14 týmů). Rozdíl se řeší pomocí **volných losů (byes)** – vybrané týmy nehrají první kolo a postupují přímo do druhého kola.",
          "Nemusíte nic složitě počítat z hlavy. Zadáte například 10 týmů a pavouk se sestaví pro 16 pozic se 6 volnými losy. Volné losy automaticky připadnou nasazeným týmům (nasazené 1 až 6), což zaručuje férovost a zabraňuje zkreslení losu.",
        ],
      },
      {
        heading: "Přehledný rozpis a zápas o 3. místo",
        body: [
          "Všechny pozice v pavouku mají jasná označení („Vítěz ČF1“, „1. A“, „Volný los“). Pavouk lze promítnout na projektor v hale nebo vytisknout jako přehledný formulář.",
          "Zápas o třetí místo je automaticky zapnutý. Pro dva týmy, které prohrály v semifinále, to znamená ještě jedno kvalitní utkání a důstojné zakončení turnaje s medailovým soubojem.",
        ],
      },
      {
        heading: "Živé posouvání vítězů z mobilu",
        body: [
          "Jakmile rozhodčí nebo zapisovatel u kurtu zadá výsledek zápasu, vítěz se během zlomku sekundy automaticky posune do dalšího kola pavouka. Žádné přepisování fixou na tabuli.",
        ],
      },
    ],
    faq: [
      {
        q: "Kolik zápasů se hraje v pavouku turnaje?",
        a: "V každém zápase vypadává jeden tým, takže počet zápasů je vždy (počet týmů − 1). Pokud se hraje zápas o 3. místo, přičítá se 1 zápas navíc. Například pro 8 týmů je to celkem 8 zápasů.",
      },
      {
        q: "Co když nemám mocninu dvou (např. 10 nebo 12 týmů)?",
        a: "Systém automaticky doplní pavouka na nejbližší mocninu 2 (pro 10 i 12 týmů je to pavouk pro 16) a chybějící místa obsadí volné losy (byes), které připadnou nejvýše nasazeným týmům.",
      },
      {
        q: "Lze pavouka vytisknout na papír?",
        a: "Ano. Nabízíme čistý printable formulář pavouka turnaje s linkami pro zápis skóre optimalizovaný pro tisk na A4 na šířku.",
      },
    ],
    related: [
      "rozpis-kazdy-s-kazdym-tabulka",
      "svycarsky-system-turnaj-rozpis",
      "skupiny-a-play-off-generator",
      "printable/pavouk-turnaje",
      "generator-turnaju",
    ],
  },

  {
    slug: "rozpis-kazdy-s-kazdym-tabulka",
    kind: "format",
    locale: "cs",
    title: "Rozpis každý s každým tabulka: generátor zápasů online",
    h1: "Rozpis každý s každým a tabulka turnaje",
    description:
      "Generátor rozpisu turnaje každý s každým s automatickou tabulkou. Přesná vzájemná utkání, skóre, tisk i živý režim na mobilu zdarma.",
    lede:
      "Každý tým se utká se všemi soupeři. Žádné okamžité vyřazení, stejná porce zápasů pro všechny a automatická tabulka s vysvětlenými tiebreakery.",
    generator: { preset: "everyone", teams: 6, lang: "cs" },
    alternate: { hreflang: "en", slug: "round-robin-generator" },
    teamGrids: [roundRobinGrid("cs")],
    facts: factsForCs("everyone", 6),
    sections: [
      {
        heading: "Kompletní rozpis zápasů rozdělený po jednotlivých kolech",
        body: [
          "Algoritmus vygeneruje rozpis tak, aby se každá dvojice potkala právě jednou. Zápasy jsou rozděleny do kol a rozprostřeny na počet kurtů nebo stolů, které máte k dispozici.",
          "U každého počtu týmů předem vidíte celkový počet utkání i odhadovaný čas turnaje. Systém každý s každým roste rychle: zdvojnásobení počtu týmů zhruba čtyřnásobí počet zápasů.",
        ],
      },
      {
        heading: "Lichý počet týmů a volno v kole",
        body: [
          "Při lichém počtu účastníků (např. 5, 7 nebo 9 týmů) nemohou v jednom kole hrát všichni najednou. Generátor automaticky naplánuje pro každý tým přesně jedno volné kolo (bye). Počet kol se rovná počtu týmů a celkový počet odehraných zápasů zůstává spravedlivý.",
        ],
      },
      {
        heading: "Automatická tabulka a férové rozhodování při rovnosti bodů",
        body: [
          "Tabulka se po každém zadaném výsledku přepočítává od nuly. Při rovnosti bodů rozhoduje vzájemný zápas (pouze mezi týmy se stejným počtem bodů), poté rozdíl skóre a vstřelené body. Pod tabulkou se navíc vždy srozumitelně vypíše důvod, proč je daný tým v pořadí výše, což zabraňuje sporům v hale.",
        ],
      },
    ],
    faq: [
      {
        q: "Kolik zápasů má turnaj každý s každým?",
        a: "Vzorec je: týmy × (týmy − 1) ÷ 2. Pro 4 týmy je to 6 zápasů, pro 6 týmů 15 zápasů, pro 8 týmů 28 zápasů a pro 10 týmů 45 zápasů.",
      },
      {
        q: "Co rozhoduje při shodě bodů?",
        a: "Výchozí pořadí kritérií: body, vzájemný zápas (head-to-head minitabulka mezi remizujícími), rozdíl skóre, vstřelené body.",
      },
      {
        q: "Může hrát každý s každým dvakrát (doma / venku)?",
        a: "Ano, v nastavení můžete zvolit dvoukolový systém, který rozpis zdvojnásobí.",
      },
    ],
    related: [
      "pavouk-turnaje-generator",
      "skupiny-a-play-off-generator",
      "svycarsky-system-turnaj-rozpis",
      "printable/rozpis-kazdy-s-kazdym",
      "generator-turnaju",
    ],
  },

  {
    slug: "svycarsky-system-turnaj-rozpis",
    kind: "format",
    locale: "cs",
    title: "Švýcarský systém turnaj rozpis: automatické losování kol",
    h1: "Švýcarský systém turnaje – rozpis a generátor",
    description:
      "Rozpis turnaje švýcarským systémem (šachy, šipky, badminton, esport). Automatické párování dalších kol podle průběžného pořadí zdarma.",
    lede:
      "Nikdo nevypadává a všichni odehrají stejný počet kol. V každém kole hrají týmy se stejnou bilancí (vítězové s vítězi, poražení s poraženými). Další kolo se vylosuje samo hned po skončení předchozího.",
    generator: { preset: "swiss", teams: 16, lang: "cs" },
    alternate: { hreflang: "en", slug: "swiss-tournament-generator" },
    facts: factsForCs("swiss", 16),
    sections: [
      {
        heading: "Další kolo se losuje automaticky z průběžné tabulky",
        body: [
          "Předem je známo pouze první kolo. Jakmile se zapíše poslední výsledek aktuálního kola, systém okamžitě provede párování pro další kolo z aktuálního stavu tabulky. Nemusíte nic ručně párovat ani počítat Buchholz.",
          "Algoritmus dbá na to, aby se stejní dva soupeři nepotkali v průběhu turnaje dvakrát.",
        ],
      },
      {
        heading: "Kolik kol by měl švýcarský turnaj mít?",
        body: [
          "Standardní doporučení je zaokrouhlený logaritmus o základu 2 z počtu hráčů: pro 8 hráčů 3 kola, pro 16 hráčů 4 kola, pro 32 hráčů 5 kol a pro 64 hráčů 6 kol. To je minimální počet kol, který garantuje jednoho neporaženého vítěze.",
        ],
      },
      {
        heading: "Švýcarský systém zakončený play-off",
        body: [
          "Oblíbenou variantou je odehrát švýcarský systém pro celé startovní pole a nejlepší 4 účastníky nasadit do semifinále a finále. Tento formát kombinuje jistotu zápasů pro všechny s atraktivním vyvrcholením dne.",
        ],
      },
    ],
    faq: [
      {
        q: "Pro které sporty se švýcarský systém hodí?",
        a: "Tradičně pro šachy, stolní tenis, badminton, šipky, padel, pétanque a esport (např. CS:GO / Magic: The Gathering).",
      },
      {
        q: "Jak se řeší lichý počet účastníků ve švýcarském systému?",
        a: "Hráč, na kterého v daném kole nezbude soupeř, dostává volný los (bye), který se boduje jako výhra, aby nebyl znevýhodněn.",
      },
    ],
    related: [
      "pavouk-turnaje-generator",
      "rozpis-kazdy-s-kazdym-tabulka",
      "skupiny-a-play-off-generator",
      "generator-turnaju",
    ],
  },

  {
    slug: "skupiny-a-play-off-generator",
    kind: "format",
    locale: "cs",
    title: "Skupinový turnaj a pavouk generátor: základní skupiny + play-off",
    h1: "Turnaj ve skupinách s play-off pavoukem",
    description:
      "Rozlosujte turnaj do základních skupin s postupem do vyřazovacího pavouka. Živé tabulky, automatické nasazení do play-off, zdarma.",
    lede:
      "Nejoblíbenější formát jednodenních turnajů: každý tým má zaručeno několik zápasů ve skupině a nejlepší postoupí do vyřazovacího pavouka, který se sám naplní z tabulek.",
    generator: { preset: "groups", teams: 12, lang: "cs" },
    alternate: { hreflang: "en", slug: "group-stage-knockout-generator" },
    facts: factsForCs("groups", 12),
    sections: [
      {
        heading: "Pavouk play-off se naplní sám po dohrání skupin",
        body: [
          "Pavouk je vytvořený už od rána na zdi nebo obrazovce, se sloty jako „1. skupina A“, „2. skupina B“. Jakmile skupiny dohrají a tabulky jsou konečné, reálné názvy týmů automaticky skočí do pavouka.",
          "Nikdo nemusí v poledne v hale u stolu překreslovat tabulky fixou nebo luštit, kdo z jakého místa postoupil.",
        ],
      },
      {
        heading: "Optimální velikost skupin",
        body: [
          "Skupiny po 4 nebo 5 týmech jsou ideální kompromis: každý tým odehraje 3 až 4 garantované zápasy a skupiny skončí včas, aby zbyl prostor na čtvrtfinále, semifinále a finále.",
        ],
      },
    ],
    faq: [
      {
        q: "Kolik týmů postupuje ze skupiny?",
        a: "Standardně postupují první dva týmy z každé skupiny do čtvrtfinále nebo semifinále.",
      },
      {
        q: "Co když má skupina 3 a jiná 4 týmy?",
        a: "Systém podporuje i nestejně velké skupiny a automaticky přepočítává férové srovnání při postupu.",
      },
    ],
    related: [
      "pavouk-turnaje-generator",
      "rozpis-kazdy-s-kazdym-tabulka",
      "generator-turnaju",
      "printable/pavouk-turnaje",
    ],
  },
];

export const CZECH_PRINTABLE_PAGES: Page[] = [
  {
    slug: "printable/pavouk-turnaje",
    kind: "printable",
    locale: "cs",
    title: "Pavouk turnaje k vytištění: prázdný rozpis PDF zdarma",
    h1: "Pavouk turnaje k vytištění",
    description:
      "Vytiskněte si prázdného pavouka turnaje pro libovolný počet týmů (4 až 32). Přehledná políčka na skóre, volné losy vyřešeny. Zdarma v PDF.",
    lede:
      "Nastavte počet týmů a vytiskněte si čistého pavouka turnaje s políčky na skóre a zápasem o 3. místo. Můžete vytisknout s vlastními názvy týmů nebo s čísly k dopsání fixou v hale.",
    generator: { preset: "knockout", teams: 8, lang: "cs" },
    alternate: { hreflang: "en", slug: "printable/bracket" },
    facts: factsForCs("knockout", 8),
    sections: [
      {
        heading: "Papír nepotřebuje Wi-Fi ani zásuvku",
        body: [
          "Papírový pavouk vyvěšený na nástěnce je osvědčená klasika. Formulář níže generuje stejný přesný algoritmus jako naše aplikace: volné losy (byes) jsou férově umístěny k nasazeným favoritům.",
          "Můžete před tiskem vyplnit názvy týmů do políček výše, nebo je nechat prázdné a dopsat jména ručně při losování.",
        ],
      },
      {
        heading: "Tipy pro tisk formuláře",
        body: [
          "Tiskněte na šířku (Landscape) s volbou přizpůsobení velikosti stránky (Fit to page). Doporučujeme vytisknout dva výtisky: jeden na zeď pro hráče a jeden na stůl pořadatele.",
        ],
      },
    ],
    faq: [
      {
        q: "Jak pavouka vytisknu nebo uložím do PDF?",
        a: "Klikněte na tlačítko Vytisknout tento rozpis a v dialogu tisku prohlížeče zvolte buď vaši tiskárnu, nebo Uložit jako PDF.",
      },
      {
        q: "Lze na papír dopsat vlastní týmy?",
        a: "Ano. Můžete buď vyplnit jména v políčkách výše před tiskem, nebo vytisknout prázdný formulář s očíslovanými pozicemi.",
      },
    ],
    related: [
      "printable/rozpis-kazdy-s-kazdym",
      "pavouk-turnaje-generator",
      "generator-turnaju",
    ],
  },

  {
    slug: "printable/rozpis-kazdy-s-kazdym",
    kind: "printable",
    locale: "cs",
    title: "Rozpis každý s každým k vytištění: tabulka a zápasy PDF",
    h1: "Rozpis turnaje každý s každým k vytištění",
    description:
      "Vytiskněte si tabulku a rozpis zápasů každý s každým rozdělený po jednotlivých kolech. Políčka na skóre, formát A4, zdarma.",
    lede:
      "Všechny vzájemné zápasy rozdělené po jednotlivých kolech s rámečky na výsledky. Vytiskněte si rozpis na papír, vyvěste na nástěnku a zapisujte skóre během dne.",
    generator: { preset: "everyone", teams: 8, lang: "cs" },
    alternate: { hreflang: "en", slug: "printable/round-robin-schedule" },
    facts: factsForCs("everyone", 8),
    sections: [
      {
        heading: "Zápasy přehledně seřazené po jednotlivých kolech",
        body: [
          "Místo nepřehledného seznamu dvojic jsou zápasy rozděleny do kol (1. kolo, 2. kolo...). Každý tým přesně ví, kdy hraje a kdy má pauzu. U lichého počtu týmů rozpis automaticky zohledňuje volné losy (byes).",
        ],
      },
      {
        heading: "Kdy přejít z papíru na mobilní aplikaci",
        body: [
          "Papírový rozpis funguje skvěle, dokud nenastane rovnost bodů v tabulce. Minitabulky a vzájemné zápasy tří týmů se na papíře počítají složitě a často vedou k hádkám u vyhlášení. Pokud chcete mít jistotu, můžete výsledky zadávat v našem online generátoru z mobilu.",
        ],
      },
    ],
    faq: [
      {
        q: "Lze rozpis vytisknout pro libovolný počet týmů?",
        a: "Ano, v poli Počet týmů můžete nastavit libovolné číslo a rozpis se ihned překreslí.",
      },
      {
        q: "Jak je vyřešen lichý počet účastníků?",
        a: "V každém kole má přesně jeden tým volno (bye), takže se vystřídají všichni bez nutnosti složitých úprav.",
      },
    ],
    related: [
      "printable/pavouk-turnaje",
      "rozpis-kazdy-s-kazdym-tabulka",
      "generator-turnaju",
    ],
  },
];

export const CZECH_PAGES: Page[] = [
  CZECH_HUB,
  ...CZECH_FORMAT_PAGES,
  ...CZECH_PRINTABLE_PAGES,
];

export const CZECH_ALIASES: Record<string, string> = {
  "pavouk-turnaje": "pavouk-turnaje-generator",
  pavouk: "pavouk-turnaje-generator",
  "vyrazovaci-system-generator": "pavouk-turnaje-generator",
  "vyrazovaci-pavouk": "pavouk-turnaje-generator",
  "turnaj-kazdy-s-kazdym": "rozpis-kazdy-s-kazdym-tabulka",
  "kazdy-s-kazdym-generator": "rozpis-kazdy-s-kazdym-tabulka",
  "kazdy-s-kazdym-tabulka": "rozpis-kazdy-s-kazdym-tabulka",
  "rozpis-kazdy-s-kazdym": "rozpis-kazdy-s-kazdym-tabulka",
  "svycarsky-system": "svycarsky-system-turnaj-rozpis",
  "svycarsky-system-generator": "svycarsky-system-turnaj-rozpis",
  "skupinovy-turnaj-a-pavouk": "skupiny-a-play-off-generator",
  "skupiny-a-pavouk": "skupiny-a-play-off-generator",
  "turnajovy-generator": "generator-turnaju",
  "printable/pavouk": "printable/pavouk-turnaje",
  "printable/kazdy-s-kazdym": "printable/rozpis-kazdy-s-kazdym",
};
