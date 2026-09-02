import React, { useState } from "react";
import { motion } from "framer-motion";
import { Database, Plus, ShieldCheck, AlertTriangle, Loader2, Trash2, Zap, Info } from "lucide-react";
import { PageHeader, Card, StatusBadge, Modal, EmptyState } from "@/components/ui";
import { useStore } from "@/lib/store";
import { api, DEMO_MODE } from "@/lib/api";
import { timeAgo, cx } from "@/lib/utils";

export default function Connections() {
  const {
    state, testConnection, bootstrapConnection, deleteConnection, operate, securityDbReady,
    toast, requireDualControl, refreshConnections, hydrateSession,
  } = useStore();
  const [createOpen, setCreateOpen] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [drivers, setDrivers] = useState<{ db_type: string; live: boolean; note?: string }[]>([]);

  React.useEffect(() => {
    if (!DEMO_MODE) {
      void refreshConnections();
      api.get<any>("/db-connections/drivers")
        .then((r) => {
          const items = Array.isArray(r) ? r : (r?.items ?? []);
          setDrivers(items.map((d: any) => ({ db_type: String(d.db_type ?? d.engine ?? ""), live: Boolean(d.live ?? d.live_probe ?? d.installed ?? false), note: d.note ? String(d.note) : undefined })));
        })
        .catch(() => { /* keep empty */ });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Dual control must be set up before managing DB connections. */
  const guard = async () => {
    if (!state.dualControl.configured) {
      toast("warning", "Dual control required", "Set up dual control (People page) before managing database connections.");
      return false;
    }
    if (operate.unlocked) return true;
    return requireDualControl("Manage security database connections requires a dual-control operate session.");
  };

  return (
    <div className="mx-auto max-w-[1200px]">
      <PageHeader
        title="Security database"
        description="BYO dedicated database --- the bootstrap gate for scans, VAPT and findings. Config-inspection connections read security metadata only, never business rows."
        actions={
          <button className="btn-primary" onClick={async () => { if (await guard()) setCreateOpen(true); }}>
            <Plus size={15} /> Add connection
          </button>
        }
      />

      {/* Gate banner */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={cx(
          "mb-5 flex items-start gap-3 rounded-2xl border px-4 py-3",
          securityDbReady ? "border-emerald-400/25 bg-emerald-400/5" : "border-severity-medium/30 bg-severity-medium/8",
        )}
      >
        {securityDbReady ? <ShieldCheck size={16} className="mt-0.5 shrink-0 text-emerald-400" /> : <AlertTriangle size={16} className="mt-0.5 shrink-0 text-severity-medium" />}
        <p className="text-xs leading-5 text-slate-400">
          {securityDbReady ? (
            <><strong className="text-emerald-300">Bootstrap gate: ready.</strong> The primary security store is on schema v1.4.2 --- scans, VAPT and findings are unblocked.</>
          ) : (
            <><strong className="text-severity-medium">Bootstrap gate: blocked.</strong> Create a security_data_storage connection, test it, then bootstrap. Until then the backend refuses scans and VAPT --- this is not just a UI state.</>
          )}
        </p>
      </motion.div>

      {state.connections.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Database size={22} />}
            title="No connections yet"
            body="Register your dedicated security database (PostgreSQL recommended). Credentials are Fernet-encrypted on the platform DB."
            action={<button className="btn-primary" onClick={async () => { if (await guard()) setCreateOpen(true); }}><Plus size={15} /> Add the first connection</button>}
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {state.connections.map((c, i) => (
            <motion.div key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card hover>
                <div className="flex flex-wrap items-center gap-4">
                  <span className={cx("flex h-12 w-12 items-center justify-center rounded-md", c.bootstrap_status === "ready" ? "bg-emerald-400/12 text-emerald-400" : "bg-phantix-800/70 text-phantix-300")}>
                    <Database size={20} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-100">{c.name}</p>
                      {c.is_primary && <span className="chip border-gold-400/30 bg-gold-400/10 text-gold-300">primary</span>}
                      <StatusBadge status={c.bootstrap_status} />
                    </div>
                    <p className="mt-1 font-mono text-xs text-slate-500">
                      {c.db_type} · {c.host}:{c.port}/{c.database_name} · schema {c.target_schema}
                      {c.schema_version ? ` · v${c.schema_version}` : ""}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-600">
                      {c.connection_purpose === "security_data_storage"
                        ? "security_data_storage --- full CRUD inside the phantix schema only"
                        : "config_inspection --- roles, privileges, policies; never business rows"}
                      {c.last_test_at && ` · last test ${c.last_test_ok ? "passed" : "failed"} ${timeAgo(c.last_test_at)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="btn-secondary !py-2"
                      disabled={busyId === c.id}
                      onClick={async () => {
                        if (!(await guard())) return;
                        setBusyId(c.id);
                        try {
                          await testConnection(c.id);
                          toast("success", "Connectivity OK", "Live probe succeeded.");
                        } catch (err) {
                          toast("error", "Test failed", err instanceof Error ? err.message : "Connection test failed");
                        } finally {
                          setBusyId(null);
                        }
                      }}
                    >
                      {busyId === c.id ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />} Test
                    </button>
                    {c.connection_purpose === "security_data_storage" && c.bootstrap_status !== "ready" && (
                      <button
                        className="btn-primary !py-2"
                        disabled={busyId === c.id}
                        onClick={async () => {
                          if (!(await guard())) return;
                          setBusyId(c.id);
                          try {
                            await bootstrapConnection(c.id);
                            toast("success", "Schema bootstrapped", "phantix schema ready --- assets, scans, findings, risks, evidence.");
                          } catch (err) {
                            toast("error", "Bootstrap failed", err instanceof Error ? err.message : "Bootstrap failed");
                          } finally {
                            setBusyId(null);
                          }
                        }}
                      >
                        {busyId === c.id ? <Loader2 size={14} className="animate-spin" /> : null}
                        Bootstrap schema
                      </button>
                    )}
                    <button
                      className="btn-ghost !p-2 text-slate-500 hover:text-severity-critical"
                      onClick={async () => {
                        if (!(await guard())) return;
                        try {
                          await deleteConnection(c.id);
                          toast("info", "Connection deleted");
                        } catch (err) {
                          toast("error", "Delete failed", err instanceof Error ? err.message : "Delete failed");
                        }
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Driver availability */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mt-6">
        <Card>
          <div className="mb-3 flex items-center gap-2">
            <Info size={14} className="text-gold-400" />
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Driver availability (GET /db-connections/drivers)</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(() => {
              const list = DEMO_MODE
                ? [["postgresql / supabase", true], ["sqlite", true], ["mysql / mariadb", true], ["mssql", false], ["mongodb", false], ["firestore", false]] as [string, boolean][]
                : drivers.length
                  ? drivers.map((d) => [d.db_type, d.live] as [string, boolean])
                  : [["loading drivers...", false] as [string, boolean]];
              return list.map(([name, ok]) => (
                <span key={String(name)} className={cx("chip", ok ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-phantix-700/50 bg-phantix-900/50 text-slate-500")}>
                  {String(name)} {ok ? "· live" : "· optional"}
                </span>
              ));
            })()}
          </div>
          <p className="mt-3 text-[11px] leading-4 text-slate-500">
            Credentials can be stored encrypted without the optional driver; live tests need the package. Connections
            need more than username+password --- see connection-option-hints (ssl_mode, search_path, odbc_driver...).
          </p>
        </Card>
      </motion.div>

      <CreateConnectionModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

function CreateConnectionModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { createConnection, toast, state, requireDualControl, operate } = useStore();
  const [busy, setBusy] = useState(false);
  const [purpose, setPurpose] = useState<"security_data_storage" | "config_inspection">("security_data_storage");
  const [resolvingHost, setResolvingHost] = useState<string | null>(null);

  const resolveHost = async (host: string): Promise<string> => {
    // Skip if already an IP address
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(host)) return host;
    setResolvingHost(host);
    try {
      const res = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(host)}&type=A`);
      const data = await res.json();
      if (data.Answer?.length > 0) {
        const ipv4 = data.Answer.find((a: any) => a.type === 1)?.data;
        if (ipv4) {
          toast("info", "DNS resolved", `${host} → ${ipv4}`);
          return ipv4;
        }
      }
      // No A record found --- pass original host (backend may handle it)
      toast("warning", "No IPv4 record", `${host} could not be resolved --- passing as-is`);
      return host;
    } catch {
      toast("warning", "DNS lookup failed", `Could not resolve ${host} --- passing as-is`);
      return host;
    } finally {
      setResolvingHost(null);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Add database connection" wide>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          // Enforce dual control
          if (!state.dualControl.configured) {
            toast("warning", "Dual control required", "Set up initiator + authorizer on the People page first.");
            return;
          }
          if (state.dualControl.configured && !operate.unlocked) {
            const ok = await requireDualControl("Managing security database connections requires a dual-control operate session.");
            if (!ok) return;
          }
          const f = new FormData(e.currentTarget);
          setBusy(true);
          try {
            let host = String(f.get("host")).trim();
            host = await resolveHost(host);
            await createConnection({
              name: String(f.get("name")),
              connection_purpose: purpose,
              db_type: String(f.get("db_type")),
              host: String(f.get("host")),
              port: Number(f.get("port")),
              database_name: String(f.get("database_name")),
              target_schema: String(f.get("target_schema")) || "phantix",
              is_primary: purpose === "security_data_storage",
              username: String(f.get("username") || ""),
              password: String(f.get("password") || ""),
              ssl_mode: String(f.get("ssl_mode") || "prefer"),
              environment: String(f.get("environment") || "production"),
            });
            onClose();
            toast("success", "Connection saved", "Credentials Fernet-encrypted. Next: test, then bootstrap the security schema.");
          } catch (err) {
            toast("error", "Could not save connection", err instanceof Error ? err.message : "Request failed");
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="label">Name</label>
            <input name="name" className="input" defaultValue="Phantix Security Store" required />
          </div>
          <div className="col-span-2 grid grid-cols-2 gap-2">
            {([
              ["security_data_storage", "Security data storage", "Phantix writes findings, assets, evidence --- phantix schema only"],
              ["config_inspection", "Config inspection", "Read-only security posture --- never business rows"],
            ] as const).map(([v, label, desc]) => (
              <button
                type="button"
                key={v}
                onClick={() => setPurpose(v)}
                className={cx("rounded-md border p-3.5 text-left transition-all", purpose === v ? "border-gold-400/60 bg-gold-400/8" : "border-phantix-700/50 bg-phantix-950/40 hover:border-phantix-500/50")}
              >
                <p className="text-sm font-semibold text-slate-200">{label}</p>
                <p className="mt-1 text-[11px] leading-4 text-slate-500">{desc}</p>
              </button>
            ))}
          </div>
          <div>
            <label className="label">Engine</label>
            <select name="db_type" className="input">
              <option value="postgresql">postgresql</option>
              <option value="mysql">mysql</option>
              <option value="mssql">mssql</option>
              <option value="mongodb">mongodb</option>
            </select>
          </div>
          <div>
            <label className="label">Host</label>
            <input name="host" className="input font-mono" placeholder="10.20.0.14 or db.example.com" required />
            {resolvingHost && <p className="text-[10px] text-phantix-400 mt-1 animate-pulse-soft">Resolving {resolvingHost} → IPv4...</p>}
            <p className="text-[10px] text-slate-500 mt-0.5">Hostnames are auto-resolved to IPv4 via DNS before connecting</p>
          </div>
          <div>
            <label className="label">Port</label>
            <input name="port" type="number" className="input font-mono" defaultValue={5432} required />
          </div>
          <div>
            <label className="label">Database</label>
            <input name="database_name" className="input font-mono" defaultValue="phantix_security" required />
          </div>
          <div>
            <label className="label">Target schema</label>
            <input name="target_schema" className="input font-mono" defaultValue="phantix" />
          </div>
          <div>
            <label className="label">Username</label>
            <input name="username" className="input font-mono" placeholder="phantix_writer" required />
          </div>
          <div>
            <label className="label">Password</label>
            <input name="password" type="password" className="input" placeholder="••••••••" required />
          </div>
          <div>
            <label className="label">SSL mode</label>
            <select name="ssl_mode" className="input">
              <option value="prefer">prefer</option>
              <option value="require">require</option>
              <option value="disable">disable</option>
            </select>
          </div>
          <div>
            <label className="label">Environment</label>
            <select name="environment" className="input">
              <option value="production">production</option>
              <option value="staging">staging</option>
              <option value="development">development</option>
            </select>
          </div>
        </div>
        <div className="rounded-md border border-phantix-700/50 bg-phantix-950/50 p-3.5 text-xs leading-5 text-slate-500">
          Least privilege: the storage role needs CONNECT, CREATE (or schema ownership), USAGE and DML on the
          phantix schema only --- never access to application tables.
        </div>
        <button className="btn-primary w-full" disabled={busy}>{resolvingHost ? "Resolving DNS..." : busy ? "Saving..." : "Save connection"}</button>
      </form>
    </Modal>
  );
}
