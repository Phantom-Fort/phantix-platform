export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

export function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function titleCase(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function maskEmail(email: string): string {
  return email.replace(/(.{2}).+(@.+)/, "$1***$2");
}

export function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function formatNaira(amount: number): string {
  return `₦${amount.toLocaleString()}`;
}

export const statusColor: Record<string, string> = {
  active: "text-severity-low bg-severity-low/10 border-severity-low/30",
  ready: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  paid: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  approved: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  authorized: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  used: "text-slate-400 bg-slate-400/10 border-slate-500/30",
  pending: "text-severity-medium bg-severity-medium/10 border-severity-medium/30",
  open: "text-severity-high bg-severity-high/10 border-severity-high/30",
  failed: "text-severity-critical bg-severity-critical/10 border-severity-critical/30",
  rejected: "text-severity-critical bg-severity-critical/10 border-severity-critical/30",
  not_bootstrapped: "text-severity-medium bg-severity-medium/10 border-severity-medium/30",
  expired: "text-slate-400 bg-slate-400/10 border-slate-500/30",
  closed: "text-slate-400 bg-slate-400/10 border-slate-500/30",
  subscribed: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
};
