import { NextRequest, NextResponse } from "next/server";
import {
  getFarm, dashboardSummary, listInventory, listCustomers, listTransactions,
  listTaxYears, listFields, listActivities, listFarmCategories,
} from "@/lib/data/repo";

// AI farm assistant: answers questions against the farm's ACTUAL records.
// Per spec: "Never invent financial values. If data is missing, clearly
// state that the application does not have enough information." We enforce
// this by handing the model a structured snapshot of real data and
// instructing it to answer only from that snapshot.
//
// Covers every tax year on file (not just the current one) and includes
// field-level activity/spray records, so "how much did I spray on X" or
// "what did I spend on fuel in <past year>" can actually be answered.
export async function POST(req: NextRequest) {
  const { question } = await req.json();
  if (!question) return NextResponse.json({ error: "question is required" }, { status: 400 });

  const farm = await getFarm();
  const [taxYears, fields, activities, farmCategories, inventory, customers, allTransactions] = await Promise.all([
    listTaxYears(),
    listFields(),
    listActivities({}),
    listFarmCategories(),
    listInventory(),
    listCustomers(),
    listTransactions({}),
  ]);

  const fieldName = (id?: string) => fields.find((f: any) => f.id === id)?.name;
  const farmCategoryName = (id?: string) => farmCategories.find((c: any) => c.id === id)?.name ?? "Uncategorized";

  const summaryByYear = Object.fromEntries(
    await Promise.all(taxYears.map(async (y: number) => [y, await dashboardSummary(y)]))
  );

  const snapshot = {
    farm: farm.name,
    currentTaxYear: farm.currentTaxYear,
    taxYearsOnFile: taxYears,
    summaryByYear,
    fields: fields.map((f: any) => ({ name: f.name, acres: f.acres, crop: f.currentCrop })),
    // Every logged field activity (spray, fertilizer, planting, harvest), across all years —
    // this is what "how much did I spray on <field>" needs to be answerable at all.
    fieldActivities: activities.map((a: any) => ({
      field: a.fieldName ?? a.customerFieldName ?? fieldName(a.fieldId),
      type: a.activityType,
      date: a.activityDate,
      acres: a.acres,
      sprayProducts: a.sprayProducts,
      fertilizerProducts: a.fertilizerProducts,
      seedProductName: a.seedProductName,
      seedingRate: a.seedingRate,
    })),
    customers: customers.map((c: any) => ({ name: c.name })),
    inventory: inventory.map((i: any) => ({ product: i.productName, category: i.category, quantityOnHand: i.quantityOnHand, unit: i.unit, avgUnitCost: i.averageUnitCost })),
    // Every transaction across every tax year on file — not just the current year — with
    // human-readable category/field names instead of raw ids.
    transactions: allTransactions.map((t: any) => ({
      date: t.transactionDate, taxYear: t.taxYear, type: t.transactionType, vendor: t.vendorName,
      description: t.description, amount: t.amount, category: farmCategoryName(t.farmCategoryId),
      fields: (t.splits ?? []).map((s: any) => s.fieldId && fieldName(s.fieldId)).filter(Boolean),
      status: t.status, receiptOnFile: Boolean(t.receiptId),
    })),
  };

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      answer: "The AI assistant needs an OpenAI API key configured (OPENAI_API_KEY) to answer questions. Once that's set, I'll answer strictly from your farm's actual records.",
    });
  }

  try {
    const model = process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "You are the FarmLedger farm assistant. Answer ONLY using the JSON data snapshot provided in the user message. " +
              "The snapshot covers EVERY tax year on file (see taxYearsOnFile / summaryByYear), not just the current year — " +
              "if the question names a year or a field, look for it across the whole snapshot (transactions[].taxYear, fieldActivities[].field) " +
              "before concluding the data isn't there. Money spent on chemicals/fertilizer/seed by field comes from transactions filtered by " +
              "'fields' and 'category'; product quantities and rates applied by field come from fieldActivities (sprayProducts/fertilizerProducts) — " +
              "note that per-application dollar cost isn't tracked unless a matching transaction is linked to that field. " +
              "Never invent or estimate a financial figure that isn't derivable from the snapshot. " +
              "If the data needed to answer truly isn't in the snapshot, say plainly that FarmLedger doesn't have enough information for that yet. " +
              "You are not a tax professional — for any tax-law question, say the user should ask their tax professional and never state a transaction " +
              "'qualifies' for a deduction or 'will save' a specific tax amount. Keep answers concise and concrete, citing numbers from the data.",
          },
          { role: "user", content: `Farm data snapshot:\n${JSON.stringify(snapshot)}\n\nQuestion: ${question}` },
        ],
        max_tokens: 500,
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      return NextResponse.json({ error: `Assistant request failed: ${t}` }, { status: 502 });
    }
    const data = await res.json();
    return NextResponse.json({ answer: data.choices?.[0]?.message?.content ?? "No answer returned." });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Assistant failed" }, { status: 500 });
  }
}
