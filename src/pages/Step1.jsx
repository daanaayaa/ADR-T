import { useState } from "react";
import patients from "../data/patients";

const DRUG_OPTIONS = [
  "Paclitaxel", "Carboplatin", "Trastuzumab", "Pertuzumab",
  "Oxaliplatin", "5-FU", "Cisplatin", "Docetaxel",
];

function Step1({ next, setSelectedPatient, setAssessmentData }) {
  const [search, setSearch] = useState("");
  const [patient, setPatient] = useState(null);
  const [filteredPatients, setFilteredPatients] = useState([]);
  const [drugSearch, setDrugSearch] = useState("");
  const [filteredDrugs, setFilteredDrugs] = useState([]);
  const [vital, setVital] = useState({ weight: "", height: "", date: "", cycle: "", dose: "", drugs: [] });
  const [encounter, setEncounter] = useState(null);

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearch(val);
    if (!val.trim()) { setFilteredPatients([]); setPatient(null); return; }
    setFilteredPatients(patients.filter((p) => p.hn.includes(val) || p.name.toLowerCase().includes(val.toLowerCase())));
  };

  const handleSearch = () => {
    const found = patients.find((p) => p.hn.includes(search) || p.name.includes(search));
    if (found) selectPatient(found);
    else alert("ไม่พบข้อมูลผู้ป่วย");
  };

  const selectPatient = (p) => {
    setPatient(p); setSelectedPatient(p);
    setSearch(`${p.hn} - ${p.name}`);
    setFilteredPatients([]); setEncounter(null);
  };

  const handleVitalChange = (e) => {
    const { name, value } = e.target;
    setVital((prev) => ({ ...prev, [name]: value }));
  };

  const calculateBSA = () => {
    const w = parseFloat(vital.weight), h = parseFloat(vital.height);
    return w && h ? Math.sqrt((w * h) / 3600).toFixed(2) : "";
  };

  const handleDrugSearch = (e) => {
    const val = e.target.value;
    setDrugSearch(val);
    if (!val.trim()) { setFilteredDrugs([]); return; }
    setFilteredDrugs(DRUG_OPTIONS.filter((d) => d.toLowerCase().includes(val.toLowerCase()) && !vital.drugs.includes(d)));
  };

  const selectDrug = (drug) => {
    setVital((prev) => ({ ...prev, drugs: [...prev.drugs, drug] }));
    setDrugSearch(""); setFilteredDrugs([]);
  };

  const removeDrug = (drug) => setVital((prev) => ({ ...prev, drugs: prev.drugs.filter((d) => d !== drug) }));

  const handleNext = () => {
    if (!patient) { alert("กรุณาเลือกผู้ป่วย"); return; }
    if (!vital.drugs.length) { alert("กรุณาเลือกยา"); return; }
    setSelectedPatient(patient);
    setAssessmentData({ ...vital, bsa: calculateBSA(), encounter });
    next();
  };

  const validations = [
    { ok: !!patient, label: "เลือกผู้ป่วย" },
    { ok: !!encounter, label: "เลือกประเภท OPD/IPD" },
    { ok: !!vital.date, label: "วันที่ประเมิน" },
    { ok: vital.drugs.length > 0, label: "ยาที่ได้รับ" },
    { ok: !!vital.weight && !!vital.height, label: "Vital Signs" },
  ];

  const inputCls = "w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition hover:border-slate-300";
  const labelCls = "block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5";

  return (
    <section>
      <div className="grid grid-cols-[2fr_1fr] gap-5 mb-5">
        {/* LEFT — Patient */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h2 className="text-base font-bold text-blue-700 mb-5 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
            ข้อมูลผู้ป่วย
          </h2>

          {/* Search */}
          <div className="relative mb-5">
            <div className="flex gap-2">
              <input type="text" placeholder="ค้นหา HN หรือชื่อผู้ป่วย"
                value={search} onChange={handleSearchChange}
                className={inputCls} />
              <button onClick={handleSearch}
                className="px-4 py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg whitespace-nowrap transition-colors">
                ค้นหา
              </button>
            </div>
            {filteredPatients.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-50 max-h-52 overflow-y-auto">
                {filteredPatients.map((p) => (
                  <div key={p.hn} onClick={() => selectPatient(p)}
                    className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-blue-50 border-b border-slate-100 last:border-0 transition-colors">
                    <span className="text-xs font-bold text-blue-700">{p.hn}</span>
                    <span className="text-sm text-slate-700">{p.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {patient ? (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <div className="grid grid-cols-2 gap-4 mb-4">
                {[
                  { label: "ชื่อ-นามสกุล", value: patient.name },
                  { label: "อายุ", value: `${patient.age} ปี` },
                  { label: "เพศ", value: patient.gender },
                  { label: "VN / AN", value: encounter?.vn || encounter?.an || "-" },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">{label}</p>
                    <p className="text-sm font-bold text-slate-800">{value}</p>
                  </div>
                ))}
              </div>
              <div className="border-t border-blue-200 pt-4 mb-4">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Diagnosis</p>
                <p className="text-sm font-bold text-red-700 bg-red-50 border-l-4 border-red-500 px-3 py-2 rounded-r-lg">{patient.diagnosis}</p>
              </div>

              {!encounter ? (
                <div className="bg-white border border-blue-200 rounded-xl p-4">
                  <p className="text-xs font-bold text-blue-800 uppercase tracking-wide mb-3">เลือกประเภทการรักษา</p>
                  <div className="flex gap-3">
                    {["OPD", "IPD"].map((type) => (
                      <button key={type} onClick={() => setEncounter({
                        type, ...(type === "OPD" ? { vn: `VN-${Date.now()}` } : { an: `AN-${Date.now()}` }),
                        hn: patient.hn, date: new Date().toISOString().slice(0, 10),
                      })}
                        className="flex-1 py-2 border-2 border-blue-300 hover:border-blue-600 hover:bg-blue-700 hover:text-white text-blue-700 font-bold text-sm rounded-lg transition-all">
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-sm font-semibold">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  {encounter.type}: {encounter.vn || encounter.an}
                </div>
              )}
            </div>
          ) : (
            <div className="min-h-44 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center gap-2 bg-slate-50">
              <svg className="w-10 h-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
              <p className="text-sm font-semibold text-slate-400">ยังไม่ได้เลือกผู้ป่วย</p>
              <p className="text-xs text-slate-400">ค้นหา HN หรือชื่อผู้ป่วยเพื่อแสดงข้อมูล</p>
            </div>
          )}
        </div>

        {/* RIGHT — Vital Signs */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h2 className="text-base font-bold text-blue-700 mb-5 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
            </svg>
            Vital Signs
          </h2>
          {[
            { label: "น้ำหนัก (kg)", name: "weight", placeholder: "กรอกน้ำหนัก" },
            { label: "ส่วนสูง (cm)", name: "height", placeholder: "กรอกส่วนสูง" },
          ].map(({ label, name, placeholder }) => (
            <div key={name} className="mb-4">
              <label className={labelCls}>{label}</label>
              <input type="number" name={name} placeholder={placeholder}
                value={vital[name]} onChange={handleVitalChange} className={inputCls} />
            </div>
          ))}
          <div className="mb-4">
            <label className={labelCls}>BSA (m²)</label>
            <input type="text" value={calculateBSA()} readOnly
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-500 bg-slate-50 cursor-not-allowed" />
          </div>
        </div>
      </div>

      {/* Treatment Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-5 shadow-sm">
        <h2 className="text-base font-bold text-blue-700 mb-5 flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1 1 .03 2.798-1.352 2.798H4.15c-1.38 0-2.352-1.799-1.351-2.798L4 15.298M5 14.5v.301" />
          </svg>
          ข้อมูลการรักษา
        </h2>
        <div className="grid grid-cols-4 gap-4">
          <div>
            <label className={labelCls}>วันที่ประเมิน</label>
            <input type="date" name="date" value={vital.date} onChange={handleVitalChange} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Cycle</label>
            <input type="number" name="cycle" placeholder="กรอก Cycle" value={vital.cycle} onChange={handleVitalChange} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Dose (mg/m²)</label>
            <div className="relative">
              <input type="number" name="dose" placeholder="0.0" value={vital.dose} onChange={handleVitalChange}
                className={`${inputCls} pr-16`} />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-semibold">mg/m²</span>
            </div>
          </div>
          <div className="relative">
            <label className={labelCls}>ยาที่ได้รับ</label>
            <input type="text" placeholder="ค้นหายา..." value={drugSearch} onChange={handleDrugSearch} className={inputCls} />
            {filteredDrugs.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-50">
                {filteredDrugs.map((drug) => (
                  <div key={drug} onClick={() => selectDrug(drug)}
                    className="px-4 py-2.5 cursor-pointer hover:bg-blue-50 text-sm text-slate-700 border-b border-slate-100 last:border-0 transition-colors">
                    {drug}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {vital.drugs.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">ยาที่เลือก</p>
            <div className="flex flex-wrap gap-2">
              {vital.drugs.map((drug) => (
                <span key={drug} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-800 text-xs font-semibold rounded-lg">
                  {drug}
                  <button onClick={() => removeDrug(drug)} className="text-blue-400 hover:text-blue-700 transition-colors font-bold">×</button>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Validation */}
      <div className="flex flex-wrap gap-2 mb-5">
        {validations.map((item) => (
          <div key={item.label} className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold border transition-all ${item.ok ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-500 border-slate-200"}`}>
            <span className={`w-4 h-4 rounded-full flex items-center justify-center text-white text-xs font-bold ${item.ok ? "bg-emerald-500" : "bg-slate-300"}`}>
              {item.ok ? "✓" : "○"}
            </span>
            {item.label}
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <button onClick={handleNext}
          className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white font-semibold px-6 py-3 rounded-xl transition-colors">
          ถัดไป
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </button>
      </div>
    </section>
  );
}

export default Step1;
