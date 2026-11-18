"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { matchEmp, useApp } from "@/lib/store";
import { mdy, monthLabel } from "@/lib/format";
import { IconBell, IconMenu, IconSearch } from "./Icons";

export function Header({ title, onMenu }: { title: string; onMenu: () => void }) {
  const router = useRouter();
  const { dtr, results, curPeriod, settings, saveSettings, refreshDtr, toast } = useApp();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const unlinked = results.filter((e) => !e.inMaster).length;
  const noPunch = dtr?.noPunchDays ?? [];
  const notes = (unlinked ? 1 : 0) + (noPunch.length && noPunch.length <= 6 ? 1 : 0);

  async function markHolidays() {
    if (!settings) return;
    await saveSettings({ ...settings, holidays: [...settings.holidays, ...noPunch.map((date) => ({ date, label: "HOLIDAY" }))] });
    await refreshDtr(); setOpen(false); toast("Marked as holiday. You can rename it in Rules & schedules.");
  }
  return (
    <header className="sticky top-0 z-20 flex items-center gap-3.5 border-b border-line bg-paper px-4 py-4 sm:px-8">
      <button className="btn size-10 p-0 lg:hidden" onClick={onMenu} aria-label="Open menu"><IconMenu /></button>
      <div className="min-w-0">
        <h1 className="truncate text-[22px] font-bold leading-tight tracking-tight sm:text-[26px]">{title}</h1>
        <p className="text-[13px] text-ink-2">{curPeriod ? `${monthLabel(curPeriod)} · ${results.length} employees` : "No time-clock file imported yet"}</p>
      </div>
      <div className="flex-1" />
      <form className="hidden h-10 w-72 items-center gap-2 rounded-lg border border-line bg-white px-3 md:flex" onSubmit={(e) => {
        e.preventDefault(); const s = q.trim().toLowerCase(); if (!s) return;
        const hit = results.find((x) => matchEmp(x, s)); if (!hit) return toast("No employee matches that search.");
        router.push(`/dtr?ac=${encodeURIComponent(hit.ac)}`); setQ("");
      }}>
        <IconSearch className="text-ink-3" />
        <label className="sr-only" htmlFor="gsearch">Find an employee</label>
        <input id="gsearch" value={q} onChange={(e) => setQ(e.target.value)} list="emp-list" placeholder="Find an employee" className="min-w-0 flex-1 bg-transparent outline-none" />
      </form>
      <div className="relative">
        <button className="btn relative size-10 p-0" aria-label="Notifications" onClick={() => setOpen((o) => !o)}>
          <IconBell />{notes > 0 && <span className="absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-maroon px-1 text-[11px] font-semibold text-white">{notes}</span>}
        </button>
        {open && (
          <div className="absolute right-0 top-12 z-50 w-[min(360px,calc(100vw-32px))] rounded-xl bg-white p-2 text-left shadow-2xl">
            <p className="m-2 text-[13.5px] font-semibold">Notifications</p>
            {!notes && <p className="p-2.5 text-[13px] text-ink-2">No notifications.</p>}
            {unlinked > 0 && (
              <div className="rounded-lg p-2.5 text-[13px] text-ink-2">
                <b className="text-ink">{unlinked} people are not linked to an employee record</b><br />Their DTR is filed under UNASSIGNED. Link their biometric IDs in Employee records.<br />
                <button className="btn btn-sm mt-1.5" onClick={() => { setOpen(false); router.push("/employees#unlinked"); }}>Open Employee records</button>
              </div>
            )}
            {noPunch.length > 0 && noPunch.length <= 6 && (
              <div className="rounded-lg border-t border-rule p-2.5 text-[13px] text-ink-2">
                <b className="text-ink">Possible holiday</b><br />Nobody clocked in on {noPunch.map(mdy).join(", ")}. Mark it as a holiday so it is not counted as an absence.<br />
                <button className="btn btn-sm mt-1.5" onClick={markHolidays}>Mark as holiday</button>
              </div>
            )}
          </div>
        )}
      </div>
      <datalist id="emp-list">{results.map((e) => <option key={e.ac} value={`${e.name} (${e.ac})`} />)}</datalist>
    </header>
  );
}
