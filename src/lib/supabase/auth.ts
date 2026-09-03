import { cache } from "react";
import { cookies, headers } from "next/headers";
import { createServerSupabaseClient, isSupabaseConfigured } from "./server";

export { isSupabaseConfigured };

export interface CurrentFarm {
  id: string;
  name: string;
  operationType: string;
  state: string | null;
  currentTaxYear: number;
  role: string;
}

/** The signed-in user, or null. Throws only if Supabase isn't configured — callers should check isSupabaseConfigured() first when they need to branch. */
export async function getCurrentUser() {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

/**
 * The farms the signed-in user belongs to, and which one is "active."
 * Active farm is remembered in a cookie (`farmledger_active_farm`); falls
 * back to the first membership. Supports "add another farm" / farm
 * switching without changing accounts.
 *
 * Wrapped in React's cache() because ctx() in supabase/repo.ts calls
 * requireActiveFarm() → getActiveFarm() → getUserFarms() (2 network round
 * trips: auth.getUser() + a farm_membership join) at the top of EVERY repo
 * function — 45+ call sites. A single page can easily call 8-10 of those,
 * which meant re-authenticating and re-fetching the farm list that many
 * times over for one page load. cache() dedupes repeated calls with the
 * same (no) arguments within one request, so this now runs once per page.
 *
 * Also skips the auth.getUser() network round trip entirely when
 * proxy.ts's "x-verified-user-id" header is present: proxy.ts already
 * validated this exact session a moment earlier, but middleware and the
 * page render are separate execution contexts (cache() can't span them),
 * so without this every full page load paid for that same validation
 * twice. Falls back to a live check when the header is absent (API
 * routes, which proxy.ts's matcher excludes from running at all).
 */
export const getUserFarms = cache(async (): Promise<CurrentFarm[]> => {
  const supabase = await createServerSupabaseClient();

  const hdrs = await headers();
  let userId = hdrs.get("x-verified-user-id");
  if (!userId) {
    const { data: userData } = await supabase.auth.getUser();
    userId = userData.user?.id ?? null;
  }
  if (!userId) return [];

  const { data, error } = await supabase
    .from("farm_membership")
    .select("role, farm_business:farm_business_id(id, name, operation_type, state, current_tax_year)")
    .eq("user_id", userId)
    .not("accepted_at", "is", null);

  if (error || !data) return [];

  return data
    .filter((row: any) => row.farm_business)
    .map((row: any) => ({
      id: row.farm_business.id,
      name: row.farm_business.name,
      operationType: row.farm_business.operation_type,
      state: row.farm_business.state,
      currentTaxYear: row.farm_business.current_tax_year,
      role: row.role,
    }));
});

export const getActiveFarm = cache(async (): Promise<CurrentFarm | null> => {
  const farms = await getUserFarms();
  if (farms.length === 0) return null;
  const cookieStore = await cookies();
  const activeId = cookieStore.get("farmledger_active_farm")?.value;
  return farms.find((f) => f.id === activeId) ?? farms[0];
});

export async function requireActiveFarm(): Promise<CurrentFarm> {
  const farm = await getActiveFarm();
  if (!farm) throw new Error("No active farm for this user.");
  return farm;
}
