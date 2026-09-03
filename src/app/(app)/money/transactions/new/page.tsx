import { getAppData, getFarm } from "@/lib/data/repo";
import { PageHeader } from "@/components/ui/stat-card";
import { createExpenseOrIncome } from "@/lib/actions";
import { redirect } from "next/navigation";
import { NewTransactionForm } from "@/components/money/new-transaction-form";

export default async function NewTransactionPage({
  searchParams,
}: { searchParams: Promise<{ type?: string }> }) {
  const params = await searchParams;
  const farm = await getFarm();
  const data = await getAppData(farm.currentTaxYear);
  const defaultType = params.type === "income" ? "income" : "expense";

  async function action(formData: FormData) {
    "use server";
    await createExpenseOrIncome(formData);
    redirect("/money/transactions");
  }

  return (
    <div className="max-w-xl">
      <PageHeader title="Record Transaction" description="Pick Income or Expense below — tell us what happened and we'll organize the rest." />
      <NewTransactionForm
        action={action}
        defaultType={defaultType}
        farmCategories={data.farmCategories.map((c) => ({ id: c.id, name: c.name }))}
        fields={data.fields.map((f) => ({ id: f.id, name: f.name }))}
      />
    </div>
  );
}
