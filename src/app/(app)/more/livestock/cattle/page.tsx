import { redirect } from "next/navigation";

/** Cattle moved to its own tab. */
export default function OldCattlePage() {
  redirect("/cattle");
}
