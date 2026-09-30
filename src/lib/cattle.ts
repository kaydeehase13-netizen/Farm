/**
 * Ear-tag rules for the herd.
 *
 * The first digit of a tag is the year the calf was born: 4 -> 2024,
 * 5 -> 2025, 6 -> 2026 (and later years the same way). A tag may also start
 * with the two-digit year instead ("24..", "25.."). The rest of the tag is
 * the mother's number: 5346 is the 2025 calf of cow 346, and a 3-digit tag
 * like 540 is the 2025 calf of cow 140 (the 1xx cows drop their leading 1).
 * "-1"/"-2" mark twins; other suffixes (e.g. "-B") mean the mother can't be
 * read from the tag. Tags starting with 1 or 3, and words like "Bull", have
 * no year.
 */

export function yearFromTag(tag: string | undefined | null): number | null {
  const t = (tag ?? "").trim();
  const two = t.match(/^2([4-9])\d{2,}/);
  if (two) return 2020 + Number(two[1]);
  const one = t.match(/^([4-9])\d{2,}/);
  if (one) return 2020 + Number(one[1]);
  return null;
}

export function damFromTag(tag: string | undefined | null): string | null {
  const t = (tag ?? "").trim();
  const m = t.match(/^(?:2[4-9]|[4-9])(\d{2,3})(?:-(\d+))?$/);
  if (!m) return null;
  // "24.." with only two digits after would be ambiguous with a 4xxx tag; the
  // one-digit form is what the herd uses, so prefer it when both could apply.
  const rest = t.match(/^[4-9](\d{2,3})(?:-\d+)?$/)?.[1] ?? m[1];
  return rest.length === 2 ? `1${rest}` : rest;
}

export interface Cow {
  id: string;
  tag: string;
  name?: string;
  notes?: string;
  /** Calf record per year, as written in the sheet: { "2026": "M; 3/16; BMF" }. */
  calves: Record<string, string>;
  status: "current" | "gone" | "removed";
  goneReason?: string;
  goneYear?: number;
  updatedAt?: string;
}

/** What a sync may change on one cow (only the fields present are applied). */
export interface CowChange {
  tag: string;
  deleted?: boolean;
  fields?: {
    name?: string;
    notes?: string;
    calves?: Record<string, string>;
    status?: "current" | "gone";
    goneReason?: string;
    goneYear?: number | null;
  };
}

/** Applies a sync change to a cow (or a new one), field by field. */
export function applyCowChange(existing: Omit<Cow, "id"> | undefined, change: CowChange): Omit<Cow, "id"> {
  const base: Omit<Cow, "id"> = existing
    ? { ...existing, calves: { ...existing.calves } }
    : { tag: change.tag.trim(), calves: {}, status: "current" };
  if (change.deleted) return { ...base, status: "removed" };
  const f = change.fields ?? {};
  if (f.name !== undefined) base.name = f.name.trim() || undefined;
  if (f.notes !== undefined) base.notes = f.notes.trim() || undefined;
  if (f.calves) {
    for (const [year, text] of Object.entries(f.calves)) {
      const v = (text ?? "").trim();
      if (v) base.calves[year] = v; else delete base.calves[year];
    }
  }
  if (f.status !== undefined) base.status = f.status;
  if (f.goneReason !== undefined) base.goneReason = f.goneReason.trim() || undefined;
  if (f.goneYear !== undefined) base.goneYear = f.goneYear ?? undefined;
  return base;
}
