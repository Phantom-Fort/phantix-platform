import React, { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  LayoutDashboard, Building2, Users, Database, Wrench, CreditCard, LifeBuoy,
  ScrollText, LogOut, Lock, Unlock, ChevronDown, Timer, KeyRound, Rocket,
  RotateCcw, ShieldCheck, Sparkles, BellRing,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { APP_URL } from "@/lib/links";
import { cx } from "@/lib/utils";

const navSections: { label: string; items: { to: string; label: string; icon: React.ReactNode }[] }[] = [
  {
    label: "Overview",
    items: [{ to: "/dashboard", label: "Dashboard", icon: <LayoutDashboard size={17} /> }],
  },
  {
    label: "Organization",
    items: [
      { to: "/identity", label: "Identity & Keys", icon: <KeyRound size={17} /> },
      { to: "/companies", label: "Companies", icon: <Building2 size={17} /> },
      { to: "/users", label: "People & Control", icon: <Users size={17} /> },
      { to: "/connections", label: "Security Database", icon: <Database size={17} /> },
    ],
  },
  {
    label: "Commerce",
    items: [
      { to: "/tools", label: "Tool Catalog", icon: <Wrench size={17} /> },
      { to: "/billing", label: "Billing", icon: <CreditCard size={17} /> },
      { to: "/support", label: "Support", icon: <LifeBuoy size={17} /> },
    ],
  },
  {
    label: "Governance",
    items: [
      { to: "/ai", label: "AI settings", icon: <Sparkles size={17} /> },
      { to: "/alerts", label: "Alerts", icon: <BellRing size={17} /> },
      { to: "/audit", label: "Audit Trail", icon: <ScrollText size={17} /> },
    ],
  },
];

function OperateCountdown({ expiresAt }: { expiresAt: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, Math.floor((expiresAt - now) / 1000));
  return (
    <span className="inline-flex items-center gap-1 font-mono text-[11px] text-gold-300">
      <Timer size={12} />
      {String(Math.floor(left / 60)).padStart(2, "0")}:{String(left % 60).padStart(2, "0")}
    </span>
  );
}

export default function Layout() {
  const { session, state, operate, lockOperate, logout, securityDbReady, resetDemo, toast, requireDualControl } = useStore();
  const [userMenu, setUserMenu] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const dc = state.dualControl;
  const initiator = state.users.find((u) => u.id === dc.initiator_user_id);
  const authorizer = state.users.find((u) => u.id === dc.authorizer_user_id);

  if (location.pathname.startsWith("/setup")) return <Outlet />;
  if (!session?.authenticated) return <Outlet />;

  return (
    <div className="flex min-h-screen">
      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside className="fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col border-r border-phantix-700/40 bg-phantix-950/85 backdrop-blur-xl">
        <div className="flex items-center gap-3 px-5 pb-5 pt-5">
          <img src="/logo-transparent.png" alt="Phantix" className="h-9 w-9 object-contain" />
          <div>
            <p className="font-display text-[15px] font-bold leading-tight text-white">Phantix</p>
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-gold-400">Platform</p>
          </div>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
          {navSections.map((section) => (
            <div key={section.label}>
              <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">{section.label}</p>
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <NavLink key={item.to} to={item.to} className={({ isActive }) => cx("nav-item", isActive && "active")}>
                    {item.icon}
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Command Centre link */}
        <div className="px-3 pb-3">
          <a
            href={`${APP_URL}/dashboard`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 rounded-xl border border-gold-400/25 bg-gradient-to-r from-gold-400/10 to-transparent p-3 transition-all hover:border-gold-400/50 hover:shadow-glow"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold-400/15 text-gold-400">
              <Rocket size={16} />
            </span>
            <span>
              <span className="block text-xs font-semibold text-gold-300">Command Centre</span>
              <span className="block text-[10px] text-slate-500">Launch the product app</span>
            </span>
          </a>
        </div>

        {/* Dual-control widget */}
        <div className="border-t border-phantix-700/40 p-3">
          <div className="rounded-xl bg-phantix-900/70 border border-phantix-700/40 p-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Dual control</p>
              {operate.unlocked ? <Unlock size={13} className="text-emerald-400" /> : <Lock size={13} className="text-slate-500" />}
            </div>
            {operate.unlocked ? (
              <div className="mt-2 space-y-1.5">
                <p className="text-xs font-medium text-emerald-300">Operating as {operate.actingUser}</p>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] capitalize text-slate-500">{operate.actingRole}</span>
                  {operate.expiresAt && <OperateCountdown expiresAt={operate.expiresAt} />}
                </div>
                <button onClick={lockOperate} className="mt-1 w-full rounded-lg bg-phantix-700/50 py-1.5 text-[11px] font-medium text-slate-300 hover:bg-phantix-700/80">
                  Lock session
                </button>
              </div>
            ) : (
              <div className="mt-2">
                {dc.configured ? (
                  <>
                    <p className="text-[11px] leading-4 text-slate-500">
                      {(initiator?.full_name || "Initiator").split(" ")[0]} + {(authorizer?.full_name || "Authorizer").split(" ")[0]} assigned
                    </p>
                    <button
                      onClick={() => void requireDualControl("Unlock operate mode to perform protected mutations.")}
                      className="btn-primary mt-2 w-full !px-3 !py-1.5 !text-[11px]"
                    >
                      <Unlock size={12} /> Unlock operate
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-[11px] leading-4 text-slate-500">Not configured — bootstrap required</p>
                    <button onClick={() => navigate("/users")} className="btn-secondary mt-2 w-full !px-3 !py-1.5 !text-[11px]">
                      <ShieldCheck size={12} /> Set up dual control
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────── */}
      <div className="ml-[248px] flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-phantix-700/40 bg-phantix-950/80 px-6 py-3 backdrop-blur-xl">
          <div className="flex items-center gap-2.5">
            <span className="font-display text-sm font-semibold text-slate-200">{state.org.name}</span>
            <span className="chip border-phantix-600/50 bg-phantix-800/60 font-mono text-slate-400">{state.org.slug}</span>
          </div>

          <div className="ml-auto flex items-center gap-2.5">
            {securityDbReady ? (
              <span className="chip border-emerald-400/30 bg-emerald-400/10 text-emerald-300">
                <Database size={12} /> Security DB · ready
              </span>
            ) : (
              <button onClick={() => navigate("/connections")} className="chip border-severity-medium/40 bg-severity-medium/10 text-severity-medium transition-colors hover:bg-severity-medium/20">
                <Database size={12} /> Security DB · not connected
              </button>
            )}
            <span className="chip border-phantix-600/50 bg-phantix-800/60 text-slate-300">{state.org.plan} plan</span>

            <div className="relative">
              <button
                onClick={() => setUserMenu((v) => !v)}
                className="flex items-center gap-2.5 rounded-xl border border-phantix-700/50 bg-phantix-900/60 py-1.5 pl-1.5 pr-2.5 hover:border-phantix-500/50"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-gold-400 to-gold-600 font-display text-xs font-bold text-phantix-950">
                  {(session?.email ?? "A").slice(0, 1).toUpperCase()}
                </span>
                <span className="text-left">
                  <span className="block text-xs font-semibold leading-tight text-slate-200">Company account</span>
                  <span className="block max-w-[150px] truncate text-[10px] leading-tight text-slate-500">{session?.email}</span>
                </span>
                <ChevronDown size={14} className="text-slate-500" />
              </button>
              <AnimatePresence>
                {userMenu && (
                  <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} className="absolute right-0 top-full mt-2 w-56 overflow-hidden rounded-xl glass-bright shadow-card">
                    <div className="border-b border-phantix-700/40 px-4 py-3">
                      <p className="text-sm font-semibold text-slate-100">{state.org.name}</p>
                      <p className="text-xs text-slate-500 font-mono">type=access · company JWT</p>
                    </div>
                    <div className="p-1.5">
                      {import.meta.env.VITE_API_BASE ? null : (
                      <button
                        onClick={() => {
                          resetDemo();
                          toast("info", "Demo reset", "Tenant state cleared — start the journey again.");
                          setUserMenu(false);
                          navigate("/dashboard");
                        }}
                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-phantix-700/50"
                      >
                        <RotateCcw size={15} /> Reset demo data
                      </button>
                      )}
                      <button
                        onClick={() => {
                          logout();
                          navigate("/login");
                        }}
                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-severity-critical hover:bg-severity-critical/10"
                      >
                        <LogOut size={15} /> Sign out
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        <main className="flex-1 px-6 py-6 lg:px-8">
          <Outlet />
        </main>

        <footer className="border-t border-phantix-700/30 px-8 py-4 text-[11px] text-slate-600 flex items-center justify-between">
          <span>Phantix Platform · organization management — keys and people live here; product operations live in the Command Centre</span>
          <span className="font-mono">api/v1 · tenant #{state.org.id}</span>
        </footer>
      </div>
    </div>
  );
}
