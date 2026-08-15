import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Github, Plus, RefreshCw, Lock, Unlock, ExternalLink, Search, Loader2, GitBranch, ShieldCheck, Clock, CheckCircle2 } from "lucide-react";
import { PageHeader, Card, CardHeader, StatusBadge, Modal, Spinner } from "@/components/ui";
import { api, DEMO_MODE, delay } from "@/lib/api";
import { useStore } from "@/lib/store";
import { cx } from "@/lib/utils";

interface InstallInfo { install_url: string; state: string; configured: boolean; }
interface Installation {
  connected: boolean;
  status: string;
  approval_status: string | null;
  installation_status: string | null;
  account_login: string;
  account_type: string;
  installation_id: string;
  pat_fallback: boolean;
  can_list_repos: boolean;
  can_analyze: boolean;
  setup_action: string | null;
  message: string;
}
interface Repo { id: number; full_name: string; name: string; private: boolean; can_analyze: boolean; requires_premium: boolean; default_branch: string; }

const demoInstall: Installation = { connected: true, status: "connected", approval_status: "approved", installation_status: "active", account_login: "acme-dev", account_type: "User", installation_id: "987654", pat_fallback: false, can_list_repos: true, can_analyze: true, setup_action: "install", message: "GitHub App connected" };
const demoRepos: Repo[] = [
  { id: 1, full_name: "acme-dev/api-gateway", name: "api-gateway", private: true, can_analyze: true, requires_premium: false, default_branch: "main" },
  { id: 2, full_name: "acme-dev/web-portal", name: "web-portal", private: false, can_analyze: true, requires_premium: false, default_branch: "main" },
  { id: 3, full_name: "acme-dev/internal-tools", name: "internal-tools", private: true, can_analyze: false, requires_premium: true, default_branch: "main" },
];

const POLL_MS = 20000;

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
  const [loadError, setLoadError] = useState("");
  const [justConnected, setJustConnected] = useState(false);
  const installRef = useRef<Installation | null>(null);
  installRef.current = install;

  const mapInstall = (inst: any): Installation => ({
    connected: Boolean(inst?.connected),
    status: String(inst?.status ?? "not_connected"),
    approval_status: inst?.approval_status ?? null,
    installation_status: inst?.installation_status ?? null,
    account_login: String(inst?.account_login ?? ""),
    account_type: String(inst?.account_type ?? ""),
    installation_id: String(inst?.installation_id ?? ""),
    pat_fallback: Boolean(inst?.pat_fallback),
    can_list_repos: inst?.can_list_repos !== false,
    can_analyze: inst?.can_analyze !== false,
    setup_action: inst?.setup_action ?? null,
    message: String(inst?.message ?? ""),
  });

  // OAuth callback: GitHub redirects back with installation_id/setup_action/state (+ org hints)
  useEffect(() => {
    const installationId = searchParams.get("installation_id");
    const state = searchParams.get("state");
    const setupAction = searchParams.get("setup_action");
    const accountLogin = searchParams.get("account_login");
    const accountType = searchParams.get("account_type");
    const requestId = searchParams.get("request_id");
    const requestedByLogin = searchParams.get("requested_by_login");
    if (!installationId && !setupAction) return;
    setConnecting(true);
    (async () => {
      try {
        if (DEMO_MODE) { await delay(300); setInstall(demoInstall); }
        else {
          await api.post("/github/callback", {
            installation_id: installationId ? Number(installationId) : undefined,
            state: state || "",
            setup_action: setupAction || "",
            account_login: accountLogin || "",
            account_type: accountType || "",
            request_id: requestId ? Number(requestId) : undefined,
            requested_by_login: requestedByLogin || "",
          });
        }
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
    setLoadError("");
    try {
      if (DEMO_MODE) { await delay(300); setInstall(demoInstall); setRepos(demoRepos); return; }
      const inst = await api.get<any>("/github/installation?refresh=true");
      setInstall(mapInstall(inst));
      const status = String(inst?.status ?? "not_connected");
      if (status === "connected" || status === "suspended") {
        try {
          const reposRes = await api.get<any>("/github/repositories?refresh=false");
          const items = reposRes?.items ?? reposRes ?? [];
          setRepos(items.map((r: any) => ({ id: Number(r.id ?? r.repo_id), full_name: String(r.full_name ?? ""), name: String(r.name ?? ""), private: Boolean(r.private ?? r.is_private), can_analyze: r.can_analyze !== false, requires_premium: Boolean(r.requires_premium), default_branch: String(r.default_branch ?? "main") })));
        } catch (e: any) {
          const code = e?.detail?.code ?? e?.detail?.detail?.code;
          if (code !== "github_awaiting_approval") setRepos([]);
          else setRepos([]);
        }
      } else {
        setRepos([]);
      }
    } catch (e) {
      setInstall(null);
      setRepos([]);
      setLoadError(e instanceof Error ? e.message : "Could not load GitHub integration");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // When the user returns to this tab after installing the app in the new tab,
  // refresh the connection immediately.
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === "visible") void load(); };
    const onFocus = () => {
      const cur = installRef.current;
      if (!cur?.connected || cur.status === "awaiting_approval" || cur.status === "suspended") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  // While the user is finishing the install in the new tab, poll so the
  // connection is picked up automatically the moment GitHub records it.
  useEffect(() => {
    if (!justConnected) return;
    const t = window.setInterval(() => { void load(); }, 6000);
    const stop = window.setTimeout(() => setJustConnected(false), 90_000);
    return () => { window.clearInterval(t); window.clearTimeout(stop); };
  }, [justConnected, load]);

  // Poll every 20s while awaiting org approval
  const awaiting = install?.status === "awaiting_approval";
  useEffect(() => {
    if (!awaiting) return;
    const t = window.setInterval(() => { load(); }, POLL_MS);
    return () => window.clearInterval(t);
  }, [awaiting, load]);

  const connect = async () => {
    setConnecting(true);
    try {
      if (DEMO_MODE) { await delay(400); setInstall(demoInstall); return; }
      const res = await api.get<InstallInfo>("/github/install-url");
      if (!res.configured) { toast("error", "GitHub App not configured", "The GitHub App is not set up on the server yet."); return; }
      // Open in a new tab so the user stays in the app; we poll + refresh on return.
      window.open(res.install_url, "_blank", "noopener,noreferrer");
      setJustConnected(true);
    } catch (e) { toast("error", "Connect failed", e instanceof Error ? e.message : ""); }
    finally { setConnecting(false); }
  };

  const disconnect = async () => {
    if (!(await requireDualControl("Disconnecting the GitHub App requires a dual-control operate session."))) return;
    try {
      if (DEMO_MODE) { await delay(300); } else { await api.delete("/github/installation", { dualControl: true }); }
      setInstall({ connected: false, status: "not_connected", approval_status: null, installation_status: null, account_login: "", account_type: "", installation_id: "", pat_fallback: false, can_list_repos: false, can_analyze: false, setup_action: null, message: "" });
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

      {loadError && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-severity-critical/30 bg-severity-critical/10 px-4 py-3">
          <p className="text-sm text-red-300">Could not load GitHub integration: {loadError}</p>
          <button onClick={load} className="btn-ghost text-xs">Retry</button>
        </div>
      )}

      {loading ? <div className="flex min-h-[30vh] items-center justify-center"><Spinner className="h-5 w-5" /></div> : !install?.connected ? (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="text-center">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-phantix-800/70 text-gold-400"><Github size={30} /></span>
            <h2 className="mt-5 font-display text-2xl font-bold text-white">Connect your GitHub account</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">
              Install the Phantix App on GitHub to inventory repositories and run security analysis. Private repos are available on the Premium plan.
            </p>
            <button onClick={connect} disabled={connecting} className="btn-primary mt-6"><Github size={16} /> {connecting ? "Opening GitHub..." : "Connect GitHub"}</button>

            {justConnected && (
              <div className="mx-auto mt-5 max-w-md rounded-xl border border-phantix-600/40 bg-phantix-800/40 px-4 py-3 text-left">
                <div className="flex items-start gap-2">
                  <Loader2 size={16} className="mt-0.5 shrink-0 animate-spin text-gold-400" />
                  <div>
                    <p className="text-sm font-medium text-slate-200">GitHub opened in a new tab</p>
                    <p className="mt-1 text-xs leading-5 text-slate-400">
                      Complete the install there, then come back — we refresh automatically. Installed already?
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                      <button onClick={() => void load()} disabled={loading} className="btn-secondary !py-1.5 !text-xs">
                        <RefreshCw size={12} className={cx(loading && "animate-spin")} /> Check connection now
                      </button>
                      <a href="https://github.com/settings/installations" target="_blank" rel="noreferrer" className="btn-ghost !text-xs"><ExternalLink size={12} /> Open GitHub</a>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!justConnected && !awaiting && (
              <div className="mx-auto mt-5 flex max-w-md items-center justify-center gap-2 text-xs text-slate-500">
                <CheckCircle2 size={13} className="text-gold-400" />
                Installed the app already?
                <button onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-1 font-semibold text-gold-400 hover:text-gold-300">
                  <RefreshCw size={12} className={cx(loading && "animate-spin")} /> Refresh status
                </button>
              </div>
            )}

            {/* Awaiting org approval */}
            {awaiting && (
              <div className="mx-auto mt-5 max-w-md rounded-xl border border-amber-400/25 bg-amber-400/5 px-4 py-3 text-left">
                <div className="flex items-start gap-2">
                  <Clock size={16} className="mt-0.5 shrink-0 text-amber-400" />
                  <div>
                    <p className="text-sm font-medium text-amber-300">Awaiting GitHub org approval</p>
                    <p className="mt-1 text-xs leading-5 text-slate-400">
                      Waiting for a GitHub organization owner to approve the Phantix app. This page refreshes automatically.
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                      <a href="https://github.com/settings/installations" target="_blank" rel="noreferrer" className="btn-ghost !text-xs"><ExternalLink size={12} /> Open GitHub</a>
                      <button onClick={load} className="btn-ghost !text-xs"><RefreshCw size={12} /> Check now</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Rejected / suspended */}
            {install?.status === "rejected" && (
              <div className="mx-auto mt-5 max-w-md rounded-xl border border-severity-critical/30 bg-severity-critical/10 px-4 py-3 text-left">
                <p className="text-sm font-medium text-red-300">GitHub install request denied or cancelled</p>
                <p className="mt-1 text-xs leading-5 text-slate-400">Ask an organization owner to install the app, then connect again.</p>
                <button onClick={connect} disabled={connecting} className="btn-primary mt-3 !text-xs">{connecting ? "Redirecting..." : "Connect again"}</button>
              </div>
            )}
            {install?.status === "suspended" && (
              <div className="mx-auto mt-5 max-w-md rounded-xl border border-amber-400/25 bg-amber-400/5 px-4 py-3 text-left">
                <p className="text-sm font-medium text-amber-300">Installation suspended on GitHub</p>
                <p className="mt-1 text-xs leading-5 text-slate-400">The GitHub App installation was suspended. Resume it in GitHub App settings to continue.</p>
                <a href="https://github.com/settings/installations" target="_blank" rel="noreferrer" className="btn-ghost mt-3 !text-xs"><ExternalLink size={12} /> Open GitHub App settings</a>
              </div>
            )}

            {/* PAT fallback */}
            {install?.pat_fallback && (
              <div className="mx-auto mt-5 max-w-md rounded-xl border border-amber-400/25 bg-amber-400/5 px-4 py-3 text-left">
                <p className="text-xs text-amber-300">Legacy PAT is connected. Migrate to the GitHub App for private-repo analysis and better coverage.</p>
                <button onClick={connect} disabled={connecting} className="btn-primary mt-2 !text-xs">{connecting ? "Redirecting..." : "Migrate to GitHub App"}</button>
              </div>
            )}
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
                  <p className="text-xs text-slate-500">{install.account_type || "GitHub App"} · {install.installation_id ? `install ${install.installation_id}` : ""}</p>
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
