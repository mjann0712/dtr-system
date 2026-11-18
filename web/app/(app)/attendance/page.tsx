"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Page } from "@/components/AppShell";
import { useApp } from "@/lib/store";
import { days, dur } from "@/lib/format";
import { dtrWorkbook, saveBlob } from "@/lib/exports";
import type { EmpResult } from "@/lib/types";
import { IconDown } from "@/components/Icons";

const COLS: [string, string, (e: EmpResult) => number | string, boolean?][] = [
  ["name", "Employee", (e) => e.name], ["dept", "Dept", (e) => e.dept],
  ["present", "Present", (e) => e.totals.present, true], ["absent", "Absent", (e) => e.totals.absent, true],
  ["worked", "Hours", (e) => e.totals.worked, true], ["lateCount", "Times late", (e) => e.totals.lateCount, true],
  ["late", "Late", (e) => e.totals.late, true], ["early", "Undertime", (e) => e.totals.early, true], ["inc", "Incomplete", (e) => e.totals.incomplete, true],
];

export default function Attendance() {
  const router = useRouter();
  const { view, settings, dtr, busy, toast } = useApp();
  const [sort, setSort] = useState<{ k: string; dir: 1 | -1 }>({ k: "dept", dir: 1 });
  const rows = useMemo(() => {
    const f = COLS.find((c) => c[0] === sort.k)![2];
    return [...view].sort((a, b) => { const x = f(a), y = f(b); const c = typeof x === "string" ? x.localeCompare(y as string) : (x as number) - (y as number); return (c || a.name.localeCompare(b.name)) * sort.dir; });
  }, [view, sort]);
  const T = view.reduce((a, e) => ({ w: a.w + e.totals.worked, l: a.l + e.totals.late, a: a.a + e.totals.absent }), { w: 0, l: 0, a: 0 });

  async function excel() {
    if (!settings || !dtr || !view.length) return;
    busy("Building Excel file…");
    try { saveBlob(`DTR_${dtr.period}.xlsx`, await dtrWorkbook(view, settings, dtr.from, dtr.to)); } catch (e) { toast((e as Error).message); } finally { busy(null); }
  }
  return (
    <Page title="Attendance" filters needsData>
      <div className="mb-3 flex flex-wrap items-end gap-4">
        <div className="flex-1"><h2 className="text-lg font-bold">Attendance summary</h2>
          <p className="muted">{view.length} employees · {dur(T.w)} hours · {dur(T.l)} late · {days(T.a)} days absent</p></div>
        <button className="btn" onClick={excel}><IconDown width={16} height={16} />Download Excel</button>
      </div>
      <div className="max-h-[calc(100vh-300px)] overflow-auto">
        <table className="ruled">
          <thead><tr>{COLS.map(([k, l, , n]) => (
            <th key={k} className={`cursor-pointer select-none ${n ? "num" : ""}`} aria-sort={sort.k === k ? (sort.dir > 0 ? "ascending" : "descending") : "none"}
              onClick={() => setSort((s) => ({ k, dir: s.k === k ? (s.dir === 1 ? -1 : 1) : n ? -1 : 1 }))}>{l}{sort.k === k ? (sort.dir > 0 ? " ↑" : " ↓") : ""}</th>
          ))}</tr></thead>
          <tbody>
            {rows.map((e) => { const t = e.totals; const z = (v: number) => (v ? "" : "zero"); return (
              <tr key={e.ac} className="go" onClick={() => router.push(`/dtr?ac=${encodeURIComponent(e.ac)}`)}>
                <td><b className="block font-semibold">{e.name}</b><small className="text-xs text-ink-3">AC# {e.ac}{!e.inMaster && <span className="text-maroon"> · not linked to a record</span>}</small></td>
                <td>{e.dept}</td><td className="num">{t.present}</td><td className={`num ${z(t.absent)}`}>{days(t.absent)}</td>
                <td className="num">{dur(t.worked)}</td><td className={`num ${z(t.lateCount)}`}>{t.lateCount}</td>
                <td className={`num ${t.late ? "hot" : "zero"}`}>{dur(t.late)}</td><td className={`num ${z(t.early)}`}>{dur(t.early)}</td><td className={`num ${z(t.incomplete)}`}>{t.incomplete}</td>
              </tr>); })}
            {!rows.length && <tr><td colSpan={9} className="py-10 text-center text-ink-3">No employees match these filters.</td></tr>}
          </tbody>
        </table>
      </div>
    </Page>
  );
}
