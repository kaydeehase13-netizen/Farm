import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export default async function LoginPage() {
  const configured = isSupabaseConfigured();
  return (
    <div className="min-h-screen flex items-center justify-center bg-forest px-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="text-xl font-semibold text-forest">FarmLedger</div>
          <div className="text-xs text-charcoal/50 mt-1">Farm all year. Be ready at tax time.</div>
        </div>
        {configured ? (
          <form className="space-y-3">
            <input type="email" placeholder="Email" className="input" required />
            <input type="password" placeholder="Password" className="input" required />
            <button className="bg-forest text-white w-full py-2.5 rounded-lg font-medium">Sign In</button>
          </form>
        ) : (
          <div className="text-sm text-charcoal/60 space-y-3">
            <p>Supabase authentication isn&apos;t connected yet — this build is running on demo data.</p>
            <Link href="/home" className="block text-center bg-wheat text-forest font-semibold py-2.5 rounded-lg">
              Continue to Demo (Mohler Farms)
            </Link>
          </div>
        )}
        <p className="text-center text-xs text-charcoal/40 mt-4">Multi-factor authentication and Apple/Google sign-in are enabled once Supabase Auth is connected.</p>
      </div>
    </div>
  );
}
