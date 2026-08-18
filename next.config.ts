import type { NextConfig } from "next";
import { securityHeaders } from "./lib/security/headers";

const nextConfig: NextConfig = {
  typedRoutes: false,
  poweredByHeader: false,
  headers: async () => [{
    source: "/(.*)",
    headers: securityHeaders()
  }]
};

export default nextConfig;
