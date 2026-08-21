# Seedly

Turnajový organizátor s libovolným pořadím fází (skupiny, playoff, Swiss —
v jakémkoli sledu) a veřejným zobrazením na projektor.

**Stav: skeleton.** Hotový je datový model a generátory pavouka a skupin.
Backend se nasazuje, frontend zatím není.

```
seedly/
├── docs/DATA-MODEL.md            ← začni tady
├── backend/pb_migrations/        ← schéma jako spustitelná PocketBase migrace
└── packages/engine/              ← čistý TS: generátory, typy
```

## Datový model v jedné větě

Turnaj je uspořádaný seznam **fází**; každá fáze má **sloty** (pozice, které
znají svého účastníka až později) a **zápasy** mezi nimi. Detaily a zdůvodnění
v [docs/DATA-MODEL.md](docs/DATA-MODEL.md).

## Spuštění backendu

Schéma cílí na **PocketBase v0.23+** (nové `fields` API). Verzi si zamkni —
mezi minor verzemi se API hooků mění.

```bash
cd backend
# stáhni binárku pro svou platformu z https://github.com/pocketbase/pocketbase/releases
./pocketbase serve
```

Migrace v `pb_migrations/` se aplikuje při startu. Pak si v admin UI na
http://127.0.0.1:8090/_/ ověř, že kolekce sedí — hlavně **API pravidla**,
protože zápis `staff_via_tournament.user ?= @request.auth.id` (back-relace)
jsem nespouštěl proti živé instanci.

## Engine

```bash
bun install
bun test          # 16 testů, ověřují strukturu vygenerovaných pavouků
bun run typecheck
```

Generátory jsou čisté funkce — stejný kód poběží v prohlížeči organizátora
(náhled losu) i v `pb_hooks` (commit losu):

```ts
import { planSingleElimination, planRoundRobin } from "@seedly/engine";

planRoundRobin(entryIds, { poolCount: 2, advancePerPool: 2 });
planSingleElimination(entryIds, { thirdPlace: true });

// Prázdný vstup dá stejný tvar pavouka s nerozřešenými sloty —
// přesně to, co projektor potřebuje během skupin.
planSingleElimination([]);
```

### Nasazení enginu do pb_hooks

PocketBase hooky běží v **goja**, ne v Node — žádné npm balíčky, žádná Node API.
Engine je proto bez závislostí a bundluje se do jednoho souboru:

```bash
cd packages/engine && bun run build:hooks   # → backend/pb_hooks/engine.js
```

Bundle je v `.gitignore`; je to build artefakt.

## Co dál

1. **Rozřešení slotů** — po uzavření zápasu doplnit `entry` navazujícím slotům.
   Model to popisuje, kód chybí. Tohle je další věc, co psát.
2. **Výpočet tabulek** včetně vzájemných zápasů → zápis do `standings`.
3. **Custom routa** `GET /api/display/{token}` s hotovým payloadem pro projektor.
4. **Frontend** — React + Vite + TanStack Router/Query, projektor jako route
   `/display/:token` ve stejné aplikaci.
