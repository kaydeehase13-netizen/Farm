// Shared by the bulk-import dedup check (src/lib/actions.ts) and the
// "Possible Duplicate Transactions" section on Category Audit
// (src/app/(app)/money/transactions/category-audit/page.tsx) — both need
// the exact same definition of "same transaction" so an import-time skip
// and an after-the-fact flag agree with each other. "Same name, date, and
// amount" per the user's own wording: type + date + amount + whatever name
// is on it (vendor for an expense, description for income).
export function duplicateKey(opts: { transactionType: string; transactionDate: string; amount: number; name?: string }): string {
  return `${opts.transactionType}|${opts.transactionDate}|${opts.amount.toFixed(2)}|${(opts.name ?? "").trim().toLowerCase()}`;
}
