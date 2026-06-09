/**
 * services/api.js
 * ADR-T System — Frontend API Service Layer
 * โรงพยาบาลกรุงเทพสิริโรจน์ · ฝ่ายเภสัชกรรม
 *
 * ครอบ fetch ทุก request ไว้ที่นี่ ทำให้ component ไม่ต้องรู้จัก URL โดยตรง
 * เปลี่ยน BASE_URL ใน .env เพื่อสลับ environment
 */

// ─────────────────────────────────────────────
//  Config
// ─────────────────────────────────────────────

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

// ─────────────────────────────────────────────
//  Core fetch wrapper
// ─────────────────────────────────────────────

/**
 * ส่ง HTTP request พร้อม error handling กลาง
 * @param {string} path   — เช่น '/api/patients'
 * @param {RequestInit} options
 * @returns {Promise<any>} parsed JSON
 */
async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;

  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  // ถ้ามี token ให้แนบ Authorization header อัตโนมัติ
  const token = localStorage.getItem("adr_token");
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(url, { ...options, headers });
  } catch (err) {
    throw new Error(`Network error: ไม่สามารถเชื่อมต่อ server ได้ (${err.message})`);
  }

  if (!res.ok) {
    let errMsg = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      errMsg = body.message || errMsg;
    } catch (_) {}
    throw new Error(errMsg);
  }

  // 204 No Content — ไม่มี body
  if (res.status === 204) return null;

  return res.json();
}

// shorthand helpers
const get    = (path, params) => {
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  return request(`${path}${qs}`, { method: "GET" });
};
const post   = (path, body)   => request(path, { method: "POST",   body: JSON.stringify(body) });
const put    = (path, body)   => request(path, { method: "PUT",    body: JSON.stringify(body) });
const del    = (path)         => request(path, { method: "DELETE" });

// ═══════════════════════════════════════════════════════════════
//  AUTH
// ═══════════════════════════════════════════════════════════════

export const authApi = {
  /**
   * เข้าสู่ระบบ
   * @param {{ username: string, password: string }} credentials
   * @returns {{ token: string, user: { role, name, title } }}
   */
  login: (credentials) => post("/api/auth/login", credentials),

  /** ออกจากระบบ (ล้าง token ฝั่ง client) */
  logout: () => {
    localStorage.removeItem("adr_token");
    return Promise.resolve();
  },

  /** ดึงข้อมูล user ปัจจุบัน (ใช้ token) */
  me: () => get("/api/auth/me"),
};

// ═══════════════════════════════════════════════════════════════
//  PATIENTS
// ═══════════════════════════════════════════════════════════════

export const patientApi = {
  /**
   * ดึงรายชื่อผู้ป่วยทั้งหมด / ค้นหา
   * @param {{ q?: string }} params
   */
  getAll: (params = {}) => get("/api/patients", params),

  /**
   * ดึงข้อมูลผู้ป่วยรายบุคคล
   * @param {string} hn
   */
  getByHN: (hn) => get(`/api/patients/${encodeURIComponent(hn)}`),

  /**
   * เพิ่มผู้ป่วยใหม่
   * @param {{ hn, name, age, gender, weight, height, diagnosis, allergy }} data
   */
  create: (data) => post("/api/patients", data),

  /**
   * แก้ไขข้อมูลผู้ป่วย
   * @param {string} hn
   * @param {object} data
   */
  update: (hn, data) => put(`/api/patients/${encodeURIComponent(hn)}`, data),
};

// ═══════════════════════════════════════════════════════════════
//  CTCAE
// ═══════════════════════════════════════════════════════════════

export const ctcaeApi = {
  /**
   * ดึงข้อมูล CTCAE ทั้งหมด (จัดกลุ่มตาม category)
   * @param {{ q?: string }} params
   */
  getAll: (params = {}) => get("/api/ctcae", params),

  /**
   * ดึงเฉพาะ term list (flat array)
   * @param {{ q?: string }} params
   */
  getTerms: (params = {}) => get("/api/ctcae/terms", params),
};

// ═══════════════════════════════════════════════════════════════
//  ENCOUNTERS
// ═══════════════════════════════════════════════════════════════

export const encounterApi = {
  /**
   * สร้าง encounter ใหม่ (OPD / IPD)
   * @param {{ hn, type, visit_date }} data
   */
  create: (data) => post("/api/encounters", data),

  /**
   * ดึง encounter ทั้งหมดของผู้ป่วย
   * @param {string} hn
   */
  getByHN: (hn) => get("/api/encounters", { hn }),
};

// ═══════════════════════════════════════════════════════════════
//  ADR RECORDS
// ═══════════════════════════════════════════════════════════════

export const recordApi = {
  /**
   * ดึง ADR records
   * @param {{ hn?, month?, year?, grade?, q? }} params
   *   year  — ดึงทั้งปี (ใช้ใน Report page)   format: YYYY
   *   month — ดึงเฉพาะเดือน (Dashboard/Records) format: YYYY-MM
   * @returns {Promise<AdrRecord[]>}  รวม symptoms object ทุก record
   */
  getAll: (params = {}) => get("/api/records", params),

  /**
   * ดึง record รายบุคคล
   * @param {string} id
   */
  getById: (id) => get(`/api/records/${id}`),

  /**
   * บันทึก ADR record ใหม่
   *
   * body shape (ตรงกับ Step1 + Step2):
   * {
   *   hn, encounter_id, record_date,
   *   cycle, dose, dose_unit,
   *   drugs: string[],
   *   symptoms: {
   *     [key: string]: { grade: number, description: string, note?: string }
   *                  | null  (ถ้าไม่มีอาการ)
   *   },
   *   note, recommendation, follow_up_date
   * }
   *
   * @param {object} data
   */
  create: (data) => post("/api/records", data),

  /**
   * แก้ไข ADR record
   * @param {string} id
   * @param {object} data
   */
  update: (id, data) => put(`/api/records/${id}`, data),

  /**
   * ลบ ADR record
   * @param {string} id
   */
  delete: (id) => del(`/api/records/${id}`),
};

// ═══════════════════════════════════════════════════════════════
//  DASHBOARD / STATS
// ═══════════════════════════════════════════════════════════════

export const statsApi = {
  /**
   * ดึงสถิติสรุปสำหรับ Dashboard
   * @param {{ month?: string }} params  — month format: 'YYYY-MM'
   * @returns {{
   *   month, totalRecords, totalADR, adrRate,
   *   grade3Events, grade3Rate,
   *   gradeDist: { 1, 2, 3, 4, 5 },
   *   topSymptoms: { name, count }[],
   *   trend: { month, totalRecords, totalADR, grade3Events }[],
   *   prev: { month, totalRecords, totalADR },
   *   allTime: { totalRecords, totalADR, grade3Events }
   * }}
   */
  getDashboard: (params = {}) => get("/api/stats", params),
};

// ═══════════════════════════════════════════════════════════════
//  REPORT
// ═══════════════════════════════════════════════════════════════

export const reportApi = {
  /**
   * ดึงปีที่มีข้อมูลทั้งหมด
   * @returns {Promise<number[]>}
   */
  getAvailableYears: () => get("/api/report/available-years"),

  /**
   * ดึง pre-aggregated symptom matrix สำหรับ SymptomMatrix component
   * @param {{ year: number, grade?: string }} params
   * @returns {{ matrix, symptomTotals, monthTotals, grandTotal }}
   */
  getSymptoms: (params = {}) => get("/api/report/symptoms", params),
};

// ═══════════════════════════════════════════════════════════════
//  UTILITY HELPERS
//  ใช้ใน component เพื่อ normalise/prepare data ก่อนส่ง API
// ═══════════════════════════════════════════════════════════════

/**
 * แปลง state ของ Step1 + Step2 เป็น body สำหรับ recordApi.create / update
 *
 * @param {{
 *   patient: object,
 *   encounter: object,
 *   vital: { date, cycle, dose, doseUnit, drugs: string[] },
 *   symptoms: object,   // จาก Step2 state
 *   note: string,
 *   recommendation: string,
 *   followUpDate: string,
 * }} formState
 */
export function buildRecordPayload({ patient, encounter, vital, symptoms, note, recommendation, followUpDate }) {
  // normalise symptoms: กรองเฉพาะที่มี grade (ไม่ใช่ null)
  const normSymptoms = {};
  Object.entries(symptoms || {}).forEach(([key, val]) => {
    if (!val) return;
    const grade = typeof val === "object" ? val.grade : Number(val);
    if (!grade) return;
    normSymptoms[key] = {
      grade,
      description:      (typeof val === "object" ? val.description      : undefined) || "",
      label:            (typeof val === "object" ? val.label             : undefined) || key,
      note:             (typeof val === "object" ? val.note              : undefined) || "",
      isCustom:         (typeof val === "object" ? val.isCustom          : false),
      additionalDetail: (typeof val === "object" ? val.additionalDetail  : undefined) || "",
    };
  });

  return {
    hn:              patient?.hn,
    encounter_id:    encounter?.id,
    record_date:     vital?.date,
    cycle:           vital?.cycle ? Number(vital.cycle) : undefined,
    dose:            vital?.dose  ? Number(vital.dose)  : undefined,
    dose_unit:       vital?.doseUnit || undefined,
    drugs:           vital?.drugs || [],
    symptoms:        normSymptoms,
    note:            note            || "",
    recommendation:  recommendation  || "",
    follow_up_date:  followUpDate    || undefined,
  };
}

/**
 * คำนวณ BSA (Mosteller formula)
 * @param {number|string} weight  kg
 * @param {number|string} height  cm
 * @returns {string|""}  ทศนิยม 2 ตำแหน่ง หรือ "" ถ้าข้อมูลไม่ครบ
 */
export function calcBSA(weight, height) {
  const w = parseFloat(weight);
  const h = parseFloat(height);
  if (!w || !h) return "";
  return Math.sqrt((w * h) / 3600).toFixed(2);
}

/**
 * ตรวจสอบว่า record มี ADR หรือไม่
 * @param {{ symptoms: object }} record
 */
export function hasADR(record) {
  return Object.values(record?.symptoms || {}).some((v) => {
    if (v === null || v === undefined) return false;
    if (typeof v === "object") return v.grade != null;
    return true;
  });
}

export const drugsApi = {
  getAll: () => get("/api/drugs"),
  /** เพิ่มยานอกบัญชีใหม่ (บันทึกลง DB ถาวร) */
  create: (name) => post("/api/drugs", { name }),
};

/**
 * นับจำนวนอาการที่ grade >= 3
 * @param {{ symptoms: object }} record
 */
export function countGrade3Plus(record) {
  return Object.values(record?.symptoms || {}).filter((v) => {
    const g = typeof v === "object" ? v?.grade : Number(v);
    return Number(g) >= 3;
  }).length;
}