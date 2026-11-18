"use client";
import { Page } from "@/components/AppShell";
import { useApp } from "@/lib/store";
import { periodLabel } from "@/lib/format";
import { dtrPdf, dtrWorkbook, saveBlob, summaryPdf } from "@/lib/exports";
import { IconDown } from "@/components/Icons";

export default function Reports() {
  const { view, settings, dtr, filters, busy, toast } = useApp();
  const scope = [filters.inst, filters.dept, filters.q].filter(Boolean).join(" / ") || "all institutions and departments";
  const tag = () => (filters.dept || filters.inst.replace(/\s+/g, "_") || "All");
  async function run(kind: "xlsx" | "pdf" | "sum") {
    if (!settings || !dtr || !view.length) return toast("No employees to export.");
    busy(kind === "xlsx" ? "Building Excel file…" : `Building PDF for ${view.length} employees…`);
    await new Promise((r) => setTimeout(r, 30));
    try {
      if (kind === "xlsx") saveBlob(`DTR_${dtr.period}_${tag()}.xlsx`, await dtrWorkbook(view, settings, dtr.from, dtr.to));
      if (kind === "pdf") saveBlob(`DTR_${dtr.period}_${tag()}.pdf`, await dtrPdf(view, settings, dtr.from, dtr.to), "application/pdf");
      if (kind === "sum") saveBlob(`DTR_Summary_${dtr.period}_${tag()}.pdf`, await summaryPdf(view, settings, dtr.from, dtr.to, [filters.inst && `Institution: ${filters.inst}`, filters.dept && `Department: ${filters.dept}`, filters.q && `Employee: ${filters.q}`].filter(Boolean).join("   |   ")), "application/pdf");
    } catch (e) { toast((e as Error).message); } finally { busy(null); }
  }
  const items = [
    { k: "xlsx" as const, fmt: "EXCEL", color: "text-green-800", t: "DTR workbook", d: "One sheet per department in the HR form layout. Daily IN and OUT, hours, late, early, absences and remarks, a total row for each employee, and a summary sheet.", b: "Download Excel" },
    { k: "pdf" as const, fmt: "PDF", color: "text-maroon", t: "DTR per employee", d: "One page per employee with time in and time out records, totals, the certification statement and signature lines.", b: "Download PDF" },
    { k: "sum" as const, fmt: "PDF", color: "text-blue", t: "Attendance summary", d: "One table of every employee in scope: present days, absences, hours worked, times late, late time and undertime.", b: "Download PDF" },
  ];
  return (
    <Page title="Reports" filters needsData>
      <p className="mb-5 text-sm text-ink-2">Reports include <b>{view.length} employee{view.length === 1 ? "" : "s"}</b> · {scope} · {dtr ? periodLabel(dtr.from, dtr.to) : ""}. Use the filters above to narrow it down.</p>
      <div className="border-t-[1.5px] border-ink">
        {items.map((it) => (
          <div key={it.k} className="grid items-center gap-2 border-b border-line py-5 sm:grid-cols-[90px_1fr_auto] sm:gap-6">
            <span className={`font-mono text-[13px] font-bold tracking-widest ${it.color}`}>{it.fmt}</span>
            <div><h2 className="mb-1 text-[17px] font-bold">{it.t}</h2><p className="max-w-[70ch] text-sm text-ink-2">{it.d}</p></div>
            <button className="btn btn-primary justify-self-start" onClick={() => run(it.k)}><IconDown width={16} height={16} />{it.b}</button>
          </div>
        ))}
      </div>
    </Page>
  );
}
