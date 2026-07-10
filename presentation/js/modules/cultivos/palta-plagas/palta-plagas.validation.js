/** Validaciones Plagas Palta — portado de legacy plagas-palta.js */

import {
  FECHA_COSECHA_IDX,
  FECHA_INSPECCION_IDX,
  FUNDO_IDX,
  LOTE_IDX,
  PRODUCTOR_IDX,
  TIPO_FORMATO_IDX,
  ETIQUETA_IDX
} from "./palta-plagas.config.js";
import { getLongitudExactaDesdeConfig } from "../../../../../engine/cartilla-rules.adapter.js";
import {
  cellDisplayValue,
  findDuplicates,
  getCellValidationIssues as getCellIssuesFromConfig,
  indicesToValidate
} from "../../../../../engine/cartilla-cell-validation.js";

export function formatYyyyMmDd(raw) {
  const str = String(raw ?? "").trim();
  if (!str) return "";
  if (str.length === 8 && /^\d{8}$/.test(str)) {
    const yyyy = str.slice(0, 4);
    const mm = str.slice(4, 6);
    const dd = str.slice(6, 8);
    return `${dd}/${mm}/${yyyy}`;
  }
  if (/\d{1,2}\/\d{1,2}\/\d{4}/.test(str)) {
    const [d, m, y] = str.split("/");
    return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
  }
  if (/\d{1,2}-\d{1,2}-\d{4}/.test(str)) {
    const [d, m, y] = str.split("-");
    return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
  }
  return str;
}

export function parseFlexibleNumber(val) {
  if (val === null || val === undefined) return NaN;
  if (typeof val === "object" && val !== null) {
    if ("v" in val && val.v !== undefined && val.v !== null && val.v !== "") {
      return parseFlexibleNumber(val.v);
    }
    if ("w" in val && val.w !== undefined && val.w !== null && String(val.w).trim() !== "") {
      return parseFlexibleNumber(val.w);
    }
  }
  if (typeof val === "number" && !Number.isNaN(val)) return val;
  let s = String(val).trim().replace(/\s/g, "").replace(",", ".");
  if (s === "") return NaN;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

export { cellDisplayValue, findDuplicates };

export function getCellValidationIssues(idx, rawVal, ctx, config) {
  return getCellIssuesFromConfig(idx, rawVal, ctx, config);
}

export function collectLotes(rows, loteIdx = LOTE_IDX) {
  return rows.map((r) => cellDisplayValue(r[loteIdx])).filter(Boolean);
}

export function ordenarFechasDDMMYYYY(fechas) {
  return [...fechas].sort((a, b) => {
    const pa = a.split("/").map(Number);
    const pb = b.split("/").map(Number);
    return new Date(pa[2], pa[1] - 1, pa[0]) - new Date(pb[2], pb[1] - 1, pb[0]);
  });
}

function paintEmpty(td, message) {
  td.classList.add("agv-mp-cell-error-empty");
  if (message) td.title = message;
}

function paintValueError(td, message) {
  td.classList.add("agv-mp-cell-error-value");
  if (message) td.title = message;
}

export function getCellExportClass(idx, rawVal, ctx, config) {
  const issues = getCellValidationIssues(idx, rawVal, ctx, config);
  if (!issues.length) return "";
  const val = cellDisplayValue(rawVal);
  if (issues.some((i) => i.kind === "empty") && !val) return "agv-mp-cell-error-empty";
  return "agv-mp-cell-error-value";
}


export function rowHasValidationIssues(row, config, syncContext) {
  const ctx = {
    row,
    duplicadosLote: syncContext.duplicadosLote
  };
  return indicesToValidate(config).some(
    (idx) => getCellValidationIssues(idx, row[idx], ctx, config).length > 0
  );
}

export function ejecutarValidacion(rows, config) {
  const lotes = collectLotes(rows);
  const loteCount = {};
  lotes.forEach((l) => {
    loteCount[l] = (loteCount[l] || 0) + 1;
  });
  const duplicadosLote = findDuplicates(lotes);

  rows.forEach((row) => {
    row._errors = [];
    row._errorLote = false;
    const ctx = { row, duplicadosLote };

    if (getCellValidationIssues(LOTE_IDX, row[LOTE_IDX], ctx, config).length > 0) {
      row._errorLote = true;
    }

    indicesToValidate(config).forEach((idx) => {
      const issues = getCellValidationIssues(idx, row[idx], ctx, config);
      issues.forEach((issue) => {
        row._errors.push(`Columna ${idx + 1}: ${issue.message}`);
      });
    });
  });

  return { lotesDuplicados: duplicadosLote };
}

export function limpiarMarcasValidacion(rows) {
  rows.forEach((row) => {
    delete row._errors;
    delete row._errorLote;
  });
}

export function rowHasMarkedErrors(row) {
  return Boolean(row._errorLote || (row._errors && row._errors.length > 0));
}

export function analyzeInspectionDate(fecha, rawData, config) {
  const fechaIdx = config.filtro_principal?.indice_js ?? FECHA_INSPECCION_IDX;
  const rows = rawData.filter((r) => cellDisplayValue(r[fechaIdx]) === fecha);
  const filas = rows.map((r) => [...r]);
  limpiarMarcasValidacion(filas);
  const { lotesDuplicados } = ejecutarValidacion(filas, config);
  const errorRows = filas.filter((r) => rowHasMarkedErrors(r));
  const hasIssues = errorRows.length > 0 || lotesDuplicados.length > 0;

  return {
    fecha,
    rows: filas,
    errorRows,
    lotesDuplicados,
    totalFilas: filas.length,
    filasConError: errorRows.length,
    tieneErrores: hasIssues,
    hasIssues
  };
}

export function applyPlagasCellValidation(td, idx, rawVal, ctx, config) {
  const val = cellDisplayValue(rawVal);
  td.textContent = val;
  getCellValidationIssues(idx, rawVal, ctx, config).forEach((issue) => {
    if (issue.kind === "empty") paintEmpty(td, issue.message);
    else paintValueError(td, issue.message);
  });
}

export function isHarvestAfterInspection(cosecha, inspeccion) {
  if (!cosecha || !inspeccion) return false;
  const [d1, m1, y1] = inspeccion.split("/").map(Number);
  const [d2, m2, y2] = cosecha.split("/").map(Number);
  if (![d1, m1, y1, d2, m2, y2].every(Number.isFinite)) return false;
  return new Date(y2, m2 - 1, d2) > new Date(y1, m1 - 1, d1);
}

export function formatRowDates(row, config) {
  const cosechaIdx = config.fecha_cosecha?.indice_js ?? FECHA_COSECHA_IDX;
  const inspeccionIdx = config.filtro_principal?.indice_js ?? FECHA_INSPECCION_IDX;
  row[cosechaIdx] = formatYyyyMmDd(row[cosechaIdx]);
  row[inspeccionIdx] = formatYyyyMmDd(row[inspeccionIdx]);
}

/** Validación directa legacy (sin marcar fila) para celdas sueltas */
export function validateLote(val, duplicados = [], config = null) {
  const lote = cellDisplayValue(val);
  if (!lote) return { ok: false, empty: true, message: "Lote obligatorio" };
  const longitud = getLongitudExactaDesdeConfig(config, LOTE_IDX);
  if (longitud != null && lote.length !== longitud) {
    return { ok: false, message: `Debe tener ${longitud} caracteres` };
  }
  if (duplicados.includes(lote)) return { ok: false, message: "Lote duplicado" };
  return { ok: true };
}

function valorEsperadoDesdeConfig(config, indiceJs, fallback) {
  const col = (config?.validaciones_por_columna || []).find((c) => c.indice_js === indiceJs);
  const rule = col?.reglas?.find((r) => r.tipo === "valor_exacto" || r.tipo === "texto_exacto");
  return rule?.valor != null ? String(rule.valor) : fallback;
}

export function validateProductor(val, config = null) {
  const v = cellDisplayValue(val);
  const esperado = valorEsperadoDesdeConfig(config, PRODUCTOR_IDX, "1000003265");
  if (!v) return { ok: false, empty: true, message: "Productor obligatorio" };
  if (v !== esperado) {
    return { ok: false, message: `Debe ser ${esperado}` };
  }
  return { ok: true };
}

export function validateFundo(val) {
  const v = cellDisplayValue(val).toLowerCase();
  if (!v) return { ok: false, empty: true, message: "Fundo obligatorio" };
  if (v !== "n") return { ok: false, message: 'Debe ser "n"' };
  return { ok: true };
}

export function validateTipoFormato(val) {
  const v = cellDisplayValue(val);
  if (!v) return { ok: false, empty: true, message: "Tipo formato obligatorio" };
  if (v !== "59") return { ok: false, message: "Debe ser 59" };
  return { ok: true };
}

export function validateEtiqueta(val) {
  const v = cellDisplayValue(val);
  if (!v) return { ok: false, empty: true, message: "Etiqueta obligatoria" };
  if (v !== "53") return { ok: false, message: "Debe ser 53" };
  return { ok: true };
}

export function buildDuplicateAlertHtml(dups) {
  if (!dups.length) return "";
  return `<b>Lotes duplicados:</b> ${dups.join(", ")}`;
}
