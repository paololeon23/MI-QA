/** Tabla Palta MP — columnas configuradas a validar + suma calibres (solo UI), Fragment DOM */

import {
  getPaltaMpValidaciones,
  getStickyCols,
  getTotalColumnas
} from "./palta-mp.config.js";
import {
  EXTRA_COL_SUMA_CALIBRES,
  getCellMeta,
  formatFechaCelda,
  valorCelda
} from "./palta-mp.validation.js";
import { hydrateLucideIcons } from "../../../utils/lucide-icon.util.js";
import {
  resolveSapZoneHeader,
  SAP_ZONE_HEADER_LABELS_BY_JS
} from "../shared/mp-results-perf.util.js";
import { translateExcelHeader } from "../../../utils/excel-header-i18n.util.js";
import { refreshTranslatedHeaderRow } from "../../../utils/table-header-i18n.util.js";

const SUMA_CALIBRES_HEADER = "Σ Calibres 36–50 vs Cant. muestra";

function isPinnedColumn(index) {
  return typeof index === "number" && getStickyCols().includes(index);
}

export function applyStickyColumnClasses(el, index) {
  if (!isPinnedColumn(index)) return;
  el.classList.add("agv-mp-sticky-col", `agv-mp-sticky-col-${index}`);
}

function formatCellDisplay(row, colJs) {
  if (colJs === EXTRA_COL_SUMA_CALIBRES) {
    return getCellMeta(row, colJs).val;
  }
  const raw = row[colJs];
  if ([19, 63, 64].includes(colJs)) return formatFechaCelda(raw);
  return valorCelda(raw);
}

function formatPaltaHeader(headers, colJs) {
  if (colJs === EXTRA_COL_SUMA_CALIBRES) return SUMA_CALIBRES_HEADER;
  const excelHeader = headers?.[colJs] || "";
  if (SAP_ZONE_HEADER_LABELS_BY_JS[colJs] != null) {
    return resolveSapZoneHeader(colJs, excelHeader).label;
  }
  return translateExcelHeader(excelHeader, colJs);
}

function paltaHeaderTitle(headers, colJs) {
  if (colJs === EXTRA_COL_SUMA_CALIBRES) {
    return "Columna solo frontend: suma Excel 36–50 debe ser igual a Cant. muestra (11)";
  }
  const excelHeader = headers?.[colJs] || "";
  if (SAP_ZONE_HEADER_LABELS_BY_JS[colJs] != null) {
    return resolveSapZoneHeader(colJs, excelHeader).title;
  }
  return formatPaltaHeader(headers, colJs);
}

function isRealColumnIndex(i, totalCols) {
  return typeof i === "number" && Number.isFinite(i) && i >= 0 && i < totalCols;
}

/** Orden fijo de columnas_visibles_frontend; errores fuera de lista van al final. */
function pickPaltaColumnIndexes(totalCols, filas) {
  const cfg = getPaltaMpValidaciones();
  const ordered = (cfg?.columnas_visibles_frontend?.indices_js || []).filter(
    (i) => i === EXTRA_COL_SUMA_CALIBRES || isRealColumnIndex(i, totalCols)
  );
  const seen = new Set(ordered);

  const extraErrors = [];
  (filas || []).forEach((row) => {
    row._errorCols?.forEach((colJs) => {
      if (isRealColumnIndex(colJs, totalCols) && !seen.has(colJs)) {
        seen.add(colJs);
        extraErrors.push(colJs);
      }
    });
  });
  extraErrors.sort((a, b) => a - b);
  return [...ordered, ...extraErrors];
}

export function renderPaltaMpResultsTable({
  refs,
  headers,
  allRows,
  filasConError,
  fechaISO,
  formatISOToDMY,
  t
}) {
  const { resultsHeader, resultsBody, resultsTable, resultsSection, resultsTitleEl, resultsSubtitleEl, resultsIconEl, totalFilasDiv } =
    refs;

  if (resultsHeader) resultsHeader.innerHTML = "";
  if (resultsBody) resultsBody.innerHTML = "";

  const hasErrors = filasConError.length > 0;
  const shellCls = (part) => `agv-mp-${part}`;
  const totalCols = headers.length || getTotalColumnas();
  const colIndexes = pickPaltaColumnIndexes(totalCols, filasConError);

  if (resultsSection) {
    resultsSection.classList.remove(`${shellCls("results")}--ok`, `${shellCls("results")}--errors`);
    resultsSection.classList.add(hasErrors ? `${shellCls("results")}--errors` : `${shellCls("results")}--ok`);
    resultsSection.classList.add("is-visible");
  }

  if (resultsTitleEl) {
    resultsTitleEl.textContent = hasErrors
      ? t("plagasPalta.errorRowsTitle")
      : t("plagasArandano.allCorrect");
  }

  if (resultsSubtitleEl) {
    resultsSubtitleEl.textContent = t("plagasArandano.resultsInspectionDate", {
      date: formatISOToDMY(fechaISO)
    });
  }

  if (resultsIconEl) {
    resultsIconEl.innerHTML = hasErrors
      ? '<i data-lucide="triangle-alert"></i>'
      : '<i data-lucide="circle-check"></i>';
  }

  if (totalFilasDiv) {
    totalFilasDiv.textContent = t("paltaMp.totalInspectionRows", { count: allRows.length });
  }

  if (resultsTable) {
    resultsTable.classList.add("agv-mp-table--palta");
    resultsTable.hidden = false;
  }

  if (!hasErrors) {
    const tr = document.createElement("tr");
    tr.className = "agv-mp-row-ok";
    const td = document.createElement("td");
    td.colSpan = Math.max(colIndexes.length || totalCols, 1);
    td.textContent = t("paltaMp.noInspectionErrors");
    tr.appendChild(td);
    resultsBody?.appendChild(tr);
    if (resultsIconEl) hydrateLucideIcons(resultsIconEl);
    return;
  }

  const headerFrag = document.createDocumentFragment();
  colIndexes.forEach((i) => {
    const th = document.createElement("th");
    th.className = "agv-mp-table__col-header";
    if (i === EXTRA_COL_SUMA_CALIBRES) th.classList.add("agv-mp-table__col-header--suma");
    th.dataset.colIndex = String(i);
    th.dataset.excelHeader =
      i === EXTRA_COL_SUMA_CALIBRES ? SUMA_CALIBRES_HEADER : String(headers[i] || "");
    th.textContent = formatPaltaHeader(headers, i);
    th.title = paltaHeaderTitle(headers, i);
    if (typeof i === "number" && SAP_ZONE_HEADER_LABELS_BY_JS[i] != null) {
      th.classList.add("agv-mp-table__col-header--sap");
    }
    applyStickyColumnClasses(th, i);
    headerFrag.appendChild(th);
  });
  resultsHeader?.appendChild(headerFrag);

  const bodyFrag = document.createDocumentFragment();
  filasConError.forEach((row) => {
    const tr = document.createElement("tr");
    colIndexes.forEach((colJs) => {
      const { val, cellClass, title } = getCellMeta(row, colJs);
      const td = document.createElement("td");
      td.dataset.colIndex = String(colJs);
      if (cellClass) td.className = cellClass;
      if (title) td.title = title;
      td.textContent = val ?? formatCellDisplay(row, colJs);
      applyStickyColumnClasses(td, colJs);
      tr.appendChild(td);
    });
    bodyFrag.appendChild(tr);
  });
  resultsBody?.appendChild(bodyFrag);
  if (resultsIconEl) hydrateLucideIcons(resultsIconEl);
}

export function htmlTablaFilasConError(headers, filas, { htmlEscape, t, titled = true }) {
  if (!filas?.length) return "";

  const totalCols = headers.length || getTotalColumnas();
  const colIndexes = pickPaltaColumnIndexes(totalCols, filas);

  const thead = colIndexes
    .map((i) => {
      const sticky = isPinnedColumn(i) ? ` agv-mp-sticky-col agv-mp-sticky-col-${i}` : "";
      const sap =
        typeof i === "number" && SAP_ZONE_HEADER_LABELS_BY_JS[i] != null
          ? " agv-mp-table__col-header--sap"
          : "";
      const suma = i === EXTRA_COL_SUMA_CALIBRES ? " agv-mp-table__col-header--suma" : "";
      const title = htmlEscape(paltaHeaderTitle(headers, i));
      return `<th class="agv-mp-table__col-header${sticky}${sap}${suma}" title="${title}">${htmlEscape(formatPaltaHeader(headers, i))}</th>`;
    })
    .join("");

  const tbody = filas
    .map((row) => {
      const tds = colIndexes
        .map((colJs) => {
          const { val, cellClass, title } = getCellMeta(row, colJs);
          const sticky = isPinnedColumn(colJs) ? `agv-mp-sticky-col agv-mp-sticky-col-${colJs}` : "";
          const classes = [cellClass, sticky].filter(Boolean).join(" ");
          const classAttr = classes ? ` class="${htmlEscape(classes)}"` : "";
          const titleAttr = title ? ` title="${htmlEscape(title)}"` : "";
          return `<td${classAttr}${titleAttr}>${htmlEscape(val)}</td>`;
        })
        .join("");
      return `<tr>${tds}</tr>`;
    })
    .join("");

  const titleBlock = titled
    ? `<p class="agv-mp-nested-table-title">${htmlEscape(t("plagasPalta.errorRowsTitle"))}</p>`
    : "";

  return `
    <div class="agv-mp-nested-table-wrap">
      ${titleBlock}
      <div class="agv-mp-table-scroll">
        <table class="agv-mp-table agv-mp-table--palta">
          <thead><tr>${thead}</tr></thead>
          <tbody>${tbody}</tbody>
        </table>
      </div>
    </div>`;
}

export function refreshPaltaMpHeaderLabels(headerRow, headers) {
  refreshTranslatedHeaderRow(headerRow, (idx) => {
    if (idx === EXTRA_COL_SUMA_CALIBRES || String(idx) === EXTRA_COL_SUMA_CALIBRES) {
      return SUMA_CALIBRES_HEADER;
    }
    const n = Number(idx);
    return formatPaltaHeader(headers, Number.isFinite(n) ? n : idx);
  });
}
