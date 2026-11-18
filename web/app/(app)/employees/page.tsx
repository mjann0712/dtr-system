"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Page } from "@/components/AppShell";
import { useApp } from "@/lib/store";
import { api } from "@/lib/api";
import { employeesWorkbook, saveBlob } from "@/lib/exports";
import type { Employee, Unlinked } from "@/lib/types";
import { IconDown, IconUp } from "@/components/Icons";
import { useRouter } from "next/navigation";

interface ListResp { data: Employee[]; counts: { total: number; active: number; inactive: number; linked: number; nodept: number }; departments: string[]; }
const blank: Omit<Employee, "id"> = { employee_id: "", last_name: "", first_name: "", name: "", position: "", department: "", department_source: null, gender: "", date_hired: "", status: "Active", ac_nos: [] };

export default function Employees() {
  const router = useRouter();
  const { toast, busy, confirm, refreshDtr } = useApp();
  const [resp, setResp] = useState<ListResp | null>(null);
  const [unlinked, setUnlinked] = useState<Unlinked[]>([]);
  const [q, setQ] = useState(""); const [show, setShow] = useState(""); const [dept, setDept] = useState("");
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [edit, setEdit] = useState<(Omit<Employee, "id"> & { id?: number }) | null>(null);
  const [linkVals, setLinkVals] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const p = new URLSearchParams(); if (q) p.set("q", q); if (show) p.set("show", show); if (dept) p.set("department", dept);
    try { setResp(await api<ListResp>(`/employees?${p}`)); } catch (e) { toast((e as Error).message); }
  }, [q, show, dept, toast]);
  const loadUnlinked = useCallback(async () => {
    try { const r = await api<{ data: Unlinked[] }>("/biometric/unlinked"); setUnlinked(r.data); } catch (e) { toast((e as Error).message); }
  }, [toast]);
  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [load]);
  useEffect(() => { loadUnlinked(); }, [loadUnlinked]);

  const list = useMemo(() => resp?.data ?? [], [resp]);
  const allOn = list.length > 0 && list.every((e) => sel.has(e.id));
  const byId = useMemo(() => new Map(list.map((e) => [e.id, e])), [list]);
  const label = (e: { name: string; employee_id: string }) => `${e.name} (${e.employee_id})`;
  const after = async () => { await Promise.all([load(), loadUnlinked()]); refreshDtr(); };

  async function setStatus(ids: number[], status: "Active" | "Inactive") {
    if (status === "Inactive" && ids.length > 1 && !(await confirm({ title: `Mark ${ids.length} employees as Inactive?`, body: <p>Inactive employees stay in the records and their saved DTR is kept. They are left out of name matching for new biometric IDs.</p>, ok: "Mark as Inactive" }))) return;
    busy("Saving…");
    try { const r = await api<{ updated: number }>("/employees/status", { body: { ids, status } }); toast(ids.length === 1 ? `${byId.get(ids[0])?.name} marked as ${status}.` : `${r.updated} employees marked as ${status}.`); setSel(new Set()); await load(); }
    catch (e) { toast((e as Error).message); } finally { busy(null); }
  }
  async function save() {
    if (!edit) return;
    busy("Saving…");
    try {
      const body = { ...edit, ac_nos: edit.ac_nos.filter(Boolean), date_hired: edit.date_hired || null };
      if (edit.id) await api(`/employees/${edit.id}`, { method: "PUT", body }); else await api("/employees", { body });
      toast(`${edit.last_name.toUpperCase()} saved.`); setEdit(null); await after();
    } catch (e) { toast((e as Error).message); } finally { busy(null); }
  }
  async function remove() {
    if (!edit?.id) return;
    if (!(await confirm({ title: `Delete ${edit.name}?`, body: <p>The record {edit.employee_id} is removed. Their punches stay in the saved periods but appear under UNASSIGNED until linked again. To keep the history, set the status to Inactive instead.</p>, ok: "Delete record", danger: true }))) return;
    busy("Deleting…");
    try { await api(`/employees/${edit.id}`, { method: "DELETE" }); toast(`${edit.name} deleted.`); setEdit(null); await after(); }
    catch (e) { toast((e as Error).message); } finally { busy(null); }
  }
  async function link(rows: { ac_no: string; employee_id: number }[], msg: string) {
    busy("Saving…");
    try { await api("/biometric/link", { body: { links: rows } }); toast(msg); await after(); } catch (e) { toast((e as Error).message); } finally { busy(null); }
  }
  async function importFile(f: File) {
    const fd = new FormData(); fd.append("files[]", f);
    busy("Importing…");
    try { const r = await api<{ notes: string[] }>("/import", { form: fd }); toast(r.notes.join(" · ") || "Nothing new to import."); await after(); }
    catch (e) { toast((e as Error).message); } finally { busy(null); }
  }
  const allEmployees = list; // for the link picker
  const sug = unlinked.filter((u) => u.suggestion);

  return (
    <Page title="Employee records">
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <div className="min-w-[260px] flex-1"><h2 className="text-lg font-bold">All employees</h2>
          <p className="muted">{resp ? `${resp.counts.total} records (${resp.counts.active} active, ${resp.counts.inactive} inactive) · ${resp.counts.linked} linked to a biometric ID · ${resp.counts.nodept} without a department` : "Loading…"}</p></div>
        <label className="btn cursor-pointer"><IconUp width={16} height={16} />Import employee file
          <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importFile(f); e.target.value = ""; }} /></label>
        <button className="btn" onClick={async () => { busy("Building Excel file…"); try { saveBlob("Employee_records.xlsx", await employeesWorkbook(list)); } finally { busy(null); } }}><IconDown width={16} height={16} />Download list</button>
        <button className="btn btn-primary" onClick={() => setEdit({ ...blank })}>Add employee</button>
      </div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="field min-w-[220px] flex-1"><label htmlFor="sq">Search</label><input id="sq" className="input" placeholder="Name, employee ID, position or AC-No." value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="field"><label htmlFor="ss">Show</label><select id="ss" className="input" value={show} onChange={(e) => setShow(e.target.value)}>
          <option value="">All records</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="unlinked">No biometric ID</option><option value="nodept">No department</option></select></div>
        <div className="field"><label htmlFor="sd">Department</label><select id="sd" className="input" value={dept} onChange={(e) => setDept(e.target.value)}>
          <option value="">All departments</option>{resp?.departments.map((d) => <option key={d}>{d}</option>)}</select></div>
      </div>
      {sel.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2.5 rounded-lg border border-[#c6ddcf] bg-primary-soft px-3 py-2">
          <b className="mr-1.5">{sel.size} selected</b>
          <button className="btn btn-sm" onClick={() => setStatus([...sel], "Active")}>Mark as Active</button>
          <button className="btn btn-sm" onClick={() => setStatus([...sel], "Inactive")}>Mark as Inactive</button>
          <button className="btn btn-sm" onClick={() => setSel(new Set())}>Clear selection</button>
        </div>
      )}
      <div className="max-h-[calc(100vh-300px)] overflow-auto">
        <table className="ruled">
          <thead><tr>
            <th className="w-9"><input type="checkbox" aria-label="Select all shown" checked={allOn} onChange={(e) => setSel(e.target.checked ? new Set(list.map((x) => x.id)) : new Set())} /></th>
            <th>Employee ID</th><th>Name</th><th>Position</th><th>Dept</th><th>Biometric AC-No.</th><th>Status</th></tr></thead>
          <tbody>
            {list.slice(0, 600).map((e) => { const off = e.status === "Inactive"; return (
              <tr key={e.id} className={`go ${off ? "text-ink-3" : ""}`} onClick={() => setEdit({ ...e, department: e.department ?? "", gender: e.gender ?? "", date_hired: e.date_hired ?? "" })}>
                <td onClick={(ev) => ev.stopPropagation()}><input type="checkbox" aria-label={`Select ${e.name}`} checked={sel.has(e.id)} onChange={(ev) => { const s = new Set(sel); if (ev.target.checked) s.add(e.id); else s.delete(e.id); setSel(s); }} /></td>
                <td className="whitespace-nowrap font-semibold tabular-nums">{e.employee_id}</td>
                <td className="font-semibold">{e.name}</td><td className="max-w-[260px]">{e.position}</td>
                <td>{e.department || <span className="font-semibold text-maroon">Not set</span>}</td>
                <td>{e.ac_nos.length ? e.ac_nos.map((a) => <span key={a} className="mr-1 inline-block rounded-md border border-[#c9d6cf] px-1.5 text-[12.5px] font-semibold tabular-nums">{a}</span>) : <span className="text-ink-3">Not linked</span>}</td>
                <td className="whitespace-nowrap" onClick={(ev) => ev.stopPropagation()}>
                  <button onClick={() => setStatus([e.id], off ? "Active" : "Inactive")} aria-pressed={!off} title={`Click to mark as ${off ? "Active" : "Inactive"}`}
                    className={`inline-flex items-center gap-1.5 rounded-full border bg-white py-0.5 pl-2 pr-3 text-[12.5px] font-semibold ${off ? "border-[#d6dcd8] text-ink-2" : "border-[#b9d3c4] text-primary-dark hover:border-primary"}`}>
                    <i className={`size-2 rounded-full ${off ? "bg-[#b6bdb9]" : "bg-chart"}`} />{off ? "Inactive" : "Active"}</button>
                </td>
              </tr>); })}
            {resp && !list.length && <tr><td colSpan={7} className="py-8 text-center text-ink-3">No records match.</td></tr>}
          </tbody>
        </table>
      </div>

      <div id="unlinked" className="mb-3 mt-10 flex flex-wrap items-end gap-3">
        <div className="flex-1"><h2 className="text-lg font-bold">Biometric IDs not linked to a record</h2>
          <p className="muted">{unlinked.length ? `${unlinked.length} people appear in the time-clock data without a record. ${sug.length} have a likely match. Check each before linking; a wrong link files that person's DTR under another employee.` : "Every biometric ID in the saved data is linked to an employee record."}</p></div>
        {sug.length > 0 && <button className="btn" onClick={async () => {
          if (await confirm({ title: `Link ${sug.length} suggested matches?`, body: <p>Each AC-No. is linked to the suggested record. Check the suggestions first; some are last-name matches only.</p>, ok: "Link all" }))
            link(sug.map((u) => ({ ac_no: u.ac_no, employee_id: u.suggestion!.id })), `${sug.length} biometric IDs linked.`);
        }}>Link all suggested ({sug.length})</button>}
      </div>
      {unlinked.length > 0 && (
        <div className="overflow-x-auto"><table className="ruled">
          <thead><tr><th>AC-No.</th><th>Name on the time-clock</th><th className="w-[40%]">Employee record</th><th /></tr></thead>
          <tbody>{unlinked.map((u) => (
            <tr key={u.ac_no}>
              <td className="font-semibold tabular-nums">{u.ac_no}</td><td>{u.name}</td>
              <td><input className="input w-full min-w-[240px]" list="emp-pick" aria-label={`Employee record for AC-No. ${u.ac_no}`}
                value={linkVals[u.ac_no] ?? (u.suggestion ? label(u.suggestion) : "")} placeholder={u.candidates ? `${u.candidates} possible matches; type a name` : "Type a name or employee ID"}
                onChange={(e) => setLinkVals({ ...linkVals, [u.ac_no]: e.target.value })} /></td>
              <td className="whitespace-nowrap text-right">
                <button className="btn btn-sm btn-primary" onClick={() => {
                  const v = (linkVals[u.ac_no] ?? (u.suggestion ? label(u.suggestion) : "")).trim(); const m = v.match(/\(([^()]+)\)\s*$/);
                  const emp = m ? allEmployees.find((x) => x.employee_id === m[1]) : allEmployees.find((x) => x.name.toLowerCase() === v.toLowerCase());
                  const id = emp?.id ?? (u.suggestion && m && u.suggestion.employee_id === m[1] ? u.suggestion.id : undefined);
                  if (!id) return toast("Choose an employee from the list first.");
                  link([{ ac_no: u.ac_no, employee_id: id }], `AC-No. ${u.ac_no} linked.`);
                }}>Link</button>{" "}
                <button className="btn btn-sm" onClick={async () => { await api(`/biometric/${u.ac_no}/ignore`, { method: "POST" }); toast(`AC-No. ${u.ac_no} hidden from this list.`); loadUnlinked(); }}>Not an employee</button>
              </td>
            </tr>))}</tbody>
        </table></div>
      )}
      <datalist id="emp-pick">{allEmployees.filter((e) => e.status === "Active").map((e) => <option key={e.id} value={label(e)} />)}</datalist>

      {edit && (
        <div role="dialog" aria-modal="true" aria-labelledby="edt" className="fixed inset-0 z-[80] flex items-start justify-center overflow-auto bg-[rgba(15,36,26,.45)] px-4 py-14" onClick={(e) => { if (e.target === e.currentTarget) setEdit(null); }}>
          <form className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-2xl" onSubmit={(e) => { e.preventDefault(); save(); }}>
            <h2 id="edt" className="text-[19px] font-bold">{edit.id ? `Edit ${edit.name}` : "Add employee"}</h2>
            <p className="mb-4 mt-1 text-ink-2">Changes are saved for everyone using the system.</p>
            <div className="grid gap-3.5 sm:grid-cols-2">
              <div className="field"><label htmlFor="e1">Employee ID</label><input id="e1" required className="input" value={edit.employee_id} onChange={(e) => setEdit({ ...edit, employee_id: e.target.value })} placeholder="e.g. CE-695" /></div>
              <div className="field"><label htmlFor="e2">Status</label><select id="e2" className="input" value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value as Employee["status"] })}><option>Active</option><option>Inactive</option></select></div>
              <div className="field"><label htmlFor="e3">Last name</label><input id="e3" required className="input" value={edit.last_name} onChange={(e) => setEdit({ ...edit, last_name: e.target.value })} /></div>
              <div className="field"><label htmlFor="e4">First name and middle initial</label><input id="e4" className="input" value={edit.first_name} onChange={(e) => setEdit({ ...edit, first_name: e.target.value })} /></div>
              <div className="field sm:col-span-2"><label htmlFor="e5">Position</label><input id="e5" className="input" value={edit.position} onChange={(e) => setEdit({ ...edit, position: e.target.value })} /></div>
              <div className="field"><label htmlFor="e6">Department <span className="font-normal text-ink-3">used to group the DTR</span></label><input id="e6" list="dept-list" className="input" value={edit.department ?? ""} onChange={(e) => setEdit({ ...edit, department: e.target.value })} />
                <datalist id="dept-list">{resp?.departments.map((d) => <option key={d} value={d} />)}</datalist></div>
              <div className="field"><label htmlFor="e7">Biometric AC-No. <span className="font-normal text-ink-3">separate with commas</span></label><input id="e7" inputMode="numeric" className="input" value={edit.ac_nos.join(", ")} onChange={(e) => setEdit({ ...edit, ac_nos: e.target.value.split(/[,;\s]+/) })} /></div>
              <div className="field"><label htmlFor="e8">Date hired</label><input id="e8" type="date" className="input" value={edit.date_hired ?? ""} onChange={(e) => setEdit({ ...edit, date_hired: e.target.value })} /></div>
              <div className="field"><label htmlFor="e9">Gender</label><select id="e9" className="input" value={edit.gender ?? ""} onChange={(e) => setEdit({ ...edit, gender: e.target.value })}><option value="" /><option>Female</option><option>Male</option></select></div>
            </div>
            <div className="mt-6 flex items-center gap-2.5">
              {edit.id && <button type="button" className="btn" onClick={remove}>Delete record</button>}
              {edit.id && edit.ac_nos.filter(Boolean)[0] && <button type="button" className="btn" onClick={() => router.push(`/dtr?ac=${edit.ac_nos.filter(Boolean)[0]}`)}>Open DTR</button>}
              <span className="flex-1" />
              <button type="button" className="btn" onClick={() => setEdit(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Save</button>
            </div>
          </form>
        </div>
      )}
    </Page>
  );
}
