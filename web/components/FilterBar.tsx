"use client";
import { useMemo } from "react";
import { useApp } from "@/lib/store";
import { monthLabel } from "@/lib/format";

export function FilterBar() {
  const { periods, curPeriod, dtr, openPeriod, results, filters, setFilters, toast } = useApp();
  const insts = useMemo(() => [...new Set(results.map((e) => e.inst))].sort(), [results]);
  const depts = useMemo(() => [...new Set(results.filter((e) => !filters.inst || e.inst === filters.inst).map((e) => e.dept))].sort(), [results, filters.inst]);
  if (!curPeriod) return null;
  const change = (from: string, to: string) => {
    if (!from || !to || from > to) return toast("Choose a valid date range.");
    openPeriod(curPeriod, from, to);
  };
  return (
    <div className="mb-6 grid grid-cols-2 items-end gap-3 border-b border-line pb-5 sm:flex sm:flex-wrap">
      <div className="field"><label htmlFor="fp">Period</label>
        <select id="fp" className="input" value={curPeriod} onChange={(e) => openPeriod(e.target.value)}>
          {periods.map((p) => <option key={p.period} value={p.period}>{monthLabel(p.period)}</option>)}
        </select></div>
      <div className="field"><label htmlFor="ff">From</label><input id="ff" type="date" className="input" value={dtr?.from ?? ""} onChange={(e) => change(e.target.value, dtr!.to)} /></div>
      <div className="field"><label htmlFor="ft">To</label><input id="ft" type="date" className="input" value={dtr?.to ?? ""} onChange={(e) => change(dtr!.from, e.target.value)} /></div>
      <div className="field"><label htmlFor="fi">Institution</label>
        <select id="fi" className="input" value={filters.inst} onChange={(e) => setFilters({ inst: e.target.value, dept: "" })}>
          <option value="">All institutions</option>{insts.map((i) => <option key={i}>{i}</option>)}
        </select></div>
      <div className="field"><label htmlFor="fd">Department</label>
        <select id="fd" className="input" value={filters.dept} onChange={(e) => setFilters({ dept: e.target.value })}>
          <option value="">All departments</option>{depts.map((d) => <option key={d}>{d}</option>)}
        </select></div>
      <div className="field col-span-2 min-w-[180px] flex-1"><label htmlFor="fe">Employee</label>
        <input id="fe" className="input" list="emp-list" placeholder="Name or AC#" value={filters.q} onChange={(e) => setFilters({ q: e.target.value })} /></div>
      <button className="btn col-span-2" onClick={() => setFilters({ inst: "", dept: "", q: "" })}>Clear filters</button>
    </div>
  );
}
