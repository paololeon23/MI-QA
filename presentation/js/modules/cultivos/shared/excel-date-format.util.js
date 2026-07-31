/**
 * Formato de fechas Excel/SAP compartido (todos los cultivos).
 * YYYYMMDD / ISO / serial → DD/MM/YYYY. No toca horas ni textos no-fecha.
 */

/** Columnas Excel 1-based frecuentes (Cosecha, Producción, Inspección, LMR). */
export const DEFAULT_SAP_DATE_COLS_EXCEL = [20, 21, 41, 51];

export function parseFlexibleDateToISO(valor) {
  if (valor == null || valor === "") return "";
  if (typeof valor === "number" && Number.isFinite(valor) && valor > 20000 && valor < 80000) {
    const fecha = new Date(Math.round((valor - 25569) * 86400 * 1000));
    if (Number.isNaN(fecha.getTime())) return "";
    const y = fecha.getUTCFullYear();
    const m = String(fecha.getUTCMonth() + 1).padStart(2, "0");
    const d = String(fecha.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  const texto = String(valor).trim();
  if (!texto) return "";

  if (/^\d{5,6}(\.\d+)?$/.test(texto)) {
    const n = Number(texto);
    if (Number.isFinite(n) && n > 20000 && n < 80000) {
      return parseFlexibleDateToISO(n);
    }
  }

  if (/^\d{8}$/.test(texto)) {
    const y = Number(texto.slice(0, 4));
    const m = Number(texto.slice(4, 6));
    const d = Number(texto.slice(6, 8));
    if (y < 1990 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return "";
    return `${texto.slice(0, 4)}-${texto.slice(4, 6)}-${texto.slice(6, 8)}`;
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(texto)) {
    return texto.slice(0, 10);
  }

  if (/^\d{2}[/-]\d{2}[/-]\d{4}$/.test(texto)) {
    const [d, m, y] = texto.split(/[/-]/);
    return `${y}-${m}-${d}`;
  }

  if (/^\d{2}[/-]\d{2}[/-]\d{2}$/.test(texto)) {
    const [d, m, y] = texto.split(/[/-]/);
    const fullY = Number(y) <= 50 ? `20${y}` : `19${y}`;
    return `${fullY}-${m}-${d}`;
  }

  const parsed = Date.parse(texto);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 10) : "";
}

export function formatISOToDMY(iso) {
  if (!iso) return "";
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  if (!y || !m || !d) return "";
  return `${d}/${m}/${y}`;
}

/**
 * Convierte valor de celda a DD/MM/YYYY si es fecha reconocible.
 * @returns {string|null} null si no debe modificarse
 */
export function formatDateValueToDMY(valor) {
  if (valor == null || String(valor).trim() === "") return null;
  const iso = parseFlexibleDateToISO(valor);
  if (!iso) return null;
  return formatISOToDMY(iso);
}

function normHeader(h) {
  return String(h ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim();
}

/**
 * Índices JS (0-based) de columnas fecha: hints Excel + encabezados con «fecha»/LMR.
 * Omite columnas de hora.
 */
export function resolveDateColumnJsIndexes(headers = [], excelColsHint = []) {
  const set = new Set();
  (excelColsHint || []).forEach((c) => {
    const n = Number(c);
    if (Number.isFinite(n) && n >= 1) set.add(n - 1);
  });
  (headers || []).forEach((h, i) => {
    const n = normHeader(h);
    if (!n) return;
    if (/\bhora\b/.test(n) || /^hora\b/.test(n)) return;
    if (n.includes("fecha") || n.includes("date") || /\blmr\b/.test(n)) {
      set.add(i);
    }
  });
  return [...set];
}

function copyRowPreservingMeta(row) {
  const copy = [...row];
  Object.keys(row).forEach((key) => {
    if (Number.isNaN(Number(key))) copy[key] = row[key];
  });
  return copy;
}

/**
 * Aplica DD/MM/YYYY en columnas fecha de todas las filas.
 * Seguro: solo reescribe valores parseables como fecha.
 *
 * @param {unknown[][]} rows
 * @param {unknown[]} [headers]
 * @param {number[]} [excelColsHint] columnas Excel 1-based
 */
export function applyDateDisplayFormatToRows(
  rows = [],
  headers = [],
  excelColsHint = DEFAULT_SAP_DATE_COLS_EXCEL
) {
  let cols = resolveDateColumnJsIndexes(headers, excelColsHint);
  if (!cols.length) {
    cols = DEFAULT_SAP_DATE_COLS_EXCEL.map((c) => c - 1);
  }

  return (rows || []).map((row) => {
    if (!Array.isArray(row)) return row;
    const copy = copyRowPreservingMeta(row);
    cols.forEach((js) => {
      if (js < 0 || js >= copy.length) return;
      const formatted = formatDateValueToDMY(copy[js]);
      if (formatted) copy[js] = formatted;
    });
    return copy;
  });
}

/** Mutación in-place de una fila (plagas legacy). */
export function formatRowDateCellsInPlace(row, headers = [], excelColsHint = DEFAULT_SAP_DATE_COLS_EXCEL) {
  if (!Array.isArray(row)) return row;
  const cols = resolveDateColumnJsIndexes(headers, excelColsHint);
  const useCols = cols.length ? cols : DEFAULT_SAP_DATE_COLS_EXCEL.map((c) => c - 1);
  useCols.forEach((js) => {
    if (js < 0 || js >= row.length) return;
    const formatted = formatDateValueToDMY(row[js]);
    if (formatted) row[js] = formatted;
  });
  return row;
}
