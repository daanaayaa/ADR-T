/**
 * ADR-T Backend Server
 * โรงพยาบาลกรุงเทพสิริโรจน์ · ฝ่ายเภสัชกรรม
 * ระบบติดตามอาการไม่พึงประสงค์จากยา (Pharmacovigilance)
 */

const express = require("express");
const cors    = require("cors");
const fs      = require("fs");
const path    = require("path");

const app = express();

// ─────────────────────────────────────────────
//  Middleware
// ─────────────────────────────────────────────

app.use(cors());
app.use(express.json());

// Simple request logger (สะดวกสำหรับ debug)
app.use((req, _res, next) => {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${req.method} ${req.path}`);
  next();
});

// ─────────────────────────────────────────────
//  File paths
// ─────────────────────────────────────────────

const DATA_DIR    = path.join(__dirname, "data");
const PATIENTS_F  = path.join(DATA_DIR, "patients.json");
const RECORDS_F   = path.join(DATA_DIR, "records.json");
const CTCAE_F     = path.join(DATA_DIR, "ctcae.json");

// สร้างโฟลเดอร์ data ถ้ายังไม่มี
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ─────────────────────────────────────────────
//  Helper: JSON I/O
// ─────────────────────────────────────────────

const readJSON = (file, fallback = []) => {
  try {
    if (!fs.existsSync(file)) return fallback;
    const raw = fs.readFileSync(file, "utf8").trim();
    return raw ? JSON.parse(raw) : fallback;
  } catch (err) {
    console.error(`[readJSON] ไม่สามารถอ่านไฟล์ ${file}:`, err.message);
    return fallback;
  }
};

const writeJSON = (file, data) => {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
  } catch (err) {
    console.error(`[writeJSON] ไม่สามารถเขียนไฟล์ ${file}:`, err.message);
    throw err;
  }
};

// ─────────────────────────────────────────────
//  Helper: Validation
// ─────────────────────────────────────────────

/**
 * ตรวจสอบ record ที่รับมาจาก frontend
 * ส่งคืน { ok: true } หรือ { ok: false, message }
 */
const validateRecord = (body) => {
  if (!body || typeof body !== "object")
    return { ok: false, message: "Request body ไม่ถูกต้อง" };
  if (!body.hn)
    return { ok: false, message: "กรุณาระบุ HN ของผู้ป่วย" };
  if (!body.date)
    return { ok: false, message: "กรุณาระบุวันที่บันทึก" };
  return { ok: true };
};

// ─────────────────────────────────────────────
//  Helper: Stats calculation
// ─────────────────────────────────────────────

const countGrade3Plus = (symptoms = {}) =>
  Object.values(symptoms).filter((v) => {
    const g = typeof v === "object" ? v?.grade : Number(v);
    return Number(g) >= 3;
  }).length;

const hasADR = (record) =>
  Object.values(record.symptoms || {}).some((v) => {
    if (v === null || v === undefined) return false;
    if (typeof v === "object") return v.grade != null;
    return true;
  });

// ─────────────────────────────────────────────
//  Root
// ─────────────────────────────────────────────

app.get("/", (_req, res) => {
  res.json({
    name:    "ADR-T Backend",
    version: "1.0.0",
    status:  "running",
    time:    new Date().toISOString(),
  });
});

// ─────────────────────────────────────────────
//  Patients
// ─────────────────────────────────────────────

/** GET /api/patients — ดึงรายชื่อผู้ป่วยทั้งหมด (รองรับ ?q= ค้นหา HN/ชื่อ) */
app.get("/api/patients", (req, res) => {
  const patients = readJSON(PATIENTS_F);
  const q = (req.query.q || "").toLowerCase().trim();

  const result = q
    ? patients.filter(
        (p) =>
          p.hn?.toLowerCase().includes(q) ||
          p.name?.toLowerCase().includes(q)
      )
    : patients;

  res.json(result);
});

/** GET /api/patients/:hn — ดึงข้อมูลผู้ป่วยรายบุคคลตาม HN */
app.get("/api/patients/:hn", (req, res) => {
  const patients = readJSON(PATIENTS_F);
  const patient  = patients.find((p) => p.hn === req.params.hn);

  if (!patient) {
    return res.status(404).json({ message: `ไม่พบผู้ป่วย HN: ${req.params.hn}` });
  }

  res.json(patient);
});

/** POST /api/patients — เพิ่มผู้ป่วยใหม่ */
app.post("/api/patients", (req, res) => {
  const patients = readJSON(PATIENTS_F);
  const { hn, name } = req.body || {};

  if (!hn || !name) {
    return res.status(400).json({ message: "กรุณาระบุ HN และชื่อผู้ป่วย" });
  }

  if (patients.find((p) => p.hn === hn)) {
    return res.status(409).json({ message: `HN ${hn} มีอยู่ในระบบแล้ว` });
  }

  const newPatient = { ...req.body, createdAt: new Date().toISOString() };
  patients.push(newPatient);
  writeJSON(PATIENTS_F, patients);

  res.status(201).json({ message: "เพิ่มผู้ป่วยสำเร็จ", patient: newPatient });
});

/** PUT /api/patients/:hn — แก้ไขข้อมูลผู้ป่วย */
app.put("/api/patients/:hn", (req, res) => {
  const patients = readJSON(PATIENTS_F);
  const index    = patients.findIndex((p) => p.hn === req.params.hn);

  if (index === -1) {
    return res.status(404).json({ message: `ไม่พบผู้ป่วย HN: ${req.params.hn}` });
  }

  patients[index] = {
    ...patients[index],
    ...req.body,
    hn:        patients[index].hn, // ป้องกันการเปลี่ยน HN
    updatedAt: new Date().toISOString(),
  };

  writeJSON(PATIENTS_F, patients);
  res.json({ message: "อัปเดตข้อมูลผู้ป่วยสำเร็จ", patient: patients[index] });
});

// ─────────────────────────────────────────────
//  CTCAE
// ─────────────────────────────────────────────

/** GET /api/ctcae — ดึงรายการ CTCAE ทั้งหมด (รองรับ ?q= ค้นหา) */
app.get("/api/ctcae", (req, res) => {
  const ctcae = readJSON(CTCAE_F);
  const q     = (req.query.q || "").toLowerCase().trim();

  if (!q) return res.json(ctcae);

  // ค้นหาตาม category หรือ term label
  const result = ctcae
    .map((category) => ({
      ...category,
      terms: (category.terms || []).filter((t) =>
        t.label?.toLowerCase().includes(q) ||
        t.key?.toLowerCase().includes(q)
      ),
    }))
    .filter((c) => c.terms.length > 0 || c.category?.toLowerCase().includes(q));

  res.json(result);
});

/** GET /api/ctcae/terms — ดึงเฉพาะ term ทั้งหมด (flat array) */
app.get("/api/ctcae/terms", (req, res) => {
  const ctcae = readJSON(CTCAE_F);
  const q     = (req.query.q || "").toLowerCase().trim();

  const terms = ctcae.flatMap((c) => c.terms || []);
  const result = q
    ? terms.filter(
        (t) =>
          t.label?.toLowerCase().includes(q) ||
          t.key?.toLowerCase().includes(q)
      )
    : terms;

  res.json(result);
});

// ─────────────────────────────────────────────
//  ADR Records
// ─────────────────────────────────────────────

/**
 * GET /api/records — ดึง ADR records ทั้งหมด
 * Query params:
 *   ?hn=    — กรองตาม HN
 *   ?month= — กรองตามเดือน (YYYY-MM)
 *   ?grade= — กรองเฉพาะที่มี grade >= ค่าที่ระบุ
 *   ?q=     — ค้นหาทั่วไป (HN / ชื่อ / regimen)
 */
app.get("/api/records", (req, res) => {
  let records = readJSON(RECORDS_F);
  const { hn, month, grade, q } = req.query;

  if (hn) {
    records = records.filter((r) => r.hn === hn);
  }

  if (month) {
    // month format: YYYY-MM
    records = records.filter((r) => r.date?.startsWith(month));
  }

  if (grade) {
    const minGrade = Number(grade);
    records = records.filter((r) =>
      Object.values(r.symptoms || {}).some((v) => {
        const g = typeof v === "object" ? v?.grade : Number(v);
        return Number(g) >= minGrade;
      })
    );
  }

  if (q) {
    const lq = q.toLowerCase();
    records = records.filter(
      (r) =>
        r.hn?.toLowerCase().includes(lq) ||
        r.patientName?.toLowerCase().includes(lq) ||
        r.regimen?.toLowerCase().includes(lq) ||
        r.note?.toLowerCase().includes(lq)
    );
  }

  // เรียงจากใหม่ไปเก่า
  records.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));

  res.json(records);
});

/** GET /api/records/:id — ดึง record รายบุคคล */
app.get("/api/records/:id", (req, res) => {
  const records = readJSON(RECORDS_F);
  const record  = records.find((r) => String(r.id) === req.params.id);

  if (!record) {
    return res.status(404).json({ message: `ไม่พบ record ID: ${req.params.id}` });
  }

  res.json(record);
});

/** POST /api/records — บันทึก ADR record ใหม่ */
app.post("/api/records", (req, res) => {
  const validation = validateRecord(req.body);
  if (!validation.ok) {
    return res.status(400).json({ message: validation.message });
  }

  const records = readJSON(RECORDS_F);

  const newRecord = {
    id:        Date.now(),
    ...req.body,
    createdAt: new Date().toISOString(),
  };

  records.push(newRecord);
  writeJSON(RECORDS_F, records);

  res.status(201).json({ message: "บันทึกข้อมูลสำเร็จ", record: newRecord });
});

/** PUT /api/records/:id — แก้ไข ADR record */
app.put("/api/records/:id", (req, res) => {
  const records = readJSON(RECORDS_F);
  const index   = records.findIndex((r) => String(r.id) === req.params.id);

  if (index === -1) {
    return res.status(404).json({ message: `ไม่พบ record ID: ${req.params.id}` });
  }

  records[index] = {
    ...records[index],
    ...req.body,
    id:        records[index].id,        // ป้องกันการเปลี่ยน ID
    createdAt: records[index].createdAt, // ป้องกันการเปลี่ยน timestamp เดิม
    updatedAt: new Date().toISOString(),
  };

  writeJSON(RECORDS_F, records);
  res.json({ message: "อัปเดตข้อมูลสำเร็จ", record: records[index] });
});

/** DELETE /api/records/:id — ลบ ADR record */
app.delete("/api/records/:id", (req, res) => {
  const records  = readJSON(RECORDS_F);
  const exists   = records.some((r) => String(r.id) === req.params.id);

  if (!exists) {
    return res.status(404).json({ message: `ไม่พบ record ID: ${req.params.id}` });
  }

  const filtered = records.filter((r) => String(r.id) !== req.params.id);
  writeJSON(RECORDS_F, filtered);

  res.json({ message: "ลบข้อมูลสำเร็จ" });
});

// ─────────────────────────────────────────────
//  Dashboard Stats
// ─────────────────────────────────────────────

/**
 * GET /api/stats — สถิติสรุปสำหรับ Dashboard
 * Query params:
 *   ?month= — YYYY-MM (ถ้าไม่ระบุ = เดือนปัจจุบัน)
 */
app.get("/api/stats", (req, res) => {
  const allRecords = readJSON(RECORDS_F);

  // เดือนที่เลือก (default = เดือนนี้)
  const month = req.query.month || new Date().toISOString().slice(0, 7);
  const prevMonth = (() => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 2, 1); // เดือนก่อนหน้า
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  })();

  const monthRecords = allRecords.filter((r) => r.date?.startsWith(month));
  const prevRecords  = allRecords.filter((r) => r.date?.startsWith(prevMonth));

  // ── Totals ──
  const totalRecords  = monthRecords.length;
  const totalADR      = monthRecords.filter(hasADR).length;
  const adrRate       = totalRecords > 0 ? totalADR / totalRecords : 0;
  const grade3Events  = monthRecords.reduce((sum, r) => sum + countGrade3Plus(r.symptoms), 0);
  const grade3Rate    = totalRecords > 0 ? (grade3Events / totalRecords) * 100 : 0;

  // ── Grade distribution (เดือนที่เลือก) ──
  const gradeDist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  monthRecords.forEach((r) => {
    Object.values(r.symptoms || {}).forEach((v) => {
      const g = typeof v === "object" ? v?.grade : Number(v);
      if (g >= 1 && g <= 5) gradeDist[g]++;
    });
  });

  // ── Symptom frequency (top 10) ──
  const sympFreq = {};
  monthRecords.forEach((r) => {
    Object.entries(r.symptoms || {}).forEach(([key, v]) => {
      if (!v || (typeof v === "object" && v.grade == null)) return;
      const label = typeof v === "object" ? (v.label || key) : key;
      sympFreq[label] = (sympFreq[label] || 0) + 1;
    });
  });
  const topSymptoms = Object.entries(sympFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));

  // ── Trend (6 เดือนย้อนหลัง) ──
  const trend = [];
  for (let i = 5; i >= 0; i--) {
    const [y, m] = month.split("-").map(Number);
    const d      = new Date(y, m - 1 - i, 1);
    const ym     = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const recs   = allRecords.filter((r) => r.date?.startsWith(ym));
    trend.push({
      month:        ym,
      totalRecords: recs.length,
      totalADR:     recs.filter(hasADR).length,
      grade3Events: recs.reduce((sum, r) => sum + countGrade3Plus(r.symptoms), 0),
    });
  }

  // ── Prev month comparison ──
  const prevTotal = prevRecords.length;
  const prevADR   = prevRecords.filter(hasADR).length;

  res.json({
    month,
    totalRecords,
    totalADR,
    adrRate:      parseFloat(adrRate.toFixed(4)),
    grade3Events,
    grade3Rate:   parseFloat(grade3Rate.toFixed(2)),
    gradeDist,
    topSymptoms,
    trend,
    prev: {
      month:        prevMonth,
      totalRecords: prevTotal,
      totalADR:     prevADR,
    },
    // สถิติรวมทั้งหมด (ทุกเดือน)
    allTime: {
      totalRecords: allRecords.length,
      totalADR:     allRecords.filter(hasADR).length,
      grade3Events: allRecords.reduce((sum, r) => sum + countGrade3Plus(r.symptoms), 0),
    },
  });
});

// ─────────────────────────────────────────────
//  Error Handler
// ─────────────────────────────────────────────

// 404
app.use((_req, res) => {
  res.status(404).json({ message: "ไม่พบ endpoint ที่ร้องขอ" });
});

// 500
app.use((err, _req, res, _next) => {
  console.error("[Server Error]", err);
  res.status(500).json({ message: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์", error: err.message });
});

// ─────────────────────────────────────────────
//  Start
// ─────────────────────────────────────────────

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log("─────────────────────────────────");
  console.log(`  ADR-T Backend  →  port ${PORT}`);
  console.log(`  Data dir       →  ${DATA_DIR}`);
  console.log("─────────────────────────────────");
});