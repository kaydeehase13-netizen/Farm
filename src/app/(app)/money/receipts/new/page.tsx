import { getDB } from "@/lib/data/store";
import { PageHeader } from "@/components/ui/stat-card";
import { ReceiptScanner } from "@/components/money/receipt-scanner";

export default function NewReceiptPage() {
  const db = getDB();
  return (
    <div>
      <PageHeader title="Scan Receipt" description="Photograph or upload a receipt — AI reads it, you confirm." />
      <ReceiptScanner categories={db.farmCategories} fields={db.fields} />
    </div>
  );
}
