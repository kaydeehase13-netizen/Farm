import { NextRequest, NextResponse } from "next/server";
import { getReceipt } from "@/lib/data/repo";

// Serves ONE receipt's photo as its own real HTTP response — a normal,
// cacheable, lazily-loaded image request — instead of embedding the
// base64 photo directly in a page's HTML. getReceipt() (unlike
// listReceipts()) only ever fetches the one row this request needs, so
// viewing a receipt's thumbnail no longer means downloading every other
// receipt's photo along with it.
//
// ?w=<px> resizes down to that width server-side (via sharp) before
// sending. The Receipts LIST page renders each photo as a small ~150px
// grid tile — without this it was downloading and decoding every
// receipt's full up-to-1800px-wide original just to shrink it in CSS,
// which is most of why that page felt slow to open with more than a
// handful of receipts on file. The stored original (fileDataUrl in the
// database) is never touched — this only shrinks what's SERVED for this
// one request, so nothing about the saved receipt is lost; the edit and
// confirm pages call this same endpoint with no ?w= and still get the
// full-resolution photo for actually reviewing it.
export async function GET(req: NextRequest, { params }: { params: Promise<{ receiptId: string }> }) {
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
  let bytes = Buffer.from(base64, "base64");
  let outContentType = contentType;

  const wParam = Number(req.nextUrl.searchParams.get("w"));
  if (wParam && Number.isFinite(wParam) && wParam > 0 && contentType.startsWith("image/")) {
    try {
      const sharp = (await import("sharp")).default;
      bytes = await sharp(bytes).resize({ width: Math.min(wParam, 800), withoutEnlargement: true }).jpeg({ quality: 78 }).toBuffer();
      outContentType = "image/jpeg";
    } catch {
      // PDF-as-image or a format sharp can't touch — fall back to the original bytes untouched.
    }
  }

  return new NextResponse(bytes, {
    headers: {
      "Content-Type": outContentType,
      // Receipt photos are never edited in place — a new upload gets a new
      // receipt id — so these can be cached aggressively once fetched.
      "Cache-Control": "private, max-age=86400, immutable",
    },
  });
}
