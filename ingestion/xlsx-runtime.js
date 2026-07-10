/**
 * Capa 2 — Ingestión: acceso a SheetJS para .xlsx y .csv.
 */
import { IngestionError } from "./ingestion-error.js";

export function isXlsxAvailable() {
  return Boolean(window.XLSX?.read && window.XLSX?.utils);
}

export function assertXlsxAvailable() {
  if (!isXlsxAvailable()) {
    throw new IngestionError(
      "XLSX_UNAVAILABLE",
      "No se pudo cargar el lector de Excel (SheetJS)."
    );
  }
  return window.XLSX;
}
