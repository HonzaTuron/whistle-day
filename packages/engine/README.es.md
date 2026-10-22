# @whistleday/engine

[English](README.md) | [Čeština](README.cs.md) | [Español](README.es.md)

Tipos de dominio compartidos para el frontend y herramientas cliente. **Solo tipos** — no contiene lógica de negocio.

> **Integración con agentes de IA y MCP:** Estos modelos y tipos reflejan las estructuras devueltas por el backend y consumidas por agentes de IA que operan vía Model Context Protocol. Más información en **[whistle.day/mcp](https://whistle.day/mcp)**.

La generación de cuadros, clasificaciones y resolución de posiciones reside en Go (`backend/internal/tournament/`). Anteriormente estaban duplicadas en TypeScript para previsualizar sorteos en el navegador; para evitar divergencias entre implementaciones, la vista previa se delega ahora en el servidor:

```
POST /api/stages/{stage}/generate?dry_run=1
```

Mismo generador, mismo resultado, sin duplicidad. El cuerpo de la respuesta es un `StagePlan` — consulte `types.ts`.

## Mantenimiento de tipos

`types.ts` refleja las colecciones de PocketBase definidas en `backend/migrations/`. Al modificar un campo allí, debe actualizarse correspondientemente aquí.
