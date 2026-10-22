"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveBillingHoursAction } from "@/lib/actions";

/** Hours worked for a grower on an hourly job (harvest), saved when you leave the box. */
export function BillingHoursInput({ year, grower, activityType, hours, loggedHours, entered }: {
  year: number; grower: string; activityType: string; hours: number; loggedHours: number; entered: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(entered ? String(hours) : "");
  const [err, setErr] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    const typed = value.trim();
    const n = typed === "" ? loggedHours : Number(typed);
    if (!Number.isFinite(n) || n < 0) { setErr("Enter hours"); return; }
    if (entered && n === hours) return;
    if (!entered && typed === "") return;
    setErr(null);
    startTransition(async () => {
      try { await saveBillingHoursAction({ year, grower, activityType, hours: n }); router.refresh(); }
      catch (e) { setErr(e instanceof Error ? e.message : "Couldn't save."); }
    });
  }

  return (
    <span className="inline-flex flex-col items-end">
      <span className="inline-flex items-center gap-1">
        <input
          className="input w-16! py-0.5! text-xs text-right"
          type="number" step="0.25" min="0" inputMode="decimal"
          value={value}
          placeholder={loggedHours ? String(Math.round(loggedHours * 100) / 100) : "0"}
          onChange={(e) => setValue(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          disabled={isPending}
          aria-label={`${grower} hours`}
        />
        <span>hr</span>
      </span>
      {err && <span className="text-[11px] text-status-red">{err}</span>}
    </span>
  );
}
