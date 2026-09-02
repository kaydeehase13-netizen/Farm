import { NextRequest, NextResponse } from "next/server";

// Receipt OCR: sends the photographed/uploaded receipt image to a vision-
// capable OpenAI model and asks it to extract vendor / date / amount / tax
// / line items as structured JSON. This is ALWAYS treated as a suggestion —
// callers must route the result through a human-confirmation step
// (see confirmReceiptAction) before it becomes a real transaction, per the
// build spec: "Never silently make permanent AI financial decisions."
export async function POST(req: NextRequest) {
  const { imageBase64, mimeType } = await req.json();

  if (!imageBase64) {
    return NextResponse.json({ error: "imageBase64 is required" }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    // No key configured — return a clearly-labeled stub so the UI still
    // exercises the full confirm flow in demo mode.
    return NextResponse.json({
      vendor: null,
      date: null,
      amount: null,
      salesTax: null,
      lineItems: [],
      stub: true,
      note: "OPENAI_API_KEY not configured — fill in the receipt details manually.",
    });
  }

  try {
    const model = process.env.OPENAI_VISION_MODEL || "gpt-4o-mini";
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
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
              "lineItems (array of {description, amount}), suggestedCategory (string|null, one of: " +
              "Seed, Fertilizer, Chemical, Fuel, Rent, Insurance, Custom Work, Repairs & Maintenance, " +
              "Trucking, Supplies, Veterinary & Medicine, Other, Personal / Excluded). " +
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
        max_tokens: 800,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: `OpenAI request failed: ${errText}` }, { status: 502 });
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content);
    return NextResponse.json({ ...parsed, stub: false });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "OCR failed" }, { status: 500 });
  }
}
