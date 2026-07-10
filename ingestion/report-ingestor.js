/**
 * Capa 2 — Ingestión de reportes.
 * Convierte archivos .xlsx / .csv (SheetJS) en filas estructuradas para el motor.
 */
import { detectFileFormat } from "./file-reader.js";
import { readFileAsWorkbook } from "./file-reader.js";
import { sheetToMatrix } from "./sheet-matrix.js";
import { parseCabeceraFromMatrix } from "./cabecera-parser.js";
import { validateArchivoMetadata } from "./archivo-validator.js";
import {
  extractStructuredRows,
  validateCartillaEnDatos
} from "./row-extractor.js";

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
  const { headers, rows } = extractStructuredRows(matrix, ingestConfig);

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
