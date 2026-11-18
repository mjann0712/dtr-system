export type Slot = number | null;

export interface DayRow {
  date: string; dow: string; slots: [Slot, Slot, Slot, Slot];
  worked: number; late: number; early: number; absent: number;
  remarks: string[]; punches: number; flag: string;
}
export interface Totals { worked: number; late: number; lateCount: number; early: number; absent: number; present: number; incomplete: number; workdays: number; }
export interface Sched { amIn: number; amOut: number; pmIn: number; pmOut: number; }
export interface EmpResult {
  ac: string; name: string; dept: string; inst: string; inMaster: boolean;
  empId: string | null; position: string; status: string | null;
  sched: Sched; rows: DayRow[]; totals: Totals;
}
export interface DtrResponse { period: string; from: string; to: string; results: EmpResult[]; noPunchDays: string[]; }

export interface Period { period: string; from: string; to: string; file: string; people: number; punches: number; imported_at: string; imported_by: string | null; }

export interface Employee {
  id: number; employee_id: string; last_name: string; first_name: string; name: string;
  position: string; department: string | null; department_source: string | null;
  gender: string | null; date_hired: string | null; status: "Active" | "Inactive"; ac_nos: string[]; updated_at?: string;
}
export interface Unlinked { ac_no: string; name: string; department: string | null; suggestion: { id: number; employee_id: string; name: string; level: string } | null; candidates: number; }

export interface Holiday { date: string; label: string; }
export interface DeptSched { amIn?: string; amOut?: string; pmIn?: string; pmOut?: string; workDays?: number[]; }
export interface Meta { org: string; docNo: string; revNo: string; effDate: string; verifier: string; noter: string; }
export interface Settings {
  workDays: number[]; holidays: Holiday[];
  sched: { amIn: string; amOut: string; pmIn: string; pmOut: string };
  deptSched: Record<string, DeptSched>; institutions: Record<string, string>;
  grace: number; dedupe: number; ignoreInvalid: boolean; lunchRule: boolean; capToSched: boolean; includeNoPunch: boolean; compact: boolean;
  meta: Meta;
}
export interface User { id: number; name: string; email: string; role: "admin" | "staff"; }
