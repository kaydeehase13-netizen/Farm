"use client";

import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { summarizePrices, unitPrice, type ProductPrice } from "@/lib/product-prices";
import type { AllocationPrice } from "@/lib/allocation-prices";
import { addProductPriceAction, deleteProductPriceAction, deleteAllProductPricesAction, importProductPricesAction, setProductPriceUnitAction } from "@/lib/actions";

/** Per-unit prices under $10 show 4 decimals ($0.3600/lb), bigger ones 2. */
function perUnit(n: number) {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: n < 10 ? 4 : 2, maximumFractionDigits: n < 10 ? 4 : 2 })}`;
}
function money(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}
function qty(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/**
 * Prices Paid: every purchase of a chemical (or fertilizer / seed) and,
 * per product, the average, lowest and highest price paid per unit, for
 * billing breakdowns. Purchases are added one at a time or uploaded from
 * Excel; this is a price record only and never creates an expense.
 */
export function PriceBook({ prices, fromAllocations = [], allocYear }: {
  prices: ProductPrice[];
  fromAllocations?: AllocationPrice[];
  allocYear?: number;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Chemical");
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const categories = Array.from(new Set(prices.map((p) => p.category).filter(Boolean) as string[])).sort();
  const stats = summarizePrices(prices).filter((s) =>
    (category === "All" || (s.category ?? "") === category) &&
    (!search || s.productName.toLowerCase().includes(search.toLowerCase())));

  function upload(formData: FormData) {
    setMsg(null); setErr(null);
    startTransition(async () => {
      const res = await importProductPricesAction(formData);
      if (res.error) { setErr(res.error); return; }
      setMsg(`Added ${res.added} purchase${res.added === 1 ? "" : "s"}` +
        (res.duplicates ? `, ${res.duplicates} already on file` : "") +
        (res.skipped.length ? `, skipped ${res.skipped.length} without a quantity or unit` : "") + ".");
      router.refresh();
    });
  }

  function clearAll() {
    if (!window.confirm(`Remove all ${prices.length} purchases from Prices Paid? Expenses and field allocations aren't touched.`)) return;
    setMsg(null); setErr(null);
    startTransition(async () => {
      await deleteAllProductPricesAction();
      setMsg("Cleared. Upload your purchases file again.");
      router.refresh();
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      await deleteProductPriceAction(id);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="card p-5 space-y-3">
        <div>
          <div className="text-sm font-semibold text-forest">Prices paid</div>
          <p className="text-xs text-charcoal/55">
            What you&apos;ve paid per gallon, pound or unit for each product. <b>Average</b> is total paid ÷ total bought, so a big
            purchase counts more than a small one. Use it for billing breakdowns. Adding prices here never creates an expense.
          </p>
        </div>
        <form action={upload} className="flex flex-wrap items-center gap-2">
          <input type="file" name="file" accept=".xlsx,.xls" required className="input w-72! text-sm" disabled={isPending} />
          <button type="submit" disabled={isPending} className="bg-forest text-white px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
            {isPending ? "Working…" : "Upload purchases"}
          </button>
          <button type="button" onClick={() => setAdding((a) => !a)} className="card px-3 py-2 text-sm font-medium hover:border-forest">
            {adding ? "Close" : "+ Add a purchase"}
          </button>
          {prices.length > 0 && (
            <button type="button" onClick={clearAll} disabled={isPending} className="text-xs text-status-red hover:underline ml-auto">
              Clear all purchases
            </button>
          )}
        </form>
        <p className="text-[11px] text-charcoal/50">
          Excel columns: Product Name, Quantity, Unit, Total Amount (or Price per Unit), and optionally Category, Vendor, Date, Invoice.
          Your Allocate Product Cost workbook uploads as-is. Re-uploading the same file doesn&apos;t add anything twice.
        </p>
        {msg && <div className="text-sm text-forest">{msg}</div>}
        {err && <div className="text-sm text-status-red">{err}</div>}
        {adding && <AddPurchase categories={categories} onDone={() => { setAdding(false); router.refresh(); }} />}
      </div>

      <div className="card p-5">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <input className="input w-48! text-sm" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="input w-40! text-sm" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="All">All products</option>
            {Array.from(new Set(["Chemical", ...categories])).map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <span className="text-xs text-charcoal/50">Tap a product to see each purchase.</span>
        </div>
        {/* Phones: one card per product. */}
        <div className="md:hidden divide-y divide-charcoal/10">
          {stats.map((s) => (
            <div key={s.key} className="py-2.5" onClick={() => setOpen(open === s.key ? null : s.key)}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium">{s.productName}</span>
                <span className="font-semibold text-forest whitespace-nowrap">{perUnit(s.weightedAverage)}/{s.unit}</span>
              </div>
              <div className="text-xs text-charcoal/60 mt-0.5">
                Low {perUnit(s.lowest)} · High {perUnit(s.highest)} · {s.purchases.length} purchase{s.purchases.length === 1 ? "" : "s"}
              </div>
              {s.last && (
                <div className="text-xs text-charcoal/50">
                  Last {perUnit(unitPrice(s.last))}{s.last.purchaseDate ? ` on ${s.last.purchaseDate}` : ""}{s.last.vendor ? ` · ${s.last.vendor}` : ""}
                </div>
              )}
              {open === s.key && (
                <div className="mt-2 space-y-1">
                  {s.purchases.map((p) => (
                    <div key={p.id} className="text-xs bg-sage/10 rounded px-2 py-1.5 flex justify-between gap-2">
                      <span>
                        {p.purchaseDate ?? "No date"}{p.vendor ? ` · ${p.vendor}` : ""}<br />
                        {qty(p.quantity)} {s.unit} for {money(p.totalAmount)} = <b>{perUnit(unitPrice(p))}</b>
                      </span>
                      <button type="button" disabled={isPending} onClick={(e) => { e.stopPropagation(); remove(p.id); }} className="text-status-red self-center">Remove</button>
                    </div>
                  ))}
                  <UnitChanger productName={s.productName} unit={s.unit} />
                </div>
              )}
            </div>
          ))}
          {stats.length === 0 && (
            <div className="py-3 text-xs text-charcoal/50">
              {prices.length === 0 ? "No purchases yet. Upload a file or add one above." : "Nothing matches that search."}
            </div>
          )}
        </div>
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-charcoal/50 text-right">
                <th className="text-left py-1 pr-2 font-normal">Product</th>
                <th className="py-1 px-2 font-semibold text-forest">Average</th>
                <th className="py-1 px-2 font-normal">Lowest</th>
                <th className="py-1 px-2 font-normal">Highest</th>
                <th className="py-1 px-2 font-normal">Last paid</th>
                <th className="py-1 px-2 font-normal">Bought</th>
                <th className="py-1 pl-2 font-normal">Total</th>
              </tr>
            </thead>
            <tbody className="text-right">
              {stats.map((s) => (
                <Fragment key={s.key}>
                  <tr className="border-t border-charcoal/10 cursor-pointer hover:bg-sage/10" onClick={() => setOpen(open === s.key ? null : s.key)}>
                    <td className="text-left py-1.5 pr-2">
                      <span className="font-medium">{s.productName}</span>
                      <span className="text-xs text-charcoal/45"> · per {s.unit} · {s.purchases.length} purchase{s.purchases.length === 1 ? "" : "s"}</span>
                    </td>
                    <td className="py-1.5 px-2 font-semibold text-forest whitespace-nowrap">{perUnit(s.weightedAverage)}/{s.unit}</td>
                    <td className="py-1.5 px-2 whitespace-nowrap">{perUnit(s.lowest)}</td>
                    <td className="py-1.5 px-2 whitespace-nowrap">{perUnit(s.highest)}</td>
                    <td className="py-1.5 px-2 whitespace-nowrap">
                      {s.last ? perUnit(unitPrice(s.last)) : "—"}
                      {s.last?.purchaseDate && <div className="text-[11px] text-charcoal/45">{s.last.purchaseDate}{s.last.vendor ? ` · ${s.last.vendor}` : ""}</div>}
                    </td>
                    <td className="py-1.5 px-2 whitespace-nowrap">{qty(s.totalQuantity)} {s.unit}</td>
                    <td className="py-1.5 pl-2 whitespace-nowrap">{money(s.totalAmount)}</td>
                  </tr>
                  {open === s.key && (
                    <tr>
                      <td colSpan={7} className="bg-sage/10 px-3 py-2">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-charcoal/50 text-right">
                              <th className="text-left font-normal py-0.5">Date</th>
                              <th className="text-left font-normal py-0.5">Vendor</th>
                              <th className="font-normal py-0.5">Bought</th>
                              <th className="font-normal py-0.5">Paid</th>
                              <th className="font-normal py-0.5">Per {s.unit}</th>
                              <th className="text-left font-normal py-0.5 pl-3">Invoice</th>
                              <th />
                            </tr>
                          </thead>
                          <tbody className="text-right">
                            {s.purchases.map((p) => (
                              <tr key={p.id} className="border-t border-charcoal/10">
                                <td className="text-left py-1">{p.purchaseDate ?? "—"}</td>
                                <td className="text-left py-1">{p.vendor ?? "—"}</td>
                                <td className="py-1">{qty(p.quantity)} {s.unit}</td>
                                <td className="py-1">{money(p.totalAmount)}</td>
                                <td className="py-1 font-medium">{perUnit(unitPrice(p))}</td>
                                <td className="text-left py-1 pl-3 text-charcoal/60">{p.invoice ?? ""}</td>
                                <td className="py-1">
                                  <button type="button" disabled={isPending} onClick={(e) => { e.stopPropagation(); remove(p.id); }} className="text-status-red hover:underline">Remove</button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {s.purchases.length > 1 && (
                          <div className="text-[11px] text-charcoal/50 mt-1">
                            Plain average of the purchase prices (every purchase counted the same): {perUnit(s.simpleAverage)}/{s.unit}
                          </div>
                        )}
                        <UnitChanger productName={s.productName} unit={s.unit} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {stats.length === 0 && (
                <tr><td colSpan={7} className="text-left py-3 text-xs text-charcoal/50">
                  {prices.length === 0 ? "No purchases yet. Upload a file or add one above." : "Nothing matches that search."}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card p-5">
        <div className="text-sm font-semibold text-forest">From your field allocations{allocYear ? ` (${allocYear})` : ""}</div>
        <p className="text-xs text-charcoal/55 mb-3">
          Average cost per unit actually used: what each product&apos;s field allocation adds up to ÷ how much of it is logged on
          your spray and fertilizer passes. One average per product (no low/high). The mix calculator uses it for anything with
          no purchases uploaded above.
        </p>
        {fromAllocations.length === 0 ? (
          <p className="text-xs text-charcoal/50">Nothing allocated by usage yet for this year.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-charcoal/50 text-right">
                  <th className="text-left py-1 pr-2 font-normal">Product</th>
                  <th className="py-1 px-2 font-semibold text-forest">Avg per unit used</th>
                  <th className="py-1 px-2 font-normal">Allocated</th>
                  <th className="py-1 pl-2 font-normal">Logged on fields</th>
                </tr>
              </thead>
              <tbody className="text-right">
                {fromAllocations
                  .filter((a) => !search || a.productName.toLowerCase().includes(search.toLowerCase()))
                  .map((a) => (
                    <tr key={a.productName} className="border-t border-charcoal/10">
                      <td className="text-left py-1.5 pr-2">
                        {a.productName}
                        <span className="text-xs text-charcoal/45"> · {a.fields} field{a.fields === 1 ? "" : "s"}</span>
                        {a.mixedUnits && <div className="text-[11px] text-status-amber">Logged in mixed units; only the {a.unit} entries are counted.</div>}
                      </td>
                      <td className="py-1.5 px-2 font-semibold text-forest whitespace-nowrap">{perUnit(a.average)}/{a.unit}</td>
                      <td className="py-1.5 px-2 whitespace-nowrap">{money(a.totalAllocated)}</td>
                      <td className="py-1.5 pl-2 whitespace-nowrap">{qty(a.totalUsed)} {a.unit}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function AddPurchase({ categories, onDone }: { categories: string[]; onDone: () => void }) {
  const [f, setF] = useState({ productName: "", category: "Chemical", purchaseDate: "", vendor: "", quantity: "", unit: "gal", totalAmount: "", invoice: "" });
  const [err, setErr] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((s) => ({ ...s, [k]: e.target.value }));
  const q = Number(f.quantity), t = Number(f.totalAmount);

  function save() {
    setErr(null);
    startTransition(async () => {
      try {
        await addProductPriceAction({ ...f, quantity: q, totalAmount: t });
        onDone();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Couldn't save.");
      }
    });
  }

  return (
    <div className="border border-charcoal/10 rounded-lg p-3 grid gap-2 sm:grid-cols-4 text-sm">
      <label className="sm:col-span-2 text-xs">Product<input className="input mt-0.5" value={f.productName} onChange={set("productName")} placeholder="Glypex 5 Extra" /></label>
      <label className="text-xs">Category
        <select className="input mt-0.5" value={f.category} onChange={set("category")}>
          {Array.from(new Set(["Chemical", "Fertilizer", "Seed", ...categories])).map((c) => <option key={c}>{c}</option>)}
        </select>
      </label>
      <label className="text-xs">Date<input className="input mt-0.5" type="date" value={f.purchaseDate} onChange={set("purchaseDate")} /></label>
      <label className="text-xs">Quantity bought<input className="input mt-0.5" type="number" step="any" value={f.quantity} onChange={set("quantity")} /></label>
      <label className="text-xs">Unit
        <select className="input mt-0.5" value={f.unit} onChange={set("unit")}>
          {["gal", "lb", "oz", "qt", "pt", "ton", "bag", "unit"].map((u) => <option key={u}>{u}</option>)}
        </select>
      </label>
      <label className="text-xs">Total paid ($)<input className="input mt-0.5" type="number" step="0.01" value={f.totalAmount} onChange={set("totalAmount")} /></label>
      <label className="text-xs">Vendor<input className="input mt-0.5" value={f.vendor} onChange={set("vendor")} /></label>
      <label className="sm:col-span-2 text-xs">Invoice # (optional)<input className="input mt-0.5" value={f.invoice} onChange={set("invoice")} /></label>
      <div className="sm:col-span-2 flex items-end gap-3">
        <button type="button" disabled={isPending} onClick={save} className="bg-forest text-white px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-50">Save purchase</button>
        {q > 0 && t > 0 && <span className="text-xs text-charcoal/60">= {perUnit(t / q)}/{f.unit}</span>}
        {err && <span className="text-xs text-status-red">{err}</span>}
      </div>
    </div>
  );
}

/**
 * Change what unit a product's purchases are in, keeping the amounts: an
 * invoice that says "unit" for something you log in oz on the fields
 * (Status), so Inventory can line purchases and usage up.
 */
function UnitChanger({ productName, unit }: { productName: string; unit: string }) {
  const router = useRouter();
  const [to, setTo] = useState(unit);
  const [msg, setMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const units = ["gal", "qt", "pt", "oz", "fl oz", "lb", "ton", "bag", "unit"];
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-charcoal/60" onClick={(e) => e.stopPropagation()}>
      Bought in
      <select className="input w-24! py-0.5! text-xs" value={to} onChange={(e) => setTo(e.target.value)}>
        {[...new Set([unit, ...units])].map((u) => <option key={u} value={u}>{u}</option>)}
      </select>
      <button
        type="button"
        disabled={isPending || to === unit}
        onClick={() => startTransition(async () => {
          const n = await setProductPriceUnitAction({ productName, fromUnit: unit, toUnit: to });
          setMsg(`Changed ${n} purchase${n === 1 ? "" : "s"} to ${to}.`);
          router.refresh();
        })}
        className="text-forest font-medium hover:underline disabled:opacity-40"
      >
        Change unit
      </button>
      <span>Same amounts, new label. Use it when the invoice says &quot;unit&quot; but it&apos;s really oz, gal or lb.</span>
      {msg && <span className="text-forest">{msg}</span>}
    </div>
  );
}
