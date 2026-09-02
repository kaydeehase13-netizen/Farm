import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { signUpAction } from "@/lib/auth-actions";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const configured = isSupabaseConfigured();
  return (
    <div className="min-h-screen flex items-center justify-center bg-forest px-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm">
        <div className="text-center mb-5">
          <div className="text-xl font-semibold text-forest mb-1">Create your FarmLedger account</div>
          <p className="text-sm text-charcoal/55">A few things to start — everything else can wait.</p>
        </div>
        {configured ? (
          <>
            {error && <div className="text-sm text-status-red bg-red-50 rounded-lg px-3 py-2 mb-3">{error}</div>}
            <form action={signUpAction} className="space-y-3">
              <input name="name" placeholder="Your name" className="input" autoComplete="name" />
              <input type="email" name="email" placeholder="Email" className="input" required autoComplete="email" />
              <input type="password" name="password" placeholder="Password (min. 6 characters)" className="input" required minLength={6} autoComplete="new-password" />
              <button className="bg-forest text-white w-full py-2.5 rounded-lg font-medium hover:bg-forest-light">Create Account</button>
            </form>
            <p className="text-center text-sm text-charcoal/55 mt-4">
              Already have an account? <Link href="/login" className="text-forest font-medium hover:underline">Sign in</Link>
            </p>
          </>
        ) : (
          <div className="text-sm text-charcoal/60 space-y-3">
            <p>Supabase authentication isn&apos;t connected yet.</p>
            <Link href="/login" className="block text-center bg-wheat text-forest font-semibold py-2.5 rounded-lg">Back to sign in</Link>
          </div>
        )}
      </div>
    </div>
  );
}
