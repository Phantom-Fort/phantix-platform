import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, CheckCircle2, Loader2, Bot, ToggleLeft, ToggleRight } from "lucide-react";
import { PageHeader, Card, CardHeader } from "@/components/ui";
import { api, DEMO_MODE, delay } from "@/lib/api";
import { useStore } from "@/lib/store";
import { cx } from "@/lib/utils";

type AiStatus = {
  enabled: boolean;
  agent_enabled: boolean;
  default_provider: string;
  ai_pentest_ready: boolean;
  mode: string;
  providers: { id: string; configured: boolean }[];
  monthly_tokens: number;
  monthly_cost_usd: number;
};

const demoAi: AiStatus = {
  enabled: true,
  agent_enabled: true,
  default_provider: "deepseek",
  ai_pentest_ready: true,
  mode: "balanced",
  providers: [
    { id: "deepseek", configured: true },
    { id: "openai", configured: false },
    { id: "anthropic", configured: false },
  ],
  monthly_tokens: 128_400,
  monthly_cost_usd: 6.42,
};

export default function AiSettings() {
  const { toast, requireDualControl } = useStore();
  const [ai, setAi] = useState<AiStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [agentSaving, setAgentSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        if (DEMO_MODE) {
          await delay(300);
          if (!cancelled) setAi(demoAi);
          return;
        }
        const [settings, usage] = await Promise.all([
          api.get<Record<string, unknown>>("/ai/settings").catch(() => null),
          api.get<Record<string, unknown>>("/ai/usage").catch(() => null),
        ]);
        if (cancelled) return;
        const providersRaw = (settings?.providers as { id?: string; name?: string; configured?: boolean }[]) ?? [];
        setAi({
          enabled: Boolean(settings?.ai_enabled ?? settings?.enabled ?? false),
          agent_enabled: Boolean(settings?.agent_enabled ?? false),
          default_provider: String(settings?.default_provider ?? settings?.mode ?? ""),
          ai_pentest_ready: Boolean(settings?.ai_pentest_ready ?? false),
          mode: String(settings?.mode ?? "balanced"),
          providers: providersRaw.map((p) => ({
            id: String(p.id ?? p.name ?? "provider"),
            configured: Boolean(p.configured),
          })),
          monthly_tokens: Number(usage?.monthly_tokens ?? settings?.monthly_tokens ?? 0),
          monthly_cost_usd: Number(usage?.monthly_cost_usd ?? settings?.monthly_cost_usd ?? 0),
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleAgent = async () => {
    if (!(await requireDualControl("Turning the Phantix Agent on/off requires a dual-control operate session."))) return;
    setAgentSaving(true);
    const next = !ai!.agent_enabled;
    try {
      if (DEMO_MODE) { await delay(300); }
      else { await api.put("/ai/settings", { agent_enabled: next }); }
      setAi((a) => a ? { ...a, agent_enabled: next } : a);
      toast("success", next ? "Phantix Agent enabled" : "Phantix Agent disabled", next ? "Operators can use the agent in the Command Centre." : "The agent is hidden from the Command Centre.");
    } catch (e) {
      toast("error", "Update failed", e instanceof Error ? e.message : "");
    } finally {
      setAgentSaving(false);
    }
  };

  const [modeSaving, setModeSaving] = useState(false);
  const saveMode = async () => {
    if (!(await requireDualControl("Changing AI mode requires a dual-control operate session."))) return;
    setModeSaving(true);
    try {
      if (!DEMO_MODE) await api.put("/ai/settings", { mode: ai!.mode });
      toast("success", "AI mode updated", ai!.mode);
    } catch (e) {
      toast("error", "Update failed", e instanceof Error ? e.message : "");
    } finally {
      setModeSaving(false);
    }
  };

  if (loading || !ai) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading AI settings...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1200px]">
      <PageHeader
        title="AI governance"
        description="Org AI settings and usage. Narratives only --- AI never determines security facts or scores. GET /ai/settings · GET /ai/usage"
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardHeader title="AI engine" subtitle="Provider and mode for this tenant" action={<Sparkles size={16} className="text-gold-400" />} />
            <div className="grid grid-cols-2 gap-3">
              {[
                ["Status", ai.enabled ? "Enabled" : "Disabled"],
                ["Default provider", ai.default_provider || "---"],
                ["Mode", ai.mode || "---"],
                ["Pentest AI", ai.ai_pentest_ready ? "Ready" : "Gated"],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl border border-phantix-700/40 bg-phantix-950/50 p-3.5">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">{k}</p>
                  <p className="mt-1 font-medium capitalize text-slate-200">{v}</p>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <p className="label">Providers</p>
              <div className="flex flex-wrap gap-2">
                {ai.providers.length === 0 ? (
                  <span className="text-xs text-slate-500">No providers reported</span>
                ) : (
                  ai.providers.map((p) => (
                    <span
                      key={p.id}
                      className={cx(
                        "chip",
                        p.configured
                          ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                          : "border-phantix-700/50 bg-phantix-900/50 text-slate-500",
                      )}
                    >
                      {p.configured && <CheckCircle2 size={11} />} {p.id}
                    </span>
                  ))
                )}
              </div>
            </div>
            <div className="mt-4">
              <label className="label">AI mode</label>
              <select
                className="input"
                value={ai.mode}
                onChange={(e) => setAi((a) => (a ? { ...a, mode: e.target.value } : a))}
              >
                <option value="economy">Economy</option>
                <option value="balanced">Balanced</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
            <button
              className="btn-secondary mt-5 w-full"
              onClick={() => void saveMode()}
              disabled={modeSaving}
            >
              {modeSaving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Save AI mode
            </button>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }} className="space-y-5">
          <Card>
            <CardHeader title="Usage this month" subtitle="Cost visibility --- every call audited with prompt version + model" />
            <div className="flex items-end gap-8">
              <div>
                <p className="font-display text-3xl font-bold text-white">{ai.monthly_tokens.toLocaleString()}</p>
                <p className="text-xs text-slate-500">tokens</p>
              </div>
              <div>
                <p className="font-display text-3xl font-bold text-gold-300">${ai.monthly_cost_usd.toFixed(2)}</p>
                <p className="text-xs text-slate-500">estimated cost</p>
              </div>
            </div>
            <div className="mt-5 space-y-2 text-xs leading-5 text-slate-400">
              <p>· PII is redacted before any provider call</p>
              <p>· Hallucination heuristics + cost/budget gates on every request</p>
              <p>· AI pentesting activates only when a DeepSeek key is configured</p>
              <p>· Finding explanations and executive summaries land in reports via the bus</p>
            </div>
          </Card>

          {/* Phantix Agent toggle */}
          <Card className="border-gold-400/25">
            <CardHeader title="Phantix Agent" subtitle="Conversational security assistant for the Command Centre" action={<Bot size={16} className="text-gold-400" />} />
            <div className="flex items-center justify-between gap-4 rounded-xl border border-phantix-700/40 bg-phantix-950/50 p-4">
              <div>
                <p className="text-sm font-semibold text-slate-200">{ai.agent_enabled ? "Enabled" : "Disabled"}</p>
                <p className="mt-0.5 text-xs leading-5 text-slate-500">
                  {ai.agent_enabled
                    ? "Operators can chat with Phantix Agent from the Command Centre sidebar."
                    : "The agent is hidden from the Command Centre. Toggle on to let operators use it."}
                </p>
              </div>
              <button onClick={toggleAgent} disabled={agentSaving} className="shrink-0" aria-label="Toggle Phantix Agent">
                {agentSaving ? <Loader2 size={22} className="animate-spin text-gold-400" /> : ai.agent_enabled ? <ToggleRight size={26} className="text-emerald-400" /> : <ToggleLeft size={26} className="text-slate-500" />}
              </button>
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
