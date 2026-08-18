import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, Mail, KeyRound, ArrowRight, Send } from "lucide-react";
import { useStore } from "@/lib/store";
import { DEMO_MODE } from "@/lib/api";
import { APP_DEMO_URL } from "@/lib/links";
import { BrandLogo } from "@/components/BrandLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import AuthShowcase from "@/components/AuthShowcase";

function NewsletterField() {
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subscribe = () => {
    const v = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      setError("Enter a valid email address.");
      return;
    }
    setError(null);
    setSubscribed(true);
  };

  return (
    <div className="border-t border-phantix-700/40 pt-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        Security insights in your inbox
      </p>
      {subscribed ? (
        <p className="mt-2 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-400">
          You're on the list. Watch your inbox for a welcome note.
        </p>
      ) : (
        <>
          <div className="mt-2 flex gap-2">
            <div className="relative flex-1">
              <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                className="input !pl-9 !py-2 text-xs"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    subscribe();
                  }
                }}
                placeholder="you@company.com"
                aria-label="Newsletter email"
              />
            </div>
            <button type="button" onClick={subscribe} className="btn-secondary !px-3 !py-2">
              <Send size={14} />
            </button>
          </div>
          {error && <p className="mt-1.5 text-xs text-severity-critical">{error}</p>}
        </>
      )}
    </div>
  );
}

export default function Login() {
  const { login, verifyMfa, resendLoginOtp, state } = useStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"password" | "mfa">("password");
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [destinationMasked, setDestinationMasked] = useState("");

  const destination = () => (state.setup.setup_complete ? "/dashboard" : "/setup");

  const resend = async () => {
    if (resending) return;
    setError(null);
    setResending(true);
    try {
      const res = await resendLoginOtp(email, password);
      setDestinationMasked(res.destinationMasked || "");
      setCode("");
      setError("A new code was sent. Enter the latest code.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resend code");
    } finally {
      setResending(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (stage === "password") {
        const res = await login(email, password);
        if (res.mfaRequired) {
          // Prefer the API-masked destination when the server returns one.
          if (res.destinationMasked) setDestinationMasked(res.destinationMasked);
          setStage("mfa");
        }
        else navigate(destination());
      } else {
        await verifyMfa(code);
        navigate(destination());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-phantix-950">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-grid-faint bg-grid [mask-image:radial-gradient(ellipse_70%_60%_at_50%_40%,black,transparent)]" />
        <div className="absolute left-1/2 top-1/3 h-[420px] w-[680px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-phantix-600/20 blur-[130px]" />
      </div>

      <div className="relative z-10 w-full lg:grid lg:min-h-screen lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]">
        <AuthShowcase />

        <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-10">
          <div className="absolute right-6 top-6 z-20"><ThemeToggle /></div>

          <motion.div
            initial={{ opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-[420px]"
          >
            <div className="mb-8 text-center">
              <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.7, delay: 0.1 }} className="mx-auto">
                <BrandLogo className="mx-auto h-20 w-20 drop-shadow-[0_0_40px_rgba(51,85,181,0.6)]" />
              </motion.div>
              <h1 className="mt-5 font-display text-2xl font-bold text-white">Phantix Platform</h1>
              <p className="mt-1.5 text-sm text-slate-400">
                Company sign-in · <span className="font-mono text-xs">type=access</span>
              </p>
            </div>

            <div className="card p-7">
              <AnimatePresence mode="wait">
                {stage === "password" ? (
                  <motion.form key="pw" initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -14 }} onSubmit={submit} className="space-y-4">
                    <div>
                      <label className="label">Company email</label>
                      <div className="relative">
                        <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input className="input !pl-10" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
                      </div>
                    </div>
                    <div>
                      <label className="label">Password</label>
                      <div className="relative">
                        <KeyRound size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input type="password" className="input !pl-10" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
                      </div>
                    </div>
                    {error && <p className="text-sm text-severity-critical">{error}</p>}
                    <button className="btn-primary w-full !py-3" disabled={busy}>
                      {busy ? "Checking..." : "Continue"} <ArrowRight size={15} />
                    </button>
                    <p className="text-center text-xs text-slate-500">
                      <Link to="/password-reset" className="text-gold-400 hover:text-gold-300">Forgot password?</Link>
                    </p>
                    <p className="text-center text-xs text-slate-500">
                      New tenant?{" "}
                      <Link to="/register" className="text-gold-400 hover:text-gold-300">Register your organization</Link>
                    </p>
                    <NewsletterField />
                    <p className="text-center text-[11px] text-slate-600">
                      <Link to="/terms" className="hover:text-slate-400">Terms of Service</Link>
                      {" · "}
                      <Link to="/aup" className="hover:text-slate-400">AUP</Link>
                      {" · "}
                      <Link to="/privacy" className="hover:text-slate-400">Privacy</Link>
                    </p>
                  </motion.form>
                ) : (
                  <motion.form key="mfa" initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 14 }} onSubmit={submit} className="space-y-4">
                    <div className="rounded-xl border border-phantix-600/40 bg-phantix-800/40 p-3.5 text-center">
                      <ShieldCheck size={22} className="mx-auto text-gold-400" />
                      <p className="mt-2 text-sm font-medium text-slate-200">Email verification</p>
                      <p className="mt-1 text-xs text-slate-500">A 6-digit code was sent to {destinationMasked || email.replace(/(.{2}).+(@.+)/, "$1***$2")}</p>
                    </div>
                    <input
                      className="input text-center font-mono !text-xl !tracking-[0.5em]"
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="••••••"
                      autoFocus
                    />
                    {error && <p className="text-sm text-severity-critical">{error}</p>}
                    <button className="btn-primary w-full !py-3" disabled={busy || code.length !== 6}>
                      {busy ? "Verifying..." : "Verify & sign in"}
                    </button>
                    <button type="button" onClick={() => void resend()} disabled={resending} className="w-full text-center text-xs text-slate-500 hover:text-slate-300">
                      {resending ? "Resending..." : "Resend code"}
                    </button>
                    <button type="button" onClick={() => setStage("password")} className="w-full text-center text-xs text-slate-500 hover:text-slate-300">
                      ← Use a different account
                    </button>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>

            {DEMO_MODE && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="mt-5 rounded-xl border border-gold-400/20 bg-gold-400/6 px-4 py-3 text-center text-xs leading-5 text-gold-300/80">
                <strong>Demo mode</strong> --- any email and any 6-digit code works. Set{" "}
                <span className="font-mono">VITE_API_BASE</span> for a live API.
              </motion.p>
            )}

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9 }}
              className="mt-4 flex flex-col items-center gap-1.5 text-center"
            >
              <p className="text-xs text-slate-500">Looking for the product demo?</p>
              <a
                href={APP_DEMO_URL}
                className="inline-flex items-center gap-1 text-xs font-semibold text-gold-400 hover:text-gold-300"
              >
                Explore the Command Centre demo →
              </a>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
