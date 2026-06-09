import { useMemo, useState } from "react";
import ctcae from "../data/ctcae.json";
import { recordApi, buildRecordPayload } from "../services/api";

const GRADE_COLORS = {
  1: "bg-emerald-50 text-emerald-700 border-emerald-200",
  2: "bg-amber-50 text-amber-700 border-amber-200",
  3: "bg-orange-50 text-orange-700 border-orange-200",
  4: "bg-red-50 text-red-700 border-red-200",
  5: "bg-slate-800 text-white border-slate-800",
};
const GRADE_DOT = {
  1: "bg-emerald-500",
  2: "bg-amber-500",
  3: "bg-orange-500",
  4: "bg-red-500",
  5: "bg-slate-700",
};
const GRADE_LABEL = {
  1: "Mild",
  2: "Moderate",
  3: "Severe",
  4: "Life-threatening",
  5: "Fatal",
};

/* ─── Custom Symptom Modal ─── */
function CustomSymptomModal({ onAdd, onClose }) {
  const [label, setLabel]       = useState("");
  const [rows, setRows]         = useState([{ grade: "", desc: "" }]);
  const [error, setError]       = useState("");

  const usedGrades = rows.map((r) => Number(r.grade)).filter(Boolean);
  const availableGrades = (current) => [1, 2, 3, 4, 5].filter((g) => !usedGrades.includes(g) || g === Number(current));

  const updateRow = (i, field, val) => {
    setRows((p) => p.map((r, idx) => idx === i ? { ...r, [field]: val } : r));
    setError("");
  };

  const addRow = () => {
    if (usedGrades.length >= 5) return;
    setRows((p) => [...p, { grade: "", desc: "" }]);
  };

  const removeRow = (i) => setRows((p) => p.filter((_, idx) => idx !== i));

  const handleAdd = () => {
    if (!label.trim()) { setError("กรุณาระบุชื่ออาการ"); return; }
    const valid = rows.filter((r) => r.grade && r.desc.trim());
    if (valid.length === 0) { setError("กรุณาเลือกเกรดและกรอกคำอธิบายอย่างน้อย 1 รายการ"); return; }
    const options = valid
      .map((r) => ({ grade: Number(r.grade), description: r.desc.trim() }))
      .sort((a, b) => a.grade - b.grade);
    const key = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    onAdd({ key, label: label.trim(), options, isCustom: true });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(15,23,42,0.6)", backdropFilter: "blur(4px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100"
          style={{ background: "linear-gradient(135deg,#0f4c81 0%,#1a6fb5 100%)" }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">เพิ่มอาการที่กำหนดเอง</h3>
              <p className="text-xs text-blue-200 mt-0.5">กรณีไม่พบในรายการ CTCAE</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/20 hover:bg-white/30 text-white text-lg transition">×</button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          {/* ชื่ออาการ */}
          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">
              ชื่ออาการ <span className="text-red-400">*</span>
            </label>
            <input type="text" value={label}
              onChange={(e) => { setLabel(e.target.value); setError(""); }}
              placeholder="เช่น Skin hyperpigmentation, Oral dryness..."
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition" />
          </div>

          {/* Grade rows */}
          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-2">
              เกรดและคำอธิบาย <span className="text-slate-300">(อย่างน้อย 1 เกรด)</span>
            </label>
            <div className="space-y-2">
              {rows.map((row, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select
                    value={row.grade}
                    onChange={(e) => updateRow(i, "grade", e.target.value)}
                    className={`flex-shrink-0 w-32 px-3 py-2 border rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer transition
                      ${row.grade ? GRADE_COLORS[row.grade] : "border-slate-200 bg-white text-slate-500"}`}>
                    <option value="">เลือกเกรด</option>
                    {availableGrades(row.grade).map((g) => (
                      <option key={g} value={g}>Grade {g} — {GRADE_LABEL[g]}</option>
                    ))}
                  </select>
                  <input type="text" value={row.desc}
                    onChange={(e) => updateRow(i, "desc", e.target.value)}
                    placeholder="คำอธิบายอาการ..."
                    className="flex-1 min-w-0 px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition" />
                  {rows.length > 1 && (
                    <button onClick={() => removeRow(i)}
                      className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-red-50 hover:text-red-500 text-slate-400 transition text-sm font-bold">
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-500 font-semibold bg-red-50 border border-red-200 rounded-xl px-4 py-2">⚠️ {error}</p>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
          <button onClick={onClose} className="px-5 py-2.5 border border-slate-300 hover:border-slate-400 rounded-xl text-sm font-semibold text-slate-600 transition">ยกเลิก</button>
          <button onClick={handleAdd}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white hover:opacity-90 active:scale-95 transition-all"
            style={{ background: "linear-gradient(135deg,#0f4c81,#1a6fb5)" }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            เพิ่มอาการนี้
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Preview / Confirm Modal ─── */
function PreviewModal({ patient, assessmentData, symptoms, note, onConfirm, onClose, saving, saved, saveError }) {
  const regimen = [...(assessmentData?.drugs || [])].sort().join(" + ");
  const symptomEntries = Object.entries(symptoms || {});

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(15,23,42,0.6)", backdropFilter: "blur(4px)" }}
      onClick={(e) => e.target === e.currentTarget && !saving && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-7 py-5 border-b border-slate-100"
          style={{ background: "linear-gradient(135deg,#0f4c81 0%,#1a6fb5 100%)" }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-bold text-white">สรุปการประเมิน</h3>
              <p className="text-xs text-blue-200 mt-0.5">ตรวจสอบข้อมูลก่อนบันทึก</p>
            </div>
          </div>
          <button onClick={onClose} disabled={saving}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/20 hover:bg-white/30 text-white text-lg transition disabled:opacity-40">×</button>
        </div>

        <div className="overflow-y-auto flex-1 px-7 py-5 space-y-5">
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
            <p className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-3">ข้อมูลผู้ป่วย</p>
            <div className="grid grid-cols-2 gap-y-2 gap-x-6 text-sm">
              <div><span className="text-slate-400">ชื่อ-สกุล</span><p className="font-bold text-slate-800 mt-0.5">{patient?.patient_name}</p></div>
              <div><span className="text-slate-400">HN</span><p className="font-bold text-slate-800 mt-0.5">{patient?.hn}</p></div>
              <div><span className="text-slate-400">Diagnosis</span><p className="font-semibold text-red-700 mt-0.5">{patient?.diagnosis}</p></div>
              <div><span className="text-slate-400">Regimen</span><p className="font-bold text-slate-800 mt-0.5">{regimen || "-"}</p></div>
              <div><span className="text-slate-400">Cycle</span><p className="font-bold text-slate-800 mt-0.5">{assessmentData?.cycle || "-"}</p></div>
              <div><span className="text-slate-400">วันที่</span><p className="font-bold text-slate-800 mt-0.5">{assessmentData?.date || "-"}</p></div>
              <div><span className="text-slate-400">น้ำหนัก / BSA</span><p className="font-bold text-slate-800 mt-0.5">{assessmentData?.weight ? `${assessmentData.weight} kg` : "-"} {assessmentData?.bsa ? `/ ${assessmentData.bsa} m²` : ""}</p></div>
            </div>
          </div>

          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">อาการไม่พึงประสงค์ (CTCAE)</p>
            {symptomEntries.length === 0 ? (
              <p className="text-sm text-slate-400 italic">ไม่มีอาการที่บันทึก</p>
            ) : (
              <div className="space-y-2">
                {symptomEntries.map(([key, val]) => (
                  <div key={key} className={`rounded-xl border overflow-hidden ${GRADE_COLORS[val.grade]}`}>
                    <div className="flex items-center justify-between px-4 py-3">
                      <div className="flex-1 min-w-0 pr-3">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold">{val.label}</p>
                          {val.isCustom && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-white/40 border border-current opacity-70">Custom</span>
                          )}
                        </div>
                        <p className="text-xs mt-0.5 opacity-75 line-clamp-2">{val.description}</p>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${GRADE_COLORS[val.grade]}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${GRADE_DOT[val.grade]}`} />
                          G{val.grade} · {GRADE_LABEL[val.grade]}
                        </span>
                      </div>
                    </div>
                    {val.additionalDetail && (
                      <div className="px-4 py-2.5 border-t border-current/10 bg-black/5">
                        <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-1 flex items-center gap-1">
                          <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                          </svg>
                          รายละเอียดเพิ่มเติม
                        </p>
                        <p className="text-xs opacity-80 leading-relaxed whitespace-pre-line">{val.additionalDetail}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {note && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">หมายเหตุ</p>
              <p className="text-sm text-slate-700 leading-relaxed">{note}</p>
            </div>
          )}

          {/* ── API error banner ── */}
          {saveError && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 font-semibold">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              {saveError}
            </div>
          )}
        </div>

        <div className="px-7 py-5 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
          <button onClick={onClose} disabled={saving}
            className="px-5 py-2.5 border border-slate-300 hover:border-slate-400 rounded-xl text-sm font-semibold text-slate-600 transition disabled:opacity-50">
            แก้ไข
          </button>
          <button onClick={onConfirm} disabled={saving || saved}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${saved ? "bg-emerald-500 text-white" : "text-white hover:opacity-90 active:scale-95"}`}
            style={!saved ? { background: "linear-gradient(135deg,#0f4c81,#1a6fb5)" } : {}}>
            {saved ? (
              <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>บันทึกแล้ว</>
            ) : saving ? (
              <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>กำลังบันทึก...</>
            ) : (
              <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" /></svg>ยืนยันบันทึก</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Step2 ─── */
function Step2({
  prev, patient, assessmentData, onNavigate, onSaveSuccess,
  /* lifted state from App */
  selectedSymptoms, setSelectedSymptoms,
  symptoms, setSymptoms,
  note, setNote,
}) {
  const [search, setSearch]               = useState("");
  const [previewOpen, setPreviewOpen]     = useState(false);
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const [saving, setSaving]               = useState(false);
  const [saved, setSaved]                 = useState(false);
  const [saveError, setSaveError]         = useState("");

  const CTCAE_TERMS = useMemo(() => ctcae.flatMap((c) => c.terms || []), []);

  const filteredSymptoms = useMemo(() => {
    const matched = CTCAE_TERMS.filter((s) => s.label?.toLowerCase().includes(search.toLowerCase()));
    return search.trim() ? matched.slice(0, 20) : matched.slice(0, 5);
  }, [search, CTCAE_TERMS]);

  const addSymptom = (symptom) => {
    if (selectedSymptoms.find((s) => s.key === symptom.key)) return;
    setSelectedSymptoms((p) => [...p, symptom]);
  };

  const addCustomSymptom = (symptom) => {
    setSelectedSymptoms((p) => [...p, symptom]);
    if (symptom.options?.length > 0) {
      const firstOption = symptom.options[0];
      setSymptoms((p) => ({
        ...p,
        [symptom.key]: {
          label: symptom.label,
          description: firstOption.description,
          grade: firstOption.grade,
          isCustom: true,
          additionalDetail: "",
        },
      }));
    }
  };

  const removeSymptom = (key) => {
    setSelectedSymptoms((p) => p.filter((s) => s.key !== key));
    setSymptoms((p) => { const u = { ...p }; delete u[key]; return u; });
  };

  const handleSelect = (key, option, label, isCustom = false) => {
    setSymptoms((p) => ({
      ...p,
      [key]: {
        label,
        description: option.description,
        grade: option.grade,
        isCustom,
        additionalDetail: p[key]?.additionalDetail || "",
      },
    }));
  };

  const handleAdditionalDetail = (key, text) => {
    setSymptoms((p) => ({
      ...p,
      [key]: { ...p[key], additionalDetail: text },
    }));
  };

  // ── บันทึกผ่าน API แทน localStorage ──
  const confirmSave = async () => {
    setSaving(true);
    setSaveError("");
    try {
      const payload = buildRecordPayload({
        patient,
        encounter: assessmentData?.encounter,
        vital: {
          date:     assessmentData?.date,
          cycle:    assessmentData?.cycle,
          dose:     assessmentData?.dose,
          doseUnit: assessmentData?.doseUnit,
          drugs:    assessmentData?.drugs || [],
          weight:   patient?.weight || assessmentData?.weight || "",
          height:   patient?.height || assessmentData?.height || "",
          bsa:      assessmentData?.bsa || (() => {
            const w = parseFloat(patient?.weight || assessmentData?.weight);
            const h = parseFloat(patient?.height || assessmentData?.height);
            return w && h ? Math.sqrt((w * h) / 3600).toFixed(2) : "";
          })(),
        },
        symptoms,
        note,
        recommendation: "",
        followUpDate: "",
      });

      await recordApi.create(payload);

      setSaved(true);
      setTimeout(() => {
        setPreviewOpen(false);
        setSaved(false);
        // ส่ง { resetFilter: true } ให้ parent รู้ว่าต้องล้าง filter + refetch
        if (onSaveSuccess) onSaveSuccess({ resetFilter: true });
      }, 1000);
    } catch (err) {
      setSaveError(err.message || "บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setSaving(false);
    }
  };

  const gradeCount = Object.values(symptoms).reduce((acc, v) => {
    if (v?.grade) acc[v.grade] = (acc[v.grade] || 0) + 1;
    return acc;
  }, {});

  return (
    <>
      {previewOpen && (
        <PreviewModal
          patient={patient}
          assessmentData={assessmentData}
          symptoms={symptoms}
          note={note}
          onConfirm={confirmSave}
          onClose={() => { setPreviewOpen(false); setSaveError(""); }}
          saving={saving}
          saved={saved}
          saveError={saveError}
        />
      )}

      {customModalOpen && (
        <CustomSymptomModal
          onAdd={addCustomSymptom}
          onClose={() => setCustomModalOpen(false)}
        />
      )}

      {/* ── Patient Header Card ── */}
      <div className="rounded-2xl overflow-hidden shadow-sm mb-5 border border-slate-200">
        <div className="px-6 py-3 flex items-center justify-between" style={{ background: "linear-gradient(135deg,#0f4c81 0%,#1565c0 60%,#1a6fb5 100%)" }}>
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
            <span className="text-sm font-bold text-white tracking-wide">ข้อมูลผู้ป่วย</span>
          </div>
          <div className="flex items-center gap-2 text-blue-200 text-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
            <span className="font-semibold">Assessment Step 2</span>
          </div>
        </div>

        <div className="bg-white">
          <div className="flex items-start justify-between px-6 pt-4 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-xl font-black text-slate-800 tracking-tight">{patient?.patient_name}</h2>
              <p className="text-xs text-red-600 font-semibold mt-1 bg-red-50 border border-red-100 px-2 py-0.5 rounded-md inline-block">{patient?.diagnosis}</p>
            </div>
            <div className="text-center flex-shrink-0">
              <div className="w-16 h-16 rounded-2xl flex flex-col items-center justify-center border-2 border-blue-200 bg-blue-50 shadow-sm">
                <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest leading-none mb-0.5">Cycle</p>
                <p className="text-3xl font-black text-blue-700 leading-none">{assessmentData?.cycle || "—"}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 divide-x divide-slate-100 border-b border-slate-100">
            {[
              { label: "HN",       value: patient?.hn || "—",                                                                                     valueClass: "font-black text-blue-700 text-base" },
              { label: "VN / AN",  value: assessmentData?.encounter?.vn || assessmentData?.encounter?.an || assessmentData?.vn || assessmentData?.an || "—", valueClass: "font-bold text-slate-700" },
              { label: "น้ำหนัก", value: assessmentData?.weight ? `${assessmentData.weight} kg` : "—",                                           valueClass: "font-bold text-slate-700" },
              { label: "BSA",      value: assessmentData?.bsa ? `${assessmentData.bsa} m²` : "—",                                                 valueClass: "font-bold text-slate-700" },
              { label: "Dose",     value: assessmentData?.dose ? `${assessmentData.dose}${assessmentData?.doseUnit ? " " + assessmentData.doseUnit : ""}` : "—", valueClass: "font-bold text-slate-700" },
            ].map(({ label, value, valueClass }) => (
              <div key={label} className="px-4 py-3">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">{label}</div>
                <p className={`text-sm ${valueClass}`}>{value}</p>
              </div>
            ))}
          </div>

          <div className="px-6 py-3 flex items-center gap-3 flex-wrap">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex-shrink-0">Regimen</span>
            <div className="flex items-center gap-2 flex-wrap">
              {(assessmentData?.drugs || []).length > 0 ? (
                (assessmentData.drugs || []).map((d, i) => (
                  <span key={d} className="flex items-center gap-1">
                    <span className="px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded-lg shadow-sm">{d}</span>
                    {i < assessmentData.drugs.length - 1 && <span className="text-slate-300 text-xs font-bold">+</span>}
                  </span>
                ))
              ) : <span className="text-sm text-slate-400">—</span>}
            </div>
            <div className="ml-auto flex items-center gap-1.5 text-slate-400">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
              <span className="text-xs font-semibold text-slate-500">{assessmentData?.date || "—"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── CTCAE Card ── */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm mb-5 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <h2 className="font-bold text-slate-800 text-sm">CTCAE Assessment</h2>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {Object.entries(gradeCount).map(([g, count]) => (
              <span key={g} className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${GRADE_COLORS[g]}`}>G{g}: {count}</span>
            ))}
          </div>
          <span className="ml-auto text-xs text-slate-400 font-semibold">{selectedSymptoms.length} รายการที่เลือก</span>
        </div>

        {/* Search + Add Custom */}
        <div className="px-5 pt-4 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2 mb-3">
            <div className="relative flex-1">
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input type="text" placeholder="ค้นหาอาการ เช่น Nausea, Fatigue, Neuropathy..."
                value={search} onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition" />
            </div>
            <button onClick={() => setCustomModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold border border-dashed border-blue-300 text-blue-600 hover:bg-blue-50 hover:border-blue-400 transition flex-shrink-0">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              เพิ่มอาการเอง
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto pb-1">
            {filteredSymptoms.map((symptom) => {
              const isSelected = !!selectedSymptoms.find((s) => s.key === symptom.key);
              return (
                <button key={symptom.key} onClick={() => addSymptom(symptom)} disabled={isSelected}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition
                    ${isSelected
                      ? "bg-blue-50 border-blue-300 text-blue-600 cursor-default"
                      : "border-slate-200 text-slate-600 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700"}`}>
                  {isSelected ? "✓" : "+"} {symptom.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 2-column body */}
        <div className="grid grid-cols-[1fr_300px] divide-x divide-slate-100 min-h-[300px]">

          {/* LEFT — Symptom List */}
          <div className="overflow-y-auto max-h-[460px]">
            {selectedSymptoms.length === 0 ? (
              <div className="py-16 text-center">
                <svg className="w-12 h-12 text-slate-200 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                <p className="text-sm text-slate-400 font-medium">ยังไม่ได้เลือกอาการ</p>
                <p className="text-xs text-slate-300 mt-1">ค้นหาและเลือกอาการจากด้านบน หรือเพิ่มอาการเอง</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {selectedSymptoms.map((symptom, idx) => (
                  <div key={symptom.key}
                    className={`px-5 py-4 transition-colors ${symptoms[symptom.key] ? "bg-slate-50/80" : "bg-white"}`}>
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-md bg-slate-100 text-slate-500 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{idx + 1}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <h3 className="font-bold text-sm text-slate-800">{symptom.label}</h3>
                          {symptom.isCustom && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-600 border border-purple-200">Custom</span>
                          )}
                          {symptoms[symptom.key] && (
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${GRADE_COLORS[symptoms[symptom.key].grade]}`}>
                              Grade {symptoms[symptom.key].grade} · {GRADE_LABEL[symptoms[symptom.key].grade]}
                            </span>
                          )}
                        </div>
                        {symptoms[symptom.key] && (
                          <p className="text-xs text-slate-500 leading-relaxed mb-2">{symptoms[symptom.key].description}</p>
                        )}
                        <div className="flex items-center gap-2">
                          <select
                            value={symptoms[symptom.key]?.grade || ""}
                            onChange={(e) => {
                              const selected = symptom.options.find((o) => o.grade === Number(e.target.value));
                              if (selected) handleSelect(symptom.key, selected, symptom.label, symptom.isCustom);
                            }}
                            className={`flex-1 min-w-0 rounded-xl border px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer
                              ${symptoms[symptom.key] ? GRADE_COLORS[symptoms[symptom.key].grade] : "border-slate-200 bg-white text-slate-600"}`}>
                            <option value="">เลือกระดับความรุนแรง</option>
                            {symptom.options?.map((o) => (
                              <option key={o.grade} value={o.grade}>Grade {o.grade} — {o.description}</option>
                            ))}
                          </select>
                          <button onClick={() => removeSymptom(symptom.key)}
                            className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-red-50 hover:text-red-500 text-slate-400 transition text-sm font-bold"
                            title="ลบอาการนี้">×</button>
                        </div>
                        {symptoms[symptom.key] && (
                          <div className="mt-2.5">
                            <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                              <svg className="w-3 h-3 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                              </svg>
                              รายละเอียดเพิ่มเติมของอาการ
                            </label>
                            <textarea
                              rows={3}
                              value={symptoms[symptom.key]?.additionalDetail || ""}
                              onChange={(e) => handleAdditionalDetail(symptom.key, e.target.value)}
                              placeholder={`เช่น\n• คลื่นไส้หลังให้ยา 2 ชั่วโมง\n• รับประทานอาหารได้น้อยลง`}
                              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent resize-none transition leading-relaxed bg-slate-50/60"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT — Note panel */}
          <div className="flex flex-col bg-slate-50/50">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
              </svg>
              <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wide">หมายเหตุเพิ่มเติม</h3>
            </div>
            <div className="flex-1 p-4">
              <textarea rows={6} value={note} onChange={(e) => setNote(e.target.value)}
                placeholder={"บันทึกข้อมูลเพิ่มเติม\nเช่น การปรับยา, คำแนะนำผู้ป่วย, ผลข้างเคียงอื่นๆ..."}
                className="w-full h-full min-h-[200px] border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none text-slate-700 placeholder:text-slate-300 transition bg-white" />
            </div>
            <div className="px-4 pb-4 flex flex-col gap-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">เพิ่มข้อความด่วน</p>
              <div className="flex flex-wrap gap-1.5">
                {["ปรับลดขนาดยา", "Delay รักษา", "แนะนำพักผ่อน", "ส่งพบแพทย์", "ติดตามอาการ"].map((chip) => (
                  <button key={chip}
                    onClick={() => setNote((prev) => prev ? prev + "\n" + chip : chip)}
                    className="px-2 py-1 bg-white border border-slate-200 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 text-slate-500 text-[11px] font-semibold rounded-lg transition">
                    + {chip}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="flex justify-between items-center">
        <button onClick={prev}
          className="flex items-center gap-2 px-5 py-2.5 border border-slate-300 hover:border-slate-400 rounded-xl text-sm font-semibold text-slate-600 transition">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          ย้อนกลับ
        </button>

        <div className="flex items-center gap-3">
          {selectedSymptoms.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="font-semibold">{selectedSymptoms.length} อาการ</span>
              {Object.entries(gradeCount).map(([g, c]) => (
                <span key={g} className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${GRADE_DOT[g]} text-white`} title={`Grade ${g}`}>{c}</span>
              ))}
            </div>
          )}
          <button onClick={() => { setSaveError(""); setPreviewOpen(true); }}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white shadow-md hover:shadow-lg active:scale-95 transition-all"
            style={{ background: "linear-gradient(135deg,#0f4c81 0%,#1a6fb5 100%)" }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Preview & บันทึก
          </button>
        </div>
      </div>
    </>
  );
}

export default Step2;