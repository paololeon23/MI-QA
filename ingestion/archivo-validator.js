/**
 * Capa 2 — Ingestión: validaciones de archivo antes de extraer filas de datos.
 */
import { IngestionError } from "./ingestion-error.js";
import { readMatrixCellZeroBased } from "./cell-reader.js";

export function validateArchivoMetadata(matrix, validacionArchivo = {}, options = {}) {
  if (!validacionArchivo || Object.keys(validacionArchivo).length === 0) {
    return { ok: true };
  }

  const filaGrupoJs = validacionArchivo.fila_grupo_js ?? 3;
  const colGrupoJs = validacionArchivo.col_grupo_js ?? 8;
  const filaEstadoJs = validacionArchivo.fila_estado_js ?? filaGrupoJs;
  const colEstadoJs = validacionArchivo.col_estado_js ?? 13;

  const grupo = readMatrixCellZeroBased(matrix, filaGrupoJs, colGrupoJs).toUpperCase();
  const estado = readMatrixCellZeroBased(matrix, filaEstadoJs, colEstadoJs).toUpperCase();

  const grupoEsperado = String(
    options.grupoEsperado ?? validacionArchivo.grupo_esperado ?? ""
  ).toUpperCase();
  const estadoEsperado = String(
    options.estadoEsperado ?? validacionArchivo.estado_esperado ?? "ENVIADA"
  ).toUpperCase();

  if (grupoEsperado && grupo !== grupoEsperado) {
    throw new IngestionError(
      "INVALID_GRUPO",
      `Grupo no válido. Se esperaba ${grupoEsperado}.`,
      { grupoEncontrado: grupo, grupoEsperado }
    );
  }

  if (estadoEsperado && estado !== estadoEsperado) {
    throw new IngestionError(
      "INVALID_ESTADO",
      `Estado incorrecto. Se esperaba ${estadoEsperado}.`,
      { estadoEncontrado: estado, estadoEsperado }
    );
  }

  return { ok: true, grupo, estado };
}
