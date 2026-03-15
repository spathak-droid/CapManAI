import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/leaderboard",
}));

// Mock hooks
vi.mock("@/lib/hooks", () => ({
  useLeaderboard: () => ({ data: [], error: null, isLoading: false, mutate: vi.fn() }),
  useDynamicLeaderboard: () => ({ data: [], error: null, isLoading: false, mutate: vi.fn() }),
  useMyRank: () => ({ data: null, mutate: vi.fn() }),
}));

// Mock useRealtimeEvent
vi.mock("@/lib/useRealtimeEvent", () => ({
  useRealtimeEvent: vi.fn(),
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

// Mock AuthContext
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: 1, username: "testuser", email: "test@test.com", name: "Test", role: "student", xp_total: 100, level: 1 },
    loading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    refetchUser: vi.fn(),
  }),
}));

// Mock the skeleton
vi.mock("@/components/skeletons/LeaderboardSkeleton", () => ({
  LeaderboardSkeleton: () => <div data-testid="skeleton">Loading...</div>,
}));

import LeaderboardPage from "@/app/leaderboard/page";

describe("LeaderboardPage", () => {
  it("renders the page heading", () => {
    render(<LeaderboardPage />);
    expect(screen.getByText("Leaderboard")).toBeInTheDocument();
  });

  it("renders all three sort tabs", () => {
    render(<LeaderboardPage />);
    const buttons = screen.getAllByRole("button");
    const tabLabels = buttons.map((b) => b.textContent);
    expect(tabLabels).toContain("Composite");
    expect(tabLabels).toContain("Mastery");
    expect(tabLabels).toContain("XP");
  });

  it("renders the tab buttons as clickable elements", () => {
    render(<LeaderboardPage />);
    const buttons = screen.getAllByRole("button");
    const compositeBtn = buttons.find((b) => b.textContent === "Composite");
    expect(compositeBtn).toBeDefined();
    expect(compositeBtn!.tagName).toBe("BUTTON");
  });

  it("shows empty state message when no entries", () => {
    render(<LeaderboardPage />);
    expect(
      screen.getByText("No entries yet. Be the first to train and earn XP!")
    ).toBeInTheDocument();
  });
});
