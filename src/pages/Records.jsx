import { useEffect, useState } from "react";

const MAIN_SYMPTOMS = ["neuropathy", "nausea", "vomiting", "diarrhea"];
const DRUG_OPTIONS = [
  "Paclitaxel","Carboplatin","Trastuzumab","Pertuzumab",
  "Oxaliplatin","5-FU","Cisplatin","Docetaxel",
];

const GRADE_CLS = {
  1: "bg-emerald-100 text-emerald-700",
  2: "bg-yellow-100 text-yellow-700",
  3: "bg-orange-100 text-orange-700",
  4: "bg-red-100 text-red-700",
  5: "bg-slate-700 text-white",
};

/* ── Edit Modal ── */
function EditModal({ record, onSave, onClose }) {
  const [form, setForm] = useState({
    date: record.date || "", cycle: record.cycle || "",
    weight: record.weight || "", height: record.height || "",
    drugs: record.drugs || [],
    symptoms: { neuropathy: null, nausea: null, vomiting: null, diarrhea: null, ...record.symptoms },
    otherSymptoms: (record.otherSymptoms || []).map((s) => ({ ...s })),
    note: record.note || "",
  });
  const [drugSearch, setDrugSearch] = useState("");
  const [drugFiltered, setDrugFiltered] = useState([]);
  const [otherInput, setOtherInput] = useState("");

  const handleDrugSearch = (val) => {
    setDrugSearch(val);
    setDrugFiltered(!val.trim() ? [] : DRUG_OPTIONS.filter((d) => d.toLowerCase().includes(val.toLowerCase()) && !form.drugs.includes(d)));
  };
  const addDrug = (d) => { setForm((f) => ({ ...f, drugs: [...f.drugs, d] })); setDrugSearch(""); setDrugFiltered([]); };
  const removeDrug = (d) => setForm((f) => ({ ...f, drugs: f.drugs.filter((x) => x !== d) }));
  const toggleGrade = (key, g) => setForm((f) => ({ ...f, symptoms: { ...f.symptoms, [key]: f.symptoms[key] === g ? null : g } }));
  const toggleOtherGrade = (id, g) => setForm((f) => ({ ...f, otherSymptoms: f.otherSymptoms.map((s) => s.id === id ? { ...s, grade: s.grade === g ? null : g } : s) }));
  const addOther = (e) => {
    if (e.key === "Enter" && otherInput.trim()) {
      setForm((f) => ({ ...f, otherSymptoms: [...f.otherSymptoms, { id: Date.now(), name: otherInput.trim(), grade: null }] }));
      setOtherInput("");
    }
  };
  const removeOther = (id) => setForm((f) => ({ ...f, otherSymptoms: f.otherSymptoms.filter((s) => s.id !== id) }));
  const calcBSA = () => { const w = parseFloat(form.weight), h = parseFloat(form.height); return w && h ? Math.sqrt((w * h) / 3600).toFixed(2) : ""; };

  const inputCls = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition";
  const labelCls = "block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5";
  const GCOL = { 1: "#16a34a", 2: "#ca8a04", 3: "#ea580c", 4: "#dc2626", 5: "#374151" };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col mx-4">

        {/* Header */}
        <div className="flex items-center justify-between px-7 py-5 border-b border-slate-100 flex-shrink-0">
          <div>
            <h3 className="text-base font-bold text-slate-800">แก้ไขข้อมูลการประเมิน</h3>
            <p className="text-xs text-slate-500 mt-0.5">{record.patientName} · HN {record.hn}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 text-lg transition-colors">×</button>
        </div>

        {/* Body */}
        <div className="px-7 py-5 overflow-y-auto flex-1">
          <div className="grid grid-cols-4 gap-3 mb-4">
            {[
              { label: "วันที่ประเมิน", key: "date", type: "date" },
              { label: "Cycle", key: "cycle", type: "number" },
              { label: "น้ำหนัก (kg)", key: "weight", type: "number" },
              { label: "ส่วนสูง (cm)", key: "height", type: "number" },
            ].map(({ label, key, type }) => (
              <div key={key}>
                <label className={labelCls}>{label}</label>
                <input type={type} value={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} className={inputCls} />
              </div>
            ))}
          </div>
          <div className="mb-4 w-44">
            <label className={labelCls}>BSA (m²)</label>
            <input type="text" value={calcBSA()} readOnly className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-400 bg-slate-50 cursor-not-allowed" />
          </div>

          {/* Drug */}
          <div className="mb-4 relative">
            <label className={labelCls}>ยาที่ได้รับ</label>
            <input type="text" placeholder="ค้นหายา..." value={drugSearch} onChange={(e) => handleDrugSearch(e.target.value)} className={inputCls} />
            {drugFiltered.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-50">
                {drugFiltered.map((d) => <div key={d} onClick={() => addDrug(d)} className="px-4 py-2.5 cursor-pointer hover:bg-blue-50 text-sm text-slate-700 border-b border-slate-100 last:border-0 transition-colors">{d}</div>)}
              </div>
            )}
            {form.drugs.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {form.drugs.map((d) => (
                  <span key={d} className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 border border-blue-200 text-blue-800 text-xs font-semibold rounded-lg">
                    {d}<button onClick={() => removeDrug(d)} className="text-blue-400 hover:text-blue-700 font-bold">×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* CTCAE Table */}
          <div className="mb-4">
            <label className={labelCls}>Symptom Assessment (CTCAE V5.0)</label>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[500px]">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-xs font-bold text-slate-500 uppercase tracking-wide">Symptom</th>
                    {[1,2,3,4,5].map((g) => <th key={g} className="text-center px-2 py-2.5 text-xs font-bold uppercase tracking-wide" style={{ color: GCOL[g] }}>G{g}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {MAIN_SYMPTOMS.map((key) => (
                    <tr key={key} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 text-sm font-medium text-slate-700 capitalize">{key}</td>
                      {[1,2,3,4,5].map((g) => (
                        <td key={g} className="text-center px-2 py-2.5">
                          <button onClick={() => toggleGrade(key, g)}
                            className={`w-7 h-7 rounded-full border-2 text-xs font-bold mx-auto flex items-center justify-center transition-all
                              ${form.symptoms[key] === g ? `border-transparent text-white` : "border-slate-200 bg-white text-slate-300 hover:border-slate-300"}`}
                            style={form.symptoms[key] === g ? { background: GCOL[g] } : {}}>
                            {form.symptoms[key] === g ? g : ""}
                          </button>
                        </td>
                      ))}
                    </tr>
                  ))}
                  {form.otherSymptoms.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-slate-700">{item.name}</span>
                          <button onClick={() => removeOther(item.id)} className="w-4 h-4 rounded-full bg-slate-200 hover:bg-red-100 hover:text-red-600 text-slate-400 text-xs flex items-center justify-center transition-colors">×</button>
                        </div>
                      </td>
                      {[1,2,3,4,5].map((g) => (
                        <td key={g} className="text-center px-2 py-2.5">
                          <button onClick={() => toggleOtherGrade(item.id, g)}
                            className={`w-7 h-7 rounded-full border-2 text-xs font-bold mx-auto flex items-center justify-center transition-all
                              ${item.grade === g ? "border-transparent text-white" : "border-slate-200 bg-white text-slate-300 hover:border-slate-300"}`}
                            style={item.grade === g ? { background: GCOL[g] } : {}}>
                            {item.grade === g ? g : ""}
                          </button>
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr className="bg-slate-50">
                    <td className="px-4 py-2">
                      <input type="text" placeholder="พิมพ์อาการแล้วกด Enter" value={otherInput}
                        onChange={(e) => setOtherInput(e.target.value)} onKeyDown={addOther}
                        className="w-full px-3 py-1.5 border border-dashed border-slate-300 rounded-lg text-xs text-slate-600 bg-white focus:outline-none focus:border-blue-400 transition" />
                    </td>
                    {[1,2,3,4,5].map((g) => <td key={g} />)}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Note */}
          <div>
            <label className={labelCls}>Note / Intervention</label>
            <textarea rows={4} placeholder="กรอกหมายเหตุ..." value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              className={inputCls + " resize-none"} />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-7 py-4 border-t border-slate-100 bg-slate-50 flex-shrink-0 rounded-b-2xl">
          <button onClick={onClose} className="px-5 py-2 border border-slate-300 hover:border-slate-400 text-slate-700 font-semibold text-sm rounded-xl transition-colors">ยกเลิก</button>
          <button onClick={() => onSave({ ...form, bsa: calcBSA() })}
            className="flex items-center gap-2 px-5 py-2 bg-blue-700 hover:bg-blue-800 text-white font-semibold text-sm rounded-xl transition-colors">
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
function Records() {
  const [patientRecords, setPatientRecords] = useState([]);
  const [search, setSearch] = useState("");
  const [confirmIndex, setConfirmIndex] = useState(null);
  const [editIndex, setEditIndex] = useState(null);

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem("patientRecords") || "[]");
    setPatientRecords(saved);
  }, []);

  const handleDelete = (realIndex) => {
    const updated = patientRecords.filter((_, i) => i !== realIndex);
    setPatientRecords(updated);
    localStorage.setItem("patientRecords", JSON.stringify(updated));
    setConfirmIndex(null);
  };

  const handleSaveEdit = (updatedFields) => {
    const updated = patientRecords.map((r, i) => i === editIndex ? { ...r, ...updatedFields } : r);
    setPatientRecords(updated);
    localStorage.setItem("patientRecords", JSON.stringify(updated));
    setEditIndex(null);
  };

  const filtered = patientRecords
    .map((r, i) => ({ ...r, _realIndex: i }))
    .filter((r) => {
      const q = search.toLowerCase();
      return !q || (r.hn || "").includes(q) || (r.patientName || "").toLowerCase().includes(q) || (r.date || "").includes(q);
    }).reverse();

  const confirmRecord = confirmIndex !== null ? patientRecords[confirmIndex] : null;
  const editRecord = editIndex !== null ? patientRecords[editIndex] : null;

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
                className="flex-1 px-4 py-2.5 border border-slate-300 hover:border-slate-400 text-slate-700 font-semibold text-sm rounded-xl transition-colors">
                ยกเลิก
              </button>
              <button onClick={() => handleDelete(confirmIndex)}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold text-sm rounded-xl transition-colors">
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
          <input type="text" placeholder="ค้นหา HN / ชื่อ / วันที่..."
            className="pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition w-64 hover:border-slate-300"
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {["Date","HN","VN/AN","Patient Name","Drug(s)","Cycle","Symptoms","Note","Intervention","Intervention To","จัดการ"].map((h) => (
                  <th key={h} className={`px-4 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap ${h === "จัดการ" ? "text-center" : "text-left"}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length > 0 ? (
                filtered.map((item) => {
                  const mainSym = Object.entries(item.symptoms || {}).filter(([, v]) => v !== null).map(([key, value]) => ({ name: key, grade: value }));
                  const other = (item.otherSymptoms || []).filter((s) => s.grade).map((s) => ({ name: s.name, grade: s.grade }));
                  const allSymptoms = [...mainSym, ...other];
                  return (
                    <tr key={item._realIndex} className="hover:bg-slate-50 transition-colors align-top">
                      {/* Date */}
                      <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">{item.date || "-"}</td>
                      {/* HN */}
                      <td className="px-4 py-3 text-sm font-semibold text-blue-700 whitespace-nowrap">{item.hn || "-"}</td>
                      {/* VN/AN */}
                      <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{item.vn || item.an || "-"}</td>
                      {/* Patient Name */}
                      <td className="px-4 py-3 text-sm font-semibold text-slate-800 whitespace-nowrap">{item.patientName || "-"}</td>

                      {/* Drugs — wrap into pills, max-width so they stack */}
                      <td className="px-4 py-3 max-w-[180px]">
                        {(item.drugs || []).length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {(item.drugs || []).map((d) => (
                              <span key={d} className="px-2 py-0.5 bg-blue-50 border border-blue-100 text-blue-700 text-xs font-medium rounded-md whitespace-nowrap">
                                {d}
                              </span>
                            ))}
                          </div>
                        ) : <span className="text-slate-400 text-sm">-</span>}
                      </td>

                      {/* Cycle */}
                      <td className="px-4 py-3 text-sm text-center text-slate-600 whitespace-nowrap">{item.cycle || "-"}</td>

                      {/* Symptoms — wrap into pills */}
                      <td className="px-4 py-3 max-w-[220px]">
                        {allSymptoms.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {allSymptoms.map((s, i) => (
                              <span key={i} className={`px-2 py-0.5 rounded-full text-xs font-bold whitespace-nowrap ${GRADE_CLS[s.grade] || ""}`}>
                                {s.name} G{s.grade}
                              </span>
                            ))}
                          </div>
                        ) : <span className="text-slate-400 text-sm">-</span>}
                      </td>

                      {/* Note */}
                      <td className="px-4 py-3 text-xs text-slate-600 max-w-[160px] break-words">{item.note || "-"}</td>

                      {/* Intervention */}
                      <td className="px-4 py-3 text-xs text-slate-600 max-w-[140px] break-words">{item.intervention || "-"}</td>

                      {/* Intervention To */}
                      <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{item.interventionTo || "-"}</td>

                      {/* Actions — top-aligned, centred */}
                      <td className="px-4 py-3">
                        <div className="flex gap-2 justify-center pt-0.5">
                          <button onClick={() => setEditIndex(item._realIndex)} title="แก้ไข"
                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-600 transition-all hover:scale-105 flex-shrink-0">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                            </svg>
                          </button>
                          <button onClick={() => setConfirmIndex(item._realIndex)} title="ลบ"
                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-50 hover:bg-red-100 border border-red-200 text-red-500 transition-all hover:scale-105 flex-shrink-0">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="11" className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <svg className="w-10 h-10 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                      </svg>
                      <p className="text-slate-400 text-sm">{search ? "ไม่พบข้อมูลที่ค้นหา" : "ยังไม่มีข้อมูลการประเมิน"}</p>
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