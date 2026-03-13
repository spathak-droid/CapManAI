"use client";

import { useState } from "react";
import type { Scenario, ScenarioParams } from "@/lib/types";

// ── Skill label map ──────────────────────────────────────────────────────────
const SKILL_LABELS: Record<ScenarioParams["skill_target"], string> = {
  price_action: "Price Action Analysis",
  options_chain: "Options Chain Analysis",
  strike_select: "Strike Selection",
  risk_mgmt: "Risk Management",
  position_size: "Position Sizing",
  regime_id: "Regime Identification",
  vol_assess: "Implied Volatility (IV) Analysis",
  trade_mgmt: "Trade Management",
};

// ── Key market data fields to surface as stat pills ─────────────────────────
const KEY_FIELDS = [
  "symbol",
  "price",
  "current_price",
  "close",
  "last_price",
  "volume",
  "rsi_14",
  "rsi",
  "macd",
  "macd_signal",
  "iv",
  "implied_volatility",
  "beta",
  "avg_volume",
  "market_cap",
  "sector",
];

function formatStatLabel(key: string): string {
  const overrides: Record<string, string> = {
    rsi_14: "RSI (14)",
    rsi: "RSI",
    macd: "MACD",
    macd_signal: "MACD Signal",
    iv: "IV",
    implied_volatility: "Impl. Vol",
    avg_volume: "Avg Vol",
    market_cap: "Mkt Cap",
  last_price: "Price",
  current_price: "Price",
  close: "Close",
  };
  return overrides[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatStatValue(value: unknown): string {
  if (value === null || value === undefined) return "N/A";
  if (typeof value === "number") {
    if (Math.abs(value) >= 1_000_000_000)
      return `${(value / 1_000_000_000).toFixed(1)}B`;
    if (Math.abs(value) >= 1_000_000)
      return `${(value / 1_000_000).toFixed(1)}M`;
    if (Math.abs(value) >= 1_000)
      return `${(value / 1_000).toFixed(1)}K`;
    return value % 1 === 0 ? String(value) : value.toFixed(2);
  }
  return String(value);
}

// ── SVG price chart ──────────────────────────────────────────────────────────
function PriceChart({ prices }: { prices: number[] }) {
  if (!prices || prices.length < 2) return null;

  const W = 600;
  const H = 180;
  const PAD = { top: 16, right: 16, bottom: 16, left: 16 };

  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const range = maxP - minP || 1;

  const toX = (i: number) =>
    PAD.left + (i / (prices.length - 1)) * (W - PAD.left - PAD.right);
  const toY = (p: number) =>
    PAD.top + (1 - (p - minP) / range) * (H - PAD.top - PAD.bottom);

  const points = prices.map((p, i) => `${toX(i)},${toY(p)}`).join(" ");

  // Close the fill path: go to bottom-right then bottom-left
  const lastX = toX(prices.length - 1);
  const firstX = toX(0);
  const bottomY = H - PAD.bottom;
  const fillPoints = `${points} ${lastX},${bottomY} ${firstX},${bottomY}`;

  // Subtle horizontal grid lines (3 lines)
  const gridYs = [0.25, 0.5, 0.75].map(
    (frac) => PAD.top + frac * (H - PAD.top - PAD.bottom)
  );

  const isPositive =
    prices[prices.length - 1] >= prices[0];

  const lineColor = isPositive ? "#818cf8" : "#f87171";
  // Stable ID derived from the first and last price values so it never changes
  // during re-renders for the same data set.
  const gradientId = `chart-fill-${prices[0]}-${prices[prices.length - 1]}-${prices.length}`;

  return (
    <div className="rounded-xl bg-zinc-950/50 p-3">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height: 160 }}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity="0.25" />
            <stop offset="100%" stopColor={lineColor} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {gridYs.map((y, i) => (
          <line
            key={i}
            x1={PAD.left}
            y1={y}
            x2={W - PAD.right}
            y2={y}
            stroke="rgba(255,255,255,0.04)"
            strokeWidth="1"
          />
        ))}

        {/* Fill area */}
        <polygon points={fillPoints} fill={`url(#${gradientId})`} />

        {/* Price line */}
        <polyline
          points={points}
          fill="none"
          stroke={lineColor}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Start dot */}
        <circle cx={toX(0)} cy={toY(prices[0])} r="3" fill={lineColor} opacity="0.6" />
        {/* End dot */}
        <circle
          cx={toX(prices.length - 1)}
          cy={toY(prices[prices.length - 1])}
          r="4"
          fill={lineColor}
        />
      </svg>
      <p className="mt-1 text-center text-xs text-zinc-600 tracking-wider uppercase">
        Market Context (Simulated)
      </p>
    </div>
  );
}

// ── Stat pill ────────────────────────────────────────────────────────────────
function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-white/[0.06] bg-zinc-800/40 px-3 py-2">
      <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      <span className="text-sm font-semibold text-white">{value}</span>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function extractTitle(situation: string, symbol?: string): string {
  if (symbol) return `Trading Analysis: ${symbol}`;
  const first = situation.split(/[.!?]/)[0]?.trim();
  if (first && first.length <= 80) return first;
  return situation.slice(0, 60).trim() + "…";
}

function buildHints(marketData: Record<string, unknown>): string[] {
  const hints: string[] = [];

  const rsi =
    marketData["rsi_14"] ?? marketData["rsi"];
  if (typeof rsi === "number") {
    if (rsi > 70)
      hints.push(`Consider the RSI reading of ${rsi.toFixed(1)} — the asset may be overbought.`);
    else if (rsi < 30)
      hints.push(`Consider the RSI reading of ${rsi.toFixed(1)} — the asset may be oversold.`);
    else
      hints.push(`The RSI is at ${rsi.toFixed(1)}, within a neutral range. Look for directional confirmation.`);
  }

  const vol = marketData["volume"] ?? marketData["avg_volume"];
  const avgVol = marketData["avg_volume"];
  if (typeof vol === "number" && typeof avgVol === "number" && avgVol > 0) {
    const ratio = vol / avgVol;
    hints.push(
      `Volume is ${ratio > 1 ? "above" : "below"} average (${(ratio * 100).toFixed(0)}% of avg). ${
        ratio > 1.5 ? "High volume can confirm breakouts." : "Lower volume may signal weak conviction."
      }`
    );
  } else if (typeof vol === "number") {
    hints.push(`Total volume is ${formatStatValue(vol)}. Compare this to historical norms to gauge participation.`);
  }

  const macd = marketData["macd"];
  const macdSignal = marketData["macd_signal"];
  if (typeof macd === "number" && typeof macdSignal === "number") {
    const cross = macd > macdSignal ? "bullish" : "bearish";
    hints.push(`MACD (${macd.toFixed(2)}) is ${cross === "bullish" ? "above" : "below"} its signal (${macdSignal.toFixed(2)}), a ${cross} signal.`);
  } else if (typeof macd === "number") {
    hints.push(`MACD value is ${macd.toFixed(2)}. Look for a signal-line crossover to confirm momentum.`);
  }

  // Fallback hints if we couldn't extract enough
  if (hints.length < 1)
    hints.push("Review the price history for trend direction and momentum clues.");
  if (hints.length < 2)
    hints.push("Consider how market regime and volatility context affect optimal position sizing.");
  if (hints.length < 3)
    hints.push("Think about risk/reward ratio and where you would place stops before entering.");

  return hints.slice(0, 3);
}

// ── Main component ───────────────────────────────────────────────────────────
interface ScenarioCardProps {
  scenario: Scenario;
  skillTarget?: ScenarioParams["skill_target"];
  complexity?: number;
}

export default function ScenarioCard({
  scenario,
  skillTarget,
  complexity,
}: ScenarioCardProps) {
  const [hintsShown, setHintsShown] = useState(0);

  // Flatten market_data one level for easier access
  const md = scenario.market_data as Record<string, unknown>;

  // Price history
  const priceHistory: number[] = Array.isArray(md["price_history"])
    ? (md["price_history"] as unknown[]).filter((v): v is number => typeof v === "number")
    : [];

  // Symbol
  const symbol =
    typeof md["symbol"] === "string" ? md["symbol"] : undefined;

  // Key stats (filter to known important fields present in data)
  const statEntries = KEY_FIELDS.flatMap((key) => {
    const val = md[key];
    if (val === undefined || val === null || key === "price_history") return [];
    return [{ label: formatStatLabel(key), value: formatStatValue(val) }];
  });

  const title = extractTitle(scenario.situation, symbol);
  const hints = buildHints(md);

  const skillLabel =
    skillTarget && SKILL_LABELS[skillTarget] ? SKILL_LABELS[skillTarget] : null;

  return (
    <div className="card-glow p-6 space-y-5">
      {/* ── Header row: badge + stars ── */}
      <div className="flex items-start justify-between gap-4">
        {skillLabel ? (
          <span className="inline-flex items-center rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-400 tracking-wide">
            {skillLabel}
          </span>
        ) : (
          <span />
        )}

        {typeof complexity === "number" && (
          <div className="flex items-center gap-0.5 shrink-0" aria-label={`Complexity ${complexity} of 5`}>
            {[1, 2, 3, 4, 5].map((n) => (
              <span
                key={n}
                className={n <= complexity ? "text-amber-400" : "text-zinc-600"}
                style={{ fontSize: 16, lineHeight: 1 }}
              >
                ★
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Title ── */}
      <h2 className="text-xl font-bold text-white leading-snug">{title}</h2>

      {/* ── Situation narrative ── */}
      <p className="leading-relaxed text-zinc-300">{scenario.situation}</p>

      {/* ── Price chart ── */}
      {priceHistory.length >= 2 && <PriceChart prices={priceHistory} />}

      {/* ── Stat pills grid ── */}
      {statEntries.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {statEntries.slice(0, 8).map(({ label, value }) => (
            <StatPill key={label} label={label} value={value} />
          ))}
        </div>
      )}

      {/* ── Divider ── */}
      <div className="border-t border-white/[0.06]" />

      {/* ── Question ── */}
      <p className="text-lg font-semibold leading-snug text-white">
        {scenario.question}
      </p>

      {/* ── Hints ── */}
      <div className="space-y-2">
        {hints.slice(0, hintsShown).map((hint, i) => (
          <div
            key={i}
            className="flex gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-sm text-amber-200"
          >
            <span className="shrink-0">💡</span>
            <span>{hint}</span>
          </div>
        ))}

        {hintsShown < hints.length && (
          <button
            onClick={() => setHintsShown((n) => n + 1)}
            className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors underline-offset-2 hover:underline"
          >
            💡 Show hint ({hintsShown + 1}/{hints.length}) — costs 20% XP per hint
          </button>
        )}
      </div>
    </div>
  );
}
