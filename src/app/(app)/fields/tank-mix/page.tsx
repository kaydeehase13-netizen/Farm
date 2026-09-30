import { redirect } from "next/navigation";

/** The calculator moved to its own Chemicals tab. */
export default function OldTankMixPage() {
  redirect("/chemicals");
}
