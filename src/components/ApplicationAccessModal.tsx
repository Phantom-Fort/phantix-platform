import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Modal } from "@/components/ui";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import type { OrgUser } from "@/lib/types";

interface AppMeta {
  key: string;
  label: string;
  tagline: string;
  permissions: string[];
}
interface RoleMeta {
  key: string;
  name: string;
  permissions: string[];
}

/**
 * Assign a role per application (Core / Attack / Defend / Code) for one user.
 *
 * The role chosen for an application decides what the person may do *in that
 * application*; an application left on "Use global role" falls back to the
 * user's org-wide role. The permissions shown are the intersection of the role's
 * grants with the permissions the application owns.
 */
export default function ApplicationAccessModal({
  user,
  onClose,
}: {
  user: OrgUser | null;
  onClose: () => void;
}) {
  const { toast } = useStore();
  const [apps, setApps] = useState<AppMeta[]>([]);
  const [roles, setRoles] = useState<RoleMeta[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    setLoading(true);
    setMapping({ ...((user.application_roles as Record<string, string>) || {}) });
    Promise.all([
      api.get<{ applications?: AppMeta[] }>("/org-users/applications").catch(() => null),
      api.get<{ items?: RoleMeta[] }>("/org-users/roles").catch(() => null),
    ])
      .then(([a, r]) => {
        if (!alive) return;
        setApps(Array.isArray(a?.applications) ? a!.applications! : []);
        setRoles(Array.isArray(r?.items) ? r!.items! : []);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [user]);

  const globalRole = user?.role || "viewer";

  const granted = (app: AppMeta, roleKey: string): string[] => {
    const role = roles.find((x) => x.key === roleKey);
    if (!role) return [];
    return role.permissions.filter((p) => app.permissions.includes(p));
  };

  async function save() {
    if (!user) return;
    setSaving(true);
    try {
      const clean: Record<string, string> = {};
      for (const [k, v] of Object.entries(mapping)) if (v) clean[k] = v;
      await api.put(`/org-users/${user.id}/application-roles`, { application_roles: clean });
      toast("success", "Application access updated", `Roles saved for ${user.full_name}.`);
      onClose();
    } catch (e) {
      toast("error", "Could not save", e instanceof Error ? e.message : "");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={!!user} onClose={onClose} title={`Application access · ${user?.full_name || ""}`}>
      {loading ? (
        <div className="flex items-center gap-3 py-8 text-sm text-slate-400">
          <Loader2 size={16} className="animate-spin" /> Loading…
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-xs leading-5 text-slate-400">
            Give this person a role in each application. Their{" "}
            <strong className="text-slate-200">global role</strong> (
            <span className="font-mono text-gold-300">{globalRole}</span>) applies wherever no override is set,
            and creates the permissions shown.
          </p>

          {apps.map((app) => {
            const selected = mapping[app.key] || "";
            const effectiveRole = selected || globalRole;
            const perms = granted(app, effectiveRole);
            return (
              <div
                key={app.key}
                className="rounded-lg border border-phantix-700/40 bg-phantix-900/40 p-3.5"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-100">{app.label}</p>
                    <p className="text-[13px] text-slate-500">{app.tagline}</p>
                  </div>
                  <select
                    className="input !w-48 !py-2 !text-xs"
                    value={selected}
                    onChange={(e) =>
                      setMapping((m) => ({ ...m, [app.key]: e.target.value }))
                    }
                  >
                    <option value="">Use global role ({globalRole})</option>
                    {roles.map((r) => (
                      <option key={r.key} value={r.key}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {perms.length > 0 ? (
                    perms.map((p) => (
                      <span
                        key={p}
                        className="chip border-phantix-700 bg-phantix-850 font-mono text-[12px] text-slate-400"
                      >
                        {p}
                      </span>
                    ))
                  ) : (
                    <span className="text-[13px] text-slate-600">
                      {app.key === "core"
                        ? "Core is always available to active users."
                        : "No access with this role."}
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          <div className="flex gap-3 pt-1">
            <button className="btn-primary flex-1" disabled={saving} onClick={() => void save()}>
              {saving ? "Saving…" : "Save application access"}
            </button>
            <button className="btn-ghost" onClick={onClose}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
