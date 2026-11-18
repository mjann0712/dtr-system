"use client";
import type { EmpResult, Settings } from "./types";
import { cellsFor, dur, isHolidayRow, mdy, periodLabel, schedText } from "./format";

export function saveBlob(filename: string, data: BlobPart, type = "application/octet-stream") {
  const blob = new Blob([data], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
}

/* ---------------- Excel: one sheet per department in the F-HR-810-010 layout ---------------- */
export async function dtrWorkbook(emps: EmpResult[], s: Settings, from: string, to: string): Promise<ArrayBuffer> {
  const ExcelJS = (await import("exceljs")).default;
  const meta = s.meta;
  const wb = new ExcelJS.Workbook(); wb.creator = "DTR System";
  const title = `DAILY TIME RECORD (${periodLabel(from, to)})`;
  const thin = { style: "thin" as const, color: { argb: "FF000000" } };
  const box = { top: thin, left: thin, bottom: thin, right: thin };
  const font = { name: "Arial", size: 9 }, bold = { name: "Arial", size: 9, bold: true };
  const fill = (argb: string) => ({ type: "pattern" as const, pattern: "solid" as const, fgColor: { argb } });

  function formHeader(ws: import("exceljs").Worksheet) {
    ws.mergeCells("A1:B3");
    ws.mergeCells("C1:E1"); ws.getCell("C1").value = meta.org || "DAILY TIME RECORD";
    ws.getCell("F1").value = "Document No."; ws.mergeCells("G1:H1"); ws.getCell("G1").value = meta.docNo || "";
    ws.mergeCells("I1:J1"); ws.getCell("I1").value = "Eff. Date"; ws.mergeCells("K1:M1"); ws.getCell("K1").value = meta.effDate || "";
    ws.mergeCells("C2:E2"); ws.getCell("C2").value = "FORMS";
    ws.getCell("F2").value = "Revision No."; ws.mergeCells("G2:H2"); ws.getCell("G2").value = meta.revNo ?? "0";
    ws.mergeCells("I2:J2"); ws.getCell("I2").value = "Pages"; ws.mergeCells("K2:M2"); ws.getCell("K2").value = "1 of 1";
    ws.mergeCells("C3:M3"); ws.getCell("C3").value = title;
    for (let r = 1; r <= 3; r++) for (let c = 1; c <= 13; c++) {
      const cell = ws.getCell(r, c); cell.border = box; cell.font = bold; cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    }
    ws.getCell("C1").font = { name: "Arial", size: 11, bold: true }; ws.getCell("C3").font = { name: "Arial", size: 11, bold: true };
  }
  const page = { paperSize: 9 as const, fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: "4:4", margins: { left: .3, right: .3, top: .4, bottom: .4, header: .2, footer: .2 } };

  // summary
  const sum = wb.addWorksheet("SUMMARY", { views: [{ state: "frozen", ySplit: 4 }], pageSetup: { ...page, orientation: "landscape" } });
  sum.columns = [14, 8, 30, 14, 10, 10, 11, 11, 10, 11, 11, 11, 12].map((width) => ({ width }));
  formHeader(sum); sum.getCell("C3").value = `DTR SUMMARY (${periodLabel(from, to)})`;
  const hr = sum.getRow(4);
  hr.values = ["DEPT", "AC#", "NAME", "INSTITUTION", "WORK DAYS", "PRESENT", "ABSENT (DAYS)", "HOURS WORKED", "TIMES LATE", "LATE (MINS)", "LATE (H:MM)", "UNDERTIME (MINS)", "INCOMPLETE"];
  hr.height = 28; hr.eachCell((c) => { c.font = bold; c.border = box; c.alignment = { horizontal: "center", vertical: "middle", wrapText: true }; c.fill = fill("FFE7ECF3"); });
  let rr = 5;
  for (const e of emps) {
    const t = e.totals, row = sum.getRow(rr++);
    row.values = [e.dept, Number(e.ac) || e.ac, e.name, e.inst, t.workdays, t.present, t.absent, t.worked / 1440, t.lateCount, t.late, t.late / 1440, t.early, t.incomplete];
    for (let i = 1; i <= 13; i++) { const c = row.getCell(i); c.font = font; c.border = box; if (![1, 3, 4].includes(i)) c.alignment = { horizontal: "center" }; }
    row.getCell(8).numFmt = "[h]:mm"; row.getCell(11).numFmt = "[h]:mm";
  }
  if (emps.length) {
    const tr = sum.getRow(rr); tr.getCell(3).value = "TOTAL";
    ["E", "F", "G", "H", "I", "J", "K", "L", "M"].forEach((L, i) => { tr.getCell(5 + i).value = { formula: `SUM(${L}5:${L}${rr - 1})` }; });
    tr.getCell(8).numFmt = "[h]:mm"; tr.getCell(11).numFmt = "[h]:mm";
    for (let i = 3; i <= 13; i++) { const c = tr.getCell(i); c.font = bold; c.border = box; if (i > 4) c.alignment = { horizontal: "center" }; }
  }
  sum.autoFilter = { from: "A4", to: `M${Math.max(4, rr - 1)}` };

  // one sheet per department
  const byDept = new Map<string, EmpResult[]>();
  for (const e of emps) { if (!byDept.has(e.dept)) byDept.set(e.dept, []); byDept.get(e.dept)!.push(e); }
  for (const [dept, list] of byDept) {
    const ws = wb.addWorksheet(dept.replace(/[\\/?*[\]:]/g, "-").slice(0, 31) || "DEPT", { views: [{ state: "frozen", ySplit: 4 }], pageSetup: { ...page, orientation: "portrait" } });
    ws.columns = [12, 6, 26, 11, 11, 11, 11, 11, 8, 7, 7, 8, 28].map((width) => ({ width }));
    formHeader(ws);
    const h = ws.getRow(4);
    h.values = ["DEPT", "AC#", "NAME", "DATE", "IN", "OUT", "IN", "OUT", "HOURS", "LATE", "EARLY", "ABSENT", "REMARKS"];
    h.eachCell((c) => { c.font = bold; c.border = box; c.alignment = { horizontal: "center", vertical: "middle" }; c.fill = fill("FFE7ECF3"); });
    let r = 5;
    for (const e of list) {
      const first = r;
      for (const d of e.rows) {
        const row = ws.getRow(r), t = cellsFor(d, s.compact), hol = isHolidayRow(d);
        row.values = [
          r === first ? e.dept : null, r === first ? (Number(e.ac) || e.ac) : null, r === first ? e.name : null, mdy(d.date),
          hol ? d.remarks[0] : t[0], hol ? null : t[1], hol ? null : t[2], hol ? null : t[3],
          d.worked ? d.worked / 1440 : null, d.late || null, d.early || null, d.absent || null,
          (hol ? d.remarks.slice(1) : d.remarks).join("; ") || null,
        ];
        for (let c = 1; c <= 13; c++) {
          const cell = row.getCell(c); cell.font = font; cell.border = box;
          if (c >= 2 && c <= 12 && c !== 3) cell.alignment = { horizontal: "center" };
          if (c === 13) cell.alignment = { wrapText: true, vertical: "top" };
        }
        row.getCell(9).numFmt = "[h]:mm";
        if (hol) { ws.mergeCells(`E${r}:H${r}`); row.getCell(5).font = bold; }
        if (d.remarks.includes("ABSENT")) row.getCell(13).font = { name: "Arial", size: 9, color: { argb: "FFB42318" } };
        r++;
      }
      const t = e.totals, tr = ws.getRow(r);
      tr.getCell(4).value = "TOTAL"; tr.getCell(9).value = t.worked / 1440; tr.getCell(9).numFmt = "[h]:mm";
      tr.getCell(10).value = t.late; tr.getCell(11).value = t.early; tr.getCell(12).value = t.absent;
      tr.getCell(13).value = `Late ${t.lateCount}x (${dur(t.late)})`;
      for (let c = 4; c <= 13; c++) { const cell = tr.getCell(c); cell.font = bold; cell.border = box; cell.fill = fill("FFF4F6F9"); if (c < 13) cell.alignment = { horizontal: "center" }; }
      r += 2;
    }
  }
  return wb.xlsx.writeBuffer() as Promise<ArrayBuffer>;
}

/* ---------------- PDF ---------------- */
async function newPdf(orientation: "portrait" | "landscape") {
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation });
  return { doc, autoTable };
}
function pdfHeader(doc: import("jspdf").jsPDF, s: Settings, subtitle: string) {
  const W = doc.internal.pageSize.getWidth(), m = s.meta;
  doc.setFont("helvetica", "bold"); doc.setFontSize(12);
  if (m.org) doc.text(m.org, W / 2, 36, { align: "center" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(8);
  doc.text(`${m.docNo || ""}  |  Rev. ${m.revNo ?? 0}${m.effDate ? "  |  Eff. " + m.effDate : ""}`, W / 2, 48, { align: "center" });
  doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.text(subtitle, W / 2, 66, { align: "center" });
}
function pageNumbers(doc: import("jspdf").jsPDF) {
  const n = doc.getNumberOfPages(), W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
  doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.setTextColor(110);
  for (let i = 1; i <= n; i++) { doc.setPage(i); doc.text(`Page ${i} of ${n}`, W - 40, H - 20, { align: "right" }); }
  doc.setTextColor(0);
}
type TableDoc = import("jspdf").jsPDF & { lastAutoTable: { finalY: number } };

export async function dtrPdf(emps: EmpResult[], s: Settings, from: string, to: string): Promise<ArrayBuffer> {
  const { doc, autoTable } = await newPdf("portrait");
  const d2 = doc as TableDoc;
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
  emps.forEach((e, i) => {
    if (i) doc.addPage();
    pdfHeader(doc, s, `DAILY TIME RECORD (${periodLabel(from, to)})`);
    autoTable(doc, {
      startY: 78, theme: "plain", styles: { fontSize: 8.5, cellPadding: 2 }, margin: { left: 40, right: 40 },
      body: [["Name", e.name, "AC#", e.ac], ["Department", e.dept, "Institution", e.inst], ["Schedule", schedText(e.sched), "Period", `${mdy(from)} - ${mdy(to)}`]],
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 62 }, 1: { cellWidth: 230 }, 2: { fontStyle: "bold", cellWidth: 62 } },
    });
    const body: unknown[][] = e.rows.map((d) => {
      const hol = isHolidayRow(d), t = cellsFor(d, s.compact);
      const times = hol ? [{ content: d.remarks[0], colSpan: 4, styles: { halign: "center", fontStyle: "bold" } }] : t;
      return [`${mdy(d.date).slice(0, 5)} ${d.dow}`, ...times, d.worked ? dur(d.worked) : "", d.late || "", d.early || "", d.absent || "", (hol ? d.remarks.slice(1) : d.remarks).join("; ")];
    });
    const tt = e.totals;
    body.push([{ content: "TOTAL", colSpan: 5, styles: { halign: "right", fontStyle: "bold" } },
      ...[dur(tt.worked), tt.late, tt.early, tt.absent, `Late ${tt.lateCount}x (${dur(tt.late)})`].map((c) => ({ content: String(c), styles: { fontStyle: "bold" } }))]);
    autoTable(doc, {
      startY: d2.lastAutoTable.finalY + 6, theme: "grid", margin: { left: 40, right: 40 }, rowPageBreak: "avoid",
      head: [["DATE", ...(s.compact ? ["IN", "OUT", "IN", "OUT"] : ["AM IN", "AM OUT", "PM IN", "PM OUT"]), "HOURS", "LATE", "EARLY", "ABSENT", "REMARKS"]],
      body: body as never,
      styles: { fontSize: 7.5, cellPadding: 2.2, halign: "center", lineColor: [60, 60, 60], lineWidth: .4, textColor: [20, 20, 20] },
      headStyles: { fillColor: [231, 236, 243], textColor: [20, 20, 20], fontStyle: "bold" },
      columnStyles: { 0: { halign: "left", cellWidth: 58 }, 9: { halign: "left", cellWidth: 110 } },
    });
    let y = d2.lastAutoTable.finalY + 14;
    if (y > H - 110) { doc.addPage(); y = 60; }
    doc.setFontSize(7.5); doc.setFont("helvetica", "italic");
    doc.text(doc.splitTextToSize("I certify on my honor that the above is a true and correct report of the hours of work performed, record of which was made daily at the time of arrival at and departure from office.", W - 80), 40, y);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
    const sy = y + 48, cw = (W - 80) / 3;
    ([["Employee", e.name], ["Verified by", s.meta.verifier || "Department Head"], ["Noted by", s.meta.noter || "HR Officer"]] as const).forEach(([lbl, nm], k) => {
      const x = 40 + k * cw + 8, w = cw - 16;
      doc.line(x, sy, x + w, sy);
      doc.setFont("helvetica", "bold"); doc.text(nm, x + w / 2, sy + 11, { align: "center", maxWidth: w });
      doc.setFont("helvetica", "normal"); doc.text(lbl, x + w / 2, sy + 22, { align: "center" });
    });
  });
  pageNumbers(doc);
  return doc.output("arraybuffer");
}

export async function summaryPdf(emps: EmpResult[], s: Settings, from: string, to: string, filterLabel: string): Promise<ArrayBuffer> {
  const { doc, autoTable } = await newPdf("landscape");
  pdfHeader(doc, s, `DTR SUMMARY (${periodLabel(from, to)})`);
  doc.setFontSize(8.5); doc.setFont("helvetica", "normal"); doc.text(filterLabel || "All employees", 40, 84);
  const T = emps.reduce((a, e) => { const t = e.totals; a.w += t.worked; a.l += t.late; a.lc += t.lateCount; a.e += t.early; a.a += t.absent; a.p += t.present; a.wd += t.workdays; a.i += t.incomplete; return a; }, { w: 0, l: 0, lc: 0, e: 0, a: 0, p: 0, wd: 0, i: 0 });
  const body: unknown[][] = emps.map((e) => { const t = e.totals; return [e.dept, e.ac, e.name, e.inst, t.workdays, t.present, t.absent, dur(t.worked), t.lateCount, dur(t.late), dur(t.early), t.incomplete || ""]; });
  body.push([{ content: `TOTAL (${emps.length} employees)`, colSpan: 4, styles: { fontStyle: "bold", halign: "right" } },
    ...[T.wd, T.p, T.a, dur(T.w), T.lc, dur(T.l), dur(T.e), T.i].map((c) => ({ content: String(c), styles: { fontStyle: "bold" } }))]);
  autoTable(doc, {
    startY: 92, theme: "grid", margin: { left: 40, right: 40 },
    head: [["DEPT", "AC#", "NAME", "INSTITUTION", "WORK DAYS", "PRESENT", "ABSENT", "HOURS", "TIMES LATE", "LATE (H:MM)", "UNDERTIME", "INCOMPLETE"]],
    body: body as never,
    styles: { fontSize: 7.5, cellPadding: 2.5, halign: "center", lineColor: [60, 60, 60], lineWidth: .4, textColor: [20, 20, 20] },
    headStyles: { fillColor: [231, 236, 243], textColor: [20, 20, 20], fontStyle: "bold" },
    columnStyles: { 0: { halign: "left" }, 2: { halign: "left", cellWidth: 170 }, 3: { halign: "left" } },
  });
  pageNumbers(doc);
  return doc.output("arraybuffer");
}

export async function employeesWorkbook(list: import("./types").Employee[]): Promise<ArrayBuffer> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("EMPLOYEES", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = [["EMPLOYEE ID", 13], ["LAST NAME", 20], ["FIRST NAME", 24], ["POSITION", 34], ["DEPT", 14], ["AC-NO.", 12], ["STATUS", 10], ["DATE HIRED", 12], ["GENDER", 9]].map(([header, width]) => ({ header: header as string, width: width as number }));
  list.forEach((e) => ws.addRow([e.employee_id, e.last_name, e.first_name, e.position, e.department, e.ac_nos.join(", "), e.status, e.date_hired, e.gender]));
  ws.getRow(1).font = { bold: true }; ws.autoFilter = { from: "A1", to: "I1" };
  return wb.xlsx.writeBuffer() as Promise<ArrayBuffer>;
}
