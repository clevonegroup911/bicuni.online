import { NextRequest, NextResponse } from "next/server";
const protectedPaths = ["/dashboard", "/admin", "/university"];
export function middleware(request: NextRequest) {
  const isProtected = protectedPaths.some(path => request.nextUrl.pathname.startsWith(path));
  const sessionCookie = request.cookies.get("authjs.session-token") ?? request.cookies.get("__Secure-authjs.session-token");
  if (isProtected && !sessionCookie) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(request.nextUrl.pathname)}`, request.url));
  const response = NextResponse.next();
  response.headers.set("X-Robots-Tag", request.nextUrl.pathname.startsWith("/admin") ? "noindex, nofollow" : "index, follow");
  return response;
}
export const config = { matcher: ["/dashboard/:path*", "/admin/:path*", "/university/:path*"] };
