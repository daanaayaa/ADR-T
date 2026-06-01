import { useState, useMemo } from "react";
import {
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

/* ════════════════════════════════════════════════════════════
   DESIGN TOKENS  — Hospital palette aligned with Dashboard
   Primary:   #0f4c81  (navy)
   Accent:    #2d7dd2  (mid-blue)
   Surface:   #f8fafc  (slate-50)
   Border:    #e2e8f0
   Text head: #0f172a
   Text body: #334155
   Text mute: #64748b
   Text faint:#94a3b8
════════════════════════════════════════════════════════════ */
export const C = {
  blue:   { bg:"bg-[#0f4c81]",   text:"text-[#0f4c81]",   light:"bg-[#eff6ff]",   border:"border-[#bfdbfe]", ring:"ring-[#0f4c81]"   },
  violet: { bg:"bg-[#5b5ea6]",   text:"text-[#5b5ea6]",   light:"bg-[#f0f0fa]",   border:"border-[#c7c7e8]", ring:"ring-[#5b5ea6]"   },
  teal:   { bg:"bg-[#0e7490]",   text:"text-[#0e7490]",   light:"bg-[#ecfeff]",   border:"border-[#a5f3fc]", ring:"ring-[#0e7490]"   },
  amber:  { bg:"bg-[#b45309]",   text:"text-[#b45309]",   light:"bg-[#fffbeb]",   border:"border-[#fde68a]", ring:"ring-[#b45309]"   },
  rose:   { bg:"bg-[#9f1239]",   text:"text-[#9f1239]",   light:"bg-[#fff1f2]",   border:"border-[#fecdd3]", ring:"ring-[#9f1239]"   },
};

/* Grade colours — muted, medically readable */
export const GRADE_HEX = {
  1: "#3d8b5e",   /* Mild      — muted green    */
  2: "#b07b2e",   /* Moderate  — warm amber     */
  3: "#c4622a",   /* Severe    — burnt orange   */
  4: "#b83232",   /* Life-thr  — deep rose-red  */
  5: "#374151",   /* Fatal     — dark slate     */
};

export const GRADE_CLS = {
  1: "bg-[#f0fdf4] text-[#166534] border-[#bbf7d0]",
  2: "bg-[#fefce8] text-[#854d0e] border-[#fde68a]",
  3: "bg-[#fff7ed] text-[#9a3412] border-[#fed7aa]",
  4: "bg-[#fff1f2] text-[#9f1239] border-[#fecdd3]",
  5: "bg-[#1e293b] text-white    border-[#334155]",
};

export const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

/* ════════════════════════════════════════════════════════════
   PURE HELPERS
════════════════════════════════════════════════════════════ */
const getGrade = (v) => !v ? null : typeof v === "object" ? v.grade ?? null : typeof v === "number" ? v : null;
const getLabel = (key, v) => typeof v === "object" && v?.label ? v.label : key;

export const countADRs   = (rec) => Object.values(rec.symptoms || {}).filter(v => getGrade(v) != null).length;
export const countG3plus = (rec) => Object.values(rec.symptoms || {}).filter(v => (getGrade(v) ?? 0) >= 3).length;

export function buildBreakdown(recs) {
  const map = {};
  const ensure = n => { if (!map[n]) map[n] = { 1:0, 2:0, 3:0, 4:0, 5:0, total:0 }; };
  recs.forEach(rec => {
    Object.entries(rec.symptoms || {}).forEach(([k, v]) => {
      const g = getGrade(v);
      if (!g) return;
      const label = getLabel(k, v);
      ensure(label);
      map[label][g] = (map[label][g] || 0) + 1;
      map[label].total++;
    });
  });
  return map;
}

export function calcStats(recs) {
  const visits    = recs.length;
  const adrVisits = recs.filter(r => countADRs(r) > 0).length;
  const totalADR  = recs.reduce((s, r) => s + countADRs(r), 0);
  const g3plus    = recs.reduce((s, r) => s + countG3plus(r), 0);
  return {
    visits, adrVisits, totalADR,
    adrRate:  visits ? (totalADR / visits).toFixed(2) : "-",
    g3plus,
    g3Per100: visits ? ((g3plus / visits) * 100).toFixed(1) : "-",
    adrPct:   visits ? ((adrVisits / visits) * 100).toFixed(1) : "-",
    breakdown: buildBreakdown(recs),
  };
}

export function getCellShade(count) {
  if (!count)      return "";
  if (count >= 10) return "bg-[#fff1f2] text-[#9f1239] font-bold";
  if (count >= 5)  return "bg-[#fffbeb] text-[#92400e] font-semibold";
  return "bg-[#eff6ff] text-[#1e40af] font-semibold";
}

/* ════════════════════════════════════════════════════════════
   SHARED UI ATOMS
════════════════════════════════════════════════════════════ */

/* Card container — matches Dashboard card style */
export const Section = ({ children, className = "" }) => (
  <div className={`bg-white rounded-xl border border-[#e2e8f0] shadow-sm overflow-hidden ${className}`}>
    {children}
  </div>
);

/* Section header — clean, restrained */
export const SectionHead = ({ title, sub, action }) => (
  <div className="flex items-center justify-between px-5 py-4 border-b border-[#e2e8f0] bg-white">
    <div>
      <h3 className="text-[13px] font-semibold text-[#0f172a] tracking-[-0.01em]">{title}</h3>
      {sub && <p className="text-[11px] text-[#94a3b8] mt-0.5">{sub}</p>}
    </div>
    {action && <div>{action}</div>}
  </div>
);

/* KPI Card — top-accent strip, matches Dashboard MetricCard feel */
export function KpiCard({ icon, label, value, sub, color = "blue", trend }) {
  const accentHex = {
    blue:   "#0f4c81",
    violet: "#5b5ea6",
    teal:   "#0e7490",
    amber:  "#b45309",
    rose:   "#9f1239",
  }[color] || "#0f4c81";

  const lightHex = {
    blue:   "#eff6ff",
    violet: "#f0f0fa",
    teal:   "#ecfeff",
    amber:  "#fffbeb",
    rose:   "#fff1f2",
  }[color] || "#eff6ff";

  return (
    <div className="relative bg-white rounded-xl border border-[#e2e8f0] shadow-sm p-5 overflow-hidden
                    hover:shadow-md transition-shadow duration-200 cursor-default">
      {/* top accent line */}
      <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-xl"
           style={{ background: accentHex }} />

      <div className="flex items-start justify-between mt-1">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
             style={{ background: lightHex, color: accentHex }}>
          <span className="text-[15px]">{icon}</span>
        </div>
        {trend !== undefined && (
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md
            ${trend >= 0 ? "bg-[#f0fdf4] text-[#15803d]" : "bg-[#fff1f2] text-[#be123c]"}`}>
            {trend >= 0 ? `▲ ${trend}` : `▼ ${Math.abs(trend)}`}%
          </span>
        )}
      </div>

      <div className="mt-3">
        <p className="text-[22px] font-bold text-[#0f172a] leading-none tracking-[-0.02em]"
           style={{ fontFamily:"'IBM Plex Mono', monospace" }}>{value}</p>
        <p className="text-[12px] font-semibold text-[#334155] mt-1.5 leading-tight">{label}</p>
        {sub && <p className="text-[11px] text-[#94a3b8] mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

/* Multi-regimen select dropdown */
export function MultiRegimenSelect({ values = [], onChange, options, placeholder, accentColor = "blue" }) {
  const [query, setQuery] = useState("");
  const [open,  setOpen]  = useState(false);
  const filtered = options.filter(o => !values.includes(o) && o.toLowerCase().includes(query.toLowerCase()));
  const add    = val => { onChange([...values, val]); setQuery(""); };
  const remove = val => onChange(values.filter(v => v !== val));

  const ACCENT = {
    blue:   { border:"border-[#bfdbfe] focus-within:ring-[#0f4c81]",   tag:"bg-[#eff6ff] text-[#1e40af] border-[#bfdbfe]",   dot:"bg-[#0f4c81]"   },
    violet: { border:"border-[#c7c7e8] focus-within:ring-[#5b5ea6]",   tag:"bg-[#f0f0fa] text-[#5b5ea6] border-[#c7c7e8]",   dot:"bg-[#5b5ea6]"   },
    teal:   { border:"border-[#a5f3fc] focus-within:ring-[#0e7490]",   tag:"bg-[#ecfeff] text-[#0e7490] border-[#a5f3fc]",   dot:"bg-[#0e7490]"   },
  };
  const ac = ACCENT[accentColor] || ACCENT.blue;

  return (
    <div className="relative" onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {values.map(v => (
            <span key={v} className={`inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-md text-xs font-semibold border ${ac.tag}`}>
              {v}
              <button onMouseDown={e => { e.preventDefault(); remove(v); }}
                className="w-4 h-4 rounded flex items-center justify-center hover:bg-black/10 transition-colors ml-0.5">
                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}
      <div onClick={() => setOpen(true)}
        className={`flex items-center gap-2 w-full px-3 py-2 border rounded-lg bg-white cursor-text transition-all focus-within:ring-2 focus-within:ring-offset-0 ${ac.border}`}>
        <input type="text" value={query} onChange={e => { setQuery(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
          placeholder={values.length > 0 ? "เพิ่มสูตรยา..." : placeholder}
          className="flex-1 text-[13px] text-[#334155] bg-transparent outline-none placeholder:text-[#94a3b8]" />
        <svg className="w-4 h-4 text-[#94a3b8] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5"/>
        </svg>
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-[#e2e8f0] rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filtered.length === 0
            ? <p className="px-4 py-3 text-xs text-[#94a3b8]">ไม่พบรายการ</p>
            : filtered.map(opt => (
              <button key={opt} onMouseDown={e => { e.preventDefault(); add(opt); setOpen(false); }}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-[13px] text-[#334155] hover:bg-[#f8fafc] text-left transition-colors">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${ac.dot}`} />
                {opt}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

export const GradePill = ({ g, n }) => n > 0 ? (
  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold border ${GRADE_CLS[g]}`}>
    G{g} <span className="font-bold">{n}</span>
  </span>
) : null;

export const ProgressBar = ({ pct, color = "blue" }) => {
  const bgHex = { blue:"#0f4c81", violet:"#5b5ea6", teal:"#0e7490", rose:"#9f1239", amber:"#b45309" }[color] || "#0f4c81";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-[#f1f5f9] rounded-full h-[5px] overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500"
             style={{ width:`${Math.min(pct,100)}%`, background: bgHex }} />
      </div>
      <span className="text-[11px] font-semibold text-[#64748b] w-8 text-right">{pct}%</span>
    </div>
  );
};

export const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-[#e2e8f0] rounded-lg shadow-lg px-4 py-3 text-xs">
      <p className="font-semibold text-[#334155] mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-semibold">{p.name}: {p.value}</p>
      ))}
    </div>
  );
};

export const RateTooltip = ({ active, payload, label, valueLabel, unit = "%" }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="bg-white border border-[#e2e8f0] rounded-lg shadow-lg px-4 py-3 text-xs min-w-[130px]">
      <p className="font-semibold text-[#334155] mb-1.5">{label}</p>
      <p className="font-semibold" style={{ color: d.fill }}>
        {valueLabel}: <span className="font-bold text-[#0f172a]">{d.value}{unit}</span>
      </p>
    </div>
  );
};

export const EmptyChart = ({ small = false }) => (
  <div className={`flex flex-col items-center justify-center text-center ${small ? "py-6" : "py-12"}`}>
    <div className="w-10 h-10 rounded-full bg-[#f1f5f9] flex items-center justify-center mb-2">
      <svg className="w-5 h-5 text-[#cbd5e1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75z"/>
      </svg>
    </div>
    <p className="text-xs text-[#94a3b8] font-medium">ยังไม่มีข้อมูล</p>
  </div>
);

/* ── Donut Chart ─────────────────────────────────────────── */
export function DonutChart({ data, size = 200 }) {
  const [hovered, setHovered] = useState(null);
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <EmptyChart />;

  const R = size / 2, cx = R, cy = R;
  const outerR = R - 10, innerR = outerR * 0.58;
  let startAngle = -Math.PI / 2;
  const slices = data.map(d => {
    const angle = (d.value / total) * 2 * Math.PI;
    const s = { ...d, startAngle, endAngle: startAngle + angle };
    startAngle += angle;
    return s;
  });
  const arc = (sa, ea, r1, r2) => {
    const [x1,y1] = [cx + r2*Math.cos(sa), cy + r2*Math.sin(sa)];
    const [x2,y2] = [cx + r1*Math.cos(sa), cy + r1*Math.sin(sa)];
    const [x3,y3] = [cx + r1*Math.cos(ea), cy + r1*Math.sin(ea)];
    const [x4,y4] = [cx + r2*Math.cos(ea), cy + r2*Math.sin(ea)];
    return `M${x1},${y1} L${x2},${y2} A${r1},${r1} 0 ${ea-sa>Math.PI?1:0} 1 ${x3},${y3} L${x4},${y4} A${r2},${r2} 0 ${ea-sa>Math.PI?1:0} 0 ${x1},${y1} Z`;
  };

  return (
    <div className="flex items-center gap-5 flex-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="flex-shrink-0">
        {slices.map((s, i) => (
          <path key={i} d={arc(s.startAngle, s.endAngle, innerR, outerR)}
            fill={s.color} stroke="white" strokeWidth={2}
            opacity={hovered === null || hovered === i ? 1 : 0.35}
            onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}
            style={{ transition:"opacity 0.15s", cursor:"default" }} />
        ))}
        <circle cx={cx} cy={cy} r={innerR - 2} fill="white" />
        <text x={cx} y={cy - 8} textAnchor="middle"
          fontSize={hovered !== null ? 22 : 26} fontWeight="700"
          fill="#0f172a" fontFamily="'IBM Plex Mono', monospace">
          {hovered !== null ? slices[hovered].value : total}
        </text>
        <text x={cx} y={cy + 11} textAnchor="middle" fontSize={10}
          fill="#94a3b8" fontFamily="sans-serif">
          {hovered !== null ? slices[hovered].label : "events"}
        </text>
        {hovered !== null && (
          <text x={cx} y={cy + 26} textAnchor="middle" fontSize={11}
            fill={slices[hovered].color} fontWeight="700" fontFamily="sans-serif">
            {Math.round((slices[hovered].value / total) * 100)}%
          </text>
        )}
      </svg>
      <div className="flex flex-col gap-2 min-w-0">
        {slices.map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-xs"
            onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}
            style={{ opacity: hovered === null || hovered === i ? 1 : 0.35, transition:"opacity 0.15s", cursor:"default" }}>
            <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: s.color }} />
            <span className="text-[#475569] font-medium truncate">{s.label}</span>
            <span className="ml-auto font-bold text-[#0f172a] pl-2"
                  style={{ fontFamily:"'IBM Plex Mono', monospace" }}>{s.value}</span>
            <span className="text-[#94a3b8] w-8 text-right">{Math.round((s.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Grade Distribution ──────────────────────────────────── */
export function GradeDist({ records }) {
  const GRADE_LABELS = {
    1:"Grade 1 — Mild",
    2:"Grade 2 — Moderate",
    3:"Grade 3 — Severe",
    4:"Grade 4 — Life-threatening",
    5:"Grade 5 — Fatal"
  };
  const dist = useMemo(() => {
    const d = { 1:0, 2:0, 3:0, 4:0, 5:0 };
    records.forEach(rec => Object.values(rec.symptoms || {}).forEach(v => {
      const g = typeof v === "object" ? v?.grade : v;
      if (g && d[g] !== undefined) d[g]++;
    }));
    return d;
  }, [records]);
  const data = [1,2,3,4,5].filter(g => dist[g] > 0).map(g => ({
    label: GRADE_LABELS[g], value: dist[g], color: GRADE_HEX[g]
  }));
  return (
    <Section>
      <SectionHead title="Grade Distribution" sub="สัดส่วน CTCAE Grade" />
      <div className="p-5"><DonutChart data={data} size={180} /></div>
    </Section>
  );
}

/* ── Icon set ────────────────────────────────────────────── */
export const HospitalIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z"/>
  </svg>
);
export const AlertIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
  </svg>
);
export const ShieldIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.249-8.25-3.286z"/>
  </svg>
);

/* ════════════════════════════════════════════════════════════
   RATE TOOLTIP (local — used by MonthlyRateCharts)
════════════════════════════════════════════════════════════ */
function RateTooltipLocal({ active, payload, label, valueLabel, unit = "%" }) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="bg-white border border-[#e2e8f0] rounded-lg shadow-lg px-4 py-3 text-xs min-w-[130px]">
      <p className="font-semibold text-[#334155] mb-1.5">{label}</p>
      <p className="font-semibold" style={{ color: d.fill }}>
        {valueLabel}: <span className="font-bold text-[#0f172a]">{d.value}{unit}</span>
      </p>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   MONTHLY RATE BAR CHARTS
════════════════════════════════════════════════════════════ */
export function MonthlyRateCharts({ records, MONTHS }) {
  const monthlyData = useMemo(() => MONTHS.map(({ key, label }) => {
    const mr     = records.filter(r => new Date(r.date).getMonth() + 1 === key);
    const visits = mr.length;
    const adrs   = mr.reduce((s, r) => s + countADRs(r), 0);
    const g3     = mr.reduce((s, r) => s + countG3plus(r), 0);
    return {
      month:   label.split("-")[0],
      visits,
      adrRate: visits > 0 ? parseFloat((adrs / visits).toFixed(2)) : 0,
      g3Rate:  visits > 0 ? parseFloat(((g3 / visits) * 100).toFixed(1)) : 0,
    };
  }), [records, MONTHS]);

  const hasData = monthlyData.some(d => d.visits > 0);

  const CHARTS = [
    {
      dataKey: "adrRate",
      title:   "อัตรา ADRs ต่อ 1 visit (time/visit)",
      fill:    "#2d7dd2",
      unit:    "",
      label:   "ADR/visit",
      yDomain: ["auto", "auto"],
    },
    {
      dataKey: "g3Rate",
      title:   "อัตรา ADRs ตาม CTCAE ตั้งแต่ grade 3 ขึ้นไป (Events per 100 visit)",
      fill:    "#5b5ea6",
      unit:    "",
      label:   "G3+/100v",
      yDomain: [0, 100],
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {CHARTS.map((cfg) => (
        <Section key={cfg.dataKey}>
          <SectionHead title={cfg.title} />
          <div className="px-3 pb-5 pt-2">
            {!hasData ? <EmptyChart small /> : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={monthlyData}
                  margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
                  barSize={14}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 9, fill: "#94a3b8" }}
                    axisLine={false} tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 9, fill: "#94a3b8" }}
                    axisLine={false} tickLine={false}
                    domain={cfg.yDomain}
                    allowDecimals={true}
                    tickFormatter={v => v % 1 === 0 ? v : v.toFixed(1)}
                  />
                  <Tooltip
                    content={<RateTooltipLocal valueLabel={cfg.label} unit={cfg.unit} />}
                    cursor={{ fill: cfg.fill + "12" }}
                  />
                  <Bar dataKey={cfg.dataKey} name={cfg.label} radius={[4, 4, 0, 0]}>
                    {monthlyData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={cfg.fill}
                        opacity={entry.visits > 0 ? 1 : 0.12}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Section>
      ))}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   MONTHLY COUNT CHARTS
════════════════════════════════════════════════════════════ */
export function MonthlyCountCharts({ records, MONTHS }) {
  const monthlyData = useMemo(() => MONTHS.map(({ key, label }) => {
    const mr = records.filter(r => new Date(r.date).getMonth() + 1 === key);
    const visits = mr.length;
    const adrs   = mr.reduce((s, r) => s + countADRs(r), 0);
    const g3     = mr.reduce((s, r) => s + countG3plus(r), 0);
    return { month: label.split("-")[0], visits, adrs, g3 };
  }), [records, MONTHS]);

  const hasData = monthlyData.some(d => d.visits > 0);

  const activeN   = monthlyData.filter(d => d.visits > 0).length || 1;
  const avgVisits = Math.round(monthlyData.reduce((s, d) => s + d.visits, 0) / activeN);
  const avgAdrs   = (monthlyData.reduce((s, d) => s + d.adrs,   0) / activeN).toFixed(1);
  const avgG3     = (monthlyData.reduce((s, d) => s + d.g3,     0) / activeN).toFixed(1);

  const BarLabel = ({ x, y, width, value, fill }) => {
    if (!value) return null;
    return (
      <text x={x + width / 2} y={y - 5} textAnchor="middle"
        fontSize={9} fontWeight="600" fill={fill} fontFamily="sans-serif">
        {value}
      </text>
    );
  };

  const CFGS = [
    {
      key:"visits", title:"จำนวน Visits รายเดือน", sub:"การให้ยาเคมีบำบัด",
      fill:"#0f4c81", fillBg:"#eff6ff", avg:avgVisits, unit:"visits",
      icon:(
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21"/>
        </svg>
      ),
    },
    {
      key:"adrs", title:"จำนวน ADR Events รายเดือน", sub:"Adverse Drug Reactions ทุก Grade",
      fill:"#b07b2e", fillBg:"#fefce8", avg:avgAdrs, unit:"events",
      icon:(
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
        </svg>
      ),
    },
    {
      key:"g3", title:"ADR CTCAE Grade ≥ 3 รายเดือน", sub:"Severe / Life-threatening / Fatal",
      fill:"#9f1239", fillBg:"#fff1f2", avg:avgG3, unit:"events",
      icon:(
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.249-8.25-3.286z"/>
        </svg>
      ),
    },
  ];

  if (!hasData) return null;

  return (
    <>
      {CFGS.map((cfg) => {
        const total  = monthlyData.reduce((s, d) => s + d[cfg.key], 0);
        const maxVal = Math.max(...monthlyData.map(d => d[cfg.key]), 1);

        return (
          <Section key={cfg.key}>
            {/* Header */}
            <div className="flex items-start gap-3 px-5 pt-5 pb-0">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ background: cfg.fillBg, color: cfg.fill }}>
                {cfg.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-[#334155] leading-tight">{cfg.title}</p>
                <p className="text-[11px] text-[#94a3b8] mt-0.5 truncate">{cfg.sub}</p>
              </div>
            </div>

            {/* Big number */}
            <div className="flex items-baseline gap-2 px-5 pt-3 pb-1">
              <span className="text-3xl font-bold leading-none tracking-[-0.02em]"
                    style={{ color: cfg.fill, fontFamily:"'IBM Plex Mono', monospace" }}>{total}</span>
              <span className="text-xs text-[#94a3b8] font-medium">{cfg.unit} ทั้งปี</span>
              <span className="ml-auto text-xs font-medium px-2 py-0.5 rounded-md"
                style={{ background: cfg.fillBg, color: cfg.fill }}>
                เฉลี่ย {cfg.avg}/{cfg.unit === "visits" ? "เดือน" : "เดือน"}
              </span>
            </div>

            {/* Bar Chart */}
            <div className="px-2 pb-4 pt-1">
              <ResponsiveContainer width="100%" height={150}>
                <BarChart
                  data={monthlyData}
                  margin={{ top: 18, right: 6, left: -28, bottom: 0 }}
                  barSize={13}
                >
                  <CartesianGrid strokeDasharray="2 4" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 9, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: "#94a3b8" }} axisLine={false} tickLine={false}
                    allowDecimals={false} domain={[0, Math.ceil(maxVal * 1.25)]} />
                  <Tooltip
                    content={({ active, payload, label }) => (
                      <div style={{ display: active && payload?.length ? "block" : "none" }}
                        className="bg-white border border-[#e2e8f0] rounded-lg shadow-lg px-4 py-3 text-xs min-w-[120px]">
                        <p className="font-semibold text-[#334155] mb-1">{label}</p>
                        <p className="font-bold text-lg leading-none" style={{ color: cfg.fill }}>
                          {payload[0]?.value}
                          <span className="text-xs font-medium text-[#94a3b8] ml-1">{cfg.unit}</span>
                        </p>
                      </div>
                    )}
                    cursor={{ fill: cfg.fill + "0e" }}
                  />
                  <Bar dataKey={cfg.key} radius={[4, 4, 0, 0]}
                    label={<BarLabel fill={cfg.fill} />}>
                    {monthlyData.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={entry[cfg.key] > 0
                          ? (entry[cfg.key] === maxVal ? cfg.fill : cfg.fill + "b0")
                          : cfg.fill + "18"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Heatmap strip */}
            <div className="flex gap-0.5 px-5 pb-4">
              {monthlyData.map((d, i) => {
                const pct = maxVal > 0 ? d[cfg.key] / maxVal : 0;
                const opacity = pct === 0 ? 0.07 : 0.18 + pct * 0.82;
                return (
                  <div key={i} title={`${d.month}: ${d[cfg.key]}`}
                    className="flex-1 h-1.5 rounded-sm"
                    style={{ background: cfg.fill, opacity }}
                  />
                );
              })}
            </div>
          </Section>
        );
      })}
    </>
  );
}

/* ════════════════════════════════════════════════════════════
   SYMPTOM MATRIX
════════════════════════════════════════════════════════════ */
export function SymptomMatrix({
  matrix, allSymptomNames, MONTHS,
  symptomTotals, monthTotals, grandTotal,
  gradeFilter, setGradeFilter,
}) {
  return (
    <Section>
      <SectionHead
        title="Symptom Matrix"
        sub="จำนวนอาการรายเดือน แยกตามประเภท"
        action={
          <div className="flex items-center gap-1 bg-[#f8fafc] border border-[#e2e8f0] rounded-lg px-2 py-1">
            <span className="text-[11px] font-semibold text-[#94a3b8] mr-1">Grade:</span>
            {["all", "1", "2", "3", "4", "5"].map(g => (
              <button key={g} onClick={() => setGradeFilter(g)}
                className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition-all
                  ${gradeFilter === g
                    ? "bg-[#0f4c81] text-white shadow-sm"
                    : "text-[#64748b] hover:bg-white hover:text-[#0f4c81]"}`}>
                {g === "all" ? "All" : g}
              </button>
            ))}
          </div>
        }
      />
      <div className="overflow-auto max-h-96">
        <table className="w-full min-w-[900px] text-sm border-separate border-spacing-0">
          <thead className="sticky top-0 z-20">
            <tr className="bg-[#f8fafc]">
              <th className="text-left px-5 py-3 text-[11px] font-bold text-[#64748b] uppercase tracking-wider w-40
                             sticky left-0 bg-[#f8fafc] z-30 border-b border-r border-[#e2e8f0]">อาการ</th>
              {MONTHS.map(({ label }) => (
                <th key={label} className="text-center px-2 py-3 text-[11px] font-bold text-[#64748b] uppercase tracking-wide w-14 border-b border-[#e2e8f0]">{label}</th>
              ))}
              <th className="text-center px-4 py-3 text-[11px] font-bold text-[#0f4c81] uppercase w-14 bg-[#eff6ff] border-b border-[#bfdbfe]">Total</th>
            </tr>
          </thead>
          <tbody>
            {allSymptomNames.length === 0 ? (
              <tr><td colSpan={14} className="py-12 text-center text-sm text-[#94a3b8]">ไม่มีข้อมูล</td></tr>
            ) : allSymptomNames.map((name, ri) => (
              <tr key={name}
                className={`group transition-colors hover:bg-[#f0f7ff] ${ri % 2 === 0 ? "bg-white" : "bg-[#f8fafc]/60"}`}>
                <td className={`px-5 py-2.5 font-medium text-[#334155] text-xs sticky left-0 z-10 border-r border-[#e2e8f0]
                  ${ri % 2 === 0 ? "bg-white group-hover:bg-[#f0f7ff]" : "bg-[#f8fafc]/60 group-hover:bg-[#f0f7ff]"}`}>
                  {name}
                </td>
                {MONTHS.map(({ key }) => {
                  const count = matrix[name]?.[key] || 0;
                  return (
                    <td key={key} className="text-center px-1 py-2">
                      {count > 0
                        ? <span className={`inline-flex items-center justify-center w-7 h-6 rounded-md text-xs ${getCellShade(count)}`}>{count}</span>
                        : <span className="text-[#e2e8f0] text-xs">·</span>}
                    </td>
                  );
                })}
                <td className="text-center px-3 py-2 bg-[#eff6ff]/60">
                  <span className={`inline-flex items-center justify-center w-9 h-6 rounded-md text-xs font-bold
                    ${symptomTotals[name] > 0 ? "bg-[#0f4c81] text-white" : "text-[#cbd5e1]"}`}>
                    {symptomTotals[name] || 0}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="sticky bottom-0">
            <tr className="bg-[#f1f5f9] border-t-2 border-[#e2e8f0]">
              <td className="px-5 py-2.5 text-[11px] font-bold text-[#64748b] uppercase tracking-wide
                             sticky left-0 bg-[#f1f5f9] z-10 border-r border-[#e2e8f0]">รวม</td>
              {MONTHS.map(({ key }) => {
                const count = monthTotals[key] || 0;
                return (
                  <td key={key} className="text-center px-1 py-2">
                    <span className={`inline-flex items-center justify-center w-7 h-6 rounded-md text-xs font-bold
                      ${count > 0 ? "bg-[#334155] text-white" : "text-[#cbd5e1]"}`}>
                      {count || "·"}
                    </span>
                  </td>
                );
              })}
              <td className="text-center px-3 py-2 bg-[#dbeafe]">
                <span className="inline-flex items-center justify-center w-9 h-6 rounded-md text-xs font-bold bg-[#0f4c81] text-white">{grandTotal}</span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      {/* Legend */}
      <div className="flex items-center gap-4 px-5 py-3 border-t border-[#e2e8f0] bg-[#f8fafc]">
        {[
          { bg:"bg-[#eff6ff]", text:"text-[#1e40af]", l:"1–4" },
          { bg:"bg-[#fffbeb]", text:"text-[#92400e]", l:"5–9" },
          { bg:"bg-[#fff1f2]", text:"text-[#9f1239]", l:"10+" },
        ].map(({ bg, text, l }) => (
          <span key={l} className={`flex items-center gap-1.5 text-[11px] font-medium ${text}`}>
            <span className={`w-3 h-3 rounded ${bg} border border-current/20`} />{l}
          </span>
        ))}
      </div>
    </Section>
  );
}

/* ════════════════════════════════════════════════════════════
   MONTHLY SUMMARY TABLE
════════════════════════════════════════════════════════════ */
export function MonthlySummaryTable({ summaryRows, summaryFooter }) {
  return (
    <Section>
      <SectionHead title="Monthly Summary" sub="สรุปสถิติ ADR รายเดือน" />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#f8fafc] border-b border-[#e2e8f0] text-[11px] font-bold text-[#64748b] uppercase tracking-wide">
              <th className="text-left px-5 py-3 sticky left-0 bg-[#f8fafc]">เดือน</th>
              <th className="text-center px-3 py-3">Visits</th>
              <th className="text-center px-3 py-3">Visits+ADR</th>
              <th className="text-center px-5 py-3 min-w-[140px]">ADR Events</th>
              <th className="text-center px-3 py-3">ADR/Visit</th>
              <th className="text-center px-3 py-3">Severe ≥G3</th>
              <th className="text-center px-3 py-3">G3 /100v</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f1f5f9]">
            {summaryRows.map((row, ri) => (
              <tr key={row.label}
                className={`transition-colors hover:bg-[#f8fafc] ${ri % 2 === 0 ? "bg-white" : "bg-[#f8fafc]/40"}`}>
                <td className="px-5 py-3 font-semibold text-[#334155] text-xs sticky left-0 bg-inherit">{row.label}</td>
                <td className="text-center px-3 py-3">
                  {row.visits > 0
                    ? <span className="inline-flex items-center justify-center w-8 h-6 rounded-md bg-[#f1f5f9] text-[#475569] text-xs font-bold">{row.visits}</span>
                    : <span className="text-[#e2e8f0]">—</span>}
                </td>
                <td className="text-center px-3 py-3">
                  {row.adrVisits > 0
                    ? <span className="inline-flex items-center justify-center w-8 h-6 rounded-md bg-[#eff6ff] text-[#1e40af] text-xs font-bold">{row.adrVisits}</span>
                    : <span className="text-[#e2e8f0]">—</span>}
                </td>
                <td className="text-center px-5 py-3">
                  {row.totalADR > 0
                    ? <span className="inline-flex items-center justify-center min-w-[28px] h-6 px-2 rounded-md bg-[#eff6ff] border border-[#bfdbfe] text-[#1e40af] text-xs font-bold">{row.totalADR}</span>
                    : <span className="text-[#e2e8f0]">—</span>}
                </td>
                <td className="text-center px-3 py-3">
                  {row.adrPerVisit !== "-"
                    ? <span className="text-xs font-semibold text-[#475569]"
                            style={{ fontFamily:"'IBM Plex Mono', monospace" }}>{row.adrPerVisit}</span>
                    : <span className="text-[#e2e8f0]">—</span>}
                </td>
                <td className="text-center px-3 py-3">
                  {row.g3plus > 0
                    ? <span className="inline-flex items-center justify-center w-8 h-6 rounded-md bg-[#fff7ed] text-[#9a3412] text-xs font-bold">{row.g3plus}</span>
                    : <span className="text-[#e2e8f0]">—</span>}
                </td>
                <td className="text-center px-3 py-3">
                  {row.g3Per100 !== "-" && row.g3plus > 0
                    ? <span className="text-xs font-semibold text-[#9a3412]"
                            style={{ fontFamily:"'IBM Plex Mono', monospace" }}>{row.g3Per100}</span>
                    : <span className="text-[#e2e8f0]">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[#e2e8f0] bg-[#f1f5f9] text-xs font-bold">
              <td className="px-5 py-3 text-[#475569] uppercase tracking-wide sticky left-0 bg-[#f1f5f9]">รวมทั้งปี</td>
              <td className="text-center px-3 py-3">
                <span className="inline-flex items-center justify-center w-8 h-6 rounded-md bg-[#334155] text-white text-xs">{summaryFooter.visits}</span>
              </td>
              <td className="text-center px-3 py-3">
                <span className="inline-flex items-center justify-center w-8 h-6 rounded-md bg-[#0f4c81] text-white text-xs">{summaryFooter.adrVisits}</span>
              </td>
              <td className="text-center px-5 py-3">
                <span className="inline-flex items-center justify-center px-2.5 h-6 rounded-md bg-[#eff6ff] border border-[#bfdbfe] text-[#1e40af] text-xs font-bold">{summaryFooter.totalADR} events</span>
              </td>
              <td className="text-center px-3 py-3 text-[#334155]"
                  style={{ fontFamily:"'IBM Plex Mono', monospace" }}>{summaryFooter.adrPerVisit}</td>
              <td className="text-center px-3 py-3">
                <span className="inline-flex items-center justify-center w-8 h-6 rounded-md bg-[#c4622a] text-white text-xs">{summaryFooter.g3plus}</span>
              </td>
              <td className="text-center px-3 py-3 text-[#9a3412]"
                  style={{ fontFamily:"'IBM Plex Mono', monospace" }}>{summaryFooter.g3Per100}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Section>
  );
}