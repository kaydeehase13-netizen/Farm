import Link from "next/link";

export default function SignupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-forest px-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm text-center">
        <div className="text-xl font-semibold text-forest mb-1">Create your FarmLedger account</div>
        <p className="text-sm text-charcoal/55 mb-5">Progressive onboarding — we only need a few things to start. Everything else can wait.</p>
        <Link href="/login" className="block bg-wheat text-forest font-semibold py-2.5 rounded-lg">Back to sign in</Link>
      </div>
    </div>
  );
}
