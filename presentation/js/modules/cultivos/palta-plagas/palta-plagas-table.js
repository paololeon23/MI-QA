/** Tabla de resultados — Plagas Palta (solo filas con error) */

import { COLUMNS_TO_SHOW, resolveColumnLabel } from "./palta-plagas.config.js";
import {
  applyPlagasCellValidation,
  cellDisplayValue,
  getCellValidationIssues,
  rowHasMarkedErrors
} from "./palta-plagas.validation.js";
import { translateExcelHeader } from "../../../utils/excel-header-i18n.util.js";
import { refreshTranslatedHeaderRow } from "../../../utils/table-header-i18n.util.js";

function applySticky(el, excelCol, stickyCols) {
  if (!stickyCols.includes(excelCol)) return;
  el.classList.add("agv-mp-sticky-col", `agv-mp-sticky-col-${excelCol}`);
}

function columnHasError(row, idx, ctx, config) {
  if (idx === 9 && row._errorLote) return true;
  const pref = `Columna ${idx + 1}: `;
  if ((row._errors || []).some((e) => e.startsWith(pref))) return true;
  return getCellValidationIssues(idx, row[idx], ctx, config).length > 0;
}

export function renderPaltaPlagasTable({
  headerRow,
  bodyRows,
  headers,
  rows,
  config,
  syncContext,
  columnLabelsByIndex = {},
  t
}) {
  const visibleCols = config.columnas_visibles_frontend?.indices_js || COLUMNS_TO_SHOW;
  const stickyCols = config.columnas_sticky || [0, 1, 6, 9];
  const errorRows = rows.filter((r) => rowHasMarkedErrors(r));
  const ctx = { duplicadosLote: syncContext.duplicadosLote };

  headerRow.replaceChildren();
  visibleCols.forEach((idx) => {
    const th = document.createElement("th");
    th.className = "agv-mp-table__col-header";
    const rawLabel = resolveColumnLabel(idx, headers, columnLabelsByIndex, config);
    th.dataset.colIndex = String(idx);
    th.dataset.excelHeader = rawLabel;
    th.textContent = translateExcelHeader(rawLabel, idx);
    th.title = th.textContent;
    applySticky(th, idx, stickyCols);
    if (idx >= 99 && idx <= 131) th.classList.add("agv-mp-col-texto-wrap");
    headerRow.appendChild(th);
  });

  bodyRows.replaceChildren();

  if (!errorRows.length) {
    const tr = document.createElement("tr");
    tr.className = "agv-mp-row-ok";
    const td = document.createElement("td");
    td.colSpan = Math.max(visibleCols.length, 1);
    td.className = "agv-mp-results-empty";
    td.textContent = t("plagasArandano.noErrorsOnInspection");
    tr.appendChild(td);
    bodyRows.appendChild(tr);
    return { errorCount: 0, totalRows: rows.length };
  }

  errorRows.forEach((row) => {
    const tr = document.createElement("tr");
    const rowCtx = { ...ctx, row };
    visibleCols.forEach((idx) => {
      const td = document.createElement("td");
      td.dataset.excelCol = String(idx);
      applySticky(td, idx, stickyCols);
      if (idx >= 99 && idx <= 131) td.classList.add("agv-mp-col-texto-wrap");

      const val = cellDisplayValue(row[idx]);
      td.textContent = val;
      if (val) td.title = val;

      if (columnHasError(row, idx, rowCtx, config)) {
        applyPlagasCellValidation(td, idx, row[idx], rowCtx, config);
      }
      tr.appendChild(td);
    });
    bodyRows.appendChild(tr);
  });

  return { errorCount: errorRows.length, totalRows: rows.length };
}

export function renderNestedErrorTableHtml(filas, headers, config, columnLabelsByIndex, htmlEscape, t) {
  if (!filas?.length) return "";
  const visibleCols = config.columnas_visibles_frontend?.indices_js || COLUMNS_TO_SHOW;

  const thead = visibleCols
    .map((idx) => {
      const label = translateExcelHeader(resolveColumnLabel(idx, headers, columnLabelsByIndex, config), idx);
      const wrapCls = idx >= 99 && idx <= 131 ? ' class="agv-mp-col-texto-wrap"' : "";
      return `<th${wrapCls} scope="col">${htmlEscape(label)}</th>`;
    })
    .join("");

  const tbody = filas
    .map((row) => {
      const rowCtx = { row, duplicadosLote: [] };
      const tds = visibleCols
        .map((idx) => {
          const val = cellDisplayValue(row[idx]);
          let cls = "";
          if (row._errorLote && idx === 9) cls = val ? "agv-mp-cell-error-value" : "agv-mp-cell-error-empty";
          else if ((row._errors || []).some((e) => e.startsWith(`Columna ${idx + 1}: `))) {
            cls = val ? "agv-mp-cell-error-value" : "agv-mp-cell-error-empty";
          }
          const wrapCls = idx >= 99 && idx <= 131 ? " agv-mp-col-texto-wrap" : "";
          return `<td class="${cls}${wrapCls}">${htmlEscape(val)}</td>`;
        })
        .join("");
      return `<tr>${tds}</tr>`;
    })
    .join("");

  return `
    <div class="agv-mp-nested-table-wrap">
      <div class="agv-mp-table-scroll">
        <table class="agv-mp-table">
          <thead><tr>${thead}</tr></thead>
          <tbody>${tbody}</tbody>
        </table>
      </div>
    </div>`;
}

export function refreshPaltaPlagasHeaderLabels(headerRow, headers, columnLabelsByIndex, config) {
  refreshTranslatedHeaderRow(headerRow, (idx) =>
    resolveColumnLabel(idx, headers, columnLabelsByIndex, config)
  );
}
