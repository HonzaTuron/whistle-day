# Nasazení Whistle.day

[English](README.md) | [Čeština](README.cs.md) | [Español](README.es.md)

Tři procesy na jednom serveru. To není provizorní začátek, ze kterého je nutné vyrůst — takto přirozeně funguje SQLite. API má jediného zapisovatele na lokálním disku.

| | | |
|---|---|---|
| `caddy` | `:80`, `:443` | TLS, statické soubory a směrování |
| `whistleday-api` | `127.0.0.1:8090` | PocketBase: API, realtime stream, MCP server |
| `whistleday-web` | `127.0.0.1:3000` | vykreslování obrazovek aplikace |

> **Koncový bod pro AI agenty:** Produkční nasazení zpřístupňuje endpoint Model Context Protocol na `https://whistle.day/api/mcp`. AI agenti mohou turnaje spravovat přímo; podrobnosti a návody najdete na **[whistle.day/mcp](https://whistle.day/mcp)**.

Statické marketingové stránky se renderují v čase sestavení a servírují z disku přes Caddy.

Obě služby jsou samostatné jednolité binárky: Go build má `CGO_ENABLED=0` a webový server používá `bun build --compile`. Na serveru tedy není žádný Bun, Node ani adresář `node_modules`.

## Nasazení na produkci

```bash
bun run deploy
```
