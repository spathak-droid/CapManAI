import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";

// Mock next/navigation (ScenarioCard doesn't use it, but just in case)
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/scenario",
}));

import ScenarioCard from "@/components/ScenarioCard";
import type { Scenario } from "@/lib/types";

const mockScenario: Scenario = {
  situation:
    "AAPL is trading at $185.50 with elevated implied volatility ahead of earnings.",
  market_data: {
    symbol: "AAPL",
    price: 185.5,
    rsi_14: 62.3,
    volume: 85000000,
    avg_volume: 60000000,
    macd: 1.25,
    macd_signal: 0.8,
    price_history: [180, 182, 181, 184, 185.5],
  },
  question: "What options strategy would you use here?",
};

describe("ScenarioCard", () => {
  it("renders the scenario question", () => {
    render(<ScenarioCard scenario={mockScenario} />);
    expect(
      screen.getByText("What options strategy would you use here?")
    ).toBeInTheDocument();
  });

  it("renders the situation text", () => {
    render(<ScenarioCard scenario={mockScenario} />);
    expect(
      screen.getByText(mockScenario.situation)
    ).toBeInTheDocument();
  });

  it("renders the title with symbol", () => {
    render(<ScenarioCard scenario={mockScenario} />);
    expect(screen.getByText("Trading Analysis: AAPL")).toBeInTheDocument();
  });

  it("renders skill label when provided", () => {
    render(
      <ScenarioCard scenario={mockScenario} skillTarget="price_action" />
    );
    expect(screen.getByText("Price Action Analysis")).toBeInTheDocument();
  });

  it("renders complexity stars when provided", () => {
    const { container } = render(
      <ScenarioCard scenario={mockScenario} complexity={3} />
    );
    const starsContainer = container.querySelector('[aria-label="Complexity 3 of 5"]');
    expect(starsContainer).toBeInTheDocument();
  });

  it("shows hint button and reveals hint on click", async () => {
    const user = userEvent.setup();
    render(<ScenarioCard scenario={mockScenario} />);

    // Hint button should be visible
    const hintBtn = screen.getByText(/Show hint/);
    expect(hintBtn).toBeInTheDocument();

    await user.click(hintBtn);

    // After clicking, at least one hint should appear
    // The RSI hint should be present since RSI is 62.3 (neutral range)
    const rsiElements = screen.getAllByText(/RSI/);
    expect(rsiElements.length).toBeGreaterThanOrEqual(1);
  });
});
