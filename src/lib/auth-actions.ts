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
  const user = userData.user;

  const name = str(formData, "name") || "My Farm";
  const operationType = str(formData, "operationType") || "row_crop";
  const state = str(formData, "state") || null;
  const currentTaxYear = new Date().getFullYear();

  // app_user has no self-insert policy (and no auth.users trigger creates it
  // automatically), so make sure the profile row exists before anything that
  // references it by foreign key. The admin client bypasses RLS for this
  // one bootstrap write.
  const admin = createAdminClient();
  const { error: profileError } = await admin.from("app_user").upsert(
    {
      id: user.id,
      email: user.email ?? "",
      full_name: (user.user_metadata?.full_name as string | undefined) ?? user.email ?? "Farm Owner",
    },
    { onConflict: "id" }
  );
  if (profileError) {
    redirect(`/onboarding?error=${encodeURIComponent(profileError.message)}`);
  }

  const { data: farm, error: farmError } = await supabase
    .from("farm_business")
    .insert({ owner_user_id: user.id, name, operation_type: operationType, state, current_tax_year: currentTaxYear })
    .select("id")
    .single();

  if (farmError || !farm) {
    redirect(`/onboarding?error=${encodeURIComponent(farmError?.message ?? "Could not create farm")}`);
  }

  // farm_membership has no INSERT policy for regular users (only a SELECT
  // policy for fellow members) — membership rows are only ever created by
  // trusted server-side code (here, or inviteMemberAction), so use the
  // admin client to bypass RLS for this one bootstrap write too.
  const { error: memberError } = await admin.from("farm_membership").insert({
    farm_business_id: farm.id,
    user_id: user.id,
    role: "owner_admin",
    can_view_financials: true,
    can_edit_financials: true,
    can_view_tax_records: true,
    can_edit_operational_records: true,
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
const ROLE_DEFAULT_PERMISSIONS: Record<string, { financials: boolean; editFinancials: boolean; tax: boolean }> = {
  owner_admin: { financials: true, editFinancials: true, tax: true },
  manager: { financials: true, editFinancials: true, tax: true },
  bookkeeper: { financials: true, editFinancials: true, tax: false },
  cpa: { financials: true, editFinancials: false, tax: true },
  employee: { financials: false, editFinancials: false, tax: false },
  equipment_operator: { financials: false, editFinancials: false, tax: false },
  applicator: { financials: false, editFinancials: false, tax: false },
};

export async function inviteMemberAction(formData: FormData) {
  const { requireActiveFarm } = await import("@/lib/supabase/auth");
  const farm = await requireActiveFarm();
  const name = str(formData, "name");
  const email = str(formData, "email");
  const role = str(formData, "role") || "employee";
  if (!email) redirect("/more/settings?error=missing-email");

  const admin = createAdminClient();
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: name ? { full_name: name } : undefined,
  });
  if (inviteError || !invited?.user) {
    redirect(`/more/settings?error=${encodeURIComponent(inviteError?.message ?? "Invite failed")}`);
  }

  // Same app_user bootstrap needed here as in createFarmAction — a brand
  // new invited auth user has no app_user profile row yet, and
  // farm_membership.user_id has a foreign key into app_user.
  const { error: profileError } = await admin.from("app_user").upsert(
    { id: invited!.user.id, email: invited!.user.email ?? email, full_name: name || invited!.user.email || email },
    { onConflict: "id" }
  );
  if (profileError) {
    redirect(`/more/settings?error=${encodeURIComponent(profileError.message)}`);
  }

  const perms = ROLE_DEFAULT_PERMISSIONS[role] ?? ROLE_DEFAULT_PERMISSIONS.employee;
  const { error: memberError } = await admin.from("farm_membership").insert({
    farm_business_id: farm.id,
    user_id: invited!.user.id,
    role,
    can_view_financials: perms.financials,
    can_edit_financials: perms.editFinancials,
    can_view_tax_records: perms.tax,
    accepted_at: null,
  });
  if (memberError) {
    redirect(`/more/settings?error=${encodeURIComponent(memberError.message)}`);
  }

  redirect("/more/settings?notice=invited");
}
