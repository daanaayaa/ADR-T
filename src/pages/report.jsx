import { useMemo, useState, useEffect } from "react";
import {
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import {
  C, GRADE_HEX, GRADE_CLS, MONTH_NAMES,
  countADRs, countG3plus, buildBreakdown, calcStats, getCellShade,
  Section, SectionHead, MultiRegimenSelect, GradePill, ProgressBar,
  ChartTooltip, EmptyChart,
  MonthlyRateCharts, MonthlyCountCharts,
  GradeDist, SymptomMatrix, MonthlySummaryTable,
} from "./ReportTokens";
import { recordApi } from "../services/api";

/* ════════════════════════════════════════════════════════════
   LOADING SKELETON
════════════════════════════════════════════════════════════ */
function Skeleton({ h = 20, w = "100%", radius = 6 }) {
  return (
    <div style={{
      height: h, width: w, borderRadius: radius,
      background: "linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%)",
      backgroundSize: "200% 100%",
      animation: "shimmer 1.4s infinite",
    }} />
  );
}

/* ════════════════════════════════════════════════════════════
   COMPARE VIEW  (ไม่เปลี่ยน logic — รับ allRecords จาก parent)
════════════════════════════════════════════════════════════ */
function CompareView({ allRegimens, groups, setGroups, allRecords }) {
  const GROUP_META = [
    { key:0, label:"กลุ่ม A", accentColor:"blue",   border:"border-[#bfdbfe]", head:"text-[#0f4c81]", dot:"bg-[#0f4c81]", barFill:"#0f4c81" },
    { key:1, label:"กลุ่ม B", accentColor:"violet", border:"border-[#c7c7e8]", head:"text-[#5b5ea6]", dot:"bg-[#5b5ea6]", barFill:"#5b5ea6" },
    { key:2, label:"กลุ่ม C", accentColor:"teal",   border:"border-[#a5f3fc]", head:"text-[#0e7490]", dot:"bg-[#0e7490]", barFill:"#0e7490" },
  ];

  const setGroupRegimens = (idx, regimens) =>
    setGroups(prev => prev.map((g, i) => i === idx ? { ...g, regimens } : g));

  const groupData = useMemo(() => groups.map(g => {
    const recs  = allRecords.filter(r => g.regimens.includes(r.regimen));
    const stats = calcStats(recs);
    return { recs, stats };
  }), [groups, allRecords]);

  const activeGroups = groups
    .map((g, i) => ({ ...g, ...groupData[i], meta: GROUP_META[i] }))
    .filter(g => g.regimens.length > 0);

  const ready = activeGroups.length >= 2;

  const allNames = useMemo(() => {
    const s = new Set();
    activeGroups.forEach(g => Object.keys(g.stats.breakdown).forEach(n => s.add(n)));
    return Array.from(s).sort();
  }, [activeGroups]);

  const gradeData = [1, 2, 3, 4, 5].map(g => {
    const obj = { grade: `G${g}` };
    activeGroups.forEach((ag, i) => {
      const bd = ag.stats.breakdown;
      let cnt = 0;
      Object.values(bd).forEach(v => { if (typeof v === "object") cnt += (v[g] || 0); });
      obj[`G${i}`] = cnt;
    });
    return obj;
  });

  const METRIC_KEYS = [
    { label:"Visits",               get: s => s.visits,      lower:false },
    { label:"ADR Events",           get: s => s.totalADR,    lower:true  },
    { label:"ADR / Visit",          get: s => s.adrRate,     lower:true  },
    { label:"Visits ที่พบ ADR (%)", get: s => s.adrPct+"%",  lower:true  },
    { label:"Severe ≥G3",           get: s => s.g3plus,      lower:true  },
    { label:"G3 /100 Visit",        get: s => s.g3Per100,    lower:true  },
  ];

  const cmpChip = (val, rank, total) => {
    const isBest  = rank === 0;
    const isWorst = rank === total - 1 && total > 1;
    const cls = isWorst ? "bg-[#fff1f2] text-[#9f1239] border-[#fecdd3]"
              : isBest  ? "bg-[#f0fdf4] text-[#166534] border-[#bbf7d0]"
              :            "bg-[#f8fafc] text-[#475569] border-[#e2e8f0]";
    return (
      <span className={`inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-sm font-semibold border min-w-[52px] ${cls}`}
            style={{ fontFamily:"'IBM Plex Mono', monospace" }}>
        {val}
      </span>
    );
  };

  const usedByOthers = (selfIdx) => groups.flatMap((g, i) => i !== selfIdx ? g.regimens : []);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {GROUP_META.map((meta, idx) => {
          const g = groups[idx];
          return (
            <div key={idx} className={`bg-white border ${meta.border} rounded-xl p-4 shadow-sm`}>
              <div className="flex items-center justify-between mb-3">
                <p className={`text-[11px] font-bold ${meta.head} uppercase tracking-widest`}>{meta.label}</p>
                {g.regimens.length > 0 && (
                  <button onClick={() => setGroupRegimens(idx, [])}
                    className="text-[11px] text-[#94a3b8] hover:text-[#be123c] font-semibold transition-colors px-1.5 py-0.5 rounded hover:bg-[#fff1f2]">
                    ล้าง
                  </button>
                )}
              </div>
              <MultiRegimenSelect
                values={g.regimens}
                onChange={vals => setGroupRegimens(idx, vals)}
                options={allRegimens.filter(r => !usedByOthers(idx).includes(r))}
                placeholder={`เพิ่มสูตรยาใน${meta.label}...`}
                accentColor={meta.accentColor}
              />
              {g.regimens.length > 0 && (
                <p className="mt-2 text-[11px] font-medium" style={{ color: meta.barFill }}>
                  {groupData[idx].recs.length} visits
                </p>
              )}
            </div>
          );
        })}
      </div>

      {!ready && (
        <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-sm p-16 text-center">
          <div className="w-12 h-12 bg-[#f1f5f9] rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-[#94a3b8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"/>
            </svg>
          </div>
          <p className="text-sm font-semibold text-[#475569]">เลือกสูตรยาอย่างน้อย 2 กลุ่มเพื่อเปรียบเทียบ</p>
          <p className="text-xs text-[#94a3b8] mt-1">แต่ละกลุ่มสามารถเลือกสูตรยาได้หลายตัว</p>
        </div>
      )}

      {ready && (
        <>
          <div className="flex items-center gap-5 px-1 flex-wrap">
            {activeGroups.map((ag, i) => (
              <span key={i} className="flex items-center gap-2 text-xs font-semibold" style={{ color: ag.meta.barFill }}>
                <span className="w-4 h-1.5 rounded-full inline-block" style={{ background: ag.meta.barFill }} />
                {ag.regimens.join(" + ")}
                <span className="font-normal text-[#94a3b8]">({ag.recs.length} visits)</span>
              </span>
            ))}
            <span className="ml-auto flex gap-3 text-xs text-[#94a3b8]">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-[#fff1f2] border border-[#fecdd3] inline-block" />สูงสุด
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-[#f0fdf4] border border-[#bbf7d0] inline-block" />ต่ำสุด
              </span>
            </span>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Section>
              <SectionHead title="Key Metrics" sub="เปรียบเทียบตัวชี้วัดหลัก" />
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[#f8fafc] border-b border-[#e2e8f0]">
                      <th className="text-left px-4 py-2.5 font-bold text-[#64748b] uppercase tracking-wide w-32">ตัวชี้วัด</th>
                      {activeGroups.map((ag, i) => (
                        <th key={i} className="text-center px-3 py-2.5 font-bold" style={{ color: ag.meta.barFill }}>
                          {ag.meta.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f1f5f9]">
                    {METRIC_KEYS.map(({ label, get, lower }) => {
                      const vals   = activeGroups.map(ag => get(ag.stats));
                      const nums   = vals.map(v => parseFloat(v));
                      const valid  = nums.every(n => !isNaN(n));
                      const sorted = valid ? [...nums].sort((a, b) => lower ? a - b : b - a) : [];
                      const getRank = (v) => valid ? sorted.indexOf(parseFloat(v)) : -1;
                      return (
                        <tr key={label} className="hover:bg-[#f8fafc]">
                          <td className="px-4 py-2.5 font-medium text-[#475569]">{label}</td>
                          {activeGroups.map((ag, i) => (
                            <td key={i} className="text-center px-3 py-2">
                              {cmpChip(get(ag.stats), getRank(get(ag.stats)), activeGroups.length)}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Section>

            <Section>
              <SectionHead title="Grade Distribution" sub="จำนวน events แต่ละ Grade" />
              <div className="p-4">
                {gradeData.every(d => activeGroups.every((_, i) => (d[`G${i}`] || 0) === 0))
                  ? <EmptyChart />
                  : (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={gradeData} margin={{ top:5, right:10, left:-20, bottom:0 }} barGap={3}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="grade" tick={{ fontSize:11, fill:"#64748b" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize:10, fill:"#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} />
                        <Tooltip content={<ChartTooltip />} cursor={{ fill:"#f8fafc" }} />
                        {activeGroups.map((ag, i) => (
                          <Bar key={i} dataKey={`G${i}`} name={ag.meta.label} fill={ag.meta.barFill} radius={[3,3,0,0]} maxBarSize={22} />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  )}
              </div>
            </Section>
          </div>

          <Section>
            <SectionHead title="Symptom Detail Comparison" sub="เปรียบเทียบอาการรายชนิด" />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#f8fafc] border-b border-[#e2e8f0] text-[11px] font-bold text-[#64748b] uppercase tracking-wide">
                    <th className="text-left px-5 py-3 sticky left-0 bg-[#f8fafc] z-10">อาการ</th>
                    {activeGroups.map((ag, i) =>
                      ["G1","G2","G3","G4","G5","รวม"].map(g =>
                        <th key={`${i}-${g}`} className="text-center px-2 py-3"
                          style={{ background:`${ag.meta.barFill}0a` }}>{g}</th>
                      )
                    )}
                  </tr>
                  <tr className="text-xs border-b border-[#e2e8f0]">
                    <th className="px-5 py-1.5 text-left sticky left-0 bg-white" />
                    {activeGroups.map((ag, i) => (
                      <th key={i} colSpan={6} className="text-center font-semibold py-1.5"
                        style={{ color: ag.meta.barFill, background:`${ag.meta.barFill}08` }}>
                        {ag.meta.label}{ag.regimens.length > 1 ? ` (${ag.regimens.length} สูตร)` : ag.regimens[0] ? `: ${ag.regimens[0]}` : ""}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f5f9]">
                  {allNames.length === 0 ? (
                    <tr>
                      <td colSpan={1 + activeGroups.length * 6}
                        className="py-10 text-center text-sm text-[#94a3b8]">ไม่พบข้อมูลอาการ</td>
                    </tr>
                  ) : allNames.map((name, ri) => {
                    const bds = activeGroups.map(ag => ag.stats.breakdown[name] || { 1:0,2:0,3:0,4:0,5:0,total:0 });
                    const maxTotal = Math.max(...bds.map(b => b.total));
                    return (
                      <tr key={name}
                        className={`hover:bg-[#f8fafc] transition-colors ${ri % 2 === 0 ? "bg-white" : "bg-[#f8fafc]/40"}`}>
                        <td className="px-5 py-2 font-medium text-[#334155] text-xs sticky left-0 bg-inherit border-r border-[#e2e8f0]">{name}</td>
                        {bds.map((bd, gi) => (
                          <span key={gi} style={{ display:"contents" }}>
                            {[1,2,3,4,5].map(g => (
                              <td key={`${gi}-g${g}`} className="text-center px-2 py-2"
                                style={{ background:`${activeGroups[gi].meta.barFill}08` }}>
                                {bd[g] > 0
                                  ? <span className="text-xs font-bold" style={{ color: GRADE_HEX[g] }}>{bd[g]}</span>
                                  : <span className="text-[#e2e8f0] text-xs">·</span>}
                              </td>
                            ))}
                            <td key={`${gi}-total`} className="text-center px-2 py-2"
                              style={{ background:`${activeGroups[gi].meta.barFill}12` }}>
                              <span className="inline-flex items-center justify-center w-8 h-6 rounded-md text-xs font-bold"
                                style={bd.total > 0 && bd.total === maxTotal
                                  ? { background: activeGroups[gi].meta.barFill, color:"#fff" }
                                  : bd.total > 0
                                    ? { background:`${activeGroups[gi].meta.barFill}22`, color: activeGroups[gi].meta.barFill }
                                    : { color:"#cbd5e1" }}>
                                {bd.total || "·"}
                              </span>
                            </td>
                          </span>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Section>
        </>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   MAIN COMPONENT — ดึงข้อมูลจาก PostgreSQL API
════════════════════════════════════════════════════════════ */
export default function Report() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [gradeFilter,  setGradeFilter]  = useState("all");
  const [view,         setView]         = useState("dashboard");
  const [groups,       setGroups]       = useState([
    { label:"A", regimens:[] },
    { label:"B", regimens:[] },
    { label:"C", regimens:[] },
  ]);

  // ── API state ──
  const [allRecords, setAllRecords] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState("");

  // ── Fetch ALL records for the selected year ──
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    recordApi.getAll({ year: selectedYear })
      .then(data => {
        if (cancelled) return;
        // normalise: API returns snake_case — map record_date → date, patient_name → patientName
        const normalised = data.map(r => ({
          ...r,
          date:        r.record_date   || r.date        || "",
          patientName: r.patient_name  || r.patientName || "",
          regimen:     r.regimen       || (r.drugs ? [...r.drugs].sort().join(" + ") : "-"),
          // symptoms ส่งมาจาก API เป็น object { key: { label, grade, description } }
          symptoms:    r.symptoms      || {},
        }));
        setAllRecords(normalised);
        setLoading(false);
      })
      .catch(err => {
        if (!cancelled) { setError(err.message); setLoading(false); }
      });

    return () => { cancelled = true; };
  }, [selectedYear]);

  // ── Derive years from data (fallback: current year only) ──
  const availableYears = useMemo(() => {
    const ys = new Set([currentYear]);
    allRecords.forEach(r => {
      if (r.date) {
        const y = new Date(r.date).getFullYear();
        if (y >= 2020 && y <= currentYear + 5) ys.add(y);
      }
    });
    return Array.from(ys).sort((a, b) => b - a);
  }, [allRecords, currentYear]);

  // ── Filter by year (API already filters, but guard here too) ──
  const records = useMemo(
    () => allRecords.filter(r => r.date && new Date(r.date).getFullYear() === selectedYear),
    [allRecords, selectedYear]
  );

  const MONTHS = useMemo(
    () => MONTH_NAMES.map((m, i) => ({ key: i + 1, label: `${m}-${String(selectedYear).slice(2)}` })),
    [selectedYear]
  );

  // ── Symptom matrix ──
  const allSymptomNames = useMemo(() => {
    const names = new Set();
    records.forEach(r => {
      Object.entries(r.symptoms || {}).forEach(([k, v]) => {
        const g = typeof v === "object" ? v?.grade : v;
        if (!g) return;
        const label = typeof v === "object" ? (v.label || k) : k;
        names.add(label);
      });
    });
    return Array.from(names).sort();
  }, [records]);

  const matrix = useMemo(() => {
    const res = {};
    allSymptomNames.forEach(n => { res[n] = {}; MONTHS.forEach(({ key }) => { res[n][key] = 0; }); });
    const gn = gradeFilter === "all" ? null : parseInt(gradeFilter);
    records.forEach(rec => {
      const month = new Date(rec.date).getMonth() + 1;
      Object.entries(rec.symptoms || {}).forEach(([k, v]) => {
        const g = typeof v === "object" ? v?.grade : v;
        if (!g) return;
        if (gn && g !== gn) return;
        const label = typeof v === "object" ? (v.label || k) : k;
        if (!res[label]) { res[label] = {}; MONTHS.forEach(({ key }) => { res[label][key] = 0; }); }
        res[label][month] = (res[label][month] || 0) + 1;
      });
    });
    return res;
  }, [records, gradeFilter, allSymptomNames, MONTHS]);

  const symptomTotals = useMemo(() => {
    const t = {};
    allSymptomNames.forEach(n => { t[n] = MONTHS.reduce((s, { key }) => s + (matrix[n]?.[key] || 0), 0); });
    return t;
  }, [matrix, allSymptomNames, MONTHS]);

  const monthTotals = useMemo(() => {
    const t = {};
    MONTHS.forEach(({ key }) => { t[key] = allSymptomNames.reduce((s, n) => s + (matrix[n]?.[key] || 0), 0); });
    return t;
  }, [matrix, allSymptomNames, MONTHS]);

  const grandTotal = allSymptomNames.reduce((s, n) => s + (symptomTotals[n] || 0), 0);

  const summaryRows = useMemo(() => MONTHS.map(({ key, label }) => {
    const mr = records.filter(r => new Date(r.date).getMonth() + 1 === key);
    const visits    = mr.length;
    const adrVisits = mr.filter(r => countADRs(r) > 0).length;
    const totalADR  = mr.reduce((s, r) => s + countADRs(r), 0);
    const g3plus    = mr.reduce((s, r) => s + countG3plus(r), 0);
    return {
      label, visits, adrVisits, totalADR,
      adrPerVisit: visits ? (totalADR / visits).toFixed(2) : "-",
      g3plus,
      g3Per100: visits ? ((g3plus / visits) * 100).toFixed(1) : "-",
    };
  }), [records, MONTHS]);

  const summaryFooter = useMemo(() => {
    const visits    = summaryRows.reduce((s, r) => s + r.visits, 0);
    const adrVisits = summaryRows.reduce((s, r) => s + r.adrVisits, 0);
    const totalADR  = summaryRows.reduce((s, r) => s + r.totalADR, 0);
    const g3plus    = summaryRows.reduce((s, r) => s + r.g3plus, 0);
    return {
      visits, adrVisits, totalADR,
      adrPerVisit: visits ? (totalADR / visits).toFixed(2) : "-",
      g3plus,
      g3Per100: visits ? ((g3plus / visits) * 100).toFixed(1) : "-",
    };
  }, [summaryRows]);

  const allRegimens = useMemo(() => {
    const s = new Set();
    allRecords.forEach(r => { if (r.regimen && r.regimen !== "-") s.add(r.regimen); });
    return Array.from(s).sort();
  }, [allRecords]);

  const activeGroups = groups.filter(g => g.regimens.length > 0);

  // ── CSV Export ──
  const handleExport = () => {
    let csv = "";
    if (view === "symptom") {
      const h = ["อาการ", ...MONTHS.map(m => m.label), "Total"].join(",");
      const r = allSymptomNames.map(n => [n, ...MONTHS.map(({ key }) => matrix[n]?.[key] || 0), symptomTotals[n]].join(","));
      const f = ["รวม", ...MONTHS.map(({ key }) => monthTotals[key] || 0), grandTotal].join(",");
      csv = [h, ...r, f].join("\n");
    } else if (view === "summary") {
      const h = ["เดือน","Visits","Visits+ADR","ADR","ADR/Visit","G3+","G3+/100v"].join(",");
      const r = summaryRows.map(row => [row.label, row.visits, row.adrVisits, row.totalADR, row.adrPerVisit, row.g3plus, row.g3Per100].join(","));
      const f = ["รวม", summaryFooter.visits, summaryFooter.adrVisits, summaryFooter.totalADR, summaryFooter.adrPerVisit, summaryFooter.g3plus, summaryFooter.g3Per100].join(",");
      csv = [h, ...r, f].join("\n");
    } else if (view === "compare" && activeGroups.length >= 2) {
      const labels     = ["A","B","C"].slice(0, activeGroups.length);
      const groupStats = activeGroups.map(g => calcStats(allRecords.filter(r => g.regimens.includes(r.regimen))));
      const allN       = Array.from(new Set(groupStats.flatMap(s => Object.keys(s.breakdown)))).sort();
      const h = ["อาการ", ...labels.flatMap(l => [`${l}-รวม`, ...[1,2,3,4,5].map(g => `${l}-G${g}`)])].join(",");
      const r = allN.map(n => [n, ...groupStats.flatMap(s => { const b = s.breakdown[n] || {}; return [b.total || 0, ...[1,2,3,4,5].map(g => b[g] || 0)]; })].join(","));
      csv = [h, ...r].join("\n");
    }
    if (!csv) return;
    const blob = new Blob(["\uFEFF" + csv], { type:"text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `ADR_Report_${selectedYear}_${view}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const TABS = [
    { id:"dashboard", label:"Dashboard" },
    { id:"symptom",   label:"Symptom Matrix" },
    { id:"summary",   label:"Monthly Summary" },
    { id:"compare",   label:"Compare Regimen" },
  ];

  return (
    <div className="space-y-5 pb-8" style={{ fontFamily:"'IBM Plex Sans', sans-serif" }}>
      <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>

      {/* ── Header row ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background:"#0f4c81" }}>
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z"/>
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[18px] font-bold text-[#0f172a] tracking-[-0.01em]">ADR Analytics</h1>
              <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold"
                style={{ background:"#eff6ff", color:"#0f4c81" }}>CLINICAL</span>
            </div>
            <p className="text-[11px] text-[#94a3b8] mt-0.5 font-medium">
              Adverse Drug Reaction · Pharmacovigilance Dashboard
              {loading && <span className="ml-2 text-[#b0bec5]">· กำลังโหลดข้อมูล...</span>}
              {!loading && !error && <span className="ml-2 text-[#b0bec5]">· {allRecords.length} records</span>}
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {view !== "compare" && (
            <div className="flex items-center gap-1.5 bg-white border border-[#e2e8f0] rounded-lg px-3 py-2 shadow-sm">
              <svg className="w-3.5 h-3.5 text-[#94a3b8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75"/>
              </svg>
              <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}
                className="text-[13px] font-semibold border-0 bg-transparent text-[#334155] outline-none cursor-pointer">
                {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          )}
          {(view !== "compare" || (view === "compare" && activeGroups.length >= 2)) && (
            <button onClick={handleExport} disabled={loading || records.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-[#e2e8f0]
                         hover:border-[#bfdbfe] hover:text-[#0f4c81] text-[#64748b] text-xs font-semibold
                         rounded-lg shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12M12 16.5V3"/>
              </svg>
              Export CSV
            </button>
          )}
        </div>
      </div>

      {/* ── Error Banner ── */}
      {error && (
        <div className="flex items-center gap-3 px-4 py-3 bg-[#fff1f2] border border-[#fecdd3] rounded-xl text-sm text-[#9f1239] font-medium">
          <span>⚠️</span>
          <span>ไม่สามารถโหลดข้อมูลได้: {error}</span>
          <button
            onClick={() => { setError(""); setLoading(true); recordApi.getAll({ year: selectedYear }).then(d => { setAllRecords(d); setLoading(false); }).catch(e => { setError(e.message); setLoading(false); }); }}
            className="ml-auto text-[11px] border border-[#fca5a5] rounded-lg px-3 py-1 hover:bg-[#fecdd3] transition">
            ลองใหม่
          </button>
        </div>
      )}

      {/* ── Tab bar ── */}
      <div className="flex bg-white border border-[#e2e8f0] rounded-xl p-1 gap-1 shadow-sm w-fit">
        {TABS.map(({ id, label }) => (
          <button key={id} onClick={() => setView(id)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap
              ${view === id ? "text-white shadow-sm" : "text-[#64748b] hover:bg-[#f8fafc] hover:text-[#334155]"}`}
            style={view === id ? { background:"#0f4c81" } : {}}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Loading skeleton ── */}
      {loading && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
            <div className="bg-white rounded-xl border border-[#e2e8f0] p-5 space-y-3">
              <Skeleton h={14} w="60%" /><Skeleton h={120} radius={10} />
            </div>
            <div className="bg-white rounded-xl border border-[#e2e8f0] p-5 lg:col-span-3 space-y-3">
              <Skeleton h={14} w="40%" /><Skeleton h={150} radius={10} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="bg-white rounded-xl border border-[#e2e8f0] p-5 space-y-3">
              <Skeleton h={14} w="50%" /><Skeleton h={200} radius={10} />
            </div>
            <div className="bg-white rounded-xl border border-[#e2e8f0] p-5 space-y-3">
              <Skeleton h={14} w="50%" /><Skeleton h={200} radius={10} />
            </div>
          </div>
        </div>
      )}

      {/* ── Views ── */}
      {!loading && view === "dashboard" && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
            <GradeDist records={records} />
            <MonthlyCountCharts records={records} MONTHS={MONTHS} />
          </div>
          <MonthlyRateCharts records={records} MONTHS={MONTHS} />
        </div>
      )}

      {!loading && view === "symptom" && (
        <SymptomMatrix
          matrix={matrix} allSymptomNames={allSymptomNames} MONTHS={MONTHS}
          symptomTotals={symptomTotals} monthTotals={monthTotals} grandTotal={grandTotal}
          gradeFilter={gradeFilter} setGradeFilter={setGradeFilter}
        />
      )}

      {!loading && view === "summary" && (
        records.length === 0
          ? <Section><div className="py-20 text-center text-sm text-[#94a3b8]">ไม่มีข้อมูลในปี {selectedYear}</div></Section>
          : <MonthlySummaryTable summaryRows={summaryRows} summaryFooter={summaryFooter} />
      )}

      {!loading && view === "compare" && (
        <CompareView
          allRegimens={allRegimens}
          groups={groups}
          setGroups={setGroups}
          allRecords={allRecords}
        />
      )}

      {/* Footer */}
      <div className="flex justify-between items-center pt-2 border-t border-[#e2e8f0]">
        <span className="text-[11px] text-[#cbd5e1]"
              style={{ fontFamily:"'IBM Plex Mono', monospace" }}>ADR-MON v2.0 · CTCAE v6.0 · PostgreSQL</span>
        <span className="text-[11px] text-[#cbd5e1]">ข้อมูลนี้ใช้สำหรับการติดตามภายในเท่านั้น</span>
      </div>
    </div>
  );
}