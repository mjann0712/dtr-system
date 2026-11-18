"use client";
import { useCallback, useEffect, useState } from "react";
import { Page } from "@/components/AppShell";
import { useApp } from "@/lib/store";
import { api } from "@/lib/api";
import type { User } from "@/lib/types";

export default function Users() {
  const { user, toast, busy, confirm } = useApp();
  const [list, setList] = useState<User[]>([]);
  const [f, setF] = useState({ name: "", email: "", password: "", role: "staff" });
  const load = useCallback(async () => { try { setList((await api<{ data: User[] }>("/users")).data); } catch (e) { toast((e as Error).message); } }, [toast]);
  useEffect(() => { if (user?.role === "admin") load(); }, [user, load]);
  if (user && user.role !== "admin") return <Page title="User accounts"><p className="muted">Only administrators can manage user accounts.</p></Page>;
  return (
    <Page title="User accounts">
      <p className="muted mb-4">Administrators manage accounts and settings. Staff import files, edit employee records and download reports.</p>
      <table className="ruled mb-10"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th /></tr></thead>
        <tbody>{list.map((u) => (
          <tr key={u.id}><td className="font-semibold">{u.name}</td><td>{u.email}</td><td className="capitalize">{u.role}</td>
            <td className="text-right">{u.id !== user?.id && <button className="btn btn-sm" onClick={async () => {
              if (!(await confirm({ title: `Delete ${u.name}?`, body: <p>{u.email} will no longer be able to sign in.</p>, ok: "Delete account", danger: true }))) return;
              try { await api(`/users/${u.id}`, { method: "DELETE" }); toast("Account deleted."); load(); } catch (e) { toast((e as Error).message); }
            }}>Delete</button>}</td></tr>))}</tbody></table>
      <h2 className="mb-3 text-lg font-bold">Add an account</h2>
      <form className="grid max-w-3xl gap-3.5 sm:grid-cols-2" onSubmit={async (e) => {
        e.preventDefault(); busy("Saving…");
        try { await api("/users", { body: f }); toast(`${f.name} added.`); setF({ name: "", email: "", password: "", role: "staff" }); load(); }
        catch (err) { toast((err as Error).message); } finally { busy(null); }
      }}>
        <div className="field"><label htmlFor="un">Name</label><input id="un" required className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div className="field"><label htmlFor="ue">Email</label><input id="ue" type="email" required className="input" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
        <div className="field"><label htmlFor="up">Temporary password <span className="font-normal text-ink-3">at least 8 characters</span></label><input id="up" type="password" required minLength={8} className="input" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></div>
        <div className="field"><label htmlFor="ur">Role</label><select id="ur" className="input" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}><option value="staff">Staff</option><option value="admin">Administrator</option></select></div>
        <div><button className="btn btn-primary" type="submit">Add account</button></div>
      </form>
    </Page>
  );
}
