/** Validaciones Plagas Espárrago — lógica del legacy plagas-esparrago.js */

import {
  cellDisplayValue,
  getCellValidationIssues as getCellIssuesFromConfig
} from "../../../../../engine/cartilla-cell-validation.js";

export { cellDisplayValue };

export function getCellValidationIssues(idx, rawVal, ctx, config, options = {}) {
  const issues = getCellIssuesFromConfig(idx, rawVal, ctx, config, {
    ...options,
    cruceIppIsp: ctx?.tipo
      ? { tipo: ctx.tipo, lotesIPP: ctx.lotesIPP || [], lotesISP: ctx.lotesISP || [] }
      : undefined
  });
  const val = cellDisplayValue(rawVal);
  const plagaDesde = config?.plagas_desde_indice_js ?? 78;
  if (idx >= plagaDesde && idx <= (config?.plagas_hasta_indice_js ?? 102) && !val) {
    issues.push({ kind: "empty", message: "Campo de plaga obligatorio" });
  }
  return issues;
}

export function formatYyyyMmDd(raw) {
  const str = String(raw ?? "").trim();
  if (str.length !== 8 || !/^\d{8}$/.test(str)) return str;
  const yyyy = str.slice(0, 4);
  const mm = str.slice(4, 6);
  const dd = str.slice(6, 8);
  return `${dd}/${mm}/${yyyy}`;
}

export function findDuplicates(values) {
  const seen = new Set();
  const dups = new Set();
  values.forEach((v) => {
    if (!v) return;
    if (seen.has(v)) dups.add(v);
    else seen.add(v);
  });
  return [...dups];
}

export function collectLotes(rows, loteIdx) {
  return rows.map((r) => cellDisplayValue(r[loteIdx])).filter(Boolean);
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

function indicesToValidate(config) {
  const set = new Set(config.columnas_visibles_frontend?.indices_js || []);
  (config.validaciones_por_columna || []).forEach((c) => set.add(c.indice_js));
  (config.rangos_obligatorios || []).forEach((range) => {
    for (let i = range.desde_js; i <= range.hasta_js; i += 1) {
      if (!(range.excepto_js || []).includes(i)) set.add(i);
    }
  });
  const plagaDesde = config.plagas_desde_indice_js ?? 78;
  const plagaHasta = config.plagas_hasta_indice_js ?? 102;
  for (let i = plagaDesde; i <= plagaHasta; i += 1) set.add(i);
  return [...set];
}

function buildRowContext(tipo, syncContext) {
  return {
    tipo,
    duplicadosCartilla: syncContext.duplicadosCartilla,
    lotesIPP: syncContext.lotesIPP,
    lotesISP: syncContext.lotesISP
  };
}

export function getCompareColumnLabel(idx, headers, config, columnLabelsByIndex = {}) {
  const headerText = cellDisplayValue(headers?.[idx]);
  if (headerText) return headerText;
  if (columnLabelsByIndex[idx]) return columnLabelsByIndex[idx];
  const fixedLabel = config.columnas_compare?.etiquetas_fijas?.[String(idx)];
  if (fixedLabel) return fixedLabel;
  const colRule = (config.validaciones_por_columna || []).find((c) => c.indice_js === idx);
  if (colRule?.campo) return colRule.campo;
  return `Col ${idx + 1}`;
}

export function getRowErrorColumnIndices(row, tipo, config, syncContext) {
  const ctx = buildRowContext(tipo, syncContext);
  const fixed = config.columnas_compare?.fijas_js ?? [0, 6, 9];
  return indicesToValidate(config).filter(
    (idx) => !fixed.includes(idx) && getCellValidationIssues(idx, row[idx], ctx, config).length > 0
  );
}

export function sortCompareRowsForDisplay(rows, loteIdx = 9, duplicadosCartilla = []) {
  if (!duplicadosCartilla.length || !rows.length) return [...rows];

  const dupSet = new Set(duplicadosCartilla);
  const emitted = new Set();
  const result = [];

  rows.forEach((row) => {
    const lote = cellDisplayValue(row[loteIdx]);
    if (lote && dupSet.has(lote)) {
      if (!emitted.has(lote)) {
        emitted.add(lote);
        rows.filter((r) => cellDisplayValue(r[loteIdx]) === lote).forEach((r) => result.push(r));
      }
    } else {
      result.push(row);
    }
  });

  return result;
}

export function buildCompareRowGroups(rows, duplicadosCartilla = [], loteIdx = 9) {
  const sorted = sortCompareRowsForDisplay(rows, loteIdx, duplicadosCartilla);
  const dupSet = new Set(duplicadosCartilla);
  const groups = [];
  let index = 0;

  while (index < sorted.length) {
    const row = sorted[index];
    const lote = cellDisplayValue(row[loteIdx]);
    if (lote && dupSet.has(lote)) {
      const bundle = [row];
      let next = index + 1;
      while (next < sorted.length && cellDisplayValue(sorted[next][loteIdx]) === lote) {
        bundle.push(sorted[next]);
        next += 1;
      }
      groups.push({ kind: "duplicate", lote, rows: bundle });
      index = next;
    } else {
      groups.push({ kind: "default", rows: [row] });
      index += 1;
    }
  }

  return groups;
}

function isDuplicateLoteCell(idx, rawVal, ctx, loteIdx = 9) {
  const val = cellDisplayValue(rawVal);
  return idx === loteIdx && Boolean(val) && (ctx.duplicadosCartilla || []).includes(val);
}

export function getCompareColumnsForPane(rows, tipo, config, syncContext, headers = []) {
  const fixed = config.columnas_compare?.fijas_js ?? [0, 6, 9];
  const duplicadoLoteCols = config.columnas_compare?.duplicado_lote_js ?? [];
  const loteIdx = 9;
  const dups = syncContext.duplicadosCartilla || [];
  const errorSet = new Set();
  let hasDuplicateLote = dups.length > 0;

  rows.forEach((row) => {
    const lote = cellDisplayValue(row[loteIdx]);
    if (lote && dups.includes(lote)) {
      hasDuplicateLote = true;
    }
    getRowErrorColumnIndices(row, tipo, config, syncContext).forEach((idx) => {
      errorSet.add(idx);
    });
  });

  const contextCols = hasDuplicateLote ? duplicadoLoteCols : [];
  return [...new Set([...fixed, ...contextCols, ...errorSet])].sort((a, b) => a - b);
}

export function cellHasCompareError(row, idx, tipo, config, syncContext) {
  if ((config.columnas_compare?.fijas_js ?? [0, 6, 9]).includes(idx)) {
    const ctx = buildRowContext(tipo, syncContext);
    return getCellValidationIssues(idx, row[idx], ctx, config).length > 0;
  }
  return getRowErrorColumnIndices(row, tipo, config, syncContext).includes(idx);
}

export function rowHasValidationIssues(row, tipo, config, syncContext) {
  const ctx = {
    tipo,
    duplicadosCartilla: syncContext.duplicadosCartilla,
    lotesIPP: syncContext.lotesIPP,
    lotesISP: syncContext.lotesISP
  };
  return indicesToValidate(config).some(
    (idx) => getCellValidationIssues(idx, row[idx], ctx, config).length > 0
  );
}

export function analyzeDateComparison(fecha, rawDataByCartilla, config, loteIdx = 9, fechaIdx = 76) {
  const rowsIPP = (rawDataByCartilla.IPP || []).filter((r) => cellDisplayValue(r[fechaIdx]) === fecha);
  const rowsISP = (rawDataByCartilla.ISP || []).filter((r) => cellDisplayValue(r[fechaIdx]) === fecha);
  const lotesIPP = collectLotes(rowsIPP, loteIdx);
  const lotesISP = collectLotes(rowsISP, loteIdx);
  const dupsIPP = findDuplicates(lotesIPP);
  const dupsISP = findDuplicates(lotesISP);
  const soloEnIPP = lotesIPP.filter((l) => !lotesISP.includes(l));
  const soloEnISP = lotesISP.filter((l) => !lotesIPP.includes(l));
  const baseCtx = { lotesIPP, lotesISP };

  const errorRowsIPP = rowsIPP.filter((row) =>
    rowHasValidationIssues(row, "IPP", config, { ...baseCtx, duplicadosCartilla: dupsIPP })
  );
  const errorRowsISP = rowsISP.filter((row) =>
    rowHasValidationIssues(row, "ISP", config, { ...baseCtx, duplicadosCartilla: dupsISP })
  );

  const totalErrors = errorRowsIPP.length + errorRowsISP.length;
  const hasIssues =
    totalErrors > 0 || dupsIPP.length > 0 || dupsISP.length > 0 || soloEnIPP.length > 0 || soloEnISP.length > 0;

  return {
    fecha,
    rowsIPP,
    rowsISP,
    errorRowsIPP,
    errorRowsISP,
    lotesIPP,
    lotesISP,
    dupsIPP,
    dupsISP,
    soloEnIPP,
    soloEnISP,
    totalErrors,
    hasIssues
  };
}

export function applyPlagasCellValidation(td, idx, rawVal, ctx, config) {
  const val = cellDisplayValue(rawVal);
  td.textContent = val;

  if (isDuplicateLoteCell(idx, rawVal, ctx)) {
    paintValueError(td, "Duplicado");
    return;
  }

  getCellValidationIssues(idx, rawVal, ctx, config).forEach((issue) => {
    if (issue.kind === "empty") paintEmpty(td, issue.message);
    else paintValueError(td, issue.message);
  });
}

export function buildSyncFooterHtml(lotesIPP, lotesISP) {
  const soloEnIPP = lotesIPP.filter((l) => !lotesISP.includes(l));
  const soloEnISP = lotesISP.filter((l) => !lotesIPP.includes(l));
  let html = "";
  if (soloEnIPP.length) {
    html += `<br><span class="agv-mp-sync-warn">LOTE : ${soloEnIPP.join(", ")} se tiene en IPP PERO NO EN ISP</span>`;
  }
  if (soloEnISP.length) {
    html += `<br><span class="agv-mp-sync-warn">LOTE : ${soloEnISP.join(", ")} se tiene en ISP PERO NO EN IPP</span>`;
  }
  if (!html) {
    html = '<span class="agv-mp-sync-ok">✅ Sincronización OK</span>';
  }
  return html;
}

export function buildDuplicateAlertHtml(dupsIPP, dupsISP) {
  let html = "";
  if (dupsIPP.length) html += `<b>Duplicados en IPP:</b> ${dupsIPP.join(", ")}<br>`;
  if (dupsISP.length) html += `<b>Duplicados en ISP:</b> ${dupsISP.join(", ")}`;
  return html;
}
