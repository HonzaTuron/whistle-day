# The ChatGPT plugin

This directory is the package OpenAI's plugin directory takes: a manifest, the
address of the MCP server, two skills and two icons. There is no code in it.
Everything the plugin does is `/api/mcp`, the same server every other MCP
client talks to.

| | |
|---|---|
| `plugin.json` | Identity, the directory listing, the review test cases, release notes. Agent Plugins format, with OpenAI's fields under `extensions.com.openai`. |
| `mcp.json` | One server: `https://whistle.day/api/mcp`. |
| `skills/plan-a-tournament` | The build sequence, and the onboarding skill. The same order the `plan_a_tournament` MCP prompt writes out. |
| `skills/enter-results` | Finding a fixture, scoring it, reading a table. |
| `assets/` | Rendered from `apps/web/public/icon.svg` by the build. |

```
bun run plugin:chatgpt
```

renders the icons, checks the manifest against the submission limits (30
characters for the name and subtitle, five positive and three negative review
cases, and so on) and writes `dist/whistle-day-<version>.zip`. That file is
what gets uploaded at <https://platform.openai.com/plugins>.

## What the server does for it

Three things in `backend/internal/mcp`, all of which every client gets:

- Each tool states `readOnlyHint`, `destructiveHint` and `openWorldHint`.
  The review compares them with what the tool does; `TestToolHints` is the
  table.
- Each tool lists `securitySchemes` — `noauth` and `oauth2` — in `_meta`, and
  a call with no credential answers with an `mcp/www_authenticate` challenge.
  ChatGPT needs both before it will offer to sign in.
- No tool takes or returns a credential. The account `create_tournament`
  makes for a caller who has not signed in is remembered against the
  connection's `Mcp-Session-Id` (`mcp_sessions`), not handed to the model.

These have to be deployed before the dashboard scans the server.

## Submitting

Things only the account holder can do, in the order the dashboard asks:

1. **Verify the publisher.** Individual or business verification in the
   OpenAI organisation settings. `developerName` and `author.name` in
   `plugin.json` say "Whistle.day"; if the verified identity is something
   else, change them to match. The project must have global data residency —
   EU-residency projects cannot submit a plugin with an MCP server.
2. **Deploy** the backend, then upload the ZIP.
3. **Verify the domain.** The dashboard shows a token. Save it, and nothing
   else, as `apps/web/public/.well-known/openai-apps-challenge` and deploy;
   Caddy serves it as plain text.
4. **Connect the server** with OAuth. ChatGPT registers itself through
   `/oauth/register`; there is no client to create by hand.
5. **A test account** with an email and a password, no email verification
   step in the way, entered in Review details. It should own nothing to begin
   with: the five positive cases in `plugin.json` build "Review Cup" in order
   and each one depends on the one before. Run them once in ChatGPT developer
   mode first, then delete the tournament so the reviewer starts clean.
6. **A screen recording** of those cases, hosted somewhere the reviewer can
   open. Add its address as `review.demo_recording_url` in `plugin.json`, or
   in the dashboard.
7. **Check `category`.** It is "Productivity" here; the dashboard has the list
   it must be chosen from.

After publication, tool changes on the server are picked up by a daily scan
and need no new ZIP. Changes to this directory do: bump `version`, rebuild,
upload.
