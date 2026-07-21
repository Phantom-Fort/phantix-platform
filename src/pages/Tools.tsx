import React from "react";
import { motion } from "framer-motion";
import { Wrench, CheckCircle2, Plus } from "lucide-react";
import { PageHeader, Card, StatusBadge } from "@/components/ui";
import { useStore } from "@/lib/store";
import { cx } from "@/lib/utils";

export default function Tools() {
  const { state, toggleTool, operate, toast } = useStore();

  return (
    <div className="mx-auto max-w-[1200px]">
      <PageHeader
        title="Tool catalog"
        description="Scanner tooling subscriptions — separate from platform membership. Staff curate the catalog; you subscribe per company."
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {state.tools.map((t, i) => (
          <motion.div key={t.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card hover className={cx("h-full", t.subscribed && "border-emerald-400/20")}>
              <div className="flex items-start justify-between">
                <span className={cx("flex h-11 w-11 items-center justify-center rounded-xl", t.subscribed ? "bg-emerald-400/12 text-emerald-400" : "bg-phantix-800/70 text-phantix-300")}>
                  <Wrench size={17} />
                </span>
                <StatusBadge status={t.subscribed ? "subscribed" : "draft"} />
              </div>
              <h3 className="mt-3 font-display text-base font-semibold text-slate-100">{t.name}</h3>
              <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-slate-600">{t.category}</p>
              <p className="mt-2 text-[13px] leading-5 text-slate-400">{t.description}</p>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs text-slate-500">{t.price_note}</span>
                <button
                  className={t.subscribed ? "btn-ghost !px-3 !py-1.5 !text-xs" : "btn-primary !px-3.5 !py-1.5 !text-xs"}
                  onClick={async () => {
                    if (!t.subscribed && !operate.unlocked) {
                      return toast("warning", "Operate mode required", "Tool subscriptions are mutations — unlock dual control.");
                    }
                    await toggleTool(t.id);
                    toast("success", t.subscribed ? "Unsubscribed" : `${t.name} subscribed`, t.subscribed ? undefined : "POST /tools/subscribe");
                  }}
                >
                  {t.subscribed ? "Unsubscribe" : <><Plus size={12} /> Subscribe</>}
                </button>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
      <p className="mt-5 text-xs text-slate-500">
        Missing a tool? Request it via <span className="font-mono">POST /tools/request</span> — staff review and
        provision it to your organization.
      </p>
    </div>
  );
}
