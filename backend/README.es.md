# backend

[English](README.md) | [Čeština](README.cs.md) | [Español](README.es.md)

PocketBase utilizado como **framework en Go**. `go build` genera el binario del servidor con la lógica de torneo compilada.

> **Soporte para agentes de IA y MCP:** El backend expone un servidor completo de Model Context Protocol en `/api/mcp` (`backend/internal/mcp`), permitiendo a agentes de IA como Claude Code o ChatGPT crear y dirigir torneos mediante lenguaje natural. Más información en **[whistle.day/mcp](https://whistle.day/mcp)**.

```
backend/
├── main.go                     entrada de la app, registro de hooks y rutas
├── migrations/                 esquema de base de datos — fuente de la verdad
├── internal/tournament/
│   ├── generate.go             generadores de cuadros y grupos, guardado de planes
│   ├── standings.go            cálculo de clasificaciones, desempates, slots pool_rank
│   ├── resolve.go              resolución de ganadores, propagación de slots, hooks
│   ├── realtime.go             notificación a pantallas en cambios de datos
│   ├── display.go              carga completa para el proyector
│   └── routes.go               endpoints de generación, resolución y pantalla
└── internal/apidocs/
    ├── openapi.json            referencia de la API pública
    ├── docs.html               página renderizada en /api/docs
    └── apidocs.go              sirve ambos formatos leyendo el esquema activo
```

El directorio `pb_data/` y el binario `pocketbase` están ignorados por git.

## Por qué Go y no pb_hooks

Los hooks de PocketBase en JS corren en goja (sin npm ni APIs de Node, ES5). El núcleo del torneo requiere transacciones estrictas y tests fiables, por lo que pertenece a código Go compilado.

## La cadena de escritura al finalizar un partido

Todo parte de un único evento: la finalización de un partido (`fixture settled`):

```
partido concluido
  └─ deriveOutcome        ganador/perdedor a partir del marcador (antes de guardar)
  └─ PropagateFixture     rellenar slots que toman este partido como origen
       └─ refreshDependentFixtures   denormalizar equipos, pasar a "ready"
  └─ ComputeStandings     recalcular todas las tablas de grupo de la fase
  └─ ResolvePoolRanks     rellenar slots a la espera de la clasificación final de grupo
```
