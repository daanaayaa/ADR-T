import { useMemo, useState } from "react";

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MAIN_SYMPTOMS = ["Neuropathy","Nausea","Vomiting","Diarrhea"];
const SYMPTOM_KEY_TO_LABEL = { neuropathy:"Neuropathy", nausea:"Nausea", vomiting:"Vomiting", diarrhea:"Diarrhea" };

function getCellColor(count) {
  if (!count) return "";
  if (count >= 10) return "bg-red-100 text-red-700 font-bold";
  if (count >= 5)  return "bg-orange-100 text-orange-700 font-semibold";
  return "bg-blue-50 text-blue-700 font-semibold";
}

// ── helpers ──────────────────────────────────────────────────────────────────
function countADRsInRecord(rec) {
  let n = 0;
  Object.values(rec.symptoms || {}).forEach((g) => { if (g) n++; });
  (rec.otherSymptoms || []).forEach((s) => { if (s.grade) n++; });
  return n;
}
function countGrade3PlusInRecord(rec) {
  let n = 0;
  Object.values(rec.symptoms || {}).forEach((g) => { if (g >= 3) n++; });
  (rec.otherSymptoms || []).forEach((s) => { if (s.grade >= 3) n++; });
  return n;
}
function hasIntervention(rec) {
  return !!(rec.intervention && rec.intervention.trim());
}
// ─────────────────────────────────────────────────────────────────────────────

export default function Report() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [gradeFilter, setGradeFilter]   = useState("all");
  const [view, setView]                 = useState("symptom"); // "symptom" | "summary"

  // ── load records ────────────────────────────────────────────────────────────
  const allRecords = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("patientRecords") || "[]"); }
    catch { return []; }
  }, []);

  const availableYears = useMemo(() => {
    const ys = new Set([currentYear]);
    allRecords.forEach((r) => {
      if (r.date) { const y = new Date(r.date).getFullYear(); if (y >= 2020 && y <= currentYear + 5) ys.add(y); }
    });
    return Array.from(ys).sort((a, b) => b - a);
  }, [allRecords, currentYear]);

  const records = useMemo(
    () => allRecords.filter((r) => r.date && new Date(r.date).getFullYear() === selectedYear),
    [allRecords, selectedYear]
  );

  const MONTHS = useMemo(
    () => MONTH_NAMES.map((m, i) => ({ key: i + 1, label: `${m}-${String(selectedYear).slice(2)}` })),
    [selectedYear]
  );

  // ── symptom matrix ──────────────────────────────────────────────────────────
  const allSymptomNames = useMemo(() => {
    const extras = new Set();
    records.forEach((r) => (r.otherSymptoms || []).forEach((s) => { if (s.grade) extras.add(s.name); }));
    return [...MAIN_SYMPTOMS, ...Array.from(extras)];
  }, [records]);

  const matrix = useMemo(() => {
    const res = {};
    allSymptomNames.forEach((name) => { res[name] = {}; MONTHS.forEach(({ key }) => { res[name][key] = 0; }); });
    const gn = gradeFilter === "all" ? null : parseInt(gradeFilter);
    records.forEach((rec) => {
      const month = new Date(rec.date).getMonth() + 1;
      Object.entries(rec.symptoms || {}).forEach(([k, g]) => {
        if (!g) return; const label = SYMPTOM_KEY_TO_LABEL[k]; if (!label) return;
        if (gn && g !== gn) return;
        res[label][month] = (res[label][month] || 0) + 1;
      });
      (rec.otherSymptoms || []).forEach((s) => {
        if (!s.grade || !s.name) return; if (gn && s.grade !== gn) return;
        if (!res[s.name]) { res[s.name] = {}; MONTHS.forEach(({ key }) => { res[s.name][key] = 0; }); }
        res[s.name][month] = (res[s.name][month] || 0) + 1;
      });
    });
    return res;
  }, [records, gradeFilter, allSymptomNames, MONTHS]);

  const symptomTotals = useMemo(() => {
    const t = {};
    allSymptomNames.forEach((n) => { t[n] = MONTHS.reduce((s, { key }) => s + (matrix[n]?.[key] || 0), 0); });
    return t;
  }, [matrix, allSymptomNames, MONTHS]);

  const monthTotals = useMemo(() => {
    const t = {};
    MONTHS.forEach(({ key }) => { t[key] = allSymptomNames.reduce((s, n) => s + (matrix[n]?.[key] || 0), 0); });
    return t;
  }, [matrix, allSymptomNames, MONTHS]);

  const grandTotal = allSymptomNames.reduce((s, n) => s + (symptomTotals[n] || 0), 0);

  // ── monthly summary rows ────────────────────────────────────────────────────
  const summaryRows = useMemo(() => {
    return MONTHS.map(({ key, label }) => {
      const monthRecs = records.filter((r) => new Date(r.date).getMonth() + 1 === key);
      const visits    = monthRecs.length;                                          // visits = records that month
      const adrVisits = monthRecs.filter((r) => countADRsInRecord(r) > 0).length; // visits ที่พบ ADR
      const totalADR  = monthRecs.reduce((s, r) => s + countADRsInRecord(r), 0);  // จำนวน ADR events ทั้งหมด
      const g3plus    = monthRecs.reduce((s, r) => s + countGrade3PlusInRecord(r), 0); // CTCAE ≥3
      const interventionCount = monthRecs.filter(hasIntervention).length;           // visits ที่มี intervention

      return {
        label,
        visits,
        adrVisits,
        totalADR,
        adrPerVisit:   visits ? (totalADR / visits).toFixed(2) : "-",
        g3plus,
        g3Per100:      visits ? ((g3plus / visits) * 100).toFixed(1) : "-",
        interventionCount,
      };
    });
  }, [records, MONTHS]);

  const summaryFooter = useMemo(() => {
    const visits             = summaryRows.reduce((s, r) => s + r.visits, 0);
    const adrVisits          = summaryRows.reduce((s, r) => s + r.adrVisits, 0);
    const totalADR           = summaryRows.reduce((s, r) => s + r.totalADR, 0);
    const g3plus             = summaryRows.reduce((s, r) => s + r.g3plus, 0);
    const interventionCount  = summaryRows.reduce((s, r) => s + r.interventionCount, 0);
    return {
      visits, adrVisits, totalADR,
      adrPerVisit: visits ? (totalADR / visits).toFixed(2) : "-",
      g3plus,
      g3Per100:    visits ? ((g3plus / visits) * 100).toFixed(1) : "-",
      interventionCount,
    };
  }, [summaryRows]);

  // ── export ──────────────────────────────────────────────────────────────────
  const handleExport = () => {
    let csv = "";
    if (view === "symptom") {
      const header = ["อาการ", ...MONTHS.map((m) => m.label), "Total"].join(",");
      const rows   = allSymptomNames.map((n) => [n, ...MONTHS.map(({ key }) => matrix[n]?.[key] || 0), symptomTotals[n]].join(","));
      const footer = ["รวมทั้งหมด", ...MONTHS.map(({ key }) => monthTotals[key] || 0), grandTotal].join(",");
      csv = [header, ...rows, footer].join("\n");
    } else {
      const header = ["เดือน","Visits","Visits ที่พบ ADR","ADR ทั้งหมด","ADR/Visit","CTCAE≥3","CTCAE≥3 per 100 visit","Intervention"].join(",");
      const rows   = summaryRows.map((r) => [r.label,r.visits,r.adrVisits,r.totalADR,r.adrPerVisit,r.g3plus,r.g3Per100,r.interventionCount].join(","));
      const footer = ["รวม",summaryFooter.visits,summaryFooter.adrVisits,summaryFooter.totalADR,summaryFooter.adrPerVisit,summaryFooter.g3plus,summaryFooter.g3Per100,summaryFooter.interventionCount].join(",");
      csv = [header, ...rows, footer].join("\n");
    }
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `ADR_Report_${selectedYear}_${view}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  // ── shared header controls ──────────────────────────────────────────────────
  const Controls = (
    <div className="flex items-center gap-3 flex-wrap">
      {/* View toggle */}
      <div className="flex items-center bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        {[
          { id:"symptom", label:"ตารางอาการ" },
          { id:"summary", label:"สรุปรายเดือน" },
        ].map(({ id, label }) => (
          <button key={id} onClick={() => setView(id)}
            className={`px-4 py-2 text-xs font-bold transition-all ${view === id ? "bg-blue-700 text-white" : "text-slate-500 hover:bg-slate-100"}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Year */}
      <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm">
        <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75" />
        </svg>
        <span className="text-xs font-semibold text-slate-500">ปี:</span>
        <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}
          className="text-sm font-semibold border border-slate-200 rounded-lg px-2 py-1 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200">
          {availableYears.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* Grade (symptom view only) */}
      {view === "symptom" && (
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 mr-1">Grade:</span>
          {["all","1","2","3","4","5"].map((g) => (
            <button key={g} onClick={() => setGradeFilter(g)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${gradeFilter === g ? "bg-blue-700 text-white shadow-sm" : "text-slate-500 hover:bg-slate-100"}`}>
              {g === "all" ? "All" : g}
            </button>
          ))}
        </div>
      )}

      {/* Export */}
      <button onClick={handleExport}
        className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:border-blue-400 hover:text-blue-700 text-slate-600 text-sm font-semibold rounded-xl shadow-sm transition-all">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12M12 16.5V3" />
        </svg>
        Export CSV
      </button>
    </div>
  );

  // ── empty state ─────────────────────────────────────────────────────────────
  const EmptyState = (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <svg className="w-12 h-12 text-slate-200 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625z" />
      </svg>
      <p className="text-sm font-semibold text-slate-400">ไม่มีข้อมูลในปี {selectedYear}</p>
      <p className="text-xs text-slate-300 mt-1">บันทึกผลการประเมินเพื่อดูรายงาน</p>
    </div>
  );

  // ── render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">ADR Report</h1>
          <p className="text-sm text-slate-500 mt-0.5">รายงานอาการไม่พึงประสงค์จากเคมีบำบัด — ปี {selectedYear}</p>
        </div>
        {Controls}
      </div>

      {/* ══ VIEW 1: Symptom matrix ══════════════════════════════════════════════ */}
      {view === "symptom" && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-700">
              จำนวนอาการไม่พึงประสงค์รายเดือน — ปี {selectedYear}
              {gradeFilter !== "all" && <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-lg">Grade {gradeFilter} only</span>}
            </h2>
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-50 border border-blue-200 inline-block"/>1–4</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-100 border border-orange-200 inline-block"/>5–9</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-100 border border-red-200 inline-block"/>10+</span>
            </div>
          </div>
          {records.length === 0 ? EmptyState : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide w-40 sticky left-0 bg-slate-50 z-10">อาการ</th>
                    {MONTHS.map(({ label }) => (
                      <th key={label} className="text-center px-2 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide w-16">{label}</th>
                    ))}
                    <th className="text-center px-4 py-3 text-xs font-bold text-blue-700 uppercase tracking-wide w-16 bg-blue-50">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {allSymptomNames.map((name) => (
                    <tr key={name} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3 font-semibold text-slate-700 sticky left-0 bg-white z-10 border-r border-slate-100">{name}</td>
                      {MONTHS.map(({ key }) => {
                        const count = matrix[name]?.[key] || 0;
                        return (
                          <td key={key} className="text-center px-2 py-3">
                            {count > 0
                              ? <span className={`inline-flex items-center justify-center w-8 h-7 rounded-lg text-xs ${getCellColor(count)}`}>{count}</span>
                              : <span className="text-slate-200 text-xs">—</span>}
                          </td>
                        );
                      })}
                      <td className="text-center px-4 py-3 bg-blue-50">
                        <span className={`inline-flex items-center justify-center w-10 h-7 rounded-lg text-xs font-bold ${symptomTotals[name] > 0 ? "bg-blue-700 text-white" : "text-slate-300"}`}>
                          {symptomTotals[name] || 0}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-slate-50">
                    <td className="px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wide sticky left-0 bg-slate-50 z-10 border-r border-slate-100">รวมทั้งหมด</td>
                    {MONTHS.map(({ key }) => {
                      const count = monthTotals[key] || 0;
                      return (
                        <td key={key} className="text-center px-2 py-3">
                          <span className={`inline-flex items-center justify-center w-8 h-7 rounded-lg text-xs font-bold ${count > 0 ? "bg-slate-700 text-white" : "text-slate-300"}`}>
                            {count || "—"}
                          </span>
                        </td>
                      );
                    })}
                    <td className="text-center px-4 py-3 bg-blue-100">
                      <span className="inline-flex items-center justify-center w-10 h-7 rounded-lg text-xs font-bold bg-blue-700 text-white">{grandTotal}</span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══ VIEW 2: Monthly summary list ════════════════════════════════════════ */}
      {view === "summary" && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-700">สรุปผลรายเดือน — ปี {selectedYear}</h2>
            <p className="text-xs text-slate-400 mt-0.5">แต่ละแถว = 1 เดือน | CTCAE ≥3 = อาการระดับรุนแรง</p>
          </div>
          {records.length === 0 ? EmptyState : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wide">
                    <th className="text-left px-5 py-3 sticky left-0 bg-slate-50 z-10 w-24">เดือน</th>
                    <th className="text-center px-3 py-3">
                      <div>Visits</div>
                      <div className="font-normal text-slate-400 normal-case tracking-normal">(ใช้ยา)</div>
                    </th>
                    <th className="text-center px-3 py-3 bg-blue-50/60">
                      <div>Visits</div>
                      <div className="font-normal text-slate-400 normal-case tracking-normal">ที่พบ ADR</div>
                    </th>
                    <th className="text-center px-3 py-3 bg-blue-50/60">
                      <div>จำนวน ADR</div>
                      <div className="font-normal text-slate-400 normal-case tracking-normal">(events)</div>
                    </th>
                    <th className="text-center px-3 py-3 bg-blue-50/60">
                      <div>ADR / Visit</div>
                      <div className="font-normal text-slate-400 normal-case tracking-normal">(times/visit)</div>
                    </th>
                    <th className="text-center px-3 py-3 bg-orange-50/60">
                      <div>CTCAE ≥3</div>
                      <div className="font-normal text-slate-400 normal-case tracking-normal">(events)</div>
                    </th>
                    <th className="text-center px-3 py-3 bg-orange-50/60">
                      <div>CTCAE ≥3</div>
                      <div className="font-normal text-slate-400 normal-case tracking-normal">(per 100 visit)</div>
                    </th>
                    <th className="text-center px-3 py-3 bg-emerald-50/60">
                      <div>Intervention</div>
                      <div className="font-normal text-slate-400 normal-case tracking-normal">(visits)</div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {summaryRows.map((row) => (
                    <tr key={row.label} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3 font-bold text-slate-700 sticky left-0 bg-white z-10 border-r border-slate-100">{row.label}</td>

                      {/* Visits */}
                      <td className="text-center px-3 py-3">
                        {row.visits > 0
                          ? <span className="inline-flex items-center justify-center w-9 h-7 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700">{row.visits}</span>
                          : <span className="text-slate-200 text-xs">—</span>}
                      </td>

                      {/* Visits w/ ADR */}
                      <td className="text-center px-3 py-3 bg-blue-50/40">
                        {row.adrVisits > 0
                          ? <span className="inline-flex items-center justify-center w-9 h-7 rounded-lg text-xs font-semibold bg-blue-100 text-blue-700">{row.adrVisits}</span>
                          : <span className="text-slate-200 text-xs">—</span>}
                      </td>

                      {/* Total ADR events */}
                      <td className="text-center px-3 py-3 bg-blue-50/40">
                        {row.totalADR > 0
                          ? <span className={`inline-flex items-center justify-center w-9 h-7 rounded-lg text-xs font-semibold ${getCellColor(row.totalADR)}`}>{row.totalADR}</span>
                          : <span className="text-slate-200 text-xs">—</span>}
                      </td>

                      {/* ADR per visit */}
                      <td className="text-center px-3 py-3 bg-blue-50/40">
                        {row.adrPerVisit !== "-"
                          ? <span className="inline-flex items-center justify-center px-2 h-7 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700">{row.adrPerVisit}</span>
                          : <span className="text-slate-200 text-xs">—</span>}
                      </td>

                      {/* CTCAE ≥3 events */}
                      <td className="text-center px-3 py-3 bg-orange-50/40">
                        {row.g3plus > 0
                          ? <span className="inline-flex items-center justify-center w-9 h-7 rounded-lg text-xs font-semibold bg-orange-100 text-orange-700">{row.g3plus}</span>
                          : <span className="text-slate-200 text-xs">—</span>}
                      </td>

                      {/* CTCAE ≥3 per 100 visit */}
                      <td className="text-center px-3 py-3 bg-orange-50/40">
                        {row.g3Per100 !== "-" && row.g3plus > 0
                          ? <span className="inline-flex items-center justify-center px-2 h-7 rounded-lg text-xs font-semibold bg-orange-50 text-orange-700">{row.g3Per100}</span>
                          : <span className="text-slate-200 text-xs">—</span>}
                      </td>

                      {/* Intervention count */}
                      <td className="text-center px-3 py-3 bg-emerald-50/40">
                        {row.interventionCount > 0
                          ? <span className="inline-flex items-center justify-center w-9 h-7 rounded-lg text-xs font-semibold bg-emerald-100 text-emerald-700">{row.interventionCount}</span>
                          : <span className="text-slate-200 text-xs">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>

                {/* Footer totals */}
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-slate-50 text-xs font-bold text-slate-600">
                    <td className="px-5 py-3 sticky left-0 bg-slate-50 z-10 border-r border-slate-100 uppercase tracking-wide">รวมทั้งปี</td>

                    <td className="text-center px-3 py-3">
                      <span className="inline-flex items-center justify-center w-9 h-7 rounded-lg bg-slate-700 text-white text-xs">{summaryFooter.visits}</span>
                    </td>
                    <td className="text-center px-3 py-3 bg-blue-50/60">
                      <span className="inline-flex items-center justify-center w-9 h-7 rounded-lg bg-blue-700 text-white text-xs">{summaryFooter.adrVisits}</span>
                    </td>
                    <td className="text-center px-3 py-3 bg-blue-50/60">
                      <span className="inline-flex items-center justify-center w-9 h-7 rounded-lg bg-blue-700 text-white text-xs">{summaryFooter.totalADR}</span>
                    </td>
                    <td className="text-center px-3 py-3 bg-blue-50/60">
                      <span className="inline-flex items-center justify-center px-2 h-7 rounded-lg bg-blue-700 text-white text-xs">{summaryFooter.adrPerVisit}</span>
                    </td>
                    <td className="text-center px-3 py-3 bg-orange-50/60">
                      <span className="inline-flex items-center justify-center w-9 h-7 rounded-lg bg-orange-500 text-white text-xs">{summaryFooter.g3plus}</span>
                    </td>
                    <td className="text-center px-3 py-3 bg-orange-50/60">
                      <span className="inline-flex items-center justify-center px-2 h-7 rounded-lg bg-orange-500 text-white text-xs">{summaryFooter.g3Per100}</span>
                    </td>
                    <td className="text-center px-3 py-3 bg-emerald-50/60">
                      <span className="inline-flex items-center justify-center w-9 h-7 rounded-lg bg-emerald-600 text-white text-xs">{summaryFooter.interventionCount}</span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}