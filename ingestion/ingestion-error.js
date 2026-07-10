/**
 * Capa 2 — Ingestión: errores tipados de lectura y normalización de reportes.
 */
export class IngestionError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "IngestionError";
    this.code = code;
    this.details = details;
  }
}
