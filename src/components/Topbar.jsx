function Topbar({ title, user, onLogout }) {
  const now = new Date();
  const dateStr = now.toLocaleDateString("th-TH", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const isPharmacist = user?.role === "pharmacist";

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between px-7 py-4 bg-white border-b border-slate-200">
      <div>
        <h1 className="text-xl font-bold text-slate-800">{title}</h1>
        <p className="text-xs text-slate-400 mt-0.5">{dateStr}</p>
      </div>

      <div className="flex items-center gap-3">

        
        {/* User info */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-semibold text-slate-800 leading-tight">
              {user?.name || "ผู้ใช้งาน"}
            </p>
            <p className="text-xs text-slate-400 leading-tight">
              {user?.title || ""}
            </p>
          </div>
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
              isPharmacist ? "bg-blue-100" : "bg-emerald-100"
            }`}
          >
            <svg
              className={`w-5 h-5 ${isPharmacist ? "text-blue-700" : "text-emerald-700"}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.8}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
              />
            </svg>
          </div>
        </div>

        {/* Logout button */}
        <button
          onClick={onLogout}
          title="ออกจากระบบ"
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-red-600 hover:bg-red-50 border border-slate-200 hover:border-red-200 transition-all"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"
            />
          </svg>
          <span className="hidden sm:inline">ออกจากระบบ</span>
        </button>

      </div>
    </header>
  );
}

export default Topbar;