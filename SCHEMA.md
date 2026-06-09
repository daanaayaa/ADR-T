-- ============================================================
--  ADR-T  ·  MySQL Local Schema
--  โรงพยาบาลกรุงเทพสิริโรจน์ · ฝ่ายเภสัชกรรม
--  แปลงจาก PostgreSQL → MySQL 8.0+
-- ============================================================

CREATE DATABASE IF NOT EXISTS adrt_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE adrt_db;

-- ── 1. users ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            INT            NOT NULL AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(50)    NOT NULL UNIQUE,
  password_hash VARCHAR(255)   NOT NULL,
  role          ENUM('pharmacist','doctor','nurse') NOT NULL DEFAULT 'nurse',
  name          VARCHAR(100)   NOT NULL,
  title         VARCHAR(50)    DEFAULT NULL,
  is_active     TINYINT(1)     NOT NULL DEFAULT 1,
  created_at    DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ── 2. patients ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS patients (
  hn            VARCHAR(20)    NOT NULL PRIMARY KEY,
  patient_name  VARCHAR(150)   NOT NULL,
  age           INT            DEFAULT NULL,
  gender        VARCHAR(10)    DEFAULT NULL,
  weight        DECIMAL(6,2)   DEFAULT NULL,
  height        DECIMAL(6,2)   DEFAULT NULL,
  diagnosis     TEXT           DEFAULT NULL,
  created_at    DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ── 3. encounters ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS encounters (
  id            INT            NOT NULL AUTO_INCREMENT PRIMARY KEY,
  hn            VARCHAR(20)    NOT NULL,
  type          ENUM('OPD','IPD') NOT NULL DEFAULT 'OPD',
  vn            VARCHAR(30)    DEFAULT NULL,
  an            VARCHAR(30)    DEFAULT NULL,
  visit_date    DATE           NOT NULL,
  created_by    INT            DEFAULT NULL,
  created_at    DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_enc_patient  FOREIGN KEY (hn)         REFERENCES patients(hn)  ON DELETE CASCADE,
  CONSTRAINT fk_enc_user     FOREIGN KEY (created_by) REFERENCES users(id)     ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE INDEX idx_enc_hn_date ON encounters(hn, visit_date);

-- ── 4. drugs ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS drugs (
  id          INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(200) NOT NULL UNIQUE,
  is_active   TINYINT(1)   NOT NULL DEFAULT 1,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ── 5. ctcae_categories ───────────────────────────────────
CREATE TABLE IF NOT EXISTS ctcae_categories (
  id          INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  category    VARCHAR(100) NOT NULL UNIQUE,
  sort_order  INT          NOT NULL DEFAULT 0
) ENGINE=InnoDB;

-- ── 6. ctcae_terms ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ctcae_terms (
  id          INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  category_id INT          NOT NULL,
  `key`       VARCHAR(100) NOT NULL UNIQUE,
  label       VARCHAR(200) NOT NULL,
  is_custom   TINYINT(1)   NOT NULL DEFAULT 0,
  CONSTRAINT fk_term_cat FOREIGN KEY (category_id) REFERENCES ctcae_categories(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ── 7. ctcae_grade_descriptions ───────────────────────────
CREATE TABLE IF NOT EXISTS ctcae_grade_descriptions (
  id          INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  term_id     INT          NOT NULL,
  grade       TINYINT      NOT NULL,
  description TEXT         DEFAULT NULL,
  UNIQUE KEY uq_term_grade (term_id, grade),
  CONSTRAINT fk_grade_term FOREIGN KEY (term_id) REFERENCES ctcae_terms(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ── 8. adr_records ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS adr_records (
  id              INT            NOT NULL AUTO_INCREMENT PRIMARY KEY,
  encounter_id    INT            DEFAULT NULL,
  hn              VARCHAR(20)    NOT NULL,
  record_date     DATE           NOT NULL,
  cycle           VARCHAR(20)    DEFAULT NULL,
  dose            DECIMAL(10,2)  DEFAULT NULL,
  dose_unit       VARCHAR(20)    DEFAULT NULL,
  note            TEXT           DEFAULT NULL,
  recommendation  TEXT           DEFAULT NULL,
  follow_up_date  DATE           DEFAULT NULL,
  created_by      INT            DEFAULT NULL,
  updated_by      INT            DEFAULT NULL,
  created_at      DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_rec_patient  FOREIGN KEY (hn)           REFERENCES patients(hn)  ON DELETE CASCADE,
  CONSTRAINT fk_rec_enc      FOREIGN KEY (encounter_id) REFERENCES encounters(id) ON DELETE SET NULL,
  CONSTRAINT fk_rec_creator  FOREIGN KEY (created_by)   REFERENCES users(id)     ON DELETE SET NULL,
  CONSTRAINT fk_rec_updater  FOREIGN KEY (updated_by)   REFERENCES users(id)     ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE INDEX idx_rec_hn_date ON adr_records(hn, record_date);

-- ── 9. adr_record_drugs ───────────────────────────────────
CREATE TABLE IF NOT EXISTS adr_record_drugs (
  id          INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  record_id   INT          NOT NULL,
  drug_name   VARCHAR(200) NOT NULL,
  CONSTRAINT fk_rdrug_rec FOREIGN KEY (record_id) REFERENCES adr_records(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ── 10. adr_symptoms ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS adr_symptoms (
  id                INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  record_id         INT          NOT NULL,
  term_id           INT          DEFAULT NULL,
  custom_key        VARCHAR(100) DEFAULT NULL,
  custom_label      VARCHAR(200) DEFAULT NULL,
  grade             TINYINT      NOT NULL,
  description       TEXT         DEFAULT NULL,
  note              TEXT         DEFAULT NULL,
  additional_detail TEXT         DEFAULT NULL,
  CONSTRAINT fk_sym_rec  FOREIGN KEY (record_id) REFERENCES adr_records(id)  ON DELETE CASCADE,
  CONSTRAINT fk_sym_term FOREIGN KEY (term_id)   REFERENCES ctcae_terms(id)  ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE INDEX idx_sym_record ON adr_symptoms(record_id);

-- ══════════════════════════════════════════════════════════
--  VIEWs
-- ══════════════════════════════════════════════════════════

-- view_adr_summary: สรุปแต่ละ record พร้อม max_grade, drug list, symptom summary
CREATE OR REPLACE VIEW view_adr_summary AS
SELECT
  r.id,
  r.hn,
  p.patient_name,
  p.diagnosis,
  r.record_date,
  r.cycle,
  r.dose,
  r.dose_unit,
  r.note,
  r.recommendation,
  r.follow_up_date,
  r.created_by,
  r.created_at,
  r.updated_at,
  r.encounter_id,
  e.type                                           AS encounter_type,
  -- รายชื่อยา: GROUP_CONCAT แทน STRING_AGG ของ PostgreSQL
  (SELECT GROUP_CONCAT(d.drug_name ORDER BY d.drug_name SEPARATOR ', ')
   FROM adr_record_drugs d WHERE d.record_id = r.id)            AS drugs,
  -- max grade
  (SELECT MAX(s.grade) FROM adr_symptoms s WHERE s.record_id = r.id)          AS max_grade,
  -- symptom count
  (SELECT COUNT(*) FROM adr_symptoms s WHERE s.record_id = r.id)              AS symptom_count,
  -- grade 3+ count
  (SELECT COUNT(*) FROM adr_symptoms s WHERE s.record_id = r.id AND s.grade >= 3) AS grade3_plus_count,
  -- symptoms JSON: GROUP_CONCAT เป็น key=grade สำหรับ backward compat
  (SELECT GROUP_CONCAT(
            CONCAT(COALESCE(t2.`key`, s2.custom_key), ':', s2.grade)
            ORDER BY s2.id SEPARATOR ';')
   FROM adr_symptoms s2
   LEFT JOIN ctcae_terms t2 ON t2.id = s2.term_id
   WHERE s2.record_id = r.id)                                   AS symptoms
FROM adr_records r
JOIN patients p    ON p.hn = r.hn
LEFT JOIN encounters e ON e.id = r.encounter_id;

-- ══════════════════════════════════════════════════════════
--  Seed: default pharmacist user
--  password = "admin1234"  (bcrypt $2b$10$...)
--  *** เปลี่ยน password ก่อน production ***
-- ══════════════════════════════════════════════════════════

INSERT IGNORE INTO users (username, password_hash, role, name, title)
VALUES (
  'pharmacist01',
  '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',  -- "password"
  'pharmacist',
  'เภสัชกร ทดสอบ',
  'ภ.บ.'
);