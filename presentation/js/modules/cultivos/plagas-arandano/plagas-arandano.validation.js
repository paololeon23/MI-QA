/** Validaciones Plagas Arándano — configuration-driven desde rules.json */

import {
  cellDisplayValue,
  findDuplicates,
  getCellValidationIssues,
  indicesToValidate
} from "../../../../../engine/cartilla-cell-validation.js";

export function valorCeldaParaMostrar(val) {
  return cellDisplayValue(val);
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

function celdaVaciaObligatoria(v) {
  return valorCeldaParaMostrar(v).trim() === "";
}

export function ejecutarValidacionPlagasArandano(rows, config, options = {}) {
  const loteIdx = config.validaciones_resumen?.lote?.indice_js ?? 9;
  const lotes = rows.map((r) => valorCeldaParaMostrar(r[loteIdx]).trim()).filter(Boolean);
  const lotesDuplicados = findDuplicates(lotes);

  const catalogos = {
    "var-map-arandano": options.catalogoVariedades || {}
  };

  rows.forEach((row) => {
    row._errors = [];
    row._errorLote = false;

    const addError = (i, msg) => row._errors.push(`Columna ${i + 1}: ${msg}`);

    const ctx = {
      row,
      duplicadosLote: lotesDuplicados,
      fechaInspeccionIdx: config.filtro_principal?.indice_js ?? 71
    };

    indicesToValidate(config).forEach((idx) => {
      if (idx === 16) return;
      getCellValidationIssues(idx, row[idx], ctx, config, {
        catalogos,
        catalogoVariedades: options.catalogoVariedades
      }).forEach((issue) => {
        const colIdx = issue.colIdx ?? idx;
        addError(colIdx, issue.message);
        if (colIdx === loteIdx) row._errorLote = true;
      });
    });

    const lote = valorCeldaParaMostrar(row[loteIdx]).trim();
    if (!lote || lotesDuplicados.includes(lote)) {
      row._errorLote = true;
    }
  });

  return { lotesDuplicados };
}

export function rowHasMarkedErrors(row) {
  return Boolean(row._errorLote || (row._errors && row._errors.length > 0));
}
