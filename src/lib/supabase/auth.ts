import { cookies } from "next/headers";
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
 */
export async function getUserFarms(): Promise<CurrentFarm[]> {
  const supabase = await createServerSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return [];

  const { data, error } = await supabase
    .from("farm_membership")
    .select("role, farm_business:farm_business_id(id, name, operation_type, state, current_tax_year)")
    .eq("user_id", userData.user.id)
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
}

export async function getActiveFarm(): Promise<CurrentFarm | null> {
  const farms = await getUserFarms();
  if (farms.length === 0) return null;
  const cookieStore = await cookies();
  const activeId = cookieStore.get("farmledger_active_farm")?.value;
  return farms.find((f) => f.id === activeId) ?? farms[0];
}

export async function requireActiveFarm(): Promise<CurrentFarm> {
  const farm = await getActiveFarm();
  if (!farm) throw new Error("No active farm for this user.");
  return farm;
}
