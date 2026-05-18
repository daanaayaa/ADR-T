import { useState } from "react";

const MAIN_SYMPTOMS = [
  { key: "neuropathy", label: "Neuropathy" },
  { key: "nausea", label: "Nausea" },
  { key: "vomiting", label: "Vomiting" },
  { key: "diarrhea", label: "Diarrhea" },
];

const GRADE_COLORS = {
  1: "bg-emerald-100 text-emerald-700 border-emerald-300",
  2: "bg-yellow-100 text-yellow-700 border-yellow-300",
  3: "bg-orange-100 text-orange-700 border-orange-300",
  4: "bg-red-100 text-red-700 border-red-300",
  5: "bg-slate-700 text-white border-slate-700",
};

function GradeRadio({ name, grade, checked, onToggle }) {
  return (
    <td className="text-center px-2 py-3">
      <button
        onClick={() => onToggle(grade)}
        className={`w-7 h-7 rounded-full border-2 text-xs font-bold transition-all mx-auto flex items-center justify-center
          ${checked
            ? `${GRADE_COLORS[grade]} shadow-sm scale-110`
            : "border-slate-200 hover:border-slate-400 bg-white text-slate-300"
          }`}
      >
        {checked ? grade : ""}
      </button>
    </td>
  );
}

function Step2({ prev, patient, assessmentData, setPatientRecords }) {
  const [symptoms, setSymptoms] = useState({ neuropathy: null, nausea: null, vomiting: null, diarrhea: null });
  const [otherSymptoms, setOtherSymptoms] = useState([]);
  const [otherInput, setOtherInput] = useState("");
  const [note, setNote] = useState("");
  const [intervention, setIntervention] = useState("");
  const [interventionTo, setInterventionTo] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  // Guard: prevent double-save
  const [hasSaved, setHasSaved] = useState(false);

  const handleSymptomGrade = (key, grade) =>
    setSymptoms((prev) => ({ ...prev, [key]: prev[key] === grade ? null : grade }));

  const handleAddOther = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const val = otherInput.trim();
      if (val) {
        setOtherSymptoms((prev) => [...prev, { id: Date.now(), name: val, grade: null }]);
        setOtherInput("");
      }
    }
  };
  const removeOther = (id) => setOtherSymptoms((prev) => prev.filter((s) => s.id !== id));
  const handleGradeChange = (id, grade) =>
    setOtherSymptoms((prev) => prev.map((s) => s.id === id ? { ...s, grade: s.grade === grade ? null : grade } : s));

  const confirmSave = () => {
    // Prevent duplicate saves
    if (saving || hasSaved) return;

    setSaving(true);
    setHasSaved(true);

    const newRecord = {
      date: assessmentData?.date,
      hn: patient?.hn,
      vn: assessmentData?.encounter?.vn,
      an: assessmentData?.encounter?.an,
      patientName: patient?.name,
      drugs: assessmentData?.drugs || [],
      cycle: assessmentData?.cycle,
      symptoms,
      otherSymptoms,
      note,
      intervention,
      interventionTo,
    };

    const existing = JSON.parse(localStorage.getItem("patientRecords") || "[]");
    const updated = [...existing, newRecord];
    localStorage.setItem("patientRecords", JSON.stringify(updated));
    if (setPatientRecords) setPatientRecords(updated);

    setTimeout(() => {
      setSaving(false);
      setSaved(true);
      // Close modal after showing success, then reset entire form
      setTimeout(() => {
        setPreviewOpen(false);
        setSaved(false);
        // Reset form so the page is clean if user stays
        setSymptoms({ neuropathy: null, nausea: null, vomiting: null, diarrhea: null });
        setOtherSymptoms([]);
        setOtherInput("");
        setNote("");
        setIntervention("");
        setInterventionTo("");
        // Navigate back to step 1 if prev is provided
        if (prev) prev();
      }, 1500);
    }, 1200);
  };

  const inputCls = "w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition hover:border-slate-300";
  const labelCls = "block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5";

  return (
    <>
      {/* Patient Summary */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-5 shadow-sm">
        <div className="flex gap-8">
          <div className="flex-1">
            <h2 className="text-lg font-bold text-slate-800 mb-1">{patient?.name}</h2>
            <div className="flex flex-wrap gap-4 text-sm text-slate-600">
              <span><span className="font-semibold text-slate-700">HN:</span> {patient?.hn}</span>
              <span><span className="font-semibold text-slate-700">อายุ:</span> {patient?.age} ปี</span>
              <span><span className="font-semibold text-slate-700">Diagnosis:</span> {patient?.diagnosis}</span>
            </div>
          </div>
          <div className="text-sm text-slate-600 text-right space-y-1 shrink-0">
            <div><span className="font-semibold text-slate-700">VN/AN:</span> {assessmentData?.encounter?.vn || assessmentData?.encounter?.an || "-"}</div>
            <div><span className="font-semibold text-slate-700">Drugs:</span> {assessmentData?.drugs?.join(", ")}</div>
            <div><span className="font-semibold text-slate-700">Cycle:</span> {assessmentData?.cycle} &nbsp; <span className="font-semibold text-slate-700">Date:</span> {assessmentData?.date}</div>
            <div><span className="font-semibold text-slate-700">Weight:</span> {assessmentData?.weight} kg &nbsp; <span className="font-semibold text-slate-700">BSA:</span> {assessmentData?.bsa} m²</div>
            <span className="inline-block px-2.5 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full mt-1">Active Case</span>
          </div>
        </div>
      </div>

      {/* CTCAE Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm mb-5 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-bold text-blue-700">Symptom Assessment (CTCAE V5.0)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide w-48">Symptom</th>
                {[1, 2, 3, 4, 5].map((g) => (
                  <th key={g} className="text-center px-2 py-3 text-xs font-bold uppercase tracking-wide" style={{ color: ["#16a34a","#ca8a04","#ea580c","#dc2626","#374151"][g-1] }}>
                    Grade {g}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {MAIN_SYMPTOMS.map((s) => (
                <tr key={s.key} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-3 text-sm font-semibold text-slate-700">{s.label}</td>
                  {[1, 2, 3, 4, 5].map((g) => (
                    <GradeRadio key={g} name={s.key} grade={g}
                      checked={symptoms[s.key] === g}
                      onToggle={(grade) => handleSymptomGrade(s.key, grade)} />
                  ))}
                </tr>
              ))}

              {otherSymptoms.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-700">{item.name}</span>
                      <button onClick={() => removeOther(item.id)}
                        className="w-5 h-5 rounded-full bg-slate-200 hover:bg-red-100 hover:text-red-600 text-slate-500 text-xs font-bold flex items-center justify-center transition-colors">
                        ×
                      </button>
                    </div>
                  </td>
                  {[1, 2, 3, 4, 5].map((g) => (
                    <GradeRadio key={g} name={`other-${item.id}`} grade={g}
                      checked={item.grade === g}
                      onToggle={(grade) => handleGradeChange(item.id, grade)} />
                  ))}
                </tr>
              ))}

              <tr className="bg-slate-50">
                <td className="px-6 py-2">
                  <input type="text" placeholder="พิมพ์อาการแล้วกด Enter"
                    value={otherInput}
                    onChange={(e) => setOtherInput(e.target.value)}
                    onKeyDown={handleAddOther}
                    className="w-full px-3 py-2 border border-dashed border-slate-300 rounded-lg text-xs text-slate-600 bg-white focus:outline-none focus:border-blue-400 transition" />
                </td>
                {[1, 2, 3, 4, 5].map((g) => <td key={g} />)}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Intervention */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm mb-5 overflow-hidden">
        <div className="flex items-center gap-2 px-6 py-4 bg-amber-50 border-b border-amber-100">
          <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <span className="text-sm font-bold text-amber-800">Intervention Required</span>
        </div>
        <div className="grid grid-cols-[2fr_1fr_1fr] gap-6 p-6">
          <div>
            <label className={labelCls}>Note เพิ่มเติม</label>
            <textarea rows={5} placeholder="กรอกหมายเหตุเพิ่มเติม..."
              value={note} onChange={(e) => setNote(e.target.value)}
              className={inputCls + " resize-none"} />
          </div>
          <div>
            <label className={labelCls}>Intervention</label>
            <input type="text" placeholder="กรอกข้อมูล..."
              value={intervention} onChange={(e) => setIntervention(e.target.value)}
              className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Intervention to</label>
            <input type="text" placeholder="กรอกข้อมูล..."
              value={interventionTo} onChange={(e) => setInterventionTo(e.target.value)}
              className={inputCls} />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-between">
        <button onClick={prev}
          className="flex items-center gap-2 px-5 py-2.5 border border-slate-300 hover:border-slate-400 text-slate-700 font-semibold text-sm rounded-xl transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          ย้อนกลับ
        </button>
        <button onClick={() => { setHasSaved(false); setPreviewOpen(true); }}
          className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white font-semibold text-sm px-6 py-2.5 rounded-xl transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 3.75V16.5L12 14.25 7.5 16.5V3.75m9 0H18A2.25 2.25 0 0120.25 6v12A2.25 2.25 0 0118 20.25H6A2.25 2.25 0 013.75 18V6A2.25 2.25 0 016 3.75h1.5m9 0h-9" />
          </svg>
          บันทึกผลประเมิน
        </button>
      </div>

      {/* Preview Modal */}
      {previewOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4">
            {!saved ? (
              <>
                <div className="px-8 py-6 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                      <svg className="w-5 h-5 text-blue-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-slate-800">Assessment Summary</h2>
                      <p className="text-xs text-slate-500">ตรวจสอบข้อมูลก่อนบันทึก</p>
                    </div>
                  </div>
                </div>

                <div className="px-8 py-6 space-y-5">
                  {/* Basic info */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {[
                      ["ผู้ป่วย", patient?.name],
                      ["HN", patient?.hn],
                      ["Cycle", assessmentData?.cycle],
                      ["วันที่ประเมิน", assessmentData?.date],
                    ].map(([label, value]) => (
                      <div key={label} className="bg-slate-50 rounded-lg px-4 py-3">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">{label}</p>
                        <p className="font-semibold text-slate-800">{value || "-"}</p>
                      </div>
                    ))}
                  </div>

                  {/* Symptoms */}
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Symptoms</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(symptoms).filter(([, v]) => v).map(([key, value]) => (
                        <span key={key} className={`px-3 py-1 rounded-full text-xs font-bold border ${GRADE_COLORS[value]}`}>
                          {key} — Grade {value}
                        </span>
                      ))}
                      {otherSymptoms.filter((s) => s.grade).map((s) => (
                        <span key={s.id} className={`px-3 py-1 rounded-full text-xs font-bold border ${GRADE_COLORS[s.grade]}`}>
                          {s.name} — Grade {s.grade}
                        </span>
                      ))}
                      {!Object.values(symptoms).some(Boolean) && !otherSymptoms.some((s) => s.grade) && (
                        <span className="text-sm text-slate-400">ไม่พบ ADR</span>
                      )}
                    </div>
                  </div>

                  {/* Note */}
                  {note && (
                    <div>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Note</p>
                      <p className="text-sm text-slate-700 bg-slate-50 rounded-lg px-4 py-3">{note}</p>
                    </div>
                  )}

                  {/* Intervention — always shown so user can verify */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 rounded-lg px-4 py-3">
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Intervention</p>
                      <p className="text-sm font-semibold text-slate-800">{intervention || <span className="text-slate-400 font-normal">-</span>}</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg px-4 py-3">
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Intervention To</p>
                      <p className="text-sm font-semibold text-slate-800">{interventionTo || <span className="text-slate-400 font-normal">-</span>}</p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 px-8 py-5 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
                  <button onClick={() => setPreviewOpen(false)}
                    className="px-5 py-2.5 border border-slate-300 hover:border-slate-400 text-slate-700 font-semibold text-sm rounded-xl transition-colors">
                    แก้ไข
                  </button>
                  <button onClick={confirmSave} disabled={saving || hasSaved}
                    className="flex items-center gap-2 px-6 py-2.5 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-xl transition-colors">
                    {saving ? (
                      <>
                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        กำลังบันทึก...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                        ยืนยันบันทึก
                      </>
                    )}
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 px-8">
                <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center mb-4 shadow-lg">
                  <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-slate-800">บันทึกสำเร็จ</h2>
                <p className="text-slate-400 text-sm mt-1">ข้อมูลการประเมินถูกบันทึกเรียบร้อยแล้ว</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default Step2;