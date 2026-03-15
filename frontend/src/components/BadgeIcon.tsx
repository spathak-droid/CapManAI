"use client";

interface BadgeIconProps {
  badgeKey: string;
  category: "level" | "streak" | "mastery" | "milestone";
  earned: boolean;
  size?: number;
}

/** Render a unique inline SVG badge based on category + key. Grayscale when not earned. */
export default function BadgeIcon({
  badgeKey,
  category,
  earned,
  size = 48,
}: BadgeIconProps) {
  const grayscale = !earned
    ? "grayscale opacity-35"
    : "";
  const glow = earned ? getGlowFilter(category, badgeKey) : "";

  return (
    <div
      className={`inline-flex items-center justify-center ${grayscale}`}
      style={{ width: size, height: size, filter: glow }}
    >
      {category === "level" && <LevelBadge badgeKey={badgeKey} size={size} />}
      {category === "streak" && <StreakBadge badgeKey={badgeKey} size={size} />}
      {category === "milestone" && <MilestoneBadge badgeKey={badgeKey} size={size} />}
      {category === "mastery" && <MasteryBadge badgeKey={badgeKey} size={size} />}
    </div>
  );
}

function getGlowFilter(category: string, badgeKey: string): string {
  if (category === "level") {
    if (badgeKey.includes("10")) return "drop-shadow(0 0 6px rgba(226,232,240,0.5))";
    if (badgeKey.includes("8")) return "drop-shadow(0 0 6px rgba(250,204,21,0.4))";
    if (badgeKey.includes("5")) return "drop-shadow(0 0 6px rgba(168,85,247,0.4))";
    return "drop-shadow(0 0 5px rgba(59,130,246,0.35))";
  }
  if (category === "streak") {
    if (badgeKey.includes("30")) return "drop-shadow(0 0 6px rgba(147,197,253,0.5))";
    if (badgeKey.includes("7")) return "drop-shadow(0 0 6px rgba(239,68,68,0.4))";
    return "drop-shadow(0 0 5px rgba(249,115,22,0.35))";
  }
  if (category === "milestone") return "drop-shadow(0 0 5px rgba(34,197,94,0.3))";
  return "drop-shadow(0 0 5px rgba(139,92,246,0.3))";
}

/* ─── Level Badge: Shield with star & number ─── */
function LevelBadge({ badgeKey, size }: { badgeKey: string; size: number }) {
  const levelNum = parseInt(badgeKey.replace(/\D/g, ""), 10) || 1;
  const [c1, c2] = getLevelColors(levelNum);
  const id = `lvl-${badgeKey}`;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor={c1} />
          <stop offset="1" stopColor={c2} />
        </linearGradient>
      </defs>
      {/* Shield shape */}
      <path
        d="M24 4L6 12v12c0 10.5 7.8 20.3 18 22 10.2-1.7 18-11.5 18-22V12L24 4z"
        fill={`url(#${id})`}
        fillOpacity={0.9}
        stroke={c1}
        strokeWidth={1.2}
        strokeOpacity={0.6}
      />
      {/* Inner star */}
      <path
        d="M24 14l2.35 4.76 5.25.77-3.8 3.7.9 5.23L24 26.12l-4.7 2.34.9-5.23-3.8-3.7 5.25-.77L24 14z"
        fill="white"
        fillOpacity={0.85}
      />
      {/* Level number */}
      <text
        x="24"
        y="42"
        textAnchor="middle"
        fontSize="8"
        fontWeight="bold"
        fill="white"
        fillOpacity={0.9}
        fontFamily="system-ui, sans-serif"
      >
        Lv.{levelNum}
      </text>
    </svg>
  );
}

function getLevelColors(level: number): [string, string] {
  if (level >= 10) return ["#e2e8f0", "#94a3b8"]; // platinum
  if (level >= 8) return ["#facc15", "#ca8a04"];   // gold
  if (level >= 5) return ["#a855f7", "#7c3aed"];   // purple
  return ["#3b82f6", "#2563eb"];                     // blue
}

/* ─── Streak Badge: Flame icon ─── */
function StreakBadge({ badgeKey, size }: { badgeKey: string; size: number }) {
  const days = parseInt(badgeKey.replace(/\D/g, ""), 10) || 3;
  const id = `strk-${badgeKey}`;

  let colors: [string, string, string];
  if (days >= 30) {
    colors = ["#93c5fd", "#60a5fa", "#dbeafe"]; // blue/white (hottest)
  } else if (days >= 7) {
    colors = ["#ef4444", "#dc2626", "#fca5a5"]; // red
  } else {
    colors = ["#f97316", "#ea580c", "#fdba74"]; // orange
  }

  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={id} x1="24" y1="6" x2="24" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor={colors[2]} />
          <stop offset="0.5" stopColor={colors[0]} />
          <stop offset="1" stopColor={colors[1]} />
        </linearGradient>
        {days >= 7 && (
          <radialGradient id={`${id}-glow`} cx="50%" cy="30%" r="50%">
            <stop stopColor={colors[2]} stopOpacity={0.6} />
            <stop offset="1" stopColor={colors[0]} stopOpacity={0} />
          </radialGradient>
        )}
      </defs>
      {days >= 7 && (
        <circle cx="24" cy="22" r="16" fill={`url(#${id}-glow)`} />
      )}
      {/* Flame */}
      <path
        d="M24 6c0 0-10 10-10 20a10 10 0 0020 0c0-4-2-8-4-11-1 3-3 5-6 5 0-6 0-10.5 0-14z"
        fill={`url(#${id})`}
      />
      {/* Inner flame */}
      <path
        d="M24 22c0 0-4 4-4 9a4 4 0 008 0c0-2-1-4-2-5.5-.4 1.2-1.2 2-2.4 2 0-2.5 0-4 .4-5.5z"
        fill="white"
        fillOpacity={0.7}
      />
      {/* Day count */}
      <text
        x="24"
        y="46"
        textAnchor="middle"
        fontSize="7"
        fontWeight="bold"
        fill={colors[0]}
        fontFamily="system-ui, sans-serif"
      >
        {days}d
      </text>
    </svg>
  );
}

/* ─── Milestone Badges ─── */
function MilestoneBadge({ badgeKey, size }: { badgeKey: string; size: number }) {
  const key = badgeKey.toLowerCase();

  if (key.includes("foundation") || key.includes("finisher")) {
    return <RibbonMedal size={size} color1="#22c55e" color2="#16a34a" />;
  }
  if (key.includes("capstone") || key.includes("complete")) {
    return <Trophy size={size} />;
  }
  if (key.includes("first") || key.includes("trade")) {
    return <LightningCircle size={size} />;
  }
  if (key.includes("champion") || key.includes("sword")) {
    return <CrossedSwords size={size} />;
  }
  if (key.includes("mentor") || key.includes("peer")) {
    return <Handshake size={size} />;
  }
  // Fallback: generic medal
  return <RibbonMedal size={size} color1="#a855f7" color2="#7c3aed" />;
}

function RibbonMedal({ size, color1, color2 }: { size: number; color1: string; color2: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="rm-g" x1="24" y1="4" x2="24" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor={color1} />
          <stop offset="1" stopColor={color2} />
        </linearGradient>
      </defs>
      {/* Ribbons */}
      <path d="M18 28l-5 16 5-4 4 4-2-12" fill={color1} fillOpacity={0.7} />
      <path d="M30 28l5 16-5-4-4 4 2-12" fill={color2} fillOpacity={0.7} />
      {/* Medal circle */}
      <circle cx="24" cy="20" r="14" fill="url(#rm-g)" />
      <circle cx="24" cy="20" r="10.5" fill="none" stroke="white" strokeWidth={1} strokeOpacity={0.4} />
      {/* Star in center */}
      <path
        d="M24 12l2 4.1 4.5.65-3.25 3.17.77 4.48L24 22.2l-4.02 2.2.77-4.48-3.25-3.17 4.5-.65L24 12z"
        fill="white"
        fillOpacity={0.85}
      />
    </svg>
  );
}

function Trophy({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="tr-g" x1="24" y1="4" x2="24" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fbbf24" />
          <stop offset="1" stopColor="#b45309" />
        </linearGradient>
      </defs>
      {/* Cup */}
      <path
        d="M14 8h20v2c0 8-4 16-10 18-6-2-10-10-10-18V8z"
        fill="url(#tr-g)"
      />
      {/* Handles */}
      <path d="M14 12H9c0 5 2 8 5 9v-9z" fill="#fbbf24" fillOpacity={0.6} />
      <path d="M34 12h5c0 5-2 8-5 9v-9z" fill="#fbbf24" fillOpacity={0.6} />
      {/* Stem and base */}
      <rect x="22" y="28" width="4" height="6" rx="1" fill="#ca8a04" />
      <rect x="16" y="34" width="16" height="4" rx="2" fill="#ca8a04" />
      {/* Star on cup */}
      <path
        d="M24 12l1.5 3 3.3.5-2.4 2.3.56 3.3L24 19.4l-2.96 1.7.56-3.3-2.4-2.3 3.3-.5L24 12z"
        fill="white"
        fillOpacity={0.8}
      />
      {/* Top rim */}
      <rect x="13" y="6" width="22" height="3" rx="1.5" fill="#fde68a" />
    </svg>
  );
}

function LightningCircle({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="lc-g" x1="24" y1="4" x2="24" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3b82f6" />
          <stop offset="1" stopColor="#6366f1" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="20" fill="url(#lc-g)" />
      <circle cx="24" cy="24" r="16" fill="none" stroke="white" strokeWidth={1} strokeOpacity={0.25} />
      {/* Lightning bolt */}
      <path
        d="M26 8L16 26h7l-2 14 12-20h-8l1-12z"
        fill="#fbbf24"
      />
      <path
        d="M25.5 10L17 25h6l-1.5 11 9.5-16H25l.5-10z"
        fill="white"
        fillOpacity={0.5}
      />
    </svg>
  );
}

function CrossedSwords({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="cs-g" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f43f5e" />
          <stop offset="1" stopColor="#be123c" />
        </linearGradient>
      </defs>
      {/* Background circle */}
      <circle cx="24" cy="24" r="20" fill="url(#cs-g)" fillOpacity={0.9} />
      {/* Sword 1 (top-left to bottom-right) */}
      <line x1="12" y1="12" x2="36" y2="36" stroke="#e2e8f0" strokeWidth={2.5} strokeLinecap="round" />
      <line x1="12" y1="12" x2="18" y2="12" stroke="#e2e8f0" strokeWidth={2} strokeLinecap="round" />
      <line x1="12" y1="12" x2="12" y2="18" stroke="#e2e8f0" strokeWidth={2} strokeLinecap="round" />
      {/* Guard 1 */}
      <line x1="15" y1="19" x2="19" y2="15" stroke="#fbbf24" strokeWidth={2.5} strokeLinecap="round" />
      {/* Sword 2 (top-right to bottom-left) */}
      <line x1="36" y1="12" x2="12" y2="36" stroke="#e2e8f0" strokeWidth={2.5} strokeLinecap="round" />
      <line x1="36" y1="12" x2="30" y2="12" stroke="#e2e8f0" strokeWidth={2} strokeLinecap="round" />
      <line x1="36" y1="12" x2="36" y2="18" stroke="#e2e8f0" strokeWidth={2} strokeLinecap="round" />
      {/* Guard 2 */}
      <line x1="29" y1="15" x2="33" y2="19" stroke="#fbbf24" strokeWidth={2.5} strokeLinecap="round" />
    </svg>
  );
}

function Handshake({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="hs-g" x1="4" y1="24" x2="44" y2="24" gradientUnits="userSpaceOnUse">
          <stop stopColor="#06b6d4" />
          <stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="20" fill="url(#hs-g)" fillOpacity={0.9} />
      {/* Left hand */}
      <path
        d="M8 24c3-2 6-4 10-4 2 0 3 1 4 2l4-3c2-1.5 4-1 5.5 0L34 22"
        stroke="white"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Right arm and clasp */}
      <path
        d="M40 24c-3-2-6-4-10-4"
        stroke="white"
        strokeWidth={2.5}
        strokeLinecap="round"
        fill="none"
      />
      {/* Handshake clasp */}
      <path
        d="M18 22l4.5 4.5c1 1 2.5 1 3.5 0l3-3"
        stroke="white"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Arm lines */}
      <path d="M8 24H14" stroke="white" strokeWidth={2.5} strokeLinecap="round" />
      <path d="M34 24H40" stroke="white" strokeWidth={2.5} strokeLinecap="round" />
      {/* Small heart above */}
      <path
        d="M24 14c-1-2-4-2-4 0 0 1.5 4 4 4 4s4-2.5 4-4c0-2-3-2-4 0z"
        fill="#fbbf24"
        fillOpacity={0.8}
      />
    </svg>
  );
}

/* ─── Mastery Badge: Hexagon with skill icon ─── */
function MasteryBadge({ badgeKey, size }: { badgeKey: string; size: number }) {
  const key = badgeKey.toLowerCase();
  const color = getMasteryColor(key);
  const id = `mst-${badgeKey.replace(/[^a-zA-Z0-9]/g, "")}`;

  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={id} x1="24" y1="4" x2="24" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor={color} />
          <stop offset="1" stopColor={color} stopOpacity={0.6} />
        </linearGradient>
      </defs>
      {/* Hexagon */}
      <path
        d="M24 4L42 14v20L24 44 6 34V14L24 4z"
        fill={`url(#${id})`}
        fillOpacity={0.85}
      />
      <path
        d="M24 4L42 14v20L24 44 6 34V14L24 4z"
        fill="none"
        stroke="white"
        strokeWidth={1}
        strokeOpacity={0.2}
      />
      {/* Inner hexagon */}
      <path
        d="M24 10L36 17v14L24 38 12 31V17L24 10z"
        fill="none"
        stroke="white"
        strokeWidth={0.8}
        strokeOpacity={0.15}
      />
      {/* Center skill icon: simplified star/diamond */}
      <path
        d="M24 16l2.5 5 5.5.8-4 3.9.94 5.5L24 28.5l-4.94 2.7.94-5.5-4-3.9 5.5-.8L24 16z"
        fill="white"
        fillOpacity={0.8}
      />
    </svg>
  );
}

function getMasteryColor(key: string): string {
  if (key.includes("price")) return "#3b82f6";
  if (key.includes("option")) return "#8b5cf6";
  if (key.includes("strike")) return "#ec4899";
  if (key.includes("risk")) return "#ef4444";
  if (key.includes("position")) return "#f97316";
  if (key.includes("regime")) return "#22c55e";
  if (key.includes("vol")) return "#06b6d4";
  if (key.includes("trade")) return "#eab308";
  return "#a855f7";
}
