import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { signInAction } from "@/lib/auth-actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const { error, notice } = await searchParams;
  const configured = isSupabaseConfigured();
  return (
    <div className="min-h-screen flex items-center justify-center bg-forest px-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="text-xl font-semibold text-forest">FarmLedger</div>
          <div className="text-xs text-charcoal/50 mt-1">Farm all year. Be ready at tax time.</div>
        </div>
        {configured ? (
          <>
            {error && <div className="text-sm text-status-red bg-red-50 rounded-lg px-3 py-2 mb-3">{error}</div>}
            {notice === "check-email" && (
              <div className="text-sm text-forest bg-wheat/30 rounded-lg px-3 py-2 mb-3">
                Check your email to confirm your account, then sign in.
              </div>
            )}
            <form action={signInAction} className="space-y-3">
              <input type="email" name="email" placeholder="Email" className="input" required autoComplete="email" />
              <input type="password" name="password" placeholder="Password" className="input" required autoComplete="current-password" />
              <button className="bg-forest text-white w-full py-2.5 rounded-lg font-medium hover:bg-forest-light">Sign In</button>
            </form>
            <p className="text-center text-sm text-charcoal/55 mt-4">
              New here? <Link href="/signup" className="text-forest font-medium hover:underline">Create an account</Link>
            </p>
          </>
        ) : (
          <div className="text-sm text-charcoal/60 space-y-3">
            <p>Supabase authentication isn&apos;t connected yet — this build is running on demo data.</p>
            <Link href="/home" className="block text-center bg-wheat text-forest font-semibold py-2.5 rounded-lg">
              Continue to Demo (Mohler Farms)
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
