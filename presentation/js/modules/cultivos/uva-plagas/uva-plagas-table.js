/** Tabla de resultados — Plagas Uva (solo filas con error) */

import { COLUMNS_TO_SHOW, LOTE_IDX, resolveColumnLabel } from "./uva-plagas.config.js";
import {
  applyPlagasCellValidation,
  cellDisplayValue,
  getCellValidationIssues,
  rowHasMarkedErrors
} from "./uva-plagas.validation.js";

const SUMMARY_COL_MIN = 79;
const SUMMARY_COL_MAX = 104;

function applySticky(el, excelCol, stickyCols) {
  if (!stickyCols.includes(excelCol)) return;
  el.classList.add("agv-mp-sticky-col", `agv-mp-sticky-col-${excelCol}`);
}

function isSummaryCol(idx) {
  return idx >= SUMMARY_COL_MIN && idx <= SUMMARY_COL_MAX;
}

function columnHasError(row, idx, ctx, config) {
  if (idx === LOTE_IDX && row._errorLote) return true;
  const pref = `Columna ${idx + 1}: `;
  if ((row._errors || []).some((e) => e.startsWith(pref))) return true;
  return getCellValidationIssues(idx, row[idx], ctx, config).length > 0;
}

export function renderUvaPlagasTable({
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
    th.textContent = resolveColumnLabel(idx, headers, columnLabelsByIndex, config);
    th.title = th.textContent;
    applySticky(th, idx, stickyCols);
    if (isSummaryCol(idx)) th.classList.add("agv-mp-col-texto-wrap");
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
      if (isSummaryCol(idx)) td.classList.add("agv-mp-col-texto-wrap");

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
  const stickyCols = config.columnas_sticky || [0, 1, 6, 9];

  const thead = visibleCols
    .map((idx) => {
      const label = resolveColumnLabel(idx, headers, columnLabelsByIndex, config);
      const classes = ["agv-mp-table__col-header"];
      if (stickyCols.includes(idx)) {
        classes.push("agv-mp-sticky-col", `agv-mp-sticky-col-${idx}`);
      }
      if (isSummaryCol(idx)) classes.push("agv-mp-col-texto-wrap");
      const classAttr = classes.length ? ` class="${classes.join(" ")}"` : "";
      return `<th${classAttr} scope="col">${htmlEscape(label)}</th>`;
    })
    .join("");

  const tbody = filas
    .map((row) => {
      const tds = visibleCols
        .map((idx) => {
          const val = cellDisplayValue(row[idx]);
          const classes = [];
          if (row._errorLote && idx === LOTE_IDX) {
            classes.push(val ? "agv-mp-cell-error-value" : "agv-mp-cell-error-empty");
          } else if ((row._errors || []).some((e) => e.startsWith(`Columna ${idx + 1}: `))) {
            classes.push(val ? "agv-mp-cell-error-value" : "agv-mp-cell-error-empty");
          }
          if (stickyCols.includes(idx)) {
            classes.push("agv-mp-sticky-col", `agv-mp-sticky-col-${idx}`);
          }
          if (isSummaryCol(idx)) classes.push("agv-mp-col-texto-wrap");
          const classAttr = classes.length ? ` class="${classes.join(" ")}"` : "";
          return `<td${classAttr}>${htmlEscape(val)}</td>`;
        })
        .join("");
      return `<tr>${tds}</tr>`;
    })
    .join("");

  return `
    <div class="agv-mp-nested-table-wrap">
      <div class="agv-mp-table-scroll">
        <table class="agv-mp-table agv-mp-table--uva">
          <thead><tr>${thead}</tr></thead>
          <tbody>${tbody}</tbody>
        </table>
      </div>
    </div>`;
}
