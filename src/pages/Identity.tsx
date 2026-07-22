import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Building2, KeyRound, RefreshCw, ImagePlus, AlertTriangle, CheckCircle2, Layers, Save, User,
} from "lucide-react";
import { PageHeader, Card, CardHeader, StatusBadge, Modal, CopyChip, Tabs } from "@/components/ui";
import { useStore } from "@/lib/store";
import type { Organization, OrgContact } from "@/lib/types";
import { timeAgo, cx } from "@/lib/utils";

/** Allowed by PUT /organizations/me/preferred-services (API enum). */
const serviceCatalog = [
  { key: "penetration_testing", name: "Penetration testing", desc: "Engagement-style assessments & VAPT" },
  { key: "vulnerability_management", name: "Vulnerability management", desc: "Continuous vuln discovery & tracking" },
  { key: "red_team", name: "Red team", desc: "Adversary simulation" },
  { key: "blue_team", name: "Blue team", desc: "Detection & defense operations" },
  { key: "purple_team", name: "Purple team", desc: "Collaborative attack/defense" },
  { key: "mssp", name: "MSSP", desc: "Managed security service provider" },
  { key: "soc_as_a_service", name: "SOC as a service", desc: "Outsourced security operations centre" },
  { key: "incident_response", name: "Incident response", desc: "IR retainers and playbooks" },
  { key: "threat_intelligence", name: "Threat intelligence", desc: "Intel feeds and analysis" },
  { key: "security_awareness", name: "Security awareness", desc: "Training and phishing simulations" },
  { key: "compliance_audit", name: "Compliance & audit", desc: "Frameworks, GRC, evidence" },
  { key: "cloud_security", name: "Cloud security", desc: "CSPM and cloud posture" },
  { key: "application_security", name: "Application security", desc: "AppSec and secure SDLC" },
  { key: "ot_security", name: "OT security", desc: "Industrial / operational technology" },
  { key: "other", name: "Other", desc: "Custom or unlisted services" },
];

const ALLOWED_SERVICES = new Set(serviceCatalog.map((s) => s.key));

const industries = [
  "technology", "financial_services", "fintech", "healthcare", "government",
  "education", "retail", "manufacturing", "telecom", "energy", "other",
];

const employeeRanges = ["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+", ""];
const revenueRanges = ["under-100k", "100k-1m", "1m-10m", "10m-50m", "50m+", ""];
const companyTypes = ["private_limited", "public_limited", "llc", "sole_proprietor", "nonprofit", "government", ""];
const maturityLevels = ["initial", "developing", "defined", "managed", "optimizing", ""];
const contactTitles = ["mr", "mrs", "ms", "miss", "dr", "prof", "eng"];

function emptyContact(): OrgContact {
  return { title: "mr", name: "", email: "", phone: null, whatsapp_username: null, telegram_username: null };
}

export default function Identity() {
  const {
    state, rotateServiceKey, revokeServiceKey, updateOrgProfile, savePreferredServices,
    uploadLogo, deleteLogo, toast, operate, requireDualControl, hydrateSession,
  } = useStore();
  const [tab, setTab] = useState("overview");
  const [keyModal, setKeyModal] = useState<string | null>(null);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [preferred, setPreferred] = useState<string[]>(() =>
    (state.org.preferred_services ?? ["vulnerability_management", "penetration_testing", "compliance_audit"]).filter((k) =>
      ALLOWED_SERVICES.has(k),
    ),
  );
  const [form, setForm] = useState<Organization>(state.org);
  const [busy, setBusy] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const logoInputRef = React.useRef<HTMLInputElement>(null);
  const key = state.serviceKey;

  const onLogoSelected = async (file: File | null) => {
    if (!file) return;
    const allowed = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml"];
    if (!allowed.includes(file.type) && !/\.(png|jpe?g|webp|svg)$/i.test(file.name)) {
      toast("error", "Invalid file", "Use PNG, JPEG, WebP, or SVG.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast("error", "File too large", "Logo must be 2MB or smaller.");
      return;
    }
    if (state.dualControl.configured && !operate.unlocked) {
      if (!(await requireDualControl("Uploading a company logo requires a dual-control operate session."))) return;
    }
    setLogoBusy(true);
    try {
      await uploadLogo(file);
      toast("success", "Logo uploaded", "POST /organizations/me/logo — used on report covers and footers.");
    } catch (err) {
      toast("error", "Upload failed", err instanceof Error ? err.message : "Could not upload logo");
    } finally {
      setLogoBusy(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  };

  const onLogoRemove = async () => {
    if (state.dualControl.configured && !operate.unlocked) {
      if (!(await requireDualControl("Removing the company logo requires a dual-control operate session."))) return;
    }
    setLogoBusy(true);
    try {
      await deleteLogo();
      toast("success", "Logo removed", "DELETE /organizations/me/logo");
    } catch (err) {
      toast("error", "Remove failed", err instanceof Error ? err.message : "Could not remove logo");
    } finally {
      setLogoBusy(false);
    }
  };

  useEffect(() => {
    void hydrateSession();
  }, [hydrateSession]);

  const normalize: Record<string, string> = {
    soc2: "soc_2", health: "phi", payment_cards: "pci",
  };

  useEffect(() => {
    const org = { ...state.org };
    const normalizeList = (field: "compliance_frameworks" | "data_types_handled") => {
      if (org[field]) {
        org[field] = org[field].map((v) => normalize[v] ?? v).filter((v) => v);
      }
    };
    normalizeList("compliance_frameworks");
    normalizeList("data_types_handled");
    setForm(org);
    if (state.org.preferred_services?.length) {
      setPreferred(state.org.preferred_services.filter((k) => ALLOWED_SERVICES.has(k)));
    }
  }, [state.org]);

  const set = <K extends keyof Organization>(k: K, v: Organization[K]) => setForm((f) => ({ ...f, [k]: v }));

  const setContact = (which: "primary_contact" | "secondary_contact", field: keyof OrgContact, value: string) => {
    setForm((f) => {
      const cur = f[which] ?? emptyContact();
      return { ...f, [which]: { ...cur, [field]: value || null } };
    });
  };

  const toggleList = (field: "compliance_frameworks" | "data_types_handled" | "infrastructure_types" | "cloud_providers", value: string) => {
    setForm((f) => {
      const cur = new Set(f[field] ?? []);
      if (cur.has(value)) cur.delete(value);
      else cur.add(value);
      return { ...f, [field]: Array.from(cur) };
    });
  };

  const saveProfile = async () => {
    if (state.dualControl.configured && !operate.unlocked) {
      if (!(await requireDualControl("Updating organization profile requires a dual-control operate session."))) return;
    }
    setBusy(true);
    try {
      await updateOrgProfile(form);
      toast("success", "Profile saved", "PUT /organizations/me");
    } catch (err) {
      toast("error", "Save failed", err instanceof Error ? err.message : "Could not update profile");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1200px]">
      <PageHeader
        title="Identity & profile"
        description="Company tenant profile from GET /organizations/me — identity, contacts, security posture, branding, and service key."
      />

      <Tabs
        tabs={[
          { id: "overview", label: "Overview" },
          { id: "profile", label: "Company profile" },
          { id: "security", label: "Security posture" },
          { id: "keys", label: "Keys & branding" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "overview" && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <CardHeader title="Tenant identity" subtitle="GET /organizations/me" action={<Building2 size={16} className="text-slate-500" />} />
              <div className="space-y-2.5">
                {[
                  ["Organization", state.org.name],
                  ["Tenant ID", `#${state.org.id}`],
                  ["Slug", state.org.slug],
                  ["Primary email", state.org.email || state.org.primary_email || "—"],
                  ["Secondary email", state.org.secondary_email || "—"],
                  ["Country", state.org.country || "—"],
                  ["Industry", state.org.industry || "—"],
                  ["Plan", state.org.plan || "—"],
                ].map(([k, v]) => (
                  <div key={k} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-phantix-700/40 bg-phantix-950/50 px-4 py-3">
                    <span className="text-xs font-medium uppercase tracking-wider text-slate-500">{k}</span>
                    <CopyChip value={String(v)} />
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {[
                  ["Setup", state.org.setup_completed || state.setup.setup_complete],
                  ["Email OTP", state.org.email_verified || state.org.identity_verified || state.setup.identity_verified],
                  ["Company", state.org.company_verified],
                  ["Domain", state.org.domain_verified],
                  ["Privacy", state.org.privacy_notice_accepted || state.setup.privacy_accepted],
                ].map(([label, ok]) => (
                  <span key={String(label)} className={cx("chip", ok ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-phantix-700/50 text-slate-500")}>
                    {ok ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />} {String(label)}
                  </span>
                ))}
              </div>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
            <Card>
              <CardHeader title="Primary contact" subtitle="Registration / security contact" action={<User size={16} className="text-slate-500" />} />
              {state.org.primary_contact ? (
                <div className="space-y-2 text-sm text-slate-300">
                  <p className="font-semibold text-slate-100 capitalize">
                    {state.org.primary_contact.title} {state.org.primary_contact.name}
                  </p>
                  <p className="text-xs text-slate-500">{state.org.primary_contact.email}</p>
                  {state.org.primary_contact.phone && <p className="text-xs text-slate-500">{state.org.primary_contact.phone}</p>}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No primary contact on file — edit Company profile.</p>
              )}
              <div className="mt-5 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl border border-phantix-700/40 bg-phantix-950/50 p-3">
                  <p className="text-slate-500">Website</p>
                  <p className="mt-1 truncate text-slate-200">{state.org.website || "—"}</p>
                </div>
                <div className="rounded-xl border border-phantix-700/40 bg-phantix-950/50 p-3">
                  <p className="text-slate-500">Phone</p>
                  <p className="mt-1 text-slate-200">{state.org.phone || "—"}</p>
                </div>
                <div className="rounded-xl border border-phantix-700/40 bg-phantix-950/50 p-3 col-span-2">
                  <p className="text-slate-500">Legal name</p>
                  <p className="mt-1 text-slate-200">{state.org.legal_name || "—"}</p>
                </div>
              </div>
              <button className="btn-secondary mt-4 w-full" onClick={() => setTab("profile")}>Edit full profile</button>
            </Card>
          </motion.div>
        </div>
      )}

      {tab === "profile" && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
          <Card>
            <CardHeader title="Company details" subtitle="PUT /organizations/me" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Name"><input className="input" value={form.name} onChange={(e) => set("name", e.target.value)} /></Field>
              <Field label="Legal name"><input className="input" value={form.legal_name ?? ""} onChange={(e) => set("legal_name", e.target.value || null)} /></Field>
              <Field label="Registration number"><input className="input" value={form.registration_number ?? ""} onChange={(e) => set("registration_number", e.target.value || null)} /></Field>
              <Field label="Tax ID"><input className="input" value={form.tax_id ?? ""} onChange={(e) => set("tax_id", e.target.value || null)} /></Field>
              <Field label="Company type">
                <select className="input" value={form.company_type ?? ""} onChange={(e) => set("company_type", e.target.value || null)}>
                  <option value="">—</option>
                  {companyTypes.filter(Boolean).map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Year founded"><input className="input" type="number" value={form.year_founded ?? ""} onChange={(e) => set("year_founded", e.target.value ? Number(e.target.value) : null)} /></Field>
              <Field label="Industry">
                <select className="input" value={form.industry} onChange={(e) => set("industry", e.target.value)}>
                  {industries.map((i) => <option key={i} value={i}>{i}</option>)}
                </select>
              </Field>
              <Field label="Sub-industry"><input className="input" value={form.sub_industry ?? ""} onChange={(e) => set("sub_industry", e.target.value || null)} /></Field>
              <Field label="Employees">
                <select className="input" value={form.employee_count_range ?? ""} onChange={(e) => set("employee_count_range", e.target.value || null)}>
                  <option value="">—</option>
                  {employeeRanges.filter(Boolean).map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </Field>
              <Field label="Annual revenue">
                <select className="input" value={form.annual_revenue_range ?? ""} onChange={(e) => set("annual_revenue_range", e.target.value || null)}>
                  <option value="">—</option>
                  {revenueRanges.filter(Boolean).map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </Field>
              <Field label="Website"><input className="input" value={form.website ?? ""} onChange={(e) => set("website", e.target.value || null)} /></Field>
              <Field label="Phone"><input className="input" value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value || null)} /></Field>
              <Field label="Secondary email"><input className="input" value={form.secondary_email ?? ""} onChange={(e) => set("secondary_email", e.target.value || null)} /></Field>
              <Field label="Timezone"><input className="input" placeholder="Africa/Lagos" value={form.timezone ?? ""} onChange={(e) => set("timezone", e.target.value || null)} /></Field>
              <Field label="Country"><input className="input" value={form.country} onChange={(e) => set("country", e.target.value)} /></Field>
              <Field label="City"><input className="input" value={form.city ?? ""} onChange={(e) => set("city", e.target.value || null)} /></Field>
              <Field label="State / province"><input className="input" value={form.state_province ?? ""} onChange={(e) => set("state_province", e.target.value || null)} /></Field>
              <Field label="Postal code"><input className="input" value={form.postal_code ?? ""} onChange={(e) => set("postal_code", e.target.value || null)} /></Field>
              <div className="sm:col-span-2">
                <Field label="Address line 1"><input className="input" value={form.address_line1 ?? ""} onChange={(e) => set("address_line1", e.target.value || null)} /></Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Address line 2"><input className="input" value={form.address_line2 ?? ""} onChange={(e) => set("address_line2", e.target.value || null)} /></Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Description"><textarea className="input min-h-[80px]" value={form.description ?? ""} onChange={(e) => set("description", e.target.value || null)} /></Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Internal notes"><textarea className="input min-h-[60px]" value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value || null)} /></Field>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Contacts" subtitle="Primary and secondary people" />
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {(["primary_contact", "secondary_contact"] as const).map((which) => {
                const c = form[which] ?? emptyContact();
                return (
                  <div key={which} className="rounded-xl border border-phantix-700/40 bg-phantix-950/40 p-4">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">{which === "primary_contact" ? "Primary" : "Secondary"}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <select className="input" value={c.title ?? "mr"} onChange={(e) => setContact(which, "title", e.target.value)}>
                        {contactTitles.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <input className="input" placeholder="Full name" value={c.name ?? ""} onChange={(e) => setContact(which, "name", e.target.value)} />
                      <input className="input col-span-2" placeholder="email" value={c.email ?? ""} onChange={(e) => setContact(which, "email", e.target.value)} />
                      <input className="input" placeholder="phone" value={c.phone ?? ""} onChange={(e) => setContact(which, "phone", e.target.value)} />
                      <input className="input" placeholder="whatsapp" value={c.whatsapp_username ?? ""} onChange={(e) => setContact(which, "whatsapp_username", e.target.value)} />
                      <input className="input col-span-2" placeholder="telegram" value={c.telegram_username ?? ""} onChange={(e) => setContact(which, "telegram_username", e.target.value)} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <button className="btn-primary" disabled={busy} onClick={() => void saveProfile()}>
            <Save size={15} /> {busy ? "Saving…" : "Save company profile"}
          </button>
        </motion.div>
      )}

      {tab === "security" && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
          <Card>
            <CardHeader title="Security & compliance posture" subtitle="Used for recommendations and experience" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Security mailbox"><input className="input" value={form.security_mailbox ?? ""} onChange={(e) => set("security_mailbox", e.target.value || null)} /></Field>
              <Field label="Security maturity">
                <select className="input" value={form.security_maturity ?? ""} onChange={(e) => set("security_maturity", e.target.value || null)}>
                  <option value="">—</option>
                  {maturityLevels.filter(Boolean).map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </Field>
              <Field label="Security team size"><input className="input" value={form.security_team_size ?? ""} onChange={(e) => set("security_team_size", e.target.value || null)} /></Field>
              <Field label="Critical assets summary"><input className="input" value={form.critical_assets_summary ?? ""} onChange={(e) => set("critical_assets_summary", e.target.value || null)} /></Field>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={form.has_dedicated_security_team} onChange={(e) => set("has_dedicated_security_team", e.target.checked)} />
                Dedicated security team
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={form.has_ciso} onChange={(e) => set("has_ciso", e.target.checked)} />
                Has CISO
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={form.previous_breach} onChange={(e) => set("previous_breach", e.target.checked)} />
                Previous breach
              </label>
              <div className="sm:col-span-2">
                <Field label="Breach notes"><textarea className="input min-h-[60px]" value={form.previous_breach_notes ?? ""} onChange={(e) => set("previous_breach_notes", e.target.value || null)} /></Field>
              </div>
            </div>

            <ChipGroup
              title="Compliance frameworks"
              options={["iso_27001", "soc_2", "pci_dss", "gdpr", "ndpr", "hipaa", "nist_csf", "cis_controls", "cbn_risk_based", "swift_csp", "iso_27701", "other"]}
              selected={form.compliance_frameworks ?? []}
              onToggle={(v) => toggleList("compliance_frameworks", v)}
            />
            <ChipGroup
              title="Data types handled"
              options={["pii", "phi", "pci", "financial", "credentials", "intellectual_property", "government", "biometric", "other"]}
              selected={form.data_types_handled ?? []}
              onToggle={(v) => toggleList("data_types_handled", v)}
            />
            <ChipGroup
              title="Infrastructure"
              options={["cloud", "on_prem", "hybrid", "saas", "container", "serverless"]}
              selected={form.infrastructure_types ?? []}
              onToggle={(v) => toggleList("infrastructure_types", v)}
            />
            <ChipGroup
              title="Cloud providers"
              options={["aws", "gcp", "azure", "digitalocean", "other"]}
              selected={form.cloud_providers ?? []}
              onToggle={(v) => toggleList("cloud_providers", v)}
            />
          </Card>
          <button className="btn-primary" disabled={busy} onClick={() => void saveProfile()}>
            <Save size={15} /> {busy ? "Saving…" : "Save security posture"}
          </button>
        </motion.div>
      )}

      {tab === "keys" && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <CardHeader title="Service key" subtitle="Exactly one active key per company — X-Org-Api-Key" action={<KeyRound size={16} className="text-slate-500" />} />
              {key ? (
                <>
                  <div className="rounded-xl border border-phantix-700/40 bg-phantix-950/50 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-mono text-sm text-slate-200">{key.prefix}</span>
                        <p className="mt-0.5 text-[10px] text-slate-600">De-identified — the full key was shown only at creation</p>
                      </div>
                      <StatusBadge status="active" />
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      Created {timeAgo(key.created_at)} · {key.last_used_at ? `last used ${timeAgo(key.last_used_at)}` : "never used"}
                    </p>
                  </div>
                  <div className="mt-4 flex gap-2.5">
                    <button
                      className="btn-primary flex-1"
                      onClick={async () => {
                        if (!operate.unlocked && !(await requireDualControl("Service key rotation requires a dual-control operate session."))) return;
                        setKeyModal(await rotateServiceKey());
                      }}
                    >
                      <RefreshCw size={14} /> Rotate
                    </button>
                    <button className="btn-danger" onClick={() => setRevokeOpen(true)}>Revoke</button>
                  </div>
                </>
              ) : (
                <button
                  className="btn-primary w-full"
                  onClick={async () => {
                    if (!operate.unlocked && !(await requireDualControl("Creating a service key requires a dual-control operate session."))) return;
                    setKeyModal(await rotateServiceKey());
                  }}
                >
                  <KeyRound size={14} /> Create service key
                </button>
              )}
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
            <Card>
              <CardHeader title="Report branding" subtitle="POST/DELETE /organizations/me/logo — PNG/JPEG/WebP/SVG, max 2MB" action={<ImagePlus size={16} className="text-slate-500" />} />
              <div className="flex items-center gap-4 rounded-xl border border-phantix-700/40 bg-phantix-950/50 p-4">
                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl bg-phantix-800/70">
                  {state.org.logo_url ? (
                    <img src={state.org.logo_url} alt="" className="h-full w-full object-contain" />
                  ) : (
                    <span className="font-display text-lg font-bold text-gold-400">{(state.org.name || "?").slice(0, 1)}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-200">{state.org.name}</p>
                  <p className="text-xs text-slate-500">Used on report cover pages and footers</p>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml,.png,.jpg,.jpeg,.webp,.svg"
                    className="hidden"
                    onChange={(e) => void onLogoSelected(e.target.files?.[0] ?? null)}
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      className="btn-secondary !py-2 !text-xs"
                      disabled={logoBusy}
                      onClick={() => logoInputRef.current?.click()}
                    >
                      {logoBusy ? "Working…" : "Upload logo"}
                    </button>
                    {state.org.logo_url && (
                      <button type="button" className="btn-ghost !py-2 !text-xs" disabled={logoBusy} onClick={() => void onLogoRemove()}>
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </Card>

            <Card className="mt-5">
              <CardHeader title="Preferred services" subtitle="Shapes navigation & modules" action={<Layers size={16} className="text-slate-500" />} />
              <div className="space-y-2">
                {serviceCatalog.map((s) => {
                  const on = preferred.includes(s.key);
                  return (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => setPreferred((p) => (on ? p.filter((k) => k !== s.key) : [...p, s.key]))}
                      className={cx(
                        "flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors",
                        on ? "border-gold-400/40 bg-gold-400/8" : "border-phantix-700/40 bg-phantix-950/40 hover:border-phantix-500/50",
                      )}
                    >
                      <span className={cx("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border", on ? "border-gold-400/50 bg-gold-400/20 text-gold-300" : "border-phantix-600 text-transparent")}>
                        <CheckCircle2 size={12} />
                      </span>
                      <span>
                        <span className="block text-sm font-medium text-slate-200">{s.name}</span>
                        <span className="block text-[11px] text-slate-500">{s.desc}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <button
                className="btn-primary mt-4 w-full"
                onClick={async () => {
                  if (state.dualControl.configured && !operate.unlocked) {
                    if (!(await requireDualControl("Updating preferred services requires dual-control."))) return;
                  }
                  try {
                    await savePreferredServices(preferred);
                    toast("success", "Preferences saved", "PUT /organizations/me/preferred-services");
                  } catch (err) {
                    toast("error", "Save failed", err instanceof Error ? err.message : "Request failed");
                  }
                }}
              >
                Save preferred services
              </button>
            </Card>
          </motion.div>
        </div>
      )}

      <Modal open={!!keyModal} onClose={() => setKeyModal(null)} title="Service key created">
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-severity-medium/30 bg-severity-medium/10 px-4 py-3">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-severity-medium" />
            <p className="text-xs leading-5 text-slate-300">Copy now — the full secret is shown once.</p>
          </div>
          <div className="rounded-xl border border-phantix-700/50 bg-phantix-950/70 p-3.5 font-mono text-sm text-gold-300 break-all">{keyModal}</div>
          <button
            className="btn-primary w-full"
            onClick={() => {
              navigator.clipboard?.writeText(keyModal ?? "").catch(() => {});
              toast("success", "Copied");
              setKeyModal(null);
            }}
          >
            Copy & close
          </button>
        </div>
      </Modal>

      <Modal open={revokeOpen} onClose={() => setRevokeOpen(false)} title="Revoke service key?">
        <p className="text-sm text-slate-400">Integrations using this key will stop immediately. Login links are unaffected.</p>
        <div className="mt-5 flex gap-2.5">
          <button
            className="btn-danger flex-1"
            onClick={async () => {
              if (!operate.unlocked && !(await requireDualControl("Revoking a service key requires dual-control."))) return;
              await revokeServiceKey();
              setRevokeOpen(false);
              toast("info", "Key revoked");
            }}
          >
            Revoke permanently
          </button>
          <button className="btn-ghost" onClick={() => setRevokeOpen(false)}>Cancel</button>
        </div>
      </Modal>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

function ChipGroup({
  title, options, selected, onToggle,
}: {
  title: string;
  options: string[];
  selected: string[];
  onToggle: (v: string) => void;
}) {
  const labels: Record<string, string> = {
    iso_27001: "ISO 27001", soc_2: "SOC 2", pci_dss: "PCI DSS", gdpr: "GDPR",
    ndpr: "NDPR", hipaa: "HIPAA", nist_csf: "NIST CSF", cis_controls: "CIS Controls",
    cbn_risk_based: "CBN Risk-Based", swift_csp: "SWIFT CSP", iso_27701: "ISO 27701",
    pii: "PII", phi: "PHI", pci: "PCI", financial: "Financial",
    credentials: "Credentials", intellectual_property: "Intellectual Property",
    government: "Government", biometric: "Biometric",
  };
  return (
    <div className="mt-5">
      <p className="label">{title}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = selected.includes(o);
          return (
            <button
              key={o}
              type="button"
              onClick={() => onToggle(o)}
              className={cx("chip", on ? "border-gold-400/40 bg-gold-400/10 text-gold-300" : "border-phantix-700/50 text-slate-500")}
            >
              {labels[o] ?? o}
            </button>
          );
        })}
      </div>
    </div>
  );
}
