import React, { useState } from "react";
import { motion } from "framer-motion";
import { LifeBuoy, Plus, MessageSquare } from "lucide-react";
import { PageHeader, Card, StatusBadge, Modal, EmptyState } from "@/components/ui";
import { useStore } from "@/lib/store";
import { timeAgo } from "@/lib/utils";

export default function Support() {
  const { state, createTicket, toast } = useStore();
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [priority, setPriority] = useState("normal");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <div className="mx-auto max-w-[1000px]">
      <PageHeader
        title="Support"
        description="Tickets route to the Phantix support desk. Quote your tenant ID and slug for faster resolution."
        actions={<button className="btn-primary" onClick={() => setOpen(true)}><Plus size={15} /> New ticket</button>}
      />

      {state.tickets.length === 0 ? (
        <Card>
          <EmptyState
            icon={<LifeBuoy size={22} />}
            title="No tickets yet"
            body="We're here when you need us — setup help, connection issues, or billing questions."
            action={<button className="btn-primary" onClick={() => setOpen(true)}><Plus size={15} /> Open your first ticket</button>}
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {state.tickets.map((t, i) => (
            <motion.div key={t.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card hover className="!p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-phantix-800/70 text-gold-400">
                    <MessageSquare size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-100">#{t.id} · {t.subject}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{t.messages.length} message{t.messages.length !== 1 ? "s" : ""} · opened {timeAgo(t.created_at)}</p>
                  </div>
                  <span className="chip border-phantix-600/50 bg-phantix-800/60 text-slate-400 capitalize">{t.priority}</span>
                  <StatusBadge status={t.status} />
                </div>
                <div className="mt-3 rounded-xl border border-phantix-700/40 bg-phantix-950/50 p-3.5 text-xs leading-5 text-slate-400">
                  {t.messages[0].body}
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="New support ticket">
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            await createTicket(subject, priority, body);
            setBusy(false);
            setOpen(false);
            setSubject(""); setBody("");
            toast("success", "Ticket submitted", "The support team will reply shortly.");
          }}
        >
          <div>
            <label className="label">Subject</label>
            <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Short summary" required />
          </div>
          <div>
            <label className="label">Priority</label>
            <select className="input" value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option>normal</option><option>high</option><option>low</option>
            </select>
          </div>
          <div>
            <label className="label">Details</label>
            <textarea className="input min-h-[110px] resize-none" value={body} onChange={(e) => setBody(e.target.value)} placeholder={`Tenant #${state.org.id} (${state.org.slug})\n\nWhat happened, what you expected…`} required />
          </div>
          <button className="btn-primary w-full" disabled={busy}>{busy ? "Submitting…" : "Submit ticket"}</button>
        </form>
      </Modal>
    </div>
  );
}
