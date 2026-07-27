import React, { useState } from "react";
import { motion } from "framer-motion";
import { BellRing, Send, Settings, ShieldCheck } from "lucide-react";
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
  const [channelsOpen, setChannelsOpen] = useState(false);
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
              <CardHeader title="Channels" subtitle="WhatsApp (Meta Cloud) & Telegram (Bot API)" />
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-xl border border-phantix-700/40 bg-phantix-950/50 p-3.5">
                  <div>
                    <p className="text-sm font-medium text-slate-200">WhatsApp</p>
                    <p className="text-xs text-slate-500">
                      {(alertSettings.whatsapp as any).delivery_live
                        ? <span className="text-emerald-400">Live via Meta Cloud API</span>
                        : alertSettings.whatsapp.enabled
                          ? <span className="text-severity-medium">Enabled — provider not live</span>
                          : "Not configured"
                      }
                      {alertSettings.whatsapp.enabled && alertSettings.whatsapp.recipients.length > 0 && (
                        <span className="block text-slate-500">{alertSettings.whatsapp.recipients.join(", ")}</span>
                      )}
                    </p>
                  </div>
                  <StatusBadge status={(alertSettings.whatsapp as any).delivery_live ? "active" : alertSettings.whatsapp.enabled ? "queued" : "draft"} />
                </div>
                <div className="flex items-center justify-between rounded-xl border border-phantix-700/40 bg-phantix-950/50 p-3.5">
                  <div>
                    <p className="text-sm font-medium text-slate-200">Telegram</p>
                    <p className="text-xs text-slate-500">
                      {(alertSettings.telegram as any).delivery_live
                        ? <span className="text-emerald-400">Live via Bot API</span>
                        : alertSettings.telegram.enabled
                          ? <span className="text-severity-medium">Enabled — provider not live</span>
                          : "Not configured"
                      }
                      {alertSettings.telegram.enabled && alertSettings.telegram.recipients.length > 0 && (
                        <span className="block text-slate-500">{alertSettings.telegram.recipients.join(", ")}</span>
                      )}
                    </p>
                  </div>
                  <StatusBadge status={(alertSettings.telegram as any).delivery_live ? "active" : alertSettings.telegram.enabled ? "queued" : "draft"} />
                </div>
                <button className="btn-secondary w-full" onClick={() => setChannelsOpen(true)}>
                  <Settings size={14} /> Configure Channels
                </button>
              </div>
            </Card>
          </div>

          <Card className="mt-5">
            <CardHeader title="Notification rules" subtitle="Toggle which events trigger alerts" />
            <div className="flex flex-wrap gap-3">
              {[
                { key: "scan_completed", label: "Scan complete" },
                { key: "scan_failed", label: "Scan failed" },
                { key: "risk_created", label: "Risk created" },
                { key: "risk_critical", label: "Risk critical" },
                { key: "treatment_events", label: "Treatment events" },
              ].map(({ key, label }) => {
                const on = (alertSettings.notify as any)?.[key] !== false;
                return (
                  <button
                    key={key}
                    onClick={async () => {
                      if (!operate.unlocked && !(await requireDualControl("Updating alert settings requires dual-control."))) return;
                      await updateAlertSettings({ notify: { ...alertSettings.notify, [key]: !on } } as any);
                      toast("success", on ? `${label} disabled` : `${label} enabled`);
                    }}
                    className={cx("chip cursor-pointer capitalize", on ? "border-gold-400/40 bg-gold-400/10 text-gold-300" : "border-phantix-700/50 text-slate-500")}
                  >
                    <BellRing size={12} /> {label}
                  </button>
                );
              })}
            </div>
          </Card>
        </motion.div>
      )}

      <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)} title="Configure SMTP">
        <SMTPForm
          initial={alertSettings}
          onSave={async (form) => {
            if (!operate.unlocked && !(await requireDualControl("Updating SMTP settings requires dual-control."))) return;
            setBusy(true);
            try {
              const smtpUpdate: Record<string, unknown> = {
                ...alertSettings.smtp,
                enabled: true,
                host: form.host,
                port: form.port,
                from_email: form.from_email,
                from_name: form.from_name,
                use_tls: form.use_tls,
              };
              if (form.username) smtpUpdate.username = form.username;
              if (form.password) smtpUpdate.password = form.password;
              await updateAlertSettings({
                smtp: smtpUpdate,
                email_recipients: form.recipients.split(",").map((s: string) => s.trim()).filter(Boolean),
              } as any);
              toast("success", "SMTP updated");
              setSettingsOpen(false);
            } catch (err) {
              toast("error", "Save failed", err instanceof Error ? err.message : "");
            } finally {
              setBusy(false);
            }
          }}
          busy={busy}
        />
      </Modal>

      <Modal open={channelsOpen} onClose={() => setChannelsOpen(false)} title="Configure Alert Channels">
        <ChannelsForm
          initial={alertSettings}
          onSave={async (form) => {
            if (!operate.unlocked && !(await requireDualControl("Updating channel settings requires dual-control."))) return;
            setBusy(true);
            try {
              const tgUpdate: Record<string, unknown> = {
                ...alertSettings.telegram,
                enabled: form.tgEnabled,
                provider: form.tgEnabled ? (alertSettings.telegram.provider || "auto") : alertSettings.telegram.provider,
                recipients: form.tgRecipients.split(",").map((s: string) => s.trim()).filter(Boolean),
              };
              if (form.tgBotToken) tgUpdate.bot_token = form.tgBotToken;
              await updateAlertSettings({
                whatsapp: {
                  ...alertSettings.whatsapp,
                  enabled: form.waEnabled,
                  provider: form.waEnabled ? (alertSettings.whatsapp.provider || "auto") : alertSettings.whatsapp.provider,
                  recipients: form.waRecipients.split(",").map((s: string) => s.trim()).filter(Boolean),
                } as any,
                telegram: tgUpdate as any,
              });
              toast("success", "Channels updated");
              setChannelsOpen(false);
            } catch (err) {
              toast("error", "Save failed", err instanceof Error ? err.message : "");
            } finally {
              setBusy(false);
            }
          }}
          busy={busy}
        />
      </Modal>
    </div>
  );
}

// ── SMTP Configuration Form ────────────────────────────────────────────────────
function SMTPForm({
  initial, onSave, busy,
}: {
  initial: { smtp: { enabled: boolean; host: string; port: number; from_email: string; from_name: string; use_tls: boolean; username?: string; password?: string }; email_recipients: string[] };
  onSave: (form: { host: string; port: number; from_email: string; from_name: string; use_tls: boolean; username: string; password: string; recipients: string }) => Promise<void>;
  busy: boolean;
}) {
  const [host, setHost] = useState(initial.smtp.host || "");
  const [port, setPort] = useState(initial.smtp.port || 587);
  const [username, setUsername] = useState((initial.smtp as any).username || "");
  const [password, setPassword] = useState("");
  const [fromEmail, setFromEmail] = useState(initial.smtp.from_email || "");
  const [fromName, setFromName] = useState(initial.smtp.from_name || "");
  const [useTls, setUseTls] = useState(initial.smtp.use_tls !== false);
  const [recipients, setRecipients] = useState((initial.email_recipients || []).join(", "));

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-phantix-600/30 bg-phantix-800/30 p-3 text-xs text-slate-400">
        Configure your organization's outbound SMTP relay for alert delivery. Credentials are encrypted at rest.
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">SMTP Host</label>
          <input className="input font-mono text-sm" value={host} onChange={(e) => setHost(e.target.value)} placeholder="smtp-relay.brevo.com" />
        </div>
        <div>
          <label className="label">Port</label>
          <input className="input font-mono text-sm" type="number" value={port} onChange={(e) => setPort(Number(e.target.value))} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">SMTP Username</label>
          <input className="input font-mono text-sm" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="user@smtp-provider.com" />
        </div>
        <div>
          <label className="label">SMTP Password</label>
          <input className="input font-mono text-sm" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Leave blank to keep existing" />
          <p className="text-[10px] text-slate-500 mt-1">Password is encrypted at rest. Leave empty to keep current password unchanged.</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">From Name</label>
          <input className="input text-sm" value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder="Phantix Application" />
        </div>
        <div>
          <label className="label">From Email</label>
          <input className="input text-sm" value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} placeholder="support@phantix.site" />
        </div>
      </div>
      <div>
        <label className="label">Alert Recipients (comma-separated)</label>
        <input className="input text-sm" value={recipients} onChange={(e) => setRecipients(e.target.value)} placeholder="security@acme.com, ciso@acme.com" />
      </div>
      <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-300">
        <input type="checkbox" checked={useTls} onChange={(e) => setUseTls(e.target.checked)} className="rounded accent-gold-400" />
        Use TLS encryption
      </label>
      <button className="btn-primary w-full" onClick={() => onSave({ host, port, from_email: fromEmail, from_name: fromName, use_tls: useTls, username, password, recipients })} disabled={busy || !host}>
        {busy ? "Saving…" : "Save SMTP Settings"}
      </button>
    </div>
  );
}

// ── Channels Configuration Form ────────────────────────────────────────────────
function ChannelsForm({
  initial, onSave, busy,
}: {
  initial: { whatsapp: { enabled: boolean; provider: string; recipients: string[] }; telegram: { enabled: boolean; provider: string; recipients: string[]; bot_token?: string } };
  onSave: (form: { waEnabled: boolean; waRecipients: string; tgEnabled: boolean; tgRecipients: string; tgBotToken: string }) => Promise<void>;
  busy: boolean;
}) {
  const [waEnabled, setWaEnabled] = useState(initial.whatsapp.enabled);
  const [waRecipients, setWaRecipients] = useState((initial.whatsapp.recipients || []).join(", "));
  const [tgEnabled, setTgEnabled] = useState(initial.telegram.enabled);
  const [tgRecipients, setTgRecipients] = useState((initial.telegram.recipients || []).join(", "));
  const [tgBotToken, setTgBotToken] = useState((initial.telegram as any).bot_token || "");

  return (
    <div className="space-y-5">
      {/* WhatsApp (Meta Cloud API) */}
      <div className="rounded-xl border border-phantix-700/40 bg-phantix-950/50 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-200">WhatsApp</p>
            <p className="text-[10px] text-slate-500">Meta Cloud API</p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={waEnabled} onChange={(e) => setWaEnabled(e.target.checked)} className="rounded accent-gold-400" />
            <span className="text-xs text-slate-400">{waEnabled ? "Enabled" : "Disabled"}</span>
          </label>
        </div>
        {waEnabled && (
          <div>
            <label className="label">Recipients (E.164 phone numbers)</label>
            <input className="input text-sm font-mono" value={waRecipients} onChange={(e) => setWaRecipients(e.target.value)} placeholder="+2348012345678, +2348098765432" />
            <p className="text-[10px] text-slate-500 mt-1">International format. Requires a Meta-approved utility template for business-initiated messages.</p>
          </div>
        )}
      </div>

      {/* Telegram Bot API */}
      <div className="rounded-xl border border-phantix-700/40 bg-phantix-950/50 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-200">Telegram</p>
            <p className="text-[10px] text-slate-500">Bot API</p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={tgEnabled} onChange={(e) => setTgEnabled(e.target.checked)} className="rounded accent-gold-400" />
            <span className="text-xs text-slate-400">{tgEnabled ? "Enabled" : "Disabled"}</span>
          </label>
        </div>
        {tgEnabled && (
          <div className="space-y-3">
            <div>
              <label className="label">Bot Token</label>
              <input className="input text-sm font-mono" type="password" value={tgBotToken} onChange={(e) => setTgBotToken(e.target.value)} placeholder="123456:ABC-DEF…" />
              <p className="text-[10px] text-slate-500 mt-1">Leave blank to use platform default. Create with @BotFather.</p>
            </div>
            <div>
              <label className="label">Recipients (chat IDs / group IDs / @usernames)</label>
              <input className="input text-sm font-mono" value={tgRecipients} onChange={(e) => setTgRecipients(e.target.value)} placeholder="-1001234567890, @phantix_security" />
              <p className="text-[10px] text-slate-500 mt-1">Start the bot first. Group IDs start with -100. @usernames must include prefix.</p>
            </div>
          </div>
        )}
      </div>

      <button className="btn-primary w-full" onClick={() => onSave({ waEnabled, waRecipients, tgEnabled, tgRecipients, tgBotToken })} disabled={busy}>
        {busy ? "Saving…" : "Save Channel Settings"}
      </button>
    </div>
  );
}
