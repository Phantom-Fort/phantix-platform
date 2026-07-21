// ── Platform surface types (platform.phantix.site) ───────────────────────────

export interface Organization {
  id: number;
  name: string;
  slug: string;
  creator_user_id: number | null;
  legal_name: string | null;
  website: string | null;
  company_phone: string | null;
  country: string;
  industry: string;
  primary_email: string;
  plan: string;
  created_at: string;
}

export interface OrgUser {
  id: number;
  full_name: string;
  email: string;
  title: string;
  role: string;
  otp_only: boolean;
  is_active: boolean;
  last_login_at: string | null;
}

export interface ChildCompany {
  id: number;
  name: string;
  slug: string;
  industry: string | null;
  country: string | null;
  key_prefix: string | null;
  created_at: string;
}

export interface ServiceKeyMeta {
  id: number;
  prefix: string;
  active: boolean;
  created_at: string;
  last_used_at: string | null;
}

export interface LoginLink {
  id: number;
  user_id: number;
  user_name: string;
  created_at: string;
  used_at: string | null;
  status: "active" | "used" | "expired";
}

export interface DbConnection {
  id: number;
  name: string;
  connection_purpose: "security_data_storage" | "config_inspection";
  db_type: string;
  host: string;
  port: number;
  database_name: string;
  target_schema: string;
  is_primary: boolean;
  bootstrap_status: "ready" | "pending" | "failed" | "not_bootstrapped";
  schema_version: string | null;
  last_test_at: string | null;
  last_test_ok: boolean;
  created_at: string;
}

export interface AuditEvent {
  id: number;
  event_key: string;
  category: string;
  action: string;
  initiator_name: string | null;
  initiator_title: string | null;
  authorizer_name: string | null;
  authorizer_title: string | null;
  created_at: string;
}

export interface PendingAction {
  id: number;
  action_key: string;
  action_label: string;
  category: string;
  initiated_by: string;
  status: "pending" | "authorized" | "rejected";
  created_at: string;
}

export interface ToolItem {
  id: number;
  key: string;
  name: string;
  category: string;
  description: string;
  subscribed: boolean;
  price_note: string;
}

export interface Payment {
  id: number;
  reference: string;
  amount_ngn: number;
  status: "paid" | "pending" | "failed";
  period: string;
  created_at: string;
}

export interface SupportTicket {
  id: number;
  subject: string;
  status: "open" | "pending" | "closed";
  priority: string;
  created_at: string;
  messages: { from: string; body: string; at: string }[];
}

// ── Setup wizard state (mirrors GET /organizations/me/setup) ─────────────────
export interface SetupState {
  privacy_accepted: boolean;
  privacy_accepted_at: string | null;
  identity_saved: boolean;
  email_otp_sent: boolean;
  email_otp_destination: string | null;
  identity_verified: boolean; // email OTP verified
  domain: string | null;
  domain_token: string | null;
  domain_dns_ok: boolean;
  domain_http_ok: boolean;
  cac_submitted: boolean;
  cac_skipped: boolean;
  manual_review: "none" | "pending" | "approved" | "rejected";
  setup_complete: boolean;
}

export interface DualControlAssignment {
  configured: boolean;
  require_dual_control: boolean;
  initiator_user_id: number | null;
  authorizer_user_id: number | null;
}
