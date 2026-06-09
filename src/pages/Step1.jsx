import { useEffect, useState } from "react";
import { patientApi, encounterApi, drugsApi } from "../services/api";

function Step1({ next, patient, setPatient, vital, setVital, encounter, setEncounter }) {
  const [search, setSearch]                 = useState(patient ? `${patient.hn} - ${patient.patient_name}` : "");
  const [filteredPatients, setFilteredPatients] = useState([]);
  const [searchLoading, setSearchLoading]   = useState(false);
  const [drugSearch, setDrugSearch]         = useState("");
  const [filteredDrugs, setFilteredDrugs]   = useState([]);
  const [encounterLoading, setEncounterLoading] = useState(false);

  // ── Drug list จาก API ──
  const [allDrugs, setAllDrugs]             = useState([]);
  const [drugsLoading, setDrugsLoading]     = useState(false);

  // ── ยานอกบัญชี ──
  const [customDrugInput, setCustomDrugInput] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);

  // โหลดรายการยาจาก API เมื่อ mount
  useEffect(() => {
    const loadDrugs = async () => {
      setDrugsLoading(true);
      try {
        const data = await drugsApi.getAll();
        setAllDrugs(data || []);
      } catch {
        setAllDrugs([]);
      } finally {
        setDrugsLoading(false);
      }
    };
    loadDrugs();
  }, []);

  // ── ค้นหาผู้ป่วยจาก API แบบ debounce ──
  useEffect(() => {
    const val = search.trim();
    // ถ้ากำลัง display ผู้ป่วยที่เลือกแล้ว ไม่ต้อง search ซ้ำ
    if (patient && search === `${patient.hn} - ${patient.patient_name}`) return;
    if (!val) { setFilteredPatients([]); return; }

    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const results = await patientApi.getAll({ q: val });
        setFilteredPatients(results || []);
      } catch {
        setFilteredPatients([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  const calculateBSA = (w, h) => {
    const weight = parseFloat(w);
    const height = parseFloat(h);
    return weight && height ? Math.sqrt((weight * height) / 3600).toFixed(2) : "";
  };

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearch(val);
    if (!val.trim()) { setFilteredPatients([]); setPatient(null); }
  };

  // ค้นหาแบบ manual (กด button)
  const handleSearch = async () => {
    if (!search.trim()) return;
    setSearchLoading(true);
    try {
      const results = await patientApi.getAll({ q: search.trim() });
      if (results?.length === 1) {
        selectPatient(results[0]);
      } else if (results?.length > 1) {
        setFilteredPatients(results);
      } else {
        alert("ไม่พบข้อมูลผู้ป่วย");
      }
    } catch (err) {
      alert(err.message || "เกิดข้อผิดพลาดในการค้นหา");
    } finally {
      setSearchLoading(false);
    }
  };

  const selectPatient = (p) => {
    setPatient(p);
    setSearch(`${p.hn} - ${p.patient_name}`);
    setFilteredPatients([]);
    setEncounter(null);
  };

  const handleVitalChange = (e) => {
    const { name, value } = e.target;
    setVital((prev) => ({ ...prev, [name]: value }));
  };

  const handleDrugSearch = (e) => {
    const val = e.target.value;
    setDrugSearch(val);
    if (!val.trim()) { setFilteredDrugs([]); return; }
    setFilteredDrugs(
      allDrugs
        .map((d) => d.name)
        .filter((name) => name.toLowerCase().includes(val.toLowerCase()) && !vital.drugs.includes(name))
    );
  };

  const selectDrug = (drug) => {
    setVital((prev) => ({ ...prev, drugs: [...prev.drugs, drug] }));
    setDrugSearch(""); setFilteredDrugs([]);
  };

  const removeDrug = (drug) => setVital((prev) => ({ ...prev, drugs: prev.drugs.filter((d) => d !== drug) }));

  // เพิ่มยานอกบัญชี (custom)
  const handleAddCustomDrug = async () => {
  const name = customDrugInput.trim();
  if (!name) return;
  try {
    await drugsApi.create(name); // บันทึกลง Neon
  } catch { /* ถ้า save ไม่ได้ก็ยังเพิ่มใน session ได้ */ }
  setVital((prev) => ({ ...prev, drugs: [...prev.drugs, name] }));
  setCustomDrugInput("");
  setShowCustomInput(false);
};

  // ── local date helper (ไม่ใช้ toISOString เพราะจะแปลงเป็น UTC ทำให้วันผิด) ──
  const localToday = () => {
    const d = new Date();
    const y  = d.getFullYear();
    const m  = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  };

  // ── สร้าง Encounter ผ่าน API ──
  const handleSelectEncounterType = async (type) => {
    if (!patient) return;
    setEncounterLoading(true);
    try {
      const data = await encounterApi.create({
        hn: patient.hn,
        type,
        visit_date: vital.date || localToday(), // ใช้ local date แทน toISOString
      });
      // server ส่งกลับ { message, encounter: { id, hn, type, vn, an, visit_date } }
      setEncounter(data.encounter ?? data);
    } catch (err) {
      alert(err.message || "ไม่สามารถสร้าง Encounter ได้");
    } finally {
      setEncounterLoading(false);
    }
  };

  const handleNext = () => {
    if (!patient) { alert("กรุณาเลือกผู้ป่วย"); return; }
    if (!encounter) { alert("กรุณาเลือกประเภท OPD/IPD"); return; }
    if (!vital.drugs.length) { alert("กรุณาเลือกยา"); return; }
    next();
  };

  const handleClear = () => {
    setPatient(null);
    setEncounter(null);
    setVital({ date: "", cycle: "", dose: "", doseUnit: "", drugs: [] });
    setSearch("");
    setFilteredPatients([]);
    setDrugSearch("");
    setFilteredDrugs([]);
    setCustomDrugInput("");
    setShowCustomInput(false);
  };

  const bsa = patient ? calculateBSA(patient.weight, patient.height) : "";

  const validations = [
    { ok: !!patient,              label: "เลือกผู้ป่วย" },
    { ok: !!encounter,            label: "เลือกประเภท OPD/IPD" },
    { ok: !!vital.date,           label: "วันที่ประเมิน" },
    { ok: vital.drugs.length > 0, label: "ยาที่ได้รับ" },
    { ok: !!patient?.weight && !!patient?.height, label: "Vital Signs" },
  ];

  const inputCls = "w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition hover:border-slate-300";
  const readOnlyCls = "w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-500 bg-slate-50 cursor-not-allowed";
  const labelCls = "block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5";

  return (
    <section>
      <div className="grid grid-cols-[2fr_1fr] gap-5 mb-5">
        {/* LEFT — Patient */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h2 className="text-base font-bold text-slate-700 mb-5 flex items-center gap-2">
            <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
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
              <button onClick={handleSearch} disabled={searchLoading}
                className="px-4 py-2.5 bg-slate-700 hover:bg-slate-800 text-white text-sm font-semibold rounded-lg whitespace-nowrap transition-colors disabled:opacity-60">
                {searchLoading ? "..." : "ค้นหา"}
              </button>
            </div>
            {filteredPatients.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-50 max-h-52 overflow-y-auto">
                {filteredPatients.map((p) => (
                  <div key={p.hn} onClick={() => selectPatient(p)}
                    className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-50 border-b border-slate-100 last:border-0 transition-colors">
                    <span className="text-xs font-bold text-slate-600">{p.hn}</span>
                    <span className="text-sm text-slate-700">{p.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {patient ? (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <div className="grid grid-cols-2 gap-4 mb-4">
                {[
                  { label: "ชื่อ-นามสกุล", value: patient.patient_name },
                  { label: "อายุ",          value: `${patient.age} ปี` },
                  { label: "เพศ",           value: patient.gender },
                  { label: "VN / AN",       value: encounter?.vn || encounter?.an || "-" },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">{label}</p>
                    <p className="text-sm font-bold text-slate-800">{value}</p>
                  </div>
                ))}
              </div>
              <div className="border-t border-slate-200 pt-4 mb-4">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Diagnosis</p>
                <p className="text-sm font-bold text-red-700 bg-red-50 border-l-4 border-red-400 px-3 py-2 rounded-r-lg">{patient.diagnosis}</p>
              </div>

              {!encounter ? (
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <p className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-3">เลือกประเภทการรักษา</p>
                  <div className="flex gap-3">
                    {["OPD", "IPD"].map((type) => (
                      <button key={type}
                        onClick={() => handleSelectEncounterType(type)}
                        disabled={encounterLoading}
                        className="flex-1 py-2 border-2 border-slate-300 hover:border-slate-500 hover:bg-slate-700 hover:text-white text-slate-600 font-bold text-sm rounded-lg transition-all disabled:opacity-60">
                        {encounterLoading ? "..." : type}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-2 bg-teal-50 border border-teal-200 rounded-lg text-teal-700 text-sm font-semibold">
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
          <h2 className="text-base font-bold text-slate-700 mb-5 flex items-center gap-2">
            <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
            </svg>
            Vital Signs
          </h2>
          <div className="mb-4">
            <label className={labelCls}>น้ำหนัก (kg)</label>
            <input type="text" value={patient ? patient.weight : ""} readOnly placeholder="—" className={readOnlyCls} />
          </div>
          <div className="mb-4">
            <label className={labelCls}>ส่วนสูง (cm)</label>
            <input type="text" value={patient ? patient.height : ""} readOnly placeholder="—" className={readOnlyCls} />
          </div>
          <div className="mb-4">
            <label className={labelCls}>BSA (m²)</label>
            <input type="text" value={bsa} readOnly placeholder="—" className={readOnlyCls} />
          </div>
        </div>
      </div>

      {/* Treatment Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-5 shadow-sm">
        <h2 className="text-base font-bold text-slate-700 mb-5 flex items-center gap-2">
          <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1 1 .03 2.798-1.352 2.798H4.15c-1.38 0-2.352-1.799-1.351-2.798L4 15.298M5 14.5v.301" />
          </svg>
          ข้อมูลการรักษา
        </h2>
        <div className="grid grid-cols-5 gap-4">
          <div>
            <label className={labelCls}>วันที่ประเมิน</label>
            <input type="date" name="date" value={vital.date} onChange={handleVitalChange} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Cycle</label>
            <input type="number" name="cycle" placeholder="กรอก Cycle" value={vital.cycle} onChange={handleVitalChange} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Dose</label>
            <input type="number" name="dose" placeholder="0.0" value={vital.dose} onChange={handleVitalChange} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>หน่วยยา</label>
            <input type="text" name="doseUnit" placeholder="เช่น mg/m², mg/kg, mg" value={vital.doseUnit} onChange={handleVitalChange} className={inputCls} />
          </div>
          <div className="relative">
            <label className={labelCls}>ยาที่ได้รับ</label>
            <input
              type="text"
              placeholder={drugsLoading ? "กำลังโหลด..." : "ค้นหายา..."}
              value={drugSearch}
              onChange={handleDrugSearch}
              disabled={drugsLoading}
              className={inputCls}
            />
            {filteredDrugs.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-50 max-h-52 overflow-y-auto">
                {filteredDrugs.map((drug) => (
                  <div key={drug} onClick={() => selectDrug(drug)}
                    className="px-4 py-2.5 cursor-pointer hover:bg-slate-50 text-sm text-slate-700 border-b border-slate-100 last:border-0 transition-colors">
                    {drug}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">ยาที่เลือก</p>
            <button
              type="button"
              onClick={() => setShowCustomInput((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              เพิ่มยานอกบัญชี
            </button>
          </div>

          {showCustomInput && (
            <div className="flex gap-2 mb-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="ระบุชื่อยานอกบัญชี..."
                  value={customDrugInput}
                  onChange={(e) => setCustomDrugInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddCustomDrug()}
                  className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition"
                  autoFocus
                />
                <p className="text-xs text-amber-600 mt-1">กด Enter หรือคลิก "เพิ่ม" เพื่อยืนยัน</p>
              </div>
              <button
                type="button"
                onClick={handleAddCustomDrug}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-lg transition-colors self-start"
              >
                เพิ่ม
              </button>
              <button
                type="button"
                onClick={() => { setShowCustomInput(false); setCustomDrugInput(""); }}
                className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-500 text-sm border border-slate-200 rounded-lg transition-colors self-start"
              >
                ยกเลิก
              </button>
            </div>
          )}

          {vital.drugs.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {vital.drugs.map((drug) => {
                const isCustom = allDrugs.length > 0 && !allDrugs.some((d) => d.name === drug);
                return (
                  <span key={drug}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border ${
                      isCustom ? "bg-amber-50 border-amber-200 text-amber-800" : "bg-slate-100 border-slate-200 text-slate-700"
                    }`}>
                    {isCustom && <span className="text-amber-500 font-bold leading-none">★</span>}
                    {drug}
                    <button onClick={() => removeDrug(drug)} className="text-slate-400 hover:text-slate-700 transition-colors font-bold">×</button>
                  </span>
                );
              })}
            </div>
          ) : (
            !showCustomInput && (
              <p className="text-xs text-slate-400 italic">ยังไม่ได้เลือกยา — ค้นหาจากรายการ หรือเพิ่มยานอกบัญชีด้านบน</p>
            )
          )}
        </div>
      </div>

      {/* Validation */}
      <div className="flex flex-wrap gap-2 mb-5">
        {validations.map((item) => (
          <div key={item.label} className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold border transition-all ${item.ok ? "bg-teal-50 text-teal-700 border-teal-200" : "bg-slate-100 text-slate-500 border-slate-200"}`}>
            <span className={`w-4 h-4 rounded-full flex items-center justify-center text-white text-xs font-bold ${item.ok ? "bg-teal-500" : "bg-slate-300"}`}>
              {item.ok ? "✓" : "○"}
            </span>
            {item.label}
          </div>
        ))}
      </div>

      <div className="flex justify-between items-center">
        <button onClick={handleClear}
          className="flex items-center gap-2 border border-slate-300 hover:border-red-300 hover:bg-red-50 hover:text-red-600 text-slate-500 font-semibold px-5 py-3 rounded-xl transition-colors text-sm">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
          ล้างข้อมูล
        </button>
        <button onClick={handleNext}
          className="flex items-center gap-2 bg-slate-700 hover:bg-slate-800 text-white font-semibold px-6 py-3 rounded-xl transition-colors">
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