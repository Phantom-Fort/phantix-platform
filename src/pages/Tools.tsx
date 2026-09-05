import React from "react";
import { motion } from "framer-motion";
import { Wrench, CheckCircle2, Plus, Lock } from "lucide-react";
import { PageHeader, Card, StatusBadge } from "@/components/ui";
import { useStore } from "@/lib/store";
import { cx } from "@/lib/utils";

function toolLabel(t: { tier?: string; pricing_model?: string }): string {
  const tier = t.tier ?? (t.pricing_model === "paid" ? "addon_subscription" : "free");
  if (tier === "addon_subscription") return "Subscribe";
  if (tier === "addon_engagement") return "Request";
  return "Enable";
}

export default function Tools() {
  const { state, toggleTool, toast } = useStore();

  return (
    <div className="mx-auto max-w-[1200px]">
      <PageHeader
        title="Tool catalog"
        description="Scanner tooling subscriptions --- separate from platform membership. Staff curate the catalog; you subscribe per company."
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {state.tools.map((t, i) => {
          const locked = !t.subscribed && t.eligible === false;
          return (
            <motion.div key={t.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card hover className={cx("h-full", t.subscribed && "border-emerald-400/20")}>
                <div className="flex items-start justify-between">
                  <span className={cx("flex h-11 w-11 items-center justify-center rounded-md", t.subscribed ? "bg-emerald-400/12 text-emerald-400" : "bg-phantix-800/70 text-phantix-300")}>
                    <Wrench size={17} />
                  </span>
                  <StatusBadge status={t.subscribed ? "subscribed" : locked ? "pending" : "draft"} />
                </div>
                <h3 className="mt-3 font-display text-base font-semibold text-slate-100">{t.name}</h3>
                <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-slate-600">{t.category}</p>
                <p className="mt-2 text-[13px] leading-5 text-slate-400">{t.description}</p>
                {locked && t.eligibility_reason && (
                  <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-4 text-amber-300/80">
                    <Lock size={11} className="mt-0.5 shrink-0" /> {t.eligibility_reason}
                  </p>
                )}
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs text-slate-500">{t.price_note}</span>
                  <button
                    disabled={locked}
                    className={t.subscribed ? "btn-ghost !px-3 !py-1.5 !text-xs" : locked ? "btn-ghost !px-3 !py-1.5 !text-xs opacity-50" : "btn-primary !px-3.5 !py-1.5 !text-xs"}
                    onClick={async () => {
                      try {
                        await toggleTool(t);
                        toast("success", t.subscribed ? "Disabled locally" : `${t.name} activated`, t.subscribed ? "No cancel endpoint yet — status shown for this session." : "Subscription request sent");
                      } catch (err) {
                        toast("error", "Action failed", err instanceof Error ? err.message : "Could not update tool subscription");
                      }
                    }}
                  >
                    {t.subscribed ? "Disable" : <>{locked ? <><Lock size={12} /> Locked</> : <><Plus size={12} /> {toolLabel(t)}</>}</>}
                  </button>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>
      <p className="mt-5 text-xs text-slate-500">
        Free tools auto-provision on enable. Paid add-ons activate a monthly subscription. Engagement tools submit a
        request for staff provisioning.
      </p>
    </div>
  );
}
