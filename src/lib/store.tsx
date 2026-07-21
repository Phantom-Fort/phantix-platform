import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from "lucide-react";
import { tokens, DEMO_MODE, delay, api, deviceId, emailFromToken } from "./api";
import {
  emptyOrg,
  isSecurityDbReady,
  mapConnectionsFromApi,
  mapConnectionFromApi,
  mapOrgFromApi,
  orgToUpdateBody,
} from "./org";
import type {
  AuditEvent,
  ChildCompany,
  DbConnection,
  DualControlAssignment,
  LoginLink,
  OrgUser,
  Organization,
  Payment,
  PendingAction,
  ServiceKeyMeta,
  SetupState,
  SupportTicket,
  ToolItem,
} from "./types";

const emptySetup = (): SetupState => ({
  privacy_accepted: false,
  privacy_accepted_at: null,
  identity_saved: false,
  email_otp_sent: false,
  email_otp_destination: null,
  identity_verified: false,
  domain: null,
  domain_token: null,
  domain_dns_ok: false,
  domain_http_ok: false,
  cac_submitted: false,
  cac_skipped: false,
  manual_review: "none",
  setup_complete: false,
});

/** Demo-only seed catalog — never used when VITE_API_BASE is set. */
const demoTools: ToolItem[] = [
  { id: 1, key: "nmap", name: "Nmap", category: "Discovery", description: "Port & service scanning with admin-pinned flags", subscribed: true, price_note: "Included" },
  { id: 2, key: "nuclei", name: "Nuclei", category: "Vulnerability", description: "Template-driven CVE & misconfiguration engine", subscribed: true, price_note: "Included" },
  { id: 3, key: "subfinder", name: "Subfinder", category: "Discovery", description: "Passive subdomain enumeration", subscribed: true, price_note: "Included" },
  { id: 4, key: "katana", name: "Katana", category: "Recon", description: "Web crawling for the web_scan pipeline", subscribed: false, price_note: "Add-on" },
  { id: 5, key: "sqlmap", name: "SQLMap", category: "Exploitation", description: "Parameterized SQLi confirmation", subscribed: false, price_note: "Add-on" },
  { id: 6, key: "gowitness", name: "Gowitness", category: "Evidence", description: "Screenshot capture for report evidence", subscribed: false, price_note: "Add-on" },
];

const demoPayments: Payment[] = [
  { id: 1, reference: "PHX-2026-0711", amount_ngn: 500, status: "paid", period: "July 2026 (first month −50%)", created_at: "2026-07-01T09:00:00Z" },
  { id: 2, reference: "PHX-2026-0811", amount_ngn: 1000, status: "pending", period: "August 2026", created_at: "2026-08-01T09:00:00Z" },
];

const demoOrg = (): Organization => ({
  ...emptyOrg(),
  id: 11,
  name: "Demo Financial Group",
  slug: "demo-financial",
  creator_user_id: 1,
  legal_name: "Demo Financial Group Ltd",
  website: "https://example.com",
  phone: null,
  country: "NG",
  industry: "fintech",
  email: "admin@example.com",
  plan: "Scale",
  created_at: "2026-07-21T08:00:00Z",
  setup_completed: false,
});

const demoAudit = (): AuditEvent[] => [
  {
    id: 1,
    event_key: "org.register",
    category: "auth",
    action: "Organization registered",
    initiator_name: "Account owner",
    initiator_title: "Primary email",
    authorizer_name: null,
    authorizer_title: null,
    created_at: new Date().toISOString(),
  },
];

type OperateState = {
  unlocked: boolean;
  actingUser: string | null;
  actingRole: "initiator" | "authorizer" | null;
  expiresAt: number | null;
};

type ToastKind = "success" | "error" | "info" | "warning";
type Toast = { id: number; kind: ToastKind; title: string; body?: string };

type Session = { authenticated: boolean; email: string } | null;

interface PersistedState {
  org: Organization;
  setup: SetupState;
  users: OrgUser[];
  dualControl: DualControlAssignment;
  connections: DbConnection[];
  companies: ChildCompany[];
  serviceKey: ServiceKeyMeta | null;
  loginLinks: LoginLink[];
  audit: AuditEvent[];
  pending: PendingAction[];
  tools: ToolItem[];
  payments: Payment[];
  tickets: SupportTicket[];
  nextId: number;
}

const STORAGE_KEY = "phantix_platform_demo_v1";

function loadPersisted(): PersistedState | null {
  if (!DEMO_MODE) return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PersistedState) : null;
  } catch {
    return null;
  }
}

const emptyState = (): PersistedState => ({
  org: emptyOrg(),
  setup: emptySetup(),
  users: [],
  dualControl: { configured: false, require_dual_control: false, initiator_user_id: null, authorizer_user_id: null },
  connections: [],
  companies: [],
  serviceKey: null,
  loginLinks: [],
  audit: [],
  pending: [],
  tools: [],
  payments: [],
  tickets: [],
  nextId: 1,
});

const demoState = (): PersistedState => ({
  org: demoOrg(),
  setup: emptySetup(),
  users: [],
  dualControl: { configured: false, require_dual_control: false, initiator_user_id: null, authorizer_user_id: null },
  connections: [],
  companies: [],
  serviceKey: null,
  loginLinks: [],
  audit: demoAudit(),
  pending: [],
  tools: demoTools,
  payments: demoPayments,
  tickets: [],
  nextId: 100,
});

const freshState = (): PersistedState => (DEMO_MODE ? demoState() : emptyState());

type SetupApi = Record<string, unknown>;

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function pickBool(...vals: unknown[]): boolean {
  for (const v of vals) {
    if (typeof v === "boolean") return v;
    if (v === "true" || v === 1) return true;
    if (v === "false" || v === 0) return false;
    const nested = asRecord(v);
    if (nested) {
      if (typeof nested.ok === "boolean") return nested.ok;
      if (typeof nested.verified === "boolean") return nested.verified;
      if (typeof nested.success === "boolean") return nested.success;
      if (typeof nested.passed === "boolean") return nested.passed;
    }
  }
  return false;
}

function pickStr(...vals: unknown[]): string | null {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v;
  }
  return null;
}

/** Normalize domain check / setup verification flags from varied API shapes. */
function parseDomainFlags(raw: unknown): { dns: boolean; http: boolean; domain: string | null; token: string | null } {
  const r = asRecord(raw) || {};
  const verification = asRecord(r.verification) || asRecord(r.verifications) || asRecord(r.domain_verification) || r;
  const modes = asRecord(verification.modes) || asRecord(r.modes);
  const dnsMode = asRecord(modes?.domain_dns) || asRecord(verification.domain_dns) || asRecord(r.dns);
  const httpMode = asRecord(modes?.domain_http) || asRecord(verification.domain_http) || asRecord(r.http);

  const dns = pickBool(
    verification.domain_dns_ok,
    verification.dns_ok,
    verification.dns_verified,
    r.domain_dns_ok,
    r.dns_ok,
    r.dns_verified,
    dnsMode?.completed,
    dnsMode?.verified,
    dnsMode?.ok,
    dnsMode,
  );
  const http = pickBool(
    verification.domain_http_ok,
    verification.http_ok,
    verification.http_verified,
    r.domain_http_ok,
    r.http_ok,
    r.http_verified,
    httpMode?.completed,
    httpMode?.verified,
    httpMode?.ok,
    httpMode,
  );
  // company/domain verified often means at least one mode passed
  const anyOk = pickBool(verification.domain_verified, r.domain_verified, r.company_verified, verification.company_verified);
  return {
    dns: dns || (anyOk && !http ? true : dns),
    http: http || (anyOk && !dns ? true : http),
    domain: pickStr(verification.domain, r.domain, verification.hostname),
    token: pickStr(verification.domain_token, verification.token, r.domain_token, r.token, verification.verification_token),
  };
}

function mapSetupFromApi(api: SetupApi, emailFallback = ""): { org: Partial<Organization>; setup: SetupState } {
  const privacy = asRecord(api.privacy) || {};
  const identity = asRecord(api.identity) || {};
  const cac = asRecord(api.cac) || asRecord(api.cac_rc) || {};
  const manual = asRecord(api.manual_review) || {};
  const flags = parseDomainFlags(api);

  const reviewRaw =
    (typeof api.manual_review === "string" && api.manual_review) ||
    (typeof manual.status === "string" && manual.status) ||
    "none";
  const review = (["none", "pending", "approved", "rejected"].includes(reviewRaw) ? reviewRaw : "none") as SetupState["manual_review"];

  return {
    org: {
      id: typeof api.organization_id === "number" ? api.organization_id : 0,
      name: typeof api.organization_name === "string" ? api.organization_name : "",
      slug: typeof api.slug === "string" ? api.slug : "",
      primary_email: emailFallback,
    },
    setup: {
      privacy_accepted: pickBool(api.privacy_notice_accepted, privacy.accepted, privacy.privacy_notice_accepted),
      privacy_accepted_at:
        (typeof api.privacy_notice_accepted_at === "string" && api.privacy_notice_accepted_at) ||
        (typeof privacy.accepted_at === "string" && privacy.accepted_at) ||
        null,
      identity_saved: pickBool(identity.saved, api.identity_saved),
      email_otp_sent: false,
      email_otp_destination:
        pickStr(api.primary_email_masked, identity.primary_email_masked, emailFallback) || null,
      identity_verified: pickBool(api.identity_verified, api.email_verified, identity.verified, identity.email_verified),
      domain: flags.domain,
      domain_token: flags.token,
      domain_dns_ok: flags.dns,
      domain_http_ok: flags.http,
      cac_submitted: pickBool(cac.submitted, cac.cac_submitted, api.cac_submitted),
      cac_skipped: pickBool(cac.skipped, cac.cac_skipped, api.cac_skipped),
      manual_review: review,
      setup_complete: pickBool(api.setup_completed, api.setup_complete),
    },
  };
}

type Store = {
  session: Session;
  state: PersistedState;
  operate: OperateState;
  securityDbReady: boolean;
  // auth
  register: (name: string, email: string, password: string, country: string, slug: string, industry: string, secondary_email: string, primary_contact: {title: string, name: string}) => Promise<void>;
  login: (email: string, password: string) => Promise<{ mfaRequired: boolean }>;
  verifyMfa: (code: string) => Promise<void>;
  logout: () => void;
  hydrateSession: (email?: string) => Promise<void>;
  // setup wizard
  acceptPrivacy: (version?: string) => Promise<void>;
  saveIdentity: (fields: { website: string; legal_name: string; company_phone: string }) => Promise<void>;
  updateOrgProfile: (fields: Partial<Organization>) => Promise<void>;
  sendOtp: () => Promise<{ devOtp: string }>;
  verifyOtp: (code: string) => Promise<void>;
  startDomainVerification: (domain: string) => Promise<string>;
  checkDomain: (method: "auto" | "dns" | "http") => Promise<void>;
  submitCac: (cac: string, rc: string) => Promise<void>;
  skipCac: () => Promise<void>;
  requestManualReview: () => Promise<void>;
  completeSetup: () => Promise<void>;
  // users & dual control
  createUser: (u: { full_name: string; email: string; title: string; role: string }) => Promise<OrgUser>;
  assignDualControl: (initiatorId: number, authorizerId: number) => Promise<void>;
  unlockOperate: (email: string, code: string) => Promise<void>;
  lockOperate: () => void;
  /** Opens dual-control overlay when operate session missing. Resolves true if unlocked. */
  requireDualControl: (reason?: string) => Promise<boolean>;
  dualControlPrompt: { open: boolean; reason: string };
  closeDualControlPrompt: (success: boolean) => void;
  requestDualControlOtp: (email: string) => Promise<{ destinationMasked: string; devOtp: string }>;
  verifyDualControlOtp: (code: string) => Promise<{ deviceRequired: boolean }>;
  confirmDualControlDevice: (code: string) => Promise<void>;
  issueLoginLink: (userId: number) => Promise<string>;
  clearDevice: (userId: number) => Promise<void>;
  // connections
  refreshConnections: () => Promise<void>;
  createConnection: (
    c: Omit<DbConnection, "id" | "bootstrap_status" | "schema_version" | "last_test_at" | "last_test_ok" | "created_at"> & {
      username?: string;
      password?: string;
      ssl_mode?: string;
      environment?: string;
    },
  ) => Promise<void>;
  testConnection: (id: number) => Promise<void>;
  bootstrapConnection: (id: number) => Promise<void>;
  deleteConnection: (id: number) => Promise<void>;
  // companies & keys
  createCompany: (c: { name: string; industry: string; country: string }) => Promise<void>;
  rotateServiceKey: (companyId?: number) => Promise<string>;
  revokeServiceKey: () => Promise<void>;
  savePreferredServices: (services: string[]) => Promise<void>;
  // misc
  toggleTool: (id: number) => Promise<void>;
  createTicket: (subject: string, priority: string, body: string) => Promise<void>;
  decidePending: (id: number, approve: boolean) => Promise<void>;
  resetDemo: () => void;
  // toasts
  toasts: Toast[];
  toast: (kind: ToastKind, title: string, body?: string) => void;
  dismissToast: (id: number) => void;
};

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PersistedState>(() => {
    if (DEMO_MODE) return loadPersisted() ?? demoState();
    // Live: never restore demo sessionStorage seed
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    return emptyState();
  });
  const [session, setSession] = useState<Session>(() => {
    if (!tokens.platform) return null;
    const email = emailFromToken();
    return { authenticated: true, email };
  });
  const [operate, setOperate] = useState<OperateState>(() =>
    DEMO_MODE && tokens.dualControl
      ? { unlocked: true, actingUser: "Operate user", actingRole: "initiator", expiresAt: Date.now() + 3 * 60_000 }
      : { unlocked: false, actingUser: null, actingRole: null, expiresAt: null },
  );
  const [dualControlPrompt, setDualControlPrompt] = useState<{ open: boolean; reason: string }>({ open: false, reason: "" });
  const dcPromptResolve = useRef<((ok: boolean) => void) | null>(null);
  const dcMfaToken = useRef<string>("");
  const dcDeviceToken = useRef<string>("");
  const dcEmail = useRef<string>("");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);
  const hydrating = useRef(false);

  const persist = useCallback((updater: (s: PersistedState) => PersistedState) => {
    setState((prev) => {
      const next = updater(prev);
      if (DEMO_MODE) {
        try {
          sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch { /* quota */ }
      }
      return next;
    });
  }, []);

  const hydrateSession = useCallback(async (email = "") => {
    if (DEMO_MODE || !tokens.platform || hydrating.current) return;
    hydrating.current = true;
    try {
      const resolvedEmail = email || emailFromToken() || tokens.email || "";
      if (resolvedEmail) tokens.email = resolvedEmail;

      const [meRes, setupRes, connsRes, primaryRes, keyRes, usersRes, dcRes] = await Promise.all([
        api.get<unknown>("/organizations/me").catch(() => null),
        api.get<SetupApi>("/organizations/me/setup").catch(() => null),
        api.get<unknown>("/db-connections").catch(() => null),
        api.get<unknown>("/db-connections/primary-security-storage").catch(() => null),
        api.get<unknown>("/organizations/me/service-key").catch(() =>
          api.get<unknown>("/organizations/me/service-keys").catch(() => null),
        ),
        api.get<unknown>("/org-users").catch(() => null),
        api.get<unknown>("/org-users/dual-control").catch(() => null),
      ]);

      const org = meRes
        ? mapOrgFromApi(meRes, resolvedEmail)
        : mapOrgFromApi({ email: resolvedEmail }, resolvedEmail);
      const mappedSetup = setupRes ? mapSetupFromApi(setupRes, resolvedEmail || org.email) : null;
      const connections = mapConnectionsFromApi(connsRes);
      // If list empty but primary endpoint returns a row, include it
      if (!connections.length && primaryRes) {
        const p = mapConnectionFromApi(primaryRes);
        if (p) connections.push(p);
      }

      let serviceKey: ServiceKeyMeta | null = null;
      if (keyRes) {
        const keyObj = Array.isArray(keyRes) ? keyRes[0] : keyRes;
        if (keyObj && typeof keyObj === "object") {
          const k = keyObj as Record<string, unknown>;
          serviceKey = {
            id: Number(k.id ?? 0),
            prefix: String(k.prefix ?? k.key_prefix ?? "pk_live_…"),
            active: k.active !== false,
            created_at: String(k.created_at ?? ""),
            last_used_at: (k.last_used_at as string) ?? null,
          };
        }
      }

      const usersRaw = Array.isArray(usersRes)
        ? usersRes
        : ((usersRes as { items?: unknown[] })?.items ?? []);
      const users: OrgUser[] = (usersRaw as Record<string, unknown>[]).map((u) => ({
        id: Number(u.id ?? 0),
        full_name: String(u.full_name ?? u.name ?? ""),
        email: String(u.email ?? ""),
        title: String(u.title ?? ""),
        role: String(u.role ?? "viewer"),
        otp_only: u.otp_only !== false,
        is_active: u.is_active !== false,
        last_login_at: (u.last_login_at as string) ?? null,
      }));

      let dualControl: DualControlAssignment = {
        configured: false,
        require_dual_control: false,
        initiator_user_id: null,
        authorizer_user_id: null,
      };
      if (dcRes && typeof dcRes === "object") {
        const d = dcRes as Record<string, unknown>;
        const initId = Number(d.initiator_user_id ?? (d.initiator as { id?: number })?.id ?? 0) || null;
        const authId = Number(d.authorizer_user_id ?? (d.authorizer as { id?: number })?.id ?? 0) || null;
        dualControl = {
          configured: Boolean(d.configured ?? (initId && authId)),
          require_dual_control: Boolean(d.require_dual_control ?? true),
          initiator_user_id: initId,
          authorizer_user_id: authId,
        };
      }

      const displayEmail = resolvedEmail || org.email || "";
      persist((s) => ({
        ...s,
        org: {
          ...org,
          ...(mappedSetup?.org ?? {}),
          email: displayEmail || org.email,
          primary_email: displayEmail || org.email,
          setup_completed: mappedSetup?.setup.setup_complete ?? org.setup_completed,
          identity_verified: mappedSetup?.setup.identity_verified ?? org.identity_verified,
          privacy_notice_accepted: mappedSetup?.setup.privacy_accepted ?? org.privacy_notice_accepted,
        },
        setup: mappedSetup
          ? {
              ...mappedSetup.setup,
              email_otp_destination: mappedSetup.setup.email_otp_destination || displayEmail || null,
              setup_complete: mappedSetup.setup.setup_complete || org.setup_completed,
              identity_verified: mappedSetup.setup.identity_verified || org.identity_verified || org.email_verified,
              privacy_accepted: mappedSetup.setup.privacy_accepted || org.privacy_notice_accepted,
            }
          : {
              ...s.setup,
              setup_complete: org.setup_completed,
              identity_verified: org.identity_verified || org.email_verified,
              privacy_accepted: org.privacy_notice_accepted,
            },
        connections,
        serviceKey: serviceKey ?? s.serviceKey,
        users: users.length ? users : s.users,
        dualControl: dualControl.configured ? dualControl : s.dualControl,
      }));
      setSession({ authenticated: true, email: displayEmail });
    } catch {
      const fallback = email || emailFromToken() || tokens.email || "";
      if (fallback) {
        tokens.email = fallback;
        setSession({ authenticated: true, email: fallback });
        persist((s) => ({ ...s, org: { ...s.org, email: fallback, primary_email: fallback } }));
      }
    } finally {
      hydrating.current = false;
    }
  }, [persist]);

  const toast = useCallback((kind: ToastKind, title: string, body?: string) => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, kind, title, body }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5200);
  }, []);

  const dismissToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const logAudit = useCallback(
    (event_key: string, category: string, action: string) => {
      persist((s) => ({
        ...s,
        audit: [
          { id: s.nextId, event_key, category, action, initiator_name: "Account owner", initiator_title: "Company JWT", authorizer_name: null, authorizer_title: null, created_at: new Date().toISOString() },
          ...s.audit,
        ],
        nextId: s.nextId + 1,
      }));
    },
    [persist],
  );

  // ── Auth ────────────────────────────────────────────────────────────────
  const register = useCallback(
    async (name: string, email: string, _password: string, country: string, slug: string, industry: string, secondary_email: string, primary_contact: {title: string, name: string}) => {
      if (DEMO_MODE) {
        await delay(700);
        persist((s) => ({
          ...s,
          org: { ...s.org, name, email, primary_email: email, country, slug, industry },
          setup: emptySetup(),
          audit: [{ id: s.nextId, event_key: "org.register", category: "auth", action: `Organization registered: ${name}`, initiator_name: email, initiator_title: "Primary email", authorizer_name: null, authorizer_title: null, created_at: new Date().toISOString() }, ...s.audit],
          nextId: s.nextId + 1,
        }));
        tokens.platform = "demo.company.jwt";
        tokens.email = email;
        setSession({ authenticated: true, email });
        return;
      }
      await api.post("/organizations/register", { name, email, password: _password, country, slug, industry, secondary_email, primary_contact });
      const res = await api.postForm<{
        access_token: string;
        organization_id?: number;
        organization_slug?: string;
        experience?: { organization_name?: string };
      }>("/organizations/login", { username: email, password: _password });
      tokens.platform = res.access_token;
      tokens.orgUser = null;
      tokens.email = email;
      setState(emptyState());
      setSession({ authenticated: true, email });
      persist((s) => ({
        ...s,
        org: {
          ...s.org,
          id: res.organization_id ?? 0,
          name: res.experience?.organization_name || name,
          slug: res.organization_slug || slug,
          primary_email: email,
          country,
          industry,
        },
        setup: emptySetup(),
      }));
      await hydrateSession(email);
    },
    [persist, hydrateSession],
  );

  const login = useCallback(async (email: string, password: string) => {
    if (DEMO_MODE) {
      await delay(650);
      if (!email.includes("@")) throw new Error("Enter a valid company email");
      sessionStorage.setItem("mfa_token", "demo-mfa");
      return { mfaRequired: true };
    }
    const res = await api.postForm<{
      access_token?: string;
      mfa_required?: boolean;
      mfa_token?: string;
      organization_id?: number;
      organization_slug?: string;
      experience?: { organization_name?: string };
    }>("/organizations/login", { username: email, password });
    if (res.access_token) {
      tokens.platform = res.access_token;
      tokens.orgUser = null;
      tokens.email = email;
      setState(emptyState());
      setSession({ authenticated: true, email });
      persist((s) => ({
        ...s,
        org: {
          ...s.org,
          id: res.organization_id ?? 0,
          name: res.experience?.organization_name || "",
          slug: res.organization_slug || "",
          email,
          primary_email: email,
        },
        setup: emptySetup(),
      }));
      await hydrateSession(email);
      return { mfaRequired: false };
    }
    sessionStorage.setItem("mfa_token", res.mfa_token ?? "");
    return { mfaRequired: true };
  }, [persist, hydrateSession]);

  const verifyMfa = useCallback(async (code: string) => {
    if (DEMO_MODE) {
      await delay(700);
      if (code.length !== 6) throw new Error("Enter the 6-digit code");
      tokens.platform = "demo.company.jwt";
      setSession({ authenticated: true, email: state.org.email || state.org.primary_email || "" });
      return;
    }
    const res = await api.post<{
      access_token: string;
      organization_id?: number;
      organization_slug?: string;
      experience?: { organization_name?: string };
    }>("/organizations/login/mfa", {
      mfa_token: sessionStorage.getItem("mfa_token"),
      code,
    });
    tokens.platform = res.access_token;
    const email = session?.email || emailFromToken(res.access_token) || tokens.email || "";
    if (email) tokens.email = email;
    setState(emptyState());
    setSession({ authenticated: true, email });
    persist((s) => ({
      ...s,
      org: {
        ...s.org,
        id: res.organization_id ?? 0,
        name: res.experience?.organization_name || "",
        slug: res.organization_slug || "",
        primary_email: email,
      },
      setup: emptySetup(),
    }));
    await hydrateSession(email);
  }, [state.org.primary_email, session?.email, persist, hydrateSession]);

  const logout = useCallback(() => {
    tokens.platform = null;
    tokens.orgUser = null;
    tokens.dualControl = null;
    tokens.email = null;
    setSession(null);
    setOperate({ unlocked: false, actingUser: null, actingRole: null, expiresAt: null });
    if (!DEMO_MODE) setState(emptyState());
  }, []);

  // ── Setup wizard ─────────────────────────────────────────────────────────
  const acceptPrivacy = useCallback(async (version?: string) => {
    if (DEMO_MODE) {
      await delay(400);
      persist((s) => ({ ...s, setup: { ...s.setup, privacy_accepted: true, privacy_accepted_at: new Date().toISOString() } }));
      logAudit("setup.privacy_accept", "setup", "Accepted the privacy notice");
      return;
    }
    let v = version;
    if (!v) {
      const p = await api.get<{ version?: string }>("/organizations/privacy");
      v = p?.version;
    }
    if (!v) throw new Error("Could not load privacy notice version");
    await api.post("/organizations/me/setup/privacy/accept", { accepted: true, notice_version: v });
    persist((s) => ({ ...s, setup: { ...s.setup, privacy_accepted: true, privacy_accepted_at: new Date().toISOString() } }));
    await hydrateSession(session?.email || state.org.primary_email);
  }, [persist, logAudit, hydrateSession, session?.email, state.org.primary_email]);

  const saveIdentity = useCallback(
    async (fields: { website: string; legal_name: string; company_phone: string }) => {
      if (DEMO_MODE) {
        await delay(400);
        persist((s) => ({
          ...s,
          org: {
            ...s.org,
            website: fields.website || null,
            legal_name: fields.legal_name || null,
            phone: fields.company_phone || null,
            company_phone: fields.company_phone || null,
          },
          setup: { ...s.setup, identity_saved: true },
        }));
        return;
      }
      await api.post("/organizations/me/setup/identity", fields);
      persist((s) => ({
        ...s,
        org: {
          ...s.org,
          website: fields.website || null,
          legal_name: fields.legal_name || null,
          phone: fields.company_phone || null,
          company_phone: fields.company_phone || null,
        },
        setup: { ...s.setup, identity_saved: true },
      }));
    },
    [persist],
  );

  const updateOrgProfile = useCallback(
    async (fields: Partial<Organization>) => {
      if (DEMO_MODE) {
        await delay(500);
        persist((s) => ({ ...s, org: { ...s.org, ...fields } }));
        return;
      }
      const body = orgToUpdateBody({ ...state.org, ...fields });
      const res = await api.put<unknown>("/organizations/me", body, { dualControl: true });
      const mapped = res ? mapOrgFromApi(res, state.org.email) : mapOrgFromApi({ ...state.org, ...fields }, state.org.email);
      persist((s) => ({ ...s, org: { ...s.org, ...mapped, ...fields } }));
    },
    [persist, state.org],
  );

  const savePreferredServices = useCallback(
    async (services: string[]) => {
      if (DEMO_MODE) {
        await delay(400);
        persist((s) => ({ ...s, org: { ...s.org, preferred_services: services } }));
        return;
      }
      await api.put("/organizations/me/preferred-services", { preferred_services: services }, { dualControl: true });
      persist((s) => ({ ...s, org: { ...s.org, preferred_services: services } }));
    },
    [persist],
  );

  const sendOtp = useCallback(async () => {
    if (DEMO_MODE) {
      await delay(600);
      const devOtp = String(Math.floor(100000 + Math.random() * 900000));
      sessionStorage.setItem("dev_otp", devOtp);
      persist((s) => ({ ...s, setup: { ...s.setup, email_otp_sent: true, email_otp_destination: s.org.email || s.org.primary_email || null } }));
      return { devOtp };
    }
    const res = await api.post<{ dev_otp?: string }>("/organizations/me/setup/otp/send", { channel: "email" });
    const dest = state.org.email || state.org.primary_email || session?.email || emailFromToken() || tokens.email || "";
    if (dest) tokens.email = dest;
    persist((s) => ({
      ...s,
      org: { ...s.org, email: dest || s.org.email, primary_email: dest || s.org.primary_email },
      setup: { ...s.setup, email_otp_sent: true, email_otp_destination: dest || s.setup.email_otp_destination },
    }));
    return { devOtp: res?.dev_otp || "" };
  }, [persist, state.org.primary_email, session?.email]);

  const verifyOtp = useCallback(
    async (code: string) => {
      if (DEMO_MODE) {
        await delay(650);
        const expected = sessionStorage.getItem("dev_otp");
        if (expected && code !== expected) throw new Error("That code isn't right — check the email and try again");
        persist((s) => ({ ...s, setup: { ...s.setup, identity_verified: true } }));
        logAudit("setup.email_otp", "setup", "Verified company email via OTP");
        return;
      }
      await api.post("/organizations/me/setup/otp/verify", { channel: "email", code });
      persist((s) => ({ ...s, setup: { ...s.setup, identity_verified: true } }));
      await hydrateSession(session?.email || state.org.primary_email);
    },
    [persist, logAudit, hydrateSession, session?.email, state.org.primary_email],
  );

  const startDomainVerification = useCallback(
    async (domain: string) => {
      if (DEMO_MODE) {
        await delay(600);
        const token = `phx_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
        persist((s) => ({ ...s, setup: { ...s.setup, domain, domain_token: token, domain_dns_ok: false, domain_http_ok: false } }));
        return token;
      }
      const res = await api.post<Record<string, unknown>>("/organizations/me/setup/verify/domain/start", { domain });
      const flags = parseDomainFlags(res);
      const token = flags.token || "";
      persist((s) => ({
        ...s,
        setup: {
          ...s.setup,
          domain: flags.domain || domain,
          domain_token: token,
          domain_dns_ok: false,
          domain_http_ok: false,
        },
      }));
      return token;
    },
    [persist],
  );

  const checkDomain = useCallback(
    async (method: "auto" | "dns" | "http") => {
      if (DEMO_MODE) {
        await delay(1400);
        persist((s) => {
          const dnsOk = s.setup.domain_dns_ok || method !== "http";
          const httpOk = s.setup.domain_http_ok || method !== "dns";
          return { ...s, setup: { ...s.setup, domain_dns_ok: dnsOk, domain_http_ok: httpOk } };
        });
        logAudit("setup.domain_verify", "setup", "Domain verification check passed");
        return;
      }
      const res = await api.post<Record<string, unknown>>("/organizations/me/setup/verify/domain/check", { method });
      const flags = parseDomainFlags(res);
      // Prefer check response, then rehydrate from GET /me/setup (source of truth)
      persist((s) => ({
        ...s,
        setup: {
          ...s.setup,
          domain: flags.domain || s.setup.domain,
          domain_token: flags.token || s.setup.domain_token,
          domain_dns_ok: flags.dns || s.setup.domain_dns_ok,
          domain_http_ok: flags.http || s.setup.domain_http_ok,
        },
      }));
      await hydrateSession(session?.email || state.org.primary_email || emailFromToken());
      // If hydrate wiped flags (unknown shape), re-apply successful check flags
      if (flags.dns || flags.http) {
        persist((s) => ({
          ...s,
          setup: {
            ...s.setup,
            domain_dns_ok: s.setup.domain_dns_ok || flags.dns,
            domain_http_ok: s.setup.domain_http_ok || flags.http,
            domain: s.setup.domain || flags.domain,
            domain_token: s.setup.domain_token || flags.token,
          },
        }));
      }
    },
    [persist, logAudit, hydrateSession, session?.email, state.org.primary_email],
  );

  const submitCac = useCallback(
    async (cac: string, rc: string) => {
      if (DEMO_MODE) {
        await delay(500);
        persist((s) => ({ ...s, setup: { ...s.setup, cac_submitted: true } }));
        logAudit("setup.cac", "setup", "Submitted CAC / RC details");
        return;
      }
      await api.post("/organizations/me/setup/cac", { cac_number: cac, rc_number: rc || undefined });
      persist((s) => ({ ...s, setup: { ...s.setup, cac_submitted: true } }));
    },
    [persist, logAudit],
  );

  const skipCac = useCallback(async () => {
    if (DEMO_MODE) {
      await delay(250);
      persist((s) => ({ ...s, setup: { ...s.setup, cac_skipped: true } }));
      return;
    }
    await api.post("/organizations/me/setup/cac", { skip: true });
    persist((s) => ({ ...s, setup: { ...s.setup, cac_skipped: true } }));
  }, [persist]);

  const requestManualReview = useCallback(async () => {
    if (DEMO_MODE) {
      await delay(500);
      persist((s) => ({ ...s, setup: { ...s.setup, manual_review: "pending" } }));
      logAudit("setup.manual_review", "setup", "Requested manual company review");
      return;
    }
    await api.post("/organizations/me/setup/verify/manual-review", {});
    persist((s) => ({ ...s, setup: { ...s.setup, manual_review: "pending" } }));
  }, [persist, logAudit]);

  const completeSetup = useCallback(async () => {
    if (DEMO_MODE) {
      await delay(600);
      persist((s) => {
        if (!s.setup.privacy_accepted || !s.setup.identity_verified) return s;
        return { ...s, setup: { ...s.setup, setup_complete: true } };
      });
      logAudit("setup.complete", "setup", "Completed organization setup");
      return;
    }
    await api.post("/organizations/me/setup/complete", {});
    persist((s) => ({ ...s, setup: { ...s.setup, setup_complete: true } }));
    await hydrateSession(session?.email || state.org.primary_email);
  }, [persist, logAudit, hydrateSession, session?.email, state.org.primary_email]);

  // ── Users & dual control ─────────────────────────────────────────────────
  const createUser = useCallback(
    async (u: { full_name: string; email: string; title: string; role: string }) => {
      await delay(500);
      let created: OrgUser | null = null;
      persist((s) => {
        const id = s.nextId;
        created = { id, full_name: u.full_name, email: u.email, title: u.title, role: u.role, otp_only: true, is_active: true, last_login_at: null };
        return {
          ...s,
          users: [...s.users, created!],
          audit: [{ id: id + 500, event_key: "org_user.create", category: "people", action: `Created org user: ${u.full_name} (${u.title})`, initiator_name: "Account owner", initiator_title: "Company JWT", authorizer_name: null, authorizer_title: null, created_at: new Date().toISOString() }, ...s.audit],
          nextId: id + 1,
        };
      });
      return created!;
    },
    [persist],
  );

  const assignDualControl = useCallback(
    async (initiatorId: number, authorizerId: number) => {
      if (initiatorId === authorizerId) throw new Error("Initiator and authorizer must be two different people");
      await delay(550);
      persist((s) => ({
        ...s,
        dualControl: { configured: true, require_dual_control: true, initiator_user_id: initiatorId, authorizer_user_id: authorizerId },
      }));
      logAudit("dual_control.assign", "people", "Assigned initiator + authorizer slots");
      // Assigning revokes any operate session — per docs
      tokens.dualControl = null;
      setOperate({ unlocked: false, actingUser: null, actingRole: null, expiresAt: null });
    },
    [persist, logAudit],
  );

  const applyOperateSession = useCallback(
    (payload: {
      access_token?: string;
      session_token?: string;
      dual_control_session?: string;
      inactivity_expires_at?: string;
      user?: { full_name?: string; email?: string; id?: number };
    }) => {
      if (payload.access_token) tokens.orgUser = payload.access_token;
      const sessionTok = payload.session_token || payload.dual_control_session;
      if (sessionTok) tokens.dualControl = sessionTok;
      const email = payload.user?.email || dcEmail.current;
      const user = state.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
      const isInitiator = user ? state.dualControl.initiator_user_id === user.id : true;
      const isAuthorizer = user ? state.dualControl.authorizer_user_id === user.id : false;
      let expiresAt = Date.now() + 3 * 60_000;
      if (payload.inactivity_expires_at) {
        const t = Date.parse(payload.inactivity_expires_at);
        if (!Number.isNaN(t)) expiresAt = t;
      }
      setOperate({
        unlocked: true,
        actingUser: payload.user?.full_name || user?.full_name || email || "Operate user",
        actingRole: isAuthorizer && !isInitiator ? "authorizer" : "initiator",
        expiresAt,
      });
      if (user) {
        persist((s) => ({
          ...s,
          users: s.users.map((u) => (u.id === user.id ? { ...u, last_login_at: new Date().toISOString() } : u)),
        }));
      }
    },
    [persist, state.users, state.dualControl],
  );

  const unlockOperate = useCallback(
    async (email: string, code: string) => {
      if (DEMO_MODE) {
        await delay(800);
        const user = state.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
        if (!user) throw new Error("No organization user with that email");
        const isInitiator = state.dualControl.initiator_user_id === user.id;
        const isAuthorizer = state.dualControl.authorizer_user_id === user.id;
        if (state.dualControl.configured && !isInitiator && !isAuthorizer) {
          throw new Error("Only the assigned initiator or authorizer can open operate sessions");
        }
        if (code.length !== 6) throw new Error("Enter the 6-digit code");
        tokens.orgUser = "demo.org_user.jwt";
        tokens.dualControl = `dc_${crypto.randomUUID()}`;
        setOperate({
          unlocked: true,
          actingUser: user.full_name,
          actingRole: isInitiator ? "initiator" : isAuthorizer ? "authorizer" : "initiator",
          expiresAt: Date.now() + 3 * 60_000,
        });
        persist((s) => ({ ...s, users: s.users.map((u) => (u.id === user.id ? { ...u, last_login_at: new Date().toISOString() } : u)) }));
        return;
      }
      dcEmail.current = email;
      const loginRes = await api.post<{
        mfa_required?: boolean;
        mfa_token?: string;
        destination_masked?: string;
        access_token?: string;
        session_token?: string;
      }>("/org-users/auth/login", {
        email,
        purpose: "dual_control",
        device_id: deviceId(),
      });
      if (loginRes.access_token || loginRes.session_token) {
        applyOperateSession(loginRes);
        return;
      }
      const mfaTok = loginRes.mfa_token || "";
      const mfaRes = await api.post<{
        access_token?: string;
        session_token?: string;
        dual_control_session?: string;
        device_verification_required?: boolean;
        device_token?: string;
        inactivity_expires_at?: string;
        user?: { full_name?: string; email?: string; id?: number };
      }>("/org-users/auth/login/mfa", {
        mfa_token: mfaTok,
        code,
        device_id: deviceId(),
      });
      if (mfaRes.device_verification_required && mfaRes.device_token) {
        throw new Error("Device verification required — use the dual-control overlay");
      }
      applyOperateSession(mfaRes);
    },
    [persist, state.users, state.dualControl, applyOperateSession],
  );

  const closeDualControlPrompt = useCallback((success: boolean) => {
    setDualControlPrompt({ open: false, reason: "" });
    const resolve = dcPromptResolve.current;
    dcPromptResolve.current = null;
    resolve?.(success);
  }, []);

  const requireDualControl = useCallback(
    (reason = "This action requires an active dual-control operate session.") => {
      if (operate.unlocked && tokens.dualControl) return Promise.resolve(true);
      if (!state.dualControl.configured && !DEMO_MODE) {
        toast("warning", "Set up dual control first", "Assign initiator + authorizer under People & Control.");
        return Promise.resolve(false);
      }
      return new Promise<boolean>((resolve) => {
        dcPromptResolve.current = resolve;
        setDualControlPrompt({ open: true, reason });
      });
    },
    [operate.unlocked, state.dualControl.configured, toast],
  );

  const requestDualControlOtp = useCallback(
    async (email: string) => {
      dcEmail.current = email;
      if (DEMO_MODE) {
        await delay(500);
        const user = state.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
        if (state.users.length && !user) throw new Error("No organization user with that email");
        if (user && state.dualControl.configured) {
          const ok =
            state.dualControl.initiator_user_id === user.id || state.dualControl.authorizer_user_id === user.id;
          if (!ok) throw new Error("Only the assigned initiator or authorizer can open operate sessions");
        }
        const devOtp = String(Math.floor(100000 + Math.random() * 900000));
        sessionStorage.setItem("dc_dev_otp", devOtp);
        dcMfaToken.current = "demo-dc-mfa";
        return { destinationMasked: email.replace(/(.{2}).+(@.+)/, "$1***$2"), devOtp };
      }
      const res = await api.post<{
        mfa_required?: boolean;
        mfa_token?: string;
        destination_masked?: string;
        dev_otp?: string;
        access_token?: string;
        session_token?: string;
      }>("/org-users/auth/login", {
        email,
        purpose: "dual_control",
        device_id: deviceId(),
      });
      if (res.access_token || res.session_token) {
        applyOperateSession(res);
        return { destinationMasked: res.destination_masked || email, devOtp: "" };
      }
      dcMfaToken.current = res.mfa_token || "";
      if (!dcMfaToken.current) throw new Error("No MFA challenge returned");
      return {
        destinationMasked: res.destination_masked || email.replace(/(.{2}).+(@.+)/, "$1***$2"),
        devOtp: res.dev_otp || "",
      };
    },
    [state.users, state.dualControl, applyOperateSession],
  );

  const verifyDualControlOtp = useCallback(
    async (code: string) => {
      if (DEMO_MODE) {
        await delay(600);
        const expected = sessionStorage.getItem("dc_dev_otp");
        if (expected && code !== expected) throw new Error("That code isn't right");
        const email = dcEmail.current;
        const user = state.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
        tokens.orgUser = "demo.org_user.jwt";
        tokens.dualControl = `dc_${crypto.randomUUID()}`;
        setOperate({
          unlocked: true,
          actingUser: user?.full_name || email || "Operate user",
          actingRole:
            user && state.dualControl.authorizer_user_id === user.id && state.dualControl.initiator_user_id !== user.id
              ? "authorizer"
              : "initiator",
          expiresAt: Date.now() + 3 * 60_000,
        });
        return { deviceRequired: false };
      }
      const res = await api.post<{
        access_token?: string;
        session_token?: string;
        dual_control_session?: string;
        device_verification_required?: boolean;
        device_token?: string;
        inactivity_expires_at?: string;
        user?: { full_name?: string; email?: string; id?: number };
      }>("/org-users/auth/login/mfa", {
        mfa_token: dcMfaToken.current,
        code,
        device_id: deviceId(),
      });
      if (res.device_verification_required && res.device_token) {
        dcDeviceToken.current = res.device_token;
        return { deviceRequired: true };
      }
      applyOperateSession(res);
      if (!tokens.dualControl) throw new Error("Operate session was not issued");
      return { deviceRequired: false };
    },
    [state.users, state.dualControl, applyOperateSession],
  );

  const confirmDualControlDevice = useCallback(
    async (code: string) => {
      if (DEMO_MODE) {
        tokens.dualControl = `dc_${crypto.randomUUID()}`;
        tokens.orgUser = "demo.org_user.jwt";
        setOperate({
          unlocked: true,
          actingUser: dcEmail.current || "Operate user",
          actingRole: "initiator",
          expiresAt: Date.now() + 3 * 60_000,
        });
        return;
      }
      const res = await api.post<{
        access_token?: string;
        session_token?: string;
        dual_control_session?: string;
        inactivity_expires_at?: string;
        user?: { full_name?: string; email?: string; id?: number };
      }>("/org-users/auth/login/device", {
        device_token: dcDeviceToken.current,
        code,
        device_id: deviceId(),
      });
      applyOperateSession(res);
      if (!tokens.dualControl) throw new Error("Operate session was not issued");
    },
    [applyOperateSession],
  );

  const lockOperate = useCallback(() => {
    if (!DEMO_MODE && tokens.dualControl) {
      void api.post("/org-users/auth/logout", {}).catch(() => {});
    }
    tokens.dualControl = null;
    // keep orgUser for identity reads if needed; clear dual session only
    setOperate({ unlocked: false, actingUser: null, actingRole: null, expiresAt: null });
  }, []);

  const issueLoginLink = useCallback(
    async (userId: number) => {
      await delay(500);
      const secret = `ll_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
      const user = state.users.find((u) => u.id === userId);
      const url = `https://app.phantix.site/login?org=${state.org.slug}&u=${userId}&t=${secret}`;
      persist((s) => ({
        ...s,
        loginLinks: [{ id: s.nextId, user_id: userId, user_name: user?.full_name ?? "", created_at: new Date().toISOString(), used_at: null, status: "active" }, ...s.loginLinks],
        nextId: s.nextId + 1,
      }));
      return url;
    },
    [persist, state.users, state.org.slug],
  );

  const clearDevice = useCallback(
    async (userId: number) => {
      await delay(400);
      const user = state.users.find((u) => u.id === userId);
      logAudit("org_user.clear_device", "people", `Cleared device bind for ${user?.full_name ?? userId}`);
    },
    [logAudit, state.users],
  );

  // ── Connections ──────────────────────────────────────────────────────────
  const refreshConnections = useCallback(async () => {
    if (DEMO_MODE) return;
    try {
      const [connsRes, primaryRes] = await Promise.all([
        api.get<unknown>("/db-connections"),
        api.get<unknown>("/db-connections/primary-security-storage").catch(() => null),
      ]);
      const connections = mapConnectionsFromApi(connsRes);
      if (!connections.length && primaryRes) {
        const p = mapConnectionFromApi(primaryRes);
        if (p) connections.push(p);
      }
      persist((s) => ({ ...s, connections }));
    } catch { /* keep existing */ }
  }, [persist]);

  const createConnection = useCallback(
    async (
      c: Omit<DbConnection, "id" | "bootstrap_status" | "schema_version" | "last_test_at" | "last_test_ok" | "created_at"> & {
        username?: string;
        password?: string;
        ssl_mode?: string;
        environment?: string;
      },
    ) => {
      if (DEMO_MODE) {
        await delay(600);
        persist((s) => ({
          ...s,
          connections: [
            ...s.connections.map((x) => (c.is_primary ? { ...x, is_primary: false } : x)),
            {
              name: c.name,
              connection_purpose: c.connection_purpose,
              db_type: c.db_type,
              host: c.host,
              port: c.port,
              database_name: c.database_name,
              target_schema: c.target_schema,
              is_primary: c.is_primary,
              id: s.nextId,
              bootstrap_status: "not_bootstrapped",
              schema_version: null,
              last_test_at: null,
              last_test_ok: false,
              created_at: new Date().toISOString(),
            },
          ],
          nextId: s.nextId + 1,
        }));
        logAudit("db_connection.create", "connections", `Created connection: ${c.name}`);
        return;
      }
      const needsDc = !!tokens.dualControl;
      await api.post<unknown>(
        "/db-connections",
        {
          name: c.name,
          connection_purpose: c.connection_purpose,
          db_type: c.db_type,
          host: c.host,
          port: c.port,
          database_name: c.database_name,
          username: c.username || undefined,
          password: c.password || undefined,
          ssl_mode: c.ssl_mode || "prefer",
          target_schema: c.target_schema || "phantix",
          is_primary: c.is_primary,
          environment: c.environment || "production",
          auto_bootstrap: false,
        },
        needsDc ? { dualControl: true } : undefined,
      );
      await refreshConnections();
      logAudit("db_connection.create", "connections", `Created connection: ${c.name}`);
    },
    [persist, logAudit, refreshConnections],
  );

  const testConnection = useCallback(
    async (id: number) => {
      if (DEMO_MODE) {
        await delay(1200);
        persist((s) => ({
          ...s,
          connections: s.connections.map((c) => (c.id === id ? { ...c, last_test_at: new Date().toISOString(), last_test_ok: true } : c)),
        }));
        return;
      }
      const needsDc = !!tokens.dualControl;
      await api.post(`/db-connections/${id}/test?auto_bootstrap=false`, undefined, needsDc ? { dualControl: true } : undefined);
      persist((s) => ({
        ...s,
        connections: s.connections.map((c) => (c.id === id ? { ...c, last_test_at: new Date().toISOString(), last_test_ok: true } : c)),
      }));
      await refreshConnections();
    },
    [persist, refreshConnections],
  );

  const bootstrapConnection = useCallback(
    async (id: number) => {
      if (DEMO_MODE) {
        await delay(1600);
        persist((s) => ({
          ...s,
          connections: s.connections.map((c) => (c.id === id ? { ...c, bootstrap_status: "ready" as const, schema_version: "1.4.2" } : c)),
        }));
        logAudit("db_connection.bootstrap", "connections", "Bootstrapped security schema v1.4.2");
        return;
      }
      const needsDc = !!tokens.dualControl;
      const res = await api.post<unknown>(`/db-connections/${id}/bootstrap`, undefined, needsDc ? { dualControl: true } : undefined);
      const row = mapConnectionFromApi(res);
      persist((s) => ({
        ...s,
        connections: s.connections.map((c) =>
          c.id === id
            ? row
              ? { ...c, ...row, bootstrap_status: row.bootstrap_status === "not_bootstrapped" ? "ready" : row.bootstrap_status }
              : { ...c, bootstrap_status: "ready" as const, schema_version: c.schema_version || "1.4.2" }
            : c,
        ),
      }));
      await refreshConnections();
      logAudit("db_connection.bootstrap", "connections", "Bootstrapped security schema");
    },
    [persist, logAudit, refreshConnections],
  );

  const deleteConnection = useCallback(
    async (id: number) => {
      if (DEMO_MODE) {
        await delay(350);
        persist((s) => ({ ...s, connections: s.connections.filter((c) => c.id !== id) }));
        logAudit("db_connection.delete", "connections", `Deleted connection #${id}`);
        return;
      }
      const needsDc = !!tokens.dualControl;
      await api.delete(`/db-connections/${id}`, needsDc ? { dualControl: true } : undefined);
      persist((s) => ({ ...s, connections: s.connections.filter((c) => c.id !== id) }));
      logAudit("db_connection.delete", "connections", `Deleted connection #${id}`);
    },
    [persist, logAudit],
  );

  // ── Companies & keys ─────────────────────────────────────────────────────
  const createCompany = useCallback(
    async (c: { name: string; industry: string; country: string }) => {
      await delay(500);
      persist((s) => ({
        ...s,
        companies: [...s.companies, { id: s.nextId, name: c.name, slug: c.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"), industry: c.industry || null, country: c.country || null, key_prefix: null, created_at: new Date().toISOString() }],
        nextId: s.nextId + 1,
      }));
      logAudit("company.create", "tenancy", `Created child company: ${c.name}`);
    },
    [persist, logAudit],
  );

  const rotateServiceKey = useCallback(
    async (companyId?: number) => {
      await delay(600);
      const secret = `pk_live_${crypto.randomUUID().replace(/-/g, "")}`;
      if (companyId) {
        persist((s) => ({ ...s, companies: s.companies.map((c) => (c.id === companyId ? { ...c, key_prefix: `${secret.slice(0, 12)}…` } : c)) }));
      } else {
        persist((s) => ({
          ...s,
          serviceKey: { id: s.nextId, prefix: `${secret.slice(0, 12)}…`, active: true, created_at: new Date().toISOString(), last_used_at: null },
          nextId: s.nextId + 1,
        }));
      }
      logAudit("service_key.rotate", "tenancy", "Rotated service key");
      return secret;
    },
    [persist, logAudit],
  );

  const revokeServiceKey = useCallback(async () => {
    await delay(400);
    persist((s) => ({ ...s, serviceKey: null }));
    logAudit("service_key.revoke", "tenancy", "Revoked service key");
  }, [persist, logAudit]);

  // ── Misc ─────────────────────────────────────────────────────────────────
  const toggleTool = useCallback(
    async (id: number) => {
      await delay(350);
      persist((s) => ({ ...s, tools: s.tools.map((t) => (t.id === id ? { ...t, subscribed: !t.subscribed } : t)) }));
    },
    [persist],
  );

  const createTicket = useCallback(
    async (subject: string, priority: string, body: string) => {
      await delay(500);
      persist((s) => ({
        ...s,
        tickets: [{ id: s.nextId, subject, priority, status: "open" as const, created_at: new Date().toISOString(), messages: [{ from: "You", body, at: new Date().toISOString() }] }, ...s.tickets],
        nextId: s.nextId + 1,
      }));
    },
    [persist],
  );

  const decidePending = useCallback(
    async (id: number, approve: boolean) => {
      await delay(450);
      persist((s) => ({ ...s, pending: s.pending.map((p) => (p.id === id ? { ...p, status: approve ? "authorized" as const : "rejected" as const } : p)) }));
    },
    [persist],
  );

  const resetDemo = useCallback(() => {
    if (!DEMO_MODE) return;
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem("dev_otp");
    setState(demoState());
  }, []);

  // Live: rehydrate org/setup from API when a company JWT already exists
  React.useEffect(() => {
    if (!DEMO_MODE && tokens.platform) {
      void hydrateSession(session?.email || "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const securityDbReady = isSecurityDbReady(state.connections);

  const value = useMemo<Store>(
    () => ({
      session, state, operate, securityDbReady,
      register, login, verifyMfa, logout, hydrateSession,
      acceptPrivacy, saveIdentity, updateOrgProfile, sendOtp, verifyOtp, startDomainVerification, checkDomain, submitCac, skipCac, requestManualReview, completeSetup,
      createUser, assignDualControl, unlockOperate, lockOperate,
      requireDualControl, dualControlPrompt, closeDualControlPrompt,
      requestDualControlOtp, verifyDualControlOtp, confirmDualControlDevice,
      issueLoginLink, clearDevice,
      refreshConnections, createConnection, testConnection, bootstrapConnection, deleteConnection,
      createCompany, rotateServiceKey, revokeServiceKey, savePreferredServices,
      toggleTool, createTicket, decidePending, resetDemo,
      toasts, toast, dismissToast,
    }),
    [session, state, operate, securityDbReady, toasts, dualControlPrompt,
      register, login, verifyMfa, logout, hydrateSession, acceptPrivacy, saveIdentity, sendOtp, verifyOtp,
      startDomainVerification, checkDomain, submitCac, skipCac, requestManualReview, completeSetup, updateOrgProfile,
      createUser, assignDualControl, unlockOperate, lockOperate,
      requireDualControl, closeDualControlPrompt, requestDualControlOtp, verifyDualControlOtp, confirmDualControlDevice,
      issueLoginLink, clearDevice,
      refreshConnections, createConnection, testConnection, bootstrapConnection, deleteConnection,
      createCompany, rotateServiceKey, revokeServiceKey, savePreferredServices, toggleTool, createTicket, decidePending, resetDemo,
      toast, dismissToast],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore must be used within StoreProvider");
  return s;
}

// ── Toast viewport ────────────────────────────────────────────────────────────
const icons: Record<ToastKind, React.ReactNode> = {
  success: <CheckCircle2 className="text-emerald-400" size={18} />,
  error: <XCircle className="text-severity-critical" size={18} />,
  warning: <AlertTriangle className="text-severity-medium" size={18} />,
  info: <Info className="text-severity-low" size={18} />,
};

export function ToastViewport() {
  const { toasts, dismissToast } = useStore();
  return (
    <div className="fixed bottom-5 right-5 z-[100] flex w-[360px] flex-col gap-2">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, x: 40, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 30, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="glass-bright rounded-xl p-3.5 shadow-card flex items-start gap-3"
          >
            <span className="mt-0.5 shrink-0">{icons[t.kind]}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-100">{t.title}</p>
              {t.body && <p className="mt-0.5 text-xs text-slate-400 leading-5">{t.body}</p>}
            </div>
            <button onClick={() => dismissToast(t.id)} className="shrink-0 rounded-md p-1 text-slate-500 hover:text-slate-200 hover:bg-phantix-700/50">
              <X size={14} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
