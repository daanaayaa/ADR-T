import XLSX from "xlsx";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// =========================

const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);

// =========================

const EXCEL_PATH = path.join(
  __dirname,
  "../CTCAEv6_BSI.xlsx"
);

const OUTPUT_PATH = path.join(
  __dirname,
  "../src/data/ctcae.json"
);

// =========================

const workbook = XLSX.readFile(EXCEL_PATH);

const finalData = [];

workbook.SheetNames.forEach((sheetName) => {
  const sheet = workbook.Sheets[sheetName];

  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: false,
  });

  if (!rows.length) return;

  let startIndex = -1;

  rows.forEach((row, index) => {
    const text = row.join(" ").toLowerCase();

    if (
      text.includes("grade 1") &&
      text.includes("grade 2")
    ) {
      startIndex = index;
    }
  });

  if (startIndex === -1) return;

  const category = sheetName;

  const terms = [];

  for (let i = startIndex + 1; i < rows.length; i++) {
    const row = rows[i];

    if (!row || !row.length) continue;

    const symptom = row[0];

    if (!symptom || symptom === "-") continue;

    const options = [];

    for (let grade = 1; grade <= 5; grade++) {
      const value = row[grade];

      if (
        value &&
        value !== "-" &&
        value.trim() !== ""
      ) {
        options.push({
          grade,
          description: value.trim(),
        });
      }
    }

    if (!options.length) continue;

    terms.push({
      key: symptom
        .toLowerCase()
        .replace(/[^\w\s]/g, "")
        .replace(/\s+/g, "_"),

      label: symptom,

      type: "clinical",

      options,
    });
  }

  finalData.push({
    category,
    terms,
  });
});

// =========================

fs.writeFileSync(
  OUTPUT_PATH,
  JSON.stringify(finalData, null, 2),
  "utf-8"
);

console.log(
  "CTCAE JSON generated successfully"
);