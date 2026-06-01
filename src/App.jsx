import { useState } from "react";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import Step1 from "./pages/Step1";
import Step2 from "./pages/Step2";
import Records from "./pages/Records";
import Dashboard from "./pages/Dashboard";
import Report from "./pages/report";
import Login from "./pages/Login";

const PAGE_TITLES = {
  dashboard:  "Dashboard",
  assessment: "New ADR Assessment",
  records:    "Patient Records",
  reports:    "Reports",
};

function loadRecords() {
  try {
    const raw = JSON.parse(localStorage.getItem("patientRecords") || "[]");
    if (!Array.isArray(raw)) return [];
    return raw.map((r) => ({
      ...r,
      regimen: r.regimen || [...(r.drugs || [])].sort().join(" + ") || "-",
    }));
  } catch {
    return [];
  }
}

function loadUser() {
  try {
    const raw = sessionStorage.getItem("adrUser");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function saveUser(user) {
  if (user) sessionStorage.setItem("adrUser", JSON.stringify(user));
  else sessionStorage.removeItem("adrUser");
}

function loadPage() {
  return sessionStorage.getItem("adrPage") || "dashboard";
}
function savePage(page) {
  sessionStorage.setItem("adrPage", page);
}

/* ── Initial state for Step1 form ── */
const INITIAL_VITAL = { date: "", cycle: "", dose: "", doseUnit: "", drugs: [] };

function App() {
  const [user, setUserState] = useState(loadUser);
  const [page, setPageState] = useState(loadPage);
  const [step, setStep]      = useState(1);

  /* ── Step1 state (lifted up) ── */
  const [step1Patient,   setStep1Patient]   = useState(null);
  const [step1Vital,     setStep1Vital]     = useState(INITIAL_VITAL);
  const [step1Encounter, setStep1Encounter] = useState(null);

  /* ── Step2 state (lifted up) ── */
  const [step2Symptoms,         setStep2Symptoms]         = useState([]);  // selectedSymptoms array
  const [step2SymptomsGraded,   setStep2SymptomsGraded]   = useState({});  // { key: { grade, label, ... } }
  const [step2Note,             setStep2Note]             = useState("");

  /* ── Records ── */
  const [patientRecords, setPatientRecordsState] = useState(loadRecords);
  const setPatientRecords = (data) => {
    const next = Array.isArray(data) ? data : [];
    localStorage.setItem("patientRecords", JSON.stringify(next));
    setPatientRecordsState(next);
  };

  const setUser = (u) => { saveUser(u); setUserState(u); };

  const handleSetPage = (p) => {
    savePage(p);
    setPageState(p);
    if (p === "assessment") setStep(1);
  };

  const handleLogout = () => {
    setUser(null);
    savePage("dashboard");
    setPageState("dashboard");
    setStep(1);
  };

  /* Reset Step1+Step2 forms after successful save */
  const resetAssessment = () => {
    setStep1Patient(null);
    setStep1Vital(INITIAL_VITAL);
    setStep1Encounter(null);
    setStep2Symptoms([]);
    setStep2SymptomsGraded({});
    setStep2Note("");
    setStep(1);
  };

  /* assessmentData derived from Step1 state — same shape Step2 already expects */
  const assessmentData = step1Patient ? {
    ...step1Vital,
    weight: step1Patient.weight,
    height: step1Patient.height,
    bsa: step1Patient.weight && step1Patient.height
      ? Math.sqrt((parseFloat(step1Patient.weight) * parseFloat(step1Patient.height)) / 3600).toFixed(2)
      : "",
    encounter: step1Encounter,
  } : null;

  if (!user) return <Login onLogin={setUser} />;

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-800">
      <Sidebar setPage={handleSetPage} currentPage={page} />

      <main className="flex-1 flex flex-col min-w-0">
        <Topbar title={PAGE_TITLES[page] || page} user={user} onLogout={handleLogout} />

        <div className="p-6">
          {page === "dashboard" && <Dashboard setPage={handleSetPage} />}

          {page === "assessment" && (
            <>
              {/* Step bar */}
              <div className="inline-flex items-center gap-4 bg-white border border-slate-200 rounded-xl px-6 py-4 mb-6 shadow-sm">
                <div className={`flex items-center gap-2.5 text-sm font-semibold ${step === 1 ? "text-blue-700" : step > 1 ? "text-emerald-600" : "text-slate-400"}`}>
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
                    ${step === 1 ? "bg-blue-700 text-white" : step > 1 ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-400"}`}>
                    {step > 1 ? "✓" : "1"}
                  </span>
                  ข้อมูลผู้ป่วย
                </div>
                <div className="w-12 h-px bg-slate-200" />
                <div className={`flex items-center gap-2.5 text-sm font-semibold ${step === 2 ? "text-blue-700" : "text-slate-400"}`}>
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
                    ${step === 2 ? "bg-blue-700 text-white" : "bg-slate-200 text-slate-400"}`}>
                    2
                  </span>
                  ประเมินอาการ
                </div>
              </div>

              {step === 1 && (
                <Step1
                  next={() => setStep(2)}
                  /* lifted state */
                  patient={step1Patient}
                  setPatient={setStep1Patient}
                  vital={step1Vital}
                  setVital={setStep1Vital}
                  encounter={step1Encounter}
                  setEncounter={setStep1Encounter}
                />
              )}

              {step === 2 && (
                <Step2
                  prev={() => setStep(1)}
                  patient={step1Patient}
                  assessmentData={assessmentData}
                  setPatientRecords={setPatientRecords}
                  onNavigate={handleSetPage}
                  onSaveSuccess={resetAssessment}
                  /* lifted state */
                  selectedSymptoms={step2Symptoms}
                  setSelectedSymptoms={setStep2Symptoms}
                  symptoms={step2SymptomsGraded}
                  setSymptoms={setStep2SymptomsGraded}
                  note={step2Note}
                  setNote={setStep2Note}
                />
              )}
            </>
          )}

          {page === "records" && (
            <Records
              patientRecords={patientRecords}
              setPatientRecords={setPatientRecords}
              userRole={user.role}
            />
          )}

          {page === "reports" && <Report />}
        </div>
      </main>
    </div>
  );
}

export default App;