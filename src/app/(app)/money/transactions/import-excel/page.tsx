import { PageHeader } from "@/components/ui/stat-card";
import { ExcelBulkImport } from "@/components/shared/excel-bulk-import";
import { bulkImportIncomeAction, bulkImportExpenseAction } from "@/lib/actions";

export default function ImportExcelPage() {
  return (
    <div className="max-w-2xl">
      <PageHeader title="Import from Excel" description="Download a template, fill in your rows, and upload it back — faster than entering transactions one at a time." />
      <div className="space-y-6">
        <ExcelBulkImport
          title="Income"
          description="One row per payment received."
          templateUrl="/api/templates/income"
          action={bulkImportIncomeAction}
        />
        <ExcelBulkImport
          title="Expenses (no receipt photo)"
          description="One row per expense you want logged fast. If you have the receipt image, use Receipts → Scan a Receipt instead so the photo stays attached."
          templateUrl="/api/templates/expenses"
          action={bulkImportExpenseAction}
        />
      </div>
    </div>
  );
}
