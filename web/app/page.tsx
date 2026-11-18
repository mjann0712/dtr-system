import Link from "next/link";

const VS = [
  ["Pairing time in and time out", "Sorted in a spreadsheet, employee by employee", "Done for every employee and every day on upload"],
  ["Repeat taps and missing punches", "Easy to overlook", "Repeat taps ignored; missing time in or out flagged"],
  ["Late minutes and undertime", "Counted one entry at a time", "Computed from each department's schedule and grace period"],
  ["Absences and half days", "Checked against a calendar", "Counted automatically, with holidays excluded"],
  ["Department forms", "Re-typed into the HR form", "One Excel sheet per department, in the form layout"],
  ["Employee copies for signing", "Prepared one at a time", "One PDF page per employee, with signature lines"],
];
const COLS = [
  ["HOURS", "Hours worked", "Time between each in and out, with the lunch break deducted. Totals for the day and the period."],
  ["LATE", "Late minutes", "Minutes after the scheduled start, past the grace period. Also counts how many days the employee was late."],
  ["EARLY", "Undertime", "Minutes before the scheduled end, including early lunch outs when HR counts them."],
  ["ABSENT", "Absences", "Whole days with no punches, and half days with only a morning or afternoon record."],
  ["REMARKS", "Flags", "Holiday, absent, half day, no time in, no time out. Shown so HR can follow up."],
];

export default function Landing() {
  return (
    <div className="bg-white">
      <nav className="sticky top-0 z-20 border-b border-line bg-white" aria-label="Landing">
        <div className="mx-auto flex h-[68px] max-w-[1160px] items-center gap-8 px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5 text-[17px] font-semibold text-ink no-underline"><span className="grid size-9 place-items-center rounded-[10px] bg-primary text-xs font-bold text-white">DTR</span>DTR System</Link>
          <div className="ml-auto hidden gap-6 text-sm font-medium text-ink-2 lg:flex">
            <a href="#problem" className="no-underline hover:text-primary-dark hover:underline">What it replaces</a><a href="#features" className="no-underline hover:text-primary-dark hover:underline">What it computes</a>
            <a href="#how" className="no-underline hover:text-primary-dark hover:underline">How it works</a><a href="#outputs" className="no-underline hover:text-primary-dark hover:underline">Reports</a>
          </div>
          <Link href="/dashboard" className="btn btn-primary ml-auto lg:ml-0">Open the system</Link>
        </div>
      </nav>

      <header className="border-b border-line py-12 sm:py-20">
        <div className="mx-auto grid max-w-[1160px] items-center gap-12 px-5 sm:px-8 lg:grid-cols-2 lg:gap-16">
          <div>
            <h1 className="mb-6 text-[34px] font-bold leading-[1.08] tracking-tight [text-wrap:balance] sm:text-[52px]">Time-clock punches in. <em className="not-italic text-primary">Ready&#8209;to&#8209;sign DTRs</em> out.</h1>
            <p className="mb-8 max-w-[56ch] text-[17.5px] leading-relaxed text-ink-2">Upload the biometric export. The system pairs each employee&apos;s time in and time out, computes hours worked, late minutes, undertime and absences, and prepares the DTR in Excel and PDF.</p>
            <div className="flex flex-wrap gap-3">
              <Link href="/dashboard" className="btn btn-primary px-5 py-3 text-[15px] font-semibold">Open the system</Link>
              <a href="#how" className="btn px-5 py-3 text-[15px] font-semibold">See how it works</a>
            </div>
            <p className="mt-4 text-sm text-ink-2">HR staff sign in with the account their administrator created.</p>
          </div>
          <figure className="play m-0 rounded-2xl border border-line bg-white shadow-[0_24px_50px_-20px_rgba(31,36,51,.22)]" aria-label="Example: four time-clock punches become one DTR row">
            <div className="flex items-baseline justify-between border-b border-line px-5 py-4"><b className="text-sm">Thu, 09/03 · AC# 103</b><span className="text-[12.5px] text-ink-3">Schedule 8:00 AM – 5:00 PM</span></div>
            <div className="grid sm:grid-cols-[.9fr_auto_1.1fr]">
              <div className="p-5"><p className="mb-2.5 text-xs font-semibold text-ink-3">Time-clock export</p>
                <ul className="font-mono text-[13px] leading-[1.9] text-ink-2">{[["08:23", "C/In"], ["12:03", "C/Out"], ["12:59", "C/In"], ["17:09", "C/Out"]].map(([t, s]) => (
                  <li key={t} className="raw-row flex justify-between border-b border-dashed border-line px-1.5 py-0.5"><span>{t}</span><span className="text-ink-3">{s}</span></li>))}</ul></div>
              <div className="grid place-items-center border-x border-rule px-2.5 text-ink-3 max-sm:rotate-90 max-sm:border-0" aria-hidden>→</div>
              <div className="p-5"><p className="mb-2.5 text-xs font-semibold text-ink-3">Daily time record</p>
                <div className="grid grid-cols-2 gap-2.5">{[["AM in", "08:23 AM", true], ["AM out", "12:03 PM"], ["PM in", "12:59 PM"], ["PM out", "05:09 PM"]].map(([l, v, late]) => (
                  <div key={l as string} className={`stamp rounded-lg border px-2.5 py-2 ${late ? "border-[#ecc3c6] bg-maroon-soft" : "border-line"}`}><small className="block text-xs text-ink-3">{l}</small><b className={`font-mono text-base tabular-nums ${late ? "text-maroon" : ""}`}>{v}</b></div>))}</div></div>
            </div>
            <div className="flex flex-wrap gap-5 rounded-b-2xl border-t border-line bg-[#fafbfc] px-5 py-3.5 text-[13.5px]"><span>Hours <b>7:50</b></span><span className="text-maroon">Late <b>23 min</b></span><span>Early <b>0</b></span><span>Absent <b>0</b></span></div>
          </figure>
        </div>
      </header>

      <section id="problem" className="border-b border-line py-16 sm:py-22">
        <div className="mx-auto max-w-[1160px] px-5 sm:px-8">
          <div className="mb-10 grid items-end gap-6 lg:grid-cols-2 lg:gap-12"><h2 className="text-[27px] font-semibold leading-tight tracking-tight sm:text-[34px]">The DTR work it takes off HR&apos;s desk</h2>
            <p className="max-w-[62ch] text-base leading-relaxed text-ink-2">The time-clock gives HR a long list of punches, not a finished record. Every cut-off, that list has to become a DTR for each employee. This is the part the system does.</p></div>
          <div className="overflow-x-auto"><table className="w-full border-collapse text-[15px]">
            <thead><tr className="border-b-[1.5px] border-ink text-left text-[13px] text-ink-2"><th className="p-4 font-semibold">Task</th><th className="p-4 font-semibold">By hand</th><th className="bg-[#f4f9f6] p-4 font-semibold">With the DTR System</th></tr></thead>
            <tbody>{VS.map(([a, b, c]) => <tr key={a} className="border-b border-line align-top"><td className="w-[30%] p-4 font-semibold">{a}</td><td className="p-4 text-ink-2">{b}</td><td className="bg-[#f4f9f6] p-4">{c}</td></tr>)}</tbody>
          </table></div>
        </div>
      </section>

      <section id="features" className="border-b border-line py-16 sm:py-22">
        <div className="mx-auto max-w-[1160px] px-5 sm:px-8">
          <div className="mb-10 grid items-end gap-6 lg:grid-cols-2 lg:gap-12"><h2 className="text-[27px] font-semibold leading-tight tracking-tight sm:text-[34px]">Every column of the DTR, filled in</h2>
            <p className="max-w-[62ch] text-base leading-relaxed text-ink-2">The same columns HR already uses, computed with the same rules for every employee.</p></div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">{COLS.map(([h, t, d]) => (
            <div key={h} className="border-t-[1.5px] border-ink pt-3.5"><h3 className="mb-2.5 font-mono text-[13px] font-bold tracking-widest text-primary-dark">{h}</h3><p className="text-sm leading-relaxed text-ink-2"><b className="mb-1 block text-[15px] text-ink">{t}</b>{d}</p></div>))}</div>
          <p className="mt-6 text-[15px] text-ink-2">Records can be filtered by institution, department or employee, for any date range. Schedules, work days, grace period and holidays are set by HR.</p>
        </div>
      </section>

      <section id="how" className="border-b border-line py-16 sm:py-22">
        <div className="mx-auto max-w-[1160px] px-5 sm:px-8">
          <div className="mb-10 grid items-end gap-6 lg:grid-cols-2 lg:gap-12"><h2 className="text-[27px] font-semibold leading-tight tracking-tight sm:text-[34px]">Three steps each cut-off</h2>
            <p className="max-w-[62ch] text-base leading-relaxed text-ink-2">Each month is saved, so it can be reopened and exported again later.</p></div>
          <ol className="grid gap-10 lg:grid-cols-3">{[["Import the export", "Upload the Excel or CSV file from the biometric device. Employee records only need to be uploaded once."], ["Review the records", "See who was late or absent, filter by department, and open any employee's daily time record."], ["Download and sign", "Export to Excel or PDF, then print for the employee and the department head to sign."]].map(([t, d], i) => (
            <li key={t} className="border-t-[1.5px] border-ink pt-4"><span className="mb-2.5 block text-[44px] font-bold leading-none tracking-tight text-primary">{i + 1}</span><h3 className="mb-2 text-[19px] font-bold">{t}</h3><p className="text-[15px] leading-relaxed text-ink-2">{d}</p></li>))}</ol>
        </div>
      </section>

      <section id="outputs" className="py-16 sm:py-22">
        <div className="mx-auto max-w-[1160px] px-5 sm:px-8">
          <div className="mb-10 grid items-end gap-6 lg:grid-cols-2 lg:gap-12"><h2 className="text-[27px] font-semibold leading-tight tracking-tight sm:text-[34px]">What you can download</h2>
            <p className="max-w-[62ch] text-base leading-relaxed text-ink-2">Each report follows the filters you choose, so you can export one department or one employee.</p></div>
          <div className="border-t-[1.5px] border-ink">{[["EXCEL", "text-green-800", "DTR workbook", "For HR's records and payroll.", ["One sheet per department, in the HR form layout", "Daily IN and OUT, hours, late, early, absent, remarks", "A total row for each employee and a summary sheet"]], ["PDF", "text-maroon", "DTR per employee", "For printing and signing.", ["One page per employee, with schedule and period", "Certification statement", "Signature lines for the employee, department head and HR"]], ["PDF", "text-blue", "Attendance summary", "For reports to management.", ["All employees in one table", "Present days, absences and hours worked", "Times late, late time and undertime"]]].map(([f, c, t, s, li]) => (
            <div key={t as string} className="grid gap-2 border-b border-line py-5 lg:grid-cols-[120px_1fr_1.2fr] lg:gap-7"><span className={`font-mono text-[13px] font-bold tracking-widest ${c}`}>{f}</span><div><h3 className="mb-1 text-[19px] font-bold">{t}</h3><p className="text-[14.5px] text-ink-2">{s}</p></div>
              <ul className="list-disc pl-5 text-[14.5px] leading-relaxed text-ink-2">{(li as string[]).map((x) => <li key={x}>{x}</li>)}</ul></div>))}</div>
        </div>
      </section>

      <section className="bg-forest py-16 text-white sm:py-20">
        <div className="mx-auto flex max-w-[1160px] flex-wrap items-center gap-8 px-5 sm:px-8">
          <div><h2 className="mb-2 text-[27px] font-semibold tracking-tight sm:text-[34px]">Prepare this cut-off&apos;s DTR</h2><p className="max-w-[56ch] text-base text-mint-2">Sign in, upload the time-clock export, and the records are ready to review as soon as the file is read.</p></div>
          <Link href="/dashboard" className="btn btn-primary px-5 py-3 text-[15px] font-semibold lg:ml-auto">Open the system</Link>
        </div>
      </section>
      <footer className="border-t border-forest-2 bg-forest py-6 text-[13px] text-mint-2"><div className="mx-auto flex max-w-[1160px] flex-wrap justify-between gap-4 px-5 sm:px-8"><span>DTR System · Human Resources</span><span>Daily time record computation and reporting</span></div></footer>
    </div>
  );
}
