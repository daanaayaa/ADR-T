import { useEffect, useRef, useState, useCallback } from "react";
import { statsApi } from "../services/api";

const THIS_MONTH = new Date().toISOString().slice(0, 7);

function monthLabel(ym) {
  const [y, m] = ym.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("th-TH", { month: "long", year: "numeric" });
}
function monthShort(ym) {
  const [y, m] = ym.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("th-TH", { month: "short" });
}
function fmt2(n) { return isNaN(n) || !isFinite(n) ? "0.00" : Number(n).toFixed(2); }

const GRADE_META = {
  1: { color: "#a5e1bb", bg: "#f0fdf4" },
  2: { color: "#e2cc9b", bg: "#fefce8" },
  3: { color: "#d79b7b", bg: "#fff7ed" },
  4: { color: "#d77e7e", bg: "#fef2f2" },
  5: { color: "#374151", bg: "#f9fafb" },
};
const SYMP_COLORS = ["#718cc5","#a9ccd5","#9385ac","#e19cb9","#f2b281","#a3d1c4","#3e4f7d","#9333ea"];
const OTHERS_COLOR = "#b5b6b8";

/* ── Sparkline ── */
function Sparkline({ data, color }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data, 1);
  const W = 80, H = 32;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - (v / max) * (H - 4) - 2;
    return `${x},${y}`;
  });
  const area = `${pts[0].split(",")[0]},${H} ${pts.join(" ")} ${pts[pts.length-1].split(",")[0]},${H}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: W, height: H }}>
      <polygon points={area} fill={color} opacity="0.1" />
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length-1].split(",")[0]} cy={pts[pts.length-1].split(",")[1]} r="2.5" fill={color} />
    </svg>
  );
}

/* ── Mini Bar ── */
function MiniBar({ data, color }) {
  if (!data.length) return <p style={{ fontSize: 11, color: "#94a3b8" }}>ไม่มีข้อมูล</p>;
  const max = Math.max(...data.map((d) => d.value), 1);
  const W = 260, H = 100;
  const barW = Math.max(16, Math.floor((W - 24) / data.length) - 5);
  const gap = (W - 24) / data.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", display: "block" }}>
      {data.map((d, i) => {
        const bh = Math.max(3, (d.value / max) * (H - 30));
        const x = 12 + i * gap + (gap - barW) / 2;
        const y = H - 18 - bh;
        const isLast = i === data.length - 1;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={bh} rx="2" fill={color} opacity={isLast ? "1" : "0.4"} />
            <text x={x + barW/2} y={H-4} textAnchor="middle" fontSize="9" fill="#94a3b8">{d.label}</text>
            {d.value > 0 && (
              <text x={x + barW/2} y={y-3} textAnchor="middle" fontSize="9" fontWeight="600" fill={color}>{d.value}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/* ── Doughnut Chart ── */
function DoughnutChart({ labels, values, colors, centerLabel, centerValue }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || typeof window.Chart === "undefined") return;
    if (chartRef.current) chartRef.current.destroy();
    const total = values.reduce((a, b) => a + b, 0);
    const cv = centerValue ?? total;
    const cl = centerLabel ?? "total";
    chartRef.current = new window.Chart(canvasRef.current, {
      type: "doughnut",
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: colors,
          borderWidth: 0,
          hoverOffset: 4,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "68%",
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "#0f172a",
            titleColor: "#94a3b8",
            bodyColor: "#f8fafc",
            padding: 10,
            cornerRadius: 6,
            callbacks: {
              label: (ctx) => ` ${ctx.parsed} events (${total > 0 ? Math.round(ctx.parsed/total*100) : 0}%)`,
            },
          },
        },
      },
      plugins: [{
        id: "centerText",
        afterDraw(chart) {
          const { ctx, chartArea: { left, top, right, bottom } } = chart;
          const cx = (left + right) / 2;
          const cy = (top + bottom) / 2;
          ctx.save();
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.font = "600 22px 'IBM Plex Sans', sans-serif";
          ctx.fillStyle = "#0f172a";
          ctx.fillText(cv, cx, cy - 7);
          ctx.font = "400 10px 'IBM Plex Sans', sans-serif";
          ctx.fillStyle = "#94a3b8";
          ctx.fillText(cl, cx, cy + 10);
          ctx.restore();
        }
      }]
    });
    return () => chartRef.current?.destroy();
  }, [labels, values, colors, centerLabel, centerValue]);

  const total = values.reduce((a, b) => a + b, 0);
  return (
    <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
      <div style={{ position: "relative", width: 160, height: 160, flexShrink: 0 }}>
        {total > 0 ? (
          <canvas ref={canvasRef} />
        ) : (
          <div style={{ width:160, height:160, borderRadius:"50%", background:"#f1f5f9", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:4 }}>
            <span style={{ fontSize:20, fontWeight:600, color:"#cbd5e1" }}>—</span>
            <span style={{ fontSize:10, color:"#94a3b8" }}>ไม่มีข้อมูล</span>
          </div>
        )}
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:8, flex:1, minWidth:0, paddingTop:4 }}>
        {labels.map((l, i) => (
          <div key={l} style={{ display:"flex", alignItems:"flex-start", gap:7 }}>
            <span style={{ width:9, height:9, borderRadius:2, background:colors[i], flexShrink:0, marginTop:2 }} />
            <span style={{ fontSize:11, color:"#475569", flex:1, lineHeight:1.5 }}>{l}</span>
            <span style={{ fontSize:11, fontWeight:700, color:"#0f172a", flexShrink:0, fontFamily:"'IBM Plex Mono', monospace", marginLeft:6 }}>
              {values[i]}{total > 0 && <span style={{ fontWeight:400, color:"#94a3b8", marginLeft:3, fontFamily:"'IBM Plex Sans', sans-serif" }}>{Math.round(values[i]/total*100)}%</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Metric Card ── */
function MetricCard({ label, value, unit, desc, accentColor, icon, sparkData, trend }) {
  return (
    <div style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:10, padding:"18px 18px 16px", display:"flex", flexDirection:"column", gap:10, position:"relative", overflow:"hidden" }}>
      <div style={{ position:"absolute", top:0, left:0, right:0, height:3, background:accentColor, borderRadius:"10px 10px 0 0" }} />
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
        <div style={{ width:32, height:32, borderRadius:8, background:accentColor+"18", display:"flex", alignItems:"center", justifyContent:"center", fontSize:15 }}>{icon}</div>
        {sparkData && sparkData.length > 1 && <Sparkline data={sparkData} color={accentColor} />}
      </div>
      <div>
        <div style={{ display:"flex", alignItems:"baseline", gap:4 }}>
          <span style={{ fontSize:24, fontWeight:700, color:"#0f172a", lineHeight:1, fontFamily:"'IBM Plex Mono', monospace", letterSpacing:"-0.02em" }}>{value}</span>
          <span style={{ fontSize:10, color:"#94a3b8" }}>{unit}</span>
        </div>
        <div style={{ marginTop:3, fontSize:12, fontWeight:600, color:"#334155" }}>{label}</div>
        <div style={{ marginTop:2, fontSize:11, color:"#94a3b8" }}>{desc}</div>
      </div>

    </div>
  );
}

/* ── Loading Skeleton ── */
function LoadingSkeleton() {
  const shimmer = { background: "linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite", borderRadius: 8 };
  return (
    <>
      <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(5, 1fr)", gap:12, marginBottom:20 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:10, padding:18, height:120 }}>
            <div style={{ ...shimmer, height:32, width:32, marginBottom:12 }} />
            <div style={{ ...shimmer, height:24, width:"60%", marginBottom:8 }} />
            <div style={{ ...shimmer, height:12, width:"80%" }} />
          </div>
        ))}
      </div>
    </>
  );
}

/* ── Dashboard ── */
function Dashboard({ setPage }) {
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [selMonth, setSelMonth] = useState(THIS_MONTH.slice(5, 7));
  const [selYear,  setSelYear]  = useState(THIS_MONTH.slice(0, 4));

  const selectedMonth = `${selYear}-${selMonth}`;

  // ── ดึงข้อมูลจาก API ──
  const fetchStats = useCallback(async (month) => {
    setLoading(true);
    setError(null);
    try {
      const data = await statsApi.getDashboard({ month });
      setStats(data);
    } catch (err) {
      setError(err.message || "ไม่สามารถโหลดข้อมูลได้");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats(selectedMonth);
  }, [selectedMonth, fetchStats]);

  // ── Derived values จาก API response ──
  const totalVisits  = stats?.totalRecords   ?? 0;
  const totalADR     = stats?.totalADR       ?? 0;
  const adrRate      = stats?.adrRate        ?? 0;
  const g3Events     = stats?.grade3Events   ?? 0;
  const g3Rate       = stats?.grade3Rate     ?? 0;

  // trend vs เดือนก่อน
  const prevTotalVisits = stats?.prev?.totalRecords ?? 0;
  const prevTotalADR    = stats?.prev?.totalADR     ?? 0;
  const calcTrend = (curr, prev) => prev ? Math.round(((curr - prev) / prev) * 100) : null;

  // 6-month trend bars จาก API
  const trendData = stats?.trend ?? [];
  const visitBar  = trendData.map((t) => ({ label: monthShort(t.month), value: Number(t.total_records || 0) }));
  const adrBar    = trendData.map((t) => ({ label: monthShort(t.month), value: Number(t.total_adr     || 0) }));
  const visitSpark = visitBar.map((d) => d.value);
  const adrSpark   = adrBar.map((d) => d.value);

  // top symptoms จาก API
  const topSymptoms = stats?.topSymptoms ?? [];
  const TOP_N = 5;
  const top5        = topSymptoms.slice(0, TOP_N);
  const othersItems = topSymptoms.slice(TOP_N);
  const othersCount = othersItems.reduce((s, x) => s + x.count, 0);
  const displayFreq = othersCount > 0
    ? [...top5, { name: `Others (${othersItems.length} รายการ)`, count: othersCount, isOthers: true }]
    : top5;
  const freqLabels  = displayFreq.map((s) => s.name);
  const freqValues  = displayFreq.map((s) => s.count);
  const freqColors  = displayFreq.map((s, i) => s.isOthers ? OTHERS_COLOR : (SYMP_COLORS[i] || SYMP_COLORS[SYMP_COLORS.length - 1]));
  const freqTotal   = topSymptoms.reduce((a, b) => a + b.count, 0);

  // grade distribution จาก API
  const gradeDist = stats?.gradeDist
    ? [1,2,3,4,5].map((g) => ({ g, cnt: Number(stats.gradeDist[g] ?? 0) }))
    : [1,2,3,4,5].map((g) => ({ g, cnt: 0 }));

  // available years — ปีปัจจุบัน + ปีจาก trend
  const trendYears = trendData.map((t) => t.month?.slice(0, 4)).filter(Boolean);
  const availableYears = [...new Set([selYear, THIS_MONTH.slice(0, 4), ...trendYears])].sort().reverse();

  const now = new Date();
  const dateStr = now.toLocaleDateString("th-TH", { weekday:"long", year:"numeric", month:"long", day:"numeric" });

  const selectStyle = {
    fontSize:12, border:"1px solid #e2e8f0", borderRadius:7, padding:"6px 10px",
    background:"#f8fafc", color:"#334155", fontFamily:"'IBM Plex Sans', sans-serif",
    cursor:"pointer", outline:"none",
  };

  const S = {
    root: { fontFamily:"'IBM Plex Sans', sans-serif", background:"#f8fafc", minHeight:"100vh", paddingBottom:40 },
    topbar: { background:"#fff", borderBottom:"1px solid #e2e8f0", padding:"14px 28px", display:"flex", justifyContent:"space-between", alignItems:"center", position:"sticky", top:0, zIndex:10 },
    logo: { width:32, height:32, background:"#0f4c81", borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontSize:15 },
    body: { padding:"24px 28px 0" },
    sectionRow: { display:"flex", alignItems:"center", gap:10, marginBottom:16 },
    sectionLabel: { fontSize:11, fontWeight:700, color:"#94a3b8", letterSpacing:"0.1em", textTransform:"uppercase" },
    divider: { flex:1, height:1, background:"#e2e8f0" },
    card: { background:"#fff", border:"1px solid #e2e8f0", borderRadius:10, padding:"20px" },
    badge: (color, bg) => ({ fontSize:10, fontWeight:700, color, background:bg, padding:"3px 8px", borderRadius:5, letterSpacing:"0.04em" }),
    cardHeader: { display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 },
    cardTitle: { fontSize:13, fontWeight:600, color:"#0f172a" },
    cardSub: { fontSize:11, color:"#94a3b8", marginTop:2 },
  };

  return (
    <div style={S.root}>
      {/* Top Bar */}
      <div style={S.topbar}>
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          <div style={S.logo}>⊕</div>
          <div>
            <div style={{ fontSize:14, fontWeight:700, color:"#0f172a", letterSpacing:"-0.01em" }}>ADR Monitoring System</div>
            <div style={{ fontSize:11, color:"#94a3b8" }}>Chemotherapy Adverse Drug Reaction</div>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ fontSize:12, color:"#64748b", textAlign:"right" }}>{dateStr}</div>
          <div style={{ width:1, height:28, background:"#e2e8f0" }} />

          {/* ── Month selector ── */}
          <select
            style={selectStyle}
            value={selMonth}
            onChange={(e) => setSelMonth(e.target.value)}
          >
            {Array.from({ length: 12 }, (_, i) => {
              const m = String(i + 1).padStart(2, "0");
              const label = new Date(2000, i, 1).toLocaleDateString("th-TH", { month: "long" });
              return <option key={m} value={m}>{label}</option>;
            })}
          </select>

          {/* ── Year selector ── */}
          <select
            style={selectStyle}
            value={selYear}
            onChange={(e) => setSelYear(e.target.value)}
          >
            {availableYears.map((y) => (
              <option key={y} value={y}>
                {new Date(Number(y), 0, 1).toLocaleDateString("th-TH", { year: "numeric" })}
              </option>
            ))}
          </select>

          <button
            onClick={() => setPage("assessment")}
            style={{ display:"flex", alignItems:"center", gap:7, background:"#0f4c81", color:"#fff", fontSize:12, fontWeight:600, padding:"7px 14px", borderRadius:7, border:"none", cursor:"pointer", fontFamily:"'IBM Plex Sans', sans-serif" }}
          >
            <span style={{ fontSize:16, lineHeight:1 }}>+</span> New Assessment
          </button>
        </div>
      </div>

      <div style={S.body}>

        {/* ── Error Banner ── */}
        {error && (
          <div style={{ background:"#fef2f2", border:"1px solid #fecaca", borderRadius:8, padding:"12px 16px", marginBottom:16, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <span style={{ fontSize:13, color:"#dc2626" }}>⚠ {error}</span>
            <button
              onClick={() => fetchStats(selectedMonth)}
              style={{ fontSize:12, color:"#dc2626", background:"none", border:"1px solid #fca5a5", borderRadius:6, padding:"4px 10px", cursor:"pointer" }}>
              ลองอีกครั้ง
            </button>
          </div>
        )}

        {/* Section: Overview */}
        <div style={S.sectionRow}>
          <span style={S.sectionLabel}>Overview — {monthLabel(selectedMonth)}</span>
          <div style={S.divider} />
          {loading && <span style={{ fontSize:11, color:"#94a3b8" }}>กำลังโหลด...</span>}
        </div>

        {/* Metric Cards */}
        {loading ? <LoadingSkeleton /> : (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(5, 1fr)", gap:12, marginBottom:20 }}>
            {[
              { label:"Visit ทั้งหมด", value:totalVisits, unit:"ครั้ง", desc:"Visit ที่ได้รับยาเคมีบำบัด", accentColor:"#939bac", icon:"", sparkData:visitSpark, trend:calcTrend(totalVisits, prevTotalVisits) },
              { label:"ADR ที่พบ",     value:totalADR,    unit:"ราย",  desc:"Adverse drug reactions",      accentColor:"#939bac", icon:"", sparkData:adrSpark, trend:calcTrend(totalADR, prevTotalADR) },
              { label:"ADR Rate",      value:fmt2(adrRate), unit:"/ visit", desc:"อัตราเกิด ADR ต่อ visit", accentColor:"#939bac", icon:"" },
              { label:"Grade ≥ 3",    value:g3Events, unit:"events", desc:"CTCAE severity grade ≥ 3",    accentColor:"#939bac", icon:"" },
              { label:"Grade ≥ 3 Rate", value:fmt2(g3Rate), unit:"/ 100 visits", desc:"ต่อ 100 visit",   accentColor:"#939bac", icon:"" },
            ].map((c) => <MetricCard key={c.label} {...c} />)}
          </div>
        )}

        {/* Trend Charts */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:16, marginBottom:16 }}>
          <div style={S.card}>
            <div style={S.cardHeader}>
              <div><div style={S.cardTitle}>Visit Trend</div><div style={S.cardSub}>6 เดือนย้อนหลัง</div></div>
              <span style={S.badge("#0f4c81","#eff6ff")}>MONTHLY</span>
            </div>
            <MiniBar data={visitBar} color="#0f4c81" />
          </div>
          <div style={S.card}>
            <div style={S.cardHeader}>
              <div><div style={S.cardTitle}>ADR Trend</div><div style={S.cardSub}>6 เดือนย้อนหลัง</div></div>
              <span style={S.badge("#9b8d82","#fefce8")}>MONTHLY</span>
            </div>
            <MiniBar data={adrBar} color="#7b92a5" />
          </div>
          <div style={S.card}>
            <div style={S.cardHeader}>
              <div><div style={S.cardTitle}>สรุปเดือนนี้</div><div style={S.cardSub}>{monthLabel(selectedMonth)}</div></div>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              {[
                { label:"ADR / Visit",       val:`${totalADR}/${Math.max(totalVisits,1)}`, pct: totalVisits ? Math.round(totalADR/totalVisits*100) : 0, color:"#59677f" },
                { label:"Grade ≥ 3 / Visit", val:`${g3Events}/${Math.max(totalVisits,1)}`, pct: totalVisits ? Math.min(100, Math.round(g3Events/totalVisits*100)) : 0, color:"#375072" },
              ].map((row) => (
                <div key={row.label}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                    <span style={{ fontSize:11, color:"#475569" }}>{row.label}</span>
                    <span style={{ fontSize:11, fontWeight:700, color:"#0f172a", fontFamily:"'IBM Plex Mono', monospace" }}>
                      {row.val} <span style={{ fontWeight:400, color:"#94a3b8" }}>({row.pct}%)</span>
                    </span>
                  </div>
                  <div style={{ height:5, background:"#f1f5f9", borderRadius:99, overflow:"hidden" }}>
                    <div style={{ height:"100%", width:`${row.pct}%`, background:row.color, borderRadius:99, transition:"width 0.6s ease" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Section: ADR Analysis */}
        <div style={S.sectionRow}>
          <span style={S.sectionLabel}>ADR Analysis</span>
          <div style={S.divider} />
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>

          {/* Symptom Frequency */}
          <div style={S.card}>
            <div style={S.cardHeader}>
              <div>
                <div style={S.cardTitle}>Symptom Frequency</div>
                <div style={S.cardSub}>
                  ความถี่อาการ ADR ที่พบในเดือนนี้
                  {topSymptoms.length > TOP_N && (
                    <span style={{ marginLeft:6, fontSize:10, color:"#94a3b8" }}>
                      · แสดง Top {TOP_N} จาก {topSymptoms.length} รายการ
                    </span>
                  )}
                </div>
              </div>
              <span style={S.badge("#7c3aed","#f5f3ff")}>DISTRIBUTION</span>
            </div>

            {topSymptoms.length === 0 ? (
              <div style={{ height:160, display:"flex", alignItems:"center", justifyContent:"center" }}>
                <span style={{ fontSize:12, color:"#94a3b8" }}>ไม่มีข้อมูล ADR ในเดือนนี้</span>
              </div>
            ) : (
              <>
                <DoughnutChart
                  labels={freqLabels}
                  values={freqValues}
                  colors={freqColors}
                  centerLabel="อาการ"
                  centerValue={freqTotal}
                />
                {othersCount > 0 && (
                  <div style={{ marginTop:14, borderTop:"1px solid #f1f5f9", paddingTop:12 }}>
                    <div style={{ fontSize:10, fontWeight:700, color:"#94a3b8", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:8 }}>
                      Others — {othersItems.length} รายการ
                    </div>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                      {othersItems.map((s) => (
                        <span key={s.name} style={{
                          fontSize:10, color:"#64748b", background:"#f8fafc",
                          border:"1px solid #e2e8f0", borderRadius:5,
                          padding:"2px 8px", fontFamily:"'IBM Plex Sans', sans-serif",
                          display:"flex", alignItems:"center", gap:4,
                        }}>
                          <span style={{ fontWeight:700, color:"#94a3b8", fontFamily:"'IBM Plex Mono', monospace" }}>{s.count}</span>
                          {s.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Grade Distribution */}
          <div style={S.card}>
            <div style={S.cardHeader}>
              <div><div style={S.cardTitle}>Grade Distribution</div><div style={S.cardSub}>ระดับความรุนแรง CTCAE</div></div>
              <span style={S.badge("#dc2626","#fef2f2")}>SEVERITY</span>
            </div>
            <DoughnutChart
              labels={["Grade 1 — Mild","Grade 2 — Moderate","Grade 3 — Severe","Grade 4 — Life-threatening","Grade 5 — Fatal"]}
              values={gradeDist.map(({ cnt }) => cnt)}
              colors={[1,2,3,4,5].map((g) => GRADE_META[g].color)}
              centerLabel="grade events"
              centerValue={gradeDist.reduce((a,b) => a+b.cnt, 0)}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{ marginTop:24, padding:"12px 0", borderTop:"1px solid #e2e8f0", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span style={{ fontSize:11, color:"#cbd5e1", fontFamily:"'IBM Plex Mono', monospace" }}>ADR-MON v1.0 · CTCAE v6.0</span>
          <span style={{ fontSize:11, color:"#cbd5e1" }}>ข้อมูลนี้ใช้สำหรับการติดตามภายในเท่านั้น</span>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;