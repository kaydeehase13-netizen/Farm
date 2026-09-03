import { NextRequest, NextResponse } from "next/server";
import { getReceipt } from "@/lib/data/repo";

// Serves ONE receipt's photo as its own real HTTP response — a normal,
// cacheable, lazily-loaded image request — instead of embedding the
// base64 photo directly in a page's HTML. getReceipt() (unlike
// listReceipts()) only ever fetches the one row this request needs, so
// viewing a receipt's thumbnail no longer means downloading every other
// receipt's photo along with it.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ receiptId: string }> }) {
  const { receiptId } = await params;
  const receipt = await getReceipt(receiptId);
  if (!receipt?.fileDataUrl) {
    return new NextResponse(null, { status: 404 });
  }

  const match = receipt.fileDataUrl.match(/^data:([^;]+);base64,([\s\S]*)$/);
  if (!match) {
    return new NextResponse(null, { status: 404 });
  }
  const [, contentType, base64] = match;
  const bytes = Buffer.from(base64, "base64");

  return new NextResponse(bytes, {
    headers: {
      "Content-Type": contentType,
      // Receipt photos are never edited in place — a new upload gets a new
      // receipt id — so these can be cached aggressively once fetched.
      "Cache-Control": "private, max-age=86400, immutable",
    },
  });
}
