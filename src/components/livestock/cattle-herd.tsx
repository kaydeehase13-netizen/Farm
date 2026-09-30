"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { yearFromTag, damFromTag, type Cow } from "@/lib/cattle";
import { saveCowAction, removeCowAction, createCattleSyncKeyAction } from "@/lib/actions";

type YearFilter = "all" | "older" | number;

function tagSort(a: string, b: string) {
  const na = Number(a.replace(/\D.*$/, "")), nb = Number(b.replace(/\D.*$/, ""));
  if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb && a.match(/^\d/) && b.match(/^\d/)) return na - nb;
  return a.localeCompare(b, undefined, { numeric: true });
}

/**
 * The herd list: filter by birth year (read from the tag), current vs gone,
 * and search; add or edit cows; and set up the Google Sheet sync.
 */
export function CattleHerd({ cattle, needsMigration, sync, syncUrl }: {
  cattle: Cow[];
  needsMigration: boolean;
  sync: { configured: boolean; lastSyncAt?: string };
  syncUrl: string;
}) {
  const [status, setStatus] = useState<"current" | "gone">("current");
  const [year, setYear] = useState<YearFilter>("all");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<string | null>(null);

  const byTag = useMemo(() => new Map(cattle.map((c) => [c.tag, c])), [cattle]);
  const calfYears = useMemo(() => {
    const ys = new Set<string>();
    cattle.forEach((c) => Object.keys(c.calves).forEach((y) => ys.add(y)));
    return [...ys].sort().reverse();
  }, [cattle]);
  const birthYears = useMemo(() => {
    const ys = new Set<number>();
    cattle.forEach((c) => { const y = yearFromTag(c.tag); if (y) ys.add(y); });
    return [...ys].sort((a, b) => b - a);
  }, [cattle]);
  const calvesOf = useMemo(() => {
    const m = new Map<string, Cow[]>();
    cattle.forEach((c) => { const d = damFromTag(c.tag); if (d) m.set(d, [...(m.get(d) ?? []), c]); });
    return m;
  }, [cattle]);

  const inStatus = cattle.filter((c) => c.status === status);
  const count = (f: YearFilter) => inStatus.filter((c) => {
    const y = yearFromTag(c.tag);
    return f === "all" ? true : f === "older" ? y == null : y === f;
  }).length;
  const shown = inStatus
    .filter((c) => {
      const y = yearFromTag(c.tag);
      if (year === "older" ? y != null : year !== "all" && y !== year) return false;
      if (!q.trim()) return true;
      const hay = `${c.tag} ${c.name ?? ""} ${c.notes ?? ""} ${Object.values(c.calves).join(" ")} ${c.goneReason ?? ""}`.toLowerCase();
      return hay.includes(q.trim().toLowerCase());
    })
    .sort((a, b) => tagSort(a.tag, b.tag));

  const chip = (active: boolean) => `px-3 py-1.5 rounded-full text-sm border ${active ? "bg-forest text-white border-forest" : "border-[--border-color] hover:border-forest"}`;

  return (
    <div className="space-y-6">
      {needsMigration && (
        <div className="text-sm bg-status-amber/10 border border-status-amber/30 rounded-lg p-3">
          One database step is needed first: in Supabase, open <b>SQL Editor</b> and run <code>supabase/migrations/0030_cattle.sql</code>.
        </div>
      )}

      <div className="card p-5 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={chip(status === "current")} onClick={() => setStatus("current")}>Current ({cattle.filter((c) => c.status === "current").length})</button>
          <button type="button" className={chip(status === "gone")} onClick={() => setStatus("gone")}>Gone ({cattle.filter((c) => c.status === "gone").length})</button>
          <span className="mx-2 h-5 w-px bg-charcoal/15" />
          <button type="button" className={chip(year === "all")} onClick={() => setYear("all")}>All years ({count("all")})</button>
          {birthYears.map((y) => (
            <button key={y} type="button" className={chip(year === y)} onClick={() => setYear(y)}>{y} ({count(y)})</button>
          ))}
          <button type="button" className={chip(year === "older")} onClick={() => setYear("older")}>Before 2024 / other ({count("older")})</button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input className="input w-72!" placeholder="Search tag, name, notes, calf…" value={q} onChange={(e) => setQ(e.target.value)} />
          <button type="button" onClick={() => setEditing("new")} className="bg-forest text-white px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap">+ Add cow</button>
          <span className="text-xs text-charcoal/50">Year comes from the tag: 4/24 = 2024, 5/25 = 2025, 6/26 = 2026. The rest of the tag is the mother (5346 → 346).</span>
        </div>

        {editing === "new" && <CowEditor calfYears={calfYears} onDone={() => setEditing(null)} />}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-charcoal/50 border-b border-charcoal/10">
                <th className="py-1.5 pr-3">Tag</th>
                <th className="py-1.5 pr-3">Name</th>
                <th className="py-1.5 pr-3">Born</th>
                <th className="py-1.5 pr-3">Mother</th>
                <th className="py-1.5 pr-3">Notes</th>
                {status === "current"
                  ? calfYears.map((y) => <th key={y} className="py-1.5 pr-3 whitespace-nowrap">{y} Calf</th>)
                  : <><th className="py-1.5 pr-3">Reason</th><th className="py-1.5 pr-3">Year gone</th></>}
                <th />
              </tr>
            </thead>
            <tbody>
              {shown.map((c) => {
                const dam = damFromTag(c.tag);
                const damCow = dam ? byTag.get(dam) : undefined;
                const kids = calvesOf.get(c.tag) ?? [];
                return editing === c.id ? (
                  <tr key={c.id}><td colSpan={8 + calfYears.length}><CowEditor cow={c} calfYears={calfYears} onDone={() => setEditing(null)} /></td></tr>
                ) : (
                  <tr key={c.id} className="border-b border-charcoal/10 align-top">
                    <td className="py-1.5 pr-3 font-medium whitespace-nowrap">{c.tag}</td>
                    <td className="py-1.5 pr-3">
                      {c.name ?? ""}
                      {kids.length > 0 && <div className="text-[11px] text-charcoal/45">calves: {kids.map((k) => k.tag).join(", ")}</div>}
                    </td>
                    <td className="py-1.5 pr-3 whitespace-nowrap">{yearFromTag(c.tag) ?? <span className="text-charcoal/35">—</span>}</td>
                    <td className="py-1.5 pr-3 whitespace-nowrap">
                      {dam ? <>{dam}{damCow?.name ? <span className="text-charcoal/50"> {damCow.name}</span> : ""}</> : <span className="text-charcoal/35">—</span>}
                    </td>
                    <td className="py-1.5 pr-3">{c.notes ?? ""}</td>
                    {status === "current"
                      ? calfYears.map((y) => <td key={y} className="py-1.5 pr-3 whitespace-nowrap">{c.calves[y] ?? ""}</td>)
                      : <><td className="py-1.5 pr-3">{c.goneReason ?? ""}</td><td className="py-1.5 pr-3">{c.goneYear ?? ""}</td></>}
                    <td className="py-1.5 text-right"><button type="button" onClick={() => setEditing(c.id)} className="text-xs text-forest hover:underline">Edit</button></td>
                  </tr>
                );
              })}
              {shown.length === 0 && (
                <tr><td colSpan={8 + calfYears.length} className="py-4 text-sm text-charcoal/50">No cows match.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <SheetSyncCard sync={sync} syncUrl={syncUrl} />
    </div>
  );
}

function CowEditor({ cow, calfYears, onDone }: { cow?: Cow; calfYears: string[]; onDone: () => void }) {
  const router = useRouter();
  const thisYear = String(new Date().getFullYear());
  const years = [...new Set([thisYear, ...calfYears])].sort().reverse();
  const [tag, setTag] = useState(cow?.tag ?? "");
  const [name, setName] = useState(cow?.name ?? "");
  const [notes, setNotes] = useState(cow?.notes ?? "");
  const [calves, setCalves] = useState<Record<string, string>>({ ...(cow?.calves ?? {}) });
  const [gone, setGone] = useState(cow?.status === "gone");
  const [goneReason, setGoneReason] = useState(cow?.goneReason ?? "");
  const [goneYear, setGoneYear] = useState(cow?.goneYear ? String(cow.goneYear) : thisYear);
  const [err, setErr] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    setErr(null);
    startTransition(async () => {
      try {
        const cleaned = Object.fromEntries(Object.entries(calves).map(([y, v]) => [y, v.trim()]).filter(([, v]) => v));
        await saveCowAction({
          id: cow?.id, tag, name: name.trim() || undefined, notes: notes.trim() || undefined, calves: cleaned,
          status: gone ? "gone" : "current",
          goneReason: gone ? goneReason.trim() || undefined : undefined,
          goneYear: gone && goneYear ? Number(goneYear) : undefined,
        });
        router.refresh();
        onDone();
      } catch (e) { setErr(e instanceof Error ? e.message : "Couldn't save."); }
    });
  }
  function remove() {
    if (!cow || !window.confirm(`Delete ${cow.tag}${cow.name ? ` (${cow.name})` : ""}? Use "Gone" instead for sold or dead animals.`)) return;
    startTransition(async () => {
      try { await removeCowAction(cow.id); router.refresh(); onDone(); }
      catch (e) { setErr(e instanceof Error ? e.message : "Couldn't delete."); }
    });
  }

  return (
    <div className="bg-cream-deep/40 rounded-lg p-3 my-2 space-y-3">
      <div className="grid sm:grid-cols-4 gap-2">
        <label className="text-xs text-charcoal/60">Tag number
          <input className="input block" value={tag} onChange={(e) => setTag(e.target.value)} placeholder="e.g. 6355-1" />
        </label>
        <label className="text-xs text-charcoal/60">Name
          <input className="input block" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="text-xs text-charcoal/60 sm:col-span-2">Notes
          <input className="input block" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
      </div>
      <div className="grid sm:grid-cols-4 gap-2">
        {years.map((y) => (
          <label key={y} className="text-xs text-charcoal/60">{y} calf
            <input className="input block" value={calves[y] ?? ""} onChange={(e) => setCalves((c) => ({ ...c, [y]: e.target.value }))} placeholder="M; 3/16; BMF" />
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex items-center gap-2 text-sm cursor-pointer mr-2">
          <input type="checkbox" checked={gone} onChange={(e) => setGone(e.target.checked)} /> Gone (sold / dead)
        </label>
        {gone && (
          <>
            <label className="text-xs text-charcoal/60">Reason
              <input className="input block w-56!" value={goneReason} onChange={(e) => setGoneReason(e.target.value)} placeholder="Dead, Sold…" />
            </label>
            <label className="text-xs text-charcoal/60">Year
              <input className="input block w-24!" value={goneYear} onChange={(e) => setGoneYear(e.target.value)} />
            </label>
          </>
        )}
      </div>
      {err && <p className="text-xs text-status-red">{err}</p>}
      <div className="flex items-center gap-3">
        <button type="button" disabled={isPending} onClick={save} className="bg-forest text-white px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50">{isPending ? "Saving…" : "Save"}</button>
        <button type="button" disabled={isPending} onClick={onDone} className="text-xs text-charcoal/60 hover:underline">Cancel</button>
        {cow && <button type="button" disabled={isPending} onClick={remove} className="text-xs text-status-red hover:underline ml-auto">Delete</button>}
      </div>
    </div>
  );
}

function SheetSyncCard({ sync, syncUrl }: { sync: { configured: boolean; lastSyncAt?: string }; syncUrl: string }) {
  const [script, setScript] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  function makeKey() {
    if (sync.configured && !window.confirm("Make a new sync key? The old one stops working — you'll paste the new script into the sheet.")) return;
    setErr(null);
    startTransition(async () => {
      try {
        const key = await createCattleSyncKeyAction();
        const { buildCattleAppsScript } = await import("@/lib/cattle-apps-script");
        setScript(buildCattleAppsScript(syncUrl, key));
      } catch (e) { setErr(e instanceof Error ? e.message : "Couldn't make a key."); }
    });
  }

  return (
    <div className="card p-5 space-y-3">
      <div>
        <div className="text-sm font-semibold text-forest">Google Sheet sync</div>
        <p className="text-xs text-charcoal/55">
          Keeps this list and your cow Google Sheet in step both ways. The sheet talks to FarmLedger through its own key, which can
          only read and change the cattle list — people you share the sheet with never get into the rest of FarmLedger.
        </p>
        <p className="text-xs text-charcoal/70 mt-1">
          {sync.configured
            ? sync.lastSyncAt ? `Connected · last sync ${new Date(sync.lastSyncAt).toLocaleString()}` : "Key made · waiting for the sheet's first sync"
            : "Not connected yet."}
        </p>
      </div>
      <button type="button" disabled={isPending} onClick={makeKey} className="border border-forest text-forest px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
        {isPending ? "Making key…" : sync.configured ? "Make a new key & script" : "Connect a Google Sheet"}
      </button>
      {err && <p className="text-xs text-status-red">{err}</p>}
      {script && (
        <div className="space-y-2">
          <ol className="text-sm list-decimal list-inside space-y-1 text-charcoal/80">
            <li>In the cow sheet, open <b>Extensions → Apps Script</b>.</li>
            <li>Delete what&apos;s in the editor, paste the script below, and click <b>Save</b>.</li>
            <li>Reload the sheet. A <b>FarmLedger</b> menu appears — click <b>Sync now</b> and allow access when Google asks.</li>
            <li>Then <b>FarmLedger → Turn on automatic sync</b> to sync every 10 minutes.</li>
          </ol>
          <p className="text-xs text-status-amber">This key is shown only once. Anyone who can edit the sheet can see it in Apps Script, and it lets them change the cattle list only.</p>
          <button type="button" onClick={() => { navigator.clipboard?.writeText(script).then(() => setCopied(true)).catch(() => {}); }} className="bg-forest text-white px-3 py-1.5 rounded-lg text-sm font-medium">
            {copied ? "Copied" : "Copy script"}
          </button>
          <textarea readOnly className="input font-mono text-[11px] h-64" value={script} onFocus={(e) => e.currentTarget.select()} />
        </div>
      )}
    </div>
  );
}
