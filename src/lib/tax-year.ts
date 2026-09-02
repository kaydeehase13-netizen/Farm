import { cookies } from "next/headers";
import { getFarm } from "@/lib/data/repo";

// The tax year the user is currently *viewing* (transactions, reports,
// dashboards, exports). Separate from farm.currentTaxYear, which is the
// farm's actual "active/operating" year set in onboarding/Settings — the
// view year is just a per-browser display preference so a farm with both
// 2025 and 2026 data can look back at 2025 without changing anything about
// how new records get filed.
const COOKIE = "fl_view_tax_year";

export async function getViewTaxYear(): Promise<number> {
  const farm = await getFarm();
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  const year = raw ? Number(raw) : NaN;
  return Number.isFinite(year) ? year : farm.currentTaxYear;
}
