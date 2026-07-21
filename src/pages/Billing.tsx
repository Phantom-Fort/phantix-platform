import React from "react";
import { motion } from "framer-motion";
import { CreditCard, CheckCircle2, Download } from "lucide-react";
import { PageHeader, Card, CardHeader, StatusBadge } from "@/components/ui";
import { useStore } from "@/lib/store";
import { formatNaira, timeAgo } from "@/lib/utils";

export default function Billing() {
  const { state, toast } = useStore();

  return (
    <div className="mx-auto max-w-[1200px]">
      <PageHeader
        title="Billing"
        description="Plan and payments bind to the company (organization_id) — all users and keys share the org bucket. Rate limits lift with plan upgrades, no token changes needed."
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardHeader title="Current plan" subtitle="GET /billing/subscription" action={<CreditCard size={16} className="text-slate-500" />} />
            <div className="rounded-2xl border border-gold-400/25 bg-gradient-to-b from-gold-400/10 to-transparent p-5">
              <div className="flex items-center justify-between">
                <p className="font-display text-2xl font-bold text-white">{state.org.plan}</p>
                <StatusBadge status="active" />
              </div>
              <p className="mt-2 text-sm text-slate-400">{formatNaira(100000)}/month · first month {formatNaira(50000)} (50% off)</p>
              <ul className="mt-4 space-y-2">
                {["All 11 product engines", "Unlimited campaigns & scans (one active each)", "Verified-only reporting (PDF/DOCX)", "Dual-control + audit exports"].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-slate-300">
                    <CheckCircle2 size={14} className="text-emerald-400" /> {f}
                  </li>
                ))}
              </ul>
              <div className="mt-5 flex gap-2.5">
                <button className="btn-primary flex-1" onClick={() => toast("info", "Plan change", "POST /billing/subscribe — proration applies.")}>Change plan</button>
                <button className="btn-ghost" onClick={() => toast("warning", "Cancel subscription", "POST /billing/subscription/cancel — access continues to period end.")}>Cancel</button>
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
          <Card>
            <CardHeader title="Payments" subtitle="GET /billing/payments" action={<Download size={15} className="text-slate-500" />} />
            <div className="space-y-2.5">
              {state.payments.map((p) => (
                <div key={p.id} className="flex items-center gap-4 rounded-xl border border-phantix-700/40 bg-phantix-950/50 px-4 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-sm text-slate-200">{p.reference}</p>
                    <p className="text-xs text-slate-500">{p.period}</p>
                  </div>
                  <span className="font-semibold text-slate-200">{formatNaira(p.amount_ngn)}</span>
                  <StatusBadge status={p.status} />
                  {p.status === "pending" && (
                    <button className="btn-primary !px-3 !py-1.5 !text-xs" onClick={() => toast("info", "Payment", `POST /billing/payments/${p.id}/pay`)}>Pay</button>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-4 text-[11px] leading-4 text-slate-500">
              Staff set the monthly list price in Naira; yearly is auto-calculated. Renewals run via the cron-friendly
              admin job — you're notified before any charge.
            </p>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
