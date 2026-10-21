/**
 * Deeper duplicate check for every kind of transaction (farm, W-2,
 * royalties, house project, medical, personal...), every year.
 *
 * Exact: same type, date, amount and name (the import-time rule).
 * Close: same type and amount within a few days of each other, even when
 * the names don't match (a bank line "KANZA COOP" vs the receipt's
 * "Kanza Cooperative", or a check entered on the day written and again on
 * the day it cleared).
 *
 * Left out on purpose: copies already marked as a duplicate (excluded),
 * lines of the same split receipt, and the per-field lines of one cost
 * split across fields (same description, different fields), since those
 * are meant to look alike.
 */
import type { Transaction } from "@/types/domain";
import { duplicateKey } from "@/lib/duplicate-key";

export interface DuplicateGroupResult {
  key: string;
  kind: "exact" | "close";
  note: string;
  transactions: Transaction[];
}

function dayNumber(iso: string): number {
  return Math.floor(Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) / 86400000);
}

function fieldSet(t: Transaction): Set<string> {
  return new Set(t.splits.map((s) => s.fieldId).filter(Boolean) as string[]);
}

/** Two transactions that are meant to look alike, so never flagged against each other. */
function intentionalTwins(a: Transaction, b: Transaction): boolean {
  if (a.splitGroupId && a.splitGroupId === b.splitGroupId) return true;
  const fa = fieldSet(a), fb = fieldSet(b);
  if ((a.description ?? "") === (b.description ?? "") && fa.size > 0 && fb.size > 0 && ![...fa].some((f) => fb.has(f))) return true;
  return false;
}

export function findDuplicateGroups(all: Transaction[], opts: { days: number }): DuplicateGroupResult[] {
  const pool = all.filter((t) => !t.isDuplicateExcluded && t.amount > 0);
  const byAmount = new Map<string, Transaction[]>();
  for (const t of pool) {
    const k = `${t.transactionType}|${t.amount.toFixed(2)}`;
    byAmount.set(k, [...(byAmount.get(k) ?? []), t]);
  }

  const out: DuplicateGroupResult[] = [];
  for (const list of byAmount.values()) {
    if (list.length < 2) continue;
    list.sort((a, b) => a.transactionDate.localeCompare(b.transactionDate));
    // Union-find over pairs that are close enough in date.
    const parent = list.map((_, i) => i);
    const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        if (dayNumber(list[j].transactionDate) - dayNumber(list[i].transactionDate) > opts.days) break;
        if (intentionalTwins(list[i], list[j])) continue;
        parent[find(j)] = find(i);
      }
    }
    const clusters = new Map<number, Transaction[]>();
    list.forEach((t, i) => clusters.set(find(i), [...(clusters.get(find(i)) ?? []), t]));
    for (const group of clusters.values()) {
      if (group.length < 2) continue;
      const keys = new Set(group.map((t) => duplicateKey({ transactionType: t.transactionType, transactionDate: t.transactionDate, amount: t.amount, name: t.vendorName ?? t.description })));
      const exact = keys.size === 1;
      const span = dayNumber(group[group.length - 1].transactionDate) - dayNumber(group[0].transactionDate);
      const names = new Set(group.map((t) => (t.vendorName ?? t.description ?? "").trim().toLowerCase()));
      const note = exact
        ? "Exact match: same name, date and amount."
        : `Same amount${span === 0 ? " on the same day" : `, ${span} day${span === 1 ? "" : "s"} apart`}${names.size > 1 ? ", different names" : ""}.`;
      out.push({ key: group.map((t) => t.id).sort().join("|"), kind: exact ? "exact" : "close", note, transactions: group });
    }
  }
  return out.sort((a, b) =>
    (a.kind === b.kind ? 0 : a.kind === "exact" ? -1 : 1) ||
    a.transactions[0].transactionDate.localeCompare(b.transactions[0].transactionDate));
}
