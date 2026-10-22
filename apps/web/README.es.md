# La aplicación web

[English](README.md) | [Čeština](README.cs.md) | [Español](README.es.md)

Dos pantallas públicas y dos desde las que el organizador dirige el torneo.

> **Control mediante agentes de IA:** Mientras que estas pantallas web proporcionan la interfaz humana, los torneos también pueden crearse, configurarse y gestionarse de forma autónoma mediante agentes de IA (Claude, ChatGPT, etc.) a través de MCP. Consulta los detalles y guías en **[whistle.day/mcp](https://whistle.day/mcp)**.

| Ruta | Destinado a |
|---|---|
| `/new` | Configuración del torneo por el organizador desde un móvil en las pistas. |
| `/t/:id` | Gestión en vivo del torneo por el organizador desde el móvil. |
| `/display/:token` | Pantalla de proyector desatendida (1080p), legible a distancia: cuadros, tablas y pistas activas. |
| `/m/:token` | Jugadores y público consultando los mismos datos en sus teléfonos. |
| `/join/:token` | Acceso para árbitros y personal de pista mediante código QR. |
| `/account` | Asociar un correo electrónico a la cuenta del dispositivo. |
| `/claim/:token` | Reclamar la propiedad de un torneo creado por un agente. |

## Desarrollo

```bash
bun run web         # servidor de desarrollo en :5173
bun run typecheck   # comprobación de tipos
bun run web:test    # tests
```
