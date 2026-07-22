import React, { useState } from "react";
import { motion } from "framer-motion";
import { BellRing, Send, Settings, ShieldCheck, AlertTriangle } from "lucide-react";
import { PageHeader, Card, CardHeader, StatusBadge, Tabs, Modal } from "@/components/ui";
import { useStore } from "@/lib/store";
import { timeAgo, cx } from "@/lib/utils";
import type { Severity } from "@/lib/types";

const severityBadge: Record<Severity, string> = {
  critical: "border-severity-critical/30 bg-severity-critical/10 text-severity-critical",
  high: "border-severity-high/30 bg-severity-high/10 text-severity-high",
  medium: "border-severity-medium/30 bg-severity-medium/10 text-severity-medium",
  low: "border-severity-low/30 bg-severity-low/10 text-severity-low",
  info: "border-slate-500/30 bg-slate-500/10 text-slate-500",
};

const severityMeta: Record<Severity, string> = {
  critical: "border-l-severity-critical",
  high: "border-l-severity-high",
  medium: "border-l-severity-medium",
  low: "border-l-severity-low",
  info: "border-l-slate-500",
};

export default function Alerts() {
  const { state, operate, requireDualControl, sendTestAlert, updateAlertSettings, toast } = useStore();
  const [tab, setTab] = useState("log");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const { alerts, alertSettings } = state;

  const handleTest = async () => {
    if (!operate.unlocked && !(await requireDualControl("Send test alert requires dual-control."))) return;
    setBusy(true);
    try {
      await sendTestAlert();
      toast("success", "Test sent", "Check alert channels for delivery.");
    } catch (err) {
      toast("error", "Send failed", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1200px]">
      <PageHeader
        title="Alerts"
        description="Delivery log and channel configuration — SMTP, WhatsApp, Telegram"
        actions={
          <button className="btn-primary" onClick={handleTest} disabled={busy}>
            <Send size={15} /> {busy ? "Sending…" : "Send test alert"}
          </button>
        }
      />

      <Tabs
        tabs={[
          { id: "log", label: "Delivery log", count: alerts.length },
          { id: "channels", label: "Channels & SMTP" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "log" && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          {alerts.length === 0 ? (
            <Card>
              <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-phantix-800/70 text-phantix-300"><BellRing size={22} /></div>
                <p className="font-medium text-slate-300">No alerts yet</p>
                <p className="mt-1 text-sm text-slate-500">Delivery events appear here after alerts are triggered by findings or scans.</p>
              </div>
            </Card>
          ) : (
            <Card className="!p-0 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-phantix-700/40 text-left text-[11px] uppercase tracking-wider text-slate-500">
                    <th className="px-5 py-3 font-medium">Event</th>
                    <th className="px-5 py-3 font-medium">Severity</th>
                    <th className="px-5 py-3 font-medium">Channels</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">When</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.map((a) => (
                    <tr key={a.id} className={cx("border-b border-phantix-800/40 hover:bg-phantix-800/35 text-sm border-l-2", severityMeta[a.severity])}>
                      <td className="px-5 py-3">
                        <p className="font-medium text-slate-200">{a.title}</p>
                        <p className="text-xs text-slate-500">{a.event_type}</p>
                      </td>
                      <td className="px-5 py-3"><span className={cx("chip capitalize", severityBadge[a.severity])}>{a.severity}</span></td>
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap gap-1">
                          {a.channels.map((ch) => (
                            <span key={ch} className="chip text-xs">{ch}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-5 py-3"><StatusBadge status={a.status} /></td>
                      <td className="px-5 py-3 text-xs text-slate-500">{timeAgo(a.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </motion.div>
      )}

      {tab === "channels" && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader title="SMTP" subtitle="Outbound email relay" action={<ShieldCheck size={16} className={alertSettings.smtp.enabled ? "text-emerald-400" : "text-slate-500"} />} />
              <div className="space-y-3 text-sm">
                <div className="flex justify-between rounded-xl bg-phantix-950/60 border border-phantix-700/40 p-3">
                  <span className="text-slate-300">Status</span>
                  <StatusBadge status={alertSettings.alerts_enabled ? "active" : "draft"} />
                </div>
                {alertSettings.smtp.enabled ? (
                  <>
                    <div className="rounded-xl bg-phantix-950/60 border border-phantix-700/40 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-slate-500">Server</p>
                      <p className="mt-1 font-mono text-xs text-slate-300">{alertSettings.smtp.host}:{alertSettings.smtp.port}</p>
                    </div>
                    <div className="rounded-xl bg-phantix-950/60 border border-phantix-700/40 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-slate-500">From</p>
                      <p className="mt-1 text-xs text-slate-300">{alertSettings.smtp.from_name} &lt;{alertSettings.smtp.from_email}&gt;</p>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-slate-500">SMTP not configured — alerts use the platform default.</p>
                )}
                <button className="btn-secondary w-full" onClick={() => setSettingsOpen(true)}>
                  <Settings size={14} /> Configure SMTP
                </button>
              </div>
            </Card>

            <Card>
              <CardHeader title="Channels" subtitle="WhatsApp & Telegram delivery" />
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-xl border border-phantix-700/40 bg-phantix-950/50 p-3.5">
                  <div>
                    <p className="text-sm font-medium text-slate-200">WhatsApp</p>
                    <p className="text-xs text-slate-500">{alertSettings.whatsapp.enabled ? `${alertSettings.whatsapp.recipients.length} recipient(s)` : "Not configured"}</p>
                  </div>
                  <StatusBadge status={alertSettings.whatsapp.enabled ? "active" : "draft"} />
                </div>
                <div className="flex items-center justify-between rounded-xl border border-phantix-700/40 bg-phantix-950/50 p-3.5">
                  <div>
                    <p className="text-sm font-medium text-slate-200">Telegram</p>
                    <p className="text-xs text-slate-500">{alertSettings.telegram.enabled ? `${alertSettings.telegram.recipients.length} recipient(s)` : "Not configured"}</p>
                  </div>
                  <StatusBadge status={alertSettings.telegram.enabled ? "active" : "draft"} />
                </div>
              </div>
            </Card>
          </div>

          <Card className="mt-5">
            <CardHeader title="Notification rules" subtitle={`Toggle which severities trigger alerts`} />
            <div className="flex flex-wrap gap-3">
              {(["critical", "high", "medium", "low", "info"] as Severity[]).map((s) => {
                const on = alertSettings.notify[s] !== false;
                return (
                  <button
                    key={s}
                    onClick={async () => {
                      if (!operate.unlocked && !(await requireDualControl("Updating alert settings requires dual-control."))) return;
                      await updateAlertSettings({ notify: { ...alertSettings.notify, [s]: !on } });
                      toast("success", on ? `${s} alerts disabled` : `${s} alerts enabled`);
                    }}
                    className={cx("chip cursor-pointer capitalize", on ? "border-gold-400/40 bg-gold-400/10 text-gold-300" : "border-phantix-700/50 text-slate-500")}
                  >
                    <BellRing size={12} /> {s}
                  </button>
                );
              })}
            </div>
          </Card>
        </motion.div>
      )}

      <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)} title="SMTP Configuration">
        <div className="space-y-4">
          <div className="rounded-xl border border-severity-medium/30 bg-severity-medium/8 p-3.5 text-xs leading-5 text-slate-400">
            <AlertTriangle size={12} className="inline mr-1 text-severity-medium" />
            SMTP settings are managed on the Phantix Platform backend. Contact support to configure your organization's email relay.
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-phantix-950/60 border border-phantix-700/40 p-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Host</p>
              <p className="mt-1 font-mono text-slate-200">{alertSettings.smtp.host || "—"}</p>
            </div>
            <div className="rounded-xl bg-phantix-950/60 border border-phantix-700/40 p-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Port</p>
              <p className="mt-1 font-mono text-slate-200">{alertSettings.smtp.port || "—"}</p>
            </div>
            <div className="col-span-2 rounded-xl bg-phantix-950/60 border border-phantix-700/40 p-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-500">From</p>
              <p className="mt-1 text-slate-200">{alertSettings.smtp.from_name ? `${alertSettings.smtp.from_name} <${alertSettings.smtp.from_email}>` : "—"}</p>
            </div>
          </div>
          <button className="btn-secondary w-full" onClick={() => setSettingsOpen(false)}>Close</button>
        </div>
      </Modal>
    </div>
  );
}
