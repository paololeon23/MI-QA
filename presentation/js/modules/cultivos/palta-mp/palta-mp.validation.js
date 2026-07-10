/** Validaciones Palta MP — configuration-driven desde rules.json */

import { getColInoloroJs, getValidationConfig } from "./palta-mp.config.js";
import {
  applyReglasCompuestasFila,
  cellDisplayValue,
  findDuplicates,
  getCellValidationIssues,
  indicesToValidate,
  parseFlexibleNumber
} from "../../../../../engine/cartilla-cell-validation.js";

export function valorCelda(val) {
  return cellDisplayValue(val);
}

export function celdaVacia(val) {
  return valorCelda(val).trim() === "";
}

export { parseFlexibleNumber };

export function parseExcelDateISO(v) {
  const s = valorCelda(v).trim();
  if (!s) return "";
  if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [d, m, y] = s.split("/");
    return `${y}-${m}-${d}`;
  }
  if (/^\d{2}-\d{2}-\d{4}$/.test(s)) {
    const [d, m, y] = s.split("-");
    return `${y}-${m}-${d}`;
  }
  const d = Date.parse(s);
  return Number.isFinite(d) ? new Date(d).toISOString().slice(0, 10) : "";
}

export function formatISOToDMY(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}-${m}-${y}`;
}

export function formatFechaCelda(val) {
  const iso = parseExcelDateISO(val);
  return iso ? formatISOToDMY(iso) : valorCelda(val);
}

export function limpiarMarcasValidacion(rows) {
  rows.forEach((row) => {
    delete row._errors;
    delete row._errorCols;
  });
}

function applyPaltaMpReglasLegacyFechas(row, err) {
  const fechaCosechaISO = parseExcelDateISO(row[19]);
  const fechaCosecha2ISO = parseExcelDateISO(row[63]);
  const fechaInspeccionISO = parseExcelDateISO(row[64]);
  if (fechaCosechaISO && fechaCosecha2ISO && fechaCosechaISO !== fechaCosecha2ISO) {
    err(19, "Debe ser igual a Fecha cosecha 2.0 (col. 64)");
  }
  if (fechaInspeccionISO && fechaCosecha2ISO && fechaCosecha2ISO > fechaInspeccionISO) {
    err(63, "No puede ser mayor a la fecha de inspección");
  }
}

export function ejecutarValidacion(rows, config = null) {
  const cfg = config || getValidationConfig();
  const colInoloroJs = getColInoloroJs();
  const loteIdx = cfg.validaciones_resumen?.lote?.indice_js ?? 9;

  const lotes = rows.map((r) => valorCelda(r[loteIdx]).trim()).filter(Boolean);
  const lotesDuplicados = findDuplicates(lotes);
  const loteCount = {};
  lotes.forEach((l) => {
    loteCount[l] = (loteCount[l] || 0) + 1;
  });

  const validationHelpers = {
    parseNumber: parseFlexibleNumber,
    normalizeDate: parseExcelDateISO
  };

  rows.forEach((row) => {
    row._errors = new Set();
    row._errorCols = new Set();

    const err = (colIndex, msg) => {
      row._errors.add(`Columna ${colIndex + 1}: ${msg}`);
      row._errorCols.add(colIndex);
    };

    const ctx = {
      row,
      duplicadosLote: lotesDuplicados,
      normalizeDate: parseExcelDateISO
    };

    indicesToValidate(cfg).forEach((idx) => {
      getCellValidationIssues(idx, row[idx], ctx, cfg).forEach((issue) => {
        const colIdx = issue.colIdx ?? idx;
        err(colIdx, issue.message);
      });
    });

    applyReglasCompuestasFila(
      row,
      cfg._reglasOrigen,
      (colIdx, issue) => err(colIdx, issue.message),
      validationHelpers
    );

    applyPaltaMpReglasLegacyFechas(row, err);

    if (celdaVacia(row[colInoloroJs])) err(colInoloroJs, "Inoloro obligatorio");
  });

  return { lotesDuplicados };
}

export function filaTieneError(row) {
  return row._errorCols && row._errorCols.size > 0;
}

export function obtenerTituloColumna(c, row) {
  if (!row || !row._errors) return "";
  const prefix = `Columna ${c + 1}: `;
  for (const e of row._errors) {
    if (e.startsWith(prefix)) return e.replace(prefix, "");
  }
  if (row._errorCols?.has(c)) return "Error de validación";
  return "";
}

export function celdaVaciaObligatoria(c, val, row) {
  if (!celdaVacia(val)) return false;
  return row._errorCols && row._errorCols.has(c);
}

export function celdaValorIncorrecto(c, val, row) {
  if (celdaVacia(val)) return false;
  return row._errorCols && row._errorCols.has(c);
}

export function getCellMeta(row, colJs) {
  const valRaw = row[colJs];
  let val;
  if ([19, 63, 64].includes(colJs)) {
    val = formatFechaCelda(valRaw);
  } else {
    val = valorCelda(valRaw);
  }

  if (celdaVaciaObligatoria(colJs, valRaw, row)) {
    return {
      val,
      cellClass: "agv-mp-cell-error-empty",
      title: obtenerTituloColumna(colJs, row)
    };
  }

  if (celdaValorIncorrecto(colJs, valRaw, row)) {
    return {
      val,
      cellClass: "agv-mp-cell-error-value",
      title: obtenerTituloColumna(colJs, row)
    };
  }

  return { val, cellClass: "", title: "" };
}
