"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Page } from "@/components/AppShell";
import { useApp } from "@/lib/store";
import { api, ApiError } from "@/lib/api";
import { monthLabel } from "@/lib/format";
import { IconUp } from "@/components/Icons";

export default function Periods() {
  const router = useRouter();
  const { periods, curPeriod, refreshPeriods, openPeriod, busy, toast, confirm } = useApp();
  const [over, setOver] = useState(false);
  const [err, setErr] = useState("");
  const input = useRef<HTMLInputElement>(null);

  async function upload(files: File[], replace = false): Promise<void> {
    setErr("");
    const fd = new FormData(); files.forEach((f) => fd.append("files[]", f)); if (replace) fd.append("replace", "1");
    busy("Reading and saving…");
    try {
      const r = await api<{ period: string | null; notes: string[] }>("/import", { form: fd });
      busy(null);
      await refreshPeriods();
      if (r.period) { await openPeriod(r.period); router.push("/dashboard"); }
      toast(r.notes.join(" · ") || "Nothing new to import.");
    } catch (e) {
      busy(null);
      if (e instanceof ApiError && e.status === 409) {
        const p = (e.data as { period: string }).period;
        if (await confirm({ title: `Replace ${monthLabel(p)}?`, body: <p>{monthLabel(p)} is already saved. Importing <b>{files.map((f) => f.name).join(", ")}</b> replaces its punches with the ones in this file.</p>, ok: "Replace" })) return upload(files, true);
        return;
      }
      setErr((e as Error).message);
    }
  }
  async function del(p: string) {
    if (!(await confirm({ title: `Delete ${monthLabel(p)}?`, body: <p>The saved punches for {monthLabel(p)} are removed. Employee records are not affected. You can import the month again from its file.</p>, ok: "Delete period", danger: true }))) return;
    busy("Deleting…");
    try { await api(`/periods/${p}`, { method: "DELETE" }); const ps = await refreshPeriods(); if (p === curPeriod) await openPeriod(ps[0]?.period ?? ""); toast(`${monthLabel(p)} deleted.`); }
    catch (e) { toast((e as Error).message); } finally { busy(null); }
  }
  return (
    <Page title="DTR periods">
      <div id="upload" className="mb-10 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); const f = [...e.dataTransfer.files]; if (f.length) upload(f); }}
          className={`rounded-xl border-2 border-dashed px-8 py-12 text-center transition-colors ${over ? "border-primary bg-primary-soft" : "border-[#bfd8ca] bg-[#f4f9f6]"}`}>
          <IconUp width={44} height={44} className="mx-auto text-primary" />
          <h2 className="mb-1.5 mt-3 text-xl font-bold">Upload the biometric export</h2>
          <p className="mx-auto mb-5 max-w-lg text-ink-2">Drop the time-clock export, the employee records file, or both. The punch times and employee records are saved to the database.</p>
          <input ref={input} type="file" multiple accept=".xls,.xlsx,.csv,.txt" className="hidden" onChange={(e) => { const f = [...(e.target.files ?? [])]; if (f.length) upload(f); e.target.value = ""; }} />
          <button className="btn btn-primary" onClick={() => input.current?.click()}><IconUp width={16} height={16} />Choose file</button>
          {err && <p className="mt-4 text-maroon">{err}</p>}
        </div>
        <div className="border-t-[1.5px] border-ink pt-4 text-[13.5px] leading-relaxed text-ink-2">
          <h2 className="mb-2 text-base font-bold text-ink">What the file needs</h2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>The <b>raw export</b> from the time-clock (AC-No., Name, Time), or the <b>daily summary</b> (AC-No., Date, Clock In 1 …). If you upload both, the raw export is used.</li>
            <li>The <b>employee records</b> file (EMPLOYEE ID, name, POSITION / DEPARTMENT) updates Employee records.</li>
            <li>A <b>biometric list</b> (AC#, NAME, DEPT) links AC-Nos to records and sets departments.</li>
            <li>Each month only needs the time-clock file. Employee records and links are kept.</li>
          </ul>
        </div>
      </div>
      <h2 className="text-lg font-bold">Saved DTR periods</h2>
      <p className="muted mb-3">Each imported month is stored, so it can be opened again without the original file.</p>
      <div className="overflow-x-auto"><table className="ruled">
        <thead><tr><th>Period</th><th>File</th><th className="num">People</th><th className="num">Punches</th><th>Imported</th><th /></tr></thead>
        <tbody>
          {periods.map((p) => (
            <tr key={p.period}>
              <td className="font-semibold">{monthLabel(p.period)}{p.period === curPeriod && <span className="font-normal text-ink-3"> · open</span>}</td>
              <td>{p.file}</td><td className="num">{p.people}</td><td className="num">{p.punches.toLocaleString()}</td>
              <td>{p.imported_at?.slice(0, 10)}{p.imported_by ? ` · ${p.imported_by}` : ""}</td>
              <td className="whitespace-nowrap text-right"><button className="btn btn-sm" onClick={async () => { await openPeriod(p.period); router.push("/dashboard"); }}>Open</button>{" "}<button className="btn btn-sm" onClick={() => del(p.period)}>Delete</button></td>
            </tr>))}
          {!periods.length && <tr><td colSpan={6} className="py-6 text-center text-ink-3">No periods saved yet. Upload a time-clock file above.</td></tr>}
        </tbody>
      </table></div>
    </Page>
  );
}
