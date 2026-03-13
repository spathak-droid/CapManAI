import { auth } from "./firebase";
import type {
  AuthUser,
  Scenario,
  ScenarioParams,
  Grade,
  ProbeResponse,
  ProbeExchange,
  LeaderboardEntry,
  ClassOverview,
  StudentTierInfo,
} from "./types";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_URL}${path}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  const currentUser = auth.currentUser;
  if (currentUser) {
    const token = await currentUser.getIdToken();
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, { ...options, headers });

  if (!res.ok) {
    const body = await res.text().catch(() => "Unknown error");
    throw new ApiError(res.status, body);
  }

  return res.json() as Promise<T>;
}

export async function generateScenario(
  params?: Partial<ScenarioParams>,
): Promise<Scenario> {
  const body: ScenarioParams = {
    market_regime: params?.market_regime ?? "bull",
    instrument_type: params?.instrument_type ?? "equity",
    complexity: params?.complexity ?? 2,
    skill_target: params?.skill_target ?? "price_action",
  };
  return request<Scenario>("/api/scenarios/generate", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function submitResponse(
  scenarioText: string,
  analysis: string,
): Promise<ProbeResponse> {
  return request<ProbeResponse>("/api/scenarios/probe", {
    method: "POST",
    body: JSON.stringify({
      scenario_text: scenarioText,
      student_response: analysis,
      num_probes: 2,
    }),
  });
}

export async function submitProbeResponse(
  scenarioText: string,
  studentResponse: string,
  probeExchanges: ProbeExchange[],
): Promise<Grade> {
  return request<Grade>("/api/scenarios/grade", {
    method: "POST",
    body: JSON.stringify({
      response_id: 0, // placeholder — backend may assign
      scenario_text: scenarioText,
      student_response: studentResponse,
      probe_exchanges: probeExchanges,
    }),
  });
}

export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  return request<LeaderboardEntry[]>("/api/leaderboard?limit=20");
}

export async function fetchDashboardOverview(): Promise<ClassOverview> {
  return request<ClassOverview>("/api/dashboard/overview");
}

export async function fetchMTSSTiers(): Promise<StudentTierInfo[]> {
  return request<StudentTierInfo[]>("/api/mtss/tiers");
}

export async function fetchCurrentUser(): Promise<AuthUser> {
  return request<AuthUser>("/api/auth/me");
}

export async function updateRole(role: string): Promise<AuthUser> {
  return request<AuthUser>("/api/auth/me/role", {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
}

export { ApiError };
