import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ShieldCheck, Database, EyeOff, KeyRound, CheckCircle2 } from "lucide-react";

// Mirrors GET /api/v1/organizations/privacy (public, no auth)
export default function Privacy() {
  return (
    <div className="relative min-h-screen px-4 py-12">
      <div className="pointer-events-none absolute inset-0 bg-grid-faint bg-grid [mask-image:radial-gradient(ellipse_70%_50%_at_50%_0%,black,transparent)]" />
      <div className="relative mx-auto max-w-3xl">
        <Link to="/login" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-200">
          <ArrowLeft size={15} /> Back to sign-in
        </Link>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mt-6">
          <div className="flex items-center gap-4">
            <img src="/logo-transparent.png" alt="" className="h-14 w-14 object-contain" />
            <div>
              <h1 className="font-display text-3xl font-bold text-white">Privacy notice</h1>
              <p className="text-sm text-slate-500">How Phantix handles your data — the short, honest version</p>
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mt-8 space-y-5">
          <div className="card p-6">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-phantix-700/50 text-phantix-300"><ShieldCheck size={18} /></span>
              <h2 className="font-display text-lg font-semibold text-white">What Phantix stores</h2>
            </div>
            <ul className="mt-4 space-y-2.5">
              {[
                "Tenancy: organization profile, users, roles and dual-control assignments",
                "Encrypted credentials for your database connections (Fernet) — never plaintext",
                "Billing, plan and rate-limit state bound to your company (organization_id)",
                "Dual-control audit metadata: who initiated, who authorized, when",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2.5 text-sm text-slate-300">
                  <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-400" /> {t}
                </li>
              ))}
            </ul>
          </div>

          <div className="card border-gold-400/25 p-6">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold-400/15 text-gold-400"><Database size={18} /></span>
              <h2 className="font-display text-lg font-semibold text-white">What lives in your dedicated security database</h2>
            </div>
            <ul className="mt-4 space-y-2.5">
              {[
                "Assets, tags, discovery jobs and full inventory history",
                "Scan results, VAPT findings and their evidence",
                "Risks, assessments, treatments and residual scores",
                "Compliance evidence collected by connectors",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2.5 text-sm text-slate-300">
                  <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-gold-400" /> {t}
                </li>
              ))}
            </ul>
            <p className="mt-4 rounded-xl bg-phantix-950/60 border border-phantix-700/40 p-3.5 text-xs leading-5 text-slate-400">
              Everything is written only to the <span className="font-mono text-gold-300">phantix</span> schema in a
              database you own. Phantix connects dynamically per request — there is no copy on our side.
            </p>
          </div>

          <div className="card p-6">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-severity-critical/12 text-severity-critical"><EyeOff size={18} /></span>
              <h2 className="font-display text-lg font-semibold text-white">What Phantix never touches</h2>
            </div>
            <ul className="mt-4 space-y-2.5">
              {[
                "Production application tables and business rows",
                "Customer PII datasets — config inspection reads catalogs and security metadata only",
                "Document or collection contents in Mongo / Firestore — names and ids only",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2.5 text-sm text-slate-300">
                  <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-severity-critical/80" /> {t}
                </li>
              ))}
            </ul>
          </div>

          <div className="card p-6">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-phantix-700/50 text-phantix-300"><KeyRound size={18} /></span>
              <h2 className="font-display text-lg font-semibold text-white">Identity & verification</h2>
            </div>
            <ul className="mt-4 space-y-2.5">
              {[
                "Sign-in email is verified with a one-time code — email OTP only, no phone OTP",
                "Company verification is optional: domain DNS/HTTP token, CAC/RC details, or manual staff review",
                "Operators use named org-user logins with domain-email OTP and device binding",
                "Sensitive mutations require dual control — one person proposes, another approves",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2.5 text-sm text-slate-300">
                  <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-400" /> {t}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-phantix-700/40 bg-phantix-900/50 px-6 py-4">
            <p className="text-sm text-slate-400">Ready to proceed?</p>
            <Link to="/login" className="btn-primary !py-2">Sign in</Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
