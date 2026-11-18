"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, setToken } from "@/lib/api";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [err, setErr] = useState(""); const [loading, setLoading] = useState(false);
  return (
    <main className="grid min-h-screen lg:grid-cols-[1fr_1.1fr]">
      <section className="hidden flex-col justify-between bg-forest p-12 text-white lg:flex">
        <Link href="/" className="flex items-center gap-3 text-white no-underline"><span className="grid size-10 place-items-center rounded-[9px] bg-gold text-sm font-bold text-forest">DTR</span><b className="text-lg">DTR System</b></Link>
        <div><p className="max-w-md text-3xl font-bold leading-tight">Time-clock punches in. Ready-to-sign DTRs out.</p>
          <p className="mt-3 max-w-md text-mint-2">Sign in with the account HR gave you. Ask your administrator if you need one.</p></div>
        <p className="text-sm text-mint">Human Resources</p>
      </section>
      <section className="grid place-items-center p-6">
        <form className="w-full max-w-sm" onSubmit={async (e) => {
          e.preventDefault(); setErr(""); setLoading(true);
          try { const r = await api<{ token: string }>("/login", { body: { email, password } }); setToken(r.token); router.replace("/dashboard"); }
          catch (er) { setErr((er as Error).message); setLoading(false); }
        }}>
          <h1 className="text-2xl font-bold">Sign in</h1>
          <p className="muted mb-6 mt-1">Use your HR office account.</p>
          <div className="field mb-4"><label htmlFor="em">Email</label><input id="em" type="email" autoComplete="username" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="field mb-5"><label htmlFor="pw">Password</label><input id="pw" type="password" autoComplete="current-password" required className="input" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          {err && <p className="mb-4 text-[13.5px] text-maroon" role="alert">{err}</p>}
          <button type="submit" className="btn btn-primary w-full py-2.5 text-[15px]" disabled={loading}>{loading ? "Signing in…" : "Sign in"}</button>
        </form>
      </section>
    </main>
  );
}
