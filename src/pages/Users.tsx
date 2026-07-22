import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Users, UserPlus, ShieldCheck, Link2, KeyRound, ArrowRight, ArrowLeft,
  CheckCircle2, Copy, Unlock, Smartphone, AlertTriangle, Info, RefreshCw,
} from "lucide-react";
import { PageHeader, Card, CardHeader, StatusBadge, Modal, EmptyState } from "@/components/ui";
import { useStore } from "@/lib/store";
import { timeAgo, maskEmail, cx } from "@/lib/utils";
import type { OrgUser } from "@/lib/types";

export default function People() {
  const { state, operate, toast, requireDualControl } = useStore();
  const [searchParams] = useSearchParams();
  const [addOpen, setAddOpen] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get("unlock") === "1") {
      void requireDualControl("Unlock operate mode to manage people and dual-control actions.");
    }
  }, [searchParams, requireDualControl]);

  const dc = state.dualControl;
  const initiator = state.users.find((u) => u.id === dc.initiator_user_id);
  const authorizer = state.users.find((u) => u.id === dc.authorizer_user_id);

  return (
    <div className="mx-auto max-w-[1200px]">
      <PageHeader
        title="People & dual control"
        description="Named users sign in with domain-email OTP. Writes require the initiator or authorizer slot plus a live operate session — roles alone grant no writes."
        actions={
          <>
            {dc.configured && !operate.unlocked && (
              <button
                className="btn-primary"
                onClick={() => void requireDualControl("Unlock operate mode to manage people and dual-control actions.")}
              >
                <Unlock size={15} /> Unlock operate
              </button>
            )}
            {dc.configured && (
              <button
                className="btn-secondary"
                onClick={async () => {
                  if (operate.unlocked || (await requireDualControl("Creating users post-bootstrap needs an initiator/authorizer session."))) {
                    setAddOpen(true);
                  }
                }}
              >
                <UserPlus size={15} /> Add user
              </button>
            )}
          </>
        }
      />

      {!dc.configured ? (
        <BootstrapWizard />
      ) : (
        <>
          {!state.serviceKey && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-5">
              <div className="flex items-start gap-3 rounded-2xl border border-severity-medium/30 bg-severity-medium/8 px-5 py-4">
                <AlertTriangle size={18} className="mt-0.5 shrink-0 text-severity-medium" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-100">Service key required for app access</p>
                  <p className="text-sm text-slate-400">
                    Login links won't work until you create a service key. Go to Identity & Keys or click here to create one now.
                  </p>
                </div>
                <a href="/identity" className="btn-primary shrink-0">Create service key <ArrowRight size={15} /></a>
              </div>
            </motion.div>
          )}
          {/* Assignment card */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-5">
            <Card className="border-gold-400/25">
              <CardHeader title="Dual-control assignment" subtitle="Two different people — one proposes, one approves" action={<ShieldCheck size={17} className="text-gold-400" />} />
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {[
                  { slot: "Initiator", user: initiator, desc: "Proposes and executes mutations with an operate session" },
                  { slot: "Authorizer", user: authorizer, desc: "Approves pending actions and risk treatments" },
                ].map((s) => (
                  <div key={s.slot} className="flex items-center gap-4 rounded-2xl border border-phantix-700/40 bg-phantix-950/50 p-4">
                    <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-gold-400 to-gold-600 font-display text-base font-bold text-phantix-950">
                      {s.user?.full_name.slice(0, 1) ?? "?"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-slate-100">{s.user?.full_name}</p>
                        <span className="chip border-gold-400/30 bg-gold-400/10 text-gold-300">{s.slot}</span>
                      </div>
                      <p className="text-xs text-slate-500">{s.user?.title} · {s.user?.email}</p>
                      <p className="mt-1 text-[11px] text-slate-600">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-start gap-3 rounded-xl border border-phantix-700/40 bg-phantix-950/50 px-4 py-3">
                <AlertTriangle size={14} className="mt-0.5 shrink-0 text-gold-400" />
                <div className="min-w-0 flex-1">
                <p className="text-[11px] leading-4 text-slate-500">
                  Reassign here using your company JWT — no operate session needed.
                  After reassigning, the new initiator must login with purpose=dual_control to get a session token.
                  Use organization-domain emails (allowed domains) or registration contact emails only.
                </p>
                  <button
                    className="btn-secondary mt-2 !px-3 !py-1.5 !text-xs"
                    onClick={() => setReassignOpen(true)}
                  >
                    <RefreshCw size={12} /> Reassign
                  </button>
                </div>
              </div>
            </Card>
          </motion.div>

          <UsersTable onUnlock={() => void requireDualControl("This action requires a dual-control operate session.")} />
          <LoginLinks />
          <ReassignModal
            open={reassignOpen}
            onClose={() => setReassignOpen(false)}
            currentInitiatorId={dc.initiator_user_id}
            currentAuthorizerId={dc.authorizer_user_id}
          />
        </>
      )}

      <AddUserModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}

// ── Bootstrap wizard (Phases 0–3 from DUAL_CONTROL_SETUP_FE.md) ──────────────
function BootstrapWizard() {
  const { state, createUser, assignDualControl, toast } = useStore();
  const users = state.users;
  const [phase, setPhase] = useState<"welcome" | "initiator" | "authorizer" | "review">("welcome");
  const [initiator, setInitiator] = useState<OrgUser | null>(users[0] ?? null);
  const [authorizer, setAuthorizer] = useState<OrgUser | null>(users[1] ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wizardStep = phase === "welcome" ? 0 : phase === "initiator" ? 1 : phase === "authorizer" ? 2 : 3;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="relative overflow-hidden">
        <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-gold-400/8 blur-[80px]" />

        {/* Progress */}
        <div className="mb-6 flex items-center gap-2">
          {["Welcome", "Initiator", "Authorizer", "Review & assign"].map((l, i) => (
            <React.Fragment key={l}>
              <div className={cx("flex items-center gap-2", i <= wizardStep ? "text-gold-300" : "text-slate-600")}>
                <span className={cx("flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold", i < wizardStep ? "bg-emerald-400/20 text-emerald-400" : i === wizardStep ? "bg-gold-400/20 text-gold-300" : "bg-phantix-800/70 text-slate-600")}>
                  {i < wizardStep ? "✓" : i + 1}
                </span>
                <span className="hidden text-xs font-medium sm:block">{l}</span>
              </div>
              {i < 3 && <div className={cx("h-px flex-1", i < wizardStep ? "bg-emerald-400/40" : "bg-phantix-700/50")} />}
            </React.Fragment>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {phase === "welcome" && (
            <motion.div key="welcome" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <div className="flex items-start gap-5">
                <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gold-400/15 text-gold-400">
                  <ShieldCheck size={28} />
                </span>
                <div>
                  <h2 className="font-display text-xl font-bold text-white">Set up two-person control</h2>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">
                    Phantix protects every mutation with <strong className="text-slate-200">dual control</strong>:
                    one person <strong className="text-gold-300">initiates</strong>, a different person{" "}
                    <strong className="text-gold-300">authorizes</strong>. You'll create both users now — bootstrap
                    uses your company JWT; after assignment, mutations need a live operate session.
                  </p>
                  <div className="mt-4 grid max-w-xl grid-cols-2 gap-3">
                    <div className="rounded-xl border border-phantix-700/40 bg-phantix-950/50 p-3.5">
                      <p className="text-xs font-semibold text-gold-300">Initiator</p>
                      <p className="mt-1 text-[11px] leading-4 text-slate-500">Proposes & executes (e.g. IT Admin)</p>
                    </div>
                    <div className="rounded-xl border border-phantix-700/40 bg-phantix-950/50 p-3.5">
                      <p className="text-xs font-semibold text-gold-300">Authorizer</p>
                      <p className="mt-1 text-[11px] leading-4 text-slate-500">Approves actions (e.g. CISO)</p>
                    </div>
                  </div>
                  <button onClick={() => setPhase("initiator")} className="btn-primary mt-5">
                    Create the initiator <ArrowRight size={15} />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {(phase === "initiator" || phase === "authorizer") && (
            <motion.div key={phase} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <PersonForm
                key={phase}
                slot={phase === "initiator" ? "Initiator" : "Authorizer"}
                excludeEmail={phase === "authorizer" ? initiator?.email : undefined}
                busy={busy}
                onBack={() => setPhase(phase === "initiator" ? "welcome" : "initiator")}
                onSubmit={async (form) => {
                  setBusy(true);
                  setError(null);
                  try {
                    const user = await createUser(form);
                    if (phase === "initiator") {
                      setInitiator(user);
                      setPhase("authorizer");
                    } else {
                      setAuthorizer(user);
                      setPhase("review");
                    }
                    toast("success", `${form.full_name} created`, "OTP-only user — they sign in with domain-email OTP.");
                  } finally {
                    setBusy(false);
                  }
                }}
              />
              {error && <p className="mt-3 text-sm text-severity-critical">{error}</p>}
            </motion.div>
          )}

          {phase === "review" && initiator && authorizer && (
            <motion.div key="review" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <h2 className="font-display text-xl font-bold text-white">Review the assignment</h2>
              <p className="mt-1.5 text-sm text-slate-400">
                PUT /org-users/dual-control — the last bootstrap call. After this, mutations require an operate session.
              </p>
              <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
                {[
                  { slot: "Initiator", user: initiator },
                  { slot: "Authorizer", user: authorizer },
                ].map((s) => (
                  <div key={s.slot} className="rounded-2xl border border-gold-400/25 bg-gold-400/5 p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-gold-400">{s.slot}</p>
                    <p className="mt-1.5 font-semibold text-slate-100">{s.user.full_name}</p>
                    <p className="text-xs text-slate-500">{s.user.title} · {s.user.email}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex gap-3">
                <button
                  className="btn-primary flex-1 !py-3"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setError(null);
                    try {
                      await assignDualControl(initiator.id, authorizer.id);
                      toast("success", "Dual control active", "Now unlock an operate session as the initiator.");
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Assignment failed");
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {busy ? "Assigning…" : "Assign dual control"} <ShieldCheck size={15} />
                </button>
                <button className="btn-ghost" onClick={() => setPhase("authorizer")}><ArrowLeft size={15} /> Back</button>
              </div>
              {error && <p className="mt-3 text-sm text-severity-critical">{error}</p>}
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}

function PersonForm({
  slot, excludeEmail, busy, onBack, onSubmit,
}: {
  slot: string;
  excludeEmail?: string;
  busy: boolean;
  onBack: () => void;
  onSubmit: (form: { full_name: string; email: string; title: string; role: string }) => Promise<void>;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <h2 className="font-display text-xl font-bold text-white">Create the {slot.toLowerCase()}</h2>
      <p className="mt-1.5 text-sm text-slate-400">
        A named person with domain-email OTP sign-in. The role sets view/report scope only — the slot is assigned next.
      </p>
      <form
        className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          if (excludeEmail && email.toLowerCase() === excludeEmail.toLowerCase()) {
            return setError("Initiator and authorizer must be two different people");
          }
          await onSubmit({ full_name: fullName, email, title, role: slot === "Initiator" ? "org_admin" : "security_admin" });
        }}
      >
        <div>
          <label className="label">Full name</label>
          <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" required autoComplete="name" />
        </div>
        <div>
          <label className="label">Title (shows on audit trail)</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={slot === "Initiator" ? "e.g. IT Admin" : "e.g. CISO"} required />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Work email</label>
          <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" required autoComplete="email" />
          <p className="mt-1.5 text-[11px] text-slate-500">
            OTP-only (no password) — recommended. Free-mail is rejected unless it matches a registration contact.
          </p>
        </div>
        {error && <p className="sm:col-span-2 text-sm text-severity-critical">{error}</p>}
        <div className="flex gap-3 sm:col-span-2">
          <button className="btn-primary flex-1 !py-3" disabled={busy}>{busy ? "Creating…" : `Create ${slot.toLowerCase()}`}</button>
          <button type="button" onClick={onBack} className="btn-ghost"><ArrowLeft size={15} /> Back</button>
        </div>
      </form>
    </div>
  );
}

// ── Users table ───────────────────────────────────────────────────────────────
function UsersTable({ onUnlock }: { onUnlock: () => void }) {
  const { state, issueLoginLink, clearDevice, operate, toast } = useStore();
  const [link, setLink] = useState<{ user: string; url: string } | null>(null);
  const dc = state.dualControl;

  if (state.users.length === 0) {
    return <Card><EmptyState icon={<Users size={22} />} title="No users yet" /></Card>;
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
      <Card className="!p-0 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-phantix-700/40">
              <th className="th">User</th>
              <th className="th">Role</th>
              <th className="th">Slot</th>
              <th className="th">Auth</th>
              <th className="th">Last login</th>
              <th className="th"></th>
            </tr>
          </thead>
          <tbody>
            {state.users.map((u) => (
              <tr key={u.id} className="border-b border-phantix-800/40 hover:bg-phantix-800/35">
                <td className="td">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-phantix-800/70 font-display text-xs font-bold text-phantix-200">
                      {u.full_name.split(" ").map((n) => n[0]).join("")}
                    </span>
                    <div>
                      <p className="font-medium text-slate-200">{u.full_name}</p>
                      <p className="text-xs text-slate-500">{u.email} · {u.title}</p>
                    </div>
                  </div>
                </td>
                <td className="td"><span className="font-mono text-xs text-slate-400">{u.role}</span></td>
                <td className="td">
                  {dc.initiator_user_id === u.id ? (
                    <span className="chip border-gold-400/30 bg-gold-400/10 text-gold-300">Initiator</span>
                  ) : dc.authorizer_user_id === u.id ? (
                    <span className="chip border-gold-400/30 bg-gold-400/10 text-gold-300">Authorizer</span>
                  ) : (
                    <span className="text-xs text-slate-600">—</span>
                  )}
                </td>
                <td className="td">
                  {u.otp_only ? (
                    <span className="chip border-emerald-400/30 bg-emerald-400/10 text-emerald-300"><KeyRound size={11} /> OTP only</span>
                  ) : (
                    <span className="text-xs text-slate-500">password</span>
                  )}
                </td>
                <td className="td text-xs text-slate-500">{u.last_login_at ? timeAgo(u.last_login_at) : "never"}</td>
                <td className="td">
                  <div className="flex justify-end gap-1.5">
                    <button
                      className="btn-ghost !px-2.5 !py-1.5 !text-xs"
                      title={!state.serviceKey ? "App access requires an active service key — create one on the Identity page" : "Generate a one-time app sign-in URL"}
                      disabled={!state.serviceKey}
                      onClick={async () => {
                        if (!operate.unlocked) { onUnlock(); return; }
                        const url = await issueLoginLink(u.id);
                        setLink({ user: u.full_name, url });
                      }}
                    >
                      <Link2 size={13} /> Login link
                    </button>
                    <button
                      className="btn-ghost !px-2.5 !py-1.5 !text-xs"
                      title="Clear device bind"
                      onClick={async () => {
                        if (!operate.unlocked) { onUnlock(); return; }
                        await clearDevice(u.id);
                        toast("success", "Device bind cleared", `${u.full_name} can bind a new browser at next login.`);
                      }}
                    >
                      <Smartphone size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Login link modal */}
      <Modal open={!!link} onClose={() => setLink(null)} title="Application login link">
        <div className="space-y-4">
          <div className="rounded-xl border border-gold-400/25 bg-gold-400/5 p-3.5 text-xs leading-5 text-slate-400">
            <strong className="text-gold-300">app.phantix.site</strong> — the Command Centre where scans, campaigns and reports live.
            Share this with {link?.user || "the user"}. They visit the link, verify via email OTP, and get direct access — no platform login needed.
          </div>
          <div className="rounded-xl border border-gold-400/30 bg-gold-400/8 p-3.5 text-xs leading-5 text-slate-400">
            <strong>Shown once.</strong> The platform stores no secrets. Rotating the service key does not invalidate this link.
          </div>
          <div className="rounded-xl border border-phantix-700/50 bg-phantix-950/70 p-3.5 font-mono text-xs leading-6 text-gold-300/90 break-all">
            {link?.url}
          </div>
          <button
            className="btn-primary w-full"
            onClick={() => {
              navigator.clipboard?.writeText(link?.url ?? "").catch(() => {});
              toast("success", "Link copied", "Share this with the user — they sign in on app.phantix.site.");
              setLink(null);
            }}
          >
            <Copy size={15} /> Copy link
          </button>
        </div>
      </Modal>
    </motion.div>
  );
}

// ── Login links list ──────────────────────────────────────────────────────────
function LoginLinks() {
  const { state } = useStore();
  if (state.loginLinks.length === 0) return null;
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }} className="mt-5">
      <Card>
        <CardHeader title="Issued login links" subtitle="No secrets stored here — status only (GET /organizations/me/login-links)" />
        <div className="space-y-2">
          {state.loginLinks.map((l) => (
            <div key={l.id} className="flex items-center gap-3 rounded-xl border border-phantix-700/40 bg-phantix-950/50 px-4 py-3">
              <Link2 size={14} className="text-gold-400" />
              <span className="text-sm text-slate-300">{l.user_name}</span>
              <span className="text-xs text-slate-600">issued {timeAgo(l.created_at)}</span>
              <span className="ml-auto"><StatusBadge status={l.status} /></span>
            </div>
          ))}
        </div>
      </Card>
    </motion.div>
  );
}

// ── Reassign dual control modal ────────────────────────────────────────────────
function ReassignModal({
  open, onClose, currentInitiatorId, currentAuthorizerId,
}: {
  open: boolean;
  onClose: () => void;
  currentInitiatorId: number | null;
  currentAuthorizerId: number | null;
}) {
  const { state, assignDualControl, toast, operate } = useStore();
  const [initiatorId, setInitiatorId] = useState<number>(currentInitiatorId ?? 0);
  const [authorizerId, setAuthorizerId] = useState<number>(currentAuthorizerId ?? 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeUsers = state.users.filter((u) => u.is_active);
  const policy = state.dualControl.email_policy;
  const allowedDomains = policy?.allowed_domains ?? [];
  const exemptEmails = policy?.registration_emails_exempt ?? [];

  useEffect(() => {
    setInitiatorId(currentInitiatorId ?? 0);
    setAuthorizerId(currentAuthorizerId ?? 0);
    setError(null);
  }, [open, currentInitiatorId, currentAuthorizerId]);

  return (
    <Modal open={open} onClose={onClose} title="Reassign dual control">
      <div className="space-y-4">
        <div className="rounded-xl border border-severity-medium/30 bg-severity-medium/8 p-3.5 text-xs leading-5 text-severity-medium">
          Assign initiator and authorizer to users on your organization domain.{allowedDomains.length > 0 && (
            <span> Allowed: <strong>{allowedDomains.join(", ")}</strong>.</span>
          )}{exemptEmails.length > 0 && (
            <span> Registration contacts exempt: <strong>{exemptEmails.join(", ")}</strong>.</span>
          )}
          {" "}Gmail/yahoo/outlook users cannot complete dual-control login.
        </div>
        <div>
          <label className="label">Initiator</label>
          <select
            className="input"
            value={initiatorId || ""}
            onChange={(e) => setInitiatorId(Number(e.target.value))}
          >
            <option value="" disabled>Select initiator</option>
            {activeUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name} — {u.email} ({u.role})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Authorizer</label>
          <select
            className="input"
            value={authorizerId || ""}
            onChange={(e) => setAuthorizerId(Number(e.target.value))}
          >
            <option value="" disabled>Select authorizer</option>
            {activeUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name} — {u.email} ({u.role})
              </option>
            ))}
          </select>
        </div>
        {error && <p className="text-sm text-severity-critical">{error}</p>}
        <button
          className="btn-primary w-full"
          disabled={busy || !initiatorId || !authorizerId || initiatorId === authorizerId}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await assignDualControl(initiatorId, authorizerId);
              toast("success", "Dual control updated", "The new assignments are active. Both users must re-login with purpose=dual_control.");
              onClose();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Assignment failed");
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Updating…" : "Save changes"}
        </button>
      </div>
    </Modal>
  );
}

// ── Add user modal (post-bootstrap) ───────────────────────────────────────────
function AddUserModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { createUser, toast } = useStore();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");
  const [role, setRole] = useState("viewer");
  const [busy, setBusy] = useState(false);

  return (
    <Modal open={open} onClose={onClose} title="Add organization user">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          await createUser({ full_name: fullName, email, title, role });
          setBusy(false);
          toast("success", "User created", "OTP-only — they sign in with domain-email OTP.");
          onClose();
          setFullName(""); setEmail(""); setTitle("");
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Full name</label>
            <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>
          <div>
            <label className="label">Title</label>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="SOC Analyst" required />
          </div>
        </div>
        <div>
          <label className="label">Work email</label>
          <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <label className="label">Role (view/report scope only)</label>
          <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="viewer">viewer</option>
            <option value="operator">operator</option>
            <option value="org_admin">org_admin</option>
            <option value="security_admin">security_admin</option>
          </select>
        </div>
        <button className="btn-primary w-full" disabled={busy}>{busy ? "Creating…" : "Create user"}</button>
      </form>
    </Modal>
  );
}
