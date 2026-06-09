/**
 * ADR-T Backend Server  (MySQL Local edition)
 * โรงพยาบาลกรุงเทพสิริโรจน์ · ฝ่ายเภสัชกรรม
 * ระบบติดตามอาการไม่พึงประสงค์จากยา (Pharmacovigilance)
 *
 * Dependencies:
 *   npm install express cors mysql2 bcrypt jsonwebtoken dotenv
 */

require("dotenv").config();

const express = require("express");
const cors    = require("cors");
const mysql   = require("mysql2/promise");
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
//  Database Connection Pool (MySQL)
// ─────────────────────────────────────────────

const pool = mysql.createPool({
  host:               process.env.DB_HOST     || "localhost",
  port:               Number(process.env.DB_PORT) || 3306,
  database:           process.env.DB_NAME     || "adrt_db",
  user:               process.env.DB_USER     || "root",
  password:           process.env.DB_PASSWORD || "",
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
  // ส่ง DATE column กลับเป็น string ตรงๆ ไม่แปลงเป็น JS Date
  dateStrings:        true,
});

// ทดสอบ connection ตอนเริ่ม
(async () => {
  try {
    const conn = await pool.getConnection();
    await conn.query("SELECT 1");
    conn.release();
    console.log("✅ Connected to MySQL Local");
  } catch (err) {
    console.error("❌ MySQL Connection Error:", err.message);
  }
})();

// ─────────────────────────────────────────────
//  Auth helpers
// ─────────────────────────────────────────────

const JWT_SECRET  = process.env.JWT_SECRET  || "change_me_in_production";
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
//  Helper: insert symptoms
// ─────────────────────────────────────────────

/**
 * Insert symptoms array into adr_symptoms table
 * @param {mysql2.Connection} conn  — connection ที่อยู่ใน transaction
 * @param {string|number} recordId
 * @param {object} symptoms  { [key]: { grade, description, label, note, isCustom } }
 */
async function insertSymptoms(conn, recordId, symptoms = {}) {
  // ลบของเก่าก่อน (กรณี update)
  await conn.execute("DELETE FROM adr_symptoms WHERE record_id = ?", [recordId]);

  for (const [key, val] of Object.entries(symptoms)) {
    if (!val || !val.grade) continue;

    if (val.isCustom) {
      await conn.execute(
        `INSERT INTO adr_symptoms (record_id, custom_key, custom_label, grade, description, note, additional_detail)
         VALUES (?,?,?,?,?,?,?)`,
        [recordId, key, val.label || key, val.grade, val.description || "", val.note || "", val.additionalDetail || null]
      );
    } else {
      // หา term_id จาก key
      const [termRows] = await conn.execute(
        "SELECT id FROM ctcae_terms WHERE `key` = ?", [key]
      );
      const termId = termRows[0]?.id || null;
      await conn.execute(
        `INSERT INTO adr_symptoms (record_id, term_id, custom_key, grade, description, note, additional_detail)
         VALUES (?,?,?,?,?,?,?)`,
        [recordId, termId, termId ? null : key, val.grade, val.description || "", val.note || "", val.additionalDetail || null]
      );
    }
  }
}

// ─────────────────────────────────────────────
//  Root
// ─────────────────────────────────────────────

app.get("/", (_req, res) => {
  res.json({ name: "ADR-T Backend (MySQL)", version: "2.0.0", status: "running", time: new Date().toISOString() });
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
    const [rows] = await pool.execute(
      "SELECT * FROM users WHERE username = ? AND is_active = TRUE", [username]
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
    const [rows] = await pool.execute(
      "SELECT id, username, role, name, title FROM users WHERE id = ?", [req.user.id]
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
      // MySQL ใช้ LIKE (case-insensitive โดย default บน utf8mb4_general_ci)
      query = `
        SELECT *
        FROM patients
        WHERE hn LIKE ?
           OR patient_name LIKE ?
        ORDER BY patient_name
      `;
      params = [`%${q}%`, `%${q}%`];
    } else {
      query = `SELECT * FROM patients ORDER BY patient_name`;
      params = [];
    }

    const [rows] = await pool.execute(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/** GET /api/patients/:hn */
app.get("/api/patients/:hn", requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      "SELECT * FROM patients WHERE hn = ?",
      [req.params.hn]
    );
    if (!rows[0]) {
      return res.status(404).json({ message: `ไม่พบผู้ป่วย HN: ${req.params.hn}` });
    }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/** POST /api/patients */
app.post("/api/patients", requireAuth, requirePharmacist, async (req, res) => {
  const { hn, patient_name, age, gender, weight, height, diagnosis } = req.body || {};

  if (!hn || !patient_name) {
    return res.status(400).json({ message: "กรุณาระบุ HN และชื่อผู้ป่วย" });
  }

  try {
    // MySQL: INSERT IGNORE แทน ON CONFLICT DO NOTHING
    const [result] = await pool.execute(
      `INSERT IGNORE INTO patients (hn, patient_name, age, gender, weight, height, diagnosis)
       VALUES (?,?,?,?,?,?,?)`,
      [hn, patient_name, age, gender, weight, height, diagnosis]
    );

    if (result.affectedRows === 0) {
      return res.status(409).json({ message: `HN ${hn} มีอยู่ในระบบแล้ว` });
    }

    // MySQL ไม่มี RETURNING * → SELECT กลับหลัง INSERT
    const [newRows] = await pool.execute(
      "SELECT * FROM patients WHERE hn = ?", [hn]
    );
    res.status(201).json({ message: "เพิ่มผู้ป่วยสำเร็จ", patient: newRows[0] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/** PUT /api/patients/:hn */
app.put("/api/patients/:hn", requireAuth, requirePharmacist, async (req, res) => {
  const { patient_name, age, gender, weight, height, diagnosis } = req.body || {};

  try {
    const [result] = await pool.execute(
      `UPDATE patients
       SET patient_name=?, age=?, gender=?, weight=?, height=?, diagnosis=?, updated_at=NOW()
       WHERE hn=?`,
      [patient_name, age, gender, weight, height, diagnosis, req.params.hn]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: `ไม่พบผู้ป่วย HN: ${req.params.hn}` });
    }

    const [updated] = await pool.execute(
      "SELECT * FROM patients WHERE hn = ?", [req.params.hn]
    );
    res.json({ message: "อัปเดตข้อมูลผู้ป่วยสำเร็จ", patient: updated[0] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────
//  DRUGS
// ─────────────────────────────────────────────

app.get("/api/drugs", requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      "SELECT id, name FROM drugs WHERE is_active = TRUE ORDER BY name"
    );
    res.json(rows);
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
                   WHERE t.\`key\` LIKE ? OR t.label LIKE ?
                   ORDER BY c.sort_order, t.label`;
      params = [`%${q}%`, `%${q}%`];
    } else {
      termQuery = `SELECT t.*, c.category FROM ctcae_terms t
                   JOIN ctcae_categories c ON c.id = t.category_id
                   ORDER BY c.sort_order, t.label`;
      params = [];
    }
    const [terms] = await pool.execute(termQuery, params);

    // ดึง grade descriptions (MySQL ใช้ IN แทน ANY($1))
    const termIds = terms.map((t) => t.id);
    let gradeMap  = {};
    if (termIds.length) {
      const placeholders = termIds.map(() => "?").join(",");
      const [grades] = await pool.execute(
        `SELECT * FROM ctcae_grade_descriptions WHERE term_id IN (${placeholders})`,
        termIds
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
  try {
    let query, params;
    if (q) {
      query = `SELECT t.id, t.\`key\`, t.label, t.is_custom, c.category
               FROM ctcae_terms t JOIN ctcae_categories c ON c.id = t.category_id
               WHERE t.\`key\` LIKE ? OR t.label LIKE ?
               ORDER BY t.label`;
      params = [`%${q}%`, `%${q}%`];
    } else {
      query = `SELECT t.id, t.\`key\`, t.label, t.is_custom, c.category
               FROM ctcae_terms t JOIN ctcae_categories c ON c.id = t.category_id
               ORDER BY t.label`;
      params = [];
    }
    const [rows] = await pool.execute(query, params);
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
    const [result] = await pool.execute(
      `INSERT INTO encounters (hn, type, vn, an, visit_date, created_by)
       VALUES (?,?,?,?,?,?)`,
      [hn, type, vn, an, visit_date, req.user.id]
    );
    const encounterId = result.insertId;
    const [encRows] = await pool.execute(
      "SELECT * FROM encounters WHERE id = ?", [encounterId]
    );
    res.status(201).json({ message: "สร้าง encounter สำเร็จ", encounter: encRows[0] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/** GET /api/encounters?hn= */
app.get("/api/encounters", requireAuth, async (req, res) => {
  const { hn } = req.query;
  try {
    const [rows] = await pool.execute(
      `SELECT * FROM encounters WHERE hn = ? ORDER BY visit_date DESC`, [hn]
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
    conditions.push("v.hn = ?");
    params.push(hn);
  }
  if (month) {
    // MySQL: DATE_FORMAT แทน TO_CHAR, LIKE แทน CAST::text LIKE
    conditions.push("DATE_FORMAT(v.record_date, '%Y-%m') = ?");
    params.push(month);
  }
  if (grade) {
    conditions.push("v.max_grade >= ?");
    params.push(Number(grade));
  }
  if (q) {
    // LIKE ใช้ param เดียวกัน 2 ครั้ง
    conditions.push("(v.hn LIKE ? OR v.patient_name LIKE ?)");
    params.push(`%${q}%`, `%${q}%`);
  }

  const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";

  try {
    // 1. ดึง record headers จาก view
    const [rows] = await pool.execute(
      `SELECT
         v.id, v.hn, v.patient_name, v.record_date, v.cycle,
         v.dose, v.dose_unit, v.note, v.recommendation, v.follow_up_date,
         v.created_by, v.created_at, v.updated_at, v.drugs,
         v.max_grade, v.symptom_count, v.grade3_plus_count, v.symptoms,
         v.encounter_id, v.encounter_type, v.diagnosis,
         COALESCE(e.vn, e2.vn) AS vn,
         COALESCE(e.an, e2.an) AS an
       FROM view_adr_summary v
       LEFT JOIN encounters e  ON e.id = v.encounter_id
       LEFT JOIN encounters e2 ON e2.hn = v.hn
                               AND e2.visit_date = v.record_date
       ${where}
       ORDER BY v.record_date DESC`,
      params
    );

    if (rows.length === 0) return res.json([]);

    // 2. batch join adr_symptoms (MySQL: IN แทน ANY)
    const recordIds  = rows.map((r) => r.id);
    const phs        = recordIds.map(() => "?").join(",");
    const [allSyms]  = await pool.execute(
      `SELECT s.id, s.record_id, s.grade, s.description, s.note, s.additional_detail,
              s.custom_key, s.custom_label,
              t.\`key\` AS term_key, t.label AS term_label
       FROM adr_symptoms s
       LEFT JOIN ctcae_terms t ON t.id = s.term_id
       WHERE s.record_id IN (${phs})`,
      recordIds
    );

    // 3. group symptoms → map ตาม record_id
    const symsMap = {};
    allSyms.forEach((s) => {
      if (!symsMap[s.record_id]) symsMap[s.record_id] = [];
      symsMap[s.record_id].push(s);
    });

    // 4. แนบ symptomsDetail เข้าทุก record
    const result = rows.map((r) => ({
      ...r,
      symptomsDetail: symsMap[r.id] || [],
    }));

    res.json(result);
  } catch (err) {
    console.error("[GET /api/records]", err.message);
    res.status(500).json({ message: err.message });
  }
});

/** GET /api/records/:id */
app.get("/api/records/:id", requireAuth, async (req, res) => {
  try {
    const [recs] = await pool.execute(
      `SELECT
         v.id, v.hn, v.patient_name, v.record_date, v.cycle,
         v.dose, v.dose_unit, v.note, v.recommendation, v.follow_up_date,
         v.created_by, v.created_at, v.updated_at, v.drugs,
         v.max_grade, v.symptom_count, v.grade3_plus_count, v.symptoms,
         v.encounter_id, v.encounter_type, v.diagnosis,
         COALESCE(e.vn, e2.vn) AS vn,
         COALESCE(e.an, e2.an) AS an
       FROM view_adr_summary v
       LEFT JOIN encounters e  ON e.id = v.encounter_id
       LEFT JOIN encounters e2 ON e2.hn = v.hn
                               AND e2.visit_date = v.record_date
       WHERE v.id = ?`,
      [req.params.id]
    );
    if (!recs[0]) return res.status(404).json({ message: `ไม่พบ record ID: ${req.params.id}` });

    const [syms] = await pool.execute(
      `SELECT s.*, s.additional_detail, t.\`key\` AS term_key, t.label AS term_label
       FROM adr_symptoms s LEFT JOIN ctcae_terms t ON t.id = s.term_id
       WHERE s.record_id = ?`,
      [req.params.id]
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

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 0. ถ้าไม่มี encounter_id ให้หาจาก encounters ที่ตรง hn + visit_date
    let resolvedEncounterId = encounter_id || null;
    if (!resolvedEncounterId) {
      const [encRows] = await conn.execute(
        `SELECT id FROM encounters WHERE hn = ? AND visit_date = ? ORDER BY created_at DESC LIMIT 1`,
        [hn, record_date]
      );
      if (encRows[0]) resolvedEncounterId = encRows[0].id;
    }

    // 1. Insert header — MySQL: insertId แทน RETURNING id
    const [insertResult] = await conn.execute(
      `INSERT INTO adr_records
         (encounter_id, hn, record_date, cycle, dose, dose_unit, note, recommendation, follow_up_date, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [resolvedEncounterId, hn, record_date, cycle, dose, dose_unit, note, recommendation, follow_up_date, req.user.id]
    );
    const recordId = insertResult.insertId;

    // 2. Insert drugs
    for (const drug of (drugs || [])) {
      await conn.execute(
        "INSERT INTO adr_record_drugs (record_id, drug_name) VALUES (?, ?)",
        [recordId, drug]
      );
    }

    // 3. Insert symptoms
    await insertSymptoms(conn, recordId, symptoms);

    await conn.commit();
    res.status(201).json({ message: "บันทึกข้อมูลสำเร็จ", id: recordId });
  } catch (err) {
    await conn.rollback();
    console.error("[POST /api/records]", err.message);
    res.status(500).json({ message: err.message });
  } finally {
    conn.release();
  }
});

/** PUT /api/records/:id */
app.put("/api/records/:id", requireAuth, async (req, res) => {
  const { cycle, dose, dose_unit, drugs, symptoms, note, recommendation, follow_up_date } = req.body || {};
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [updateResult] = await conn.execute(
      `UPDATE adr_records SET
         cycle=?, dose=?, dose_unit=?, note=?, recommendation=?,
         follow_up_date=?, updated_by=?, updated_at=NOW()
       WHERE id=?`,
      [cycle, dose, dose_unit, note, recommendation, follow_up_date, req.user.id, req.params.id]
    );

    if (updateResult.affectedRows === 0) {
      await conn.rollback();
      return res.status(404).json({ message: `ไม่พบ record ID: ${req.params.id}` });
    }

    // update drugs
    await conn.execute("DELETE FROM adr_record_drugs WHERE record_id=?", [req.params.id]);
    for (const drug of (drugs || [])) {
      await conn.execute(
        "INSERT INTO adr_record_drugs (record_id, drug_name) VALUES (?,?)",
        [req.params.id, drug]
      );
    }

    // update symptoms
    await insertSymptoms(conn, req.params.id, symptoms);

    await conn.commit();
    res.json({ message: "อัปเดตข้อมูลสำเร็จ" });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ message: err.message });
  } finally {
    conn.release();
  }
});

/** POST /api/records/backfill-encounters */
app.post("/api/records/backfill-encounters", requireAuth, requirePharmacist, async (req, res) => {
  try {
    const [nullRecs] = await pool.execute(
      `SELECT id, hn, record_date FROM adr_records WHERE encounter_id IS NULL`
    );

    let fixed = 0;
    for (const rec of nullRecs) {
      const [enc] = await pool.execute(
        `SELECT id FROM encounters WHERE hn = ? AND visit_date = ? ORDER BY created_at DESC LIMIT 1`,
        [rec.hn, rec.record_date]
      );
      if (enc[0]) {
        await pool.execute(
          `UPDATE adr_records SET encounter_id = ? WHERE id = ?`,
          [enc[0].id, rec.id]
        );
        fixed++;
      }
    }

    res.json({ message: `backfill เสร็จ: แก้ไข ${fixed} / ${nullRecs.length} record` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/** DELETE /api/records/:id */
app.delete("/api/records/:id", requireAuth, requirePharmacist, async (req, res) => {
  try {
    const [result] = await pool.execute(
      "DELETE FROM adr_records WHERE id=?", [req.params.id]
    );
    if (result.affectedRows === 0)
      return res.status(404).json({ message: `ไม่พบ record ID: ${req.params.id}` });
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
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const month = req.query.month || defaultMonth;
  const [y, m] = month.split("-").map(Number);
  const prevDate  = new Date(y, m - 2, 1);
  const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;

  try {
    // MySQL: DATE_FORMAT แทน TO_CHAR
    // MySQL: SUM(CASE...) แทน COUNT(*) FILTER
    const [cur] = await pool.execute(
      `SELECT
         COUNT(DISTINCT r.id)                                              AS total_records,
         COUNT(DISTINCT r.hn)                                             AS unique_patients,
         COUNT(s.id)                                                      AS total_adr_events,
         SUM(CASE WHEN s.grade >= 3 THEN 1 ELSE 0 END)                  AS grade3_plus_events,
         COALESCE(SUM(CASE WHEN s.grade=1 THEN 1 ELSE 0 END),0)        AS g1,
         COALESCE(SUM(CASE WHEN s.grade=2 THEN 1 ELSE 0 END),0)        AS g2,
         COALESCE(SUM(CASE WHEN s.grade=3 THEN 1 ELSE 0 END),0)        AS g3,
         COALESCE(SUM(CASE WHEN s.grade=4 THEN 1 ELSE 0 END),0)        AS g4,
         COALESCE(SUM(CASE WHEN s.grade=5 THEN 1 ELSE 0 END),0)        AS g5
       FROM adr_records r
       LEFT JOIN adr_symptoms s ON s.record_id = r.id
       WHERE DATE_FORMAT(r.record_date,'%Y-%m') = ?`,
      [month]
    );

    const [prev] = await pool.execute(
      `SELECT COUNT(DISTINCT r.id) AS total_records,
              SUM(CASE WHEN s.grade IS NOT NULL THEN 1 ELSE 0 END) AS total_adr_events
       FROM adr_records r
       LEFT JOIN adr_symptoms s ON s.record_id = r.id
       WHERE DATE_FORMAT(r.record_date,'%Y-%m') = ?`,
      [prevMonth]
    );

    const [topSymptoms] = await pool.execute(
      `SELECT COALESCE(t.label, s.custom_label, s.custom_key) AS name, COUNT(*) AS count
       FROM adr_symptoms s
       JOIN adr_records r ON r.id = s.record_id
       LEFT JOIN ctcae_terms t ON t.id = s.term_id
       WHERE DATE_FORMAT(r.record_date,'%Y-%m') = ?
       GROUP BY name ORDER BY count DESC LIMIT 10`,
      [month]
    );

    // 6-month trend
    const trend = [];
    for (let i = 5; i >= 0; i--) {
      const d  = new Date(y, m - 1 - i, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const [t] = await pool.execute(
        `SELECT COUNT(DISTINCT r.id)                                        AS total_records,
                SUM(CASE WHEN s.grade IS NOT NULL THEN 1 ELSE 0 END)      AS total_adr,
                SUM(CASE WHEN s.grade >= 3 THEN 1 ELSE 0 END)             AS grade3_events
         FROM adr_records r
         LEFT JOIN adr_symptoms s ON s.record_id = r.id
         WHERE DATE_FORMAT(r.record_date,'%Y-%m') = ?`,
        [ym]
      );
      trend.push({ month: ym, ...t[0] });
    }

    const [allTime] = await pool.execute(
      `SELECT COUNT(DISTINCT r.id)                                        AS total_records,
              SUM(CASE WHEN s.grade IS NOT NULL THEN 1 ELSE 0 END)      AS total_adr,
              SUM(CASE WHEN s.grade >= 3 THEN 1 ELSE 0 END)             AS grade3_events
       FROM adr_records r
       LEFT JOIN adr_symptoms s ON s.record_id = r.id`
    );

    const c = cur[0];
    const totalRecords = Number(c.total_records);
    const totalADR     = Number(c.total_adr_events);
    const grade3Events = Number(c.grade3_plus_events || 0);

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
//  REPORT
// ─────────────────────────────────────────────

/** GET /api/report/available-years */
app.get("/api/report/available-years", requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT DISTINCT YEAR(record_date) AS year
       FROM adr_records
       ORDER BY year DESC`
    );
    res.json(rows.map((r) => r.year));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/** GET /api/report/symptoms?year=&month= */
app.get("/api/report/symptoms", requireAuth, async (req, res) => {
  const { year, month } = req.query;
  const conditions = [];
  const params     = [];

  if (year) {
    conditions.push("YEAR(r.record_date) = ?");
    params.push(Number(year));
  }
  if (month) {
    conditions.push("DATE_FORMAT(r.record_date, '%Y-%m') = ?");
    params.push(month);
  }

  const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";

  try {
    const [rows] = await pool.execute(
      `SELECT
         COALESCE(t.label, s.custom_label, s.custom_key) AS symptom,
         s.grade,
         COUNT(*) AS count
       FROM adr_symptoms s
       JOIN adr_records r ON r.id = s.record_id
       LEFT JOIN ctcae_terms t ON t.id = s.term_id
       ${where}
       GROUP BY symptom, s.grade
       ORDER BY symptom, s.grade`,
      params
    );
    res.json(rows);
  } catch (err) {
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
  console.log(`  DB             →  ${process.env.DB_HOST || "localhost"}/${process.env.DB_NAME || "adrt_db"}`);
  console.log("─────────────────────────────────");
});