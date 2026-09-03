"use client";

// Lazily loads a receipt's photo from its own endpoint (/api/receipts/[id]/image)
// instead of the page embedding the photo's base64 data directly in its HTML.
// Hides itself if the receipt has no photo on file, instead of showing a
// broken-image icon.
export function ReceiptThumbnail({ receiptId, className }: { receiptId: string; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/receipts/${receiptId}/image`}
      alt=""
      loading="lazy"
      className={className}
      onError={(e) => {
        e.currentTarget.style.display = "none";
      }}
    />
  );
}
