import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const protectedRoutes = ["/scenario", "/leaderboard", "/dashboard"];
const authRoutes = ["/auth/login", "/auth/register"];

export function middleware(request: NextRequest) {
  const token = request.cookies.get("access_token")?.value;
  const { pathname } = request.nextUrl;

  // Redirect unauthenticated users away from protected routes
  if (protectedRoutes.some((route) => pathname.startsWith(route))) {
    if (!token) {
      return NextResponse.redirect(new URL("/auth/login", request.url));
    }
  }

  // Redirect authenticated users away from auth routes
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
