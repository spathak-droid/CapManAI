import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const protectedRoutes = ["/scenario", "/leaderboard", "/dashboard"];

export function middleware(request: NextRequest) {
  const token = request.cookies.get("auth_session")?.value;
  const { pathname } = request.nextUrl;

  if (protectedRoutes.some((r) => pathname.startsWith(r)) && !token) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  // Do not redirect away from login/register based on cookie alone (may be stale).
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/scenario/:path*",
    "/leaderboard/:path*",
    "/dashboard/:path*",
    "/auth/:path*",
  ],
};
