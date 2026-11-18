"use client";
import { useEffect, useMemo, useState } from "react";
import { Page } from "@/components/AppShell";
import { useApp } from "@/lib/store";
import type { Settings } from "@/lib/types";

const DAYN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TABS = [["rules", "Schedule & rules"], ["hol", "Holidays"], ["dept", "Departments"], ["form", "Form details"]] as const;

export default function Rules() {
  const { settings, saveSettings, refreshDtr, results, toast, busy } = useApp();
  const [s, setS] = useState<Settings | null>(settings);
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("rules");
  useEffect(() => { setS(settings); }, [settings]);
  const depts = useMemo(() => [...new Set([...results.map((e) => e.dept), ...Object.keys(settings?.institutions ?? {}), ...Object.keys(settings?.deptSched ?? {})])].filter(Boolean).sort(), [results, settings]);
  if (!s) return <Page title="Rules & schedules"><p className="muted">Loading…</p></Page>;
  const up = (p: Partial<Settings>) => setS({ ...s, ...p });
  const chk = (k: keyof Settings, label: string, hint?: string) => (
    <label className="my-2.5 flex items-start gap-2.5 text-[13.5px]"><input type="checkbox" className="mt-1" checked={!!s[k]} onChange={(e) => up({ [k]: e.target.checked } as Partial<Settings>)} />
      <span>{label}{hint && <small className="block text-xs text-ink-3">{hint}</small>}</span></label>);

  async function save() {
    busy("Saving…");
    try { await saveSettings(s!); await refreshDtr(); toast("Saved. Records recalculated."); }
    catch (e) { toast((e as Error).message); } finally { busy(null); }
  }
  return (
    <Page title="Rules & schedules">
      <div className="border-t-[1.5px] border-ink">
        <div className="flex flex-wrap gap-1.5 border-b border-line" role="tablist">
          {TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`border-b-2 px-3.5 py-2.5 font-medium ${tab === k ? "border-primary text-primary-dark" : "border-transparent text-ink-2"}`}>{l}</button>)}
        </div>
        <div className="py-6">
          {tab === "rules" && (<>
            <h3 className="mb-2.5 font-bold">Default office schedule</h3>
            <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
              {([["amIn", "AM in"], ["amOut", "Lunch out"], ["pmIn", "Lunch in"], ["pmOut", "PM out"]] as const).map(([k, l]) => (
                <div key={k} className="field"><label htmlFor={k}>{l}</label><input id={k} type="time" className="input" value={s.sched[k]} onChange={(e) => up({ sched: { ...s.sched, [k]: e.target.value } })} /></div>))}
            </div>
            <p className="my-3 text-[12.5px] text-ink-3">Departments with different hours are set in the Departments tab.</p>
            <h3 className="mb-2.5 mt-6 font-bold">Work days</h3>
            <div className="flex flex-wrap gap-2">{[1, 2, 3, 4, 5, 6, 0].map((d) => (
              <label key={d} className="flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 text-[13px]"><input type="checkbox" checked={s.workDays.includes(d)} onChange={(e) => up({ workDays: e.target.checked ? [...s.workDays, d] : s.workDays.filter((x) => x !== d) })} />{DAYN[d]}</label>))}</div>
            <h3 className="mb-2.5 mt-6 font-bold">Late and undertime</h3>
            <div className="grid gap-3.5 sm:grid-cols-3">
              <div className="field"><label htmlFor="gr">Grace period (minutes)</label><input id="gr" type="number" min={0} className="input" value={s.grace} onChange={(e) => up({ grace: Math.max(0, +e.target.value || 0) })} /></div>
              <div className="field"><label htmlFor="dd">Ignore repeat taps within (minutes)</label><input id="dd" type="number" min={0} className="input" value={s.dedupe} onChange={(e) => up({ dedupe: Math.max(0, +e.target.value || 0) })} /></div>
            </div>
            <p className="my-3 text-[12.5px] text-ink-3">Arriving within the grace period is not late. Once past it, lateness is counted from the scheduled time.</p>
            {chk("lunchRule", "Count late return from lunch and early lunch out", "Applies when the employee has all four punches that day.")}
            {chk("capToSched", "Count only hours inside the schedule", "Time before AM in or after PM out is not added to hours worked.")}
            {chk("compact", "Fill IN/OUT columns left to right", "Matches the older HR sheet. When off, punches go under AM IN, AM OUT, PM IN, PM OUT by time of day.")}
            {chk("ignoreInvalid", "Ignore punches the time-clock marked \"Invalid\"")}
            {chk("includeNoPunch", "Include linked employees with no punches in the period", "They will show as absent every work day.")}
          </>)}
          {tab === "hol" && (<>
            <p className="mb-3 text-[12.5px] text-ink-3">Holidays and suspended days are not counted as absences. Punches on these days still show.</p>
            <table className="ruled max-w-2xl"><thead><tr><th className="w-48">Date</th><th>Label (shown on the DTR)</th><th /></tr></thead>
              <tbody>{s.holidays.map((h, i) => (
                <tr key={i}><td><input type="date" aria-label="Holiday date" className="input w-full" value={h.date} onChange={(e) => up({ holidays: s.holidays.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)) })} /></td>
                  <td><input aria-label="Holiday label" className="input w-full" value={h.label} onChange={(e) => up({ holidays: s.holidays.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} /></td>
                  <td><button className="px-2 text-xl text-ink-3 hover:text-maroon" aria-label="Remove" onClick={() => up({ holidays: s.holidays.filter((_, j) => j !== i) })}>×</button></td></tr>))}
                {!s.holidays.length && <tr><td colSpan={3} className="py-3 text-ink-3">No holidays yet.</td></tr>}</tbody></table>
            <button className="btn mt-3" onClick={() => up({ holidays: [...s.holidays, { date: "", label: "HOLIDAY" }] })}>+ Add holiday</button>
          </>)}
          {tab === "dept" && (<>
            <p className="mb-3 text-[12.5px] text-ink-3">Leave time fields blank to use the default schedule. Untick Sat for departments that work Monday to Friday only.</p>
            <div className="overflow-x-auto"><table className="ruled"><thead><tr><th>Dept</th><th>Institution</th><th>AM in</th><th>Lunch out</th><th>Lunch in</th><th>PM out</th><th className="text-center">Sat</th></tr></thead>
              <tbody>{depts.map((d) => { const o = s.deptSched[d] || {}; const sat = o.workDays ? o.workDays.includes(6) : s.workDays.includes(6);
                const setD = (p: object) => { const n = { ...o, ...p } as Record<string, unknown>; Object.keys(n).forEach((k) => (n[k] === "" || n[k] === undefined) && delete n[k]); up({ deptSched: { ...s.deptSched, [d]: n } }); };
                return (<tr key={d}><td className="font-bold">{d}</td>
                  <td><input aria-label={`${d} institution`} className="input w-full" placeholder="Unassigned" value={s.institutions[d] ?? ""} onChange={(e) => up({ institutions: { ...s.institutions, [d]: e.target.value } })} /></td>
                  {(["amIn", "amOut", "pmIn", "pmOut"] as const).map((k) => <td key={k}><input aria-label={`${d} ${k}`} type="time" className="input min-w-[104px]" value={o[k] ?? ""} onChange={(e) => setD({ [k]: e.target.value })} /></td>)}
                  <td className="text-center"><input aria-label={`${d} works Saturday`} type="checkbox" checked={sat} onChange={(e) => setD({ workDays: e.target.checked ? [...new Set([...s.workDays, 6])] : s.workDays.filter((x) => x !== 6) })} /></td></tr>); })}</tbody></table></div>
          </>)}
          {tab === "form" && (
            <div className="grid gap-3.5 sm:grid-cols-3">
              {([["org", "Organization name (optional)"], ["docNo", "Document no."], ["revNo", "Revision no."], ["effDate", "Effectivity date"], ["verifier", "Verified by (PDF)"], ["noter", "Noted by (PDF)"]] as const).map(([k, l]) => (
                <div key={k} className="field"><label htmlFor={k}>{l}</label><input id={k} className="input" value={s.meta[k] ?? ""} onChange={(e) => up({ meta: { ...s.meta, [k]: e.target.value } })} /></div>))}
            </div>)}
        </div>
        <div className="flex justify-end gap-2.5 border-t border-line py-4">
          <button className="btn" onClick={() => { setS(settings); toast("Changes discarded."); }}>Discard changes</button>
          <button className="btn btn-primary" onClick={save}>Save and recalculate</button>
        </div>
      </div>
    </Page>
  );
}
