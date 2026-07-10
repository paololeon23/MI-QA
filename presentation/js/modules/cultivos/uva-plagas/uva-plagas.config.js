/** Constantes y configuración — Plagas Uva (cartilla PMPU) */

export const CONFIG_PATH = "presentation/data/plagas-uva-validaciones.json";
export const REGLAS_PATH = "rules/modulos/uva-plagas.rules.json";

export const CARTILLA = "PMPU";
export const TOTAL_COLUMNAS = 105;
export const MIN_FILAS = 7;

export const LOTE_IDX = 9;
export const FECHA_COSECHA_IDX = 19;
export const FECHA_INSPECCION_IDX = 56;
export const TIPO_FORMATO_IDX = 28;
export const ETIQUETA_IDX = 29;

/** Columnas visibles en tabla de revisión (legacy: 1,2,7,10-20,29-33,57,80-105) */
export const COLUMNS_TO_SHOW = [
  0, 1, 6,
  ...Array.from({ length: 11 }, (_, i) => i + 9),
  ...Array.from({ length: 5 }, (_, i) => i + 28),
  56,
  ...Array.from({ length: 26 }, (_, i) => i + 79)
];

/** Índices con reglas de validación activas (col 16 y 93 excluidas) */
export const COLUMNAS_A_REVISAR = [
  ...Array.from({ length: 7 }, (_, i) => i + 9),
  16, 17, 18,
  ...Array.from({ length: 5 }, (_, i) => i + 28),
  FECHA_INSPECCION_IDX,
  ...Array.from({ length: 13 }, (_, i) => i + 79),
  ...Array.from({ length: 12 }, (_, i) => i + 93)
];

/** Excel col. 1-based: no convertir a número en exportación filtrada */
export const EXPORT_COLUMNAS_TEXTO = new Set([10, 19, 20, 57]);

/**
 * Orden exportación Excel filtrado (null = columna vacía en plantilla).
 * Portado de legacy EXPORT_ORDEN (105 columnas).
 */
export const EXPORT_ORDEN = (() => {
  const orden = [];
  const vacio = () => orden.push(null);
  const col = (n) => orden.push(n - 1);
  const rango = (a, b) => {
    for (let n = a; n <= b; n += 1) col(n);
  };

  vacio();
  vacio();
  vacio();
  rango(10, 19);
  col(20);
  vacio();
  rango(29, 33);
  vacio();
  vacio();
  rango(34, 79);
  rango(80, 105);
  return orden;
})();

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
  if (columnLabelsByIndex?.[idx]) return columnLabelsByIndex[idx];
  const fixedLabel = config?.etiquetas_sticky?.[String(idx)];
  if (fixedLabel) return fixedLabel;
  const colRule = (config?.validaciones_por_columna || []).find((c) => c.indice_js === idx);
  if (colRule?.campo) return colRule.campo;
  return `Col ${idx + 1}`;
}
