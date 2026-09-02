import { redirect } from "next/navigation";

export default function NewInvoiceRedirect() {
  // Invoices are generated from completed jobs (spec: "Create invoices from
  // completed jobs") — send the user to the jobs-ready-to-invoice list.
  redirect("/work/invoices");
}
