/**
 * Capa 2 — Ingestión (CDA)
 * Lectura y normalización de reportes Excel/CSV hacia filas estructuradas.
 */
export { IngestionError } from "./ingestion-error.js";
export { isXlsxAvailable, assertXlsxAvailable } from "./xlsx-runtime.js";
export { detectFileFormat, readFileAsWorkbook } from "./file-reader.js";
export { sheetToMatrix } from "./sheet-matrix.js";
export { parseCabeceraFromMatrix } from "./cabecera-parser.js";
export { validateArchivoMetadata } from "./archivo-validator.js";
export { extractStructuredRows, validateCartillaEnDatos } from "./row-extractor.js";
export { ingestReportFile } from "./report-ingestor.js";
