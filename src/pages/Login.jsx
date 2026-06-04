import { useState } from "react";
import { authApi } from "../services/api";

export default function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { token, user } = await authApi.login({ username, password });
      // เก็บ JWT token ไว้ใน localStorage เพื่อให้ api.js แนบใน Authorization header อัตโนมัติ
      localStorage.setItem("adr_token", token);
      onLogin({ role: user.role, name: user.name, title: user.title });
    } catch (err) {
      setError(err.message || "Username หรือ Password ไม่ถูกต้อง");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.page}>

      {/* ── Left panel ── */}
      <div style={s.left}>
        {/* grid texture */}
        <div style={s.grid} />
        <div style={s.blob1} />
        <div style={s.blob2} />

        <div style={s.leftInner}>
          {/* Logo */}
          <div style={s.logoRow}>
            <div style={s.logoIcon}>
              <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
                <rect x="11" y="3" width="4" height="20" rx="2" fill="white" opacity=".9" />
                <rect x="3" y="11" width="20" height="4" rx="2" fill="white" opacity=".9" />
              </svg>
            </div>
            <div>
              <div style={s.logoName}>ADR Analytics System</div>
              <div style={s.logoDept}>โรงพยาบาลกรุงเทพสิริโรจน์ · ฝ่ายเภสัชกรรม</div>
            </div>
          </div>

          {/* Hero text */}
          <div style={{ marginTop: "auto" }}>
            <div style={s.tag}>Pharmacovigilance</div>
            <h1 style={s.heroTitle}>
              ระบบติดตามอาการ<br />
              ไม่พึงประสงค์จากยา
            </h1>
            <p style={s.heroSub}>
              บันทึก ประเมิน และวิเคราะห์ ADR<br />
              ในผู้ป่วยมะเร็งตามมาตรฐาน CTCAE
            </p>
          </div>

          {/* Footer */}
          <div style={s.leftFooter}>
            v2.0 · ADR-T System<br />
            ข้อมูลผู้ป่วยเป็นความลับตาม พ.ร.บ. สุขภาพแห่งชาติ
          </div>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div style={s.right}>
        <div style={s.formWrap}>

          <div style={s.eyebrow}>
            <div style={s.eyebrowDot} />
            <span style={s.eyebrowText}>Secure Login</span>
          </div>

          <h2 style={s.formHeading}>เข้าสู่ระบบ</h2>
          <p style={s.formDesc}>กรุณากรอกข้อมูลประจำตัวของท่าน</p>

          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

            <div>
              <label style={s.fieldLabel}>Username</label>
              <div style={{ position: "relative" }}>
                <svg style={s.fieldIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                  <path d="M4.5 20.118a7.5 7.5 0 0115 0" />
                </svg>
                <input
                  type="text"
                  placeholder="กรอก Username"
                  value={username}
                  onChange={(e) => { setUsername(e.target.value); setError(""); }}
                  style={s.input}
                  autoComplete="username"
                />
              </div>
            </div>

            <div>
              <label style={s.fieldLabel}>Password</label>
              <div style={{ position: "relative" }}>
                <svg style={s.fieldIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
                <input
                  type="password"
                  placeholder="กรอก Password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  style={s.input}
                  autoComplete="current-password"
                />
              </div>
            </div>

            {error && (
              <div style={s.errorBox}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c0392b" strokeWidth="2.5" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v4M12 16h.01" />
                </svg>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{ ...s.btn, opacity: loading ? 0.75 : 1, cursor: loading ? "not-allowed" : "pointer" }}
            >
              {loading ? (
                <span style={s.spinner} />
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3" />
                  </svg>
                  เข้าสู่ระบบ
                </>
              )}
            </button>

          </form>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@300;400;500;600;700&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

/* ── Styles ── */
const s = {
  page: {
    display: "flex",
    minHeight: "100vh",
    fontFamily: "'IBM Plex Sans Thai', 'Sarabun', 'Noto Sans Thai', sans-serif",
  },
  left: {
    width: "52%",
    background: "#0b2545",
    display: "flex",
    flexDirection: "column",
    position: "relative",
    overflow: "hidden",
  },
  grid: {
    position: "absolute",
    inset: 0,
    opacity: 0.07,
    backgroundImage:
      "linear-gradient(#5b8fc9 1px,transparent 1px),linear-gradient(90deg,#5b8fc9 1px,transparent 1px)",
    backgroundSize: "32px 32px",
    pointerEvents: "none",
  },
  blob1: {
    position: "absolute",
    bottom: "-80px",
    left: "-60px",
    width: "320px",
    height: "320px",
    borderRadius: "50%",
    background: "#1a4a8a",
    opacity: 0.35,
    pointerEvents: "none",
  },
  blob2: {
    position: "absolute",
    top: "-60px",
    right: "-80px",
    width: "220px",
    height: "220px",
    borderRadius: "50%",
    background: "#1e5aa0",
    opacity: 0.25,
    pointerEvents: "none",
  },
  leftInner: {
    position: "relative",
    zIndex: 1,
    display: "flex",
    flexDirection: "column",
    height: "100%",
    minHeight: "100vh",
    padding: "40px 44px",
  },
  logoRow: {
    display: "flex",
    alignItems: "center",
    gap: "13px",
    marginBottom: "48px",
  },
  logoIcon: {
    width: "48px",
    height: "48px",
    background: "#1a5cb8",
    borderRadius: "13px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid #2e6fcf",
    flexShrink: 0,
  },
  logoName: {
    color: "#fff",
    fontSize: "16px",
    fontWeight: 700,
    letterSpacing: "0.01em",
  },
  logoDept: {
    color: "#7aadda",
    fontSize: "12px",
    fontWeight: 400,
    marginTop: "2px",
  },
  tag: {
    display: "inline-block",
    background: "#1a4a8a",
    color: "#7bc4f0",
    fontSize: "11px",
    fontWeight: 600,
    letterSpacing: "0.1em",
    padding: "5px 13px",
    borderRadius: "100px",
    border: "1px solid #2563a0",
    marginBottom: "18px",
    textTransform: "uppercase",
  },
  heroTitle: {
    color: "#fff",
    fontSize: "30px",
    fontWeight: 700,
    lineHeight: 1.35,
    margin: "0 0 12px",
  },
  heroSub: {
    color: "#8ab4d4",
    fontSize: "13.5px",
    lineHeight: 1.75,
    margin: 0,
  },
  leftFooter: {
    color: "#3a6080",
    fontSize: "11px",
    borderTop: "1px solid rgba(255,255,255,.08)",
    paddingTop: "18px",
    marginTop: "auto",
    lineHeight: 1.6,
  },
  right: {
    flex: 1,
    background: "#f5f7fb",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "44px 40px",
  },
  formWrap: {
    width: "100%",
    maxWidth: "320px",
  },
  eyebrow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "24px",
  },
  eyebrowDot: {
    width: "8px",
    height: "8px",
    background: "#2563eb",
    borderRadius: "50%",
  },
  eyebrowText: {
    color: "#6b7a99",
    fontSize: "11px",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.09em",
  },
  formHeading: {
    color: "#0f1c35",
    fontSize: "26px",
    fontWeight: 700,
    margin: "0 0 5px",
  },
  formDesc: {
    color: "#7a8aaa",
    fontSize: "13px",
    lineHeight: 1.6,
    margin: "0 0 30px",
  },
  fieldLabel: {
    display: "block",
    fontSize: "11.5px",
    fontWeight: 600,
    color: "#3d4f6e",
    marginBottom: "6px",
    letterSpacing: "0.04em",
    textTransform: "uppercase",
  },
  fieldIcon: {
    position: "absolute",
    left: "14px",
    top: "50%",
    transform: "translateY(-50%)",
    width: "16px",
    height: "16px",
    color: "#9aa5be",
    pointerEvents: "none",
  },
  input: {
    width: "100%",
    padding: "12px 14px 12px 42px",
    border: "1.5px solid #dde3ef",
    borderRadius: "10px",
    fontSize: "14px",
    color: "#0f1c35",
    background: "#fff",
    fontFamily: "inherit",
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color .15s, box-shadow .15s",
  },
  errorBox: {
    display: "flex",
    alignItems: "center",
    gap: "7px",
    background: "#fff5f5",
    border: "1px solid #fca5a5",
    borderRadius: "8px",
    padding: "9px 12px",
    fontSize: "12px",
    color: "#c0392b",
    fontWeight: 500,
  },
  btn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    width: "100%",
    padding: "13px",
    background: "#1a47b8",
    color: "#fff",
    border: "none",
    borderRadius: "10px",
    fontSize: "14px",
    fontWeight: 700,
    fontFamily: "inherit",
    letterSpacing: "0.02em",
    marginTop: "6px",
    transition: "background .15s",
  },
  spinner: {
    width: "18px",
    height: "18px",
    border: "2px solid rgba(255,255,255,0.3)",
    borderTopColor: "white",
    borderRadius: "50%",
    display: "inline-block",
    animation: "spin 0.7s linear infinite",
  },
};