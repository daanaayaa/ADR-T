/**
 * RecordDetail.jsx — Detail + Edit as a POPUP MODAL (no page navigation)
 *
 * Props:
 *   id        — record UUID / id
 *   onClose   — fn() closes the modal
 *   canEdit   — boolean; pharmacist = true, nurse = false
 *   onSaved   — fn(updatedRecord) callback after successful save
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { recordApi, patientApi, calcBSA, drugsApi } from "../services/api";
import ctcae from "../data/ctcae.json";

// ─── Constants ────────────────────────────────────────────────────────────────

const GRADE_COLORS = {
  1: "bg-emerald-50 text-emerald-700 border-emerald-200",
  2: "bg-amber-50 text-amber-700 border-amber-200",
  3: "bg-orange-50 text-orange-700 border-orange-200",
  4: "bg-red-50 text-red-700 border-red-200",
  5: "bg-slate-800 text-white border-slate-800",
};
const GRADE_BAR = {
  1: "bg-emerald-400", 2: "bg-amber-400", 3: "bg-orange-500",
  4: "bg-red-500",     5: "bg-slate-700",
};
const GRADE_LABEL = { 1: "Mild", 2: "Moderate", 3: "Severe", 4: "Life-threatening", 5: "Fatal" };
const GRADE_DOT   = { 1: "#16a34a", 2: "#d97706", 3: "#ea580c", 4: "#dc2626", 5: "#374151" };

const buildRegimen = (drugs = []) => [...drugs].sort().join(" + ") || "-";

// ─── Style tokens ─────────────────────────────────────────────────────────────

const inputCls    = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition";
const readOnlyCls = "w-full px-3 py-2 border border-slate-100 rounded-lg text-sm text-slate-400 bg-slate-50 cursor-not-allowed";
const labelCls    = "block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5";

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoRow({ label, value, mono = false }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
      <span className={`text-sm font-semibold text-slate-800 ${mono ? "font-mono" : ""}`}>
        {value ?? <span className="text-slate-300 font-normal">—</span>}
      </span>
    </div>
  );
}

function GradeBadge({ grade }) {
  if (!grade) return null;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${GRADE_COLORS[grade] || "bg-slate-100 text-slate-600 border-slate-200"}`}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: GRADE_DOT[grade] || "#94a3b8" }} />
      Grade {grade} — {GRADE_LABEL[grade] || ""}
    </span>
  );
}

function SectionBlock({ title, icon, children, compact = false }) {
  return (
    <div className="border border-slate-100 rounded-xl overflow-hidden bg-white">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50/80 border-b border-slate-100">
        <div className="w-6 h-6 rounded-md bg-blue-50 flex items-center justify-center text-blue-500 flex-shrink-0 text-xs">
          {icon}
        </div>
        <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{title}</h3>
      </div>
      <div className={compact ? "px-4 py-3" : "px-4 py-4"}>{children}</div>
    </div>
  );
}

function SymptomCard({ symptom }) {
  const grade = symptom.grade;
  // Fallback chain:
  // 1. custom_label  — user-typed custom symptom
  // 2. term_label    — resolved from ctcae_terms JOIN
  // 3. term_key      — raw key from DB
  // 4. json_label    — label saved directly from Step2 JSON (patched in DetailView)
  // 5. "Unknown"
  const label =
    symptom.custom_label ||
    symptom.term_label   ||
    symptom.term_key     ||
    symptom.json_label   ||
    "Unknown";
  return (
    <div className="border border-slate-100 rounded-xl overflow-hidden bg-white">
      <div className="flex items-center justify-between px-3 py-2.5 bg-slate-50/60 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className={`w-1 h-5 rounded-full flex-shrink-0 ${GRADE_BAR[grade] || "bg-slate-300"}`} />
          <span className="text-sm font-bold text-slate-800">{label}</span>
          {symptom.custom_label && (
            <span className="px-1.5 py-0.5 bg-purple-50 border border-purple-200 text-purple-600 text-[10px] font-bold rounded uppercase tracking-wide">Custom</span>
          )}
        </div>
        <GradeBadge grade={grade} />
      </div>
      {(symptom.description || symptom.note || symptom.additional_detail) && (
        <div className="px-3 py-2.5 space-y-2">
          {symptom.description && (
            <p className="text-xs text-slate-500 leading-relaxed">{symptom.description}</p>
          )}
          {symptom.note && (
            <p className="text-xs text-slate-400 italic leading-relaxed">{symptom.note}</p>
          )}
          {symptom.additional_detail && (
            <div className="mt-1 rounded-lg border border-blue-100 bg-blue-50/60 px-2.5 py-2">
              <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest flex items-center gap-1 mb-1">
                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                </svg>
                รายละเอียดเพิ่มเติม
              </p>
              <p className="text-xs text-blue-700 leading-relaxed whitespace-pre-line">{symptom.additional_detail}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── CTCAE Symptom Editor ─────────────────────────────────────────────────────

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

  return (
    <div className="space-y-3">
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input type="text" placeholder="ค้นหาอาการ เช่น Nausea, Fatigue..." value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition" />
      </div>

      {search.trim() && (
        <div className="flex flex-wrap gap-1.5 max-h-[110px] overflow-y-auto bg-blue-50/40 rounded-xl p-2.5 border border-blue-100">
          {filteredTerms.length === 0
            ? <p className="text-xs text-slate-400 italic w-full text-center py-2">ไม่พบอาการที่ค้นหา</p>
            : filteredTerms.map((s) => {
              const isSelected = selectedKeys.includes(s.key);
              return (
                <button key={s.key} onClick={() => addSymptom(s)} disabled={isSelected}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                    isSelected ? "bg-blue-100 border-blue-300 text-blue-600 cursor-default" : "bg-white border-slate-200 text-slate-600 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 shadow-sm"
                  }`}>
                  {isSelected ? "✓ " : "+ "}{s.label}
                </button>
              );
            })
          }
        </div>
      )}

      {selectedSymptoms.length > 0 ? (
        <div className="space-y-2 max-h-[280px] overflow-y-auto pr-0.5">
          {selectedSymptoms.map((symptom) => {
            const sym = value[symptom.key];
            const grade = sym?.grade;
            return (
              <div key={symptom.key} className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-100">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-1 h-4 rounded-full flex-shrink-0 ${grade ? GRADE_BAR[grade] : "bg-slate-200"}`} />
                    <span className="text-xs font-bold text-slate-800 truncate">{symptom.label}</span>
                    {symptom.isCustom && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-600 border border-purple-200 flex-shrink-0">Custom</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    {grade && (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${GRADE_COLORS[grade]}`}>
                        G{grade}
                      </span>
                    )}
                    <button onClick={() => removeSymptom(symptom.key)}
                      className="w-5 h-5 flex items-center justify-center rounded hover:bg-red-50 hover:text-red-500 text-slate-400 transition font-bold text-sm">×</button>
                  </div>
                </div>
                <div className="px-3 py-2.5 space-y-2">
                  {sym?.grade && sym?.description && (
                    <p className="text-xs text-slate-500 leading-relaxed bg-slate-50 rounded-lg px-2.5 py-1.5 border border-slate-100">{sym.description}</p>
                  )}
                  <select value={sym?.grade || ""} onChange={(e) => handleGrade(symptom, Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent cursor-pointer transition">
                    <option value="">— เลือกระดับความรุนแรง (Grade) —</option>
                    {(symptom.options || []).map((o) => (
                      <option key={o.grade} value={o.grade}>Grade {o.grade} — {o.description}</option>
                    ))}
                  </select>
                  {sym?.grade && (
                    <div>
                      <label className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                        <svg className="w-2.5 h-2.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                        </svg>
                        รายละเอียดเพิ่มเติม
                      </label>
                      <textarea
                        rows={2}
                        value={sym?.additionalDetail || ""}
                        onChange={(e) => handleAdditionalDetail(symptom.key, e.target.value)}
                        placeholder={`เช่น ชาปลายนิ้วมือช่วงกลางคืน, CBC ลดลงจากรอบก่อน...`}
                        className="w-full rounded-lg border border-blue-100 bg-blue-50/40 px-2.5 py-2 text-xs text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent resize-none transition"
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        !search.trim() && (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 text-base">🩺</div>
            <p className="text-xs text-slate-400">ยังไม่ได้เลือกอาการ — ค้นหาเพื่อเพิ่ม</p>
          </div>
        )
      )}
    </div>
  );
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────
const IconUser = <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>;
const IconPill = <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1 1 .03 2.798-1.348 2.798H4.346c-1.378 0-2.349-1.798-1.348-2.798l1.348-1.348" /></svg>;
const IconClipboard = <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" /></svg>;
const IconNote = <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg>;

// ─── Read-only Detail View ────────────────────────────────────────────────────

function DetailView({ record, patient }) {
  const bsa  = calcBSA(patient?.weight, patient?.height);
  const vnAn = record.vn || record.an || "—";
  const drugs = Array.isArray(record.drugs) ? record.drugs
    : typeof record.drugs === "string" ? JSON.parse(record.drugs || "[]") : [];

  // Build a lookup map from record.symptoms (JSON saved by Step2) — key → label
  const symptomsJsonMap = (() => {
    const raw = record.symptoms;
    if (!raw) return {};
    try {
      const obj = typeof raw === "string" ? JSON.parse(raw) : raw;
      const map = {};
      Object.entries(obj).forEach(([key, val]) => {
        if (val && typeof val === "object" && val.label) map[key] = val.label;
      });
      return map;
    } catch { return {}; }
  })();

  const symptomsDetail = Array.isArray(record.symptomsDetail)
    ? record.symptomsDetail.map((s) => {
        // If the DB JOIN didn't resolve a label, fall back to the JSON label
        const jsonLabel = symptomsJsonMap[s.term_key] || symptomsJsonMap[s.custom_key];
        return {
          ...s,
          // keep existing term_label/term_key; only patch when missing
          term_label: s.term_label || jsonLabel || s.term_key || null,
        };
      })
    : [];

  const symptomsFallback = (() => {
    if (symptomsDetail.length) return [];
    const raw = record.symptoms;
    if (!raw) return [];
    try {
      const obj = typeof raw === "string" ? JSON.parse(raw) : raw;
      return Object.entries(obj)
        .filter(([, v]) => v && typeof v === "object" && v.grade)
        .map(([key, val]) => ({
          id: key, term_key: key,
          term_label:        val.label || key,
          custom_label:      val.isCustom ? val.label : null,
          grade:             val.grade,
          description:       val.description || "",
          note:              val.note || "",
          additional_detail: val.additionalDetail || "",
        }));
    } catch { return []; }
  })();
  const displaySymptoms = symptomsDetail.length ? symptomsDetail : symptomsFallback;

  return (
    <div className="space-y-3">
      {/* Patient Info */}
      <SectionBlock title="Patient Information" icon={IconUser} compact>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <InfoRow label="HN" value={record.hn} mono />
          <InfoRow label="ชื่อผู้ป่วย" value={record.patient_name} />
          <InfoRow label="Diagnosis" value={record.diagnosis} />
          <InfoRow label="VN / AN" value={vnAn} mono />
          <InfoRow label="วันที่ประเมิน" value={record.record_date
            ? new Date(record.record_date).toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" })
            : null} />
          {patient && (
            <InfoRow label="เพศ / อายุ" value={(patient.gender || patient.age)
              ? `${patient.gender || "—"} / ${patient.age ? patient.age + " ปี" : "—"}` : null} />
          )}
        </div>
      </SectionBlock>

      {/* Treatment */}
      <SectionBlock title="Treatment Information" icon={IconPill} compact>
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <InfoRow label="Cycle" value={record.cycle ? `Cycle ${record.cycle}` : null} />
            <InfoRow label="Dose" value={record.dose ? `${record.dose}${record.dose_unit ? " " + record.dose_unit : ""}` : null} />
            {patient && (
              <>
                <InfoRow label="Weight / Height" value={(patient.weight || patient.height) ? `${patient.weight ?? "—"} kg / ${patient.height ?? "—"} cm` : null} />
                <InfoRow label="BSA" value={bsa ? `${bsa} m²` : null} />
              </>
            )}
          </div>
          {drugs.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Regimen</p>
              <div className="flex flex-wrap gap-1.5">
                {drugs.map((d, i) => (
                  <span key={i} className="inline-flex items-center px-2.5 py-1 bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold rounded-lg">{d}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </SectionBlock>

      {/* CTCAE */}
      <SectionBlock title="CTCAE Assessment" icon={IconClipboard} compact>
        {displaySymptoms.length > 0
          ? <div className="space-y-2">{displaySymptoms.map((s, i) => <SymptomCard key={s.id || i} symptom={s} />)}</div>
          : <p className="text-xs text-slate-400 italic text-center py-3">ไม่มีข้อมูลอาการ</p>
        }
      </SectionBlock>

      {/* Case Note only — Recommendation removed per request */}
      {record.note && (
        <SectionBlock title="Case Note" icon={IconNote} compact>
          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{record.note}</p>
        </SectionBlock>
      )}

      {/* Footer */}
      <div className="text-center text-[10px] text-slate-300 pb-1">
        Record ID: {record.id}
        {record.created_at && (
          <> · บันทึกเมื่อ {new Date(record.created_at).toLocaleString("th-TH", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</>
        )}
      </div>
    </div>
  );
}

// ─── Edit Form ────────────────────────────────────────────────────────────────

function EditForm({ record, patient, onSave, onCancel, saving }) {
  const weight = record.weight || record.patient_weight || record.vital?.weight || patient?.weight || "";
  const height = record.height || record.patient_height || record.vital?.height || patient?.height || "";
  const calcBSALocal = () => {
    if (record.bsa || record.vital?.bsa) return record.bsa || record.vital?.bsa;
    const w = parseFloat(weight), h = parseFloat(height);
    return w && h ? Math.sqrt((w * h) / 3600).toFixed(2) : "";
  };

  const [form, setForm] = useState({
    date:           record.record_date || record.date || "",
    cycle:          record.cycle       || "",
    dose:           record.dose        || "",
    dose_unit:      record.dose_unit   || "",
    note:           record.note        || "",
    recommendation: record.recommendation || "",
    drugs:          Array.isArray(record.drugs) ? record.drugs
                      : typeof record.drugs === "string" ? JSON.parse(record.drugs || "[]") : [],
  });

  const [symptoms, setSymptoms] = useState(() => {
    // Build a map from symptomsDetail (DB rows) to get additional_detail per key
    const detailMap = {};
    if (Array.isArray(record.symptomsDetail)) {
      record.symptomsDetail.forEach((s) => {
        const key = s.term_key || s.custom_key;
        if (key) detailMap[key] = s.additional_detail || "";
      });
    }

    const raw = record.symptoms || {};
    const normalized = {};
    Object.entries(raw).forEach(([key, val]) => {
      if (typeof val === "object" && val !== null && "grade" in val) {
        normalized[key] = { ...val, additionalDetail: detailMap[key] || val.additionalDetail || "" };
      } else if (typeof val === "number") {
        normalized[key] = { label: key, description: "", grade: val, additionalDetail: detailMap[key] || "" };
      }
    });
    return normalized;
  });

  const [activeSubTab,    setActiveSubTab]    = useState("step1");
  const [allDrugs,        setAllDrugs]        = useState([]);
  const [drugsLoading,    setDrugsLoading]    = useState(false);
  const [drugSearch,      setDrugSearch]      = useState("");
  const [drugFiltered,    setDrugFiltered]    = useState([]);
  const [customDrugInput, setCustomDrugInput] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);

  useEffect(() => {
    setDrugsLoading(true);
    drugsApi.getAll()
      .then((data) => setAllDrugs(data || []))
      .catch(() => setAllDrugs([]))
      .finally(() => setDrugsLoading(false));
  }, []);

  const handleDrugSearch = (val) => {
    setDrugSearch(val);
    if (!val.trim()) { setDrugFiltered([]); return; }
    const names = allDrugs.map((d) => d.name || d).filter(Boolean);
    setDrugFiltered(names.filter((n) => n.toLowerCase().includes(val.toLowerCase()) && !form.drugs.includes(n)));
  };
  const addDrug    = (d) => { setForm((f) => ({ ...f, drugs: [...f.drugs, d] })); setDrugSearch(""); setDrugFiltered([]); };
  const removeDrug = (d) => setForm((f) => ({ ...f, drugs: f.drugs.filter((x) => x !== d) }));
  const handleAddCustomDrug = async () => {
    const name = customDrugInput.trim();
    if (!name) return;
    try { await drugsApi.create(name); } catch { /* session only */ }
    addDrug(name); setCustomDrugInput(""); setShowCustomInput(false);
  };

  const handleSubmit = () =>
    onSave({ ...form, weight, height, bsa: calcBSALocal(), regimen: buildRegimen(form.drugs), symptoms });

  const bsa  = calcBSA(patient?.weight, patient?.height);
  const vnAn = record.vn || record.an || "—";

  return (
    <div className="space-y-4">
      {/* Patient Info — locked */}
      <SectionBlock title="Patient Information (อ่านได้อย่างเดียว)" icon={IconUser} compact>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <InfoRow label="HN"           value={record.hn} mono />
          <InfoRow label="ชื่อผู้ป่วย"   value={record.patient_name} />
          <InfoRow label="Diagnosis"    value={record.diagnosis} />
          <InfoRow label="VN / AN"      value={vnAn} mono />
          {patient && (
            <>
              <InfoRow label="เพศ / อายุ" value={(patient.gender || patient.age) ? `${patient.gender || "—"} / ${patient.age ? patient.age + " ปี" : "—"}` : null} />
              <InfoRow label="Weight / Height" value={(patient.weight || patient.height) ? `${patient.weight ?? "—"} kg / ${patient.height ?? "—"} cm` : null} />
              <InfoRow label="BSA" value={bsa ? `${bsa} m²` : null} />
            </>
          )}
        </div>
      </SectionBlock>

      {/* Editable fields with sub-tab */}
      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
        {/* Tab switcher */}
        <div className="flex border-b border-slate-200 bg-slate-50">
          {[{ key: "step1", label: "📋 ข้อมูลการประเมิน" }, { key: "step2", label: "🩺 อาการ CTCAE" }].map((tab) => (
            <button key={tab.key} onClick={() => setActiveSubTab(tab.key)}
              className={`flex-1 px-4 py-2.5 text-xs font-bold transition border-b-2 ${activeSubTab === tab.key
                ? "border-blue-600 text-blue-700 bg-white"
                : "border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-100"}`}>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="px-4 py-4 space-y-3">
          {activeSubTab === "step1" ? (
            <>
              {/* Date + Cycle */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>วันที่ประเมิน</label>
                  <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Cycle</label>
                  <input type="number" placeholder="กรอก Cycle" value={form.cycle} onChange={(e) => setForm((f) => ({ ...f, cycle: e.target.value }))} className={inputCls} />
                </div>
              </div>

              {/* Dose */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Dose</label>
                  <input type="number" placeholder="ขนาดยา" value={form.dose} onChange={(e) => setForm((f) => ({ ...f, dose: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>หน่วย</label>
                  <input type="text" placeholder="mg/m², mg/kg, ..." value={form.dose_unit} onChange={(e) => setForm((f) => ({ ...f, dose_unit: e.target.value }))} className={inputCls} />
                </div>
              </div>

              {/* Vitals — read-only */}
              <div className="grid grid-cols-3 gap-3">
                <div><label className={labelCls}>น้ำหนัก (kg)</label><input type="text" value={weight} readOnly placeholder="—" className={readOnlyCls} /></div>
                <div><label className={labelCls}>ส่วนสูง (cm)</label><input type="text" value={height} readOnly placeholder="—" className={readOnlyCls} /></div>
                <div><label className={labelCls}>BSA (m²)</label><input type="text" value={calcBSALocal()} readOnly placeholder="—" className={readOnlyCls} /></div>
              </div>

              {/* Drugs */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className={labelCls} style={{ marginBottom: 0 }}>ยาที่ได้รับ</label>
                  <button type="button" onClick={() => setShowCustomInput((v) => !v)}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                    เพิ่มยานอกบัญชี
                  </button>
                </div>
                {showCustomInput && (
                  <div className="flex gap-2 mb-2 p-2.5 bg-amber-50 border border-amber-200 rounded-xl">
                    <input type="text" placeholder="ระบุชื่อยานอกบัญชี..." value={customDrugInput}
                      onChange={(e) => setCustomDrugInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddCustomDrug()}
                      className="flex-1 px-3 py-1.5 border border-amber-300 rounded-lg text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 transition" autoFocus />
                    <button type="button" onClick={handleAddCustomDrug} className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg transition">เพิ่ม</button>
                    <button type="button" onClick={() => { setShowCustomInput(false); setCustomDrugInput(""); }} className="px-3 py-1.5 bg-white border border-slate-200 text-slate-500 text-xs rounded-lg hover:bg-slate-50 transition">ยกเลิก</button>
                  </div>
                )}
                <div className="relative">
                  <input type="text" placeholder={drugsLoading ? "กำลังโหลดรายการยา..." : "ค้นหายา..."} value={drugSearch}
                    onChange={(e) => handleDrugSearch(e.target.value)} disabled={drugsLoading} className={inputCls} />
                  {drugFiltered.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-50 max-h-44 overflow-y-auto">
                      {drugFiltered.map((d) => (
                        <div key={d} onClick={() => addDrug(d)} className="px-4 py-2 cursor-pointer hover:bg-blue-50 text-sm text-slate-700 border-b border-slate-100 last:border-0 transition-colors">{d}</div>
                      ))}
                    </div>
                  )}
                </div>
                {form.drugs.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {form.drugs.map((d) => {
                      const isCustom = allDrugs.length > 0 && !allDrugs.some((x) => (x.name || x) === d);
                      return (
                        <span key={d} className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg border ${isCustom ? "bg-amber-50 border-amber-200 text-amber-800" : "bg-blue-50 border-blue-200 text-blue-800"}`}>
                          {isCustom && <span className="text-amber-500 font-bold text-[10px]">★</span>}
                          {d}
                          <button onClick={() => removeDrug(d)} className="text-current opacity-50 hover:opacity-100 font-bold transition">×</button>
                        </span>
                      );
                    })}
                  </div>
                ) : (!showCustomInput && <p className="text-xs text-slate-400 italic mt-2">ยังไม่ได้เลือกยา</p>)}
              </div>

              {/* Note */}
              <div>
                <label className={labelCls}>Case Note</label>
                <textarea rows={3} placeholder="กรอกหมายเหตุ..." value={form.note}
                  onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} className={inputCls + " resize-none"} />
              </div>

              {/* Recommendation */}
              <div>
                <label className={labelCls}>Recommendation</label>
                <textarea rows={3} placeholder="คำแนะนำ..." value={form.recommendation}
                  onChange={(e) => setForm((f) => ({ ...f, recommendation: e.target.value }))} className={inputCls + " resize-none"} />
              </div>
            </>
          ) : (
            <SymptomEditor value={symptoms} onChange={setSymptoms} />
          )}
        </div>
      </div>

      {/* Save / Cancel */}
      <div className="flex justify-end gap-2.5 pt-1">
        <button onClick={onCancel} disabled={saving}
          className="px-5 py-2 border border-slate-300 hover:border-slate-400 text-slate-700 font-semibold text-sm rounded-xl transition disabled:opacity-50">
          ยกเลิก
        </button>
        <button onClick={handleSubmit} disabled={saving}
          className="flex items-center gap-2 px-5 py-2 text-white font-semibold text-sm rounded-xl transition disabled:opacity-60"
          style={{ background: "linear-gradient(135deg,#0f4c81,#1a6fb5)" }}>
          {saving
            ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 3.75V16.5L12 14.25 7.5 16.5V3.75m9 0H18A2.25 2.25 0 0120.25 6v12A2.25 2.25 0 0118 20.25H6A2.25 2.25 0 013.75 18V6A2.25 2.25 0 016 3.75h1.5m9 0h-9" /></svg>
          }
          {saving ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
        </button>
      </div>
    </div>
  );
}

// ─── Main RecordDetail — POPUP MODAL ─────────────────────────────────────────

export default function RecordDetail({ id, onClose, canEdit = true, onSaved }) {
  const [record,  setRecord]  = useState(null);
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [saving,  setSaving]  = useState(false);
  const [editing, setEditing] = useState(false);

  const originalRef = useRef(null);

  // Close on Escape key
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape" && !editing) onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [editing, onClose]);

  // Prevent body scroll when modal open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  useEffect(() => {
    if (!id) return;
    setLoading(true); setError("");
    recordApi.getById(id)
      .then(async (rec) => {
        setRecord(rec);
        originalRef.current = rec;
        try { const p = await patientApi.getByHN(rec.hn); setPatient(p); } catch { /* non-critical */ }
      })
      .catch((err) => setError(err.message || "โหลดข้อมูลไม่สำเร็จ"))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSave = async (updatedFields) => {
    setSaving(true);
    try {
      await recordApi.update(id, {
        cycle:          updatedFields.cycle ? Number(updatedFields.cycle) : undefined,
        dose:           updatedFields.dose  ? Number(updatedFields.dose)  : undefined,
        dose_unit:      updatedFields.dose_unit,
        drugs:          updatedFields.drugs || [],
        symptoms:       updatedFields.symptoms || {},
        note:           updatedFields.note || "",
        recommendation: updatedFields.recommendation || "",
        follow_up_date: updatedFields.follow_up_date,
      });
      const merged = { ...record, ...updatedFields };
      setRecord(merged);
      originalRef.current = merged;
      onSaved?.(merged);
      setEditing(false);
    } catch (err) {
      alert(`บันทึกไม่สำเร็จ: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (originalRef.current) setRecord(originalRef.current);
    setEditing(false);
  };

  const maxGrade = (() => {
    if (!record) return 0;
    const symptomsDetail = Array.isArray(record.symptomsDetail) ? record.symptomsDetail : [];
    const raw = record.symptoms;
    const fallback = raw ? Object.values(typeof raw === "string" ? JSON.parse(raw) : raw) : [];
    const all = symptomsDetail.length ? symptomsDetail : fallback;
    return all.reduce((m, s) => Math.max(m, s.grade || 0), 0);
  })();

  return createPortal(
    /* ── Overlay — same backdrop as delete confirm modal ── */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(15,28,46,0.50)", backdropFilter: "blur(3px)" }}
      onClick={(e) => { if (e.target === e.currentTarget && !editing && !saving) onClose(); }}
    >
      <style>{`
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.95) translateY(12px); }
          to   { opacity: 1; transform: scale(1)    translateY(0); }
        }
      `}</style>

      {/* ── White card — matches delete popup style ── */}
      <div
        className="bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden w-full"
        style={{
          maxWidth: "680px",
          maxHeight: "calc(100vh - 32px)",
          animation: "modalIn 0.2s cubic-bezier(0.34,1.4,0.64,1) both",
        }}
      >
        {/* ── Top section: icon + title + close (centered like delete modal) ── */}
        <div className="flex-shrink-0 px-6 pt-7 pb-4 text-center relative">

          {/* Close ×  — top-right corner */}
          {!saving && (
            <button
              onClick={editing ? handleCancel : onClose}
              title={editing ? "ยกเลิกการแก้ไข" : "ปิด"}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}

          {/* Icon circle */}
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3"
            style={{ background: editing ? "#fef3c7" : "#eff6ff" }}>
            {editing ? (
              <svg className="w-7 h-7 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
              </svg>
            ) : (
              <svg className="w-7 h-7 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            )}
          </div>

          {/* Title */}
          <h2 className="text-lg font-bold text-slate-800 leading-snug">
            {editing ? "แก้ไขข้อมูล" : "รายละเอียดการประเมิน"}
          </h2>

          {/* Subtitle: patient name + grade badge */}
          <div className="flex items-center justify-center gap-2 mt-1 flex-wrap">
            <p className="text-sm text-slate-500">
              {record?.patient_name
                ? <><strong className="text-slate-700">{record.patient_name}</strong>{record?.hn ? <> · HN {record.hn}</> : null}</>
                : loading ? "กำลังโหลด..." : "—"
              }
            </p>
            {maxGrade > 0 && !loading && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border ${GRADE_COLORS[maxGrade] || "bg-slate-100 text-slate-600 border-slate-200"}`}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: GRADE_DOT[maxGrade] }} />
                Max Grade {maxGrade}
              </span>
            )}
          </div>

          {/* Edit button — shown only in view mode for pharmacist */}
          {canEdit && !loading && record && !editing && (
            <button
              onClick={() => setEditing(true)}
              className="mt-4 inline-flex items-center gap-1.5 px-5 py-2 text-sm font-semibold rounded-xl border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 transition"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
              </svg>
              แก้ไขข้อมูล
            </button>
          )}
        </div>

        {/* Divider */}
        <div className="flex-shrink-0 h-px bg-slate-100 mx-6" />

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="flex flex-col items-center gap-3 py-14">
              <div className="w-9 h-9 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
              <p className="text-sm text-slate-400">กำลังโหลดข้อมูล...</p>
            </div>
          ) : error || !record ? (
            <div className="text-center py-14">
              <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <p className="text-sm font-bold text-slate-700 mb-1">ไม่พบข้อมูล</p>
              <p className="text-xs text-slate-400">{error || "ไม่พบ Record ID นี้"}</p>
            </div>
          ) : editing ? (
            <EditForm
              record={record}
              patient={patient}
              onSave={handleSave}
              onCancel={handleCancel}
              saving={saving}
            />
          ) : (
            <DetailView record={record} patient={patient} />
          )}
        </div>

        {/* ── Bottom action bar — shown in view mode only (edit has its own buttons inside EditForm) ── */}
        {!loading && record && !editing && (
          <div className="flex-shrink-0 px-6 py-4 border-t border-slate-100">
            <button
              onClick={onClose}
              className="w-full px-4 py-2.5 border border-slate-300 hover:border-slate-400 text-slate-700 font-semibold text-sm rounded-xl transition"
            >
              ปิด
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}