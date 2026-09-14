// Agent activity — every action the agent took, with its context and intent.
// Mirrors GET /ai/agent/activity (agent.py). Rows are written by the executor
// for both allowed and denied actions, so this is a record of what was *asked*
// as well as what happened.
import { api, DEMO_MODE } from "./api";

export interface AgentAction {
  id: number;
  organization_id: number;
  event_id?: string | null;
  run_id?: string | null;
  domain?: string | null;
  tool?: string | null;
  intent?: string | null;
  params?: string | null;
  authorized?: boolean | null;
  actor_user_id?: number | null;
  actor_role?: string | null;
  actor_name?: string | null;
  actor_email?: string | null;
  context?: string[];
  status: string;
  error?: string | null;
  data_residency_mode?: string | null;
  created_at?: string | null;
  evidence_hash?: string | null;
  response_hash?: string | null;
}

export interface AgentActivityResponse {
  items: AgentAction[];
  total: number;
  limit: number;
  offset: number;
  summary?: { returned?: number; denied_or_failed?: number };
}

export interface AgentActivityFilter {
  status?: string;
  domain?: string;
  tool?: string;
  run_id?: string;
  limit?: number;
  offset?: number;
}

export function buildAgentActivityQuery(filter: AgentActivityFilter): string {
  const q = new URLSearchParams();
  if (filter.status) q.set("status", filter.status);
  if (filter.domain) q.set("domain", filter.domain);
  if (filter.tool) q.set("tool", filter.tool);
  if (filter.run_id) q.set("run_id", filter.run_id);
  if (filter.limit != null) q.set("limit", String(filter.limit));
  if (filter.offset != null) q.set("offset", String(filter.offset));
  const s = q.toString();
  return s ? `?${s}` : "";
}

export async function loadAgentActivity(filter: AgentActivityFilter = {}) {
  // Unauthenticated in demo mode --- a real fetch here 401s against the proxied
  // backend and the global 401 handler signs the whole demo session out.
  if (DEMO_MODE) return { items: [], total: 0, limit: filter.limit ?? 0, offset: filter.offset ?? 0 } as AgentActivityResponse;
  return api.get<AgentActivityResponse>(`/ai/agent/activity${buildAgentActivityQuery(filter)}`);
}

/** A denial reason is a control working, not a bug. */
export function isDenied(row: AgentAction): boolean {
  return String(row.status || "").toLowerCase() === "failed";
}
