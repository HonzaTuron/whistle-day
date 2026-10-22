# Whistle.day

[English](README.md) | [Čeština](README.cs.md) | [Español](README.es.md)

Organizátor turnajů s libovolným řazením fází — skupiny, play-off, švýcarský systém, v jakémkoliv pořadí — a veřejným projektorovým zobrazením. Běží na **[whistle.day](https://whistle.day)**.

> **Připraveno pro AI agenty:** Whistle.day lze kompletně ovládat pomocí AI agentů (Claude Code, ChatGPT, Cursor nebo jakýkoliv MCP klient) přes Model Context Protocol. Můžete vytvářet turnaje, plánovat kurty, zadávat výsledky a sledovat tabulky v přirozeném jazyce. Více informací a návod na propojení najdete na **[whistle.day/mcp](https://whistle.day/mcp)**.

**Stav: celý turnaj lze řídit z mobilu — nebo z tolika mobilů, kolik je kurtů.** Zadejte název, zvolte sport, přidejte týmy, vyberte herní systém a získáte odkaz i QR kód. Pak už jen řídíte den: posíláte zápasy na kurty, označujete rozehrané duely a zapisujete výsledky. Tabulky se přepočítávají, pavouk nasazený ze skupin se sám doplňuje, další kolo švýcarského systému se samo rozlosuje a zeď s projektorem vše živě promítá. Rozhodčímu stačí předat QR kód a svůj kurt řídí ze svého telefonu.

```
whistleday/
├── docs/DATA-MODEL.md       ← začněte zde
├── backend/                  PocketBase jako Go framework
│   ├── migrations/           databázové schéma
│   └── internal/tournament/  generování, tabulky, dosazování pozic
├── packages/engine/          sdílené TypeScript typy (bez logiky)
└── scripts/smoke.ts          end-to-end integrační test proti živému serveru
```

## Datový model v jedné větě

Turnaj je seřazený seznam **fází** (stages); každá fáze obsahuje **pozice** (slots — zástupná místa, která účastníka zjistí až v průběhu) a **zápasy** (fixtures) mezi nimi. Důvody a architektonická rozhodnutí najdete v [docs/DATA-MODEL.md](docs/DATA-MODEL.md).

## Požadavky

| | |
|---|---|
| Go | 1.27+ — požadavek PocketBase, nikoliv náš |
| Bun | 1.4.0 — uzamčeno v `.bun-version` a `packageManager` |
| PocketBase | v0.40.3, jako závislost v Go — nikoli stažená binárka |

PocketBase se používá jako **Go framework**. `go build` vyprodukuje binárku serveru se zkompilovanou turnajovou logikou. JS hooky PocketBase běží v goja, což nemá npm ani Node API, a tato logika vyžaduje skutečné transakce a poctivé testy.

Minimální verze Go je striktní: PocketBase v0.40 přešel na `encoding/json/v2`, což vyžaduje Go 1.27. `backend/go.mod` uvádí `go 1.27` a výchozí `GOTOOLCHAIN=auto` si správnou verzi stáhne při prvním buildu.

## Začínáme

```bash
bun install
bun run pb:build      # zkompiluje backend/pocketbase
bun run pb:migrate    # aplikuje schéma
bun run pb:superuser  # admin@whistleday.local / whistledayadmin1
```

Poté ve třech terminálech:

```bash
bun run pb:serve   # backend + admin UI na :8090
bun run seed       # demo turnaj: 8 týmů, skupiny, živé semifinále
bun run web        # webové obrazovky na :5173
```

- Založení turnaje — <http://localhost:5173/new>
- Projektor — <http://localhost:5173/display/hala-1>
- Mobil — <http://localhost:5173/m/hala-1>

Opakované spuštění `bun run seed` demo nahradí, místo aby přidalo další.

## Obrazovky

| Trasa | Účel |
|---|---|
| `/new` | Pro organizátora: název, sport, týmy, kurty, formát a odkaz na projekční zeď. |
| `/t/:id` | Řízení dne: kurty, časy, co právě běží, zápis skóre, nastavení bodování a režim zdi. |
| `/join/:token` | Cíl zvacího QR kódu pro obsluhu kurtu: zadat jméno, potvrdit jedním klepnutím a rozhodovat. |
| `/account` | Připojení e-mailu k účtu v zařízení nebo přihlášení z jiného zařízení. |
| `/display/:token` | Projektor: bezobslužný, sám rotuje pohledy, čitelný z celé sportovní haly. |
| `/m/:token` | Mobil: záložky, procházení, rychlé nalezení vlastního zápasu pro hráče a diváky. |

Jde o oddělené trasy, protože kromě dat nesdílejí téměř nic — viz [apps/web/README.md](apps/web/README.md).

## Kontroly a testy

```bash
bun run check   # typecheck + go vet/test + smoke
```

| Příkaz | Co pokrývá |
|---|---|
| `bun run typecheck` | TypeScript 7 |
| `bun run web:test` | 37 testů: pravidla offline fronty a překryvů, limity skóre podle formátů, rozpoznání obrazovek |
| `bun run pb:test` | `go vet` + 161 jednotkových testů: generátory, párování, tiebreaky, dohrávky, pozdní přihlášky |
| `bun run smoke` | 215 kontrol proti reálnému PocketBase s dočasným datovým adresářem |

Zásadní je běh smoke testu. Spustí server, vygeneruje dvoučlennou skupinovou fázi a navazující play-off, odehraje všechny zápasy skupin přes REST API a ověří tabulky, pavouka i projekční payload. Poté odehraje kompletní pavouk na dvě porážky (double elimination) i švýcarský systém až do konce — což je jediný způsob, jak ověřit, že se pavouk nezasekne a rozlosování kola neselže.

```bash
bun run stats                 # backend/pb_data/data.db
bun run stats -- /path/to/data.db
```

Statistický přehled — provozní čísla čtená z databáze v režimu pouze pro čtení (dokončené turnaje, oblíbené formáty, počty kurtů, aktivní účty atd.).

## Jak turnaj probíhá (API)

```bash
# 1. skupiny
POST /api/stages/{groups}/generate?dry_run=1   # náhled rozlosování
POST /api/stages/{groups}/generate             # potvrzení a uložení

# 2. play-off nasazené ze skupin
#    stages.config = { "seedFrom": { "stage": "<groups>", "advancePerPool": 2 } }
#    přidáním "bestOfNext": 4 lze postoupit i nejlepší 4 týmy ze 3. míst
POST /api/stages/{playoff}/generate

# 3. odehrání zápasů. Zápis výsledku vyvolá celou kaskádu včetně nalosování
#    dalšího kola švýcarského systému.
PATCH /api/collections/fixtures/records/{id}
      { "status": "finished", "home_score": 2, "away_score": 0 }

# 4. zobrazení na zdi / projektoru
GET /api/display/{token}
```

Uzavření zápasu spustí celý řetězec: určí vítěze ze skóre, propíše ho do navazujících pozic, přepočítá tabulky a po dokončení skupiny doplní čekající sloty v play-off.

### Endpoints nad rámec kolekčního API

| | |
|---|---|
| `POST /api/stages/{stage}/generate` | Generování skupin, pozic a zápasů. `?dry_run=1` vrací plán bez uložení. |
| `POST /api/stages/{stage}/resolve` | Přepočet a oprava fáze po opravách skóre. Idempotentní. |
| `POST /api/stages/{stage}/pair` | Nalosování dalšího kola švýcarského systému (opravná trasa, běžně probíhá automaticky). |
| `POST /api/entries/{entry}/withdraw` | Odstoupení týmu (`forfeit` nebo `void`). |
| `POST /api/entries/{entry}/reinstate` | Návrat odstoupeného týmu zpět do turnaje. |
| `POST /api/entries/{entry}/admit` | Přidání opožděného týmu do již rozlosovaného turnaje. |
| `GET /api/staff/invite/{token}` | Informace o pozvánce pořadatele/rozhodčího. |
| `POST /api/staff/join` | Přijetí role pořadatele na tomto zařízení. |
| `POST /api/preview` | Generování náhledu neexistující fáze (veřejné, bez uložení do DB). |
| `GET /api/display/{token}` | Kompletní payload pro projektor na jedno volání. Podporuje `If-None-Match`. |
| `GET /api/realtime` | Server-Sent Events stream změn pro živou aktualizaci obrazovek. |
| `GET /api/docs` | Veřejná interaktivní dokumentace OpenAPI. |
| `GET /api/openapi.json` | OpenAPI 3.1 specifikace. |

## Turnaj může řídit i AI agent

Whistle.day lze kompletně ovládat pomocí AI agentů přes Model Context Protocol (MCP). Pro návody na nastavení pro Claude Code, Claude Desktop i ChatGPT navštivte **[whistle.day/mcp](https://whistle.day/mcp)**.

Rozhraní `/api/mcp` je plnohodnotný MCP server běžící přes Streamable HTTP — jeden koncový bod, `POST` pro dotaz, `GET` pro stream událostí, `DELETE` pro ukončení relace. Nabízí 21 nástrojů (stejné akce generování, přepočtu, zápisu skóre a publikování, které používají webové obrazovky) a dva prompty: `plan_a_tournament` a `enter_the_results`.

Nástroj `create_tournament` se ptá na zvolený sport ze stejného důvodu jako průvodce — 3 body za výhru s možností remízy fungují ve fotbale, ale jsou špatně pro halové sporty. Předvolby jsou definovány v `backend/internal/tournament/sports.json`.

Agent je vnímán jako organizátor bez registrace. Nástroj `create_tournament` jako jediný nevyžaduje oprávnění — vytvoří dočasný účet a všechny další nástroje vystupují pod ním. Spojení je provázáno s `Mcp-Session-Id`.

Turnaj může agent předat člověku pomocí `create_handoff`. Vygeneruje odkaz na `/claim/{token}`, kde organizátor zadá e-mail a heslo, a turnaj převezme do své správy.

Server podporuje také OAuth 2.1 (`backend/internal/oauth`), takže se organizátor může přihlásit a předat agentovi token navázaný na svůj existující účet.

## Klíčové chování a vlastnosti

- **Angličtina, čeština a španělština.** Každá obrazovka funguje ve všech třech jazycích bez externích i18n knihoven (typované slovníky v `apps/web/src/locales/`). Parametr `?lang=cs` nebo `?lang=es` má přednost před jazykem prohlížeče.
- **Názvy putují jako fakta, nikoliv věty.** Texty jako „Vítěz ČF1“ se nepřekládají jako statický řetězec, ale pozice nese typ a parametry, takže si je zobrazovací zařízení naformátuje samo.
- **Zvolený sport určuje pravidla bodování.** Výběr sportu v průvodci automaticky nastaví bodování za výhru/remízu/prohru, kontumace i pořadí tiebreaků.
- **Remíza je odmítnuta tam, kde sport remízu nezná.** V pavouku ani ve sportech bez remíz nelze uložit nerozhodný stav.
- **Výsledky se ukládají na telefonu dříve, než se odešlou.** V hale s nespolehlivou Wi-Fi se výsledky zapisují do odolné fronty v telefonu a odesílají se na pozadí.
- **V offline režimu se uzavře pouze daný zápas.** Přepočet tabulek a postupů provádí autoritativně až server po odeslání fronty.
- **Korekce výsledků se automaticky propagují.** Úprava skóre kdykoliv později znovu přepočítá tabulky od nuly (žádná inkrementální akumulace chyb).
- **Volné losy (byes) se odbavují samy.** Zápas proti nahlášenému bye je automaticky rozhodnut, jakmile je znám soupeř.
- **Kolo švýcarského systému se samo nalosuje**, jakmile skončí předchozí kolo.
- **Volný los ve švýcarském systému dává body**, v pavouku nikoliv.
- **Play-off čeká na dokončení celé skupiny.** Do pavouka nikdy nepostoupí tým z neúplné skupiny.
- **Vzájemné zápasy (head-to-head) se počítají pouze mezi rovnými týmy.**
- **Srovnání týmů z různých skupin (např. o postup ze 3. míst)** porovnává výsledky pouze proti stejnému počtu soupeřů.
- **Otočka projektoru končí poděkováním sponzorům.**
- **Pozdní příchod týmu ho přidá do běžícího turnaje.**
- **Zápas ví, kdy skončil.** Server odmítne skóre, které neodpovídá formátu (např. 4. set při hře na 2 vítězné sety).
- **Odstoupení týmu rozlišuje `forfeit` (kontumace zbývajících) a `void` (anulování všech zápasů).**
- **Již nalosované kolo švýcarského systému se při odchodu týmu nepřelosovává** — soupeř získá kontumaci.
- **Odstoupení lze přesně vrátit zpět.**
- **Rozhodčí a obsluha se připojují QR kódem.**
- **Každá strana zápasu je vykreslitelná** — i prázdný slot má popisek (např. „Vítěz SF1“).
- **Konflikty v rozvrhu kurtů se hlásí jako varování, ale neblokují organizátora.**
- **Rate limiting počítá s tím, že celá sportovní hala sdílí jednu veřejnou IP adresu.**
- **Opuštěné koncepty turnajů se promazávají až po 30 dnech.**
- **Žádné sledování ani trackery na obrazovkách zápasů a projektoru.**

## Licence

[AGPL-3.0-or-later](LICENSE).