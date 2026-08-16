import { NextRequest, NextResponse } from "next/server";

const protectedPaths = ["/dashboard", "/admin", "/university", "/api/admin"];
const publicAdminRoutes = new Set(["/admin/login", "/admin/denied"]);

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
    return NextResponse.redirect(new URL(`${login}?next=${encodeURIComponent(pathname)}`, request.url));
  }
  const response = NextResponse.next();
  response.headers.set("X-Robots-Tag", pathname.startsWith("/admin") ? "noindex, nofollow" : "index, follow");
  return response;
}

export const config = {
  matcher: ["/dashboard", "/dashboard/:path*", "/admin", "/admin/:path*", "/university", "/university/:path*", "/api/admin/:path*"],
};
