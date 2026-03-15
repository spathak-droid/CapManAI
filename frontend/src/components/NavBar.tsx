"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useRef, useEffect } from "react";
import { gsap, useMagneticHover } from "@/lib/gsap";

const publicLinks = [
  { href: "/", label: "Home", icon: "M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" },
  { href: "/about", label: "About", icon: "M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" },
];

const studentLinks = [
  { href: "/", label: "Home", icon: "M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" },
  { href: "/lessons", label: "Lessons", icon: "M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" },
  { href: "/scenario", label: "Train", icon: "M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" },
  { href: "/challenges", label: "Challenges", icon: "M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" },
  { href: "/peer-review", label: "Peer Review", icon: "M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" },
  { href: "/leaderboard", label: "Leaderboard", icon: "M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.504-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516" },
  { href: "/badges", label: "Badges", icon: "M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" },
  { href: "/messages", label: "Messages", icon: "M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" },
];

const educatorLinks = [
  { href: "/", label: "Home", icon: "M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" },
  { href: "/dashboard", label: "Dashboard", icon: "M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" },
  { href: "/dashboard/content", label: "Content", icon: "M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" },
  { href: "/dashboard/students", label: "Students", icon: "M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" },
  { href: "/dashboard/messages", label: "Messages", icon: "M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" },
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
  const router = useRouter();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLAnchorElement>(null);
  const desktopNavRef = useRef<HTMLDivElement>(null);
  const navBarRef = useRef<HTMLElement>(null);
  const signUpMagneticRef = useMagneticHover<HTMLAnchorElement>(0.2);

  // Logo entrance animation — runs once on mount
  const logoAnimated = useRef(false);
  useEffect(() => {
    const el = logoRef.current;
    if (!el || logoAnimated.current) return;
    logoAnimated.current = true;
    gsap.fromTo(el, { opacity: 0, x: -12 }, { opacity: 1, x: 0, duration: 0.6, ease: "power3.out" });
  }, []);

  // Desktop nav links stagger animation — runs once when links are ready
  const linksAnimated = useRef(false);
  useEffect(() => {
    const container = desktopNavRef.current;
    if (!container || linksAnimated.current) return;
    const navLinks = container.querySelectorAll<HTMLElement>("[data-nav-link]");
    if (!navLinks.length) return;
    linksAnimated.current = true;
    gsap.fromTo(navLinks,
      { opacity: 0, y: -8 },
      { opacity: 1, y: 0, stagger: 0.04, duration: 0.4, delay: 0.15, ease: "power3.out" }
    );
  }, [user, loading]);

  // Dropdown entrance animation
  useEffect(() => {
    if (!dropdownOpen || !dropdownRef.current) return;
    const dropdown = dropdownRef.current.querySelector("[data-dropdown-menu]");
    if (!dropdown) return;
    gsap.from(dropdown, {
      opacity: 0,
      y: -6,
      scale: 0.97,
      duration: 0.2,
      ease: "power3.out",
    });
  }, [dropdownOpen]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
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

  function handleNavClick() {
    setDropdownOpen(false);
    setMobileMenuOpen(false);
  }

  const links = user
    ? user.role === "educator"
      ? educatorLinks
      : studentLinks
    : publicLinks;

  function isActive(href: string): boolean {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <nav ref={navBarRef} className="sticky top-0 z-50 border-b border-white/[0.06] bg-black/60 backdrop-blur-2xl">
      {/* Top gradient accent line */}
      <div className="h-[2px] w-full bg-gradient-to-r from-blue-500 via-violet-500 to-fuchsia-500 opacity-60" />

      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2.5 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link ref={logoRef} href="/" className="group flex items-center gap-2.5">
          <div className="relative">
            <img src="/logo.svg" alt="CapMan AI" className="h-9 w-auto transition-transform group-hover:scale-105" />
            <div className="absolute -inset-1 rounded-full bg-violet-500/0 blur-md transition-all group-hover:bg-violet-500/20" />
          </div>
        </Link>

        {/* Desktop Nav Links */}
        <div ref={desktopNavRef} className="hidden items-center gap-0.5 md:flex">
          {links.map((link) => {
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                data-nav-link
                onClick={handleNavClick}
                className={`group relative flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${
                  active
                    ? "bg-white/[0.08] text-white shadow-[0_0_12px_rgba(139,92,246,0.15)]"
                    : "text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-200"
                }`}
              >
                <svg
                  className={`h-4 w-4 transition-colors ${
                    active ? "text-violet-400" : "text-zinc-500 group-hover:text-zinc-400"
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d={link.icon} />
                </svg>
                {link.label}
                {/* Active indicator dot */}
                {active && (
                  <span className="absolute -bottom-[11px] left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-violet-400 shadow-[0_0_6px_rgba(139,92,246,0.8)]" />
                )}
              </Link>
            );
          })}

          {/* Auth section (desktop) */}
          {!loading &&
            (user ? (
              <div className="relative ml-3" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen((prev) => !prev)}
                  className={`group relative flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold text-white transition-all ${
                    dropdownOpen
                      ? "ring-2 ring-violet-400/60 shadow-lg shadow-violet-500/25"
                      : "ring-1 ring-white/15 hover:ring-2 hover:ring-violet-400/40 hover:shadow-lg hover:shadow-violet-500/15"
                  }`}
                  style={{
                    background: "linear-gradient(135deg, #3b82f6 0%, #7c3aed 50%, #a855f7 100%)",
                  }}
                  aria-label="User menu"
                >
                  {getInitials(user.name || user.username)}
                  {/* Online indicator */}
                  <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-black/80 bg-emerald-400" />
                </button>

                {/* Avatar dropdown */}
                {dropdownOpen && (
                  <div
                    data-dropdown-menu
                    className="absolute right-0 mt-2.5 w-80 origin-top-right overflow-hidden rounded-2xl border border-white/[0.08] bg-zinc-900/95 shadow-2xl shadow-black/40 backdrop-blur-2xl"
                  >
                    {/* Dropdown gradient accent */}
                    <div className="h-[2px] w-full bg-gradient-to-r from-blue-500 via-violet-500 to-fuchsia-500 opacity-50" />

                    {/* User info */}
                    <div className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow-lg shadow-violet-500/20"
                          style={{
                            background: "linear-gradient(135deg, #3b82f6 0%, #7c3aed 50%, #a855f7 100%)",
                          }}
                        >
                          {getInitials(user.name || user.username)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white truncate">
                            {user.name || user.username}
                          </p>
                          <p className="text-xs text-zinc-500 truncate">
                            {user.email}
                          </p>
                        </div>
                      </div>

                      {/* Stats pills */}
                      <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] font-medium capitalize text-zinc-300 ring-1 ring-white/[0.08]">
                          {user.role}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-1 text-[11px] font-medium text-blue-400 ring-1 ring-blue-500/20">
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                          </svg>
                          Lv. {user.level}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2.5 py-1 text-[11px] font-medium text-violet-400 ring-1 ring-violet-500/20">
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                          </svg>
                          {user.xp_total.toLocaleString()} XP
                        </span>
                      </div>

                      {/* XP Progress mini bar */}
                      <div className="mt-3">
                        <div className="h-1 rounded-full bg-zinc-800 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-blue-500 via-violet-500 to-fuchsia-500"
                            style={{ width: `${Math.min(100, (user.xp_total / 16000) * 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Logout */}
                    <div className="border-t border-white/[0.06] p-1.5">
                      <button
                        onClick={async () => {
                          setDropdownOpen(false);
                          await logout();
                          router.push("/");
                        }}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                        </svg>
                        Log out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="ml-4 flex items-center gap-2.5">
                <Link
                  href="/auth/login"
                  data-nav-link
                  className="rounded-lg px-3.5 py-1.5 text-sm font-medium text-zinc-400 transition-all hover:bg-white/[0.05] hover:text-white"
                >
                  Login
                </Link>
                <Link
                  ref={signUpMagneticRef}
                  href="/auth/register"
                  className="relative overflow-hidden rounded-full px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition-all hover:shadow-violet-500/30 hover:scale-[1.03] active:scale-[0.98]"
                  style={{
                    background: "linear-gradient(135deg, #3b82f6 0%, #7c3aed 50%, #a855f7 100%)",
                  }}
                >
                  <span className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(255,255,255,0.2),transparent)]" aria-hidden />
                  <span className="relative">Sign Up</span>
                </Link>
              </div>
            ))}
        </div>

        {/* Mobile hamburger */}
        <button
          data-mobile-toggle
          onClick={() => setMobileMenuOpen((prev) => !prev)}
          className={`flex h-9 w-9 items-center justify-center rounded-lg transition-all md:hidden ${
            mobileMenuOpen
              ? "bg-white/[0.08] text-white"
              : "text-zinc-400 hover:bg-white/[0.06] hover:text-white"
          }`}
          aria-label="Toggle menu"
        >
          <div className="relative h-5 w-5">
            <span
              className={`absolute left-0 top-[5px] h-[1.5px] w-5 bg-current transition-all duration-200 ${
                mobileMenuOpen ? "translate-y-[4.5px] rotate-45" : ""
              }`}
            />
            <span
              className={`absolute left-0 top-[14px] h-[1.5px] w-5 bg-current transition-all duration-200 ${
                mobileMenuOpen ? "-translate-y-[4.5px] -rotate-45" : ""
              }`}
            />
          </div>
        </button>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div
          ref={mobileMenuRef}
          className="border-t border-white/[0.06] bg-black/90 backdrop-blur-2xl md:hidden"
          style={{ animation: "navSlideDown 200ms ease-out" }}
        >
          <div className="space-y-0.5 px-3 py-3">
            {links.map((link) => {
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={handleNavClick}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                    active
                      ? "bg-violet-500/10 text-white shadow-[inset_0_0_0_1px_rgba(139,92,246,0.2)]"
                      : "text-zinc-400 hover:bg-white/[0.04] hover:text-white"
                  }`}
                >
                  <svg
                    className={`h-4.5 w-4.5 ${active ? "text-violet-400" : "text-zinc-500"}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d={link.icon} />
                  </svg>
                  {link.label}
                  {active && (
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-violet-400 shadow-[0_0_6px_rgba(139,92,246,0.8)]" />
                  )}
                </Link>
              );
            })}
          </div>

          {!loading && (
            <div className="border-t border-white/[0.06] px-3 py-3">
              {user ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 rounded-xl bg-white/[0.03] p-3">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold text-white"
                      style={{
                        background: "linear-gradient(135deg, #3b82f6 0%, #7c3aed 50%, #a855f7 100%)",
                      }}
                    >
                      {getInitials(user.name || user.username)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-white truncate">
                        {user.name || user.username}
                      </p>
                      <p className="text-xs text-zinc-500 truncate">{user.email}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 px-1">
                    <span className="inline-flex items-center rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] font-medium capitalize text-zinc-300 ring-1 ring-white/[0.08]">
                      {user.role}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-1 text-[11px] font-medium text-blue-400 ring-1 ring-blue-500/20">
                      Lv. {user.level}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2.5 py-1 text-[11px] font-medium text-violet-400 ring-1 ring-violet-500/20">
                      {user.xp_total.toLocaleString()} XP
                    </span>
                  </div>
                  <button
                    onClick={async () => {
                      handleNavClick();
                      await logout();
                      router.push("/");
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                    </svg>
                    Log out
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2.5">
                  <Link
                    href="/auth/login"
                    onClick={handleNavClick}
                    className="flex-1 rounded-xl border border-white/[0.08] py-2.5 text-center text-sm font-medium text-zinc-300 transition-colors hover:bg-white/[0.04] hover:text-white"
                  >
                    Login
                  </Link>
                  <Link
                    href="/auth/register"
                    onClick={handleNavClick}
                    className="flex-1 rounded-xl py-2.5 text-center text-sm font-medium text-white transition-all hover:brightness-110"
                    style={{
                      background: "linear-gradient(135deg, #3b82f6 0%, #7c3aed 50%, #a855f7 100%)",
                    }}
                  >
                    Sign Up
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <style jsx>{`
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
