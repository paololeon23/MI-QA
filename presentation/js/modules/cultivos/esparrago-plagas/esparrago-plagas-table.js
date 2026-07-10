/** Tabla Plagas Espárrago */

import { applyPlagasCellValidation, cellDisplayValue } from "./esparrago-plagas.validation.js";
import { resolveColumnLabel } from "./esparrago-plagas-rules.helper.js";

function applySticky(el, excelCol, stickyCols) {
  if (!stickyCols.includes(excelCol)) return;
  el.classList.add("agv-mp-sticky-col", `agv-mp-sticky-col-${excelCol}`);
}

export function renderPlagasEsparragoTable({
  headerRow,
  bodyRows,
  headers,
  rows,
  tipo,
  config,
  syncContext,
  columnLabelsByIndex = {}
}) {
  const visibleCols = config.columnas_visibles_frontend.indices_js;
  const stickyCols = config.columnas_sticky || [0, 1, 6, 9];
  const loteIdx = 9;

  headerRow.innerHTML = "";
  visibleCols.forEach((idx) => {
    const th = document.createElement("th");
    th.className = "agv-mp-table__col-header";
    th.textContent = resolveColumnLabel(idx, headers, columnLabelsByIndex, config);
    applySticky(th, idx, stickyCols);
    headerRow.appendChild(th);
  });

  bodyRows.innerHTML = "";
  const ctx = {
    tipo,
    duplicadosCartilla: syncContext.duplicadosCartilla,
    lotesIPP: syncContext.lotesIPP,
    lotesISP: syncContext.lotesISP
  };

  rows.forEach((row) => {
    const tr = document.createElement("tr");
    visibleCols.forEach((idx) => {
      const td = document.createElement("td");
      td.dataset.excelCol = String(idx);
      applySticky(td, idx, stickyCols);
      if (idx === loteIdx) {
        applyPlagasCellValidation(td, idx, row[idx], ctx, config);
      } else {
        applyPlagasCellValidation(td, idx, row[idx], ctx, config);
      }
      tr.appendChild(td);
    });
    bodyRows.appendChild(tr);
  });

  return rows.length;
}

export function formatInspectionDateOption(val) {
  return cellDisplayValue(val);
}
