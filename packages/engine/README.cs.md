# @whistleday/engine

[English](README.md) | [Čeština](README.cs.md) | [Español](README.es.md)

Sdílené doménové typy pro frontend a klientské nástroje. **Pouze typy** — nenachází se zde žádná byznys logika.

> **Podpora pro AI agenty a MCP:** Tyto modely a typové definice odpovídají strukturám vráceným backendem a používaným AI agenty komunikujícími přes Model Context Protocol. Podrobnosti o schopnostech agentů najdete na **[whistle.day/mcp](https://whistle.day/mcp)**.

Generování pavouků, výpočet tabulek i dosazování pozic (slots) běží v Go (`backend/internal/tournament/`). Dříve byly duplikovány v TypeScriptu pro okamžitý náhled rozlosování v prohlížeči, což vedlo k riziku rozdílů v implementaci. Nyní náhled probíhá přímo přes server:

```
POST /api/stages/{stage}/generate?dry_run=1
```

Stejný generátor, identický výsledek, jediná implementace. Tělo odpovědi je `StagePlan` — viz `types.ts`.

## Synchronizace typů

Soubor `types.ts` zrcadlí kolekce PocketBase definované v `backend/migrations/`. Pokud změníte pole v databázovém schématu, je nutné ho upravit i zde.
