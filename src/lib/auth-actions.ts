"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function str(fd: FormData, key: string) {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

/** Sign up with email/password, then send the person to onboarding to create their farm. */
export async function signUpAction(formData: FormData) {
  if (!isSupabaseConfigured()) redirect("/login?error=not-configured");
  const email = str(formData, "email");
  const password = str(formData, "password");
  const name = str(formData, "name");
  if (!email || !password) redirect("/signup?error=missing-fields");

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: name ? { full_name: name } : undefined },
  });

  if (error) redirect(`/signup?error=${encodeURIComponent(error.message)}`);

  if (!data.session) {
    // Email confirmation is required before a session exists.
    redirect("/login?notice=check-email");
  }

  redirect("/onboarding");
}

export async function signInAction(formData: FormData) {
  if (!isSupabaseConfigured()) redirect("/login?error=not-configured");
  const email = str(formData, "email");
  const password = str(formData, "password");
  if (!email || !password) redirect("/login?error=missing-fields");

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);

  redirect("/home");
}

export async function signOutAction() {
  if (!isSupabaseConfigured()) redirect("/login");
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/**
 * Onboarding: creates a brand-new, genuinely empty farm_business for the
 * signed-in user, plus an owner_admin farm_membership row. This is what
 * "start from scratch" means for a real (Supabase) account — no seeded
 * demo data is ever written here.
 */
export async function createFarmAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const name = str(formData, "name") || "My Farm";
  const operationType = str(formData, "operationType") || "row_crop";
  const state = str(formData, "state") || null;
  const currentTaxYear = new Date().getFullYear();

  const { data: farm, error: farmError } = await supabase
    .from("farm_business")
    .insert({ name, operation_type: operationType, state, current_tax_year: currentTaxYear })
    .select("id")
    .single();

  if (farmError || !farm) {
    redirect(`/onboarding?error=${encodeURIComponent(farmError?.message ?? "Could not create farm")}`);
  }

  const { error: memberError } = await supabase.from("farm_membership").insert({
    farm_business_id: farm.id,
    user_id: userData.user.id,
    role: "owner_admin",
    accepted_at: new Date().toISOString(),
  });

  if (memberError) {
    redirect(`/onboarding?error=${encodeURIComponent(memberError.message)}`);
  }

  const cookieStore = await cookies();
  cookieStore.set("farmledger_active_farm", farm.id, { httpOnly: false, path: "/", sameSite: "lax" });

  redirect("/home");
}

/** Switch which farm (of the user's memberships) is "active" — supports one login belonging to multiple farms. */
export async function switchFarmAction(formData: FormData) {
  const farmId = str(formData, "farmId");
  if (!farmId) redirect("/home");
  const cookieStore = await cookies();
  cookieStore.set("farmledger_active_farm", farmId, { httpOnly: false, path: "/", sameSite: "lax" });
  redirect("/home");
}

/**
 * Invite a teammate onto the active farm with a given role. Uses the
 * service-role admin client (never exposed to the browser) to send a real
 * Supabase Auth invite email, then pre-creates their farm_membership row
 * (accepted_at stays null until they accept the invite and sign in).
 */
export async function inviteMemberAction(formData: FormData) {
  const { requireActiveFarm } = await import("@/lib/supabase/auth");
  const farm = await requireActiveFarm();
  const email = str(formData, "email");
  const role = str(formData, "role") || "field_hand";
  if (!email) redirect("/more/settings?error=missing-email");

  const admin = createAdminClient();
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email);
  if (inviteError || !invited?.user) {
    redirect(`/more/settings?error=${encodeURIComponent(inviteError?.message ?? "Invite failed")}`);
  }

  const { error: memberError } = await admin.from("farm_membership").insert({
    farm_business_id: farm.id,
    user_id: invited.user.id,
    role,
    accepted_at: null,
  });
  if (memberError) {
    redirect(`/more/settings?error=${encodeURIComponent(memberError.message)}`);
  }

  redirect("/more/settings?notice=invited");
}
