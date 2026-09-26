import type { KeyboardEvent } from "react";

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/**
 * Spread onto a clickable `<tr>`/`<motion.tr>` alongside its existing `onClick`
 * so the row opens on Enter/Space too, not just a mouse click.
 */
export function clickableRowProps(onActivate: () => void) {
  return {
    tabIndex: 0,
    role: "button" as const,
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onActivate();
      }
    },
  };
}

/**
 * Parse an API timestamp.
 *
 * The API records UTC and returns it without a zone designator
 * ("2026-09-26T10:41:00"), which `new Date()` reads as *local* time. In a UTC+1
 * zone every row the server had just written read "1h ago" instead of "just
 * now" — in the notification bell and the audit trail alike.
 */
export function parseTimestamp(value: string): Date {
  const trimmed = value.trim();
  const bare = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(trimmed);
  return new Date(bare ? `${trimmed.replace(" ", "T")}Z` : trimmed);
}

export function timeAgo(iso: string | null): string {
  if (!iso) return "---";
  const then = parseTimestamp(iso).getTime();
  if (Number.isNaN(then)) return "---";
  const diff = Date.now() - then;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return parseTimestamp(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "---";
  return parseTimestamp(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function titleCase(s: string | null | undefined): string {
  if (!s) return "";
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Backend values arrive as snake_case; render them as normal words. Unlike
 *  titleCase, the rest of the casing is kept and only the first word is
 *  capitalized, so "security_data_storage" reads as "Security data storage". */
export function humanize(s: string | null | undefined): string {
  if (!s) return "";
  const spaced = String(s).replace(/_/g, " ").replace(/\s+/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
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
  resolved: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  subscribed: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
};
