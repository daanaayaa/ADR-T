import { useEffect, useMemo, useState, useCallback } from "react";
import { recordApi, ctcaeApi, drugsApi } from "../services/api";
import ctcae from "../data/ctcae.json";

const DRUG_OPTIONS = [
  "Paclitaxel","Carboplatin","Trastuzumab","Pertuzumab",
  "Oxaliplatin","5-FU","Cisplatin","Docetaxel",
];

const GRADE_CLS = {
  1: "bg-emerald-100 text-emerald-700 border-emerald-200",
  2: "bg-amber-100 text-amber-700 border-amber-200",
  3: "bg-orange-100 text-orange-700 border-orange-200",
  4: "bg-red-100 text-red-700 border-red-200",
  5: "bg-slate-700 text-white border-slate-700",
};

const GRADE_COLORS = {
  1: "bg-emerald-50 text-emerald-700 border-emerald-200",
  2: "bg-amber-50 text-amber-700 border-amber-200",
  3: "bg-orange-50 text-orange-700 border-orange-200",
  4: "bg-red-50 text-red-700 border-red-200",
  5: "bg-slate-800 text-white border-slate-800",
};

const GRADE_DOT = {
  1: "#16a34a", 2: "#d97706", 3: "#ea580c", 4: "#dc2626", 5: "#374151",
};

const GRADE_LABEL = { 1:"Mild", 2:"Moderate", 3:"Severe", 4:"Life-threatening", 5:"Fatal" };

const buildRegimen = (drugs = []) => [...drugs].sort().join(" + ") || "-";

/* ── Date helpers ────────────────────────────────────────────────────────────── */
// ใช้ local date (ไม่ใช่ UTC) เพื่อให้วันที่ตรงกับ timezone ไทย (UTC+7)
const toLocalISO = (d) => {
  if (!(d instanceof Date)) return "";
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};
const todayISO        = () => toLocalISO(new Date());
const daysAgoISO      = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return toLocalISO(d); };
const startOfMonthISO = () => { const d = new Date(); d.setDate(1); return toLocalISO(d); };

const formatThaiDate = (iso) => {
  if (!iso || iso === "ไม่ระบุวันที่") return iso || "ไม่ระบุวันที่";
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  const [y, m, day] = parts;
  const months = ["","มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน",
                  "กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
  return `${parseInt(day)} ${months[parseInt(m)]} ${parseInt(y) + 543}`;
};

const DATE_PRESETS = [
  { label: "วันนี้",          getValue: () => ({ from: todayISO(),        to: todayISO() }) },
  { label: "7 วันย้อนหลัง",  getValue: () => ({ from: daysAgoISO(6),     to: todayISO() }) },
  { label: "30 วันย้อนหลัง", getValue: () => ({ from: daysAgoISO(29),    to: todayISO() }) },
  { label: "เดือนนี้",        getValue: () => ({ from: startOfMonthISO(), to: todayISO() }) },
  { label: "ทั้งหมด",         getValue: () => ({ from: "",                to: "" }) },
];

/* ── normalize symptoms ──
 * Priority 1: symptomsDetail (DB rows จาก JOIN — มี term_label/custom_label ครบ)
 * Priority 2: symptoms JSON object จาก view_adr_summary (fallback)
 */
const normalizeSymptoms = (symptoms = {}, symptomsDetail = []) => {
  if (Array.isArray(symptomsDetail) && symptomsDetail.length > 0) {
    return symptomsDetail
      .filter((s) => s && s.grade)
      .map((s) => ({
        name:  s.custom_label || s.term_label || s.term_key || s.custom_key || "Unknown",
        grade: Number(s.grade),
      }));
  }
  // fallback: JSON object
  return Object.entries(symptoms)
    .filter(([, v]) => v !== null && v !== undefined)
    .map(([key, val]) => {
      if (typeof val === "object" && val !== null && "grade" in val)
        return { name: val.label || key, grade: Number(val.grade) };
      if (typeof val === "number") return { name: key, grade: val };
      return null;
    })
    .filter(Boolean);
};

/* ── Symptoms cell ── */
function SymptomsCell({ symptoms }) {
  const [expanded, setExpanded] = useState(false);
  const MAX = 2;
  if (!symptoms.length) return <span className="text-slate-300 text-sm">—</span>;
  const visible = expanded ? symptoms : symptoms.slice(0, MAX);
  const hidden = symptoms.length - MAX;
  return (
    <div className="flex flex-col gap-1 items-start">
      {visible.map((s, i) => (
        <span key={i} title={`${s.name} Grade ${s.grade}`}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border max-w-[200px] ${GRADE_CLS[s.grade] || "bg-slate-100 text-slate-600 border-slate-200"}`}>
          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: GRADE_DOT[s.grade] || "#94a3b8" }} />
          <span className="truncate">{s.name}</span>
          <span className="flex-shrink-0 ml-0.5">G{s.grade}</span>
        </span>
      ))}
      {!expanded && hidden > 0 && (
        <button onClick={(e) => { e.stopPropagation(); setExpanded(true); }}
          className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 border border-slate-200 text-slate-500 hover:bg-slate-200 transition">
          +{hidden} more
        </button>
      )}
      {expanded && symptoms.length > MAX && (
        <button onClick={(e) => { e.stopPropagation(); setExpanded(false); }}
          className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 border border-slate-200 text-slate-500 hover:bg-slate-200 transition">
          แสดงน้อยลง
        </button>
      )}
    </div>
  );
}

/* ── CTCAE Symptom Editor ── */
function SymptomEditor({ value, onChange }) {
  const [search, setSearch] = useState("");
  const CTCAE_TERMS = useMemo(() => ctcae.flatMap((c) => c.terms || []), []);
  const filteredTerms = useMemo(() => {
    const matched = CTCAE_TERMS.filter((s) => s.label?.toLowerCase().includes(search.toLowerCase()));
    return search.trim() ? matched.slice(0, 40) : matched.slice(0, 5);
  }, [search, CTCAE_TERMS]);

  const [selectedSymptoms, setSelectedSymptoms] = useState(() => {
    const termMap = {};
    ctcae.flatMap((c) => c.terms || []).forEach((t) => { termMap[t.key] = t; });
    return Object.entries(value).map(([key, sym]) =>
      termMap[key] || { key, label: sym.label || key, options: [], isCustom: true }
    );
  });
  const selectedKeys = selectedSymptoms.map((s) => s.key);

  const addSymptom = (symptom) => {
    if (selectedKeys.includes(symptom.key)) return;
    setSelectedSymptoms((prev) => [...prev, symptom]);
    onChange({ ...value, [symptom.key]: { label: symptom.label, description: "", grade: null } });
  };
  const removeSymptom = (key) => {
    setSelectedSymptoms((prev) => prev.filter((s) => s.key !== key));
    const u = { ...value }; delete u[key]; onChange(u);
  };
  const handleGrade = (symptom, gradeNum) => {
    if (!gradeNum) return;
    const option = symptom.options?.find((o) => Number(o.grade) === gradeNum);
    const prev = value[symptom.key];
    onChange({
      ...value,
      [symptom.key]: {
        label: symptom.label,
        description: option?.description || "",
        grade: gradeNum,
        isCustom: symptom.isCustom || false,
        additionalDetail: prev?.additionalDetail || "",
      },
    });
  };
  const handleAdditionalDetail = (key, text) => {
    onChange({ ...value, [key]: { ...value[key], additionalDetail: text } });
  };

  const inputCls = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition";
  const labelCls = "block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5";

  return (
    <div className="space-y-3">
      <label className={labelCls}>อาการไม่พึงประสงค์ (CTCAE)</label>
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input type="text" placeholder="ค้นหาอาการ เช่น Nausea, Fatigue, Neuropathy..." value={search}
          onChange={(e) => setSearch(e.target.value)} className={inputCls + " pl-9"} />
      </div>
      {search.trim() && (
        <div className="flex flex-wrap gap-1.5 max-h-[130px] overflow-y-auto bg-slate-50 rounded-xl p-3 border border-slate-200">
          {filteredTerms.map((s) => {
            const isSelected = selectedKeys.includes(s.key);
            return (
              <button key={s.key} onClick={() => addSymptom(s)} disabled={isSelected}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${isSelected ? "bg-blue-50 border-blue-300 text-blue-600 cursor-default" : "border-slate-200 text-slate-600 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700"}`}>
                {isSelected ? "✓" : "+"} {s.label}
              </button>
            );
          })}
        </div>
      )}
      {selectedSymptoms.length > 0 && (
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {selectedSymptoms.map((symptom) => {
            const sym = value[symptom.key];
            return (
              <div key={symptom.key}
                className={`rounded-xl border px-4 py-3 transition-colors ${sym?.grade ? GRADE_COLORS[sym.grade] : "border-slate-200 bg-white"}`}>
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <span className="font-bold text-sm">{symptom.label}</span>
                  {symptom.isCustom && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-600 border border-purple-200">Custom</span>
                  )}
                  {sym?.grade && (
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${GRADE_COLORS[sym.grade]}`}>
                      Grade {sym.grade} · {GRADE_LABEL[sym.grade]}
                    </span>
                  )}
                </div>
                {sym?.grade && sym?.description && (
                  <p className="text-xs opacity-75 mb-2 leading-relaxed">{sym.description}</p>
                )}
                <div className="flex items-center gap-2">
                  <select value={sym?.grade || ""} onChange={(e) => handleGrade(symptom, Number(e.target.value))}
                    className={`flex-1 rounded-xl border px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer transition ${sym?.grade ? GRADE_COLORS[sym.grade] : "border-slate-200 bg-white text-slate-600"}`}>
                    <option value="">เลือกระดับความรุนแรง</option>
                    {(symptom.options || []).map((o) => (
                      <option key={o.grade} value={o.grade}>Grade {o.grade} — {o.description}</option>
                    ))}
                  </select>
                  <button onClick={() => removeSymptom(symptom.key)}
                    className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg bg-white/60 hover:bg-red-50 hover:text-red-500 text-current opacity-60 transition text-sm font-bold border border-current/20">×</button>
                </div>
                {sym?.grade && (
                  <div className="mt-2">
                    <label className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 opacity-80">
                      <svg className="w-2.5 h-2.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                      </svg>
                      รายละเอียดเพิ่มเติม
                    </label>
                    <textarea rows={2} value={sym?.additionalDetail || ""}
                      onChange={(e) => handleAdditionalDetail(symptom.key, e.target.value)}
                      placeholder="เช่น คลื่นไส้หลังให้ยา 2 ชั่วโมง, CBC ลดลงจากรอบก่อน..."
                      className="w-full rounded-xl border border-white/40 bg-white/30 px-2.5 py-2 text-xs text-current placeholder:opacity-40 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent resize-none transition" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {selectedSymptoms.length === 0 && !search.trim() && (
        <p className="text-xs text-slate-400 italic">พิมพ์ชื่ออาการเพื่อเพิ่ม</p>
      )}
    </div>
  );
}

/* ── Main Records ──────────────────────────────────────────────────────────── */
function Records({ userRole, onOpenDetail }) {
  const canEdit = userRole === "pharmacist";

  const [records,      setRecords]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [saving,       setSaving]       = useState(false);
  const [confirmId,    setConfirmId]    = useState(null);

  /* ── Filter state ── */
  const [search,       setSearch]       = useState("");
  const [dateFrom,     setDateFrom]     = useState("");
  const [dateTo,       setDateTo]       = useState("");
  const [activePreset, setActivePreset] = useState("ทั้งหมด");
  const [filterGrade,  setFilterGrade]  = useState("");

  const applyPreset = (preset) => {
    const { from, to } = preset.getValue();
    setDateFrom(from);
    setDateTo(to);
    setActivePreset(preset.label);
  };

  /* ── Fetch ── */
  const fetchRecords = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await recordApi.getAll();
      const normalized = (data || []).map((r) => ({
        ...r,
        date:        (r.record_date || r.date || "").slice(0, 10),
        patientName: r.patient_name || r.patientName || "",
        regimen:     r.regimen || buildRegimen(r.drugs),
        symptoms:    r.symptoms || {},
        vn:          r.vn || null,
        an:          r.an || null,
        weight:      r.weight || r.patient_weight || r.patient?.weight || r.vital?.weight || "",
        height:      r.height || r.patient_height || r.patient?.height || r.vital?.height || "",
        bsa:         r.bsa || r.vital?.bsa || (() => {
          const w = parseFloat(r.weight || r.patient_weight || r.patient?.weight || r.vital?.weight);
          const h = parseFloat(r.height || r.patient_height || r.patient?.height || r.vital?.height);
          return w && h ? Math.sqrt((w * h) / 3600).toFixed(2) : "";
        })(),
      }));
      setRecords(normalized);
    } catch (err) {
      setError(err.message || "ไม่สามารถโหลดข้อมูลได้");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  /* ── Delete ── */
  const handleDelete = async (id) => {
    setSaving(true);
    try {
      await recordApi.delete(id);
      setRecords((prev) => prev.filter((r) => r.id !== id));
      setConfirmId(null);
    } catch (err) {
      alert(`ลบไม่สำเร็จ: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  /* ── Filtered list (sorted newest first) ── */
  const filtered = useMemo(() => {
    return records
      .filter((r) => {
        const q = search.toLowerCase();
        const matchSearch = !q ||
          (r.hn         || "").toLowerCase().includes(q) ||
          (r.patientName|| "").toLowerCase().includes(q) ||
          (r.regimen    || "").toLowerCase().includes(q) ||
          (r.diagnosis  || "").toLowerCase().includes(q);
        const matchFrom  = !dateFrom || (r.date || "") >= dateFrom;
        const matchTo    = !dateTo   || (r.date || "") <= dateTo;
        const matchGrade = !filterGrade || normalizeSymptoms(r.symptoms, r.symptomsDetail).some((s) => String(s.grade) === filterGrade);
        return matchSearch && matchFrom && matchTo && matchGrade;
      })
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [records, search, dateFrom, dateTo, filterGrade]);

  /* ── Group by date ── */
  const groupedByDate = useMemo(() => {
    const groups = {};
    filtered.forEach((r) => {
      const key = r.date || "ไม่ระบุวันที่";
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    });
    return Object.entries(groups); // already sorted newest-first
  }, [filtered]);

  const confirmRecord = confirmId !== null ? records.find((r) => r.id === confirmId) : null;

  const rangeLabel = useMemo(() => {
    if (!dateFrom && !dateTo) return "ทั้งหมด";
    const fmt = (iso) => iso ? iso.split("-").reverse().join("/") : "...";
    if (dateFrom === dateTo) return fmt(dateFrom);
    return `${fmt(dateFrom)} – ${fmt(dateTo)}`;
  }, [dateFrom, dateTo]);

  return (
    <div>
      {/* ── Confirm Delete Modal ── */}
      {confirmId !== null && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-8 text-center">
            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">ยืนยันการลบ?</h3>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">
              ข้อมูลการประเมินของ <strong className="text-slate-700">{confirmRecord?.patientName}</strong>
              <br />วันที่ {confirmRecord?.date} จะถูกลบถาวร
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmId(null)} disabled={saving}
                className="flex-1 px-4 py-2.5 border border-slate-300 hover:border-slate-400 text-slate-700 font-semibold text-sm rounded-xl transition disabled:opacity-50">
                ยกเลิก
              </button>
              <button onClick={() => handleDelete(confirmId)} disabled={saving}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold text-sm rounded-xl transition disabled:opacity-60 flex items-center justify-center gap-2">
                {saving && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {saving ? "กำลังลบ..." : "ลบข้อมูล"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Patient Records</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {loading ? "กำลังโหลด..." : `แสดงผล ${filtered.length} รายการ · ${rangeLabel}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchRecords} disabled={loading}
            className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 transition disabled:opacity-40">
            <svg className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Filter Bar ── */}
      <div className="mb-4 space-y-3">

        {/* Date preset buttons */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mr-1">ช่วงเวลา</span>
          {DATE_PRESETS.map((p) => (
            <button key={p.label} onClick={() => applyPreset(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                activePreset === p.label
                  ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                  : "bg-white border-slate-200 text-slate-600 hover:border-blue-400 hover:text-blue-600"
              }`}>
              {p.label}
            </button>
          ))}
        </div>

        {/* Search + date range + grade filter */}
        <div className="flex flex-wrap gap-2 items-center">

          {/* Text search */}
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input type="text" placeholder="HN / ชื่อ / Regimen / Diagnosis..."
              className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 w-full hover:border-slate-300 transition"
              value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>

          {/* Date From */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400 font-medium whitespace-nowrap">จาก</span>
            <input type="date" value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setActivePreset(""); }}
              className="px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 hover:border-slate-300 transition" />
          </div>

          {/* Date To */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400 font-medium whitespace-nowrap">ถึง</span>
            <input type="date" value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setActivePreset(""); }}
              className="px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 hover:border-slate-300 transition" />
          </div>

          {/* Grade filter */}
          <select value={filterGrade} onChange={(e) => setFilterGrade(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 hover:border-slate-300 transition cursor-pointer">
            <option value="">ทุก Grade</option>
            {[1,2,3,4,5].map((g) => (
              <option key={g} value={g}>Grade {g} — {GRADE_LABEL[g]}</option>
            ))}
          </select>

          {/* Clear filters */}
          {(search || dateFrom || dateTo || filterGrade) && (
            <button onClick={() => { setSearch(""); setDateFrom(""); setDateTo(""); setFilterGrade(""); setActivePreset("ทั้งหมด"); }}
              className="px-3 py-2 rounded-xl text-xs font-semibold text-red-500 border border-red-200 bg-red-50 hover:bg-red-100 transition whitespace-nowrap">
              ล้างตัวกรอง
            </button>
          )}
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between">
          <span className="text-sm text-red-600">⚠ {error}</span>
          <button onClick={fetchRecords} className="text-xs text-red-600 border border-red-300 rounded-lg px-3 py-1 hover:bg-red-100 transition">
            ลองอีกครั้ง
          </button>
        </div>
      )}

      {/* ── Table: Loading skeleton ── */}
      {loading && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead style={{ background: "linear-gradient(135deg,#0f4c81,#1a6fb5)" }}>
                <tr>
                  {["Date","HN","VN / AN","Patient Name","Regimen","Cycle","Symptoms","Note","จัดการ"].map((h) => (
                    <th key={h} className={`px-4 py-3.5 text-xs font-bold text-blue-100 uppercase tracking-wide whitespace-nowrap text-left ${h === "จัดการ" ? "text-center" : ""}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 9 }).map((__, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-100 rounded w-3/4" /></td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Grouped date sections ── */}
      {!loading && (
        groupedByDate.length > 0 ? (
          <div className="space-y-5">
            {groupedByDate.map(([dateKey, rows]) => (
              <div key={dateKey}>
                {/* Date section header */}
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-5 rounded-full bg-blue-500" />
                    <h2 className="text-sm font-bold text-slate-700">{formatThaiDate(dateKey)}</h2>
                    <span className="px-2 py-0.5 rounded-full bg-blue-50 border border-blue-100 text-blue-600 text-[11px] font-bold">
                      {rows.length} ราย
                    </span>
                  </div>
                  <div className="flex-1 h-px bg-slate-200" />
                </div>

                {/* Table for this date group */}
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px]">
                      <thead style={{ background: "linear-gradient(135deg,#0f4c81,#1a6fb5)" }}>
                        <tr>
                          {["HN","VN / AN","Patient Name","Regimen","Cycle","Symptoms","Note","จัดการ"].map((h) => (
                            <th key={h}
                              className={`px-4 py-3 text-xs font-bold text-blue-100 uppercase tracking-wide whitespace-nowrap
                                ${h === "จัดการ" ? "text-center" : "text-left"}
                                ${h === "VN / AN" ? "hidden sm:table-cell" : ""}
                                ${h === "Note" ? "hidden md:table-cell" : ""}`}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {rows.map((item) => {
                          const allSymptoms = normalizeSymptoms(item.symptoms, item.symptomsDetail);
                          const vnAn = item.vn || item.an || item.encounter?.vn || item.encounter?.an || "-";
                          return (
                            <tr key={item.id} className="hover:bg-blue-50/40 transition-colors align-top">

                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className="text-sm font-black text-blue-700">{item.hn || "-"}</span>
                              </td>

                              <td className="px-4 py-3 text-sm text-slate-500 whitespace-nowrap hidden sm:table-cell">{vnAn}</td>

                              <td className="px-4 py-3 whitespace-nowrap">
                                <p className="text-sm font-bold text-slate-800">{item.patientName || "-"}</p>
                                {item.diagnosis && (
                                  <p className="text-[11px] text-red-600 font-medium mt-0.5">{item.diagnosis}</p>
                                )}
                              </td>

                              <td className="px-4 py-3 w-[160px] max-w-[160px] overflow-hidden">
                                {item.regimen && item.regimen !== "-" ? (
                                  <span title={item.regimen} className="inline-flex items-center px-2.5 py-1 bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold rounded-lg max-w-full">
                                    <span className="truncate">{item.regimen}</span>
                                  </span>
                                ) : <span className="text-slate-300 text-sm">—</span>}
                              </td>

                              <td className="px-4 py-3 text-center whitespace-nowrap">
                                {item.cycle ? (
                                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-slate-100 border border-slate-200 text-sm font-black text-slate-700">{item.cycle}</span>
                                ) : <span className="text-slate-300">—</span>}
                              </td>

                              <td className="px-4 py-3 w-[220px] max-w-[220px] overflow-hidden">
                                <SymptomsCell symptoms={allSymptoms} />
                              </td>

                              <td className="px-4 py-3 text-xs text-slate-500 max-w-[130px] break-words leading-relaxed hidden md:table-cell">
                                {item.note || <span className="text-slate-300">—</span>}
                              </td>

                              <td className="px-4 py-3">
                                <div className="flex gap-1.5 justify-center">
                                  <button onClick={() => onOpenDetail(item.id, canEdit)} title="ดูรายละเอียด"
                                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-600 transition-all">
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.641 0-8.573-3.007-9.964-7.178z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                  </button>
                                  {canEdit && (
                                    <button onClick={() => setConfirmId(item.id)} title="ลบ"
                                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-50 hover:bg-red-100 border border-red-200 text-red-500 transition-all">
                                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                      </svg>
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Empty state */
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">
            <div className="px-4 py-16 text-center">
              <div className="flex flex-col items-center gap-2">
                <svg className="w-12 h-12 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                </svg>
                <p className="text-slate-400 text-sm font-medium">
                  {(search || dateFrom || dateTo || filterGrade) ? "ไม่พบข้อมูลที่ตรงกับเงื่อนไข" : "ยังไม่มีข้อมูลการประเมิน"}
                </p>
                {!(search || dateFrom || dateTo || filterGrade) && (
                  <p className="text-slate-300 text-xs">บันทึกการประเมินจาก Assessment เพื่อแสดงข้อมูลที่นี่</p>
                )}
              </div>
            </div>
          </div>
        )
      )}
    </div>
  );
}

export default Records;