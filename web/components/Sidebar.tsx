"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "@/lib/store";
import { monthLabel } from "@/lib/format";
import { IconCal, IconChart, IconClock, IconDash, IconDoc, IconGear, IconOut, IconShield, IconUp, IconUsers } from "./Icons";

const MAIN = [
  { href: "/dashboard", label: "Dashboard", icon: IconDash },
  { href: "/attendance", label: "Attendance", icon: IconChart },
  { href: "/dtr", label: "DTR records", icon: IconClock },
  { href: "/reports", label: "Reports", icon: IconDoc },
];
const RECORDS = [
  { href: "/employees", label: "Employee records", icon: IconUsers },
  { href: "/periods", label: "DTR periods", icon: IconCal },
];

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const path = usePathname();
  const { user, curPeriod, results, logout } = useApp();
  const link = (l: { href: string; label: string; icon: typeof IconDash }, badge?: number) => {
    const on = path.startsWith(l.href);
    return (
      <Link key={l.href} href={l.href} onClick={onClose} aria-current={on ? "page" : undefined}
        className={`mb-0.5 flex items-center gap-3 rounded-lg px-3 py-2.5 font-medium no-underline transition-colors ${on ? "bg-forest-3 font-semibold text-white" : "text-mint-2 hover:bg-forest-2 hover:text-white"}`}>
        <l.icon className={on ? "text-gold" : "text-mint"} />{l.label}
        {badge ? <span className="ml-auto text-xs font-medium text-mint">{badge}</span> : null}
      </Link>
    );
  };
  return (
    <>
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[264px] flex-col bg-forest text-mint-2 transition-transform lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <Link href="/" className="flex items-center gap-3 px-6 pb-5 pt-6 text-white no-underline" title="Back to the landing page">
          <span className="grid size-[42px] place-items-center rounded-[9px] bg-gold text-sm font-bold text-forest">DTR</span>
          <span><b className="block text-[17px] leading-tight">DTR System</b><small className="text-xs text-mint">Human Resources</small></span>
        </Link>
        <Link href="/periods#upload" onClick={onClose} className="mx-[18px] mb-[18px] flex items-center justify-center gap-2 rounded-lg border border-[#3d6d55] px-3 py-2.5 text-[13.5px] font-semibold text-white no-underline hover:border-[#5b8a72] hover:bg-forest-2">
          <IconUp /> Import time-clock file
        </Link>
        <nav className="flex-1 overflow-auto px-3" aria-label="System">
          {MAIN.map((l) => link(l, l.href === "/attendance" ? results.length : undefined))}
          <div className="px-3 pb-1.5 pt-4 text-xs font-semibold uppercase tracking-widest text-mint">Records</div>
          {RECORDS.map((l) => link(l))}
          <div className="px-3 pb-1.5 pt-4 text-xs font-semibold uppercase tracking-widest text-mint">Setup</div>
          {link({ href: "/rules", label: "Rules & schedules", icon: IconGear })}
          {user?.role === "admin" && link({ href: "/users", label: "User accounts", icon: IconShield })}
        </nav>
        <div className="border-t border-forest-2 px-6 py-4 text-xs text-mint">
          <span>Open period</span><b className="mb-2.5 block text-[13px] font-medium text-white">{curPeriod ? monthLabel(curPeriod) : "None yet"}</b>
          <span>Signed in as</span>
          <div className="flex items-center justify-between gap-2">
            <b className="truncate text-[13px] font-medium text-white">{user?.name ?? "…"}</b>
            <button onClick={logout} className="flex items-center gap-1 rounded-md px-1.5 py-1 text-mint hover:bg-forest-2 hover:text-white" title="Sign out"><IconOut width={16} height={16} /><span className="sr-only">Sign out</span></button>
          </div>
        </div>
      </aside>
      {open && <div className="fixed inset-0 z-30 bg-ink/35 lg:hidden" onClick={onClose} />}
    </>
  );
}
