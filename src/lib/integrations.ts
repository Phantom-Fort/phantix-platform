// ── Integrations Hub data layer (platform-app) ───────────────────────────────
// Mirrors app/engines/control_plane/integrations (catalog + hub + sso/scim).
// All endpoints are snake_case; paths are relative to /api/v1.
import { api } from "./api";

export interface HubConnector {
  connector_id: string;
  display_name: string;
  category: string;
  description: string;
  auth_modes: string[];
  directions: string[];
  capabilities: string[];
  icon: string;
  wave: string;
  status: string;
}

export interface HubInstallation {
  id: number;
  organization_id: number;
  connector_id: string;
  label: string;
  status: string;
  auth_mode: string;
  directions: string[];
  capabilities: string[];
  runtime_owner: string;
  config?: Record<string, unknown> | null;
  has_secrets: boolean;
  public_id?: string | null;
  entitlement?: Record<string, unknown> | null;
  health?: Record<string, unknown> | null;
  legacy_ref?: Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface HubInstallResponse {
  ok: boolean;
  id: number;
  organization_id: number;
  connector_id: string;
  label: string;
  status: string;
  auth_mode: string;
  has_secrets: boolean;
  public_id?: string | null;
  config?: Record<string, unknown> | null;
}

export type AuthMode = "oauth2" | "copy_webhook" | "oidc" | "webhook_secret" | "meta_cloud" | "bot_token" | string;

/** Secret-bearing config fields that must never sit in the public config. */
const SECRET_CONFIG_KEYS = ["webhook_url", "webhook_secret", "api_key", "secret", "bearer_token", "scim_bearer"];

/** Split raw config into a public config plus secrets (mirrors backend rule). */
export function splitConfigAndSecrets(raw: Record<string, string>): {
  config: Record<string, string>;
  secrets: Record<string, string>;
} {
  const config: Record<string, string> = {};
  const secrets: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v === "" || v === undefined || v === null) continue;
    if (SECRET_CONFIG_KEYS.includes(k)) secrets[k] = v;
    else config[k] = v;
  }
  return { config, secrets };
}

export async function loadHubCatalog(category?: string): Promise<HubConnector[]> {
  const qs = category ? `?category=${encodeURIComponent(category)}` : "";
  const raw = await api.get<{ items?: HubConnector[]; total?: number } | HubConnector[]>(
    `/integrations/catalog${qs}`,
  );
  return Array.isArray(raw) ? raw : (raw?.items ?? []);
}

export async function loadHubInstallations(connectorId?: string): Promise<HubInstallation[]> {
  const qs = connectorId ? `?connector_id=${encodeURIComponent(connectorId)}` : "";
  const raw = await api.get<{ items?: HubInstallation[]; total?: number } | HubInstallation[]>(
    `/integrations/installations${qs}`,
  );
  return Array.isArray(raw) ? raw : (raw?.items ?? []);
}

export async function getHubInstallation(id: number): Promise<HubInstallation> {
  return api.get<HubInstallation>(`/integrations/installations/${id}`);
}

/** Install an integration. Dual-control protected when the org has it configured. */
export async function installHubIntegration(body: Record<string, unknown>, dualControl = true): Promise<HubInstallResponse> {
  const res = await api.post<{ ok?: boolean } & HubInstallation>(
    "/integrations/installations",
    body,
    { dualControl },
  );
  return res as unknown as HubInstallResponse;
}

export async function updateHubInstallation(id: number, body: Record<string, unknown>, dualControl = true): Promise<HubInstallation> {
  return api.patch<HubInstallation>(`/integrations/installations/${id}`, body, { dualControl });
}

export async function uninstallHubIntegration(id: number, dualControl = true): Promise<void> {
  await api.delete(`/integrations/installations/${id}`, { dualControl });
}

/** Rotate a webhook/API secret. The raw secret is returned exactly once. */
export async function rotateHubSecret(id: number, dualControl = true): Promise<Record<string, unknown>> {
  return api.post<Record<string, unknown>>(`/integrations/installations/${id}/rotate-secret`, {}, { dualControl });
}

/** Mint a SCIM bearer token. The raw token is returned exactly once. */
export async function mintHubScimToken(id: number, dualControl = true): Promise<Record<string, unknown>> {
  return api.post<Record<string, unknown>>(`/integrations/installations/${id}/scim-token`, {}, { dualControl });
}

/** Start OAuth for a pending-auth installation → open authorize_url in a popup. */
export async function startHubOAuth(id: number): Promise<{ authorize_url: string; state: string }> {
  return api.post<{ authorize_url: string; state: string }>(
    `/integrations/installations/${id}/oauth/start`,
    {},
  );
}

export async function testHubInstallation(id: number): Promise<Record<string, unknown>> {
  return api.post<Record<string, unknown>>(`/integrations/installations/${id}/test`, {});
}

/** Outbound signed event for n8n/Zapier automation connectors. */
export async function sendHubEvent(id: number, type: string, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  return api.post<Record<string, unknown>>(`/integrations/installations/${id}/send-event`, { type, payload });
}

/** Helpers to render a Slack/Teams-style channel name from a connector id. */
export const hubConnectorMeta: Record<string, { icon: string; short: string }> = {
  slack: { icon: "💬", short: "Slack" },
  teams: { icon: "🧩", short: "Teams" },
  whatsapp: { icon: "📱", short: "WhatsApp" },
  telegram: { icon: "✈️", short: "Telegram" },
  webhook_mapper: { icon: "🔗", short: "Webhook" },
  entra_oidc: { icon: "🪪", short: "Entra SSO" },
  okta_oidc: { icon: "🪪", short: "Okta SSO" },
  google_oidc: { icon: "🪪", short: "Google SSO" },
  n8n: { icon: "⚙️", short: "n8n" },
  zapier: { icon: "⚡", short: "Zapier" },
};
