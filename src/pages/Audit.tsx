import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Download, ArrowRight, Loader2, RefreshCw, ChevronLeft, ChevronRight, Search, ShieldAlert } from "lucide-react";
import { PageHeader, Card, Spinner } from "@/components/ui";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";
import { describeEndpoint } from "@/lib/auditExplain";
import { cx, timeAgo, formatDateTime } from "@/lib/utils";

interface AuditRow {
  id: number;
  event_uid: string;
  organization_id: number;
  action_key: string;
  action_label: string;
  category: string;
  status: string;
  initiator_name: string | null;
  initiator_title: string | null;
  authorizer_name: string | null;
  authorizer_title: string | null;
  initiated_at: string | null;
  authorised_at: string | null;
  completed_at: string | null;
  summary: string | null;
  details?: {
    path?: string;
    method?: string;
    actor_email?: string;
    token_type?: string;
    passive?: boolean;
    [k: string]: unknown;
  };
  source: string | null;
  ip_address: string | null;
  created_at: string;
}

const PAGE_SIZE = 200;

const CATEGORY_COLORS: Record<string, string> = {
  auth: "border-blue-400/40 bg-blue-400/10 text-blue-300",
  data_access: "border-cyan-400/40 bg-cyan-400/10 text-cyan-300",
  mutation: "border-amber-400/40 bg-amber-400/10 text-amber-300",
  people: "border-indigo-400/40 bg-indigo-400/10 text-indigo-300",
  billing: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
  security: "border-red-400/40 bg-red-400/10 text-red-300",
  agi: "border-fuchsia-400/40 bg-fuchsia-400/10 text-fuchsia-300",
};

function categoryLabel(cat: string): string {
  return (cat || "other").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusColor(status: string): string {
  switch (String(status).toLowerCase()) {
    case "completed": case "authorized": case "approved": return "emerald";
    case "rejected": case "failed": return "red";
    case "pending": case "initiated": return "amber";
    default: return "slate";
  }
}

function StatusPill({ status }: { status: string }) {
  const color = statusColor(status);
  return (
    <span className={cx(
      "chip capitalize",
      color === "emerald" && "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
      color === "red" && "border-severity-critical/30 bg-severity-critical/10 text-red-300",
      color === "amber" && "border-amber-400/30 bg-amber-400/10 text-amber-300",
      color === "slate" && "border-slate-500/30 bg-slate-500/10 text-slate-400",
    )}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" /> {status || "—"}
    </span>
  );
}

/** Normalize an audit row into a short, stable display id. */
function shortUid(uid: string): string {
  return (uid || "").replace(/-/g, "").slice(0, 8).toUpperCase() || "—";
}

export default function Audit() {
  const { toast, exportAuditCsv } = useStore();
  const [exporting, setExporting] = useState(false);

  const [items, setItems] = useState<AuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [sortByClass, setSortByClass] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchPage = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    const params = new URLSearchParams();
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", String(page * PAGE_SIZE));
    if (search.trim()) params.set("q", search.trim());
    if (category !== "all") params.set("category", category);
    if (status !== "all") params.set("status", status);
    try {
      const res = await api.get<{ items?: AuditRow[]; total?: number }>(`/audit/events?${params.toString()}`);
      const rows = (res?.items ?? []) as AuditRow[];
      setItems(rows);
      setTotal(Number(res?.total ?? rows.length));
    } catch (e) {
      setItems([]);
      setTotal(0);
      setLoadError(e instanceof Error ? e.message : "Could not load audit trail");
    } finally {
      setLoading(false);
    }
  }, [page, search, category, status]);

  useEffect(() => { void fetchPage(); }, [fetchPage]);

  // Debounced search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setPage(0); setReloadKey((k) => k + 1); }, 350);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [search, category, status]);

  // Poll so new user activities stream in.
  useEffect(() => {
    const t = window.setInterval(() => setReloadKey((k) => k + 1), 30000);
    return () => window.clearInterval(t);
  }, []);
  useEffect(() => { if (reloadKey === 0) return; void fetchPage(); }, [reloadKey, fetchPage]);

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportAuditCsv();
      toast("success", "Export ready", "Audit CSV downloaded — every row carries initiator and authorizer names.");
    } catch (err) {
      toast("error", "Export failed", err instanceof Error ? err.message : "Could not download the audit trail");
    } finally {
      setExporting(false);
    }
  };

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  // Group/order by category (class) when toggled on.
  const visible = sortByClass
    ? [...items].sort((a, b) => (a.category || "").localeCompare(b.category || ""))
    : items;

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Audit trail"
        description="Immutable platform-DB trail of user activities — every action with initiator, authorizer, status, and timeline for compliance."
        actions={
          <div className="flex items-center gap-2">
            <button className="btn-ghost" onClick={() => { setReloadKey((k) => k + 1); }} title="Refresh audit trail"><RefreshCw size={15} /></button>
            <button className="btn-secondary" onClick={() => void handleExport()} disabled={exporting}>
              {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} Export CSV
            </button>
          </div>
        }
      />

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search initiator, action, summary…"
            className="w-72 rounded-lg border border-phantix-700/50 bg-phantix-950/70 py-1.5 pl-8 pr-3 text-xs text-slate-200 outline-none placeholder:text-slate-500 focus:border-gold-400/50"
          />
        </div>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-lg border border-phantix-700/50 bg-phantix-950/70 px-2.5 py-1.5 text-xs text-slate-300 outline-none focus:border-gold-400/50">
          <option value="all">All categories</option>
          {["auth", "data_access", "mutation", "people", "billing", "security", "agi"].map((c) => (
            <option key={c} value={c}>{categoryLabel(c)}</option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-phantix-700/50 bg-phantix-950/70 px-2.5 py-1.5 text-xs text-slate-300 outline-none focus:border-gold-400/50">
          <option value="all">All statuses</option>
          <option value="completed">Completed</option>
          <option value="pending">Pending / initiated</option>
          <option value="rejected">Rejected</option>
        </select>
        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-400">
          <input type="checkbox" checked={sortByClass} onChange={(e) => setSortByClass(e.target.checked)} className="h-3 w-3 accent-gold-400" />
          Group by category (class)
        </label>
        <span className="ml-auto text-[11px] text-slate-500">{total.toLocaleString()} events · {PAGE_SIZE}/page</span>
      </div>

      {loadError && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-md border border-severity-critical/30 bg-severity-critical/10 px-4 py-3">
          <p className="text-sm text-red-300">Could not load audit trail: {loadError}</p>
          <button onClick={() => setReloadKey((k) => k + 1)} className="btn-ghost text-xs">Retry</button>
        </div>
      )}

      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center"><Spinner className="h-6 w-6" /></div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="!p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-phantix-700/40">
                    <th className="th">Alert ID</th>
                    <th className="th">Category (class)</th>
                    <th className="th">What was done</th>
                    <th className="th">Initiator</th>
                    <th className="th">Authorizer</th>
                    <th className="th">Status</th>
                    <th className="th">Timeline</th>
                    <th className="th">IP</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((e, i) => {
                    const cat = e.category || "other";
                    const catColor = CATEGORY_COLORS[cat] ?? "border-slate-500/40 bg-slate-500/10 text-slate-400";
                    const desc = describeEndpoint(e.details?.method ?? "GET", e.details?.path ?? "");
                    return (
                      <motion.tr
                        key={`${e.id}-${i}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: Math.min(i * 0.015, 0.4) }}
                        className="border-b border-phantix-800/40 hover:bg-phantix-800/35"
                      >
                        <td className="td whitespace-nowrap">
                          <p className="font-mono text-[11px] text-gold-300">#{e.id}</p>
                          <p className="text-[9px] font-mono text-slate-600">{shortUid(e.event_uid)}</p>
                        </td>
                        <td className="td">
                          <span className={cx("rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider", catColor)}>
                            {categoryLabel(cat)}
                          </span>
                          {e.details?.passive !== undefined && (
                            <p className="mt-0.5 text-[9px] text-slate-600">{e.details.passive ? "read" : "write"}</p>
                          )}
                        </td>
                        <td className="td max-w-[340px]">
                          <p className="font-medium text-slate-200">{(desc?.label ?? e.action_label) || e.action_key || "Activity"}</p>
                          <p className="text-[11px] leading-5 text-slate-400">{(desc?.detail ?? e.summary) || "An action was performed on the platform."}</p>
                        </td>
                        <td className="td">
                          <div className="flex items-center gap-1.5">
                            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-phantix-700/60 text-[9px] font-bold text-phantix-200">
                              {(e.initiator_name ?? "?").slice(0, 1)}
                            </span>
                            <div>
                              <p className="text-[11px] text-slate-300">{e.initiator_name ?? "—"}</p>
                              <p className="text-[9px] text-slate-600">{e.initiator_title ?? ""}</p>
                            </div>
                          </div>
                        </td>
                        <td className="td">
                          {e.authorizer_name ? (
                            <div className="flex items-center gap-1.5">
                              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-gold-400/20 text-[9px] font-bold text-gold-300">
                                {e.authorizer_name.slice(0, 1)}
                              </span>
                              <div>
                                <p className="text-[11px] text-slate-300">{e.authorizer_name}</p>
                                <p className="text-[9px] text-slate-600">{e.authorizer_title ?? ""}</p>
                              </div>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-600">—</span>
                          )}
                        </td>
                        <td className="td"><StatusPill status={e.status || "—"} /></td>
                        <td className="td whitespace-nowrap text-[10px] text-slate-400">
                          <p title={e.created_at ? formatDateTime(e.created_at) : ""}>{timeAgo(e.created_at)}</p>
                          {e.initiated_at && e.completed_at && e.initiated_at !== e.completed_at && (
                            <p className="text-[9px] text-slate-600">started {timeAgo(e.initiated_at)}</p>
                          )}
                        </td>
                        <td className="td font-mono text-[10px] text-slate-500">{e.ip_address ?? "—"}</td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {visible.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-14 text-center">
                <ShieldAlert size={22} className="text-slate-600" />
                <p className="text-sm text-slate-500">No audit events match.</p>
              </div>
            )}
          </Card>

          {/* Pagination */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              Showing <span className="font-semibold text-slate-300">{total === 0 ? 0 : page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)}</span> of{" "}
              <span className="font-semibold text-slate-300">{total.toLocaleString()}</span> events
            </p>
            <div className="flex items-center gap-2">
              <button
                className="btn-ghost !px-2.5 !py-1.5 !text-xs"
                disabled={page === 0 || loading}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                <ChevronLeft size={14} /> Prev
              </button>
              <span className="text-xs text-slate-400">Page {page + 1} / {pageCount}</span>
              <button
                className="btn-ghost !px-2.5 !py-1.5 !text-xs"
                disabled={page + 1 >= pageCount || loading}
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </motion.div>
      )}

      <p className="mt-4 text-xs text-slate-500">
        Dual-control audit lives on the platform DB per organization — never written into your customer security database.
      </p>
    </div>
  );
}
