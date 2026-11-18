"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { api, getToken, setToken } from "./api";
import type { DtrResponse, EmpResult, Period, Settings, User } from "./types";

interface Filters { inst: string; dept: string; q: string; }
interface ConfirmOpts { title: string; body: ReactNode; ok?: string; danger?: boolean; }

interface Ctx {
  user: User | null; settings: Settings | null; periods: Period[]; curPeriod: string; dtr: DtrResponse | null;
  ready: boolean; filters: Filters; setFilters: (f: Partial<Filters>) => void;
  results: EmpResult[]; view: EmpResult[];
  openPeriod: (p: string, from?: string, to?: string) => Promise<void>;
  refreshPeriods: () => Promise<Period[]>; refreshDtr: () => Promise<void>;
  saveSettings: (s: Settings) => Promise<void>;
  toast: (m: string) => void; busy: (text: string | null) => void;
  confirm: (o: ConfirmOpts) => Promise<boolean>; logout: () => Promise<void>;
}
const AppCtx = createContext<Ctx | null>(null);
export const useApp = () => { const c = useContext(AppCtx); if (!c) throw new Error("useApp outside provider"); return c; };

export function matchEmp(e: EmpResult, q: string) {
  if (!q) return true;
  const m = q.match(/\(([^)]+)\)\s*$/);
  return m ? e.ac.toLowerCase() === m[1] : e.name.toLowerCase().includes(q) || e.ac.toLowerCase() === q;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [curPeriod, setCurPeriod] = useState("");
  const [dtr, setDtr] = useState<DtrResponse | null>(null);
  const [ready, setReady] = useState(false);
  const [filters, setF] = useState<Filters>({ inst: "", dept: "", q: "" });
  const [toastMsg, setToastMsg] = useState("");
  const [busyText, setBusyText] = useState<string | null>(null);
  const [dlg, setDlg] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null);
  const tRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toast = useCallback((m: string) => {
    setToastMsg(m); if (tRef.current) clearTimeout(tRef.current);
    tRef.current = setTimeout(() => setToastMsg(""), 3600);
  }, []);
  const busy = useCallback((t: string | null) => setBusyText(t), []);
  const confirm = useCallback((o: ConfirmOpts) => new Promise<boolean>((resolve) => setDlg({ ...o, resolve })), []);
  const setFilters = useCallback((f: Partial<Filters>) => setF((p) => ({ ...p, ...f })), []);

  const openPeriod = useCallback(async (p: string, from?: string, to?: string) => {
    if (!p) { setDtr(null); setCurPeriod(""); return; }
    busy("Loading records…");
    try {
      const qs = from && to ? `?from=${from}&to=${to}` : "";
      const d = await api<DtrResponse>(`/periods/${p}/dtr${qs}`);
      setDtr(d); setCurPeriod(p);
    } catch (e) { toast((e as Error).message); } finally { busy(null); }
  }, [busy, toast]);

  const refreshPeriods = useCallback(async () => {
    const r = await api<{ data: Period[] }>("/periods"); setPeriods(r.data); return r.data;
  }, []);
  const refreshDtr = useCallback(async () => {
    if (curPeriod) await openPeriod(curPeriod, dtr?.from, dtr?.to);
  }, [curPeriod, dtr?.from, dtr?.to, openPeriod]);

  const saveSettings = useCallback(async (s: Settings) => {
    const saved = await api<Settings>("/settings", { method: "PUT", body: s });
    setSettings(saved);
  }, []);

  const logout = useCallback(async () => {
    try { await api("/logout", { method: "POST" }); } catch { /* token may already be gone */ }
    setToken(null); router.replace("/login");
  }, [router]);

  useEffect(() => {
    if (!getToken()) { router.replace("/login"); return; }
    (async () => {
      try {
        const me = await api<{ user: User }>("/me"); setUser(me.user);
        const [s, ps] = await Promise.all([api<Settings>("/settings"), api<{ data: Period[] }>("/periods")]);
        setSettings(s); setPeriods(ps.data);
        if (ps.data[0]) await openPeriod(ps.data[0].period);
      } catch (e) { toast((e as Error).message); }
      finally { setReady(true); }
    })();
  }, [router, openPeriod, toast]);

  const results = useMemo(() => dtr?.results ?? [], [dtr]);
  const view = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return results.filter((e) => (!filters.inst || e.inst === filters.inst) && (!filters.dept || e.dept === filters.dept) && matchEmp(e, q));
  }, [results, filters]);

  const value: Ctx = { user, settings, periods, curPeriod, dtr, ready, filters, setFilters, results, view, openPeriod, refreshPeriods, refreshDtr, saveSettings, toast, busy, confirm, logout };

  return (
    <AppCtx.Provider value={value}>
      {children}
      <div aria-live="polite" className={`pointer-events-none fixed bottom-6 left-1/2 z-[90] -translate-x-1/2 rounded-xl bg-ink px-4 py-2.5 text-[13px] text-white transition-opacity ${toastMsg ? "opacity-100" : "opacity-0"}`}>{toastMsg}</div>
      {busyText && (
        <div className="fixed inset-0 z-[95] grid place-items-center bg-white/65">
          <div className="flex items-center gap-3 rounded-xl bg-white px-5 py-4 font-semibold shadow-lg">
            <span className="size-[18px] animate-spin rounded-full border-[3px] border-primary-soft border-t-primary" />{busyText}
          </div>
        </div>
      )}
      {dlg && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-[80] flex items-start justify-center overflow-auto bg-[rgba(15,36,26,.45)] px-4 py-16" onClick={(e) => { if (e.target === e.currentTarget) { dlg.resolve(false); setDlg(null); } }}>
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl">
            <h2 className="mb-2 text-[19px] font-bold">{dlg.title}</h2>
            <div className="leading-relaxed text-ink-2">{dlg.body}</div>
            <div className="mt-6 flex justify-end gap-2.5">
              <button className="btn" onClick={() => { dlg.resolve(false); setDlg(null); }}>Cancel</button>
              <button autoFocus className={`btn ${dlg.danger ? "btn-danger" : "btn-primary"}`} onClick={() => { dlg.resolve(true); setDlg(null); }}>{dlg.ok || "OK"}</button>
            </div>
          </div>
        </div>
      )}
    </AppCtx.Provider>
  );
}
