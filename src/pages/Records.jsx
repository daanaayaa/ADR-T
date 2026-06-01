import { useEffect, useMemo, useState } from "react";
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

/* ── normalize symptoms ── */
const normalizeSymptoms = (symptoms = {}) =>
  Object.entries(symptoms)
    .filter(([, v]) => v !== null && v !== undefined)
    .map(([key, val]) => {
      if (typeof val === "object" && val !== null && "grade" in val)
        return { name: val.label || key, grade: val.grade };
      if (typeof val === "number") return { name: key, grade: val };
      return null;
    })
    .filter(Boolean);

/* ── Symptoms cell with overflow handling ── */
function SymptomsCell({ symptoms }) {
  const [expanded, setExpanded] = useState(false);
  const MAX = 2;
  if (!symptoms.length) return <span className="text-slate-300 text-sm">—</span>;
  const visible = expanded ? symptoms : symptoms.slice(0, MAX);
  const hidden = symptoms.length - MAX;
  return (
    <div className="flex flex-wrap gap-1 items-center">
      {visible.map((s, i) => (
        <span key={i}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border ${GRADE_CLS[s.grade] || "bg-slate-100 text-slate-600 border-slate-200"}`}>
          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: GRADE_DOT[s.grade] || "#94a3b8" }} />
          {s.name} G{s.grade}
        </span>
      ))}
      {!expanded && hidden > 0 && (
        <button onClick={() => setExpanded(true)}
          className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 border border-slate-200 text-slate-500 hover:bg-slate-200 transition">
          +{hidden} more
        </button>
      )}
      {expanded && symptoms.length > MAX && (
        <button onClick={() => setExpanded(false)}
          className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 border border-slate-200 text-slate-500 hover:bg-slate-200 transition">
          แสดงน้อยลง
        </button>
      )}
    </div>
  );
}

/* ── CTCAE Symptom Editor (sub-component for EditModal) ── */
function SymptomEditor({ value, onChange }) {
  const [search, setSearch] = useState("");
  const CTCAE_TERMS = useMemo(() => ctcae.flatMap((c) => c.terms || []), []);
  const filteredTerms = useMemo(() =>
    CTCAE_TERMS.filter((s) => s.label?.toLowerCase().includes(search.toLowerCase())).slice(0, 40),
    [search, CTCAE_TERMS]
  );

  // value is the symptoms object { key: { label, description, grade } }
  const selectedKeys = Object.keys(value);

  const addSymptom = (symptom) => {
    if (selectedKeys.includes(symptom.key)) return;
    onChange({ ...value, [symptom.key]: { label: symptom.label, description: "", grade: null } });
  };

  const removeSymptom = (key) => {
    const u = { ...value };
    delete u[key];
    onChange(u);
  };

  const handleGrade = (symptomTerm, grade) => {
    const option = symptomTerm.options?.find((o) => o.grade === grade);
    if (!option) return;
    onChange({
      ...value,
      [symptomTerm.key]: { label: symptomTerm.label, description: option.description, grade },
    });
  };

  // Build lookup: key → full CTCAE term (for options)
  const termByKey = useMemo(() => {
    const map = {};
    CTCAE_TERMS.forEach((t) => { map[t.key] = t; });
    return map;
  }, [CTCAE_TERMS]);

  const inputCls = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition";
  const labelCls = "block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5";

  return (
    <div className="space-y-3">
      <label className={labelCls}>อาการไม่พึงประสงค์ (CTCAE)</label>

      {/* Search */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input type="text" placeholder="ค้นหาอาการ..." value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={inputCls + " pl-9"} />
      </div>

      {/* Tag suggestions */}
      {search.trim() && (
        <div className="flex flex-wrap gap-1.5 max-h-[130px] overflow-y-auto bg-slate-50 rounded-xl p-3 border border-slate-200">
          {filteredTerms.map((s) => {
            const isSelected = selectedKeys.includes(s.key);
            return (
              <button key={s.key} onClick={() => addSymptom(s)} disabled={isSelected}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition
                  ${isSelected ? "bg-blue-50 border-blue-300 text-blue-600 cursor-default" : "border-slate-200 text-slate-600 hover:border-blue-400 hover:bg-blue-50"}`}>
                {isSelected ? "✓" : "+"} {s.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Selected symptoms with grade dropdowns */}
      {selectedKeys.length > 0 && (
        <div className="space-y-2 max-h-[250px] overflow-y-auto">
          {selectedKeys.map((key) => {
            const sym = value[key];
            const term = termByKey[key];
            return (
              <div key={key} className={`rounded-xl border px-4 py-3 ${sym.grade ? GRADE_COLORS[sym.grade] : "border-slate-200 bg-white"}`}>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="font-bold text-sm">{sym.label}</span>
                  <button onClick={() => removeSymptom(key)}
                    className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-red-100 hover:text-red-500 text-current opacity-60 transition text-base font-bold flex-shrink-0">
                    ×
                  </button>
                </div>
                {sym.grade && sym.description && (
                  <p className="text-xs opacity-75 mb-2 leading-relaxed">{sym.description}</p>
                )}
                <select
                  value={sym.grade || ""}
                  onChange={(e) => term && handleGrade(term, Number(e.target.value))}
                  className={`w-full rounded-lg border px-3 py-1.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer
                    ${sym.grade ? GRADE_COLORS[sym.grade] : "border-slate-200 bg-white text-slate-600"}`}>
                  <option value="">เลือกระดับความรุนแรง</option>
                  {(term?.options || []).map((o) => (
                    <option key={o.grade} value={o.grade}>Grade {o.grade} — {o.description}</option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      )}

      {selectedKeys.length === 0 && !search.trim() && (
        <p className="text-xs text-slate-400 italic">พิมพ์ชื่ออาการเพื่อเพิ่ม</p>
      )}
    </div>
  );
}

/* ── Edit Modal (full: step1 + step2 fields) ── */
function EditModal({ record, onSave, onClose }) {
  const [form, setForm] = useState({
    date:   record.date   || "",
    cycle:  record.cycle  || "",
    weight: record.weight || "",
    height: record.height || "",
    drugs:  record.drugs  || [],
    note:   record.note   || "",
  });
  const [symptoms, setSymptoms] = useState(() => {
    // Normalize saved symptoms to { key: { label, description, grade } }
    const raw = record.symptoms || {};
    const normalized = {};
    Object.entries(raw).forEach(([key, val]) => {
      if (typeof val === "object" && val !== null && "grade" in val) {
        normalized[key] = val;
      } else if (typeof val === "number") {
        normalized[key] = { label: key, description: "", grade: val };
      }
    });
    return normalized;
  });
  const [drugSearch,   setDrugSearch]   = useState("");
  const [drugFiltered, setDrugFiltered] = useState([]);
  const [activeTab,    setActiveTab]    = useState("step1"); // "step1" | "step2"

  const handleDrugSearch = (val) => {
    setDrugSearch(val);
    setDrugFiltered(!val.trim() ? [] :
      DRUG_OPTIONS.filter((d) => d.toLowerCase().includes(val.toLowerCase()) && !form.drugs.includes(d))
    );
  };
  const addDrug    = (d) => { setForm((f) => ({ ...f, drugs: [...f.drugs, d] })); setDrugSearch(""); setDrugFiltered([]); };
  const removeDrug = (d) => setForm((f) => ({ ...f, drugs: f.drugs.filter((x) => x !== d) }));
  const calcBSA = () => {
    const w = parseFloat(form.weight), h = parseFloat(form.height);
    return w && h ? Math.sqrt((w * h) / 3600).toFixed(2) : "";
  };

  const inputCls = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition";
  const labelCls = "block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5";

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col mx-4">

        {/* Header */}
        <div className="flex items-center justify-between px-7 py-5 border-b border-slate-100 flex-shrink-0"
          style={{ background: "linear-gradient(135deg,#0f4c81,#1a6fb5)" }}>
          <div>
            <h3 className="text-base font-bold text-white">แก้ไขข้อมูลการประเมิน</h3>
            <p className="text-xs text-blue-200 mt-0.5">{record.patientName} · HN {record.hn}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/20 hover:bg-white/30 text-white text-lg transition">×</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 flex-shrink-0">
          {[
            { key: "step1", label: "ข้อมูลการประเมิน (Step 1)" },
            { key: "step2", label: "อาการ CTCAE (Step 2)" },
          ].map((tab) => (
            <button key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-3 text-xs font-bold transition border-b-2 ${
                activeTab === tab.key
                  ? "border-blue-600 text-blue-700 bg-white"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="px-7 py-5 overflow-y-auto flex-1 space-y-4">
          {activeTab === "step1" ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label:"วันที่ประเมิน", key:"date",   type:"date"   },
                  { label:"Cycle",         key:"cycle",  type:"number" },
                  { label:"น้ำหนัก (kg)", key:"weight", type:"number" },
                  { label:"ส่วนสูง (cm)", key:"height", type:"number" },
                ].map(({ label, key, type }) => (
                  <div key={key}>
                    <label className={labelCls}>{label}</label>
                    <input type={type} value={form[key]}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                      className={inputCls} />
                  </div>
                ))}
              </div>

              <div className="w-44">
                <label className={labelCls}>BSA (m²)</label>
                <input type="text" value={calcBSA()} readOnly
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-400 bg-slate-50 cursor-not-allowed" />
              </div>

              <div className="relative">
                <label className={labelCls}>ยาที่ได้รับ</label>
                <input type="text" placeholder="ค้นหายา..." value={drugSearch}
                  onChange={(e) => handleDrugSearch(e.target.value)} className={inputCls} />
                {drugFiltered.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-50">
                    {drugFiltered.map((d) => (
                      <div key={d} onClick={() => addDrug(d)}
                        className="px-4 py-2.5 cursor-pointer hover:bg-blue-50 text-sm text-slate-700 border-b border-slate-100 last:border-0">
                        {d}
                      </div>
                    ))}
                  </div>
                )}
                {form.drugs.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {form.drugs.map((d) => (
                      <span key={d} className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 border border-blue-200 text-blue-800 text-xs font-semibold rounded-lg">
                        {d}
                        <button onClick={() => removeDrug(d)} className="text-blue-400 hover:text-blue-700 font-bold">×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className={labelCls}>Note</label>
                <textarea rows={3} placeholder="กรอกหมายเหตุ..." value={form.note}
                  onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                  className={inputCls + " resize-none"} />
              </div>
            </>
          ) : (
            <SymptomEditor value={symptoms} onChange={setSymptoms} />
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-7 py-4 border-t border-slate-100 bg-slate-50 flex-shrink-0">
          <button onClick={onClose}
            className="px-5 py-2 border border-slate-300 hover:border-slate-400 text-slate-700 font-semibold text-sm rounded-xl transition">
            ยกเลิก
          </button>
          <button onClick={() => onSave({ ...form, bsa: calcBSA(), regimen: buildRegimen(form.drugs), symptoms })}
            className="flex items-center gap-2 px-5 py-2 text-white font-semibold text-sm rounded-xl transition"
            style={{ background: "linear-gradient(135deg,#0f4c81,#1a6fb5)" }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 3.75V16.5L12 14.25 7.5 16.5V3.75m9 0H18A2.25 2.25 0 0120.25 6v12A2.25 2.25 0 0118 20.25H6A2.25 2.25 0 013.75 18V6A2.25 2.25 0 016 3.75h1.5m9 0h-9" />
            </svg>
            บันทึกการแก้ไข
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Records ── */
function Records({ patientRecords: propRecords, setPatientRecords: setPropRecords, userRole }) {
  // pharmacist = สิทธิ์แก้ไข/ลบ | nurse = ดูได้อย่างเดียว
  const canEdit = userRole === "pharmacist";
  // Always maintain internal copy — single source of truth to avoid stale closure bugs
  const [localRecords, setLocalRecords] = useState(() =>
    JSON.parse(localStorage.getItem("patientRecords") || "[]").map((r) => ({
      ...r,
      regimen: r.regimen || buildRegimen(r.drugs),
    }))
  );
  const [search,       setSearch]       = useState("");
  const [confirmIndex, setConfirmIndex] = useState(null);
  const [editIndex,    setEditIndex]    = useState(null);

  // Sync inbound prop changes (e.g. Step2 just saved a new record)
  useEffect(() => {
    if (propRecords) {
      const migrated = propRecords.map((r) => ({
        ...r,
        regimen: r.regimen || buildRegimen(r.drugs),
      }));
      setLocalRecords(migrated);
    }
  }, [propRecords]);

  // Always read from localRecords; write to local + localStorage + prop
  const persistRecords = (data) => {
    setLocalRecords(data);
    localStorage.setItem("patientRecords", JSON.stringify(data));
    if (setPropRecords) setPropRecords(data);
  };

  const handleDelete = (realIndex) => {
    const updated = localRecords.filter((_, i) => i !== realIndex);
    persistRecords(updated);
    setConfirmIndex(null);
  };

  const handleSaveEdit = (updatedFields) => {
    const updated = localRecords.map((r, i) =>
      i === editIndex ? { ...r, ...updatedFields } : r
    );
    persistRecords(updated);
    setEditIndex(null);
  };

  const patientRecords = localRecords;

  const filtered = patientRecords
    .map((r, i) => ({ ...r, _realIndex: i }))
    .filter((r) => {
      const q = search.toLowerCase();
      return !q ||
        (r.hn || "").includes(q) ||
        (r.patientName || "").toLowerCase().includes(q) ||
        (r.date || "").includes(q) ||
        (r.regimen || "").toLowerCase().includes(q);
    })
    .reverse();

  const confirmRecord = confirmIndex !== null ? patientRecords[confirmIndex] : null;
  const editRecord    = editIndex    !== null ? patientRecords[editIndex]    : null;

  return (
    <div>
      {editRecord && <EditModal record={editRecord} onSave={handleSaveEdit} onClose={() => setEditIndex(null)} />}

      {/* Confirm Delete Modal */}
      {confirmIndex !== null && (
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
              <button onClick={() => setConfirmIndex(null)}
                className="flex-1 px-4 py-2.5 border border-slate-300 hover:border-slate-400 text-slate-700 font-semibold text-sm rounded-xl transition">
                ยกเลิก
              </button>
              <button onClick={() => handleDelete(confirmIndex)}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold text-sm rounded-xl transition">
                ลบข้อมูล
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Patient Records</h1>
          <p className="text-xs text-slate-400 mt-0.5">{patientRecords.length} รายการทั้งหมด</p>
        </div>
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input type="text" placeholder="ค้นหา HN / ชื่อ / วันที่ / Regimen..."
            className="pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 w-72 hover:border-slate-300 transition"
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px]">
            <thead style={{ background: "linear-gradient(135deg,#0f4c81,#1a6fb5)" }}>
              <tr>
                {[...["Date","HN","VN / AN","Patient Name","Regimen","Cycle","Symptoms","Note"], ...(canEdit ? ["จัดการ"] : [])].map((h) => (
                  <th key={h}
                    className={`px-4 py-3.5 text-xs font-bold text-blue-100 uppercase tracking-wide whitespace-nowrap ${h === "จัดการ" ? "text-center" : "text-left"}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length > 0 ? (
                filtered.map((item) => {
                  const allSymptoms = normalizeSymptoms(item.symptoms);
                  const vnAn = item.vn || item.an || item.encounter?.vn || item.encounter?.an || "-";

                  return (
                    <tr key={item._realIndex} className="hover:bg-slate-50 transition-colors align-top">
                      <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{item.date || "-"}</td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm font-black text-blue-700">{item.hn || "-"}</span>
                      </td>

                      <td className="px-4 py-3 text-sm text-slate-500 whitespace-nowrap">{vnAn}</td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className="text-sm font-bold text-slate-800">{item.patientName || "-"}</p>
                        {item.diagnosis && (
                          <p className="text-[11px] text-red-600 font-medium mt-0.5">{item.diagnosis}</p>
                        )}
                      </td>

                      <td className="px-4 py-3 max-w-[160px]">
                        {item.regimen && item.regimen !== "-" ? (
                          <span className="inline-flex items-center px-2.5 py-1 bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold rounded-lg whitespace-nowrap">
                            {item.regimen}
                          </span>
                        ) : <span className="text-slate-300 text-sm">—</span>}
                      </td>

                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        {item.cycle ? (
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-slate-100 border border-slate-200 text-sm font-black text-slate-700">
                            {item.cycle}
                          </span>
                        ) : <span className="text-slate-300">—</span>}
                      </td>

                      {/* Symptoms — capped with expand */}
                      <td className="px-4 py-3 max-w-[220px]">
                        <SymptomsCell symptoms={allSymptoms} />
                      </td>

                      {/* Note */}
                      <td className="px-4 py-3 text-xs text-slate-500 max-w-[130px] break-words leading-relaxed">
                        {item.note || <span className="text-slate-300">—</span>}
                      </td>

                      {/* Actions — pharmacist only */}
                      {canEdit && (
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5 justify-center">
                          <button onClick={() => setEditIndex(item._realIndex)} title="แก้ไข"
                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-blue-600 border border-slate-200 text-slate-500 transition-all">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                            </svg>
                          </button>
                          <button onClick={() => setConfirmIndex(item._realIndex)} title="ลบ"
                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-50 hover:bg-red-100 border border-red-200 text-red-500 transition-all">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                            </svg>
                          </button>
                        </div>
                      </td>
                      )}
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="9" className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <svg className="w-12 h-12 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                      </svg>
                      <p className="text-slate-400 text-sm font-medium">
                        {search ? "ไม่พบข้อมูลที่ค้นหา" : "ยังไม่มีข้อมูลการประเมิน"}
                      </p>
                      {!search && (
                        <p className="text-slate-300 text-xs">บันทึกการประเมินจาก Step 2 เพื่อแสดงข้อมูลที่นี่</p>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Records;