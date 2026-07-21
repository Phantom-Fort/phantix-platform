import React from "react";
import { motion } from "framer-motion";
import { Download, ArrowRight } from "lucide-react";
import { PageHeader, Card, StatusBadge } from "@/components/ui";
import { useStore } from "@/lib/store";
import { timeAgo } from "@/lib/utils";

export default function Audit() {
  const { state, toast } = useStore();

  return (
    <div className="mx-auto max-w-[1200px]">
      <PageHeader
        title="Audit trail"
        description="Immutable platform-DB trail. Once dual control is active, completed actions carry initiator and authorizer name + title snapshots for compliance export."
        actions={
          <button className="btn-secondary" onClick={() => toast("info", "Export", "GET /audit/export?format=csv — both names on every row.")}>
            <Download size={15} /> Export CSV
          </button>
        }
      />

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="!p-0 overflow-hidden">
          <div className="relative">
            <div className="absolute bottom-0 left-[29px] top-0 w-px bg-phantix-700/50" />
            {state.audit.map((e, i) => (
              <motion.div
                key={e.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="relative flex items-start gap-4 border-b border-phantix-800/40 px-5 py-4 last:border-0 hover:bg-phantix-800/25"
              >
                <span className="relative z-10 mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 border-gold-400/60 bg-phantix-950">
                  <span className="h-1.5 w-1.5 rounded-full bg-gold-400" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-slate-200">{e.action}</p>
                    <span className="rounded-md bg-phantix-800/80 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">{e.event_key}</span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    {e.initiator_name && (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="flex h-5 w-5 items-center justify-center rounded-md bg-phantix-700/60 text-[9px] font-bold text-phantix-200">
                          {e.initiator_name.slice(0, 1)}
                        </span>
                        {e.initiator_name} · {e.initiator_title}
                      </span>
                    )}
                    {e.authorizer_name && (
                      <>
                        <ArrowRight size={11} className="text-gold-500" />
                        <span className="inline-flex items-center gap-1.5">
                          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-gold-400/20 text-[9px] font-bold text-gold-300">
                            {e.authorizer_name.slice(0, 1)}
                          </span>
                          {e.authorizer_name} · {e.authorizer_title}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <span className="shrink-0 text-xs text-slate-500">{timeAgo(e.created_at)}</span>
              </motion.div>
            ))}
            {state.audit.length === 0 && (
              <p className="px-6 py-10 text-center text-sm text-slate-500">No events yet.</p>
            )}
          </div>
        </Card>
      </motion.div>

      <p className="mt-4 text-xs text-slate-500">
        Dual-control audit lives on the platform DB per organization — it is never written into your customer
        security database. Asset-level change history lives there instead (asset_history).
      </p>
    </div>
  );
}
