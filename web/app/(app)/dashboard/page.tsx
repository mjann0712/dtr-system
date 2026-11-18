"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Page } from "@/components/AppShell";
import { useApp } from "@/lib/store";
import { days, dur, mdy, monthLabel } from "@/lib/format";
import type { EmpResult } from "@/lib/types";

type Mode = "late" | "absent" | "early";
const KEY: Record<Mode, (e: EmpResult) => number> = { late: (e) => e.totals.late, absent: (e) => e.totals.absent, early: (e) => e.totals.early };
const TITLE: Record<Mode, string> = { late: "Most late this period", absent: "Most absences this period", early: "Most undertime this period" };

export default function Dashboard() {
  const router = useRouter();
  const { view, curPeriod, setFilters } = useApp();
  const [mode, setMode] = useState<Mode>("late");

  const T = useMemo(() => view.reduce((a, e) => { const t = e.totals; a.w += t.worked; a.l += t.late; a.lc += t.lateCount; a.e += t.early; a.a += t.absent; a.i += t.incomplete; a.wd += t.workdays; return a; }, { w: 0, l: 0, lc: 0, e: 0, a: 0, i: 0, wd: 0 }), [view]);
  const rate = T.wd ? Math.max(0, Math.min(100, ((T.wd - T.a) / T.wd) * 100)) : 0;
  const top = useMemo(() => view.filter((e) => KEY[mode](e) > 0).sort((a, b) => KEY[mode](b) - KEY[mode](a) || a.name.localeCompare(b.name)).slice(0, 10), [view, mode]);
  const mx = Math.max(1, ...top.map(KEY[mode]));
  const byDept = useMemo(() => {
    const m = new Map<string, { n: number; l: number }>();
    view.forEach((e) => { const d = m.get(e.dept) || { n: 0, l: 0 }; d.n++; d.l += e.totals.late; m.set(e.dept, d); });
    return [...m].map(([d, v]) => ({ d, n: v.n, avg: v.l / v.n })).sort((a, b) => b.avg - a.avg).slice(0, 8);
  }, [view]);
  const follow = useMemo(() => view.filter((e) => e.totals.incomplete || !e.inMaster).sort((a, b) => Number(a.inMaster) - Number(b.inMaster) || b.totals.incomplete - a.totals.incomplete).slice(0, 6), [view]);
  const open = (ac: string) => router.push(`/dtr?ac=${encodeURIComponent(ac)}`);

  const figs = [
    { l: "Total late", v: dur(T.l), s: `${T.lc} late arrivals`, lead: true },
    { l: "Absences (days)", v: days(T.a), s: `${T.i} incomplete punches` },
    { l: "Undertime", v: dur(T.e), s: "left early or short day" },
    { l: "Attendance", v: `${rate.toFixed(1)}%`, s: `${days(T.wd - T.a)} of ${T.wd} work days` },
    { l: "Hours worked", v: dur(T.w), s: view.length ? `about ${dur(Math.round(T.w / view.length))} each` : "" },
    { l: "Employees", v: String(view.length), s: curPeriod ? monthLabel(curPeriod) : "" },
  ];

  return (
    <Page title="Dashboard" filters needsData>
      <div className="mb-9 grid grid-cols-2 border-b border-line border-t-[1.5px] border-t-ink md:grid-cols-3 xl:grid-cols-[1.5fr_repeat(5,1fr)]">
        {figs.map((f, i) => (
          <div key={f.l} className={`border-line px-4 pb-4 pt-4 ${i ? "border-l" : ""} max-xl:border-t first:pl-0`}>
            <span className="block text-[12.5px] font-semibold text-ink-2">{f.l}</span>
            <b className={`my-1 block font-bold tabular-nums tracking-tight ${f.lead ? "text-[38px] text-maroon" : "text-2xl"}`}>{f.v}</b>
            <small className="text-[12.5px] text-ink-3">{f.s}</small>
          </div>
        ))}
      </div>

      <div className="mb-10 grid gap-10 xl:grid-cols-[1.7fr_1fr]">
        <section>
          <div className="mb-3 flex flex-wrap items-end gap-4">
            <h2 className="flex-1 text-lg font-bold">{TITLE[mode]}</h2>
            <div className="inline-flex overflow-hidden rounded-lg border border-[#d6dcd8]" role="tablist" aria-label="Sort by">
              {(["late", "absent", "early"] as Mode[]).map((m) => (
                <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)}
                  className={`border-l border-[#d6dcd8] px-3 py-1.5 text-[13px] font-semibold first:border-l-0 ${mode === m ? "bg-primary text-white" : "bg-white text-ink-2"}`}>
                  {m === "late" ? "Late" : m === "absent" ? "Absent" : "Undertime"}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="ruled">
              <thead><tr><th>Employee</th><th className="num">Times late</th><th className="num">Late</th><th className="num">Absent</th><th className="num">Undertime</th><th className="num">Hours</th></tr></thead>
              <tbody>
                {top.length ? top.map((e) => {
                  const bar = (m: Mode, v: number) => mode === m ? <span className="mr-2 inline-block h-1.5 rounded-sm bg-chart-2 align-middle" style={{ width: Math.round((v / mx) * 60) }} /> : null;
                  return (
                    <tr key={e.ac} className="go" onClick={() => open(e.ac)}>
                      <td><b className="block font-semibold">{e.name}</b><small className="text-xs text-ink-3">{e.dept} · AC# {e.ac}</small></td>
                      <td className="num">{e.totals.lateCount || <span className="zero">0</span>}</td>
                      <td className={`num ${mode === "late" ? "hot" : ""}`}>{bar("late", e.totals.late)}{dur(e.totals.late)}</td>
                      <td className={`num ${mode === "absent" ? "hot" : ""}`}>{bar("absent", e.totals.absent)}{days(e.totals.absent)}</td>
                      <td className={`num ${mode === "early" ? "hot" : ""}`}>{bar("early", e.totals.early)}{dur(e.totals.early)}</td>
                      <td className="num">{dur(e.totals.worked)}</td>
                    </tr>
                  );
                }) : <tr><td colSpan={6} className="py-8 text-center text-ink-3">Nobody in this view has any {mode === "early" ? "undertime" : mode === "absent" ? "absences" : "late arrivals"}.</td></tr>}
              </tbody>
            </table>
          </div>
          <Link href="/attendance" className="mt-3 inline-block text-[13.5px] font-semibold text-primary-dark">See all employees</Link>
        </section>

        <aside>
          <h2 className="mb-3 text-lg font-bold">Late by department</h2>
          <table className="ruled">
            <thead><tr><th>Dept</th><th className="num">Staff</th><th className="num">Avg late</th></tr></thead>
            <tbody>{byDept.map((x) => (
              <tr key={x.d} className="go" onClick={() => setFilters({ dept: x.d })}><td className="font-semibold">{x.d}</td><td className="num">{x.n}</td><td className="num">{Math.round(x.avg)} min</td></tr>
            ))}</tbody>
          </table>
          <h2 className="mb-3 mt-7 text-lg font-bold">Needs follow-up</h2>
          <ul className="border-t-[1.5px] border-ink">
            {follow.length ? follow.map((e) => (
              <li key={e.ac} onClick={() => open(e.ac)} className="flex cursor-pointer justify-between gap-3 border-b border-rule px-0.5 py-2.5 text-[13.5px] hover:bg-primary-soft">
                <div><b className="font-semibold">{e.name}</b><small className="block text-xs text-ink-3">{e.dept}</small></div>
                <span className="self-center whitespace-nowrap text-[12.5px] font-semibold text-maroon">{e.inMaster ? `${e.totals.incomplete} missing punch${e.totals.incomplete > 1 ? "es" : ""}` : "Not linked to a record"}</span>
              </li>
            )) : <li className="py-2.5 text-ink-3">All punches are complete.</li>}
          </ul>
        </aside>
      </div>

      <section className="border-t border-line pt-6">
        <div className="mb-2 flex flex-wrap items-end gap-4">
          <h2 className="flex-1 text-lg font-bold">Daily attendance</h2>
          <div className="flex gap-4 text-xs text-ink-2">
            <span><i className="mr-1.5 inline-block size-2.5 rounded-sm bg-chart align-[-1px]" />On time</span>
            <span><i className="mr-1.5 inline-block size-2.5 rounded-sm bg-chart-2 align-[-1px]" />Late</span>
            <span><i className="mr-1.5 inline-block size-2.5 rounded-sm bg-[#e3e8e5] align-[-1px]" />Holiday</span>
          </div>
        </div>
        <DailyChart view={view} />
      </section>
    </Page>
  );
}

function DailyChart({ view }: { view: EmpResult[] }) {
  const list = useMemo(() => {
    const m = new Map<string, { on: number; late: number; hol: boolean }>();
    for (const e of view) for (const r of e.rows) {
      if (r.remarks.includes("REST DAY")) continue;
      const d = m.get(r.date) || { on: 0, late: 0, hol: false };
      if (r.remarks.length && !r.punches && r.remarks[0] !== "ABSENT") d.hol = true;
      if (r.punches) { if (r.late) d.late++; else d.on++; }
      m.set(r.date, d);
    }
    return [...m].sort((a, b) => a[0].localeCompare(b[0]));
  }, [view]);
  const W = 1000, H = 220, pl = 34, pb = 24, pt = 8, ch = H - pt - pb;
  const max = Math.max(1, ...list.map(([, d]) => d.on + d.late));
  const nice = Math.ceil(max / 20) * 20 || 4;
  const bw = (W - pl) / Math.max(1, list.length);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-[220px] w-full" preserveAspectRatio="none" role="img" aria-label="Daily attendance chart">
      {[0, 1, 2, 3, 4].map((i) => { const y = pt + (ch * i) / 4; return (
        <g key={i}><line x1={pl} x2={W} y1={y} y2={y} stroke={i === 4 ? "#18211d" : "#dfe4e1"} strokeWidth={i === 4 ? 1.2 : 1} />
          <text x={pl - 8} y={y + 4} fontSize={11} textAnchor="end" fill="#636b7d">{Math.round(nice * (1 - i / 4))}</text></g>); })}
      {list.map(([d, v], i) => {
        const x = pl + i * bw + bw * 0.2, w = bw * 0.6, y0 = H - pb, h1 = (v.on / nice) * ch, h2 = (v.late / nice) * ch;
        return (
          <g key={d}><title>{`${mdy(d)}: ${v.on} on time, ${v.late} late${v.hol ? " (holiday)" : ""}`}</title>
            {v.hol && <rect x={x} y={pt} width={w} height={ch} fill="#e3e8e5" />}
            <rect x={x} y={y0 - h1} width={w} height={h1} fill="#2f8a5e" />
            <rect x={x} y={y0 - h1 - h2} width={w} height={h2} fill="#f2c94c" />
            {i % Math.max(1, Math.ceil(list.length / 16)) === 0 && <text x={x + w / 2} y={H - 6} fontSize={11} textAnchor="middle" fill="#636b7d">{+d.slice(8)}</text>}
          </g>
        );
      })}
    </svg>
  );
}
