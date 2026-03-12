import type {
  Scenario,
  Grade,
  ProbeQuestion,
  LeaderboardEntry,
  DashboardOverview,
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
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "Unknown error");
    throw new ApiError(res.status, body);
  }

  return res.json() as Promise<T>;
}

export async function generateScenario(params?: {
  topic?: string;
  difficulty?: string;
}): Promise<Scenario> {
  return request<Scenario>("/api/scenarios/generate", {
    method: "POST",
    body: JSON.stringify(params ?? {}),
  });
}

export async function submitResponse(
  scenarioId: string,
  analysis: string,
): Promise<ProbeQuestion> {
  return request<ProbeQuestion>(`/api/scenarios/${scenarioId}/respond`, {
    method: "POST",
    body: JSON.stringify({ analysis }),
  });
}

export async function submitProbeResponse(
  scenarioId: string,
  answer: string,
): Promise<Grade> {
  return request<Grade>(`/api/scenarios/${scenarioId}/probe`, {
    method: "POST",
    body: JSON.stringify({ answer }),
  });
}

export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  return request<LeaderboardEntry[]>("/api/leaderboard");
}

export async function fetchDashboardOverview(): Promise<DashboardOverview> {
  return request<DashboardOverview>("/api/dashboard/overview");
}

export { ApiError };
