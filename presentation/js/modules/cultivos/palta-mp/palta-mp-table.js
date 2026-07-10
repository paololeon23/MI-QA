/** Tabla Palta MP — 157 columnas, sticky, filas con error */

import { getStickyCols, getTotalColumnas } from "./palta-mp.config.js";
import {
  filaTieneError,
  getCellMeta,
  formatFechaCelda,
  valorCelda
} from "./palta-mp.validation.js";
import { hydrateLucideIcons } from "../../../utils/lucide-icon.util.js";

function isPinnedColumn(index) {
  return getStickyCols().includes(index);
}

export function applyStickyColumnClasses(el, index) {
  if (!isPinnedColumn(index)) return;
  el.classList.add("agv-mp-sticky-col", `agv-mp-sticky-col-${index}`);
}

function formatCellDisplay(row, colJs) {
  const raw = row[colJs];
  if ([19, 63, 64].includes(colJs)) return formatFechaCelda(raw);
  return valorCelda(raw);
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
    totalFilasDiv.textContent = `Total registros inspección: ${allRows.length}`;
  }

  if (resultsTable) {
    resultsTable.classList.add("agv-mp-table--palta");
    resultsTable.hidden = false;
  }

  const totalCols = headers.length || getTotalColumnas();

  if (!hasErrors) {
    const tr = document.createElement("tr");
    tr.className = "agv-mp-row-ok";
    const td = document.createElement("td");
    td.colSpan = Math.max(totalCols, 1);
    td.textContent = "No se encontraron errores en esta inspección";
    tr.appendChild(td);
    resultsBody?.appendChild(tr);
    return;
  }

  for (let i = 0; i < totalCols; i++) {
    const th = document.createElement("th");
    th.className = "agv-mp-table__col-header";
    th.dataset.colIndex = String(i);
    th.textContent = headers[i] || "";
    applyStickyColumnClasses(th, i);
    resultsHeader?.appendChild(th);
  }

  filasConError.forEach((row) => {
    const tr = document.createElement("tr");
    for (let colJs = 0; colJs < totalCols; colJs++) {
      const { val, cellClass, title } = getCellMeta(row, colJs);
      const td = document.createElement("td");
      td.dataset.colIndex = String(colJs);
      if (cellClass) td.className = cellClass;
      if (title) td.title = title;
      td.textContent = val ?? formatCellDisplay(row, colJs);
      applyStickyColumnClasses(td, colJs);
      tr.appendChild(td);
    }
    resultsBody?.appendChild(tr);
  });
}

export function htmlTablaFilasConError(headers, filas, { htmlEscape, t, titled = true }) {
  if (!filas?.length) return "";

  const totalCols = headers.length || getTotalColumnas();
  const thead = Array.from({ length: totalCols }, (_, i) => {
    const sticky = isPinnedColumn(i) ? ` agv-mp-sticky-col agv-mp-sticky-col-${i}` : "";
    return `<th class="agv-mp-table__col-header${sticky}">${htmlEscape(headers[i] || "")}</th>`;
  }).join("");

  const tbody = filas
    .map((row) => {
      const tds = Array.from({ length: totalCols }, (_, colJs) => {
        const { val, cellClass, title } = getCellMeta(row, colJs);
        const sticky = isPinnedColumn(colJs) ? `agv-mp-sticky-col agv-mp-sticky-col-${colJs}` : "";
        const classes = [cellClass, sticky].filter(Boolean).join(" ");
        const classAttr = classes ? ` class="${htmlEscape(classes)}"` : "";
        const titleAttr = title ? ` title="${htmlEscape(title)}"` : "";
        return `<td${classAttr}${titleAttr}>${htmlEscape(val)}</td>`;
      }).join("");
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

export { filaTieneError, hydrateLucideIcons };
