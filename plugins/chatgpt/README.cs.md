# ChatGPT plugin

[English](README.md) | [Čeština](README.cs.md) | [Español](README.es.md)

Tento adresář obsahuje balíček pro adresář pluginů OpenAI: manifest, adresu MCP serveru, dvě dovednosti (skills) a dvě ikony. Neobsahuje žádný spustitelný kód. Vše, co plugin dělá, obsluhuje endpoint `/api/mcp`, tedy stejný server, se kterým komunikují všichni ostatní MCP klienti.

> **Přehled integrace AI agentů:** Whistle.day lze ovládat pomocí AI agentů v různých ekosystémech (Claude Code, ChatGPT, Cursor atd.). Návody na konfiguraci a scénáře použití najdete na **[whistle.day/mcp](https://whistle.day/mcp)**.

| | |
|---|---|
| `plugin.json` | Identita, záznam v adresáři, testovací scénáře pro schválení, poznámky k vydání. |
| `mcp.json` | Jeden server: `https://whistle.day/api/mcp`. |
| `skills/plan-a-tournament` | Postup sestavení a dovednost pro onboarding. Stejné pořadí jako v MCP promptu `plan_a_tournament`. |
| `skills/enter-results` | Vyhledání zápasu, zadání skóre, čtení tabulky. |
| `assets/` | Vygenerováno z `apps/web/public/icon.svg`. |

```bash
bun run plugin:chatgpt
```

Vygeneruje ikony, zkontroluje manifest vůči limitům OpenAI a vytvoří archiv `dist/whistle-day-<version>.zip`.
