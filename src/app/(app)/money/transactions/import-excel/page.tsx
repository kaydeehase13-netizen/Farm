import { PageHeader } from "@/components/ui/stat-card";
import { ExcelBulkImportPreview } from "@/components/shared/excel-bulk-import-preview";
import { previewImportIncomeAction, commitImportIncomeAction, previewImportExpenseAction, commitImportExpenseAction } from "@/lib/actions";

export default function ImportExcelPage() {
  return (
    <div className="max-w-2xl">
      <PageHeader title="Import from Excel" description="Download a template, fill in your rows, and upload it back — faster than entering transactions one at a time. You'll get a chance to review and edit every row before anything is actually imported." />
      <div className="space-y-6">
        <ExcelBulkImportPreview
          title="Income"
          description="One row per payment received."
          templateUrl="/api/templates/income"
          previewAction={previewImportIncomeAction}
          commitAction={commitImportIncomeAction}
        />
        <ExcelBulkImportPreview
          title="Expenses (no receipt photo)"
          description="One row per expense you want logged fast. If you have the receipt image, use Receipts → Scan a Receipt instead so the photo stays attached."
          templateUrl="/api/templates/expenses"
          previewAction={previewImportExpenseAction}
          commitAction={commitImportExpenseAction}
        />
      </div>
    </div>
  );
}
