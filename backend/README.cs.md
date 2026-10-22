# backend

[English](README.md) | [Čeština](README.cs.md) | [Español](README.es.md)

PocketBase použitý jako **Go framework**. `go build` vytvoří binárku serveru s přímo zakomponovanou turnajovou logikou.

> **Podpora pro AI agenty a MCP:** Backend poskytuje plnohodnotný Model Context Protocol server na `/api/mcp` (`backend/internal/mcp`). Autonomní AI agenti jako Claude Code nebo ChatGPT mohou vytvářet a řídit celé turnaje přirozeným jazykem. Podrobnosti na **[whistle.day/mcp](https://whistle.day/mcp)**.

```
backend/
├── main.go                     vstupní bod aplikace, registrace hooků a rout
├── migrations/                 databázové schéma — jediný zdroj pravdy
├── internal/tournament/
│   ├── generate.go             generátory pavouků a skupin, ukládání plánů
│   ├── standings.go            výpočet tabulek, tiebreaky, sloty typu pool_rank
│   ├── resolve.go              vyhodnocení vítězů, propagace slotů, hooky
│   ├── realtime.go             upozornění obrazovek při změně dat
│   ├── display.go              sestavení kompletního payloadu pro projektor
│   └── routes.go               endpointy pro generování, řešení a projekci
└── internal/apidocs/
    ├── openapi.json            veřejná reference API
    ├── docs.html               stránka vykreslená na /api/docs
    └── apidocs.go              obsluha obou formátů z běžícího schématu
```

Adresář `pb_data/` a zkompilovaná binárka `pocketbase` jsou v `.gitignore`.

## Proč Go a nikoli pb_hooks

JS hooky PocketBase běží v goja: žádné npm, žádná Node API, pouze ES5 s částmi ES2015. Zde běží klíčová logika celého projektu, která potřebuje databázové transakce a testy, proto patří do kompilovaného kódu.

## Řetězec zápisu při dohrání zápasu

Vše se odvíjí od jediné události — uzavření výsledku zápasu (`fixture settled`):

```
zápas uzavřen
  └─ deriveOutcome        určení vítěze/poraženého ze skóre (před zápisem)
  └─ PropagateFixture     vyplnění slotů, které z tohoto zápasu čerpají
       └─ refreshDependentFixtures   denormalizace účastníků, posun na "ready"
  └─ ComputeStandings     přepočet všech tabulek skupin ve fázi
  └─ ResolvePoolRanks     vyplnění slotů čekajících na finální pořadí skupiny
```
