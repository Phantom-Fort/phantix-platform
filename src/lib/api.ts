// ── Platform API client ───────────────────────────────────────────────────────
// Token model: platform / org-user / dual-control. Config from src/lib/config.ts.
import { API_BASE as CONFIG_API_BASE, AGI_ENABLED as AGI_FLAG } from "./config";
import { dedupedRequest } from "./dedupe";

export const API_BASE = CONFIG_API_BASE;
/** Demo only when session flag is set (not from missing API). */
export const DEMO_MODE = false;
export const AGI_ENABLED = AGI_FLAG;

/** Same-origin media URLs — rewrite absolute upstream API paths. */
export function mediaUrl(path?: string | null): string {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) {
    try {
      const u = new URL(path);
      if (u.pathname.startsWith("/api/")) return `${u.pathname}${u.search}`;
    } catch { /* keep */ }
    return path;
  }
  return path.startsWith("/") ? path : `/${path}`;
}

export const tokens = {
  get platform() { return sessionStorage.getItem("platform_access_token"); },
  set platform(v: string | null) { v ? sessionStorage.setItem("platform_access_token", v) : sessionStorage.removeItem("platform_access_token"); },
  get orgUser() { return sessionStorage.getItem("platform_org_user_token"); },
  set orgUser(v: string | null) { v ? sessionStorage.setItem("platform_org_user_token", v) : sessionStorage.removeItem("platform_org_user_token"); },
  get dualControl() { return sessionStorage.getItem("platform_dual_control"); },
  set dualControl(v: string | null) { v ? sessionStorage.setItem("platform_dual_control", v) : sessionStorage.removeItem("platform_dual_control"); },
  get email() { return sessionStorage.getItem("platform_company_email"); },
  set email(v: string | null) { v ? sessionStorage.setItem("platform_company_email", v) : sessionStorage.removeItem("platform_company_email"); },
};

/** Read email claim from company JWT (payload is base64url JSON). */
export function emailFromToken(token?: string | null): string {
  const t = token ?? tokens.platform;
  if (!t) return tokens.email || "";
  try {
    const part = t.split(".")[1];
    if (!part) return tokens.email || "";
    const json = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
    return (json.email as string) || tokens.email || "";
  } catch {
    return tokens.email || "";
  }
}

export function deviceId(): string {
  let id = localStorage.getItem("phantix_device_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("phantix_device_id", id);
  }
  return id;
}

function detailMessage(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((d: { msg?: string }) => d?.msg ?? "validation error").join(", ");
  }
  if (detail && typeof detail === "object") {
    const d = detail as Record<string, unknown>;
    if (typeof d.message === "string") return d.message;
    if (typeof d.detail === "string") return d.detail;
    if (typeof d.error === "string") return d.error;
  }
  return "Request failed";
}

/**
 * What a failed request is allowed to say to the operator.
 *
 * The backend writes its detail for an engineer reading logs: it names
 * endpoints, headers (`X-Dual-Control-Session`), internal codes and doc paths.
 * That text is logged (see `logRequestFailure`) and the UI gets this instead.
 */
export function errorCopyFor(status: number): string {
  if (status === 0) return "We couldn't reach the server. Check your connection and try again.";
  if (status === 401) return "Your session has expired. Sign in again to continue.";
  if (status === 402) return "That needs an upgrade on your plan.";
  if (status === 403) return "You don't have permission to do that.";
  if (status === 404) return "That item no longer exists.";
  if (status === 408) return "The request timed out. Try again.";
  if (status === 409) return "That conflicts with the current state. Refresh and try again.";
  if (status === 429) return "Too many attempts. Wait a moment and try again.";
  if (status >= 500) return "The server couldn't complete that request. Try again shortly.";
  if (status >= 400) return "That request was rejected. Check the details and try again.";
  return "Something went wrong. Try again.";
}

/**
 * Keep the server's own words in the error log, where they can be triaged.
 * Server faults log as errors; client-side rejections (validation, permissions,
 * conflicts) log as warnings so they do not drown the real failures.
 */
function logRequestFailure(
  status: number,
  serverMessage: string,
  detail: unknown,
  correlationId?: string,
): void {
  const line = `[api] ${status || "network"} · ${serverMessage}`;
  const context = correlationId ? `${line} · correlation-id=${correlationId}` : line;
  const write = status >= 500 || status === 0 || status === 408 ? console.error : console.warn;
  write(context, detail);
}

export class ApiError extends Error {
  status: number;
  detail: unknown;
  /** The backend's own message: logged for triage, never shown to the operator. */
  serverMessage: string;
  /** Server correlation id (X-Correlation-ID) for support/triage. */
  correlationId?: string;
  constructor(status: number, detail: unknown, correlationId?: string) {
    const serverMessage = detailMessage(detail);
    super(errorCopyFor(status));
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
    this.serverMessage = serverMessage;
    this.correlationId = correlationId;
    logRequestFailure(status, serverMessage, detail, correlationId);
  }
}

/**
 * Wait (seconds) carried by a 429 "too many failed attempts" response, if the
 * server put a number in the detail. No Retry-After header yet — callers should
 * fall back to a generic "try again shortly" when this returns null.
 */
export function throttleSeconds(err: unknown): number | null {
  if (!(err instanceof ApiError) || err.status !== 429) return null;
  // The wait is carried in the server's own words, which no longer reach
  // `Error.message` — read the retained copy.
  const msg = typeof err.serverMessage === "string" ? err.serverMessage : "";
  const m = msg.match(/(\d+)\s*seconds?/i);
  return m ? Math.max(1, parseInt(m[1], 10)) : null;
}

/**
 * Middleware-parked action (approvals-and-sensitive-actions §2.2): a 2xx with
 * `pending: true` means the call did NOT run — it was filed for an authorizer.
 * The UI must say "sent for approval", never that the action happened.
 */
export function isPendingApproval(body: unknown): boolean {
  return !!body && typeof body === "object" && (body as { pending?: unknown }).pending === true;
}

// ── Correlation ID (00-shared-auth-and-client.md §6) ────────────────────────
// Surface X-Correlation-ID on failures so support can trace a request.
let lastCorrelationId: string | null = null;

/** Capture X-Correlation-ID from any response (if present). */
function trackCorrelationId(res: Response): void {
  const id = res.headers.get("X-Correlation-ID");
  if (id) lastCorrelationId = id;
}

/** Most recent correlation id seen on any response (or null). */
export function getCorrelationId(): string | null {
  return lastCorrelationId;
}

/** Reset tracking (e.g. on logout). */
export function clearCorrelationId(): void {
  lastCorrelationId = null;
}

async function request<T>(
  method: string,
  path: string,
  opts: { body?: unknown; dualControl?: boolean; form?: Record<string, string>; authClearOn401?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  headers["X-Device-Id"] = deviceId();
  headers["X-Client-Surface"] = "platform";
  const bearer = tokens.orgUser ?? tokens.platform;
  if (bearer) headers["Authorization"] = `Bearer ${bearer}`;
  const sentDualControl = !!tokens.dualControl && opts.dualControl === true;
  // Operate-scoped requests must not be mistaken for a dead company session.
  const dualControlScoped = opts.dualControl === true || sentDualControl;
  if (sentDualControl) headers["X-Dual-Control-Session"] = tokens.dualControl!;

  let body: BodyInit | undefined;
  if (opts.form) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    body = new URLSearchParams(opts.form).toString();
  } else if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(`${API_BASE}${path}`, { method, headers, body, signal: controller.signal });
    // Support triage: remember the correlation id even on success, so the next
    // failure can be traced back (00-shared-auth-and-client.md §6).
    trackCorrelationId(res);
    // Operate session is an idle session on the backend: every successful mutation
    // that used it counts as activity and slides the FE expiry forward so the user
    // is not asked for another code while still working.
    if (res.ok && sentDualControl) {
      window.dispatchEvent(new CustomEvent("phantix:operate-activity"));
    }
    if (!res.ok) {
      const correlationId = res.headers.get("X-Correlation-ID") || undefined;
      let detail: unknown = res.statusText;
      try {
        detail = (await res.json()).detail;
      } catch { /* non-JSON */ }
      const detailObj = detail && typeof detail === "object" ? (detail as Record<string, unknown>) : null;
      const msg = typeof detail === "string" ? detail : detailObj?.message ? String(detailObj.message) : "";
      // Match the explicit ``WWW-Authenticate: DualControl`` challenge the
      // operate middleware sends on 401 (concurrent-sessions.md §4.2) as well as
      // the structured operate-middleware shape and the human message. The org /
      // org-user session stays intact — the user is NOT logged out when only the
      // dual-control operate session is gone/missing.
      const operateChallenge = (res.headers.get("WWW-Authenticate") || "")
        .toLowerCase()
        .includes("dualcontrol");
      const dcSessionIssue =
        operateChallenge ||
        detailObj?.error === "dual_control_session_required" ||
        detailObj?.error === "dual_control_session_expired" ||
        (detailObj as Record<string, unknown> | null)?.["required_header"] === "X-Dual-Control-Session" ||
        /authenticator session|dual.?control session|X-Dual-Control-Session/i.test(msg) ||
        (res.status === 401 && dualControlScoped);
      if ((res.status === 401 || res.status === 403) && sentDualControl && dcSessionIssue) {
        tokens.dualControl = null;
        window.dispatchEvent(new CustomEvent("phantix:dual-control-session-expired", { detail: msg || "Operate session ended." }));
      } else if ((res.status === 401 || res.status === 403) && dualControlScoped && dcSessionIssue) {
        // Dual-control header missing or expired (not a broken session): prompt re-unlock.
        window.dispatchEvent(new CustomEvent("phantix:operate-required", { detail: msg || undefined }));
      }
      // A 401 here almost always means the bearer token itself is invalid, so
      // the whole org session is torn down. But a handful of endpoints (e.g.
      // payment verification) use 401 to report a business-logic outcome
      // against a gateway/reference, not an auth failure --- those pass
      // `authClearOn401: false` so a declined verification doesn't abruptly
      // sign out a user who is still mid-session and otherwise fully authed.
      if (res.status === 401 && !dcSessionIssue && !dualControlScoped && opts.authClearOn401 !== false) {
        tokens.platform = null;
        tokens.orgUser = null;
        tokens.email = null;
      }
      if (res.status === 402) {
        const m = typeof detail === "string" ? detail : "Upgrade required";
        window.dispatchEvent(new CustomEvent("phantix:billing-required", { detail: m }));
      }
      // Login throttling (staging-rollout §8): failed attempts are throttled per
      // identifier — 5 failures/5 min → 429. Never present it as a wrong password.
      if (res.status === 429) {
        const sec = (typeof detail === "string" ? detail : msg).match(/(\d+)\s*seconds?/i);
        window.dispatchEvent(new CustomEvent("phantix:throttled", {
          detail: { seconds: sec ? Math.max(1, parseInt(sec[1], 10)) : null },
        }));
      }
      throw new ApiError(res.status, detail, correlationId);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/** Multipart upload --- do not set Content-Type (browser sets boundary). */
async function requestMultipart<T>(
  method: string,
  path: string,
  formData: FormData,
  opts: { dualControl?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  headers["X-Device-Id"] = deviceId();
  headers["X-Client-Surface"] = "platform";
  const bearer = tokens.orgUser ?? tokens.platform;
  if (bearer) headers["Authorization"] = `Bearer ${bearer}`;
  const sentDualControl = !!tokens.dualControl && opts.dualControl === true;
  if (sentDualControl) headers["X-Dual-Control-Session"] = tokens.dualControl!;

    const res = await fetch(`${API_BASE}${path}`, { method, headers, body: formData });
    trackCorrelationId(res);
    if (res.ok && sentDualControl) {
      window.dispatchEvent(new CustomEvent("phantix:operate-activity"));
    }
    if (!res.ok) {
      const correlationId = res.headers.get("X-Correlation-ID") || undefined;
      let detail: unknown = res.statusText;
      try {
        detail = (await res.json()).detail;
      } catch { /* non-JSON */ }
      const detailObj = detail && typeof detail === "object" ? (detail as Record<string, unknown>) : null;
      const msg = typeof detail === "string" ? detail : detailObj?.message ? String(detailObj.message) : "";
      const operateChallenge = (res.headers.get("WWW-Authenticate") || "")
        .toLowerCase()
        .includes("dualcontrol");
      const dcSessionIssue =
        operateChallenge ||
        detailObj?.error === "dual_control_session_required" ||
        (detailObj as Record<string, unknown> | null)?.["required_header"] === "X-Dual-Control-Session" ||
        /authenticator session|dual.?control session|X-Dual-Control-Session/i.test(msg);
      if ((res.status === 401 || res.status === 403) && sentDualControl && dcSessionIssue) {
        tokens.dualControl = null;
        window.dispatchEvent(new CustomEvent("phantix:dual-control-session-expired", { detail: msg || "Operate session ended." }));
      } else if (res.status === 403 && dcSessionIssue) {
        window.dispatchEvent(new CustomEvent("phantix:operate-required", { detail: msg || undefined }));
      }
      if (res.status === 401 && !dcSessionIssue) {
        tokens.platform = null;
        tokens.orgUser = null;
        tokens.email = null;
      }
      if (res.status === 402) {
        const m = typeof detail === "string" ? detail : "Upgrade required";
        window.dispatchEvent(new CustomEvent("phantix:billing-required", { detail: m }));
      }
      // Login throttling (staging-rollout §8).
      if (res.status === 429) {
        const sec = (typeof detail === "string" ? detail : msg).match(/(\d+)\s*seconds?/i);
        window.dispatchEvent(new CustomEvent("phantix:throttled", {
          detail: { seconds: sec ? Math.max(1, parseInt(sec[1], 10)) : null },
        }));
      }
      throw new ApiError(res.status, detail, correlationId);
    }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string, opts?: Parameters<typeof request>[2]) =>
    dedupedRequest("GET", path, opts?.body, () => request<T>("GET", path, opts)),
  post: <T>(path: string, body?: unknown, opts?: Parameters<typeof request>[2]) => request<T>("POST", path, { ...opts, body }),
  put: <T>(path: string, body?: unknown, opts?: Parameters<typeof request>[2]) => request<T>("PUT", path, { ...opts, body }),
  patch: <T>(path: string, body?: unknown, opts?: Parameters<typeof request>[2]) => request<T>("PATCH", path, { ...opts, body }),
  delete: <T>(path: string, opts?: Parameters<typeof request>[2]) => request<T>("DELETE", path, opts),
  postForm: <T>(path: string, form: Record<string, string>) => request<T>("POST", path, { form }),
  /** multipart/form-data (e.g. logo upload field name `file`) */
  postMultipart: <T>(path: string, formData: FormData, opts?: { dualControl?: boolean }) =>
    requestMultipart<T>("POST", path, formData, opts),

  async download(path: string): Promise<Blob> {
    const headers: Record<string, string> = {};
    headers["X-Device-Id"] = deviceId();
  headers["X-Client-Surface"] = "platform";
    const bearer = tokens.orgUser ?? tokens.platform;
    if (bearer) headers["Authorization"] = `Bearer ${bearer}`;
    if (tokens.dualControl) headers["X-Dual-Control-Session"] = tokens.dualControl;
    const res = await fetch(`${API_BASE}${path}`, { method: "GET", headers });
    trackCorrelationId(res);
    if (!res.ok) throw new ApiError(res.status, res.statusText, res.headers.get("X-Correlation-ID") || undefined);
    return res.blob();
  },

  async fetchText(path: string): Promise<string> {
    const headers: Record<string, string> = {};
    headers["X-Device-Id"] = deviceId();
  headers["X-Client-Surface"] = "platform";
    const bearer = tokens.orgUser ?? tokens.platform;
    if (bearer) headers["Authorization"] = `Bearer ${bearer}`;
    const res = await fetch(`${API_BASE}${path}`, { method: "GET", headers });
    trackCorrelationId(res);
    if (!res.ok) throw new ApiError(res.status, res.statusText, res.headers.get("X-Correlation-ID") || undefined);
    return res.text();
  },
};

export const delay = (ms = 420) => new Promise((r) => setTimeout(r, ms));
