import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Building2, ShieldCheck, Database, EyeOff } from "lucide-react";
import { useStore } from "@/lib/store";

export default function Register() {
  const { register } = useStore();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [country, setCountry] = useState("NG");
  const [slug, setSlug] = useState("");
  const [industry, setIndustry] = useState("other");
  const [secondaryEmail, setSecondaryEmail] = useState("");
  const [primaryContact, setPrimaryContact] = useState({ title: "mr", name: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateSlug = (n: string) => n.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'') + '-' + Math.random().toString(36).slice(2,12);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 2) return setError("Enter your company name");
    if (!email.includes("@")) return setError("Enter a valid company email");
    if (password.length < 8) return setError("Password must be at least 8 characters");
    if (!slug.trim()) return setError("Slug required");
    if (!secondaryEmail.includes("@")) return setError("Enter secondary email");
    if (!primaryContact.name.trim()) return setError("Enter primary contact name");
    setBusy(true);
    try {
      await register(name.trim(), email.trim(), password, country, slug.trim(), industry, secondaryEmail.trim(), primaryContact);
      navigate("/setup");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-grid-faint bg-grid [mask-image:radial-gradient(ellipse_70%_60%_at_50%_40%,black,transparent)]" />
        <div className="absolute left-1/4 top-1/4 h-[420px] w-[600px] rounded-full bg-phantix-600/20 blur-[130px]" />
      </div>

      <div className="relative grid w-full max-w-5xl grid-cols-1 items-center gap-10 lg:grid-cols-2">
        {/* Pitch */}
        <motion.div initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7 }} className="hidden lg:block">
          <img src="/logo-transparent.png" alt="" className="h-16 w-16 object-contain" />
          <h1 className="mt-6 font-display text-4xl font-bold leading-tight tracking-tight text-white">
            Stand up your security tenant in minutes
          </h1>
          <p className="mt-4 max-w-md text-[15px] leading-7 text-slate-400">
            Register the company, accept the privacy model, verify your email — then connect your own
            security database and invite your operators.
          </p>
          <div className="mt-8 space-y-3.5">
            {[
              { icon: <ShieldCheck size={16} />, text: "Privacy-first: security data lives only in your dedicated database" },
              { icon: <Database size={16} />, text: "You bring the database — Phantix writes nothing anywhere else" },
              { icon: <EyeOff size={16} />, text: "Production business data is never read, copied, or stored" },
            ].map((f) => (
              <div key={f.text} className="flex items-center gap-3 text-sm text-slate-300">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-phantix-800/70 text-gold-400">{f.icon}</span>
                {f.text}
              </div>
            ))}
          </div>
        </motion.div>

        {/* Form */}
        <motion.div initial={{ opacity: 0, y: 26 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65, delay: 0.1 }}>
          <div className="card p-7">
            <div className="mb-5 flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold-400/15 text-gold-400">
                <Building2 size={19} />
              </span>
              <div>
                <h2 className="font-display text-lg font-bold text-white">Register organization</h2>
                <p className="text-xs text-slate-500">POST /organizations/register</p>
              </div>
            </div>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="label">Company name</label>
                 <input className="input" value={name} onChange={(e) => { setName(e.target.value); if(!slug) setSlug(generateSlug(e.target.value)); }} placeholder="Your Company" />
              </div>
               <div>
                 <label className="label">Primary sign-in email</label>
                 <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@yourcompany.com" />
                 <p className="mt-1.5 text-[11px] text-slate-500">Verified by email OTP during setup — phone OTP is not used.</p>
               </div>
               <div className="grid grid-cols-2 gap-3">
                 <div>
                   <label className="label">Slug (auto)</label>
                   <input className="input" value={slug} readOnly />
                 </div>
                 <div>
                   <label className="label">Industry</label>
                   <select className="input" value={industry} onChange={(e) => setIndustry(e.target.value)}>
                     {['financial_services','fintech','banking','insurance','healthcare','technology','telecommunications','energy','manufacturing','retail','ecommerce','education','government','defense','legal','real_estate','logistics','media','hospitality','agriculture','other'].map(i=><option key={i} value={i}>{i}</option>)}
                   </select>
                 </div>
               </div>
               <div className="grid grid-cols-2 gap-3">
                 <div>
                   <label className="label">Secondary email</label>
                   <input className="input" value={secondaryEmail} onChange={(e) => setSecondaryEmail(e.target.value)} placeholder="ops@yourcompany.com" />
                 </div>
                 <div>
                   <label className="label">Primary contact</label>
                   <div className="flex gap-2">
                     <select className="input w-20" value={primaryContact.title} onChange={e=>setPrimaryContact({...primaryContact,title:e.target.value})}>
                       {['mr','mrs','ms','dr','prof','eng','chief','other'].map(t=><option key={t} value={t}>{t}</option>)}
                     </select>
                     <input className="input" placeholder="Full name" value={primaryContact.name} onChange={e=>setPrimaryContact({...primaryContact,name:e.target.value})} />
                   </div>
                 </div>
               </div>
               <div className="grid grid-cols-2 gap-3">
                 <div>
                   <label className="label">Password</label>
                   <input type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="min. 8 characters" />
                 </div>
                 <div>
                   <label className="label">Country</label>
                   <select className="input" value={country} onChange={(e) => setCountry(e.target.value)}>
                     <option value="NG">Nigeria</option>
                     <option value="GH">Ghana</option>
                     <option value="KE">Kenya</option>
                     <option value="ZA">South Africa</option>
                     <option value="GB">United Kingdom</option>
                     <option value="US">United States</option>
                   </select>
                 </div>
               </div>
              {error && <p className="text-sm text-severity-critical">{error}</p>}
              <button className="btn-primary w-full !py-3" disabled={busy}>
                {busy ? "Creating tenant…" : "Create organization"} <ArrowRight size={15} />
              </button>
              <p className="text-center text-xs text-slate-500">
                Already registered? <Link to="/login" className="text-gold-400 hover:text-gold-300">Sign in</Link>
              </p>
            </form>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
