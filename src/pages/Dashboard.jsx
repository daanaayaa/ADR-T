import { useEffect, useState } from "react";

const THIS_MONTH = new Date().toISOString().slice(0, 7);

function monthLabel(ym) {
  const [y, m] = ym.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("th-TH", {
    month: "long",
    year: "numeric",
  });
}

function hasIntervention(r) { return r.note && r.note.trim() !== ""; }
function hasADR(r) {
  const main = Object.values(r.symptoms || {}).some((v) => v !== null);
  const other = (r.otherSymptoms || []).some((s) => s.grade !== null);
  return main || other;
}
function countGrade3Plus(r) {
  const main = Object.values(r.symptoms || {}).filter((v) => v >= 3).length;
  const other = (r.otherSymptoms || []).filter((s) => s.grade >= 3).length;
  return main + other;
}
function totalGrade3Events(records) {
  return records.reduce((sum, r) => sum + countGrade3Plus(r), 0);
}
function fmt2(n) { return isNaN(n) || !isFinite(n) ? "0.00" : n.toFixed(2); }
function getAvailableMonths(records) {
  const months = [...new Set(records.map((r) => (r.date || "").slice(0, 7)))]
    .filter(Boolean).sort().reverse();
  if (!months.includes(THIS_MONTH)) months.unshift(THIS_MONTH);
  return months;
}

/* ── SVG Bar Chart ── */
function BarChart({ data, color }) {
  if (!data.length) return <p className="text-slate-400 text-xs">ไม่มีข้อมูล</p>;
  const max = Math.max(...data.map((d) => d.value), 1);
  const W = 300, H = 110;
  const barW = Math.floor((W - 32) / data.length) - 6;
  const gap = (W - 32) / data.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", display: "block" }}>
      {data.map((d, i) => {
        const bh = Math.max(4, (d.value / max) * (H - 34));
        const x = 16 + i * gap + (gap - barW) / 2;
        const y = H - 22 - bh;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={bh} rx="3" fill={color} opacity="0.75" />
            <text x={x + barW / 2} y={H - 6} textAnchor="middle" fontSize="9" fill="#94a3b8">{d.label}</text>
            {d.value > 0 && (
              <text x={x + barW / 2} y={y - 3} textAnchor="middle" fontSize="9" fontWeight="700" fill={color}>{d.value}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/* ── SVG Donut ── */
function Donut({ value, total, color, label }) {
  const r = 36, cx = 44, cy = 44, sw = 9;
  const circ = 2 * Math.PI * r;
  const pct = total > 0 ? Math.min(value / total, 1) : 0;
  return (
    <svg viewBox="0 0 88 88" style={{ width: 88, height: 88 }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e2e8f0" strokeWidth={sw} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={sw}
        strokeDasharray={`${pct * circ} ${circ}`} strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`} />
      <text x={cx} y={cy - 3} textAnchor="middle" fontSize="14" fontWeight="700" fill={color}>{value}</text>
      <text x={cx} y={cy + 13} textAnchor="middle" fontSize="8" fill="#94a3b8">{label}</text>
    </svg>
  );
}

const METRIC_CARDS = (totalVisits, totalADR, adrRate, g3Events, g3Rate, interventions) => [
  {
    label: "Visit เดือนนี้", value: totalVisits, unit: "ครั้ง",
    desc: "จำนวน visit ที่ให้ยาเคมีบำบัด",
    accent: "border-blue-600", val: "text-blue-700", bg: "bg-blue-50",
    icon: (
      <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
    ),
  },
  {
    label: "ADR ที่พบ", value: totalADR, unit: "ราย",
    desc: "จำนวน ADR ที่พบในเดือนนี้",
    accent: "border-amber-500", val: "text-amber-600", bg: "bg-amber-50",
    icon: (
      <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
    ),
  },
  {
    label: "ADR Rate", value: fmt2(adrRate), unit: "ครั้ง/visit",
    desc: "อัตราการเกิด ADR ต่อ 1 visit",
    accent: "border-violet-500", val: "text-violet-700", bg: "bg-violet-50",
    icon: (
      <svg className="w-5 h-5 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
      </svg>
    ),
  },
  {
    label: "Grade ≥ 3 Events", value: g3Events, unit: "events",
    desc: "CTCAE grade 3 ขึ้นไป",
    accent: "border-red-600", val: "text-red-600", bg: "bg-red-50",
    icon: (
      <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    label: "Grade ≥ 3 Rate", value: fmt2(g3Rate), unit: "per 100 visits",
    desc: "อัตรา ADR grade ≥ 3",
    accent: "border-orange-500", val: "text-orange-600", bg: "bg-orange-50",
    icon: (
      <svg className="w-5 h-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
      </svg>
    ),
  },
  {
    label: "Intervention", value: interventions, unit: "ราย",
    desc: "ADR ที่มีการ intervention",
    accent: "border-teal-600", val: "text-teal-700", bg: "bg-teal-50",
    icon: (
      <svg className="w-5 h-5 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
  },
];

function Dashboard({ setPage }) {
  const [records, setRecords] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(THIS_MONTH);

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem("patientRecords") || "[]");
    setRecords(saved);
  }, []);

  const months = getAvailableMonths(records);
  const monthRec = records.filter((r) => (r.date || "").startsWith(selectedMonth));

  const totalVisits = monthRec.length;
  const totalADR = monthRec.filter(hasADR).length;
  const adrRate = totalVisits > 0 ? totalADR / totalVisits : 0;
  const g3Events = totalGrade3Events(monthRec);
  const g3Rate = totalVisits > 0 ? (g3Events / totalVisits) * 100 : 0;
  const interventions = monthRec.filter(hasIntervention).length;

  const last6 = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(); d.setMonth(d.getMonth() - (5 - i));
    return d.toISOString().slice(0, 7);
  });
  const visitBar = last6.map((ym) => ({
    label: new Date(ym + "-01").toLocaleDateString("th-TH", { month: "short" }),
    value: records.filter((r) => (r.date || "").startsWith(ym)).length,
  }));
  const adrBar = last6.map((ym) => ({
    label: new Date(ym + "-01").toLocaleDateString("th-TH", { month: "short" }),
    value: records.filter((r) => (r.date || "").startsWith(ym) && hasADR(r)).length,
  }));

  const SYMP_KEYS = ["neuropathy", "nausea", "vomiting", "diarrhea"];
  const sympFreq = SYMP_KEYS.map((k) => ({
    name: k.charAt(0).toUpperCase() + k.slice(1),
    count: monthRec.filter((r) => r.symptoms?.[k] != null).length,
  })).sort((a, b) => b.count - a.count);

  const otherFreq = (() => {
    const m = {};
    monthRec.forEach((r) => (r.otherSymptoms || []).forEach((s) => { if (s.grade) m[s.name] = (m[s.name] || 0) + 1; }));
    return Object.entries(m).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  })();
  const allFreq = [...sympFreq, ...otherFreq];
  const maxFreq = Math.max(...allFreq.map((s) => s.count), 1);

  const GCOL = { 1: "#16a34a", 2: "#ca8a04", 3: "#ea580c", 4: "#dc2626", 5: "#374151" };
  const GBG = { 1: "#dcfce7", 2: "#fef9c3", 3: "#ffedd5", 4: "#fee2e2", 5: "#f1f5f9" };
  const gradeDist = [1, 2, 3, 4, 5].map((g) => ({
    g,
    cnt: monthRec.reduce((s, r) =>
      s + Object.values(r.symptoms || {}).filter((v) => v === g).length
      + (r.otherSymptoms || []).filter((x) => x.grade === g).length, 0),
  }));
  const maxGrade = Math.max(...gradeDist.map((x) => x.cnt), 1);

  const cards = METRIC_CARDS(totalVisits, totalADR, adrRate, g3Events, g3Rate, interventions);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Monthly ADR Dashboard</h2>
          <p className="text-slate-500 text-sm mt-0.5">{monthLabel(selectedMonth)}</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          >
            {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
          <button
            onClick={() => setPage("assessment")}
            className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Assessment
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {cards.map((c) => (
          <div key={c.label} className={`bg-white rounded-xl border-t-4 ${c.accent} border border-slate-100 p-5 shadow-sm`}>
            <div className="flex items-start justify-between mb-3">
              <div className={`w-9 h-9 rounded-lg ${c.bg} flex items-center justify-center`}>{c.icon}</div>
              <div className="text-right">
                <div className={`text-2xl font-bold ${c.val}`}>{c.value}</div>
                <div className={`text-xs font-semibold ${c.val} opacity-70`}>{c.unit}</div>
              </div>
            </div>
            <div className="text-sm font-semibold text-slate-700">{c.label}</div>
            <div className="text-xs text-slate-400 mt-0.5">{c.desc}</div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-slate-700">Visit Trend</span>
            <span className="text-xs text-slate-400">6 เดือนย้อนหลัง</span>
          </div>
          <BarChart data={visitBar} color="#697ea0" />
        </div>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-slate-700">ADR Trend</span>
            <span className="text-xs text-slate-400">6 เดือนย้อนหลัง</span>
          </div>
          <BarChart data={adrBar} color="#7f9bd1" />
        </div>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-slate-700">สรุปเดือนนี้</span>
            <span className="text-xs text-slate-400">{monthLabel(selectedMonth)}</span>
          </div>
          <div className="flex justify-around items-center">
            {[
              { value: totalADR, total: Math.max(totalVisits, 1), color: "#f59e0b", label: "ADR", sub: `จาก ${totalVisits} visit` },
              { value: interventions, total: Math.max(totalADR, 1), color: "#0d9488", label: "Interv.", sub: `จาก ${totalADR} ADR` },
              { value: g3Events, total: Math.max(g3Events + 4, 1), color: "#ef4444", label: "G≥3", sub: "Grade ≥ 3" },
            ].map((d) => (
              <div key={d.label} className="flex flex-col items-center gap-1">
                <Donut {...d} />
                <span className="text-xs text-slate-400">{d.sub}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-2 gap-4">
        {/* Symptom Frequency */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-slate-700">ความถี่อาการ</span>
            <span className="text-xs text-slate-400">เดือนนี้</span>
          </div>
          {allFreq.length === 0 ? (
            <p className="text-slate-400 text-xs">ไม่มีข้อมูล</p>
          ) : (
            <div className="space-y-3">
              {allFreq.map((s) => (
                <div key={s.name} className="flex items-center gap-3">
                  <span className="text-xs text-slate-600 w-28 shrink-0 truncate">{s.name}</span>
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${(s.count / maxFreq) * 100}%` }} />
                  </div>
                  <span className="text-xs font-bold text-slate-500 w-4 text-right">{s.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Grade Distribution */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-slate-700">Grade Distribution</span>
            <span className="text-xs text-slate-400">เดือนนี้</span>
          </div>
          <div className="space-y-3">
            {gradeDist.map(({ g, cnt }) => (
              <div key={g} className="flex items-center gap-3">
                <span className="text-xs font-bold w-8 shrink-0 px-1.5 py-0.5 rounded text-center" style={{ background: GBG[g], color: GCOL[g] }}>G{g}</span>
                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${(cnt / maxGrade) * 100}%`, background: GCOL[g] }} />
                </div>
                <span className="text-xs text-slate-500 w-16 text-right">{cnt} events</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
