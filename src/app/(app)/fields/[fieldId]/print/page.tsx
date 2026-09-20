import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getField,
  getFarm,
  fieldProfitability,
  fieldProductUsage,
  listActivities,
  listCropYears,
} from "@/lib/data/repo";
import { getViewTaxYear } from "@/lib/tax-year";
import { money, moneyPrecise } from "@/components/ui/stat-card";
import { PrintButton } from "@/components/fields/print-button";

const OWNERSHIP_LABEL: Record<string, string> = {
  owned: "Owned",
  rented_cash: "Cash rent",
  rented_crop_share: "Crop share",
  rented_flex: "Flex lease",
};

function num(n: number | undefined, digits = 2) {
  return n == null ? "—" : n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** Label / value pair in the identification block at the top of the sheet. */
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-charcoal/50 font-semibold">{label}</div>
      <div className="text-sm">{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 break-inside-avoid">
      <h2 className="text-[11px] uppercase tracking-widest font-semibold text-charcoal/55 border-b border-[--border-color] pb-1 mb-2">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-charcoal/50">{children}</p>;
}

/**
 * Printable one-page record for a single field: identification, the season's
 * money, every logged pass, and the product totals behind it.
 *
 * `?year=all` prints the field's whole history instead of the viewing tax
 * year — the same switch the field detail page uses for its activity list.
 */
export default async function FieldPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ fieldId: string }>;
  searchParams: Promise<{ year?: string }>;
}) {
  const { fieldId } = await params;
  const { year } = await searchParams;
  const allYears = year === "all";

  const field = await getField(fieldId);
  if (!field) notFound();

  const farm = await getFarm();
  const taxYear = await getViewTaxYear();
  const [profit, usage, activities, cropYears] = await Promise.all([
    fieldProfitability(fieldId, taxYear),
    fieldProductUsage(fieldId, taxYear),
    listActivities({ fieldId, year: allYears ? undefined : taxYear }),
    listCropYears(fieldId),
  ]);

  const cropThisYear = cropYears.find((cy) => cy.year === taxYear);
  const plantings = activities.filter((a) => a.seedProductName);
  const sprays = activities.filter((a) => (a.sprayProducts?.length ?? 0) > 0);
  const harvests = activities.filter((a) => a.activityType === "harvest");

  const expenseRows = ([
    ["Seed", profit.expenseSeed], ["Fertilizer", profit.expenseFertilizer], ["Chemical", profit.expenseChemical],
    ["Fuel", profit.expenseFuel], ["Rent", profit.expenseRent], ["Insurance", profit.expenseInsurance],
    ["Custom Work", profit.expenseCustomWork], ["Harvest", profit.expenseHarvest], ["Drying", profit.expenseDrying],
    ["Trucking", profit.expenseTrucking], ["Other", profit.expenseOther],
  ] as [string, number][]).filter(([, v]) => v > 0);

  const printed = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="print-sheet max-w-[850px] mx-auto">
      <div className="no-print flex items-center justify-between gap-3 mb-5">
        <Link prefetch={false} href={`/fields/${fieldId}`} className="text-sm font-medium text-forest hover:underline">
          ← Back to {field.name}
        </Link>
        <div className="flex items-center gap-3">
          <Link
            prefetch={false}
            href={allYears ? `/fields/${fieldId}/print` : `/fields/${fieldId}/print?year=all`}
            className="text-xs font-medium text-forest hover:underline whitespace-nowrap"
          >
            {allYears ? `Print ${taxYear} only` : "Include all years"}
          </Link>
          <PrintButton label="Print field sheet" />
        </div>
      </div>

      <header className="border-b-2 border-forest pb-3">
        <div className="flex items-baseline justify-between gap-4 flex-wrap">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-charcoal/55 font-semibold">
              {farm.name} · Field Record {allYears ? "· All Years" : `· ${taxYear}`}
            </div>
            <h1 className="text-2xl font-semibold text-forest mt-0.5">{field.name}</h1>
          </div>
          <div className="text-right text-sm">
            <div className="font-semibold">{num(field.acres, 2)} acres</div>
            {cropThisYear?.cropName && <div className="text-charcoal/60">{cropThisYear.cropName}</div>}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3 mt-4">
        <Fact label="County" value={field.county ? `${field.county} County` : "—"} />
        <Fact label="FSA Farm / Tract / Field" value={[field.fsaFarmNumber, field.fsaTractNumber, field.fsaFieldNumber].filter(Boolean).join(" / ") || "—"} />
        <Fact label="Ownership" value={`${OWNERSHIP_LABEL[field.ownership] ?? field.ownership}${field.landownerName ? ` · ${field.landownerName}` : ""}`} />
        <Fact label="Irrigated" value={field.irrigated ? "Yes" : "No"} />
      </div>

      <Section title={`Season Summary (${taxYear})`}>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {([
            ["Income", money(profit.income), moneyPrecise(profit.incomePerAcre) + "/ac"],
            ["Total Expense", money(profit.totalExpense), moneyPrecise(profit.expensePerAcre) + "/ac"],
            ["Margin", money(profit.margin), moneyPrecise(profit.marginPerAcre) + "/ac"],
            ["Planted Acres", num(cropThisYear?.plantedAcres ?? field.acres, 2), ""],
            ["Yield", cropThisYear?.actualYield ? `${num(cropThisYear.actualYield, 1)} ${cropThisYear.yieldUnit ?? ""}`.trim() : "—", ""],
          ] as [string, string, string][]).map(([label, value, sub]) => (
            <div key={label}>
              <div className="text-[10px] uppercase tracking-wide text-charcoal/50 font-semibold">{label}</div>
              <div className="text-lg font-semibold text-forest tabular-nums">{value}</div>
              {sub && <div className="text-[11px] text-charcoal/45 tabular-nums">{sub}</div>}
            </div>
          ))}
        </div>
      </Section>

      <Section title={allYears ? "Planting — All Years" : `Planting (${taxYear})`}>
        {plantings.length === 0 ? (
          <Empty>No planting logged{allYears ? "" : ` for ${taxYear}`}.</Empty>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>Date</th><th>Seed Product</th><th className="text-right">Acres</th><th className="text-right">Seeding Rate</th></tr>
            </thead>
            <tbody>
              {plantings.map((a) => (
                <tr key={a.id}>
                  <td className="whitespace-nowrap">{a.activityDate}</td>
                  <td>{a.seedProductName}</td>
                  <td className="text-right tabular-nums">{num(a.acres, 2)}</td>
                  <td className="text-right tabular-nums">{a.seedingRate ? `${a.seedingRate.toLocaleString("en-US")}/ac` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title={allYears ? "Chemical Applications — All Years" : `Chemical Applications (${taxYear})`}>
        {sprays.length === 0 ? (
          <Empty>No chemical applications logged{allYears ? "" : ` for ${taxYear}`}.</Empty>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th><th>Product</th><th>EPA Reg. No.</th><th className="text-right">Rate</th>
                <th className="text-right">Acres</th><th>Applicator</th><th>Wind / Temp</th>
              </tr>
            </thead>
            <tbody>
              {sprays.flatMap((a) =>
                (a.sprayProducts ?? []).map((p, i) => (
                  <tr key={`${a.id}-${i}`}>
                    <td className="whitespace-nowrap">{i === 0 ? a.activityDate : ""}</td>
                    <td>{p.productName}</td>
                    <td className="tabular-nums">{p.epaRegistrationNumber ?? "—"}</td>
                    <td className="text-right tabular-nums">{p.rate != null ? `${p.rate} ${p.rateUnit ?? ""}`.trim() : "—"}</td>
                    <td className="text-right tabular-nums">{i === 0 ? num(a.acres, 2) : ""}</td>
                    <td>{i === 0 ? a.applicatorName ?? a.operatorName ?? "—" : ""}</td>
                    <td className="whitespace-nowrap">
                      {i === 0
                        ? [
                            a.weather?.windSpeed != null ? `${a.weather.windSpeed} mph ${a.weather.windDirection ?? ""}`.trim() : null,
                            a.weather?.temp != null ? `${a.weather.temp}°` : null,
                          ].filter(Boolean).join(" · ") || "—"
                        : ""}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </Section>

      <Section title={`Product Totals (${taxYear})`}>
        {usage.length === 0 ? (
          <Empty>No seed, fertilizer or chemical use recorded for {taxYear}.</Empty>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>Category</th><th>Product</th><th className="text-right">Quantity</th><th>Unit</th><th className="text-right">Allocated Cost</th></tr>
            </thead>
            <tbody>
              {usage.map((u, i) => (
                <tr key={`${u.productName}-${i}`}>
                  <td>{u.category}</td>
                  <td>{u.productName}</td>
                  <td className="text-right tabular-nums">{num(u.totalQuantity, 2)}</td>
                  <td>{u.unit ?? "—"}</td>
                  <td className="text-right tabular-nums">{u.allocatedCost != null ? moneyPrecise(u.allocatedCost) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {harvests.length > 0 && (
        <Section title={allYears ? "Harvest — All Years" : `Harvest (${taxYear})`}>
          <table className="data-table">
            <thead>
              <tr><th>Date</th><th className="text-right">Acres</th><th className="text-right">Yield</th><th className="text-right">Moisture</th></tr>
            </thead>
            <tbody>
              {harvests.map((a) => (
                <tr key={a.id}>
                  <td className="whitespace-nowrap">{a.activityDate}</td>
                  <td className="text-right tabular-nums">{num(a.acres, 2)}</td>
                  <td className="text-right tabular-nums">{a.yieldAmount ? `${num(a.yieldAmount, 1)} ${a.yieldUnit ?? ""}`.trim() : "—"}</td>
                  <td className="text-right tabular-nums">{a.moisturePct != null ? `${a.moisturePct}%` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {expenseRows.length > 0 && (
        <Section title={`Expense Breakdown (${taxYear})`}>
          <table className="data-table">
            <tbody>
              {expenseRows.map(([label, value]) => (
                <tr key={label}>
                  <td>{label}</td>
                  <td className="text-right tabular-nums">{moneyPrecise(value)}</td>
                  <td className="text-right tabular-nums text-charcoal/55">{moneyPrecise(value / (field.acres || 1))}/ac</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td>Total</td>
                <td className="text-right tabular-nums">{moneyPrecise(profit.totalExpense)}</td>
                <td className="text-right tabular-nums">{moneyPrecise(profit.expensePerAcre)}/ac</td>
              </tr>
            </tbody>
          </table>
        </Section>
      )}

      {cropYears.length > 0 && (
        <Section title="Crop History">
          <table className="data-table">
            <thead>
              <tr><th>Year</th><th>Crop</th><th className="text-right">Planted Acres</th><th className="text-right">Yield</th></tr>
            </thead>
            <tbody>
              {cropYears.map((cy) => (
                <tr key={cy.id} className={cy.year === taxYear ? "font-semibold" : ""}>
                  <td className="tabular-nums">{cy.year}</td>
                  <td>{cy.cropName ?? "—"}</td>
                  <td className="text-right tabular-nums">{num(cy.plantedAcres, 2)}</td>
                  <td className="text-right tabular-nums">{cy.actualYield ? `${num(cy.actualYield, 1)} ${cy.yieldUnit ?? ""}`.trim() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {field.notes && (
        <Section title="Field Notes">
          <p className="text-sm whitespace-pre-line">{field.notes}</p>
        </Section>
      )}

      <Section title="Notes">
        <div className="space-y-0">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="border-b border-[--border-color] h-7" />
          ))}
        </div>
      </Section>

      <footer className="mt-6 pt-2 border-t border-[--border-color] text-[10px] text-charcoal/50 flex justify-between gap-4 flex-wrap">
        <span>{farm.name} · {field.name} · {allYears ? "all years" : `tax year ${taxYear}`}</span>
        <span>Printed {printed} from FarmLedger</span>
      </footer>
    </div>
  );
}
