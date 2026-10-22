# Whistle.day

[English](README.md) | [Čeština](README.cs.md) | [Español](README.es.md)

Organizador de torneos con combinación arbitraria de fases — grupos, eliminatoria directa (cuadro), sistema suizo, en cualquier secuencia — y vista pública en vivo para proyector. En funcionamiento en **[whistle.day](https://whistle.day)**.

> **Listo para agentes de IA:** Whistle.day se puede controlar completamente mediante agentes de IA (Claude Code, ChatGPT, Cursor o cualquier cliente MCP) a través del Model Context Protocol. Puedes crear torneos, asignar pistas, registrar marcadores y consultar clasificaciones mediante lenguaje natural. Consulta la guía de integración en **[whistle.day/mcp](https://whistle.day/mcp)**.

**Estado: todo el torneo se gestiona desde un teléfono móvil — o desde tantos teléfonos como pistas haya.** Indica el nombre, selecciona el deporte, añade los equipos, elige el formato y obtén un enlace y un código QR. A partir de ahí, dirige la jornada: envía partidos a las pistas, marca los que están en juego y anota los resultados según se produzcan. Las tablas se recalculan solas, el cuadro final alimentado por los grupos se completa automáticamente, la siguiente ronda del sistema suizo se sortea por sí misma y la pantalla del proyector se actualiza en tiempo real. Entrega un código QR a los árbitros o anotadores y gestionarán su pista desde su propio teléfono.

```
whistleday/
├── docs/DATA-MODEL.md       ← comience aquí
├── backend/                  PocketBase como framework Go
│   ├── migrations/           esquema de base de datos
│   └── internal/tournament/  generación de cuadros, clasificaciones, resolución de slots
├── packages/engine/          tipos compartidos en TypeScript (sin lógica)
└── scripts/smoke.ts          test de integración end-to-end contra servidor real
```

## El modelo de datos en una frase

Un torneo es una lista ordenada de **fases** (stages); cada fase tiene **posiciones** (slots — huecos que conocen a su participante más adelante) y **partidos** (fixtures) entre ellos. Razonamiento y diseño arquitectónico en [docs/DATA-MODEL.md](docs/DATA-MODEL.md).

## Requisitos

| | |
|---|---|
| Go | 1.27+ — requisito de PocketBase |
| Bun | 1.4.0 — fijado en `.bun-version` y `packageManager` |
| PocketBase | v0.40.3, como dependencia de Go — no un binario descargado |

PocketBase se utiliza como **framework en Go**. `go build` genera el binario del servidor con la lógica de torneo compilada. Los hooks JS de PocketBase corren en goja (sin npm ni API de Node), y esta lógica necesita transacciones reales y tests rigurosos.

El requisito de Go 1.27 proviene de PocketBase v0.40 (`encoding/json/v2`). `backend/go.mod` indica `go 1.27` y con `GOTOOLCHAIN=auto` se descarga automáticamente en la primera compilación.

## Primeros pasos

```bash
bun install
bun run pb:build      # compila backend/pocketbase
bun run pb:migrate    # aplica las migraciones
bun run pb:superuser  # crea admin: admin@whistleday.local / whistledayadmin1
```

A continuación, en tres terminales:

```bash
bun run pb:serve   # backend y panel de control en :8090
bun run seed       # torneo de demostración: 8 equipos, grupos y semifinal en directo
bun run web        # pantallas web en :5173
```

- Crear un torneo — <http://localhost:5173/new>
- Pantalla para proyector — <http://localhost:5173/display/hala-1>
- Vista móvil para jugadores — <http://localhost:5173/m/hala-1>

Ejecutar de nuevo `bun run seed` reemplaza la demo en lugar de crear otra.

## Pantallas

| Ruta | Destinado a |
|---|---|
| `/new` | Organizador: nombre, deporte, equipos, pistas, formato y enlace para la pantalla. |
| `/t/:id` | Gestión del torneo: pistas, horarios, partidos en vivo, marcadores y configuración de pantalla. |
| `/join/:token` | Enlace para el personal de pista: indicar nombre, confirmar con un toque y arbitrar. |
| `/account` | Asociar un correo electrónico a la cuenta del dispositivo o iniciar sesión en otro equipo. |
| `/display/:token` | Proyector: vista desatendida, rotación automática, visible a distancia en la sala o pista. |
| `/m/:token` | Teléfono: pestañas y navegación optimizada para que cada jugador encuentre su pista y horario. |

Son rutas independientes porque apenas comparten componentes visuales, solo datos — consulte [apps/web/README.md](apps/web/README.md).

## Pruebas y verificaciones

```bash
bun run check   # typecheck + go vet/test + smoke
```

| Comando | Cobertura |
|---|---|
| `bun run typecheck` | TypeScript 7 |
| `bun run web:test` | 37 tests: cola offline, reglas de marcadores según deporte y detección de pantallas |
| `bun run pb:test` | `go vet` + 161 tests unitarios: generadores, emparejamientos suizos, desempates, incorporaciones tardías |
| `bun run smoke` | 215 aserciones contra una base de datos temporal de PocketBase |

La prueba de humo (*smoke test*) es fundamental: arranca el servidor, genera grupos y eliminatoria enlazada, simula todos los partidos por API REST y verifica que clasificaciones, cuadros y pantalla pública coinciden exactamente. Además juega torneos completos de doble eliminación y suizo para garantizar que los cuadros nunca se bloqueen.

```bash
bun run stats                 # backend/pb_data/data.db
bun run stats -- /path/to/data.db
```

Informe estadístico en modo solo lectura de la base de datos (torneos disputados, deportes, pistas, cuentas creadas, correcciones de resultados).

## Flujo de un torneo (API)

```bash
# 1. grupos
POST /api/stages/{groups}/generate?dry_run=1   # previsualizar sorteo
POST /api/stages/{groups}/generate             # confirmar y guardar

# 2. eliminatoria / cuadro final alimentado desde grupos
#    stages.config = { "seedFrom": { "stage": "<groups>", "advancePerPool": 2 } }
#    "bestOfNext": 4 para clasificar también a los cuatro mejores terceros
POST /api/stages/{playoff}/generate

# 3. registrar resultado. Concluir un partido desencadena automáticamente
#    el avance a la siguiente ronda o el sorteo suizo.
PATCH /api/collections/fixtures/records/{id}
      { "status": "finished", "home_score": 2, "away_score": 0 }

# 4. proyectar en pantalla pública
GET /api/display/{token}
```

Cerrar un partido activa toda la cadena: deduce el ganador según el tanteo, lo propaga a las posiciones dependientes, recalcula clasificaciones de grupo y, en cuanto un grupo finaliza, rellena las plazas de eliminatoria pendientes.

### Endpoints destacados más allá de la API de colecciones

| | |
|---|---|
| `POST /api/stages/{stage}/generate` | Genera grupos, posiciones y emparejamientos. `?dry_run=1` devuelve el plan sin escribir. |
| `POST /api/stages/{stage}/resolve` | Recalcula una fase ante correcciones de marcadores. Idempotente. |
| `POST /api/stages/{stage}/pair` | Empareja la siguiente ronda suiza (reparación manual si hiciera falta). |
| `POST /api/entries/{entry}/withdraw` | Retirada de un equipo (`forfeit` o `void`). |
| `POST /api/entries/{entry}/reinstate` | Reincorporación de un equipo retirado. |
| `POST /api/entries/{entry}/admit` | Incorporación de un equipo que llegó tarde tras el sorteo inicial. |
| `GET /api/staff/invite/{token}` | Información de invitación para colaboradores y árbitros. |
| `POST /api/staff/join` | Aceptación de rol de colaborador en este dispositivo. |
| `POST /api/preview` | Generación de vista previa de formato y cuadrícula sin guardar en base de datos. |
| `GET /api/display/{token}` | Carga completa para el proyector en una sola petición (soporta `If-None-Match`). |
| `GET /api/realtime` | Flujo Server-Sent Events para actualización instantánea de pantallas. |
| `GET /api/docs` | Documentación interactiva de la API pública. |
| `GET /api/openapi.json` | Especificación OpenAPI 3.1. |

## Un agente de IA también puede gestionar el torneo

Whistle.day se puede controlar íntegramente mediante un agente de IA a través del Model Context Protocol (MCP). Para instrucciones sobre Claude Code, Claude Desktop y ChatGPT, visita **[whistle.day/mcp](https://whistle.day/mcp)**.

`/api/mcp` es un servidor MCP sobre Streamable HTTP — un único endpoint: `POST` para peticiones, `GET` para el flujo de eventos, `DELETE` para cerrar la sesión. Ofrece 21 herramientas y dos prompts guiados: `plan_a_tournament` y `enter_the_results`.

La herramienta `create_tournament` solicita qué deporte se disputa para aplicar las reglas correctas (tres puntos por victoria con empate en fútbol; sets y desempates en pádel, tenis o voleibol). Las plantillas residen en `backend/internal/tournament/sports.json`.

Un agente opera como un organizador sin cuenta registrada. `create_tournament` no requiere credenciales previas; crea una cuenta de dispositivo temporal y asocia las herramientas a su sesión (`Mcp-Session-Id`).

El torneo puede transferirse a un organizador humano mediante `create_handoff`, que genera un enlace hacia `/claim/{token}` donde el usuario introduce su correo y contraseña.

Asimismo, cuenta con compatibilidad completa con OAuth 2.1 (`backend/internal/oauth`) para que usuarios con cuenta existente puedan autenticar agentes en su nombre.

## Comportamientos clave del sistema

- **Español, inglés y checo sin librerías externas pesadas.** Catálogos tipados en `apps/web/src/locales/`. Los parámetros `?lang=es`, `?lang=en` o `?lang=cs` anulan la preferencia del navegador para proyectores.
- **Los textos viajan como hechos, no oraciones terminadas.** Un slot almacena "Winner QF1" con tipo y argumentos; la pantalla traduce y formatea localmente.
- **El deporte define las reglas de puntuación.** Asigna victorias, empates y desempates automáticamente.
- **Los empates no permitidos se rechazan.** No se puede guardar empate en eliminatorias ni en deportes que exigen un ganador.
- **Resultados en cola offline.** Si se pierde la conexión Wi-Fi en las pistas, los resultados se guardan en el teléfono y se envían en cola persistente.
- **Modo offline no calcula clasificaciones provisionales.** El servidor realiza los cálculos de forma autoritativa cuando se sincroniza.
- **Las correcciones recalculan todo desde el origen.** Modificar un resultado rehace las tablas de cero, evitando arrastre de errores.
- **Los descansos (*byes*) se resuelven automáticamente.**
- **Las rondas suizas se emparejan solas** al concluir la ronda anterior.
- **El bye en sistema suizo otorga puntos de victoria; en cuadro eliminatorio es solo un pase de ronda.**
- **La eliminatoria espera a que el grupo esté completamente terminado.**
- **El desempate directo (*head-to-head*) se calcula únicamente entre los equipos empatados.**
- **Rotación en pantalla con agradecimiento a patrocinadores.**
- **Incorporación de equipos que llegan tarde** sin reiniciar el torneo desde cero.
- **Validación estricta del tanteo final** (se rechazan resultados imposibles o incompletos según el formato de sets).
- **Retiradas diferenciadas:** `forfeit` (partidos restantes como derrota por incomparecencia) y `void` (anulación completa de todos los partidos).
- **Las rondas ya sorteadas y en pista no se alteran al retirarse un jugador.**
- **Los árbitros y anotadores acceden escaneando un código QR en el pabellón.**
- **Todo slot tiene representación gráfica** para que el proyector nunca muestre recuadros vacíos.
- **Conflictos de horario en pistas se señalan como advertencias, sin bloquear al organizador.**
- **Límites de peticiones (rate limiting) adaptados a salas donde cientos de móviles comparten una misma IP pública.**
- **Limpieza automática de borradores inactivos tras 30 días.**
- **Sin analíticas ni cookies invasivas en las pantallas del torneo.**

## Licencia

[AGPL-3.0-or-later](LICENSE).