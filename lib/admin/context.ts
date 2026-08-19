import { createHash } from "node:crypto";
import { requestIdentity } from "@/lib/auth/rate-limit";

export function auditRequestContext(request: Request) {
  const address = requestIdentity(request);
  return {
    ipHash: address !== "unknown" ? createHash("sha256").update(address).digest("hex") : null,
    userAgent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
  };
}
