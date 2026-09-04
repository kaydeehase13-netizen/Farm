import { NextRequest, NextResponse } from "next/server";
import { scanReceiptImage } from "@/lib/receipt-ocr";

// Receipt OCR: sends the photographed/uploaded receipt image to a vision-
// capable OpenAI model and asks it to extract vendor / date / amount / tax
// / line items (each with its own suggested category) as structured JSON.
// This is ALWAYS treated as a suggestion — callers must route the result
// through a human-confirmation step (see confirmReceiptAction) before it
// becomes a real transaction, per the build spec: "Never silently make
// permanent AI financial decisions."
export async function POST(req: NextRequest) {
  const { imageBase64, mimeType } = await req.json();

  if (!imageBase64) {
    return NextResponse.json({ error: "imageBase64 is required" }, { status: 400 });
  }

  const result = await scanReceiptImage(imageBase64, mimeType);
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }
  return NextResponse.json(result);
}
