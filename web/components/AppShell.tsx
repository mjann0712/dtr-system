"use client";
import { useState, type ReactNode } from "react";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { FilterBar } from "./FilterBar";
import { useApp } from "@/lib/store";
import Link from "next/link";

/** Page frame: sidebar, header, optional filters, and an empty state until a period exists. */
export function Page({ title, filters = false, needsData = false, children }: { title: string; filters?: boolean; needsData?: boolean; children: ReactNode }) {
  const [menu, setMenu] = useState(false);
  const { ready, curPeriod } = useApp();
  return (
    <div className="min-h-screen lg:pl-[264px]">
      <Sidebar open={menu} onClose={() => setMenu(false)} />
      <Header title={title} onMenu={() => setMenu(true)} />
      <main className="px-4 pb-16 pt-5 sm:px-8">
        {!ready ? <p className="muted py-20 text-center">Loading…</p>
          : needsData && !curPeriod ? (
            <div className="border-t-[1.5px] border-ink py-16 text-center">
              <h2 className="text-lg font-bold">No DTR period yet</h2>
              <p className="muted mx-auto mt-1 max-w-md">Import the time-clock export to see attendance, DTR records and reports.</p>
              <Link href="/periods#upload" className="btn btn-primary mt-4">Import time-clock file</Link>
            </div>
          ) : (<>{filters && <FilterBar />}{children}</>)}
      </main>
    </div>
  );
}
