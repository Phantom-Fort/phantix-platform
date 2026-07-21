import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ShieldCheck, Building2, MailCheck, Globe, CheckCircle2, Copy, ArrowRight,
  ArrowLeft, FileText, Landmark, UserCheck, Loader2, PartyPopper, Info, RefreshCw,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { cx, maskEmail } from "@/lib/utils";

const stepsMeta = [
  { id: 1, key: "privacy", label: "Privacy notice", icon: <ShieldCheck size={16} /> },
  { id: 2, key: "identity", label: "Company profile", icon: <Building2 size={16} /> },
  { id: 3, key: "otp", label: "Email verification", icon: <MailCheck size={16} /> },
  { id: 4, key: "verify", label: "Company verification", icon: <Globe size={16} />, optional: true },
  { id: 5, key: "complete", label: "Complete", icon: <PartyPopper size={16} /> },
];

export default function SetupWizard() {
  const store = useStore();
  const { state, toast } = store;
  const s = state.setup;
  const navigate = useNavigate();

  // Source of truth = setup state (mirrors GET /organizations/me/setup rehydration)
  const currentStep = useMemo(() => {
    if (!s.privacy_accepted) return 1;
    if (!s.identity_verified) return s.identity_saved ? 3 : 2;
    if (!s.setup_complete) return 4;
    return 5;
  }, [s]);

  const [step, setStep] = useState(currentStep);
  useEffect(() => setStep(currentStep), [currentStep]);

  useEffect(() => {
    if (s.setup_complete && step === 5) {
      // stay on complete screen — user clicks through to dashboard
    }
  }, [s.setup_complete, step]);

  const stepDone = (id: number) => {
    if (id === 1) return s.privacy_accepted;
    if (id === 2) return s.identity_saved || s.identity_verified;
    if (id === 3) return s.identity_verified;
    if (id === 4) return (s.domain_dns_ok || s.domain_http_ok) || s.cac_submitted || s.cac_skipped || s.manual_review !== "none";
    if (id === 5) return s.setup_complete;
    return false;
  };

  return (
    <div className="relative flex min-h-screen">
      <div className="pointer-events-none absolute inset-0 bg-grid-faint bg-grid [mask-image:radial-gradient(ellipse_60%_50%_at_30%_0%,black,transparent)]" />

      {/* Left rail */}
      <aside className="relative hidden w-[320px] shrink-0 flex-col border-r border-phantix-700/40 bg-phantix-950/70 p-8 backdrop-blur-xl lg:flex">
        <div className="flex items-center gap-3">
          <img src="/logo-transparent.png" alt="Phantix" className="h-10 w-10 object-contain" />
          <div>
            <p className="font-display text-[15px] font-bold text-white">Organization setup</p>
            <p className="text-[10px] uppercase tracking-[0.18em] text-gold-400">{state.org.name}</p>
          </div>
        </div>

        <div className="mt-10 flex-1 space-y-1">
          {stepsMeta.map((m, i) => {
            const done = stepDone(m.id);
            const active = step === m.id;
            const reachable = m.id <= currentStep || done;
            return (
              <div key={m.id} className="relative">
                {i < stepsMeta.length - 1 && (
                  <div className={cx("absolute left-[19px] top-11 h-[calc(100%-24px)] w-px", done ? "bg-emerald-400/50" : "bg-phantix-700/60")} />
                )}
                <button
                  onClick={() => reachable && setStep(m.id)}
                  disabled={!reachable}
                  className={cx(
                    "relative flex w-full items-center gap-3.5 rounded-xl px-2 py-3 text-left transition-colors",
                    active ? "bg-phantix-800/50" : reachable ? "hover:bg-phantix-800/30" : "opacity-50",
                  )}
                >
                  <span
                    className={cx(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-all",
                      done
                        ? "border-emerald-400 bg-emerald-400/15 text-emerald-400"
                        : active
                          ? "border-gold-400 bg-gold-400/15 text-gold-400 shadow-glow"
                          : "border-phantix-700 bg-phantix-900 text-slate-500",
                    )}
                  >
                    {done ? <CheckCircle2 size={16} /> : m.icon}
                  </span>
                  <span>
                    <span className={cx("block text-sm font-medium", active ? "text-white" : done ? "text-slate-300" : "text-slate-500")}>
                      {m.label}
                      {m.optional && <span className="ml-1.5 text-[10px] font-normal text-slate-600">optional</span>}
                    </span>
                    <span className="block text-[11px] text-slate-600">
                      {done ? "Done" : active ? "In progress" : m.id > currentStep ? "Locked" : "Pending"}
                    </span>
                  </span>
                </button>
              </div>
            );
          })}
        </div>

        <div className="rounded-xl border border-phantix-700/40 bg-phantix-900/60 p-4 text-[11px] leading-5 text-slate-500">
          <Info size={13} className="mb-1.5 text-gold-400" />
          State rehydrates from <span className="font-mono text-slate-400">GET /organizations/me/setup</span> on
          every load — you can leave and resume anytime.
        </div>
      </aside>

      {/* Content */}
      <main className="relative flex flex-1 items-start justify-center overflow-y-auto px-4 py-10 lg:px-10">
        <div className="w-full max-w-2xl">
          {/* Mobile step indicator */}
          <div className="mb-6 flex items-center gap-2 lg:hidden">
            {stepsMeta.map((m) => (
              <div key={m.id} className={cx("h-1.5 flex-1 rounded-full", stepDone(m.id) ? "bg-emerald-400" : step === m.id ? "bg-gold-400" : "bg-phantix-700/60")} />
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
              {step === 1 && <PrivacyStep />}
              {step === 2 && <IdentityStep onSkip={() => setStep(3)} />}
              {step === 3 && <OtpStep />}
              {step === 4 && <VerifyStep onContinue={() => setStep(5)} />}
              {step === 5 && <CompleteStep />}
            </motion.div>
          </AnimatePresence>

          {step > 1 && step < 5 && (
            <button onClick={() => setStep(step - 1)} className="mt-6 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-200">
              <ArrowLeft size={15} /> Back
            </button>
          )}
        </div>
      </main>
    </div>
  );
}

// ── Step 1: Privacy ───────────────────────────────────────────────────────────
function PrivacyStep() {
  const { acceptPrivacy, state } = useStore();
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);

  const onScroll = () => {
    const el = boxRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24) setScrolled(true);
  };

  if (state.setup.privacy_accepted) {
    return <DoneCard title="Privacy notice accepted" detail={`Accepted ${new Date(state.setup.privacy_accepted_at!).toLocaleString()}`} />;
  }

  return (
    <div className="card p-7">
      <StepTitle icon={<ShieldCheck size={18} />} kicker="Step 1 of 5 · required" title="Accept the privacy model" />
      <div ref={boxRef} onScroll={onScroll} className="mt-5 max-h-[300px] space-y-4 overflow-y-auto rounded-xl border border-phantix-700/50 bg-phantix-950/60 p-5 text-sm leading-6 text-slate-300">
        <p><strong className="text-white">Phantix is privacy-first by architecture.</strong> The platform runs tooling in the cloud; your security data never leaves infrastructure you own.</p>
        <p><strong className="text-slate-100">Phantix stores</strong> — tenancy (org profile, users, dual-control assignments), Fernet-encrypted connection credentials, billing state, and dual-control audit metadata.</p>
        <p><strong className="text-slate-100">Your dedicated security database stores</strong> — assets, tags, history, discovery jobs, scan results, findings, risks, treatments and compliance evidence. All inside the <span className="font-mono text-gold-300">phantix</span> schema only.</p>
        <p><strong className="text-slate-100">Phantix never reads</strong> — production business rows, customer PII datasets, or document contents. Config-inspection connections read catalogs and security metadata only.</p>
        <p><strong className="text-slate-100">Identity</strong> — your sign-in email is verified by one-time code. Email OTP only; phone verification is not part of the product.</p>
        <p><strong className="text-slate-100">Company verification</strong> — optional: prove domain control (DNS TXT or well-known file), submit CAC/RC details, or request a manual staff review.</p>
      </div>
      <label className={cx("mt-4 flex items-start gap-3 rounded-xl border p-4 transition-colors", checked ? "border-emerald-400/40 bg-emerald-400/5" : "border-phantix-700/50", !scrolled && "opacity-60")}>
        <input type="checkbox" disabled={!scrolled} checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-0.5 h-4 w-4 accent-gold-400" />
        <span className="text-sm text-slate-300">
          I have read and accept the privacy model on behalf of my organization.
          {!scrolled && <span className="block text-xs text-slate-500">Scroll to the end to enable.</span>}
        </span>
      </label>
      <button
        className="btn-primary mt-5 w-full !py-3"
        disabled={!checked || busy}
        onClick={async () => {
          setBusy(true);
          await acceptPrivacy();
        }}
      >
        {busy ? "Recording…" : "Accept & continue"} <ArrowRight size={15} />
      </button>
    </div>
  );
}

// ── Step 2: Identity ──────────────────────────────────────────────────────────
function IdentityStep({ onSkip }: { onSkip: () => void }) {
  const { saveIdentity, state } = useStore();
  const [website, setWebsite] = useState(state.org.website ?? "");
  const [legalName, setLegalName] = useState(state.org.legal_name ?? state.org.name);
  const [phone, setPhone] = useState(state.org.company_phone ?? "");
  const [busy, setBusy] = useState(false);

  return (
    <div className="card p-7">
      <StepTitle icon={<Building2 size={18} />} kicker="Step 2 of 5 · optional" title="Company profile" />
      <p className="mt-2 text-sm text-slate-400">Legal details used on verification records and report cover pages.</p>
      <form
        className="mt-5 space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          await saveIdentity({ website, legal_name: legalName, company_phone: phone });
          setBusy(false);
        }}
      >
        <div>
          <label className="label">Legal name</label>
          <input className="input" value={legalName} onChange={(e) => setLegalName(e.target.value)} placeholder="Acme Financial Group Ltd" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Website</label>
            <input className="input" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://acme.ng" />
          </div>
          <div>
            <label className="label">Company phone (contact only)</label>
            <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+234 …" />
          </div>
        </div>
        <div className="flex gap-3">
          <button className="btn-primary flex-1 !py-3" disabled={busy}>{busy ? "Saving…" : "Save & continue"}</button>
          <button type="button" onClick={onSkip} className="btn-ghost">Skip for now</button>
        </div>
      </form>
    </div>
  );
}

// ── Step 3: Email OTP ─────────────────────────────────────────────────────────
function OtpStep() {
  const { sendOtp, verifyOtp, state, toast } = useStore();
  const s = state.setup;
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  if (s.identity_verified) {
    return <DoneCard title="Email verified" detail={`${s.email_otp_destination ?? state.org.primary_email} confirmed by one-time code`} />;
  }

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await sendOtp();
      setDevOtp(res.devOtp || null);
      setCooldown(45);
      toast("success", "Code sent", `Check ${maskEmail(state.org.primary_email)} for the 6-digit code.`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card p-7">
      <StepTitle icon={<MailCheck size={18} />} kicker="Step 3 of 5 · required" title="Verify your sign-in email" />
      <p className="mt-2 text-sm text-slate-400">
        We'll email a one-time code to <strong className="text-slate-200">{maskEmail(state.org.primary_email)}</strong>.
        Email OTP only — phone verification was removed from the product.
      </p>

      {!s.email_otp_sent ? (
        <button className="btn-primary mt-6 w-full !py-3" onClick={send} disabled={busy}>
          {busy ? "Sending…" : "Send verification code"}
        </button>
      ) : (
        <div className="mt-6 space-y-4">
          {devOtp && (
            <div className="rounded-xl border border-gold-400/30 bg-gold-400/8 p-3.5 text-center">
              <p className="text-[10px] uppercase tracking-wider text-gold-400/80">Dev mode — your code</p>
              <p className="mt-1 font-mono text-2xl font-bold tracking-[0.4em] text-gold-300">{devOtp}</p>
              <p className="mt-1 text-[10px] text-slate-500">OTP_DEV_EXPOSE — never shown in production</p>
            </div>
          )}
          <input
            className="input text-center font-mono !text-2xl !tracking-[0.5em]"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="••••••"
            autoFocus
          />
          {error && <p className="text-sm text-severity-critical">{error}</p>}
          <button
            className="btn-primary w-full !py-3"
            disabled={busy || code.length !== 6}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await verifyOtp(code);
              } catch (err) {
                setError(err instanceof Error ? err.message : "Verification failed");
                setCode("");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Verifying…" : "Verify email"}
          </button>
          <button onClick={send} disabled={cooldown > 0 || busy} className="w-full text-center text-xs text-slate-500 hover:text-slate-300 disabled:opacity-50">
            {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Step 4: Company verification (optional) ───────────────────────────────────
function VerifyStep({ onContinue }: { onContinue: () => void }) {
  const { state, startDomainVerification, checkDomain, submitCac, skipCac, requestManualReview, toast } = useStore();
  const s = state.setup;
  const [mode, setMode] = useState<"none" | "domain" | "cac" | "manual">("none");
  const [domain, setDomain] = useState(s.domain ?? "");
  const [busy, setBusy] = useState(false);
  const [cac, setCac] = useState("");
  const [rc, setRc] = useState("");
  const verified = (s.domain_dns_ok || s.domain_http_ok) || s.cac_submitted || s.manual_review === "approved";

  const copy = (text: string, what: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    toast("success", `${what} copied`);
  };

  return (
    <div className="space-y-4">
      <div className="card p-7">
        <StepTitle icon={<Globe size={18} />} kicker="Step 4 of 5 · optional" title="Prove company control" />
        <p className="mt-2 text-sm text-slate-400">
          Any <strong>one</strong> of these marks the company as verified. You can also skip entirely — only
          privacy + email OTP are required to complete setup.
        </p>

        {verified && (
          <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-emerald-400/30 bg-emerald-400/8 px-4 py-3 text-sm text-emerald-300">
            <CheckCircle2 size={16} /> Company verified
          </div>
        )}

        {/* Mode cards */}
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { id: "domain" as const, icon: <Globe size={17} />, name: "Domain", desc: "DNS TXT or well-known file", done: s.domain_dns_ok || s.domain_http_ok },
            { id: "cac" as const, icon: <Landmark size={17} />, name: "CAC / RC", desc: "Registry numbers", done: s.cac_submitted },
            { id: "manual" as const, icon: <UserCheck size={17} />, name: "Manual review", desc: "Staff approval", done: s.manual_review === "approved" },
          ].map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(mode === m.id ? "none" : m.id)}
              className={cx(
                "rounded-2xl border p-4 text-left transition-all",
                mode === m.id ? "border-gold-400/60 bg-gold-400/8 shadow-glow" : "border-phantix-700/50 bg-phantix-950/40 hover:border-phantix-500/50",
              )}
            >
              <div className="flex items-center justify-between">
                <span className={cx("flex h-9 w-9 items-center justify-center rounded-lg", mode === m.id ? "bg-gold-400/15 text-gold-400" : "bg-phantix-800/70 text-phantix-300")}>{m.icon}</span>
                {m.done && <CheckCircle2 size={15} className="text-emerald-400" />}
                {m.id === "manual" && s.manual_review === "pending" && <Loader2 size={14} className="animate-spin text-severity-medium" />}
              </div>
              <p className="mt-2.5 text-sm font-semibold text-slate-200">{m.name}</p>
              <p className="mt-0.5 text-xs text-slate-500">{m.desc}</p>
            </button>
          ))}
        </div>

        {/* Domain flow */}
        <AnimatePresence>
          {mode === "domain" && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="mt-4 rounded-2xl border border-phantix-700/50 bg-phantix-950/50 p-5">
                {!s.domain_token ? (
                  <div className="flex gap-3">
                    <input className="input font-mono" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="acme.ng" />
                    <button
                      className="btn-primary shrink-0"
                      disabled={!domain.includes(".") || busy}
                      onClick={async () => {
                        setBusy(true);
                        await startDomainVerification(domain);
                        setBusy(false);
                      }}
                    >
                      {busy ? "Issuing…" : "Start"}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-slate-300">
                      Prove control of <span className="font-mono text-gold-300">{s.domain}</span> with either method:
                    </p>
                    <div className="rounded-xl border border-phantix-700/50 bg-phantix-950/70 p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Option A — DNS TXT record</p>
                        {s.domain_dns_ok ? <CheckCircle2 size={15} className="text-emerald-400" /> : null}
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <code className="flex-1 truncate rounded-lg bg-phantix-900/80 px-3 py-2 font-mono text-xs text-gold-300">phantix-verify={s.domain_token}</code>
                        <button onClick={() => copy(`phantix-verify=${s.domain_token}`, "TXT value")} className="btn-secondary !px-3 !py-2"><Copy size={14} /></button>
                      </div>
                    </div>
                    <div className="rounded-xl border border-phantix-700/50 bg-phantix-950/70 p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Option B — HTTP well-known file</p>
                        {s.domain_http_ok ? <CheckCircle2 size={15} className="text-emerald-400" /> : null}
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <code className="flex-1 truncate rounded-lg bg-phantix-900/80 px-3 py-2 font-mono text-xs text-gold-300">
                          https://{s.domain}/.well-known/phantix-verify.txt
                        </code>
                        <button onClick={() => copy(`https://${s.domain}/.well-known/phantix-verify.txt`, "URL")} className="btn-secondary !px-3 !py-2"><Copy size={14} /></button>
                      </div>
                      <p className="mt-1.5 text-[11px] text-slate-500">File body = the token only.</p>
                    </div>
                    <button
                      className="btn-primary w-full"
                      disabled={busy || (s.domain_dns_ok && s.domain_http_ok)}
                      onClick={async () => {
                        setBusy(true);
                        await checkDomain("auto");
                        setBusy(false);
                        toast("success", "Verification check complete", "DNS and HTTP probes re-evaluated.");
                      }}
                    >
                      {busy ? <><Loader2 size={15} className="animate-spin" /> Checking DNS & HTTP…</> : s.domain_dns_ok || s.domain_http_ok ? <><RefreshCw size={14} /> Check again</> : "I've added it — check"}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {mode === "cac" && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="mt-4 rounded-2xl border border-phantix-700/50 bg-phantix-950/50 p-5">
                {s.cac_submitted ? (
                  <p className="flex items-center gap-2 text-sm text-emerald-300"><CheckCircle2 size={15} /> CAC / RC details recorded.</p>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="label">CAC number</label>
                        <input className="input font-mono" value={cac} onChange={(e) => setCac(e.target.value)} placeholder="RC1234567" />
                      </div>
                      <div>
                        <label className="label">RC number</label>
                        <input className="input font-mono" value={rc} onChange={(e) => setRc(e.target.value)} placeholder="optional" />
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button className="btn-primary flex-1" disabled={!cac || busy} onClick={async () => { setBusy(true); await submitCac(cac, rc); setBusy(false); }}>
                        {busy ? "Submitting…" : "Submit details"}
                      </button>
                      <button className="btn-ghost" onClick={() => skipCac()}>Skip</button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {mode === "manual" && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="mt-4 rounded-2xl border border-phantix-700/50 bg-phantix-950/50 p-5">
                {s.manual_review === "pending" ? (
                  <div className="flex items-center gap-3 text-sm text-slate-300">
                    <Loader2 size={16} className="animate-spin text-severity-medium" />
                    Awaiting staff review — you'll see the outcome here. Staff resolve it from their console.
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm text-slate-400">Request a Phantix staff member to verify your company manually.</p>
                    <button className="btn-primary shrink-0" disabled={busy} onClick={async () => { setBusy(true); await requestManualReview(); setBusy(false); }}>
                      {busy ? "Requesting…" : "Request review"}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <button onClick={onContinue} className="btn-primary w-full !py-3.5">
        {verified ? "Continue" : "Skip verification & continue"} <ArrowRight size={15} />
      </button>
    </div>
  );
}

// ── Step 5: Complete ──────────────────────────────────────────────────────────
function CompleteStep() {
  const { state, completeSetup, toast } = useStore();
  const s = state.setup;
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const canComplete = s.privacy_accepted && s.identity_verified;

  if (s.setup_complete) {
    return (
      <div className="card relative overflow-hidden p-8 text-center">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(232,181,77,0.15),transparent_60%)]" />
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 16, delay: 0.1 }} className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-full border-2 border-gold-400 bg-gold-400/15 shadow-glow">
          <PartyPopper size={32} className="text-gold-400" />
        </motion.div>
        <h2 className="relative mt-6 font-display text-3xl font-bold text-white">Setup complete</h2>
        <p className="relative mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">
          <strong className="text-slate-200">{state.org.name}</strong> is live. Next: bootstrap dual control,
          connect your security database, and invite operators.
        </p>
        <button onClick={() => navigate("/dashboard")} className="btn-primary relative mt-7 !px-8 !py-3">
          Enter the platform <ArrowRight size={15} />
        </button>
      </div>
    );
  }

  const rows = [
    { label: "Privacy notice", ok: s.privacy_accepted, required: true },
    { label: "Email verified (OTP)", ok: s.identity_verified, required: true },
    { label: "Company profile", ok: s.identity_saved, required: false },
    { label: "Company verification", ok: (s.domain_dns_ok || s.domain_http_ok) || s.cac_submitted || s.manual_review !== "none", required: false },
  ];

  return (
    <div className="card p-7">
      <StepTitle icon={<FileText size={18} />} kicker="Step 5 of 5" title="Review & complete" />
      <div className="mt-5 space-y-2.5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between rounded-xl border border-phantix-700/40 bg-phantix-950/50 px-4 py-3">
            <span className="text-sm text-slate-300">
              {r.label} {r.required && <span className="ml-1 text-[10px] text-slate-600">required</span>}
            </span>
            {r.ok ? <CheckCircle2 size={16} className="text-emerald-400" /> : <span className="text-xs text-slate-600">{r.required ? "missing" : "skipped"}</span>}
          </div>
        ))}
      </div>
      {!canComplete && (
        <p className="mt-4 rounded-xl border border-severity-critical/30 bg-severity-critical/8 p-3.5 text-xs leading-5 text-severity-critical">
          Privacy acceptance and email OTP are required. Complete those steps first — the API returns 400 otherwise.
        </p>
      )}
      <button
        className="btn-primary mt-5 w-full !py-3.5"
        disabled={!canComplete || busy}
        onClick={async () => {
          setBusy(true);
          await completeSetup();
          setBusy(false);
          toast("success", "Organization setup complete", "Welcome to Phantix Platform.");
        }}
      >
        {busy ? "Completing…" : "Complete setup"} <CheckCircle2 size={15} />
      </button>
    </div>
  );
}

// ── Shared bits ───────────────────────────────────────────────────────────────
function StepTitle({ icon, kicker, title }: { icon: React.ReactNode; kicker: string; title: string }) {
  return (
    <div>
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-400">
        {icon} {kicker}
      </div>
      <h2 className="mt-2 font-display text-2xl font-bold text-white">{title}</h2>
    </div>
  );
}

function DoneCard({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="card p-7 text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border-2 border-emerald-400 bg-emerald-400/12 text-emerald-400">
        <CheckCircle2 size={24} />
      </span>
      <h2 className="mt-4 font-display text-xl font-bold text-white">{title}</h2>
      <p className="mt-1.5 text-sm text-slate-400">{detail}</p>
    </div>
  );
}
