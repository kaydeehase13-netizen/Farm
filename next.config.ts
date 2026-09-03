import type { NextConfig } from "next";

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
};

export default nextConfig;
