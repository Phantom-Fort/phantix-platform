import React, { useState } from "react";
import { motion } from "framer-motion";
import { Building2, Plus, KeyRound, Copy } from "lucide-react";
import { PageHeader, Card, StatusBadge, Modal, EmptyState, CopyChip } from "@/components/ui";
import { useStore } from "@/lib/store";
import { timeAgo } from "@/lib/utils";

export default function Companies() {
  const { state, createCompany, rotateServiceKey, toast } = useStore();
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [country, setCountry] = useState("NG");
  const [busy, setBusy] = useState(false);
  const [keyModal, setKeyModal] = useState<{ company: string; secret: string } | null>(null);

  return (
    <div className="mx-auto max-w-[1200px]">
      <PageHeader
        title="Companies"
        description="A group of startups = multiple child companies. Each company gets exactly one service key — keys and data stay isolated per company."
        actions={<button className="btn-primary" onClick={() => setCreateOpen(true)}><Plus size={15} /> Onboard a company</button>}
      />

      {/* Parent company */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <Card hover className="mb-4 border-gold-400/25">
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gold-400/15 text-gold-400">
              <Building2 size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-slate-100">{state.org.name}</p>
                <span className="chip border-gold-400/30 bg-gold-400/10 text-gold-300">parent</span>
              </div>
              <p className="mt-0.5 font-mono text-xs text-slate-500">#{state.org.id} · {state.org.slug}</p>
            </div>
            <div className="flex items-center gap-2">
              {state.serviceKey ? <CopyChip value={state.serviceKey.prefix} label="key" /> : <span className="text-xs text-slate-600">no key</span>}
              <StatusBadge status="active" />
            </div>
          </div>
        </Card>
      </motion.div>

      {state.companies.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Building2 size={22} />}
            title="No child companies yet"
            body="Onboard each startup in your group as its own company with its own service key, users and data isolation."
            action={<button className="btn-primary" onClick={() => setCreateOpen(true)}><Plus size={15} /> Onboard the first one</button>}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {state.companies.map((c, i) => (
            <motion.div key={c.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card hover>
                <div className="flex items-start gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-phantix-800/70 text-phantix-300">
                    <Building2 size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-100">{c.name}</p>
                    <p className="mt-0.5 font-mono text-xs text-slate-500">#{c.id} · {c.slug}</p>
                    <p className="mt-1 text-xs text-slate-500">{c.industry ?? "—"} · {c.country ?? "—"} · created {timeAgo(c.created_at)}</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between rounded-xl border border-phantix-700/40 bg-phantix-950/50 px-4 py-3">
                  <span className="text-xs text-slate-500">Service key</span>
                  {c.key_prefix ? (
                    <span className="font-mono text-xs text-slate-300">{c.key_prefix}</span>
                  ) : (
                    <button
                      className="btn-secondary !px-3 !py-1.5 !text-xs"
                      onClick={async () => {
                        const secret = await rotateServiceKey(c.id);
                        setKeyModal({ company: c.name, secret });
                      }}
                    >
                      <KeyRound size={12} /> Create key
                    </button>
                  )}
                </div>
                {c.key_prefix && (
                  <button
                    className="btn-ghost mt-2.5 w-full !py-1.5 !text-xs"
                    onClick={async () => {
                      const secret = await rotateServiceKey(c.id);
                      setKeyModal({ company: c.name, secret });
                    }}
                  >
                    Rotate key
                  </button>
                )}
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Onboard a child company">
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            await createCompany({ name, industry, country });
            setBusy(false);
            setCreateOpen(false);
            setName("");
            setIndustry("");
            toast("success", "Company created", "Next: create its service key — one key per company.");
          }}
        >
          <div>
            <label className="label">Company name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your Company Ltd" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Industry</label>
              <input className="input" value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="Fintech" />
            </div>
            <div>
              <label className="label">Country</label>
              <select className="input" value={country} onChange={(e) => setCountry(e.target.value)}>
                <option value="NG">Nigeria</option><option value="GH">Ghana</option><option value="KE">Kenya</option><option value="ZA">South Africa</option><option value="GB">United Kingdom</option><option value="US">United States</option>
              </select>
            </div>
          </div>
          <div className="rounded-xl border border-phantix-700/50 bg-phantix-950/50 p-3.5 text-xs leading-5 text-slate-500">
            The child company is a separate tenant: its own service key, users, security database and billing scope.
            POST /organizations/me/companies.
          </div>
          <button className="btn-primary w-full" disabled={busy || !name.trim()}>{busy ? "Creating…" : "Create company"}</button>
        </form>
      </Modal>

      {/* Key reveal */}
      <Modal open={!!keyModal} onClose={() => setKeyModal(null)} title={`Service key — ${keyModal?.company}`}>
        <div className="space-y-4">
          <div className="rounded-xl border border-severity-medium/30 bg-severity-medium/8 p-3.5 text-xs leading-5 text-severity-medium">
            Shown once. The backend keeps only the SHA-256 — copy it into your secrets vault now.
          </div>
          <div className="rounded-xl border border-phantix-700/50 bg-phantix-950/70 p-4 font-mono text-sm text-gold-300 break-all">
            {keyModal?.secret}
          </div>
          <button
            className="btn-primary w-full"
            onClick={() => {
              navigator.clipboard?.writeText(keyModal?.secret ?? "").catch(() => {});
              toast("success", "Copied");
              setKeyModal(null);
            }}
          >
            <Copy size={15} /> Copy & I stored it safely
          </button>
        </div>
      </Modal>
    </div>
  );
}
