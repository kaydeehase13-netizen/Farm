"use client";

/** Opens the browser print dialog for the field sheet. Hidden from the printed
 *  page itself by the `no-print` rule in globals.css. */
export function PrintButton({ label = "Print" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print bg-forest text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-forest-light"
    >
      {label}
    </button>
  );
}
