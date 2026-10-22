# El plugin de ChatGPT

[English](README.md) | [Čeština](README.cs.md) | [Español](README.es.md)

Este directorio conforma el paquete requerido por el directorio de plugins de OpenAI: manifiesto, dirección del servidor MCP, dos habilidades (skills) y dos iconos. No contiene código ejecutable. Toda la funcionalidad reside en `/api/mcp`, el mismo servidor con el que interactúa cualquier otro cliente MCP.

> **Integración con agentes de IA:** Whistle.day puede ser gestionado por agentes de IA en diversos entornos (Claude Code, ChatGPT, Cursor, etc.). Guías de configuración y casos de uso en **[whistle.day/mcp](https://whistle.day/mcp)**.

| | |
|---|---|
| `plugin.json` | Identidad, descripción, casos de prueba de revisión y notas de versión. |
| `mcp.json` | Servidor único: `https://whistle.day/api/mcp`. |
| `skills/plan-a-tournament` | Secuencia de creación del torneo y onboarding. |
| `skills/enter-results` | Búsqueda de partidos, registro de marcadores y lectura de tablas. |
| `assets/` | Generado a partir de `apps/web/public/icon.svg`. |

```bash
bun run plugin:chatgpt
```

Genera los iconos, valida el manifiesto según los límites de OpenAI y compila `dist/whistle-day-<version>.zip`.
