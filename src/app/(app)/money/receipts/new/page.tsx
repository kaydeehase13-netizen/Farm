import { getAppData, getFarm } from "@/lib/data/repo";
import { PageHeader } from "@/components/ui/stat-card";
import { ReceiptScanner } from "@/components/money/receipt-scanner";

export default async function NewReceiptPage() {
  const farm = await getFarm();
  const data = await getAppData(farm.currentTaxYear);
  return (
    <div>
      <PageHeader title="Scan Receipt" description="Photograph or upload a receipt — AI reads it, you confirm." />
      <ReceiptScanner categories={data.farmCategories} fields={data.fields} />
    </div>
  );
}
