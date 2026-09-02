import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { getCurrentUser, getUserFarms } from "@/lib/supabase/auth";
import { createFarmAction } from "@/lib/auth-actions";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  if (!isSupabaseConfigured()) redirect("/home");

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Already has a farm — no need to onboard again.
  const farms = await getUserFarms();
  if (farms.length > 0) redirect("/home");

  return (
    <div className="min-h-screen flex items-center justify-center bg-forest px-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm">
        <div className="text-center mb-5">
          <div className="text-xl font-semibold text-forest mb-1">Set up your farm</div>
          <p className="text-sm text-charcoal/55">
            This creates a brand-new, empty farm — no sample data. You can invite others and add
            fields, transactions, and equipment once you&apos;re in.
          </p>
        </div>
        {error && <div className="text-sm text-status-red bg-red-50 rounded-lg px-3 py-2 mb-3">{error}</div>}
        <form action={createFarmAction} className="space-y-3">
          <input name="name" placeholder="Farm name (e.g. Hase Family Farm)" className="input" required />
          <select name="operationType" className="input" defaultValue="row_crop">
            <option value="grain">Grain</option>
            <option value="row_crop">Row Crop</option>
            <option value="livestock">Livestock</option>
            <option value="dairy">Dairy</option>
            <option value="custom_application">Custom Work / Ag Services</option>
            <option value="hay_forage">Hay / Forage</option>
            <option value="mixed">Mixed / Diversified</option>
            <option value="other">Other</option>
          </select>
          <input name="state" placeholder="State (e.g. KS)" maxLength={2} className="input" />
          <button className="bg-forest text-white w-full py-2.5 rounded-lg font-medium hover:bg-forest-light">
            Start From Scratch
          </button>
        </form>
      </div>
    </div>
  );
}
