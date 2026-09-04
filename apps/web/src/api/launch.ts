import type { Id } from "@whistleday/engine";
import { tr, translate, type Locale } from "../lib/i18n";
import { presetById, type PresetId } from "../lib/presets";
import { forgetDraft, randomString, rememberTournament, type Session } from "./organiser";

/**
 * Turning a draft into a tournament that is on the wall.
 *
 * This is the one irreversible-feeling moment in the wizard, and it is four
 * requests deep: create each stage, generate its draw, open a screen, publish.
 * Two things follow from that.
 *
 * It reports every step, because a phone on hall wifi can spend a few seconds
 * here and a frozen button is indistinguishable from a broken one.
 *
 * And it can be run twice. A request that dies half way through leaves stages
 * behind; creating a second set on the retry would leave the tournament with
 * two group stages and no way for the organiser to tell. So stages and screens
 * are matched by position and reused. The generator is already replace-safe —
 * it refuses only once a fixture has been played.
 */

export interface LaunchResult {
  token: string;
  projectorUrl: string;
  phoneUrl: string;
}

export type LaunchStep = "stages" | "draw" | "screen" | "publish";

interface StageRecord {
  id: Id;
  position: number;
  name: string;
}

async function api<T>(path: string, session: Session, body?: unknown, method = "POST"): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: {
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      Authorization: session.token,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) {
    let message = text;
    try {
      message = (JSON.parse(text) as { message?: string }).message ?? text;
    } catch {
      /* keep the raw body */
    }
    throw new Error(message || tr("error.request", { status: response.status }));
  }
  return (text ? JSON.parse(text) : null) as T;
}

const list = <T>(path: string, session: Session) =>
  api<{ items: T[] }>(path, session, undefined, "GET").then((page) => page.items);

export async function launchTournament(
  session: Session,
  tournament: Id,
  name: string,
  presetId: PresetId,
  teams: number,
  onStep: (step: LaunchStep) => void,
  /**
   * The language the organiser set this up in. It decides nothing about what
   * the tournament looks like later — every generated name travels as a kind
   * and is worded by whoever draws it — and only picks the English-or-not text
   * stored alongside, which is what a raw database read or an older client
   * sees.
   */
  locale: Locale = "en",
): Promise<LaunchResult> {
  const preset = presetById(presetId);
  const specs = preset.stages(teams);

  onStep("stages");
  const existing = await list<StageRecord>(
    `/api/collections/stages/records?filter=(tournament='${tournament}')&sort=position&perPage=50`,
    session,
  );

  const created: Id[] = [];
  for (const [position, spec] of specs.entries()) {
    // A playoff is seeded from the stage before it, which only has an id now.
    const config = spec.seedFromPrevious
      ? {
          ...spec.config,
          seedFrom: { stage: created[position - 1], advancePerPool: spec.advancePerPool ?? 2 },
        }
      : spec.config;

    const body = {
      tournament,
      position,
      name: spec.name,
      name_kind: spec.nameKind,
      format: spec.format,
      status: "draft",
      config,
    };

    const previous = existing.find((stage) => stage.position === position);
    const stage = previous
      ? await api<StageRecord>(
          `/api/collections/stages/records/${previous.id}`, session, body, "PATCH")
      : await api<StageRecord>("/api/collections/stages/records", session, body);

    created.push(stage.id);
  }

  // A stage left over from a shorter preset on an earlier attempt would still
  // be generated and still show up on the projector.
  for (const stale of existing.filter((stage) => stage.position >= specs.length)) {
    await api<null>(`/api/collections/stages/records/${stale.id}`, session, undefined, "DELETE");
  }

  onStep("draw");
  for (const stage of created) {
    await api<unknown>(`/api/stages/${stage}/generate`, session);
  }

  onStep("screen");
  const screens = await list<{ id: Id; token: string }>(
    `/api/collections/displays/records?filter=(tournament='${tournament}')&perPage=10`,
    session,
  );

  // The token is the screen's only credential, so it is random rather than
  // derived from the name — a guessable token is a public tournament nobody
  // asked to publish.
  const token = screens[0]?.token ?? randomString(8);
  if (!screens[0]) {
    await api<unknown>("/api/collections/displays/records", session, {
      tournament,
      name: translate(locale, "display.mainScreen"),
      token,
      mode: "auto",
      rotate_seconds: 12,
      active: true,
    });
  }

  onStep("publish");
  await api<unknown>(
    `/api/collections/tournaments/records/${tournament}`,
    session,
    { status: "live" },
    "PATCH",
  );

  // The draft is finished; what the device keeps now is the tournament it is
  // running, which is how both the landing page and the results screen find
  // their way back to it.
  forgetDraft();
  rememberTournament({ id: tournament, name, token });

  const origin = window.location.origin;
  return {
    token,
    projectorUrl: `${origin}/display/${token}`,
    phoneUrl: `${origin}/m/${token}`,
  };
}
