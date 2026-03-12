// --- Scenario Types (aligned with backend API) ---

export interface ScenarioParams {
  market_regime: "bull" | "bear" | "sideways" | "volatile";
  instrument_type: "equity" | "option" | "both";
  complexity: number; // 1-5
  skill_target:
    | "price_action"
    | "options_chain"
    | "strike_select"
    | "risk_mgmt"
    | "position_size"
    | "regime_id"
    | "vol_assess"
    | "trade_mgmt";
}

export interface Scenario {
  situation: string;
  market_data: Record<string, unknown>;
  question: string;
}

export interface ProbeResponse {
  questions: string[];
}

export interface ProbeExchange {
  question: string;
  answer: string;
}

export interface GradeRequest {
  response_id: number;
  scenario_text: string;
  student_response: string;
  probe_exchanges: ProbeExchange[];
}

export interface Grade {
  technical_accuracy: number;
  risk_awareness: number;
  strategy_fit: number;
  reasoning_clarity: number;
  overall_score: number;
  feedback_text: string;
  xp_earned: number;
}

export interface LeaderboardEntry {
  user_id: number;
  username: string;
  xp_total: number;
  level: number;
  rank: number;
}

// --- Dashboard / MTSS Types (aligned with backend API) ---

/** GET /api/dashboard/overview response */
export interface ClassOverview {
  tier_counts: Record<string, number>;
  students_by_tier: Record<string, string[]>;
  skill_breakdown: Record<string, Record<string, number>>;
}

/** GET /api/mtss/tiers response item */
export interface StudentTierInfo {
  user_id: number;
  username: string;
  overall_tier: string;
  avg_score: number;
  skill_tiers: Record<string, string>;
}
