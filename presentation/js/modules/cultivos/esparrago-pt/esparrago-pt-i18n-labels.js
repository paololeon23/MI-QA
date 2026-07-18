/** Etiquetas de columna PT Espárrago vía i18next (índice JS → ptEsparrago.col.N). */

import { i18nService } from "../../../services/i18n.service.js";
import { resolveColumnLabel } from "../../../../../engine/cartilla-rules.adapter.js";

/**
 * Prioriza traducción del idioma activo; si falta la clave, rules/Excel.
 * La validación sigue por índice — no depende del texto del encabezado.
 */
export function resolvePtEsparragoColumnLabel(excelCol, headers, columnLabelsByIndex) {
  const key = `ptEsparrago.col.${excelCol}`;
  const translated = i18nService.translate(key);
  if (translated && translated !== key) return translated;
  return resolveColumnLabel(excelCol, headers, columnLabelsByIndex);
}
