import React, { useState } from "react";
import { motion } from "framer-motion";
import { Building2, KeyRound, RefreshCw, ImagePlus, AlertTriangle, CheckCircle2, Layers } from "lucide-react";
import { PageHeader, Card, CardHeader, StatusBadge, Modal, CopyChip } from "@/components/ui";
import { useStore } from "@/lib/store";
import { timeAgo } from "@/lib/utils";

const serviceCatalog = [
  { key: "attack_surface", name: "Attack Surface Management", desc: "Assets, discovery, tags, history" },
  { key: "vapt", name: "VAPT Campaigns", desc: "Guided testing with correlation" },
  { key: "risk", name: "Risk Management", desc: "Scoring, prioritization, treatments" },
  { key: "compliance", name: "Compliance & GRC", desc: "Frameworks, questionnaire, evidence" },
  { key: "reporting", name: "Reporting", desc: "Verified-only client packages" },
];

export default function Identity() {
  const { state, rotateServiceKey, revokeServiceKey, toast, operate, requireDualControl } = useStore();
  const [keyModal, setKeyModal] = useState<string | null>(null);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [preferred, setPreferred] = useState<string[]>(["attack_surface", "vapt", "risk", "reporting"]);
  const key = state.serviceKey;

  return (
    <div className="mx-auto max-w-[1200px]">
      <PageHeader
        title="Identity & keys"
        description="Company tenant IDs for support and app invites, your report branding, and the single active service key per company."
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Tenant identity */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardHeader title="Tenant identity" subtitle="From GET /organizations/me/identity" action={<Building2 size={16} className="text-slate-500" />} />
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-phantix-700/40 bg-phantix-950/50 px-4 py-3">
                <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Organization</span>
                <span className="font-medium text-slate-200">{state.org.name}</span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-phantix-700/40 bg-phantix-950/50 px-4 py-3">
                <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Tenant ID</span>
                <CopyChip value={`#${state.org.id}`} />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-phantix-700/40 bg-phantix-950/50 px-4 py-3">
                <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Slug</span>
                <CopyChip value={state.org.slug} />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-phantix-700/40 bg-phantix-950/50 px-4 py-3">
                <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Creator user</span>
                <CopyChip value={`#${state.org.creator_user_id}`} />
              </div>
            </div>
            <p className="mt-3 text-[11px] leading-4 text-slate-500">
              Company tenant IDs — needed for support tickets and app invites. Payment, plan and rate limits bind
              to the tenant ID.
            </p>
          </Card>
        </motion.div>

        {/* Service key */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
          <Card>
            <CardHeader title="Service key" subtitle="Exactly one active key per company — X-Org-Api-Key" action={<KeyRound size={16} className="text-slate-500" />} />
            {key ? (
              <>
                <div className="rounded-xl border border-phantix-700/40 bg-phantix-950/50 p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm text-slate-200">{key.prefix}</span>
                    <StatusBadge status="active" />
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Created {timeAgo(key.created_at)} · {key.last_used_at ? `last used ${timeAgo(key.last_used_at)}` : "never used"}
                  </p>
                </div>
                <div className="mt-4 flex gap-2.5">
                  <button
                    className="btn-primary flex-1"
                    onClick={async () => {
                      if (!operate.unlocked && !(await requireDualControl("Service key rotation requires a dual-control operate session."))) return;
                      setKeyModal(await rotateServiceKey());
                    }}
                  >
                    <RefreshCw size={14} /> Rotate key
                  </button>
                  <button className="btn-danger" onClick={() => setRevokeOpen(true)}>Revoke</button>
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-dashed border-phantix-600/50 p-6 text-center">
                <KeyRound size={22} className="mx-auto text-slate-600" />
                <p className="mt-3 text-sm text-slate-400">No active service key.</p>
                <button
                  className="btn-primary mt-4"
                  onClick={async () => {
                    if (!operate.unlocked && !(await requireDualControl("Creating a service key requires a dual-control operate session."))) return;
                    setKeyModal(await rotateServiceKey());
                  }}
                >
                  Create service key
                </button>
              </div>
            )}
            <p className="mt-3 text-[11px] leading-4 text-slate-500">
              Full secret returns once on create/rotate (stored as SHA-256). Rotating keeps the old key alive
              briefly — per-user login links are unaffected. Child companies each get their own key.
            </p>
          </Card>
        </motion.div>

        {/* Branding */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
          <Card>
            <CardHeader title="Report branding" subtitle="Logo on PDF/DOCX cover pages and footers" action={<ImagePlus size={16} className="text-slate-500" />} />
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-phantix-700/50 bg-phantix-950/60">
                <img src="/logo-transparent.png" alt="logo" className="h-14 w-14 object-contain" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-slate-300">{state.org.name}</p>
                <p className="text-xs text-slate-500">PNG or SVG, at least 512×512 for crisp covers</p>
                <div className="mt-2.5 flex gap-2">
                  <button className="btn-secondary !py-2 !text-xs" onClick={() => toast("info", "Logo upload", "POST /organizations/me/logo (multipart)")}>Upload logo</button>
                  <button className="btn-ghost !py-2 !text-xs" onClick={() => toast("info", "Logo removed", "DELETE /organizations/me/logo")}>Remove</button>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Preferred services */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
          <Card>
            <CardHeader title="Preferred services" subtitle="Shape which modules your product experience unlocks" action={<Layers size={16} className="text-slate-500" />} />
            <div className="space-y-2">
              {serviceCatalog.map((s) => {
                const on = preferred.includes(s.key);
                return (
                  <button
                    key={s.key}
                    onClick={() => {
                      setPreferred((p) => (on ? p.filter((x) => x !== s.key) : [...p, s.key]));
                      toast("success", "Preferences saved", "PUT /organizations/me/preferred-services");
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${on ? "border-gold-400/40 bg-gold-400/6" : "border-phantix-700/40 bg-phantix-950/40 hover:border-phantix-500/50"}`}
                  >
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${on ? "bg-gold-400/15 text-gold-400" : "bg-phantix-800/70 text-slate-500"}`}>
                      <CheckCircle2 size={15} />
                    </span>
                    <span className="flex-1">
                      <span className="block text-sm font-medium text-slate-200">{s.name}</span>
                      <span className="block text-xs text-slate-500">{s.desc}</span>
                    </span>
                    <span className={`h-2 w-2 rounded-full ${on ? "bg-emerald-400" : "bg-slate-600"}`} />
                  </button>
                );
              })}
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Key reveal modal */}
      <Modal open={!!keyModal} onClose={() => setKeyModal(null)} title={key ? "Service key rotated" : "Service key created"}>
        <div className="space-y-4">
          <div className="rounded-xl border border-severity-medium/30 bg-severity-medium/8 p-3.5 text-xs leading-5 text-severity-medium">
            <AlertTriangle size={13} className="mr-1.5 inline" />
            Shown once — the backend stores only the SHA-256. Store it in your secrets vault now.
          </div>
          <div className="rounded-xl border border-phantix-700/50 bg-phantix-950/70 p-4 font-mono text-sm text-gold-300 break-all">
            {keyModal}
          </div>
          <button
            className="btn-primary w-full"
            onClick={() => {
              navigator.clipboard?.writeText(keyModal ?? "").catch(() => {});
              toast("success", "Copied — old key enters the grace period");
              setKeyModal(null);
            }}
          >
            Copy & I stored it safely
          </button>
        </div>
      </Modal>

      {/* Revoke confirm */}
      <Modal open={revokeOpen} onClose={() => setRevokeOpen(false)} title="Revoke service key?">
        <p className="text-sm leading-6 text-slate-300">
          Integrations using <span className="font-mono text-xs">{key?.prefix}</span> will stop working after the
          grace period. Login links already issued are unaffected.
        </p>
        <div className="mt-5 flex gap-3">
          <button className="btn-danger flex-1" onClick={async () => {
            if (!operate.unlocked && !(await requireDualControl("Revoking a service key requires a dual-control operate session."))) return;
            await revokeServiceKey();
            setRevokeOpen(false);
            toast("info", "Service key revoked");
          }}>
            Revoke key
          </button>
          <button className="btn-secondary" onClick={() => setRevokeOpen(false)}>Cancel</button>
        </div>
      </Modal>
    </div>
  );
}
