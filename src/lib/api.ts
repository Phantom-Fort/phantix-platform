// ── Platform API client ───────────────────────────────────────────────────────
// Token model (per frontend/02_PLATFORM_IMPLEMENTATION.md):
//   platform_access_token    company JWT (type=access)
//   platform_org_user_token  org-user identity JWT (type=org_user)
//   platform_dual_control    X-Dual-Control-Session (3-min idle operate token)
//   phantix_device_id        stable browser UUID
//
// Demo mode serves a simulated tenant; set VITE_API_BASE to go live.

const API_BASE = import.meta.env.VITE_API_BASE as string | undefined;
export const DEMO_MODE = !API_BASE;

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

export class ApiError extends Error {
  status: number;
  detail: unknown;
  constructor(status: number, detail: unknown) {
    const msg =
      typeof detail === "string"
        ? detail
        : Array.isArray(detail)
          ? detail.map((d: { msg?: string }) => d?.msg ?? "validation error").join(", ")
          : "Request failed";
    super(msg);
    this.status = status;
    this.detail = detail;
  }
}

async function request<T>(
  method: string,
  path: string,
  opts: { body?: unknown; dualControl?: boolean; form?: Record<string, string> } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  headers["X-Device-Id"] = deviceId();
  const bearer = tokens.orgUser ?? tokens.platform;
  if (bearer) headers["Authorization"] = `Bearer ${bearer}`;
  if (opts.dualControl && tokens.dualControl) headers["X-Dual-Control-Session"] = tokens.dualControl;

  let body: BodyInit | undefined;
  if (opts.form) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    body = new URLSearchParams(opts.form).toString();
  } else if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }

  const res = await fetch(`${API_BASE}${path}`, { method, headers, body });
  if (!res.ok) {
    let detail: unknown = res.statusText;
    try {
      detail = (await res.json()).detail;
    } catch { /* non-JSON */ }
    if (res.status === 401) {
      tokens.platform = null;
      tokens.orgUser = null;
      tokens.email = null;
    }
    throw new ApiError(res.status, detail);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Multipart upload — do not set Content-Type (browser sets boundary). */
async function requestMultipart<T>(
  method: string,
  path: string,
  formData: FormData,
  opts: { dualControl?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  headers["X-Device-Id"] = deviceId();
  const bearer = tokens.orgUser ?? tokens.platform;
  if (bearer) headers["Authorization"] = `Bearer ${bearer}`;
  if (opts.dualControl && tokens.dualControl) headers["X-Dual-Control-Session"] = tokens.dualControl!;

  const res = await fetch(`${API_BASE}${path}`, { method, headers, body: formData });
  if (!res.ok) {
    let detail: unknown = res.statusText;
    try {
      detail = (await res.json()).detail;
    } catch { /* non-JSON */ }
    if (res.status === 401) {
      tokens.platform = null;
      tokens.orgUser = null;
      tokens.email = null;
    }
    throw new ApiError(res.status, detail);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string, opts?: Parameters<typeof request>[2]) => request<T>("GET", path, opts),
  post: <T>(path: string, body?: unknown, opts?: Parameters<typeof request>[2]) => request<T>("POST", path, { ...opts, body }),
  put: <T>(path: string, body?: unknown, opts?: Parameters<typeof request>[2]) => request<T>("PUT", path, { ...opts, body }),
  patch: <T>(path: string, body?: unknown, opts?: Parameters<typeof request>[2]) => request<T>("PATCH", path, { ...opts, body }),
  delete: <T>(path: string, opts?: Parameters<typeof request>[2]) => request<T>("DELETE", path, opts),
  postForm: <T>(path: string, form: Record<string, string>) => request<T>("POST", path, { form }),
  /** multipart/form-data (e.g. logo upload field name `file`) */
  postMultipart: <T>(path: string, formData: FormData, opts?: { dualControl?: boolean }) =>
    requestMultipart<T>("POST", path, formData, opts),
};

export const delay = (ms = 420) => new Promise((r) => setTimeout(r, ms));
