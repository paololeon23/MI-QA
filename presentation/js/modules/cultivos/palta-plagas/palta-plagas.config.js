/** Constantes y configuración — Plagas Palta (cartilla EPPP) */

export const CONFIG_PATH = "presentation/data/plagas-palta-validaciones.json";
export const REGLAS_PATH = "rules/modulos/palta-plagas.rules.json";

export const CARTILLA = "EPPP";
export const TOTAL_COLUMNAS = 132;
export const PRODUCTOR_ESPERADO = "1000003265";

export const LOTE_IDX = 9;
export const FECHA_COSECHA_IDX = 19;
export const FECHA_INSPECCION_IDX = 81;
export const TIPO_FORMATO_IDX = 28;
export const ETIQUETA_IDX = 29;
export const FUNDO_IDX = 17;
export const PRODUCTOR_IDX = 12;

/** Columnas visibles en tabla de revisión (legacy columnsToShow) */
export const COLUMNS_TO_SHOW = [
  0, 1, 4, 6,
  9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
  28, 29, 30, 31, 32,
  81,
  ...Array.from({ length: 33 }, (_, i) => i + 99)
];

/** Índices con reglas de validación activas */
export const COLUMNAS_A_REVISAR = [
  ...Array.from({ length: 10 }, (_, i) => i + 9),
  ...Array.from({ length: 5 }, (_, i) => i + 28),
  FECHA_INSPECCION_IDX,
  ...Array.from({ length: 33 }, (_, i) => i + 99)
];

/** Excel col. 1-based: no convertir a número en exportación filtrada */
export const EXPORT_COLUMNAS_TEXTO = new Set([10, 19, 20, 82]);

/**
 * Orden exportación Excel filtrado (null = columna vacía en plantilla).
 * Portado de legacy EXPORT_ORDEN.
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
  rango(34, 99);
  rango(100, 132);
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
