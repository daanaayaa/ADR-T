/**
 * ADR-T Backend Server  (PostgreSQL edition)
 * โรงพยาบาลกรุงเทพสิริโรจน์ · ฝ่ายเภสัชกรรม
 * ระบบติดตามอาการไม่พึงประสงค์จากยา (Pharmacovigilance)
 *
 * Dependencies:
 *   npm install express cors pg bcrypt jsonwebtoken dotenv
 */

require("dotenv").config();

const express = require("express");
const cors    = require("cors");
const { Pool } = require("pg");
const bcrypt  = require("bcrypt");
const jwt     = require("jsonwebtoken");

const app = express();

// ─────────────────────────────────────────────
//  Middleware
// ─────────────────────────────────────────────

app.use(cors());
app.use(express.json());

app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ─────────────────────────────────────────────
//  Database Connection Pool (PostgreSQL)
// ─────────────────────────────────────────────

const pool = new Pool({
  host: process.env.PGHOST,
  port: process.env.PGPORT,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,

  ssl: {
    rejectUnauthorized: false,
  },

  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on("error", (err) =>
  console.error("[pg] Unexpected pool error:", err.message)
);

pool.query("SELECT NOW()")
  .then(() => {
    console.log("✅ Connected to Neon PostgreSQL");
  })
  .catch((err) => {
    console.error("❌ Neon Connection Error:", err.message);
  });
  
// ─────────────────────────────────────────────
//  Auth helpers
// ─────────────────────────────────────────────

const JWT_SECRET  = process.env.JWT_SECRET || "change_me_in_production";
const JWT_EXPIRES = process.env.JWT_EXPIRES || "8h";

function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

/** Middleware: ตรวจ JWT token จาก Authorization header */
function requireAuth(req, res, next) {
  const authHeader = req.headers["authorization"] || "";
  const token      = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ message: "กรุณาเข้าสู่ระบบก่อน" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: "Token หมดอายุหรือไม่ถูกต้อง" });
  }
}

/** Middleware: ตรวจว่า role เป็น pharmacist */
function requirePharmacist(req, res, next) {
  if (req.user?.role !== "pharmacist") {
    return res.status(403).json({ message: "เฉพาะเภสัชกรเท่านั้น" });
  }
  next();
}

// ─────────────────────────────────────────────
//  Helper: build symptoms upsert from payload
// ─────────────────────────────────────────────

/**
 * Insert symptoms array into adr_symptoms table
 * @param {pg.PoolClient} client
 * @param {string} recordId
 * @param {object} symptoms  { [key]: { grade, description, label, note, isCustom } }
 */
async function insertSymptoms(client, recordId, symptoms = {}) {
  // ลบของเก่าก่อน (กรณี update)
  await client.query("DELETE FROM adr_symptoms WHERE record_id = $1", [recordId]);

  for (const [key, val] of Object.entries(symptoms)) {
    if (!val || !val.grade) continue;

    if (val.isCustom) {
      await client.query(
        `INSERT INTO adr_symptoms (record_id, custom_key, custom_label, grade, description, note)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [recordId, key, val.label || key, val.grade, val.description || "", val.note || ""]
      );
    } else {
      // หา term_id จาก key
      const { rows } = await client.query(
        "SELECT id FROM ctcae_terms WHERE key = $1", [key]
      );
      const termId = rows[0]?.id || null;
      await client.query(
        `INSERT INTO adr_symptoms (record_id, term_id, custom_key, grade, description, note)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [recordId, termId, termId ? null : key, val.grade, val.description || "", val.note || ""]
      );
    }
  }
}

// ─────────────────────────────────────────────
//  Root
// ─────────────────────────────────────────────

app.get("/", (_req, res) => {
  res.json({ name: "ADR-T Backend (PostgreSQL)", version: "2.0.0", status: "running", time: new Date().toISOString() });
});

// ─────────────────────────────────────────────
//  AUTH
// ─────────────────────────────────────────────

/** POST /api/auth/login */
app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password)
    return res.status(400).json({ message: "กรุณาระบุ username และ password" });

  try {
    const { rows } = await pool.query(
      "SELECT * FROM users WHERE username = $1 AND is_active = TRUE", [username]
    );
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ message: "Username หรือ Password ไม่ถูกต้อง" });
    }
    const token = signToken(user);
    res.json({ token, user: { id: user.id, role: user.role, name: user.name, title: user.title } });
  } catch (err) {
    console.error("[login]", err.message);
    res.status(500).json({ message: "เกิดข้อผิดพลาด" });
  }
});

/** GET /api/auth/me */
app.get("/api/auth/me", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, username, role, name, title FROM users WHERE id = $1", [req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ message: "ไม่พบผู้ใช้" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────
//  PATIENTS
// ─────────────────────────────────────────────

/** GET /api/patients?q= */
app.get("/api/patients", requireAuth, async (req, res) => {
  const q = (req.query.q || "").trim();
  try {
    let query, params;
    if (q) {
      query  = `SELECT * FROM patients WHERE hn ILIKE $1 OR name ILIKE $1 ORDER BY name`;
      params = [`%${q}%`];
    } else {
      query  = `SELECT * FROM patients ORDER BY name`;
      params = [];
    }
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/** GET /api/patients/:hn */
app.get("/api/patients/:hn", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM patients WHERE hn = $1", [req.params.hn]);
    if (!rows[0]) return res.status(404).json({ message: `ไม่พบผู้ป่วย HN: ${req.params.hn}` });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/** POST /api/patients */
app.post("/api/patients", requireAuth, requirePharmacist, async (req, res) => {
  const { hn, name, age, gender, weight, height, diagnosis, allergy } = req.body || {};
  if (!hn || !name) return res.status(400).json({ message: "กรุณาระบุ HN และชื่อผู้ป่วย" });
  try {
    const { rows } = await pool.query(
      `INSERT INTO patients (hn, name, age, gender, weight, height, diagnosis, allergy)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (hn) DO NOTHING
       RETURNING *`,
      [hn, name, age, gender, weight, height, diagnosis, allergy]
    );
    if (!rows[0]) return res.status(409).json({ message: `HN ${hn} มีอยู่ในระบบแล้ว` });
    res.status(201).json({ message: "เพิ่มผู้ป่วยสำเร็จ", patient: rows[0] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/** PUT /api/patients/:hn */
app.put("/api/patients/:hn", requireAuth, requirePharmacist, async (req, res) => {
  const { name, age, gender, weight, height, diagnosis, allergy } = req.body || {};
  try {
    const { rows } = await pool.query(
      `UPDATE patients SET name=$1, age=$2, gender=$3, weight=$4, height=$5,
       diagnosis=$6, allergy=$7, updated_at=NOW()
       WHERE hn=$8 RETURNING *`,
      [name, age, gender, weight, height, diagnosis, allergy, req.params.hn]
    );
    if (!rows[0]) return res.status(404).json({ message: `ไม่พบผู้ป่วย HN: ${req.params.hn}` });
    res.json({ message: "อัปเดตข้อมูลผู้ป่วยสำเร็จ", patient: rows[0] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────
//  CTCAE
// ─────────────────────────────────────────────

/** GET /api/ctcae?q= — จัดกลุ่มตาม category */
app.get("/api/ctcae", requireAuth, async (req, res) => {
  const q = (req.query.q || "").trim();
  try {
    let termQuery, params;
    if (q) {
      termQuery = `SELECT t.*, c.category FROM ctcae_terms t
                   JOIN ctcae_categories c ON c.id = t.category_id
                   WHERE t.key ILIKE $1 OR t.label ILIKE $1
                   ORDER BY c.sort_order, t.label`;
      params = [`%${q}%`];
    } else {
      termQuery = `SELECT t.*, c.category FROM ctcae_terms t
                   JOIN ctcae_categories c ON c.id = t.category_id
                   ORDER BY c.sort_order, t.label`;
      params = [];
    }
    const { rows: terms } = await pool.query(termQuery, params);

    // ดึง grade descriptions
    const termIds = terms.map((t) => t.id);
    let gradeMap  = {};
    if (termIds.length) {
      const { rows: grades } = await pool.query(
        `SELECT * FROM ctcae_grade_descriptions WHERE term_id = ANY($1)`, [termIds]
      );
      grades.forEach((g) => {
        if (!gradeMap[g.term_id]) gradeMap[g.term_id] = [];
        gradeMap[g.term_id].push({ grade: g.grade, description: g.description });
      });
    }

    // Group by category
    const grouped = {};
    terms.forEach((t) => {
      if (!grouped[t.category]) grouped[t.category] = [];
      grouped[t.category].push({
        id:       t.id,
        key:      t.key,
        label:    t.label,
        isCustom: t.is_custom,
        options:  (gradeMap[t.id] || []).sort((a, b) => a.grade - b.grade),
      });
    });

    const result = Object.entries(grouped).map(([category, terms]) => ({ category, terms }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/** GET /api/ctcae/terms?q= — flat list */
app.get("/api/ctcae/terms", requireAuth, async (req, res) => {
  const q = (req.query.q || "").trim();
  const params = q ? [`%${q}%`] : [];
  const where  = q ? "WHERE t.key ILIKE $1 OR t.label ILIKE $1" : "";
  try {
    const { rows } = await pool.query(
      `SELECT t.id, t.key, t.label, t.is_custom, c.category
       FROM ctcae_terms t JOIN ctcae_categories c ON c.id = t.category_id
       ${where} ORDER BY t.label`,
      params
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────
//  ENCOUNTERS
// ─────────────────────────────────────────────

/** POST /api/encounters */
app.post("/api/encounters", requireAuth, async (req, res) => {
  const { hn, type, visit_date } = req.body || {};
  if (!hn || !type || !visit_date)
    return res.status(400).json({ message: "กรุณาระบุ hn, type และ visit_date" });
  try {
    const vn = type === "OPD" ? `VN-${Date.now()}` : null;
    const an = type === "IPD" ? `AN-${Date.now()}` : null;
    const { rows } = await pool.query(
      `INSERT INTO encounters (hn, type, vn, an, visit_date, created_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [hn, type, vn, an, visit_date, req.user.id]
    );
    res.status(201).json({ message: "สร้าง encounter สำเร็จ", encounter: rows[0] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/** GET /api/encounters?hn= */
app.get("/api/encounters", requireAuth, async (req, res) => {
  const { hn } = req.query;
  try {
    const { rows } = await pool.query(
      `SELECT * FROM encounters WHERE hn = $1 ORDER BY visit_date DESC`, [hn]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────
//  ADR RECORDS
// ─────────────────────────────────────────────

/** GET /api/records?hn=&month=&grade=&q= */
app.get("/api/records", requireAuth, async (req, res) => {
  const { hn, month, grade, q } = req.query;
  const conditions = [];
  const params     = [];

  if (hn) {
    params.push(hn);
    conditions.push(`v.hn = $${params.length}`);
  }
  if (month) {
    params.push(`${month}%`);
    conditions.push(`v.record_date::text LIKE $${params.length}`);
  }
  if (grade) {
    params.push(Number(grade));
    conditions.push(`v.max_grade >= $${params.length}`);
  }
  if (q) {
    params.push(`%${q}%`);
    conditions.push(`(v.hn ILIKE $${params.length} OR v.patient_name ILIKE $${params.length})`);
  }

  const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";

  try {
    const { rows } = await pool.query(
      `SELECT * FROM view_adr_summary v ${where} ORDER BY record_date DESC`, params
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/** GET /api/records/:id */
app.get("/api/records/:id", requireAuth, async (req, res) => {
  try {
    // record header
    const { rows: recs } = await pool.query(
      "SELECT * FROM view_adr_summary WHERE id = $1", [req.params.id]
    );
    if (!recs[0]) return res.status(404).json({ message: `ไม่พบ record ID: ${req.params.id}` });

    // symptoms detail
    const { rows: syms } = await pool.query(
      `SELECT s.*, t.key AS term_key, t.label AS term_label
       FROM adr_symptoms s LEFT JOIN ctcae_terms t ON t.id = s.term_id
       WHERE s.record_id = $1`, [req.params.id]
    );

    res.json({ ...recs[0], symptomsDetail: syms });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/** POST /api/records — บันทึก ADR record ใหม่ */
app.post("/api/records", requireAuth, async (req, res) => {
  const { hn, encounter_id, record_date, cycle, dose, dose_unit,
          drugs, symptoms, note, recommendation, follow_up_date } = req.body || {};

  if (!hn || !record_date) {
    return res.status(400).json({ message: "กรุณาระบุ hn และ record_date" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Insert header
    const { rows: recs } = await client.query(
      `INSERT INTO adr_records
         (encounter_id, hn, record_date, cycle, dose, dose_unit, note, recommendation, follow_up_date, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [encounter_id, hn, record_date, cycle, dose, dose_unit, note, recommendation, follow_up_date, req.user.id]
    );
    const recordId = recs[0].id;

    // 2. Insert drugs
    for (const drug of (drugs || [])) {
      await client.query(
        "INSERT INTO adr_record_drugs (record_id, drug_name) VALUES ($1, $2)",
        [recordId, drug]
      );
    }

    // 3. Insert symptoms
    await insertSymptoms(client, recordId, symptoms);

    await client.query("COMMIT");
    res.status(201).json({ message: "บันทึกข้อมูลสำเร็จ", id: recordId });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[POST /api/records]", err.message);
    res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
});

/** PUT /api/records/:id */
app.put("/api/records/:id", requireAuth, async (req, res) => {
  const { cycle, dose, dose_unit, drugs, symptoms, note, recommendation, follow_up_date } = req.body || {};
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rowCount } = await client.query(
      `UPDATE adr_records SET
         cycle=$1, dose=$2, dose_unit=$3, note=$4, recommendation=$5,
         follow_up_date=$6, updated_by=$7, updated_at=NOW()
       WHERE id=$8`,
      [cycle, dose, dose_unit, note, recommendation, follow_up_date, req.user.id, req.params.id]
    );

    if (!rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: `ไม่พบ record ID: ${req.params.id}` });
    }

    // update drugs
    await client.query("DELETE FROM adr_record_drugs WHERE record_id=$1", [req.params.id]);
    for (const drug of (drugs || [])) {
      await client.query(
        "INSERT INTO adr_record_drugs (record_id, drug_name) VALUES ($1,$2)",
        [req.params.id, drug]
      );
    }

    // update symptoms
    await insertSymptoms(client, req.params.id, symptoms);

    await client.query("COMMIT");
    res.json({ message: "อัปเดตข้อมูลสำเร็จ" });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
});

/** DELETE /api/records/:id */
app.delete("/api/records/:id", requireAuth, requirePharmacist, async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      "DELETE FROM adr_records WHERE id=$1", [req.params.id]
    );
    if (!rowCount) return res.status(404).json({ message: `ไม่พบ record ID: ${req.params.id}` });
    res.json({ message: "ลบข้อมูลสำเร็จ" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────
//  DASHBOARD STATS
// ─────────────────────────────────────────────

/** GET /api/stats?month=YYYY-MM */
app.get("/api/stats", requireAuth, async (req, res) => {
  const month = req.query.month || new Date().toISOString().slice(0, 7);
  const [y, m] = month.split("-").map(Number);
  const prevDate  = new Date(y, m - 2, 1);
  const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;

  try {
    // current month summary
    const { rows: cur } = await pool.query(
      `SELECT
         COUNT(DISTINCT r.id)                                AS total_records,
         COUNT(DISTINCT r.hn)                               AS unique_patients,
         COUNT(s.id)                                        AS total_adr_events,
         COUNT(s.id) FILTER (WHERE s.grade >= 3)           AS grade3_plus_events,
         COALESCE(SUM(CASE WHEN s.grade=1 THEN 1 ELSE 0 END),0) AS g1,
         COALESCE(SUM(CASE WHEN s.grade=2 THEN 1 ELSE 0 END),0) AS g2,
         COALESCE(SUM(CASE WHEN s.grade=3 THEN 1 ELSE 0 END),0) AS g3,
         COALESCE(SUM(CASE WHEN s.grade=4 THEN 1 ELSE 0 END),0) AS g4,
         COALESCE(SUM(CASE WHEN s.grade=5 THEN 1 ELSE 0 END),0) AS g5
       FROM adr_records r
       LEFT JOIN adr_symptoms s ON s.record_id = r.id
       WHERE TO_CHAR(r.record_date,'YYYY-MM') = $1`,
      [month]
    );

    // previous month
    const { rows: prev } = await pool.query(
      `SELECT COUNT(DISTINCT r.id) AS total_records,
              COUNT(s.id) FILTER (WHERE s.grade IS NOT NULL) AS total_adr_events
       FROM adr_records r
       LEFT JOIN adr_symptoms s ON s.record_id = r.id
       WHERE TO_CHAR(r.record_date,'YYYY-MM') = $1`,
      [prevMonth]
    );

    // top symptoms (current month)
    const { rows: topSymptoms } = await pool.query(
      `SELECT COALESCE(t.label, s.custom_label, s.custom_key) AS name, COUNT(*) AS count
       FROM adr_symptoms s
       JOIN adr_records r ON r.id = s.record_id
       LEFT JOIN ctcae_terms t ON t.id = s.term_id
       WHERE TO_CHAR(r.record_date,'YYYY-MM') = $1
       GROUP BY name ORDER BY count DESC LIMIT 10`,
      [month]
    );

    // 6-month trend
    const trend = [];
    for (let i = 5; i >= 0; i--) {
      const d  = new Date(y, m - 1 - i, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const { rows: t } = await pool.query(
        `SELECT COUNT(DISTINCT r.id) AS total_records,
                COUNT(s.id) FILTER (WHERE s.grade IS NOT NULL) AS total_adr,
                COUNT(s.id) FILTER (WHERE s.grade >= 3)        AS grade3_events
         FROM adr_records r
         LEFT JOIN adr_symptoms s ON s.record_id = r.id
         WHERE TO_CHAR(r.record_date,'YYYY-MM') = $1`,
        [ym]
      );
      trend.push({ month: ym, ...t[0] });
    }

    // all-time
    const { rows: allTime } = await pool.query(
      `SELECT COUNT(DISTINCT r.id) AS total_records,
              COUNT(s.id) FILTER (WHERE s.grade IS NOT NULL) AS total_adr,
              COUNT(s.id) FILTER (WHERE s.grade >= 3)        AS grade3_events
       FROM adr_records r
       LEFT JOIN adr_symptoms s ON s.record_id = r.id`
    );

    const c = cur[0];
    const totalRecords = Number(c.total_records);
    const totalADR     = Number(c.total_adr_events);
    const grade3Events = Number(c.grade3_plus_events);

    res.json({
      month,
      totalRecords,
      totalADR,
      uniquePatients: Number(c.unique_patients),
      adrRate:        totalRecords > 0 ? parseFloat((totalADR / totalRecords).toFixed(4)) : 0,
      grade3Events,
      grade3Rate:     totalRecords > 0 ? parseFloat(((grade3Events / totalRecords) * 100).toFixed(2)) : 0,
      gradeDist: { 1: Number(c.g1), 2: Number(c.g2), 3: Number(c.g3), 4: Number(c.g4), 5: Number(c.g5) },
      topSymptoms:    topSymptoms.map((r) => ({ name: r.name, count: Number(r.count) })),
      trend,
      prev: {
        month:        prevMonth,
        totalRecords: Number(prev[0]?.total_records || 0),
        totalADR:     Number(prev[0]?.total_adr_events || 0),
      },
      allTime: {
        totalRecords: Number(allTime[0]?.total_records || 0),
        totalADR:     Number(allTime[0]?.total_adr || 0),
        grade3Events: Number(allTime[0]?.grade3_events || 0),
      },
    });
  } catch (err) {
    console.error("[GET /api/stats]", err.message);
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────
//  Error handlers
// ─────────────────────────────────────────────

app.use((_req, res) => res.status(404).json({ message: "ไม่พบ endpoint ที่ร้องขอ" }));

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
  console.log(`  DB             →  ${process.env.PGHOST || "localhost"}/${process.env.PGDATABASE || "adrt_db"}`);
  console.log("─────────────────────────────────");
});