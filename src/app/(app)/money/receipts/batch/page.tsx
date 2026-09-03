import { PageHeader } from "@/components/ui/stat-card";
import { BatchReceiptScanner } from "@/components/money/batch-receipt-scanner";

export default function BatchReceiptsPage() {
  return (
    <div className="max-w-2xl">
      <PageHeader title="Batch Upload Receipts" description="Upload a stack of receipts at once — scan them all, then review each one before it hits your books." />
      <BatchReceiptScanner />
    </div>
  );
}
