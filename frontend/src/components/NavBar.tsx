"use client";

import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/scenario", label: "Train" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/dashboard", label: "Dashboard" },
];

export default function NavBar() {
  const { user, loading, logout } = useAuth();

  return (
    <nav className="sticky top-0 z-50 border-b border-gray-200 bg-white/80 backdrop-blur-md dark:border-gray-800 dark:bg-gray-900/80">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="text-xl font-bold tracking-tight text-blue-600 dark:text-blue-400"
        >
          CapMan AI
        </Link>
        <div className="flex items-center gap-6">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-gray-600 transition-colors hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
            >
              {link.label}
            </Link>
          ))}
          {!loading &&
            (user ? (
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  {user.username}
                </span>
                <button
                  onClick={logout}
                  className="text-sm font-medium text-red-500 transition-colors hover:text-red-400"
                >
                  Logout
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <Link
                  href="/auth/login"
                  className="text-sm font-medium text-blue-600 transition-colors hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  Login
                </Link>
                <Link
                  href="/auth/register"
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-500"
                >
                  Sign Up
                </Link>
              </div>
            ))}
        </div>
      </div>
    </nav>
  );
}
