/**
 * Capa 2 — Ingestión: lectura y normalización de celdas en matriz.
 */

export function normalizeCellValue(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

/** Lee celda con coordenadas 1-based (estilo Excel). */
export function readMatrixCellOneBased(matrix, fila, columna) {
  const value = matrix[(fila ?? 1) - 1]?.[(columna ?? 1) - 1];
  return normalizeCellValue(value);
}

/** Lee celda con índices 0-based (estilo JavaScript / JSON de configuración). */
export function readMatrixCellZeroBased(matrix, filaJs, colJs) {
  const value = matrix[filaJs ?? 0]?.[colJs ?? 0];
  return normalizeCellValue(value);
}
