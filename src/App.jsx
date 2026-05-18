import { useState } from "react";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import Step1 from "./pages/Step1";
import Step2 from "./pages/Step2";
import Records from "./pages/Records";
import Dashboard from "./pages/Dashboard";
import Report from "./pages/report";

const PAGE_TITLES = {
  dashboard: "Dashboard",
  assessment: "New ADR Assessment",
  records: "Patient Records",
  reports: "Reports",
};

function App() {
  const [step, setStep] = useState(1);
  const [page, setPage] = useState("dashboard");
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [assessmentData, setAssessmentData] = useState(null);
  const [patientRecords, setPatientRecords] = useState([]);

  const handleSetPage = (p) => {
    setPage(p);
    if (p === "assessment") setStep(1);
  };

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-800">
      <Sidebar setPage={handleSetPage} currentPage={page} />

      <main className="flex-1 flex flex-col min-w-0">
        <Topbar title={PAGE_TITLES[page] || page} />

        <div className="p-6">
          {/* DASHBOARD */}
          {page === "dashboard" && <Dashboard setPage={handleSetPage} />}

          {/* ASSESSMENT */}
          {page === "assessment" && (
            <>
              {/* STEP BAR */}
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
                  setSelectedPatient={setSelectedPatient}
                  setAssessmentData={setAssessmentData}
                />
              )}
              {step === 2 && (
                <Step2
                  prev={() => setStep(1)}
                  patient={selectedPatient}
                  assessmentData={assessmentData}
                  setPatientRecords={setPatientRecords}
                />
              )}
            </>
          )}

          {/* RECORDS */}
          {page === "records" && <Records patientRecords={patientRecords} />}

          {/* REPORTS */}
          {page === "reports" && <Report />}
        </div>
      </main>
    </div>
  );
}

export default App;
