/** Traducción de cabeceras Excel (ES canónico → idioma UI). Display only. */

import { i18nService } from "../services/i18n.service.js";

function slugHeader(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 64);
}

/**
 * @param {string} excelHeader texto del Excel (casi siempre ES)
 * @param {number} [colIndex] índice JS opcional para clave col.N
 * @param {string} [prefix] ej. arandanoMp
 */
export function translateExcelHeader(excelHeader, colIndex = -1, prefix = "") {
  const raw = String(excelHeader ?? "").trim();
  if (prefix && colIndex >= 0) {
    const byIndex = `${prefix}.col.${colIndex}`;
    const indexed = i18nService.translate(byIndex);
    if (indexed && indexed !== byIndex) return indexed;
  }
  if (!raw) return colIndex >= 0 ? `Col ${colIndex + 1}` : "";
  const key = `excelHeader.${slugHeader(raw)}`;
  const translated = i18nService.translate(key);
  if (translated && translated !== key) return translated;
  return raw;
}
