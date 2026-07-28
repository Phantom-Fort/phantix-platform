import React, { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CreditCard, CheckCircle2, Download, Ticket, AlertTriangle, RefreshCw, DollarSign, X, ArrowRight, Info } from "lucide-react";
import { PageHeader, Card, CardHeader, StatusBadge, Modal, Spinner } from "@/components/ui";
import { api, DEMO_MODE } from "@/lib/api";
import { useStore } from "@/lib/store";
import { formatNaira, timeAgo, cx } from "@/lib/utils";

interface Entitlements { billing_enforcement: { enabled: boolean; mode: string; environment: string }; premium_active: boolean; full_access_coupon: any; subscription: any; packs: any[]; message: string; }
interface PricingInfo { monthly_list_price_ngn: number; first_month_price_ngn: number; subsequent_monthly_price_ngn: number; yearly_price_ngn: number; first_month_discount_percent: number; }
interface SubscriptionInfo { id: number; status: string; billing_cycle: string; grant_source: string; current_period_start: string; current_period_end: string; }
interface PaymentInfo { id: number; reference: string; amount_due_ngn: number; status: string; purpose: string; discount_percent: number; created_at: string; }

const demoEntitlements: Entitlements = { billing_enforcement: { enabled: true, mode: "auto", environment: "production" }, premium_active: false, full_access_coupon: null, subscription: null, packs: [], message: "Dev mode" };
const demoPricing: PricingInfo = { monthly_list_price_ngn: 100000, first_month_price_ngn: 50000, subsequent_monthly_price_ngn: 100000, yearly_price_ngn: 1000000, first_month_discount_percent: 50 };
const demoSubscription: SubscriptionInfo = { id: 1, status: "active", billing_cycle: "monthly", grant_source: "payment", current_period_start: "2026-07-01T00:00:00Z", current_period_end: "2026-08-01T00:00:00Z" };

export default function Billing() {
  const { state, toast, session } = useStore();
  const [loading, setLoading] = useState(true);
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null);
  const [pricing, setPricing] = useState<PricingInfo | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [payments, setPayments] = useState<PaymentInfo[]>([]);
  const [gatewayPublicKey, setGatewayPublicKey] = useState("");
  const [selectedCycle, setSelectedCycle] = useState<"monthly" | "yearly">("monthly");
  const [busy, setBusy] = useState(false);
  const [payingId, setPayingId] = useState<number | null>(null);
  const [showCoupon, setShowCoupon] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (DEMO_MODE) { setEntitlements(demoEntitlements); setPricing(demoPricing); setSubscription(demoSubscription); setPayments([]); setLoading(false); return; }
      const [entRes, priceRes, gwRes] = await Promise.all([
        api.get<any>("/billing/entitlements").catch(() => null),
        api.get<PricingInfo>("/billing/pricing").catch(() => null),
        api.get<any>("/billing/gateway").catch(() => null),
      ]);
      setEntitlements(entRes); setPricing(priceRes);
      if (gwRes?.public_key) setGatewayPublicKey(gwRes.public_key);
      api.get<SubscriptionInfo>("/billing/subscription").then(setSubscription).catch(() => setSubscription(null));
      api.get<{ items: PaymentInfo[] }>("/billing/payments").then(r => setPayments(r?.items ?? [])).catch(() => {});
    } catch { } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSubscribe = async () => {
    setBusy(true);
    try {
      const res = await api.post<any>("/billing/subscribe", { billing_cycle: selectedCycle });
      const paymentId = res?.payment?.id;
      if (paymentId) {
        setPayingId(paymentId);
        const initRes = await api.post<any>(`/billing/payments/${paymentId}/initialize`, { email: session?.email || state.org.email || "", callback_url: `${window.location.origin}/billing` });
        if (initRes?.authorization_url) window.open(initRes.authorization_url, "_blank");
        else toast("info", "Paystack", `Access code: ${initRes?.access_code ?? "N/A"} — complete payment then click Verify below`);
      }
    } catch (e) { toast("error", "Subscribe failed", e instanceof Error ? e.message : ""); }
    finally { setBusy(false); }
  };

  const handleVerify = async (paymentId: number) => {
    try { await api.post(`/billing/payments/${paymentId}/verify`, {}); toast("success", "Payment verified"); loadData(); setPayingId(null); } catch (e) { toast("error", "Verification failed"); }
  };

  const handleRedeemCoupon = async () => {
    if (!couponCode.trim()) return;
    setBusy(true);
    try { await api.post("/billing/coupons/redeem", { code: couponCode.trim() }); toast("success", "Coupon redeemed", "Full access activated"); setShowCoupon(false); setCouponCode(""); loadData(); } catch (e) { toast("error", "Invalid code", e instanceof Error ? e.message : ""); }
    finally { setBusy(false); }
  };

  const handleCancel = async () => {
    try { await api.post("/billing/subscription/cancel", {}); toast("warning", "Cancelled", "Auto-renew cancelled — access continues to period end"); setShowCancelConfirm(false); loadData(); } catch (e) { toast("error", "Failed"); }
  };

  if (loading) return <div className="flex min-h-[40vh] items-center justify-center"><Spinner className="h-6 w-6" /></div>;

  const isPremium = entitlements?.premium_active || subscription?.status === "active";
  const isPastDue = subscription?.status === "past_due";
  const isGrace = (entitlements as any)?.subscription?.in_grace_period || isPastDue;
  const daysUntilEnd = subscription?.current_period_end ? Math.ceil((new Date(subscription.current_period_end).getTime() - Date.now()) / 86400000) : null;
  const expiringSoon = isPremium && daysUntilEnd !== null && daysUntilEnd <= 5 && daysUntilEnd >= 0;
  const isCoupon = subscription?.grant_source === "coupon";
  const price = pricing?.monthly_list_price_ngn ?? 100000;

  return (
    <div className="mx-auto max-w-[1200px]">
      <PageHeader title="Billing" description="Manage your Phantix subscription, payments, and access" actions={<button onClick={loadData} className="btn-ghost"><RefreshCw size={15} /></button>} />

      {/* Subscription alerts */}
      {isGrace && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-400/25 bg-amber-400/5 px-4 py-3">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-400" />
          <div>
            <p className="text-sm font-semibold text-amber-300">Grace period active</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Your Premium access continues until {(entitlements as any)?.subscription?.grace_ends_at ? timeAgo((entitlements as any).subscription.grace_ends_at) : "grace expires"}. Pay the renewal invoice to stay Premium.
            </p>
          </div>
        </div>
      )}
      {expiringSoon && !isGrace && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-gold-400/25 bg-gold-400/5 px-4 py-3">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-gold-400" />
          <p className="text-sm text-slate-200">Your Premium subscription {daysUntilEnd === 0 ? "expires today" : `ends in ${daysUntilEnd} day${daysUntilEnd === 1 ? "" : "s"}`}. <button onClick={() => setShowCoupon(true)} className="text-gold-400 hover:text-gold-300 underline">Redeem a coupon</button> or renew via subscribe.</p>
        </div>
      )}
      {!isPremium && !isGrace && entitlements && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-slate-500/25 bg-slate-500/5 px-4 py-3">
          <Info size={16} className="mt-0.5 shrink-0 text-slate-400" />
          <div>
            <p className="text-sm text-slate-300">You're on the Free plan.</p>
            <p className="text-xs text-slate-400 mt-0.5">Limited to {(entitlements as any)?.billing_enforcement?.free_asset_cap ?? 25} assets and {(entitlements as any)?.billing_enforcement?.free_org_user_cap ?? 2} users. Upgrade to Premium for full access.</p>
          </div>
        </div>
      )}

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className={cx("chip", isPremium ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-slate-500/50 bg-slate-500/10 text-slate-500")}>
          {isGrace ? "Grace period" : isCoupon ? `Beta access until ${subscription?.current_period_end ? timeAgo(subscription.current_period_end) : "expiry"}` : isPremium ? "Premium active" : "Free plan"}
        </div>
        {isPremium && subscription?.current_period_end && <span className="text-xs text-slate-400">{isGrace ? "Renewal overdue" : `Renews ${timeAgo(subscription.current_period_end)}`}</span>}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Plan selector */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardHeader title={isPremium ? "Your plan" : "Choose a plan"} subtitle={`${entitlements?.billing_enforcement?.enabled ? "Billing gates active" : "Dev mode — gates off"}`} />
            <div className="space-y-4">
              <div className="flex gap-2 mb-4">
                {(["monthly", "yearly"] as const).map(c => <button key={c} onClick={() => setSelectedCycle(c)} className={cx("flex-1 rounded-xl border py-3 text-sm font-semibold transition-colors", selectedCycle === c ? "border-gold-400/50 bg-gold-400/10 text-gold-300" : "border-phantix-700/40 text-slate-400 hover:bg-phantix-800/60")}>{c === "monthly" ? "Monthly" : "Yearly"}</button>)}
              </div>
              {pricing && (
                <div className="rounded-2xl border border-gold-400/25 bg-gradient-to-b from-gold-400/10 to-transparent p-5 text-center">
                  <p className="font-display text-3xl font-bold text-white">{formatNaira(selectedCycle === "monthly" ? (pricing.first_month_price_ngn || price) : pricing.yearly_price_ngn)}</p>
                  <p className="mt-1 text-sm text-slate-400">{selectedCycle === "monthly" ? `First month (${pricing.first_month_discount_percent}% off) · then ${formatNaira(pricing.subsequent_monthly_price_ngn)}/mo` : "One-time yearly payment"}</p>
                  {selectedCycle === "yearly" && <p className="mt-1 text-xs text-emerald-400">Save ~{Math.round((1 - pricing.yearly_price_ngn / (pricing.monthly_list_price_ngn * 12)) * 100)}% vs monthly</p>}
                </div>
              )}
              {!isPremium && <button onClick={handleSubscribe} disabled={busy} className="btn-primary w-full !py-3">{busy ? <Spinner className="h-4 w-4" /> : <><CreditCard size={15} /> Subscribe</>}</button>}
              {payingId && <button onClick={() => handleVerify(payingId)} className="btn-secondary w-full !py-2 text-sm"><CheckCircle2 size={14} /> Verify Payment #{payingId}</button>}
              {isPremium && subscription?.grant_source === "payment" && <button onClick={() => setShowCancelConfirm(true)} className="btn-ghost w-full text-sm text-severity-critical">Cancel auto-renew</button>}
            </div>
          </Card>
        </motion.div>

        {/* Coupons + Features */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
          <Card>
            <CardHeader title="Premium features" subtitle={isPremium ? "You have full access" : "Upgrade to unlock"} />
            <ul className="space-y-2.5 mb-4">
              {["All 11 product engines", "Unlimited campaigns & scans", "Verified-only PDF/DOCX reports", "Dual-control + audit exports", "WA/Telegram alert channels", "AI-assisted remediation"].map(f => <li key={f} className="flex items-center gap-2 text-sm text-slate-300"><CheckCircle2 size={14} className={isPremium ? "text-emerald-400" : "text-slate-600"} /> {f}</li>)}
            </ul>
            <button onClick={() => setShowCoupon(true)} className="btn-secondary w-full text-sm"><Ticket size={14} /> Redeem beta code</button>
          </Card>
        </motion.div>
      </div>

      {/* Payments history */}
      {payments.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }} className="mt-5">
          <Card>
            <CardHeader title="Payment history" subtitle={`${payments.length} invoices`} />
            <div className="space-y-2">
              {payments.map(p => (
                <div key={p.id} className="flex items-center gap-4 rounded-xl border border-phantix-700/40 bg-phantix-950/50 px-4 py-3">
                  <div className="min-w-0 flex-1"><p className="font-mono text-sm text-slate-200">{p.reference}</p><p className="text-xs text-slate-500">{p.purpose} · {p.discount_percent ? `${p.discount_percent}% off` : ""} · {timeAgo(p.created_at)}</p></div>
                  <span className="font-semibold text-slate-200">{formatNaira(p.amount_due_ngn)}</span>
                  <StatusBadge status={p.status} />
                  {p.status === "pending" && <button onClick={() => { setPayingId(p.id); handleVerify(p.id); }} className="btn-primary !px-3 !py-1.5 !text-xs">Pay</button>}
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      )}

      {/* Coupon modal */}
      <Modal open={showCoupon} onClose={() => setShowCoupon(false)} title="Redeem beta code">
        <div className="space-y-3"><p className="text-sm text-slate-400">Enter a staff-issued beta code for full Premium access (up to 31 days).</p>
          <input className="input font-mono text-sm" value={couponCode} onChange={e => setCouponCode(e.target.value.toUpperCase())} placeholder="BETA-XXXX-XXXX" />
          <button onClick={handleRedeemCoupon} disabled={busy} className="btn-primary w-full">{busy ? "Redeeming..." : "Redeem"}</button>
        </div>
      </Modal>

      {/* Cancel confirm */}
      <Modal open={showCancelConfirm} onClose={() => setShowCancelConfirm(false)} title="Cancel auto-renew?">
        <div className="space-y-3"><div className="flex items-center gap-2 p-3 rounded-xl bg-severity-medium/10 border border-severity-medium/20"><AlertTriangle size={16} className="text-severity-medium" /><p className="text-sm text-slate-300">Your Premium access continues until {subscription?.current_period_end ? timeAgo(subscription.current_period_end) : "period end"}. After that, you'll be on the free plan.</p></div>
          <button onClick={handleCancel} className="btn-danger w-full">Confirm cancellation</button>
        </div>
      </Modal>
    </div>
  );
}
