# Despliegue de Whistle.day

[English](README.md) | [Čeština](README.cs.md) | [Español](README.es.md)

Tres procesos en un único servidor. No es una solución temporal de la que haya que migrar — es la arquitectura natural de SQLite. La API escribe en disco local a través de un único proceso.

| | | |
|---|---|---|
| `caddy` | `:80`, `:443` | TLS, archivos estáticos y enrutamiento |
| `whistleday-api` | `127.0.0.1:8090` | PocketBase: API, flujo en tiempo real y servidor MCP |
| `whistleday-web` | `127.0.0.1:3000` | renderizado de pantallas de la aplicación |

> **Endpoint para agentes de IA:** El despliegue de producción expone el Model Context Protocol en `https://whistle.day/api/mcp`. Los agentes de IA pueden gestionar torneos directamente; consulte la documentación en **[whistle.day/mcp](https://whistle.day/mcp)**.

Las páginas de marketing se pre-renderizan durante la compilación y se sirven directamente desde disco a través de Caddy.

Ambos servicios son binarios autocontenidos sin dependencias externas en el servidor: Go con `CGO_ENABLED=0` y el servidor web compilado con `bun build --compile`. No hay instalación de Node ni `node_modules` en la máquina remota.

## Despliegue a producción

```bash
bun run deploy
```
