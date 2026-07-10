/** Mapa de nombres de columna desde rules/modulos/esparrago-plagas.rules.json */

export const REGLAS_PATH = "rules/modulos/esparrago-plagas.rules.json";

export function buildColumnLabelsByIndex(reglas) {
  const map = {};
  (reglas?.columnas || []).forEach((col) => {
    const numero = Number(col.numero);
    if (!Number.isFinite(numero) || numero < 1) return;
    const name = String(col["nombre-de-la-columna"] || "").trim();
    if (name) map[numero - 1] = name;
  });
  return map;
}

export function resolveColumnLabel(idx, headers, columnLabelsByIndex, config) {
  const headerText = headers?.[idx];
  if (headerText != null && String(headerText).trim()) {
    return String(headerText).trim();
  }
  if (columnLabelsByIndex?.[idx]) {
    return columnLabelsByIndex[idx];
  }
  const fixedLabel = config?.columnas_compare?.etiquetas_fijas?.[String(idx)];
  if (fixedLabel) return fixedLabel;
  const colRule = (config?.validaciones_por_columna || []).find((c) => c.indice_js === idx);
  if (colRule?.campo) return colRule.campo;
  return `Col ${idx + 1}`;
}
