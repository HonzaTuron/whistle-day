import type { MessageKey } from "./i18n";
import { SPORTS, sportById, type SportId } from "./scoring";

/**
 * What a sport calls the place a match happens.
 *
 * "Court" is right for volleyball, basketball, tennis, padel, badminton and
 * handball, and wrong for football, which plays on a pitch, and for table
 * tennis, which plays on a table. Three words, not one — a fourth sport that
 * needs a fourth word is a fourth entry here, not a synonym for "court".
 *
 * Every string this drives is written out in full per unit rather than built
 * from a shared template with the noun swapped in: Czech declines "kurt",
 * "hřiště" and "stůl" differently by case and gender in almost every one of
 * these sentences ("dva kurty" but "dvě hřiště" — the numeral itself changes
 * with the noun's gender), so a template that swaps only the noun produces
 * grammatical Czech for one unit and broken Czech for the other two. See the
 * note in `locales/cs.ts` on why a phrase keeps its own preposition rather
 * than having one glued on by the caller — this is the same rule.
 */
export type CourtsUnit = "courts" | "pitches" | "tables";

export interface CourtsKeys {
  /** "How many courts?" */
  title: MessageKey;
  /** "Court {number}" — a new one's default name. */
  defaultName: MessageKey;
  /** The stepper's two buttons. */
  fewer: MessageKey;
  more: MessageKey;
  /** Validation on the courts step. */
  duplicate: MessageKey;
  blank: MessageKey;
  /** PluralMessage: "on {count} courts", carrying its own preposition. */
  on: MessageKey;
  /** The label on the match sheet's own chip group. */
  label: MessageKey;
  onNow: MessageKey;
  takeOff: MessageKey;
  onSaved: MessageKey;
  noneYet: MessageKey;
  savesOnTap: MessageKey;
  /** " on {court}", appended to a clash warning. */
  clash: MessageKey;
  /** The projector's own settings. */
  every: MessageKey;
  scopeNote: MessageKey;
  schedule: MessageKey;
  scheduleHint: MessageKey;
}

const KEYS: Record<CourtsUnit, CourtsKeys> = {
  courts: {
    title: "wizard.courtsTitle",
    defaultName: "wizard.courtsDefaultName",
    fewer: "wizard.courtsFewer",
    more: "wizard.courtsMore",
    duplicate: "wizard.courtsDuplicate",
    blank: "wizard.courtsBlank",
    on: "count.courtsOn",
    label: "match.court",
    onNow: "match.onCourtNow",
    takeOff: "match.takeOff",
    onSaved: "match.onCourtSaved",
    noneYet: "match.noCourtYet",
    savesOnTap: "match.savesOnTap",
    clash: "match.clashCourt",
    every: "screen.everyCourt",
    scopeNote: "screen.scopeNote",
    schedule: "panel.court_schedule",
    scheduleHint: "panel.court_schedule.hint",
  },
  pitches: {
    title: "wizard.courtsTitle.pitches",
    defaultName: "wizard.courtsDefaultName.pitches",
    fewer: "wizard.courtsFewer.pitches",
    more: "wizard.courtsMore.pitches",
    duplicate: "wizard.courtsDuplicate.pitches",
    blank: "wizard.courtsBlank.pitches",
    on: "count.courtsOn.pitches",
    label: "match.court.pitches",
    onNow: "match.onCourtNow.pitches",
    takeOff: "match.takeOff.pitches",
    onSaved: "match.onCourtSaved.pitches",
    noneYet: "match.noCourtYet.pitches",
    savesOnTap: "match.savesOnTap.pitches",
    clash: "match.clashCourt.pitches",
    every: "screen.everyCourt.pitches",
    scopeNote: "screen.scopeNote.pitches",
    schedule: "panel.court_schedule.pitches",
    scheduleHint: "panel.court_schedule.hint.pitches",
  },
  tables: {
    title: "wizard.courtsTitle.tables",
    defaultName: "wizard.courtsDefaultName.tables",
    fewer: "wizard.courtsFewer.tables",
    more: "wizard.courtsMore.tables",
    duplicate: "wizard.courtsDuplicate.tables",
    blank: "wizard.courtsBlank.tables",
    on: "count.courtsOn.tables",
    label: "match.court.tables",
    onNow: "match.onCourtNow.tables",
    takeOff: "match.takeOff.tables",
    onSaved: "match.onCourtSaved.tables",
    noneYet: "match.noCourtYet.tables",
    savesOnTap: "match.savesOnTap.tables",
    clash: "match.clashCourt.tables",
    every: "screen.everyCourt.tables",
    scopeNote: "screen.scopeNote.tables",
    schedule: "panel.court_schedule.tables",
    scheduleHint: "panel.court_schedule.hint.tables",
  },
};

/** The unit a sport chip uses, straight off the preset. */
export const courtsUnitFor = (sport: SportId): CourtsUnit => sportById(sport).courtsUnit;

/**
 * The unit for a tournament already on record, keyed by the string saved in
 * `tournaments.sport` rather than by chip id — the screens that need this
 * (the match sheet, the projector settings) only ever see the record, not the
 * wizard's own state. A custom sport that was never one of the presets falls
 * back to "courts", same as an empty or unrecognised one always has.
 */
export const courtsUnitForSportName = (sportName: string): CourtsUnit =>
  SPORTS.find((candidate) => candidate.sport === sportName)?.courtsUnit ?? "courts";

/** Every message key a screen needs for the unit it is showing. */
export const courtsKeys = (unit: CourtsUnit): CourtsKeys => KEYS[unit];
