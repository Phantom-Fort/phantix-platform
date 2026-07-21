import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from "lucide-react";
import { tokens, DEMO_MODE, delay, api, deviceId } from "./api";
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

// ── Demo tenant ───────────────────────────────────────────────────────────────

const initialOrg: Organization = {
  id: 11,
  name: "Acme Financial Group",
  slug: "acme-financial",
  creator_user_id: 1,
  legal_name: null,
  website: null,
  company_phone: null,
  country: "NG",
  industry: "Financial Services",
  primary_email: "admin@acme.ng",
  plan: "Scale",
  created_at: "2026-07-21T08:00:00Z",
};

const initialSetup: SetupState = {
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
};

const initialUsers: OrgUser[] = [];

const initialConnections: DbConnection[] = [];

const initialCompanies: ChildCompany[] = [];

const initialServiceKey: ServiceKeyMeta | null = null;

const initialAudit: AuditEvent[] = [
  { id: 1, event_key: "org.register", category: "auth", action: "Organization registered", initiator_name: "Account owner", initiator_title: "Primary email", authorizer_name: null, authorizer_title: null, created_at: new Date().toISOString() },
];

const initialTools: ToolItem[] = [
  { id: 1, key: "nmap", name: "Nmap", category: "Discovery", description: "Port & service scanning with admin-pinned flags", subscribed: true, price_note: "Included" },
  { id: 2, key: "nuclei", name: "Nuclei", category: "Vulnerability", description: "Template-driven CVE & misconfiguration engine", subscribed: true, price_note: "Included" },
  { id: 3, key: "subfinder", name: "Subfinder", category: "Discovery", description: "Passive subdomain enumeration", subscribed: true, price_note: "Included" },
  { id: 4, key: "katana", name: "Katana", category: "Recon", description: "Web crawling for the web_scan pipeline", subscribed: false, price_note: "Add-on" },
  { id: 5, key: "sqlmap", name: "SQLMap", category: "Exploitation", description: "Parameterized SQLi confirmation", subscribed: false, price_note: "Add-on" },
  { id: 6, key: "gowitness", name: "Gowitness", category: "Evidence", description: "Screenshot capture for report evidence", subscribed: false, price_note: "Add-on" },
];

const initialPayments: Payment[] = [
  { id: 1, reference: "PHX-2026-0711", amount_ngn: 500, status: "paid", period: "July 2026 (first month −50%)", created_at: "2026-07-01T09:00:00Z" },
  { id: 2, reference: "PHX-2026-0811", amount_ngn: 1000, status: "pending", period: "August 2026", created_at: "2026-08-01T09:00:00Z" },
];

const initialTickets: SupportTicket[] = [];

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
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PersistedState) : null;
  } catch {
    return null;
  }
}

const freshState = (): PersistedState => ({
  org: initialOrg,
  setup: initialSetup,
  users: initialUsers,
  dualControl: { configured: false, require_dual_control: false, initiator_user_id: null, authorizer_user_id: null },
  connections: initialConnections,
  companies: initialCompanies,
  serviceKey: initialServiceKey,
  loginLinks: [],
  audit: initialAudit,
  pending: [],
  tools: initialTools,
  payments: initialPayments,
  tickets: initialTickets,
  nextId: 100,
});

type Store = {
  session: Session;
  state: PersistedState;
  operate: OperateState;
  securityDbReady: boolean;
  // auth
  register: (name: string, email: string, password: string, country: string) => Promise<void>;
  login: (email: string, password: string) => Promise<{ mfaRequired: boolean }>;
  verifyMfa: (code: string) => Promise<void>;
  logout: () => void;
  // setup wizard
  acceptPrivacy: () => Promise<void>;
  saveIdentity: (fields: { website: string; legal_name: string; company_phone: string }) => Promise<void>;
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
  issueLoginLink: (userId: number) => Promise<string>;
  clearDevice: (userId: number) => Promise<void>;
  // connections
  createConnection: (c: Omit<DbConnection, "id" | "bootstrap_status" | "schema_version" | "last_test_at" | "last_test_ok" | "created_at">) => Promise<void>;
  testConnection: (id: number) => Promise<void>;
  bootstrapConnection: (id: number) => Promise<void>;
  deleteConnection: (id: number) => Promise<void>;
  // companies & keys
  createCompany: (c: { name: string; industry: string; country: string }) => Promise<void>;
  rotateServiceKey: (companyId?: number) => Promise<string>;
  revokeServiceKey: () => Promise<void>;
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
  const [state, setState] = useState<PersistedState>(() => loadPersisted() ?? freshState());
  const [session, setSession] = useState<Session>(() =>
    tokens.platform ? { authenticated: true, email: "admin@acme.ng" } : null,
  );
  const [operate, setOperate] = useState<OperateState>(() =>
    tokens.dualControl
      ? { unlocked: true, actingUser: "Operate user", actingRole: "initiator", expiresAt: Date.now() + 3 * 60_000 }
      : { unlocked: false, actingUser: null, actingRole: null, expiresAt: null },
  );
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  const persist = useCallback((updater: (s: PersistedState) => PersistedState) => {
    setState((prev) => {
      const next = updater(prev);
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch { /* quota */ }
      return next;
    });
  }, []);

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
    async (name: string, email: string, _password: string, country: string) => {
      if (DEMO_MODE) {
        await delay(700);
        persist((s) => ({
          ...s,
          org: { ...s.org, name, primary_email: email, country, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") },
          audit: [{ id: s.nextId, event_key: "org.register", category: "auth", action: `Organization registered: ${name}`, initiator_name: email, initiator_title: "Primary email", authorizer_name: null, authorizer_title: null, created_at: new Date().toISOString() }, ...s.audit],
          nextId: s.nextId + 1,
        }));
        tokens.platform = "demo.company.jwt";
        setSession({ authenticated: true, email });
        return;
      }
      await api.post("/organizations/register", { name, email, password: _password, country });
      const res = await api.postForm<{ access_token: string }>("/organizations/login", { username: email, password: _password });
      tokens.platform = res.access_token;
      setSession({ authenticated: true, email });
    },
    [persist],
  );

  const login = useCallback(async (email: string, password: string) => {
    if (DEMO_MODE) {
      await delay(650);
      if (!email.includes("@")) throw new Error("Enter a valid company email");
      sessionStorage.setItem("mfa_token", "demo-mfa");
      return { mfaRequired: true };
    }
    const res = await api.postForm<{ access_token?: string; mfa_required?: boolean; mfa_token?: string }>(
      "/organizations/login",
      { username: email, password },
    );
    if (res.access_token) {
      tokens.platform = res.access_token;
      setSession({ authenticated: true, email });
      return { mfaRequired: false };
    }
    sessionStorage.setItem("mfa_token", res.mfa_token ?? "");
    return { mfaRequired: true };
  }, []);

  const verifyMfa = useCallback(async (code: string) => {
    if (DEMO_MODE) {
      await delay(700);
      if (code.length !== 6) throw new Error("Enter the 6-digit code");
      tokens.platform = "demo.company.jwt";
      setSession({ authenticated: true, email: state.org.primary_email });
      return;
    }
    const res = await api.post<{ access_token: string }>("/organizations/login/mfa", {
      mfa_token: sessionStorage.getItem("mfa_token"),
      code,
    });
    tokens.platform = res.access_token;
    setSession({ authenticated: true, email: "" });
  }, [state.org.primary_email]);

  const logout = useCallback(() => {
    tokens.platform = null;
    tokens.orgUser = null;
    tokens.dualControl = null;
    setSession(null);
    setOperate({ unlocked: false, actingUser: null, actingRole: null, expiresAt: null });
  }, []);

  // ── Setup wizard ─────────────────────────────────────────────────────────
  const acceptPrivacy = useCallback(async () => {
    await delay(400);
    persist((s) => ({ ...s, setup: { ...s.setup, privacy_accepted: true, privacy_accepted_at: new Date().toISOString() } }));
    logAudit("setup.privacy_accept", "setup", "Accepted the privacy notice");
  }, [persist, logAudit]);

  const saveIdentity = useCallback(
    async (fields: { website: string; legal_name: string; company_phone: string }) => {
      await delay(400);
      persist((s) => ({
        ...s,
        org: { ...s.org, website: fields.website || null, legal_name: fields.legal_name || null, company_phone: fields.company_phone || null },
        setup: { ...s.setup, identity_saved: true },
      }));
    },
    [persist],
  );

  const sendOtp = useCallback(async () => {
    if (DEMO_MODE) {
      await delay(600);
      const devOtp = String(Math.floor(100000 + Math.random() * 900000));
      sessionStorage.setItem("dev_otp", devOtp);
      persist((s) => ({ ...s, setup: { ...s.setup, email_otp_sent: true, email_otp_destination: s.org.primary_email } }));
      return { devOtp };
    }
    await api.post("/organizations/me/setup/otp/send", { channel: "email" });
    return { devOtp: "" };
  }, [persist]);

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
    },
    [persist, logAudit],
  );

  const startDomainVerification = useCallback(
    async (domain: string) => {
      await delay(600);
      const token = `phx_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
      persist((s) => ({ ...s, setup: { ...s.setup, domain, domain_token: token, domain_dns_ok: false, domain_http_ok: false } }));
      return token;
    },
    [persist],
  );

  const checkDomain = useCallback(
    async (method: "auto" | "dns" | "http") => {
      await delay(1400);
      persist((s) => {
        const dnsOk = s.setup.domain_dns_ok || method !== "http";
        const httpOk = s.setup.domain_http_ok || method !== "dns";
        return { ...s, setup: { ...s.setup, domain_dns_ok: dnsOk, domain_http_ok: httpOk } };
      });
      logAudit("setup.domain_verify", "setup", "Domain verification check passed");
    },
    [persist, logAudit],
  );

  const submitCac = useCallback(
    async (_cac: string, _rc: string) => {
      await delay(500);
      persist((s) => ({ ...s, setup: { ...s.setup, cac_submitted: true } }));
      logAudit("setup.cac", "setup", "Submitted CAC / RC details");
    },
    [persist, logAudit],
  );

  const skipCac = useCallback(async () => {
    await delay(250);
    persist((s) => ({ ...s, setup: { ...s.setup, cac_skipped: true } }));
  }, [persist]);

  const requestManualReview = useCallback(async () => {
    await delay(500);
    persist((s) => ({ ...s, setup: { ...s.setup, manual_review: "pending" } }));
    logAudit("setup.manual_review", "setup", "Requested manual company review");
  }, [persist, logAudit]);

  const completeSetup = useCallback(async () => {
    await delay(600);
    persist((s) => {
      if (!s.setup.privacy_accepted || !s.setup.identity_verified) return s;
      const companyVerified = (s.setup.domain_dns_ok || s.setup.domain_http_ok) || s.setup.cac_submitted || s.setup.manual_review === "approved";
      return {
        ...s,
        setup: {
          ...s.setup,
          manual_review: s.setup.manual_review === "none" && !companyVerified ? s.setup.manual_review : s.setup.manual_review,
          setup_complete: true,
        },
      };
    });
    logAudit("setup.complete", "setup", "Completed organization setup");
  }, [persist, logAudit]);

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

  const unlockOperate = useCallback(
    async (email: string, code: string) => {
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
    },
    [persist, state.users, state.dualControl],
  );

  const lockOperate = useCallback(() => {
    tokens.dualControl = null;
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
  const createConnection = useCallback(
    async (c: Omit<DbConnection, "id" | "bootstrap_status" | "schema_version" | "last_test_at" | "last_test_ok" | "created_at">) => {
      await delay(600);
      persist((s) => ({
        ...s,
        connections: [
          ...s.connections.map((x) => (c.is_primary ? { ...x, is_primary: false } : x)),
          { ...c, id: s.nextId, bootstrap_status: "not_bootstrapped", schema_version: null, last_test_at: null, last_test_ok: false, created_at: new Date().toISOString() },
        ],
        nextId: s.nextId + 1,
      }));
      logAudit("db_connection.create", "connections", `Created connection: ${c.name}`);
    },
    [persist, logAudit],
  );

  const testConnection = useCallback(
    async (id: number) => {
      await delay(1200);
      persist((s) => ({
        ...s,
        connections: s.connections.map((c) => (c.id === id ? { ...c, last_test_at: new Date().toISOString(), last_test_ok: true } : c)),
      }));
    },
    [persist],
  );

  const bootstrapConnection = useCallback(
    async (id: number) => {
      await delay(1600);
      persist((s) => ({
        ...s,
        connections: s.connections.map((c) => (c.id === id ? { ...c, bootstrap_status: "ready" as const, schema_version: "1.4.2" } : c)),
      }));
      logAudit("db_connection.bootstrap", "connections", "Bootstrapped security schema v1.4.2");
    },
    [persist, logAudit],
  );

  const deleteConnection = useCallback(
    async (id: number) => {
      await delay(350);
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
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem("dev_otp");
    setState(freshState());
  }, []);

  const securityDbReady = state.connections.some((c) => c.connection_purpose === "security_data_storage" && c.bootstrap_status === "ready");

  const value = useMemo<Store>(
    () => ({
      session, state, operate, securityDbReady,
      register, login, verifyMfa, logout,
      acceptPrivacy, saveIdentity, sendOtp, verifyOtp, startDomainVerification, checkDomain, submitCac, skipCac, requestManualReview, completeSetup,
      createUser, assignDualControl, unlockOperate, lockOperate, issueLoginLink, clearDevice,
      createConnection, testConnection, bootstrapConnection, deleteConnection,
      createCompany, rotateServiceKey, revokeServiceKey,
      toggleTool, createTicket, decidePending, resetDemo,
      toasts, toast, dismissToast,
    }),
    [session, state, operate, securityDbReady, toasts,
      register, login, verifyMfa, logout, acceptPrivacy, saveIdentity, sendOtp, verifyOtp,
      startDomainVerification, checkDomain, submitCac, skipCac, requestManualReview, completeSetup,
      createUser, assignDualControl, unlockOperate, lockOperate, issueLoginLink, clearDevice,
      createConnection, testConnection, bootstrapConnection, deleteConnection,
      createCompany, rotateServiceKey, revokeServiceKey, toggleTool, createTicket, decidePending, resetDemo,
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
