"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useRef, useEffect } from "react";

const publicLinks = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
];

const authedLinks = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/scenario", label: "Train" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/dashboard", label: "Dashboard" },
];

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function NavBar() {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);


  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
      if (
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(e.target as Node) &&
        !(e.target as HTMLElement).closest("[data-mobile-toggle]")
      ) {
        setMobileMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close menus when navigating
  function handleNavClick() {
    setDropdownOpen(false);
    setMobileMenuOpen(false);
  }

  const links = user ? authedLinks : publicLinks;

  function isActive(href: string): boolean {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-white/[0.06] bg-black/50 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-500 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-gradient-to-r from-blue-500 to-violet-500" />
          </span>
          <span className="text-lg font-bold tracking-tight text-white">
            CapMan{" "}
            <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
              AI
            </span>
          </span>
        </Link>

        {/* Desktop Nav Links */}
        <div className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`group relative px-3 py-2 text-sm font-medium transition-colors ${
                isActive(link.href)
                  ? "text-white"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              {link.label}
              {/* Active / hover bottom bar */}
              <span
                className={`absolute inset-x-3 -bottom-[13px] h-px transition-opacity ${
                  isActive(link.href)
                    ? "bg-gradient-to-r from-blue-500 to-violet-500 opacity-100"
                    : "bg-white/40 opacity-0 group-hover:opacity-100"
                }`}
              />
            </Link>
          ))}

          {/* Auth section (desktop) */}
          {!loading &&
            (user ? (
              <div className="relative ml-4" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen((prev) => !prev)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-600 text-xs font-semibold text-white ring-1 ring-white/10 transition-all hover:ring-2 hover:ring-violet-400/50 hover:shadow-lg hover:shadow-violet-500/20 focus:outline-none focus:ring-2 focus:ring-violet-400/50"
                  aria-label="User menu"
                >
                  {getInitials(user.username)}
                </button>

                {/* Avatar dropdown */}
                {dropdownOpen && (
                  <div
                    className="absolute right-0 mt-2 w-72 origin-top-right rounded-xl border border-white/[0.08] bg-zinc-900/90 py-1 shadow-2xl backdrop-blur-xl"
                    style={{
                      animation: "navDropdownFadeIn 150ms ease-out",
                    }}
                  >
                    <div className="border-b border-white/[0.06] px-4 py-3">
                      <p className="text-sm font-semibold text-white">
                        {user.username}
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-400">
                        {user.email}
                      </p>
                      <div className="mt-2.5 flex items-center gap-2">
                        <span className="inline-flex items-center rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] font-medium capitalize text-zinc-300 ring-1 ring-white/[0.08]">
                          {user.role}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-400 ring-1 ring-blue-500/20">
                          <svg
                            className="h-3 w-3"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={2}
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
                            />
                          </svg>
                          Lv. {user.level}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2 py-0.5 text-[11px] font-medium text-violet-400 ring-1 ring-violet-500/20">
                          {user.xp_total.toLocaleString()} XP
                        </span>
                      </div>
                    </div>
                    <div className="p-1">
                      <button
                        onClick={() => {
                          setDropdownOpen(false);
                          logout();
                        }}
                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-red-400 transition-colors hover:bg-white/[0.04] hover:text-red-300"
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={2}
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"
                          />
                        </svg>
                        Log out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="ml-4 flex items-center gap-3">
                <Link
                  href="/auth/login"
                  className="text-sm font-medium text-zinc-400 transition-colors hover:text-white"
                >
                  Login
                </Link>
                <Link
                  href="/auth/register"
                  className="rounded-full bg-gradient-to-r from-blue-500 to-violet-600 px-4 py-1.5 text-sm font-medium text-white shadow-lg shadow-violet-500/20 transition-all hover:shadow-violet-500/30 hover:brightness-110"
                >
                  Sign Up
                </Link>
              </div>
            ))}
        </div>

        {/* Mobile hamburger */}
        <button
          data-mobile-toggle
          onClick={() => setMobileMenuOpen((prev) => !prev)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-white md:hidden"
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div
          ref={mobileMenuRef}
          className="border-t border-white/[0.06] bg-black/80 backdrop-blur-xl md:hidden"
          style={{ animation: "navSlideDown 200ms ease-out" }}
        >
          <div className="space-y-1 px-4 py-3">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={handleNavClick}
                className={`block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive(link.href)
                    ? "bg-white/[0.06] text-white"
                    : "text-zinc-400 hover:bg-white/[0.04] hover:text-white"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {!loading && (
            <div className="border-t border-white/[0.06] px-4 py-3">
              {user ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-600 text-xs font-semibold text-white">
                      {getInitials(user.username)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {user.username}
                      </p>
                      <p className="text-xs text-zinc-400">{user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] font-medium capitalize text-zinc-300 ring-1 ring-white/[0.08]">
                      {user.role}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-400 ring-1 ring-blue-500/20">
                      Lv. {user.level}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-violet-500/10 px-2 py-0.5 text-[11px] font-medium text-violet-400 ring-1 ring-violet-500/20">
                      {user.xp_total.toLocaleString()} XP
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      handleNavClick();
                      logout();
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-400 transition-colors hover:bg-white/[0.04] hover:text-red-300"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"
                      />
                    </svg>
                    Log out
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Link
                    href="/auth/login"
                    className="flex-1 rounded-lg border border-white/[0.08] py-2 text-center text-sm font-medium text-zinc-300 transition-colors hover:bg-white/[0.04] hover:text-white"
                  >
                    Login
                  </Link>
                  <Link
                    href="/auth/register"
                    className="flex-1 rounded-lg bg-gradient-to-r from-blue-500 to-violet-600 py-2 text-center text-sm font-medium text-white transition-all hover:brightness-110"
                  >
                    Sign Up
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Keyframe animations */}
      <style jsx>{`
        @keyframes navDropdownFadeIn {
          from {
            opacity: 0;
            transform: translateY(-4px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes navSlideDown {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </nav>
  );
}
