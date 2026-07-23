/**
 * Capa 2 — Ingestión: lectura de archivos del navegador a workbook SheetJS.
 */
import { IngestionError } from "./ingestion-error.js";
import { ensureXlsxReady } from "./xlsx-runtime.js";

const SUPPORTED_EXTENSIONS = new Set(["xlsx", "xls", "csv"]);

export function getFileExtension(fileName = "") {
  const parts = String(fileName).toLowerCase().split(".");
  return parts.length > 1 ? parts.at(-1) : "";
}

export function detectFileFormat(fileName = "") {
  const extension = getFileExtension(fileName);
  if (!SUPPORTED_EXTENSIONS.has(extension)) {
    throw new IngestionError(
      "UNSUPPORTED_FORMAT",
      "Formato no soportado. Use .xlsx o .csv.",
      { extension }
    );
  }
  return extension === "csv" ? "csv" : "xlsx";
}

export async function readFileAsWorkbook(file) {
  const XLSX = await ensureXlsxReady();
  const format = detectFileFormat(file?.name);

  const buffer = await file.arrayBuffer();
  const options = { type: "array" };
  if (format === "csv") {
    options.raw = false;
  } else {
    options.raw = false;
  }

  return XLSX.read(new Uint8Array(buffer), options);
}
