import { redirect } from "next/navigation";
import { Sidebar, TopBar } from "@/components/nav/sidebar";
import { AssistantPanel } from "@/components/assistant/assistant-panel";
import { isSupabaseConfigured, getActiveFarm, getUserFarms } from "@/lib/supabase/auth";
import { getFarm as getDemoFarm, listTaxYears } from "@/lib/data/repo";
import { getViewTaxYear } from "@/lib/tax-year";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const configured = isSupabaseConfigured();
  let farmName = "Mohler Farms";
  let farms: { id: string; name: string }[] = [];
  let activeFarmId: string | undefined;

  if (configured) {
    // getActiveFarm() and getUserFarms() are both React.cache()'d and
    // getActiveFarm() calls getUserFarms() internally, so calling both here
    // (even "again") costs nothing extra — it's the same cached result.
    const [farm, allFarms] = await Promise.all([getActiveFarm(), getUserFarms()]);
    if (!farm) redirect("/onboarding");
    farmName = farm.name;
    activeFarmId = farm.id;
    farms = allFarms.map((f) => ({ id: f.id, name: f.name }));
  } else {
    const farm = await getDemoFarm();
    farmName = farm.name;
  }
  const [taxYear, years] = await Promise.all([getViewTaxYear(), listTaxYears()]);

  return (
    <div className="flex min-h-screen w-full">
      <Sidebar farmName={farmName} taxYear={taxYear} authenticated={configured} farms={farms} activeFarmId={activeFarmId} />
      <div className="flex-1 min-w-0 flex flex-col pb-16 md:pb-0">
        <TopBar farmName={farmName} taxYear={taxYear} years={years} />
        <main className="flex-1 px-4 md:px-8 py-6 max-w-[1400px] w-full mx-auto">{children}</main>
      </div>
      <AssistantPanel />
    </div>
  );
}
