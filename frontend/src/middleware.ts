import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const protectedRoutes = ["/scenario", "/leaderboard", "/dashboard"];
const authRoutes = ["/auth/login", "/auth/register"];

export function middleware(request: NextRequest) {
  const token = request.cookies.get("auth_session")?.value;
  const { pathname } = request.nextUrl;

  if (protectedRoutes.some((route) => pathname.startsWith(route))) {
    if (!token) {
      return NextResponse.redirect(new URL("/auth/login", request.url));
    }
  }

  if (authRoutes.some((route) => pathname.startsWith(route))) {
    if (token) {
      return NextResponse.redirect(new URL("/scenario", request.url));
    }
  }

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
