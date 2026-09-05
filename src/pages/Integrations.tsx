import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Cable, Plug, PlugZap, KeyRound, ShieldCheck, Trash2, RefreshCw,
  ExternalLink, TestTube, RotateCcw, Loader2, Copy, ChevronRight, Info,
  MessageSquare, Send, Webhook, Lock, Unlock,
} from "lucide-react";
import { PageHeader, Card, CardHeader, StatusBadge, Tabs, Spinner, EmptyState, Modal, CopyChip } from "@/components/ui";
import { useStore } from "@/lib/store";
import { useResource } from "@/lib/useResource";
import { timeAgo, cx } from "@/lib/utils";
import {
  HubConnector, HubInstallation, loadHubCatalog, loadHubInstallations,
  installHubIntegration, uninstallHubIntegration, testHubInstallation,
  rotateHubSecret, mintHubScimToken, startHubOAuth, updateHubInstallation,
  splitConfigAndSecrets, hubConnectorMeta, AuthMode,
} from "@/lib/integrations";

const catIcons: Record<string, React.ReactNode> = {
  channel: <MessageSquare size={16} />,
  sso: <ShieldCheck size={16} />,
  automation: <Webhook size={16} />,
};

function connectorGlyph(id: string): React.ReactNode {
  const m = hubConnectorMeta[id];
  return m ? <span className="text-[15px] leading-none">{m.icon}</span> : <Cable size={16} />;
}

export default function Integrations() {
  const { state, toast, requireDualControl } = useStore();
  const [tab, setTab] = useState("catalog");
  const [installOpen, setInstallOpen] = useState<string | null>(null);

  const catalog = useResource<HubConnector[]>(
    () => loadHubCatalog(),
    [],
  );
  const installations = useResource<HubInstallation[]>(
    () => loadHubInstallations(),
    [],
  );

  const installedMap = useMemo(
    () => new Map(installations.data.map((i) => [i.connector_id, i])),
    [installations.data],
  );
  const active = installations.data.filter((i) => i.status === "active");
  const pendingAuth = installations.data.filter((i) => i.status === "pending_auth");
  const ssoConnectors = catalog.data.filter((c) => c.category === "sso");
  const ssoInstallations = installations.data.filter((c) => c.connector_id.includes("oidc") || c.capabilities?.includes("scim") || ssoConnectors.some((s) => s.connector_id === c.connector_id));

  const refreshAll = () => { catalog.refresh(); installations.refresh(); };

  const onInstalled = async (connectorId: string, authMode: AuthMode, res: { id: number; status: string }) => {
    setInstallOpen(null);
    installations.refresh();
    if (authMode === "oauth2" || res.status === "pending_auth") {
      toast("info", "Install pending", "Completing OAuth in a popup…");
      try {
        const oauth = await startHubOAuth(res.id);
        const w = window.open(oauth.authorize_url, "_blank", "popup,width=560,height=720");
        if (!w) window.location.href = oauth.authorize_url;
      } catch (e) {
        toast("error", "OAuth start failed", e instanceof Error ? e.message : "");
      }
    } else {
      toast("success", "Installed", "Integration configured.");
    }
  };

  const confirmUninstall = async (inst: HubInstallation) => {
    if (!(await requireDualControl("Disconnecting an integration requires a dual-control operate session."))) return;
    try {
      await uninstallHubIntegration(inst.id, true);
      toast("success", "Disconnected", `${inst.label} removed.`);
      installations.refresh();
    } catch (e) {
      toast("error", "Disconnect failed", e instanceof Error ? e.message : "");
    }
  };

  const runTest = async (inst: HubInstallation) => {
    try {
      const res = await testHubInstallation(inst.id);
      const ok = res?.ok ?? res?.healthy ?? res?.status === "ok";
      toast(ok ? "success" : "error", ok ? "Health OK" : "Health check failed", String(res?.message ?? res?.detail ?? ""));
    } catch (e) {
      toast("error", "Test failed", e instanceof Error ? e.message : "");
    }
  };

  const [showSecret, setShowSecret] = useState<{ title: string; value: string } | null>(null);
  const revealSecret = (title: string, value: string) => setShowSecret({ title, value });

  return (
    <div className="mx-auto max-w-[1200px]">
      <PageHeader
        title="Integrations Hub"
        description="Connect alert channels, SSO providers and automation webhooks. Secrets are never stored in plain text and rotate without disruption."
        actions={
          <button onClick={refreshAll} className="btn-ghost">
            <RefreshCw size={15} />
          </button>
        }
      />

      <Tabs
        tabs={[
          { id: "catalog", label: "Connectors", count: catalog.data.length },
          { id: "installed", label: "Installed", count: active.length },
          { id: "sso", label: "SSO & SCIM", count: ssoInstallations.filter((i) => i.status === "active").length },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "catalog" && (
        <motion.div key="cat" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-4">
          {catalog.loading && !catalog.data.length ? (
            <div className="py-10 flex justify-center"><Spinner /></div>
          ) : catalog.data.length === 0 ? (
            <EmptyState icon={<Cable size={32} />} title="No connectors" body="The integrations catalog is empty or the Hub is not enabled on this environment." />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {catalog.data.map((conn, i) => {
                const existing = installedMap.get(conn.connector_id);
                return (
                  <motion.div key={conn.connector_id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                    <Card className="flex h-full flex-col !p-4">
                      <div className="flex items-start gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-gold-400/30 bg-gold-400/10 text-gold-300">
                          {connectorGlyph(conn.connector_id)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-slate-100">{conn.display_name}</p>
                            <StatusBadge status={existing ? existing.status : conn.status} />
                          </div>
                          <p className="mt-0.5 text-[11px] text-slate-400">
                            {catIcons[conn.category]} {conn.category}
                            {conn.wave ? ` · wave ${conn.wave}` : ""}
                          </p>
                        </div>
                      </div>
                      <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-400">{conn.description}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        {conn.auth_modes.map((m) => (
                          <span key={m} className="rounded bg-phantix-800/80 px-1.5 py-0.5 font-mono text-[9px] text-slate-400">{m}</span>
                        ))}
                        <span className="ml-auto">
                          {existing ? (
                            <span className="text-[11px] text-emerald-400">{existing.status === "active" ? "Connected" : existing.status}</span>
                          ) : (
                            <button onClick={() => setInstallOpen(conn.connector_id)} className="btn-primary !px-3 !py-1 !text-[11px]">
                              <Plug size={12} /> Install
                            </button>
                          )}
                        </span>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      )}

      {tab === "installed" && (
        <motion.div key="inst" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-4 space-y-3">
          {installations.loading && !installations.data.length ? (
            <div className="py-10 flex justify-center"><Spinner /></div>
          ) : installations.data.length === 0 ? (
            <EmptyState icon={<PlugZap size={32} />} title="Nothing installed yet" body="Browse the Connectors tab and install your first integration." />
          ) : installations.data.map((inst, i) => (
            <motion.div key={inst.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <Card className="!p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className={cx("flex h-9 w-9 shrink-0 items-center justify-center rounded-md border", inst.status === "active" ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-400" : "border-gold-400/30 bg-gold-400/10 text-gold-300")}>
                    {connectorGlyph(inst.connector_id)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-slate-100">{inst.label || hubConnectorMeta[inst.connector_id]?.short || inst.connector_id}</p>
                      {inst.has_secrets && (
                        <span className="inline-flex items-center gap-1 rounded bg-phantix-800/80 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-slate-400"><Lock size={9} /> secrets</span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500">
                      {inst.connector_id} · {inst.auth_mode}
                      {inst.created_at ? ` · added ${timeAgo(inst.created_at)}` : ""}
                      {inst.health?.last_test_at ? ` · last test ${timeAgo(String(inst.health.last_test_at))}` : ""}
                    </p>
                  </div>
                  <StatusBadge status={inst.status} />
                  <div className="flex flex-wrap items-center gap-1.5">
                    {inst.status === "pending_auth" && (
                      <button className="btn-secondary !px-2.5 !py-1 !text-[11px]" onClick={async () => {
                        try {
                          const oauth = await startHubOAuth(inst.id);
                          const w = window.open(oauth.authorize_url, "_blank", "popup,width=560,height=720");
                          if (!w) window.location.href = oauth.authorize_url;
                        } catch (e) { toast("error", "OAuth start failed", e instanceof Error ? e.message : ""); }
                      }}>
                        <ExternalLink size={11} /> Resume OAuth
                      </button>
                    )}
                    <button className="btn-ghost !px-2.5 !py-1 !text-[11px]" onClick={() => void runTest(inst)}>
                      <TestTube size={11} /> Test
                    </button>
                    {inst.has_secrets && inst.connector_id !== "slack" && inst.connector_id !== "teams" && (
                      <button className="btn-ghost !px-2.5 !py-1 !text-[11px]" onClick={async () => {
                        if (!(await requireDualControl("Rotating a secret requires a dual-control operate session."))) return;
                        try {
                          const res = await rotateHubSecret(inst.id, true);
                          const value = String(res?.secret ?? res?.webhook_secret ?? res?.webhook_url ?? "");
                          if (value) revealSecret(`New secret · ${inst.label}`, value);
                          else toast("success", "Secret rotated");
                          installations.refresh();
                        } catch (e) { toast("error", "Rotate failed", e instanceof Error ? e.message : ""); }
                      }}>
                        <RotateCcw size={11} /> Rotate
                      </button>
                    )}
                    <button className="btn-ghost !px-2.5 !py-1 !text-[11px] text-severity-critical" onClick={() => void confirmUninstall(inst)}>
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      {tab === "sso" && (
        <SsoScimTab
          connectors={ssoConnectors}
          installations={ssoInstallations.length ? ssoInstallations : installations.data}
          orgSlug={state.org.slug}
          onInstall={() => {
            setTab("catalog");
            setInstallOpen("entra_oidc");
          }}
          revealSecret={revealSecret}
          onChanged={refreshAll}
        />
      )}

      {installOpen && (
        <InstallModal
          connectorId={installOpen}
          connector={catalog.data.find((c) => c.connector_id === installOpen)}
          onClose={() => setInstallOpen(null)}
          onDone={(res) => void onInstalled(installOpen, res.authMode, res)}
        />
      )}

      {showSecret && (
        <Modal open={true} onClose={() => setShowSecret(null)} title={showSecret.title} wide>
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-md border border-gold-400/30 bg-gold-400/10 p-3">
              <Info size={16} className="mt-0.5 shrink-0 text-gold-300" />
              <p className="text-xs leading-5 text-slate-300">
                This value is shown <strong className="text-gold-300">once</strong>. Copy it now — the backend will not return it again.
              </p>
            </div>
            <CopyChip value={showSecret.value} label="Secret" />
            <button className="btn-secondary w-full" onClick={() => setShowSecret(null)}>Done</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function SsoScimTab({
  connectors, installations, orgSlug, onInstall, revealSecret, onChanged,
}: {
  connectors: HubConnector[];
  installations: HubInstallation[];
  orgSlug: string;
  onInstall: () => void;
  revealSecret: (title: string, value: string) => void;
  onChanged: () => void;
}) {
  const { toast, requireDualControl } = useStore();
  const activeSso = installations.filter((i) => i.connector_id.includes("oidc") && i.status === "active");
  const otherSso = installations.filter((i) => !i.connector_id.includes("oidc"));
  const base = orgSlug ? `/api/v1/integrations/sso/${orgSlug}/start` : "/api/v1/integrations/sso/{org_slug}/start";
  const scimBase = "/api/v1/scim/v2";

  return (
    <motion.div key="sso" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-2">
      <div className="space-y-4">
        <Card className="!p-4">
          <CardHeader title="Single sign-on (OIDC)" subtitle="One active identity provider per organization" action={<StatusBadge status={activeSso.length ? "active" : "draft"} />} />
          {activeSso.length === 0 ? (
            <EmptyState
              icon={<KeyRound size={28} />}
              title="No SSO provider configured"
              body="Enable Microsoft Entra, Okta, or Google Workspace SSO so your team signs in with their IdP."
              action={<button onClick={onInstall} className="btn-primary"><Plug size={14} /> Add provider</button>}
            />
          ) : (
            <div className="space-y-2">
              {activeSso.map((inst) => (
                <div key={inst.id} className="flex flex-wrap items-center gap-3 rounded-md border border-phantix-700/50 bg-phantix-950/50 px-3 py-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-md border border-emerald-400/30 bg-emerald-400/10 text-emerald-400">
                    {connectorGlyph(inst.connector_id)}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-100">{inst.label || hubConnectorMeta[inst.connector_id]?.short || inst.connector_id}</p>
                    <p className="text-[11px] text-slate-500">issuer: {String(inst.config?.issuer ?? "—")}</p>
                  </div>
                  <div className="flex gap-1.5">
                    <button className="btn-ghost !px-2.5 !py-1 !text-[11px]" onClick={async () => {
                      if (!(await requireDualControl("Minting a SCIM token requires a dual-control operate session."))) return;
                      try {
                        const res = await mintHubScimToken(inst.id, true);
                        const token = String(res?.token ?? res?.scim_bearer ?? res?.scim_token ?? "");
                        if (token) revealSecret(`SCIM token · ${inst.label}`, token);
                        else toast("success", "SCIM token minted");
                      } catch (e) { toast("error", "Mint failed", e instanceof Error ? e.message : ""); }
                    }}>
                      <KeyRound size={11} /> Mint SCIM token
                    </button>
                    <button className="btn-ghost !px-2.5 !py-1 !text-[11px] text-severity-critical" onClick={async () => {
                      if (!(await requireDualControl("Disconnecting SSO requires a dual-control operate session."))) return;
                      try {
                        await uninstallHubIntegration(inst.id, true);
                        toast("success", "SSO disabled");
                        onChanged();
                      } catch (e) { toast("error", "Failed", e instanceof Error ? e.message : ""); }
                    }}>
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 rounded-md border border-phantix-700/40 bg-phantix-950/50 px-3 py-2.5">
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Start URL (send your team here)</p>
            <p className="mt-1 break-all font-mono text-[11px] text-gold-300">{base}</p>
          </div>
        </Card>
      </div>

      <div className="space-y-4">
        <Card className="!p-4">
          <CardHeader title="SCIM 2.0 provisioning" subtitle="Directory sync endpoints consumed by your identity provider" />
          <div className="space-y-2 text-xs">
            <p className="text-slate-400">Endpoints your IdP connects to with the minted SCIM bearer token:</p>
            {[
              `${scimBase}/ServiceProviderConfig`,
              `${scimBase}/Users`,
              `${scimBase}/Users/{id}`,
            ].map((u) => (
              <div key={u} className="rounded-md bg-phantix-950/50 border border-phantix-700/40 px-3 py-2 font-mono text-[11px] text-slate-300">{u}</div>
            ))}
          </div>
          <div className="mt-3 flex items-start gap-2 rounded-md border border-gold-400/25 bg-gold-400/5 p-3">
            <Info size={14} className="mt-0.5 shrink-0 text-gold-400" />
            <p className="text-[11px] leading-5 text-slate-400">Enable automatic user provisioning in your IdP using the SCIM base URL and the bearer token you mint here. One active IdP per org.</p>
          </div>
        </Card>

        {otherSso.length > 0 && (
          <Card className="!p-4">
            <CardHeader title="SSO-related connections" />
            {otherSso.map((inst) => (
              <div key={inst.id} className="flex items-center gap-3 rounded-md border border-phantix-700/40 bg-phantix-950/50 px-3 py-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-md border border-phantix-600/50 bg-phantix-800/70 text-slate-300">{connectorGlyph(inst.connector_id)}</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-100">{inst.label}</p>
                  <p className="text-[11px] text-slate-500">{inst.connector_id} · {inst.auth_mode}</p>
                </div>
                <StatusBadge status={inst.status} />
              </div>
            ))}
          </Card>
        )}
      </div>
    </motion.div>
  );
}

function InstallModal({ connectorId, connector, onClose, onDone }: {
  connectorId: string;
  connector?: HubConnector;
  onClose: () => void;
  onDone: (res: { authMode: AuthMode; id: number; status: string }) => void;
}) {
  const { toast, requireDualControl } = useStore();
  const [label, setLabel] = useState("");
  const [authMode, setAuthMode] = useState<AuthMode>(connector?.auth_modes?.[0] ?? "oauth2");
  const [config, setConfig] = useState<Record<string, string>>({});
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);

  if (!connector) return null;

  const setCfg = (k: string, v: string) => setConfig((p) => ({ ...p, [k]: v }));

  // Map a connector auth mode to the secret config key it expects.
  const secretKeyFor = (mode: AuthMode): string | null => {
    if (mode === "copy_webhook") return "webhook_url";
    if (mode === "webhook_secret") return "webhook_secret";
    if (mode === "oidc") return "client_secret";
    if (mode === "bot_token") return "bot_token";
    if (mode === "meta_cloud") return "api_key";
    return null;
  };

  const handleInstall = async () => {
    if (!(await requireDualControl("Installing an integration requires a dual-control operate session."))) return;
    if (!label.trim()) { toast("error", "Label required", "Give this installation a name."); return; }
    if (secretKeyFor(authMode) && !secret.trim() && authMode !== "oauth2") {
      toast("error", "Secret required", "This auth mode needs a secret or webhook URL.");
      return;
    }
    setBusy(true);
    try {
      const { config: cleanConfig, secrets } = splitConfigAndSecrets(config);
      const body: Record<string, unknown> = {
        connector_id: connectorId,
        label: label.trim(),
        auth_mode: authMode,
      };
      if (Object.keys(cleanConfig).length) body.config = cleanConfig;
      if (Object.keys(secrets).length) body.secrets = secrets;
      const sk = secretKeyFor(authMode);
      if (sk && secret.trim()) {
        body.secrets = { ...(body.secrets as Record<string, string>), [sk]: secret.trim() };
      }
      const res = await installHubIntegration(body, true);
      onDone({ authMode, id: res.id ?? Number(res.id), status: res.status });
    } catch (e) {
      toast("error", "Install failed", e instanceof Error ? e.message : "");
    } finally {
      setBusy(false);
    }
  };

  const showIssuer = authMode === "oidc";
  const showWebhook = authMode === "copy_webhook" || authMode === "webhook_secret";

  return (
    <Modal open={true} onClose={onClose} title={`Install ${connector.display_name}`} wide>
      <div className="space-y-4">
        <p className="text-xs text-slate-400">{connector.description}</p>

        <div>
          <label className="label">Auth mode</label>
          <select className="input" value={authMode} onChange={(e) => setAuthMode(e.target.value)}>
            {connector.auth_modes.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        <div>
          <label className="label">Label</label>
          <input className="input" placeholder="e.g. Production Slack" value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>

        {showIssuer && (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="label">Issuer URL</label>
                <input className="input" placeholder="https://login.microsoftonline.com/{tenant}/v2.0" value={config.issuer ?? ""} onChange={(e) => setCfg("issuer", e.target.value)} />
              </div>
              <div>
                <label className="label">Client ID</label>
                <input className="input" placeholder="Application (client) ID" value={config.client_id ?? ""} onChange={(e) => setCfg("client_id", e.target.value)} />
              </div>
            </div>
            <div>
              <label className="label">Client secret</label>
              <input className="input" type="password" placeholder="Client secret" value={secret} onChange={(e) => setSecret(e.target.value)} />
            </div>
          </>
        )}

        {showWebhook && (
          <div>
            <label className="label">{authMode === "copy_webhook" ? "Webhook URL" : "Webhook secret"}</label>
            <input
              className="input font-mono"
              placeholder={authMode === "copy_webhook" ? "https://hooks.example.com/…" : "Webhook secret"}
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
            />
            {authMode === "webhook_secret" && (
              <p className="mt-1 text-[11px] text-slate-500">If left blank the backend generates one (shown once after install).</p>
            )}
          </div>
        )}

        {authMode === "oauth2" && (
          <div className="flex items-start gap-2 rounded-md border border-phantix-700/50 bg-phantix-950/50 p-3">
            <ExternalLink size={14} className="mt-0.5 shrink-0 text-gold-400" />
            <p className="text-[11px] leading-5 text-slate-400">After the authorizer approves, a popup opens to complete OAuth with the provider. The installation stays <code className="font-mono">pending_auth</code> until then.</p>
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy || !label.trim()} onClick={handleInstall}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Plug size={14} />} Install
          </button>
        </div>
      </div>
    </Modal>
  );
}
