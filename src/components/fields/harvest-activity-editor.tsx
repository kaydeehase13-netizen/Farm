"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateActivityYieldAction, recordFieldSaleAction } from "@/lib/actions";

export function HarvestActivityEditor({
  activityId, fieldId, cropName, currentYield, currentYieldUnit, currentMoisture, currentAcres, farmCategories,
}: {
  activityId: string;
  fieldId: string;
  cropName?: string;
  currentYield?: number;
  currentYieldUnit?: string;
  currentMoisture?: number;
  currentAcres?: number;
  farmCategories: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [yieldAmount, setYieldAmount] = useState(currentYield != null ? String(currentYield) : "");
  const [yieldUnit, setYieldUnit] = useState(currentYieldUnit ?? "bu/ac");
  const [moisturePct, setMoisturePct] = useState(currentMoisture != null ? String(currentMoisture) : "");
  const [acres, setAcres] = useState(currentAcres != null ? String(currentAcres) : "");

  const [saleAmount, setSaleAmount] = useState("");
  const [quantitySold, setQuantitySold] = useState("");
  const [quantityUnit, setQuantityUnit] = useState("bu");
  const [farmCategoryId, setFarmCategoryId] = useState("");
  const [saleDate, setSaleDate] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [saleResult, setSaleResult] = useState<string | null>(null);

  function saveYield() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        await updateActivityYieldAction(activityId, {
          yieldAmount: yieldAmount === "" ? null : Number(yieldAmount),
          yieldUnit: yieldUnit || null,
          moisturePct: moisturePct === "" ? null : Number(moisturePct),
          acres: acres === "" ? null : Number(acres),
        });
        setSaved(true);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't save that.");
      }
    });
  }

  function recordSale(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaleResult(null);
    if (!farmCategoryId) { setError("Choose an income category for this sale."); return; }
    startTransition(async () => {
      try {
        await recordFieldSaleAction({
          fieldId,
          amount: Number(saleAmount),
          quantitySold: quantitySold === "" ? null : Number(quantitySold),
          quantityUnit: quantityUnit || null,
          cropName,
          farmCategoryId,
          transactionDate: saleDate || new Date().toISOString().slice(0, 10),
          vendorName: vendorName || undefined,
        });
        setSaleResult(`Logged $${Number(saleAmount).toLocaleString()} in income for this field.`);
        setSaleAmount("");
        setQuantitySold("");
        setVendorName("");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't record that sale.");
      }
    });
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs font-medium text-forest hover:underline">
        Edit yield / record sale →
      </button>
    );
  }

  return (
    <div className="mt-2 border border-[--border-color] rounded-lg p-3 space-y-3 bg-cream-deep/30">
      <div>
        <div className="text-xs font-semibold text-forest mb-2">Edit Yield</div>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <div className="text-[11px] text-charcoal/50 mb-0.5">Yield</div>
            <input type="number" step="0.01" className="input text-sm" value={yieldAmount} onChange={(e) => setYieldAmount(e.target.value)} />
          </label>
          <label className="block">
            <div className="text-[11px] text-charcoal/50 mb-0.5">Unit</div>
            <input className="input text-sm" value={yieldUnit} onChange={(e) => setYieldUnit(e.target.value)} placeholder="bu/ac" />
          </label>
          <label className="block">
            <div className="text-[11px] text-charcoal/50 mb-0.5">Moisture %</div>
            <input type="number" step="0.01" className="input text-sm" value={moisturePct} onChange={(e) => setMoisturePct(e.target.value)} />
          </label>
          <label className="block">
            <div className="text-[11px] text-charcoal/50 mb-0.5">Acres</div>
            <input type="number" step="0.01" className="input text-sm" value={acres} onChange={(e) => setAcres(e.target.value)} />
          </label>
        </div>
        <button type="button" onClick={saveYield} disabled={isPending} className="mt-2 text-xs font-medium bg-forest text-white px-3 py-1.5 rounded-lg hover:bg-forest-light disabled:opacity-40">
          {isPending ? "Saving…" : "Save Yield"}
        </button>
        {saved && <span className="ml-2 text-xs text-forest">Saved.</span>}
      </div>

      <form onSubmit={recordSale} className="pt-3 border-t border-[--border-color] space-y-2">
        <div className="text-xs font-semibold text-forest mb-1">Record What It Sold For</div>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <div className="text-[11px] text-charcoal/50 mb-0.5">Amount Sold For ($)</div>
            <input type="number" step="0.01" min="0" className="input text-sm" value={saleAmount} onChange={(e) => setSaleAmount(e.target.value)} required />
          </label>
          <label className="block">
            <div className="text-[11px] text-charcoal/50 mb-0.5">Date</div>
            <input type="date" className="input text-sm" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} />
          </label>
          <label className="block">
            <div className="text-[11px] text-charcoal/50 mb-0.5">Quantity Sold</div>
            <input type="number" step="0.01" className="input text-sm" value={quantitySold} onChange={(e) => setQuantitySold(e.target.value)} />
          </label>
          <label className="block">
            <div className="text-[11px] text-charcoal/50 mb-0.5">Unit</div>
            <input className="input text-sm" value={quantityUnit} onChange={(e) => setQuantityUnit(e.target.value)} placeholder="bu" />
          </label>
          <label className="block col-span-2">
            <div className="text-[11px] text-charcoal/50 mb-0.5">Income Category</div>
            <select className="input text-sm" value={farmCategoryId} onChange={(e) => setFarmCategoryId(e.target.value)} required>
              <option value="" disabled>Choose…</option>
              {farmCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="block col-span-2">
            <div className="text-[11px] text-charcoal/50 mb-0.5">Buyer / Elevator (optional)</div>
            <input className="input text-sm" value={vendorName} onChange={(e) => setVendorName(e.target.value)} />
          </label>
        </div>
        <button type="submit" disabled={isPending} className="text-xs font-medium bg-wheat text-forest px-3 py-1.5 rounded-lg hover:opacity-90 disabled:opacity-40">
          {isPending ? "Saving…" : "Record Sale"}
        </button>
        {saleResult && <p className="text-xs text-forest">{saleResult}</p>}
      </form>

      {error && <p className="text-xs text-status-red">{error}</p>}
      <button type="button" onClick={() => setOpen(false)} className="text-xs text-charcoal/45 hover:underline">Close</button>
    </div>
  );
}
