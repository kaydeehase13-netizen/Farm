// Shared OCR call — used by the live "Scan Receipt" upload flow
// (api/receipts/ocr/route.ts) AND by the batch re-check of already-uploaded
// receipt photos (rescanReceiptsForSplitsAction in actions.ts), so both
// paths ask the model the same question and agree on what "this receipt
// covers more than one category" means.
//
// This is ALWAYS treated as a suggestion — callers must route the result
// through a human-confirmation step before it becomes a real transaction,
// per the build spec: "Never silently make permanent AI financial
// decisions."

export const CATEGORY_ENUM = [
  "Seed", "Fertilizer", "Chemical", "Fuel", "Rent", "Insurance", "Custom Work",
  "Repairs & Maintenance", "Trucking", "Supplies", "Veterinary & Medicine",
  "Other", "Personal / Excluded",
] as const;

export interface OcrLineItem {
  description: string;
  amount: number;
  suggestedCategory?: string | null;
}

export interface OcrResult {
  vendor: string | null;
  date: string | null;
  amount: number | null;
  salesTax: number | null;
  lineItems: OcrLineItem[];
  suggestedCategory: string | null;
  /** Line items grouped by suggestedCategory, amounts summed per group. */
  categoryBreakdown: { category: string; amount: number }[];
  /** True when line items span 2+ distinct suggested categories. */
  multipleCategories: boolean;
  stub: boolean;
  note?: string;
  error?: string;
}

function summarizeByCategory(lineItems: OcrLineItem[]): { category: string; amount: number }[] {
  const totals = new Map<string, number>();
  for (const item of lineItems) {
    const cat = (item.suggestedCategory ?? "").trim();
    if (!cat || typeof item.amount !== "number") continue;
    totals.set(cat, (totals.get(cat) ?? 0) + item.amount);
  }
  return Array.from(totals, ([category, amount]) => ({ category, amount }));
}

export async function scanReceiptImage(imageBase64: string, mimeType: string): Promise<OcrResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      vendor: null, date: null, amount: null, salesTax: null, lineItems: [],
      suggestedCategory: null, categoryBreakdown: [], multipleCategories: false,
      stub: true, note: "OPENAI_API_KEY not configured — fill in the receipt details manually.",
    };
  }

  try {
    const model = process.env.OPENAI_VISION_MODEL || "gpt-4o-mini";
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You extract structured data from a photo of a farm-supply or business receipt. " +
              "Return strict JSON with keys: vendor (string|null), date (YYYY-MM-DD|null), " +
              "amount (number|null, the total), salesTax (number|null), " +
              `lineItems (array of {description, amount, suggestedCategory}), suggestedCategory (string|null, the single best category for the WHOLE receipt if you had to pick one, one of: ${CATEGORY_ENUM.join(", ")}). ` +
              `Each line item's own suggestedCategory must ALSO be one of: ${CATEGORY_ENUM.join(", ")}. ` +
              "Look closely at each line item — a receipt genuinely can mix categories (e.g. seed AND chemical on one seed-dealer invoice, or fuel AND a car wash on one fuel receipt); don't force every item to the same category just because most of them match. " +
              "If a value is unreadable, use null rather than guessing.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Extract the receipt data as JSON." },
              { type: "image_url", image_url: { url: `data:${mimeType || "image/jpeg"};base64,${imageBase64}` } },
            ],
          },
        ],
        max_tokens: 1000,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return {
        vendor: null, date: null, amount: null, salesTax: null, lineItems: [],
        suggestedCategory: null, categoryBreakdown: [], multipleCategories: false,
        stub: false, error: `OpenAI request failed: ${errText}`,
      };
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content);
    const lineItems: OcrLineItem[] = Array.isArray(parsed.lineItems) ? parsed.lineItems : [];
    const categoryBreakdown = summarizeByCategory(lineItems);

    return {
      vendor: parsed.vendor ?? null,
      date: parsed.date ?? null,
      amount: parsed.amount ?? null,
      salesTax: parsed.salesTax ?? null,
      lineItems,
      suggestedCategory: parsed.suggestedCategory ?? null,
      categoryBreakdown,
      multipleCategories: categoryBreakdown.length >= 2,
      stub: false,
    };
  } catch (err: unknown) {
    return {
      vendor: null, date: null, amount: null, salesTax: null, lineItems: [],
      suggestedCategory: null, categoryBreakdown: [], multipleCategories: false,
      stub: false, error: err instanceof Error ? err.message : "OCR failed",
    };
  }
}
