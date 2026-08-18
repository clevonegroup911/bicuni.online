import { NextRequest, NextResponse } from "next/server";

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

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = protectedPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  const isPublicAdminRoute = publicAdminRoutes.has(pathname);
  const sessionCookie = request.cookies.get("authjs.session-token") ?? request.cookies.get("__Secure-authjs.session-token");
  if (isProtected && !isPublicAdminRoute && !sessionCookie) {
    if (pathname.startsWith("/api/admin")) {
      return NextResponse.json({ error: "Authentification administrative requise." }, { status: 401 });
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
    return NextResponse.redirect(redirectUrl);
  }
  const response = NextResponse.next();
  response.headers.set("X-Robots-Tag", pathname.startsWith("/admin") ? "noindex, nofollow" : "index, follow");
  return response;
}

export const config = {
  matcher: ["/dashboard", "/dashboard/:path*", "/admin", "/admin/:path*", "/university", "/university/:path*", "/api/admin/:path*"],
};
