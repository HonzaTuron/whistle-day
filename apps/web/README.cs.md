# Webová aplikace

[English](README.md) | [Čeština](README.cs.md) | [Español](README.es.md)

Dvě veřejné obrazovky a dvě, ze kterých turnaj řídí organizátor.

> **Ovládání AI agentem:** Zatímco tyto webové obrazovky slouží lidským uživatelům, turnaje lze vytvářet, konfigurovat i kompletně řídit autonomně pomocí AI agentů (Claude, ChatGPT atd.) přes MCP. Podrobnosti a návody najdete na **[whistle.day/mcp](https://whistle.day/mcp)**.

| Trasa | Účel |
|---|---|
| `/new` | Nastavení turnaje organizátorem na mobilu v hale. |
| `/t/:id` | Řízení turnaje organizátorem na mobilu v hale. |
| `/display/:token` | Bezobslužný projektor na zeď (1080p), čitelný z třiceti kroků: pavouk, tabulky, obsazení kurtů. |
| `/m/:token` | Hráči a diváci sledující stejné informace na svém telefonu. |
| `/join/:token` | Zvací kód pro obsluhu kurtu a zapisovatele. |
| `/account` | Připojení e-mailu k zařízení. |
| `/claim/:token` | Převzetí turnaje vytvořeného agentem. |

## Vývoj

```bash
bun run web         # dev server na :5173
bun run typecheck   # kontrola typů
bun run web:test    # testy
```
