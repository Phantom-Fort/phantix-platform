import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Building2, ShieldCheck, Database, EyeOff, CheckCircle2, Mail, ArrowLeft } from "lucide-react";
import { useStore } from "@/lib/store";
import { cx } from "@/lib/utils";

const slide = { initial: { opacity: 0, x: 30 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -30 }, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } };

const STEPS = [
  { key: "details", label: "Company details", icon: Building2 },
  { key: "otp", label: "Verify email", icon: Mail },
];

export default function Register() {
  const { register, verifyMfa } = useStore();
  const navigate = useNavigate();
  const [step, setStep] = useState<"details" | "otp">("details");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [country, setCountry] = useState("NG");
  const [slug, setSlug] = useState("");
  const [industry, setIndustry] = useState("other");
  const [secondaryEmail, setSecondaryEmail] = useState("");
  const [primaryContact, setPrimaryContact] = useState({ title: "mr", name: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);

  const generateSlug = (n: string) => n.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'') + '-' + Math.random().toString(36).slice(2,12);

  const submitDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 2) return setError("Enter your company name");
    if (!email.includes("@")) return setError("Enter a valid company email");
    if (password.length < 8) return setError("Password must be at least 8 characters");
    if (!slug.trim()) return setError("Slug required");
    if (!secondaryEmail.includes("@")) return setError("Enter secondary email");
    if (!primaryContact.name.trim()) return setError("Enter primary contact name");
    setBusy(true);
    try {
      const result = await register(name.trim(), email.trim(), password, country, slug.trim(), industry, secondaryEmail.trim(), primaryContact);
      if (result.mfaRequired) {
        setStep("otp");
      } else {
        navigate("/setup");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  };

  const submitOtp = async () => {
    const code = otp.join("");
    if (code.length < 6) return setError("Enter the 6-digit code");
    setError(null);
    setBusy(true);
    try {
      await verifyMfa(code);
      navigate("/setup");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
      setOtp(["", "", "", "", "", ""]);
    } finally {
      setBusy(false);
    }
  };

  const handleOtpInput = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...otp];
    next[index] = value;
    setOtp(next);
    if (value && index < 5) document.getElementById(`otp-${index + 1}`)?.focus();
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-grid-faint bg-grid [mask-image:radial-gradient(ellipse_70%_60%_at_50%_40%,black,transparent)]" />
        <div className="absolute left-1/4 top-1/4 h-[420px] w-[600px] rounded-full bg-phantix-600/20 blur-[130px]" />
      </div>

      <div className="relative grid w-full max-w-5xl grid-cols-1 items-center gap-10 lg:grid-cols-2">
        {/* Pitch */}
        <motion.div initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7 }} className="hidden lg:block">
          <img src="/logo-transparent.png" alt="" className="h-16 w-16 object-contain" />
          <h1 className="mt-6 font-display text-4xl font-bold leading-tight tracking-tight text-white">
            Stand up your security tenant in minutes
          </h1>
          <p className="mt-4 max-w-md text-[15px] leading-7 text-slate-400">
            Register the company, accept the privacy model, verify your email --- then connect your own
            security database and invite your operators.
          </p>
          <div className="mt-8 space-y-3.5">
            {[
              { icon: <ShieldCheck size={16} />, text: "Privacy-first: security data lives only in your dedicated database" },
              { icon: <Database size={16} />, text: "You bring the database --- Phantix writes nothing anywhere else" },
              { icon: <EyeOff size={16} />, text: "Production business data is never read, copied, or stored" },
            ].map((f) => (
              <div key={f.text} className="flex items-center gap-3 text-sm text-slate-300">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-phantix-800/70 text-gold-400">{f.icon}</span>
                {f.text}
              </div>
            ))}
          </div>
        </motion.div>

        {/* Form */}
        <motion.div initial={{ opacity: 0, y: 26 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65, delay: 0.1 }}>
          <div className="card p-7">
            {/* Step indicator */}
            <div className="mb-6 flex items-center gap-2">
              {STEPS.map((s, i) => {
                const active = s.key === step;
                const done = STEPS.findIndex(x => x.key === step) > i;
                return (
                  <React.Fragment key={s.key}>
                    <div className={cx("flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors", done ? "bg-emerald-400/15 text-emerald-400 border border-emerald-400/30" : active ? "bg-gold-400/15 text-gold-400 border border-gold-400/30" : "text-slate-500 border border-transparent")}>
                      {done ? <CheckCircle2 size={13} /> : <s.icon size={13} />}
                      <span className="hidden sm:inline">{s.label}</span>
                    </div>
                    {i < STEPS.length - 1 && <div className={cx("h-px w-6 transition-colors", done ? "bg-emerald-400/40" : "bg-phantix-700/50")} />}
                  </React.Fragment>
                );
              })}
            </div>

            <AnimatePresence mode="wait">
              {step === "details" ? (
                <motion.form key="details" onSubmit={submitDetails} {...slide} className="space-y-4">
                  <div>
                    <label className="label">Company name</label>
                    <input className="input" value={name} onChange={(e) => { setName(e.target.value); if(!slug) setSlug(generateSlug(e.target.value)); }} placeholder="Your Company" />
                  </div>
                  <div>
                    <label className="label">Primary sign-in email</label>
                    <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@yourcompany.com" />
                    <p className="mt-1.5 text-[11px] text-slate-500">Verified by email OTP during setup --- phone OTP is not used.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Slug (auto)</label>
                      <input className="input" value={slug} readOnly />
                    </div>
                    <div>
                      <label className="label">Industry</label>
                      <select className="input" value={industry} onChange={(e) => setIndustry(e.target.value)}>
                        {['financial_services','fintech','banking','insurance','healthcare','technology','telecommunications','energy','manufacturing','retail','ecommerce','education','government','defense','legal','real_estate','logistics','media','hospitality','agriculture','other'].map(i=><option key={i} value={i}>{i}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Secondary email</label>
                      <input className="input" type="email" value={secondaryEmail} onChange={(e) => setSecondaryEmail(e.target.value)} placeholder="ops@yourcompany.com" />
                    </div>
                    <div>
                      <label className="label">Primary contact</label>
                      <div className="flex gap-2">
                        <select className="input w-20" value={primaryContact.title} onChange={e=>setPrimaryContact({...primaryContact,title:e.target.value})}>
                          {['mr','mrs','ms','dr','prof','eng','chief','other'].map(t=><option key={t} value={t}>{t}</option>)}
                        </select>
                        <input className="input" placeholder="Full name" value={primaryContact.name} onChange={e=>setPrimaryContact({...primaryContact,name:e.target.value})} />
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Password</label>
                      <input type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="min. 8 characters" />
                    </div>
                    <div>
                      <label className="label">Country</label>
                      <select className="input" value={country} onChange={(e) => setCountry(e.target.value)}>
                        <option value="NG">Nigeria</option>
                        <option value="GH">Ghana</option>
                        <option value="KE">Kenya</option>
                        <option value="ZA">South Africa</option>
                        <option value="GB">United Kingdom</option>
                        <option value="US">United States</option>
                      </select>
                    </div>
                  </div>
                  {error && <p className="text-sm text-severity-critical">{error}</p>}
                  <button className="btn-primary w-full !py-3" disabled={busy}>
                    {busy ? "Creating tenant..." : "Create organization"} <ArrowRight size={15} />
                  </button>
                  <p className="text-center text-xs text-slate-500">
                    Already registered? <Link to="/login" className="text-gold-400 hover:text-gold-300">Sign in</Link>
                  </p>
                </motion.form>
              ) : (
                <motion.div key="otp" {...slide} className="space-y-5">
                  <div className="text-center">
                    <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gold-400/15 text-gold-400">
                      <Mail size={24} />
                    </span>
                    <h3 className="mt-4 font-display text-lg font-bold text-white">Check your email</h3>
                    <p className="mt-1.5 text-sm text-slate-400">
                      We sent a 6-digit verification code to <strong className="text-slate-200">{email}</strong>. Enter it below to verify your identity.
                    </p>
                  </div>
                  <div className="flex justify-center gap-2">
                    {otp.map((d, i) => (
                      <input
                        key={i}
                        id={`otp-${i}`}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={d}
                        onChange={(e) => handleOtpInput(i, e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Backspace" && !d && i > 0) document.getElementById(`otp-${i - 1}`)?.focus(); }}
                        className="h-14 w-12 rounded-xl border border-phantix-700/50 bg-phantix-950/70 text-center font-mono text-xl font-bold text-white outline-none transition-colors focus:border-gold-400/50 focus:bg-phantix-900/70"
                      />
                    ))}
                  </div>
                  {error && <p className="text-center text-sm text-severity-critical">{error}</p>}
                  <button className="btn-primary w-full !py-3" onClick={submitOtp} disabled={busy}>
                    {busy ? "Verifying..." : "Verify & continue"} <CheckCircle2 size={16} />
                  </button>
                  <button className="btn-ghost w-full !py-2 text-xs" onClick={() => setStep("details")} type="button">
                    <ArrowLeft size={12} /> Back to company details
                  </button>
                  <p className="text-center text-[11px] text-slate-500">
                    Didn't receive the code? Check spam or <button type="button" className="text-gold-400 hover:text-gold-300 underline" onClick={() => { setOtp(["","","","","",""]); setError("Request a new code from your email inbox."); }}>request a new one</button>
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
