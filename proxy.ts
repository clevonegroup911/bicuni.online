import { NextRequest, NextResponse } from "next/server";
import { nextRendererCspHeaders, securityHeaders } from "@/lib/security/headers";

const protectedPaths = ["/dashboard", "/admin", "/university", "/api/admin"];
const publicAdminRoutes = new Set(["/admin/login", "/admin/denied"]);

function trustedLoopbackOrigin(request: NextRequest) {
  const host = request.headers.get("host");
  if (!host) return null;
  try {
    const candidate = new URL(`${request.nextUrl.protocol}//${host}`);
    const loopback = candidate.hostname === "localhost"
      || candidate.hostname === "127.0.0.1"
      || candidate.hostname === "[::1]";
    return loopback ? candidate.origin : null;
  } catch {
    return null;
  }
}

export function isHttpsRequest(request: NextRequest) {
  if (request.nextUrl.protocol === "https:") return true;
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  return proto === "https";
}

function applySecurityHeaders(request: NextRequest, response: NextResponse, nonce: string) {
  for (const header of securityHeaders(process.env.NODE_ENV, { nonce, https: isHttpsRequest(request) })) {
    response.headers.set(header.key, header.value);
  }
  return response;
}

function createNonce() {
  return Buffer.from(crypto.randomUUID()).toString("base64");
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const nonce = createNonce();
  const isProtected = protectedPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  const isPublicAdminRoute = publicAdminRoutes.has(pathname);
  const sessionCookie = request.cookies.get("authjs.session-token") ?? request.cookies.get("__Secure-authjs.session-token");
  if (isProtected && !isPublicAdminRoute && !sessionCookie) {
    if (pathname.startsWith("/api/admin")) {
      return applySecurityHeaders(request, NextResponse.json({ error: "Authentification administrative requise." }, { status: 401 }), nonce);
    }
    const login = pathname.startsWith("/admin") ? "/admin/login" : "/login";
    const redirectUrl = request.nextUrl.clone();
    const loopbackOrigin = trustedLoopbackOrigin(request);
    if (loopbackOrigin) {
      const trustedUrl = new URL(loopbackOrigin);
      redirectUrl.hostname = trustedUrl.hostname;
      redirectUrl.port = trustedUrl.port;
    }
    redirectUrl.pathname = login;
    redirectUrl.search = "";
    redirectUrl.searchParams.set("next", pathname);
    return applySecurityHeaders(request, NextResponse.redirect(redirectUrl), nonce);
  }
  const requestHeaders = new Headers(request.headers);
  for (const [key, value] of Object.entries(nextRendererCspHeaders(nonce))) {
    requestHeaders.set(key, value);
  }
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("X-Robots-Tag", pathname.startsWith("/admin") ? "noindex, nofollow" : "index, follow");
  return applySecurityHeaders(request, response, nonce);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
