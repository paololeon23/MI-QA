/** Refresco de cabeceras traducidas sin revalidar (display only). */

import { translateExcelHeader } from "./excel-header-i18n.util.js";

/**
 * Actualiza textos de &lt;th&gt; con data-excel-header o data-col-index.
 * @param {HTMLElement|null} headerRow
 * @param {(colIndex: number) => string} [resolveRawHeader]
 */
export function refreshTranslatedHeaderRow(headerRow, resolveRawHeader) {
  if (!headerRow) return;
  headerRow.querySelectorAll("th").forEach((th) => {
    const idx = Number(th.dataset.colIndex ?? th.dataset.excelCol);
    let raw = th.dataset.excelHeader;
    if ((raw == null || raw === "") && Number.isFinite(idx) && typeof resolveRawHeader === "function") {
      raw = resolveRawHeader(idx);
    }
    if (raw == null || raw === "") {
      if (th.querySelector(".agv-pt-filter-head__label, .agv-mp-filter-head__label")) {
        return;
      }
      return;
    }
    const label = translateExcelHeader(raw, Number.isFinite(idx) ? idx : -1);
    const filterLabel = th.querySelector(
      ".agv-pt-filter-head__label, .agv-mp-filter-head__label, .agv-pt-filter-head__label"
    );
    if (filterLabel) {
      filterLabel.textContent = label;
      return;
    }
    const keep = [...th.children];
    th.textContent = label;
    keep.forEach((el) => th.appendChild(el));
  });
}

export function setTranslatedHeaderCell(th, rawHeader, colIndex) {
  if (!th) return;
  const raw = String(rawHeader ?? "");
  th.dataset.excelHeader = raw;
  if (colIndex != null && Number.isFinite(Number(colIndex))) {
    th.dataset.colIndex = String(colIndex);
  }
  th.textContent = translateExcelHeader(raw, Number(colIndex));
}
