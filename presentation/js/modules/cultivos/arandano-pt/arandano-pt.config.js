/** Configuración PT Arándano — cartillas, perfiles de columnas y columnas visibles. */

export const CARTILLA_RAW_MAP = {
  PTHPAR: "PTHPA",
  PTLPAR: "PTLPA",
  PTBPAR: "PTBPA"
};

export const CARTILLA_ORDER = ["PTHPA", "PTLPA", "PTBPA"];

/** Plantilla actual: 100 columnas (97 clásicas + 3 Pudrición con Larva en cols 53, 79, 99). */
export const PT_TOTAL_COLUMNAS = 100;

export function reorderRow(row, order) {
  return order.map((i) => row[i] ?? "");
}

export const COLUMNAS_EXPORT_EXTRA = ["LINEA", "FORMATO", "ETIQUETA", "FECHA COSECHA", "TIPO DE BOLSA"];

export const FILAS_SKIP = 5;

export const CABECERA_CARTILLA = { fila: 4, columna: 9 };
export const CABECERA_ESTADO = { fila: 4, columna: 14 };
