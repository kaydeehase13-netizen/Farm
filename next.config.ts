import type { NextConfig } from "next";

// Applied to every response. None of this replaces the real access control
// (Supabase auth + RLS) — it's defense-in-depth against the browser-side
// attack classes those don't touch: clickjacking (framing this app inside
// someone else's page to trick a logged-in user into clicking something),
// MIME-sniffing an uploaded file into executable script, leaking the
// current URL (which can carry a farm id) to third-party resources via the
// Referer header, and a compromised/typosquatted dependency reaching out to
// an unexpected host from inside the page.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // HSTS: only meaningful once this is actually served over HTTPS in
  // production (it is, on Netlify/Vercel-style hosting) — harmless locally.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Receipt photos are sent to the server as a base64 data URL through a
      // Server Action (see saveReceiptAndCreateExpenseAction). Next's default
      // Server Action body limit is 1MB, which a real phone photo blows past
      // — the request then just hangs/fails silently and the "Save Receipt"
      // button spins forever. Raise it enough for a normal receipt photo.
      bodySizeLimit: "15mb",
    },
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
