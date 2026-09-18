import { NextResponse } from "next/server";
import { trustedProxyStrategy } from "@/lib/auth/rate-limit";
import { ClevonePaymentError } from "@/lib/payments/clevone/types";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function originFromConfiguredUrl(value: string | undefined) {
  const raw = value?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

function loopbackAliases(origin: string) {
  try {
    const url = new URL(origin);
    if (!LOOPBACK_HOSTS.has(url.hostname)) return [] as string[];
    const port = url.port ? `:${url.port}` : "";
    return [
      `${url.protocol}//localhost${port}`,
      `${url.protocol}//127.0.0.1${port}`,
      `${url.protocol}//[::1]${port}`,
    ];
  } catch {
    return [];
  }
}

export function allowedCsrfOrigins(environment = process.env.NODE_ENV) {
  const configured = [
    originFromConfiguredUrl(process.env.PUBLIC_APP_URL),
    originFromConfiguredUrl(process.env.AUTH_URL),
    originFromConfiguredUrl(process.env.APP_URL),
  ].filter((value): value is string => Boolean(value));

  const allowed = new Set(configured);
  if (environment !== "production") {
    for (const origin of configured) {
      for (const alias of loopbackAliases(origin)) allowed.add(alias);
    }
    if (allowed.size === 0) {
      allowed.add("http://localhost:3000");
      allowed.add("http://127.0.0.1:3000");
    }
  }
  return allowed;
}

function trustedForwardedOrigin(request: Request, allowed: Set<string>) {
  if (trustedProxyStrategy() !== "cloud-run") return null;
  const host = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim().toLowerCase();
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  if (!host || !proto) return null;
  if (!["http", "https"].includes(proto)) return null;
  if (!/^[a-z0-9.-]+(?::\d+)?$/.test(host) && host !== "[::1]" && !host.startsWith("[::1]:")) return null;
  try {
    const origin = new URL(`${proto}://${host}`).origin;
    return allowed.has(origin) ? origin : null;
  } catch {
    return null;
  }
}

export function assertSameOrigin(request: Request, environment = process.env.NODE_ENV) {
  const method = request.method.toUpperCase();
  const mutating = method !== "GET" && method !== "HEAD" && method !== "OPTIONS";
  const originHeader = request.headers.get("origin");
  if (mutating && !originHeader) {
    if (environment === "production") {
      throw new ClevonePaymentError("Origine de requête invalide.", 403, "FORBIDDEN");
    }
    return;
  }
  if (!originHeader) return;

  let parsed: URL;
  try {
    parsed = new URL(originHeader);
  } catch {
    throw new ClevonePaymentError("Origine de requête invalide.", 403, "FORBIDDEN");
  }

  const allowed = allowedCsrfOrigins(environment);
  if (allowed.has(parsed.origin)) return;

  if (request.headers.get("x-forwarded-host")) {
    const forwarded = trustedForwardedOrigin(request, allowed);
    if (forwarded && parsed.origin === forwarded) return;
  }

  throw new ClevonePaymentError("Origine de requête invalide.", 403, "FORBIDDEN");
}

export function paymentErrorResponse(error: unknown) {
  if (error instanceof ClevonePaymentError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  throw error;
}

export function idempotencyKeyFrom(request: Request, fallback: string) {
  const supplied = request.headers.get("idempotency-key")?.trim();
  if (supplied && !/^[a-zA-Z0-9:_-]{8,128}$/.test(supplied)) {
    throw new ClevonePaymentError("Clé d’idempotence invalide.", 400, "VALIDATION");
  }
  return supplied ?? fallback;
}
