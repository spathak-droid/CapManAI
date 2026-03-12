export interface MarketData {
  asset: string;
  price: number;
  change_percent: number;
  volume: string;
  high: number;
  low: number;
}

export interface Scenario {
  id: string;
  situation: string;
  market_data: MarketData[];
  question: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  topic: string;
  created_at: string;
}

export interface ScenarioResponse {
  id: string;
  scenario_id: string;
  user_id: string;
  analysis: string;
  submitted_at: string;
}

export interface ProbeQuestion {
  id: string;
  scenario_id: string;
  question: string;
}

export interface GradeDimension {
  name: string;
  score: number;
  max_score: number;
  feedback: string;
}

export interface Grade {
  overall_score: number;
  dimensions: GradeDimension[];
  feedback: string;
  xp_earned: number;
}

export interface User {
  id: string;
  username: string;
  email: string;
  xp: number;
  level: number;
  tier: 1 | 2 | 3;
  created_at: string;
}

export interface SkillScore {
  skill: string;
  score: number;
  max_score: number;
  attempts: number;
}

export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  username: string;
  xp: number;
  level: number;
}

export interface MTSSTier {
  tier: 1 | 2 | 3;
  label: string;
  count: number;
  students: MTSSStudent[];
}

export interface MTSSStudent {
  user_id: string;
  username: string;
  tier: 1 | 2 | 3;
  xp: number;
  level: number;
  skills: SkillScore[];
}

export interface DashboardOverview {
  total_students: number;
  tiers: MTSSTier[];
  skill_names: string[];
}
