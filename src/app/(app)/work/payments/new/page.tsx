import { redirect } from "next/navigation";

export default function NewPaymentRedirect() {
  redirect("/work/invoices");
}
