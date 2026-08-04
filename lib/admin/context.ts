import { createHash } from "node:crypto";

export function auditRequestContext(request: Request) {
  const address = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip");
  return {
    ipHash: address ? createHash("sha256").update(address).digest("hex") : null,
    userAgent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
  };
}
