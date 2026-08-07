import React, { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Github, Plus, RefreshCw, Lock, Unlock, ExternalLink, Search, X, Loader2, GitBranch, ShieldCheck } from "lucide-react";
import { PageHeader, Card, CardHeader, StatusBadge, Modal, Spinner } from "@/components/ui";
import { api, DEMO_MODE, delay } from "@/lib/api";
import { useStore } from "@/lib/store";
import { cx } from "@/lib/utils";

interface InstallInfo { install_url: string; state: string; configured: boolean; }
interface Installation { connected: boolean; account_login: string; app_id: string; installation_id: string; pat_fallback: boolean; }
interface Repo { id: number; full_name: string; name: string; private: boolean; can_analyze: boolean; requires_premium: boolean; default_branch: string; }

const demoInstall: Installation = { connected: true, account_login: "acme-dev", app_id: "12345", installation_id: "987654", pat_fallback: false };
const demoRepos: Repo[] = [
  { id: 1, full_name: "acme-dev/api-gateway", name: "api-gateway", private: true, can_analyze: true, requires_premium: false, default_branch: "main" },
  { id: 2, full_name: "acme-dev/web-portal", name: "web-portal", private: false, can_analyze: true, requires_premium: false, default_branch: "main" },
  { id: 3, full_name: "acme-dev/internal-tools", name: "internal-tools", private: true, can_analyze: false, requires_premium: true, default_branch: "main" },
];

export default function GithubIntegration() {
  const { toast, requireDualControl } = useStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [connecting, setConnecting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [install, setInstall] = useState<Installation | null>(null);
  const [repos, setRepos] = useState<Repo[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [analyzing, setAnalyzing] = useState<number | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeRepo, setUpgradeRepo] = useState<Repo | null>(null);
  const [query, setQuery] = useState("");

  // OAuth callback: GitHub redirects back with ?installation_id=&setup_action=&state=
  useEffect(() => {
    const installationId = searchParams.get("installation_id");
    const state = searchParams.get("state");
    if (!installationId) return;
    setConnecting(true);
    (async () => {
      try {
        if (DEMO_MODE) { await delay(300); setInstall(demoInstall); }
        else {
          await api.post("/github/callback", { installation_id: Number(installationId), state: state || "" });
        }
        toast("success", "GitHub connected", "Installation recorded. Loading repositories...");
        // Clear the callback query params so a refresh doesn't re-post the callback.
        setSearchParams({}, { replace: true });
        await load();
      } catch (e) {
        toast("error", "Callback failed", e instanceof Error ? e.message : "Could not complete GitHub connection");
      } finally {
        setConnecting(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (DEMO_MODE) { await delay(300); setInstall(demoInstall); setRepos(demoRepos); return; }
      const [inst, reposRes] = await Promise.all([
        api.get<any>("/github/installation").catch(() => ({ connected: false })),
        api.get<any>("/github/repositories").catch(() => ({ items: [] })),
      ]);
      setInstall({ connected: Boolean(inst?.connected), account_login: String(inst?.account_login ?? inst?.login ?? ""), app_id: String(inst?.app_id ?? ""), installation_id: String(inst?.installation_id ?? ""), pat_fallback: Boolean(inst?.pat_fallback) });
      const items = reposRes?.items ?? reposRes ?? [];
      setRepos(items.map((r: any) => ({ id: Number(r.id ?? r.repo_id), full_name: String(r.full_name ?? ""), name: String(r.name ?? ""), private: Boolean(r.private ?? r.is_private), can_analyze: r.can_analyze !== false, requires_premium: Boolean(r.requires_premium), default_branch: String(r.default_branch ?? "main") })));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const connect = async () => {
    setConnecting(true);
    try {
      if (DEMO_MODE) { await delay(400); setInstall(demoInstall); return; }
      const res = await api.get<InstallInfo>("/github/install-url");
      if (!res.configured) { toast("error", "GitHub App not configured", "The GitHub App is not set up on the server yet."); return; }
      window.location.href = res.install_url;
    } catch (e) { toast("error", "Connect failed", e instanceof Error ? e.message : ""); }
    finally { setConnecting(false); }
  };

  const disconnect = async () => {
    if (!(await requireDualControl("Disconnecting the GitHub App requires a dual-control operate session."))) return;
    try {
      if (DEMO_MODE) { await delay(300); } else { await api.delete("/github/installation"); }
      setInstall({ connected: false, account_login: "", app_id: "", installation_id: "", pat_fallback: false });
      setRepos([]);
      toast("success", "Disconnected");
    } catch (e) { toast("error", "Disconnect failed"); }
  };

  const sync = async () => {
    setRefreshing(true);
    try {
      if (DEMO_MODE) { await delay(500); return; }
      await api.post("/github/repositories/sync", {});
      await load();
    } catch (e) { toast("error", "Sync failed"); }
    finally { setRefreshing(false); }
  };

  const analyze = async (repo: Repo) => {
    if (!repo.can_analyze) { setUpgradeRepo(repo); setUpgradeOpen(true); return; }
    setAnalyzing(repo.id);
    try {
      if (DEMO_MODE) { await delay(800); toast("success", "Analysis queued", `${repo.full_name}`); return; }
      await api.post("/github/repositories/analyze", { repo_id: repo.id, full_name: repo.full_name, analysis_profile: "full" });
      toast("success", "Analysis queued", `${repo.full_name}`);
    } catch (e: any) {
      const code = e?.detail?.code ?? e?.detail?.detail?.code;
      if (code === "github_private_requires_premium") { setUpgradeRepo(repo); setUpgradeOpen(true); }
      else toast("error", "Analyze failed", e instanceof Error ? e.message : "");
    }
    finally { setAnalyzing(null); }
  };

  const filtered = repos.filter((r) => r.full_name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="mx-auto max-w-[1000px]">
      <PageHeader
        title="GitHub"
        description="Connect the Phantix GitHub App to inventory and analyze your repositories. Primary integration — PAT is legacy."
        actions={<button onClick={load} className="btn-ghost"><RefreshCw size={15} /></button>}
      />

      {loading ? <div className="flex min-h-[30vh] items-center justify-center"><Spinner className="h-5 w-5" /></div> : !install?.connected ? (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="text-center">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-phantix-800/70 text-gold-400"><Github size={30} /></span>
            <h2 className="mt-5 font-display text-2xl font-bold text-white">Connect your GitHub account</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">
              Install the Phantix App on GitHub to inventory repositories and run security analysis. Private repos are available on the Premium plan.
            </p>
            <button onClick={connect} disabled={connecting} className="btn-primary mt-6"><Github size={16} /> {connecting ? "Redirecting..." : "Connect GitHub"}</button>
            {install?.pat_fallback && <p className="mt-4 text-xs text-slate-500">Using legacy PAT — migrate to the GitHub App for better coverage.</p>}
          </Card>
        </motion.div>
      ) : (
        <div className="space-y-5">
          {/* Connection card */}
          <Card>
            <CardHeader title="Connected account" subtitle="GitHub App installation" action={<StatusBadge status="connected" />} />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-400"><GitBranch size={19} /></span>
                <div>
                  <p className="font-semibold text-slate-100">{install.account_login}</p>
                  <p className="text-xs text-slate-500">{install.app_id ? `App ${install.app_id}` : "GitHub App"} · {install.installation_id ? `install ${install.installation_id}` : ""}</p>
                </div>
              </div>
              <button onClick={disconnect} className="btn-ghost text-xs text-severity-critical">Disconnect</button>
            </div>
            {install.pat_fallback && <p className="mt-3 text-xs text-amber-400">Using legacy PAT fallback — connect the App to enable private-repo analysis.</p>}
          </Card>

          {/* Repo list */}
          <Card>
            <CardHeader
              title="Repositories"
              subtitle={`${repos.length} repos synced`}
              action={<button onClick={sync} disabled={refreshing} className="btn-ghost text-xs"><RefreshCw size={12} className={cx(refreshing && "animate-spin")} /> Sync</button>}
            />
            <div className="mb-3 flex items-center gap-2 rounded-xl border border-phantix-700/50 bg-phantix-950/50 px-3 py-2">
              <Search size={14} className="text-slate-500" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search repositories..." className="flex-1 bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-500" />
            </div>
            <div className="space-y-2">
              {filtered.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">No repositories. Connect a GitHub account to see repos.</p> : filtered.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-phantix-700/40 bg-phantix-950/50 px-4 py-3">
                  <GitBranch size={15} className="shrink-0 text-gold-400" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-200">{r.full_name}</p>
                    <p className="text-[11px] text-slate-500">branch: {r.default_branch}</p>
                  </div>
                  {r.private ? <span className="chip border-amber-400/30 bg-amber-400/10 text-amber-300"><Lock size={10} className="mr-1 inline" /> Private</span> : <span className="chip border-emerald-400/30 bg-emerald-400/10 text-emerald-300"><Unlock size={10} className="mr-1 inline" /> Public</span>}
                  {r.requires_premium && <span className="chip border-gold-400/30 bg-gold-400/10 text-gold-300"><ShieldCheck size={10} className="mr-1 inline" /> Premium</span>}
                  <button onClick={() => analyze(r)} disabled={analyzing === r.id} className={cx("btn-primary !px-3 !py-1.5 !text-xs", !r.can_analyze && "opacity-60")}>
                    {analyzing === r.id ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Analyze
                  </button>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Upgrade modal */}
      <Modal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} title="Private repo requires Premium">
        <div className="space-y-3">
          <div className="flex items-center gap-2 p-3 rounded-xl bg-gold-400/10 border border-gold-400/25">
            <Lock size={16} className="text-gold-400" />
            <p className="text-sm text-slate-300"><strong className="text-gold-300">{upgradeRepo?.full_name}</strong> is a private repository. Analyzing private repos requires the Premium plan.</p>
          </div>
          <p className="text-xs leading-5 text-slate-400">Free plan includes public repository analysis only. Upgrade to Premium for private repo security scanning and continuous assurance.</p>
          <button className="btn-primary w-full" onClick={() => { setUpgradeOpen(false); window.location.href = "/billing"; }}>Upgrade to Premium</button>
        </div>
      </Modal>
    </div>
  );
}
