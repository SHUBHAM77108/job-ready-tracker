import Papa from "papaparse";
import * as XLSX from "xlsx";
import { makeId } from "../utils/dates";

const normalizeTime = (value) => {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value === "number" && value >= 0 && value < 1) {
    const total = Math.round(value * 1440);
    return `${String(Math.floor(total/60)%24).padStart(2,"0")}:${String(total%60).padStart(2,"0")}`;
  }
  const text = String(value).trim();
  if (/^\d{1,2}:\d{2}$/.test(text)) return text.padStart(5,"0");
  const match = text.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (match) {
    let hour = Number(match[1]) % 12;
    if (match[3].toUpperCase() === "PM") hour += 12;
    return `${String(hour).padStart(2,"0")}:${match[2] || "00"}`;
  }
  return "";
};
const find = (row, names) => {
  const key = Object.keys(row).find(k => names.includes(k.toLowerCase().trim()));
  return key ? row[key] : "";
};
export async function parseScheduleFile(file) {
  const extension = file.name.split(".").pop().toLowerCase();
  let rows = [];
  if (extension === "csv" || extension === "txt") {
    const parsed = Papa.parse(await file.text(), {header:true, skipEmptyLines:true});
    if (parsed.errors.length) throw new Error(parsed.errors[0].message);
    rows = parsed.data;
  } else if (["xlsx","xls"].includes(extension)) {
    const workbook = XLSX.read(await file.arrayBuffer(), {type:"array"});
    const first = workbook.Sheets[workbook.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(first, {defval:""});
  } else {
    throw new Error("Please choose a CSV, XLSX or XLS file.");
  }
  if (!rows.length) throw new Error("No rows found. Check the first sheet and column headers.");
  return {
    fileName: file.name,
    rows: rows.map((row, index) => ({
      id: `row-${index}-${makeId()}`,
      title: String(find(row, ["topic","roadmap topic","task","task name","activity","title","name"]) || ""),
      start: normalizeTime(find(row, ["start","start time","from"])),
      end: normalizeTime(find(row, ["end","end time","to"])),
      description: String(find(row, ["description","notes","details"]) || ""),
      day: String(find(row, ["day","day number","roadmap day"]) || ""),
      raw: row
    }))
  };
}
