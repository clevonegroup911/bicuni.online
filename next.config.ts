import type { NextConfig } from "next";
import { staticSecurityHeaders } from "./lib/security/headers";

const nextConfig: NextConfig = {
  output: "standalone",
  typedRoutes: false,
  poweredByHeader: false,
  // TypeScript 5.9 exposes the compiler API. Next 16's CLI backend JSON.parse()s
  // `tsc --showConfig`; `npx tsc` resolves to dummy tsc@2.0.4 (ANSI text, not JSON).
  experimental: {
    useTypeScriptCli: false,
  },
  headers: async () => [{
    source: "/(.*)",
    headers: staticSecurityHeaders(),
  }],
};

export default nextConfig;
