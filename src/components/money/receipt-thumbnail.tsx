"use client";

// Lazily loads a receipt's photo from its own endpoint (/api/receipts/[id]/image)
// instead of the page embedding the photo's base64 data directly in its HTML.
// Hides itself if the receipt has no photo on file, instead of showing a
// broken-image icon.
//
// width: pass this on a small grid tile (the Receipts list) so the server
// resizes the photo down before sending it, instead of the browser
// downloading a full-resolution original just to shrink it in CSS. Leave
// it unset on the edit/confirm pages, where the photo is shown large
// enough that it should stay full quality.
export function ReceiptThumbnail({ receiptId, className, width }: { receiptId: string; className?: string; width?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/receipts/${receiptId}/image${width ? `?w=${width}` : ""}`}
      alt=""
      loading="lazy"
      className={className}
      onError={(e) => {
        e.currentTarget.style.display = "none";
      }}
    />
  );
}
