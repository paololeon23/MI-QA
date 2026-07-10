/**
 * Capa 2 — Ingestión: extracción de metadatos de cabecera del reporte.
 */
import { readMatrixCellOneBased } from "./cell-reader.js";

function resolveFieldCoord(field) {
  if (field.fila != null && field.columna != null) {
    return { fila: field.fila, columna: field.columna };
  }
  return {
    fila: (field.fila_js ?? 0) + 1,
    columna: (field.col_js ?? 0) + 1
  };
}

/**
 * @param {Array<Array>} matrix - Matriz completa del archivo
 * @param {object|null} cabeceraConfig - Definición desde presentation/data (cabecera_excel)
 */
export function parseCabeceraFromMatrix(matrix, cabeceraConfig) {
  if (!cabeceraConfig) return null;

  const meta = {};
  const tituloCoord = cabeceraConfig.titulo
    ? resolveFieldCoord(cabeceraConfig.titulo)
    : null;

  if (tituloCoord) {
    meta.titulo = readMatrixCellOneBased(matrix, tituloCoord.fila, tituloCoord.columna);
  }

  (cabeceraConfig.campos ?? []).forEach((field) => {
    const coord = resolveFieldCoord(field);
    meta[field.clave] = readMatrixCellOneBased(matrix, coord.fila, coord.columna);
  });

  return meta;
}
