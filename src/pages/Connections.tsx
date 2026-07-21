import React, { useState } from "react";
import { motion } from "framer-motion";
import { Database, Plus, ShieldCheck, AlertTriangle, Loader2, Trash2, Zap, Info } from "lucide-react";
import { PageHeader, Card, StatusBadge, Modal, EmptyState } from "@/components/ui";
import { useStore } from "@/lib/store";
import { timeAgo, cx } from "@/lib/utils";

export default function Connections() {
  const { state, testConnection, bootstrapConnection, deleteConnection, operate, securityDbReady, toast } = useStore();
  const [createOpen, setCreateOpen] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const guard = () => {
    if (!state.dualControl.configured) {
      toast("warning", "Set up dual control first", "Mutations are blocked until initiator + authorizer are assigned (People & Control).");
      return false;
    }
    if (!operate.unlocked) {
      toast("warning", "Operate mode required", "Unlock a dual-control session to manage connections.");
      return false;
    }
    return true;
  };

  return (
    <div className="mx-auto max-w-[1200px]">
      <PageHeader
        title="Security database"
        description="BYO dedicated database — the bootstrap gate for scans, VAPT and findings. Config-inspection connections read security metadata only, never business rows."
        actions={
          <button className="btn-primary" onClick={() => guard() && setCreateOpen(true)}>
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
            <><strong className="text-emerald-300">Bootstrap gate: ready.</strong> The primary security store is on schema v1.4.2 — scans, VAPT and findings are unblocked.</>
          ) : (
            <><strong className="text-severity-medium">Bootstrap gate: blocked.</strong> Create a security_data_storage connection, test it, then bootstrap. Until then the backend refuses scans and VAPT — this is not just a UI state.</>
          )}
        </p>
      </motion.div>

      {state.connections.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Database size={22} />}
            title="No connections yet"
            body="Register your dedicated security database (PostgreSQL recommended). Credentials are Fernet-encrypted on the platform DB."
            action={<button className="btn-primary" onClick={() => guard() && setCreateOpen(true)}><Plus size={15} /> Add the first connection</button>}
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {state.connections.map((c, i) => (
            <motion.div key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card hover>
                <div className="flex flex-wrap items-center gap-4">
                  <span className={cx("flex h-12 w-12 items-center justify-center rounded-xl", c.bootstrap_status === "ready" ? "bg-emerald-400/12 text-emerald-400" : "bg-phantix-800/70 text-phantix-300")}>
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
                        ? "security_data_storage — full CRUD inside the phantix schema only"
                        : "config_inspection — roles, privileges, policies; never business rows"}
                      {c.last_test_at && ` · last test ${c.last_test_ok ? "passed" : "failed"} ${timeAgo(c.last_test_at)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="btn-secondary !py-2"
                      disabled={busyId === c.id}
                      onClick={async () => {
                        setBusyId(c.id);
                        await testConnection(c.id);
                        setBusyId(null);
                        toast("success", "Connectivity OK", "Live probe succeeded.");
                      }}
                    >
                      {busyId === c.id ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />} Test
                    </button>
                    {c.connection_purpose === "security_data_storage" && c.bootstrap_status !== "ready" && (
                      <button
                        className="btn-primary !py-2"
                        disabled={busyId === c.id}
                        onClick={async () => {
                          if (!guard()) return;
                          setBusyId(c.id);
                          await bootstrapConnection(c.id);
                          setBusyId(null);
                          toast("success", "Schema bootstrapped", "phantix schema v1.4.2 — assets, scans, findings, risks, evidence. Idempotent.");
                        }}
                      >
                        {busyId === c.id ? <Loader2 size={14} className="animate-spin" /> : null}
                        Bootstrap schema
                      </button>
                    )}
                    <button
                      className="btn-ghost !p-2 text-slate-500 hover:text-severity-critical"
                      onClick={async () => {
                        if (!guard()) return;
                        await deleteConnection(c.id);
                        toast("info", "Connection deleted");
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
            {[
              ["postgresql / supabase", true],
              ["sqlite", true],
              ["mysql / mariadb", true],
              ["mssql", false],
              ["mongodb", false],
              ["firestore", false],
            ].map(([name, ok]) => (
              <span key={String(name)} className={cx("chip", ok ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-phantix-700/50 bg-phantix-900/50 text-slate-500")}>
                {String(name)} {ok ? "· live" : "· optional"}
              </span>
            ))}
          </div>
          <p className="mt-3 text-[11px] leading-4 text-slate-500">
            Credentials can be stored encrypted without the optional driver; live tests need the package. Connections
            need more than username+password — see connection-option-hints (ssl_mode, search_path, odbc_driver…).
          </p>
        </Card>
      </motion.div>

      <CreateConnectionModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

function CreateConnectionModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { createConnection, toast } = useStore();
  const [busy, setBusy] = useState(false);
  const [purpose, setPurpose] = useState<"security_data_storage" | "config_inspection">("security_data_storage");

  return (
    <Modal open={open} onClose={onClose} title="Add database connection" wide>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          setBusy(true);
          await createConnection({
            name: String(f.get("name")),
            connection_purpose: purpose,
            db_type: String(f.get("db_type")),
            host: String(f.get("host")),
            port: Number(f.get("port")),
            database_name: String(f.get("database_name")),
            target_schema: String(f.get("target_schema")) || "phantix",
            is_primary: purpose === "security_data_storage",
          });
          setBusy(false);
          onClose();
          toast("success", "Connection saved", "Credentials Fernet-encrypted. Next: test, then bootstrap the security schema.");
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="label">Name</label>
            <input name="name" className="input" defaultValue="Phantix Security Store" required />
          </div>
          <div className="col-span-2 grid grid-cols-2 gap-2">
            {([
              ["security_data_storage", "Security data storage", "Phantix writes findings, assets, evidence — phantix schema only"],
              ["config_inspection", "Config inspection", "Read-only security posture — never business rows"],
            ] as const).map(([v, label, desc]) => (
              <button
                type="button"
                key={v}
                onClick={() => setPurpose(v)}
                className={cx("rounded-xl border p-3.5 text-left transition-all", purpose === v ? "border-gold-400/60 bg-gold-400/8" : "border-phantix-700/50 bg-phantix-950/40 hover:border-phantix-500/50")}
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
            <input name="host" className="input font-mono" placeholder="10.20.0.14" required />
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
            <input name="username" className="input font-mono" placeholder="phantix_writer" />
          </div>
          <div>
            <label className="label">Password</label>
            <input name="password" type="password" className="input" placeholder="••••••••" />
          </div>
        </div>
        <div className="rounded-xl border border-phantix-700/50 bg-phantix-950/50 p-3.5 text-xs leading-5 text-slate-500">
          Least privilege: the storage role needs CONNECT, CREATE (or schema ownership), USAGE and DML on the
          phantix schema only — never access to application tables.
        </div>
        <button className="btn-primary w-full" disabled={busy}>{busy ? "Saving…" : "Save connection"}</button>
      </form>
    </Modal>
  );
}
