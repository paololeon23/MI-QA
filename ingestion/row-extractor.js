/**
 * Capa 2 — Ingestión: extracción de encabezados y filas de datos estructuradas.
 */
import { IngestionError } from "./ingestion-error.js";
import { normalizeCellValue } from "./cell-reader.js";

function rowHasData(row = []) {
  return row.some((cell) => cell !== "" && cell != null);
}

export function extractStructuredRows(matrix, options = {}) {
  const filasSkip = options.filasSkip ?? 0;
  const totalColumnas = options.totalColumnas;
  const sheet = matrix.slice(filasSkip);

  if (sheet.length < 2) {
    throw new IngestionError(
      "EMPTY_FILE",
      "El archivo no contiene datos suficientes."
    );
  }

  const headers = sheet[0] ?? [];

  if (totalColumnas != null && headers.length !== totalColumnas) {
    throw new IngestionError(
      "INVALID_STRUCTURE",
      `Estructura incorrecta: ${headers.length} columnas encontradas, ${totalColumnas} requeridas.`,
      { columnasEncontradas: headers.length, columnasEsperadas: totalColumnas }
    );
  }

  const rows = sheet.slice(1).filter(rowHasData);
  if (!rows.length) {
    throw new IngestionError(
      "EMPTY_DATA_ROWS",
      "No se encontraron filas de datos en el reporte."
    );
  }

  return { headers, rows };
}

export function validateCartillaEnDatos(rows, cartillaEsperada, cartillaColumnJs = 1) {
  const expected = String(cartillaEsperada ?? "").toUpperCase().trim();
  if (!expected) return { ok: true };

  const firstRow = rows[0] ?? [];
  const tipoFila = normalizeCellValue(firstRow[cartillaColumnJs]).toUpperCase();

  if (!tipoFila) {
    throw new IngestionError(
      "MISSING_CARTILLA_TYPE",
      "La primera fila de datos no contiene el tipo de cartilla esperado."
    );
  }

  if (tipoFila !== expected) {
    throw new IngestionError(
      "INVALID_CARTILLA",
      `Cartilla no válida. Se esperaba ${expected}.`,
      { cartillaEncontrada: tipoFila, cartillaEsperada: expected }
    );
  }

  return { ok: true, cartilla: tipoFila };
}
