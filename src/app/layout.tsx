import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FarmLedger — Farm all year. Be ready at tax time.",
  description: "Farm financial recordkeeping, field management, and tax organization.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-cream text-charcoal">{children}</body>
    </html>
  );
}
