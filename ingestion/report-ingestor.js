/**
 * Capa 2 — Ingestión de reportes.
 * Convierte archivos .xlsx / .csv (SheetJS) en filas estructuradas para el motor.
 */
import { detectFileFormat } from "./file-reader.js";
import { readFileAsWorkbook } from "./file-reader.js";
import { sheetToMatrix } from "./sheet-matrix.js";
import { parseCabeceraFromMatrix } from "./cabecera-parser.js";
import { validateArchivoMetadata } from "./archivo-validator.js";
import { extractStructuredRows, validateCartillaEnDatos } from "./row-extractor.js";
import { applyDateDisplayFormatToRows } from "./date-format.js";

/**
 * @typedef {object} IngestReportConfig
 * @property {object} [validacionArchivo] - Reglas de validación de archivo (presentation/data)
 * @property {object} [cabeceraExcel] - Metadatos de cabecera (presentation/data)
 * @property {number} [filasSkip=0] - Filas a omitir antes del encabezado de datos
 * @property {number} [totalColumnas] - Cantidad exacta de columnas esperadas
 * @property {string} [cartillaEsperada] - Código de cartilla en primera fila de datos
 * @property {number} [cartillaColumnJs=1] - Índice JS de la columna de cartilla
 * @property {string} [grupoEsperado] - Override del grupo esperado
 * @property {string} [estadoEsperado] - Override del estado esperado
 * @property {number} [sheetIndex=0] - Índice de hoja Excel
 * @property {object} [sheetOptions] - Opciones para sheet_to_json
 * @property {number[]} [columnasFechaExcel] - Columnas Excel 1-based a formatear como fecha
 */

/**
 * Ingiere un reporte y devuelve filas estructuradas listas para la capa de dominio.
 *
 * @param {File} file - Archivo seleccionado por el usuario (.xlsx / .csv)
 * @param {IngestReportConfig} ingestConfig - Configuración desde presentation/data
 */
export async function ingestReportFile(file, ingestConfig = {}) {
  const format = detectFileFormat(file?.name);
  const workbook = await readFileAsWorkbook(file);
  const matrix = sheetToMatrix(
    workbook,
    ingestConfig.sheetIndex ?? 0,
    ingestConfig.sheetOptions ?? {}
  );

  if (ingestConfig.validacionArchivo) {
    validateArchivoMetadata(matrix, ingestConfig.validacionArchivo, ingestConfig);
  }

  const cabecera = parseCabeceraFromMatrix(matrix, ingestConfig.cabeceraExcel);
  let { headers, rows } = extractStructuredRows(matrix, ingestConfig);

  // Fechas SAP: 20251110 → 10/11/2025
  const dateHints =
    ingestConfig.columnasFechaExcel ||
    ingestConfig.validacionArchivo?.columnas_fecha ||
    [20, 21, 41, 51];
  rows = applyDateDisplayFormatToRows(rows, headers, dateHints);

  if (ingestConfig.cartillaEsperada) {
    validateCartillaEnDatos(
      rows,
      ingestConfig.cartillaEsperada,
      ingestConfig.cartillaColumnJs ?? 1
    );
  }

  return {
    fileName: file.name,
    format,
    matrix,
    cabecera,
    headers,
    rows,
    meta: {
      totalColumnas: ingestConfig.totalColumnas ?? headers.length,
      rowCount: rows.length,
      sheetNames: workbook.SheetNames ?? []
    }
  };
}
