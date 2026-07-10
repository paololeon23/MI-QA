/**
 * Capa 2 — Ingestión: conversión de hoja Excel/CSV a matriz bidimensional.
 */
import { IngestionError } from "./ingestion-error.js";
import { assertXlsxAvailable } from "./xlsx-runtime.js";

export function sheetToMatrix(workbook, sheetIndex = 0, options = {}) {
  const XLSX = assertXlsxAvailable();
  const sheetName = workbook.SheetNames?.[sheetIndex];

  if (!sheetName) {
    throw new IngestionError(
      "SHEET_NOT_FOUND",
      "No se encontró la hoja del reporte.",
      { sheetIndex }
    );
  }

  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: options.defval ?? "",
    raw: options.raw ?? false
  });
}
