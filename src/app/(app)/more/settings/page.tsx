import { getFarm } from "@/lib/data/repo";
import { PageHeader } from "@/components/ui/stat-card";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { inviteMemberAction } from "@/lib/auth-actions";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const { error, notice } = await searchParams;
  const farm = await getFarm();
  const supabaseOn = isSupabaseConfigured();

  const roles = [
    "Farm Owner/Admin", "Farm Manager", "Employee", "Equipment Operator",
    "Applicator", "Bookkeeper", "CPA/Tax Professional",
  ];

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="Settings" description="Farm profile, team, and integrations." />

      <div className="card p-5">
        <div className="text-sm font-semibold text-forest mb-3">Farm / Business</div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><div className="text-charcoal/45">Name</div><div className="font-medium">{farm.name}</div></div>
          <div><div className="text-charcoal/45">State</div><div className="font-medium">{farm.state}</div></div>
          <div><div className="text-charcoal/45">Operation Type</div><div className="font-medium capitalize">{farm.operationType}</div></div>
          <div><div className="text-charcoal/45">Current Tax Year</div><div className="font-medium">{farm.currentTaxYear}</div></div>
        </div>
      </div>

      <div className="card p-5">
        <div className="text-sm font-semibold text-forest mb-3">Team & Roles</div>
        <p className="text-sm text-charcoal/55 mb-3">Configurable permissions per role — e.g. an Applicator can log spray records without seeing farm financials.</p>
        <div className="grid grid-cols-2 gap-2 text-sm mb-4">
          {roles.map((r) => <div key={r} className="px-3 py-2 bg-cream-deep rounded-lg">{r}</div>)}
        </div>

        {supabaseOn ? (
          <>
            {error && <div className="text-sm text-status-red bg-red-50 rounded-lg px-3 py-2 mb-3">{error}</div>}
            {notice === "invited" && <div className="text-sm text-forest bg-wheat/30 rounded-lg px-3 py-2 mb-3">Invite sent.</div>}
            <form action={inviteMemberAction} className="flex flex-col sm:flex-row gap-2">
              <input type="email" name="email" placeholder="teammate@email.com" required className="input flex-1" />
              <select name="role" className="input sm:w-56" defaultValue="employee">
                <option value="owner_admin">Farm Owner/Admin</option>
                <option value="manager">Farm Manager</option>
                <option value="employee">Employee / Field Hand</option>
                <option value="equipment_operator">Equipment Operator</option>
                <option value="applicator">Applicator</option>
                <option value="bookkeeper">Bookkeeper</option>
                <option value="cpa">CPA/Tax Professional</option>
              </select>
              <button className="bg-forest text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-forest-light whitespace-nowrap">
                Invite
              </button>
            </form>
          </>
        ) : (
          <p className="text-sm text-charcoal/45">Connect Supabase to invite teammates with real accounts and permissions.</p>
        )}
      </div>

      <div className="card p-5">
        <div className="text-sm font-semibold text-forest mb-3">Data & Integrations</div>
        <div className="flex items-center justify-between text-sm py-2 border-b border-[--border-color]">
          <span>Supabase (database, auth, file storage)</span>
          <span className={`status-pill ${supabaseOn ? "status-green" : "status-amber"}`}>{supabaseOn ? "Connected" : "Not connected"}</span>
        </div>
        <div className="flex items-center justify-between text-sm py-2 border-b border-[--border-color]">
          <span>AI Receipt OCR / Assistant (OpenAI)</span>
          <span className="status-pill status-green">Configured</span>
        </div>
        <div className="flex items-center justify-between text-sm py-2 border-b border-[--border-color]">
          <span>Bank / Credit Card Import</span>
          <span className="status-pill status-amber">Not connected</span>
        </div>
        <div className="flex items-center justify-between text-sm py-2">
          <span>Accounting Software (e.g. QuickBooks)</span>
          <span className="status-pill status-amber">Not connected</span>
        </div>
      </div>

      <div className="card p-5">
        <div className="text-sm font-semibold text-forest mb-2">Your Data</div>
        <p className="text-sm text-charcoal/55 mb-3">Download a complete export of your farm&apos;s records at any time.</p>
        <a href="/api/export/cpa-workbook?type=full" className="inline-block bg-forest text-white px-4 py-2 rounded-lg text-sm font-medium">Download Full Account Export (.xlsx)</a>
      </div>
    </div>
  );
}
