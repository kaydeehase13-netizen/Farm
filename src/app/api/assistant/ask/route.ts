import { NextRequest, NextResponse } from "next/server";
import { getFarm, allFieldProfitability, dashboardSummary, listInventory, listCustomers, listTransactions } from "@/lib/data/repo";

// AI farm assistant: answers questions against the farm's ACTUAL records.
// Per spec: "Never invent financial values. If data is missing, clearly
// state that the application does not have enough information." We enforce
// this by handing the model a structured snapshot of real data and
// instructing it to answer only from that snapshot.
export async function POST(req: NextRequest) {
  const { question } = await req.json();
  if (!question) return NextResponse.json({ error: "question is required" }, { status: 400 });

  const farm = await getFarm();
  const [summary, fieldProfit, inventory, customers, transactions] = await Promise.all([
    dashboardSummary(farm.currentTaxYear),
    allFieldProfitability(farm.currentTaxYear),
    listInventory(),
    listCustomers(),
    listTransactions({ taxYear: farm.currentTaxYear }),
  ]);

  const snapshot = {
    farm: farm.name, taxYear: farm.currentTaxYear,
    summary,
    fields: fieldProfit,
    customers,
    inventory,
    transactionsSample: transactions.slice(0, 60).map((t) => ({
      date: t.transactionDate, type: t.transactionType, vendor: t.vendorName, description: t.description,
      amount: t.amount, category: t.farmCategoryId, status: t.status, receiptOnFile: Boolean(t.receiptId),
    })),
    missingReceiptTransactions: transactions.filter((t) => t.transactionType === "expense" && !t.receiptId)
      .map((t) => ({ date: t.transactionDate, vendor: t.vendorName, amount: t.amount })),
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
              "Never invent or estimate a financial figure that isn't derivable from the snapshot. " +
              "If the data needed to answer isn't in the snapshot, say plainly that FarmLedger doesn't have enough information for that yet. " +
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
