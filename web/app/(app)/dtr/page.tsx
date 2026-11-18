"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Page } from "@/components/AppShell";
import { useApp } from "@/lib/store";
import { cellsFor, days, dur, isHolidayRow, mdy, periodLabel, schedText } from "@/lib/format";
import { dtrPdf, dtrWorkbook, saveBlob } from "@/lib/exports";
import { IconDown } from "@/components/Icons";

function DtrInner() {
  const params = useSearchParams();
  const { view, results, settings, dtr, busy, toast } = useApp();
  const [sel, setSel] = useState<string | null>(params.get("ac"));
  useEffect(() => { const a = params.get("ac"); if (a) setSel(a); }, [params]);
  useEffect(() => { if (view.length === 1) setSel(view[0].ac); }, [view]);
  const e = results.find((x) => x.ac === sel);
  const compact = settings?.compact ?? false;
  const m = settings?.meta;

  async function exp(kind: "xlsx" | "pdf") {
    if (!e || !settings || !dtr) return;
    busy(kind === "xlsx" ? "Building Excel file…" : "Building PDF…");
    try {
      const name = e.name.replace(/[^A-Za-z0-9]+/g, "_").replace(/_+$/, "");
      if (kind === "xlsx") saveBlob(`DTR_${dtr.period}_${name}.xlsx`, await dtrWorkbook([e], settings, dtr.from, dtr.to));
      else saveBlob(`DTR_${dtr.period}_${name}.pdf`, await dtrPdf([e], settings, dtr.from, dtr.to), "application/pdf");
    } catch (err) { toast((err as Error).message); } finally { busy(null); }
  }

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[280px_1fr]">
      <div className="lg:sticky lg:top-24">
        <div className="mb-3 flex items-end"><h2 className="flex-1 text-lg font-bold">Employees</h2><span className="muted">{view.length} shown</span></div>
        <div className="max-h-[260px] overflow-auto border-t-[1.5px] border-ink lg:max-h-[calc(100vh-330px)]">
          {view.map((x) => (
            <button key={x.ac} onClick={() => setSel(x.ac)} aria-current={x.ac === sel}
              className={`flex w-full items-center gap-2 border-b border-rule px-1.5 py-2 text-left ${x.ac === sel ? "bg-primary text-white" : "hover:bg-primary-soft"}`}>
              <span className="min-w-0"><b className="block truncate text-[13px] font-semibold">{x.name}</b><small className={`text-xs ${x.ac === sel ? "text-mint-2" : "text-ink-3"}`}>{x.dept} · AC# {x.ac}</small></span>
              {x.totals.lateCount > 0 && <span className={`ml-auto whitespace-nowrap text-xs font-semibold ${x.ac === sel ? "text-gold" : "text-maroon"}`}>{x.totals.lateCount}× late</span>}
            </button>
          ))}
        </div>
      </div>
      <div>
        {!e || !dtr ? <p className="border-t-[1.5px] border-ink py-16 text-center text-ink-3">Choose an employee from the list to open their daily time record.</p> : (<>
          <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
            <div className="flex-1"><h2 className="text-lg font-bold">{e.name}</h2>
              <p className="muted">{e.dept} · {e.inst} · {e.totals.present} days present, {days(e.totals.absent)} absent, late {e.totals.lateCount} times</p></div>
            <button className="btn" onClick={() => exp("xlsx")}><IconDown width={16} height={16} />Excel</button>
            <button className="btn btn-primary" onClick={() => exp("pdf")}><IconDown width={16} height={16} />PDF</button>
          </div>
          <div className="border border-[#c9d1cc] bg-white p-4 shadow-[0_1px_0_#c9d1cc,0_8px_24px_-16px_rgba(15,59,40,.35)] sm:p-8">
            <table className="formhead"><tbody>
              <tr><td rowSpan={2} className="w-[22%]">{m?.org || "FORMS"}</td><td>Document No.</td><td>{m?.docNo}</td><td>Eff. Date</td><td>{m?.effDate}</td></tr>
              <tr><td>Revision No.</td><td>{m?.revNo}</td><td>Pages</td><td>1 of 1</td></tr>
              <tr><td colSpan={5} className="text-[15px] font-bold tracking-wide">DAILY TIME RECORD ({periodLabel(dtr.from, dtr.to)})</td></tr>
            </tbody></table>
            <div className="mb-3.5 grid grid-cols-2 gap-x-7 gap-y-1 text-[13px] sm:flex sm:flex-wrap">
              {[["Name", e.name], ["AC#", e.ac], ["Department", e.dept], ["Schedule", schedText(e.sched)]].map(([k, v]) => (
                <div key={k}><span className="text-ink-2">{k}</span><br /><b className="font-semibold">{v}</b></div>))}
            </div>
            <div className="overflow-x-auto">
              <table className="form">
                <thead><tr><th>Date</th>{(compact ? ["In", "Out", "In", "Out"] : ["AM in", "AM out", "PM in", "PM out"]).map((h) => <th key={h}>{h}</th>)}<th>Hours</th><th>Late</th><th>Early</th><th>Absent</th><th>Remarks</th></tr></thead>
                <tbody>{e.rows.map((d) => { const hol = isHolidayRow(d), c = cellsFor(d, compact); return (
                  <tr key={d.date} className={hol ? "bg-[#f4f6f5]" : ""}>
                    <td>{mdy(d.date)} <span className="text-ink-3">{d.dow}</span></td>
                    {hol ? <td colSpan={4} className="font-bold">{d.remarks[0]}</td> : c.map((x, i) => <td key={i} className="tabular-nums">{x}</td>)}
                    <td className="tabular-nums">{d.worked ? dur(d.worked) : ""}</td>
                    <td className={`tabular-nums ${d.late ? "font-bold text-maroon" : ""}`}>{d.late || ""}</td>
                    <td className={`tabular-nums ${d.early ? "font-bold text-maroon" : ""}`}>{d.early || ""}</td>
                    <td className={d.absent === 0.5 ? "text-amber" : ""}>{d.absent || ""}</td>
                    <td className={`!text-left !whitespace-normal text-xs font-semibold ${d.remarks.includes("ABSENT") ? "text-maroon" : ""}`}>{hol ? "" : d.remarks.join("; ")}</td>
                  </tr>); })}</tbody>
                <tfoot><tr><td colSpan={5} className="!text-right">TOTAL</td><td>{dur(e.totals.worked)}</td><td>{e.totals.late}</td><td>{e.totals.early}</td><td>{days(e.totals.absent)}</td><td className="!text-left">Late {e.totals.lateCount}× ({dur(e.totals.late)})</td></tr></tfoot>
              </table>
            </div>
            <p className="mt-2.5 text-xs text-ink-3">Late and early are in minutes. Absent is in days.</p>
          </div>
        </>)}
      </div>
    </div>
  );
}

export default function DtrPage() {
  return <Page title="DTR records" filters needsData><Suspense><DtrInner /></Suspense></Page>;
}
