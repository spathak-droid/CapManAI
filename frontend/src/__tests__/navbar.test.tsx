import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/",
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// Mock gsap
vi.mock("@/lib/gsap", () => {
  const refFn = () => ({ current: null });
  return {
    useTextReveal: refFn,
    usePopIn: refFn,
    useScrollReveal: refFn,
    useMagneticHover: refFn,
    useStaggerReveal: refFn,
    useCountUp: refFn,
    useProgressFill: refFn,
    useParallax: refFn,
    gsap: {
      from: vi.fn(),
      to: vi.fn(() => ({ kill: vi.fn(), scrollTrigger: { kill: vi.fn() } })),
      set: vi.fn(),
      fromTo: vi.fn(),
      context: vi.fn(() => ({ revert: vi.fn() })),
      registerPlugin: vi.fn(),
    },
    ScrollTrigger: {},
  };
});

// Mock AuthContext - logged out state
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    refetchUser: vi.fn(),
  }),
}));

import NavBar from "@/components/NavBar";

describe("NavBar", () => {
  it("renders without crashing", () => {
    render(<NavBar />);
    // The logo image should be present
    expect(screen.getByAltText("CapMan AI")).toBeInTheDocument();
  });

  it("shows Login and Sign Up links when logged out", () => {
    render(<NavBar />);
    expect(screen.getByText("Login")).toBeInTheDocument();
    expect(screen.getByText("Sign Up")).toBeInTheDocument();
  });

  it("shows public navigation links when logged out", () => {
    render(<NavBar />);
    // Public links: Home and About
    expect(screen.getAllByText("Home").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("About").length).toBeGreaterThanOrEqual(1);
  });
});
