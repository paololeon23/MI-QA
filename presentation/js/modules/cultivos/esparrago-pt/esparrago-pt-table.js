/** Tabla PT Espárrago — sticky Id/Código/Usuario/Lote, menú columnas */

import {
  getVisualColsPt,
  getStickyColsPt,
  getProtectedColIndicesPt,
  getFilterClienteCol,
  getFilterFormatoCol,
  getColumnLabelsByIndex,
  getReglasOrigen
} from "./esparrago-pt.config.js";
import { isClientRegistered } from "./esparrago-pt-pesos.catalog.js";
import { applyCellValidation, formatCellDisplay } from "./esparrago-pt.validation.js";
import { hydrateLucideIcons } from "../../../utils/lucide-icon.util.js";
import {
  applyPtColumnVisibility,
  bindColumnContextMenu,
  bindCopyableCells
} from "../arandano-pt/arandano-pt-table.js";
import {
  getColumnHintFromReglas,
  resolveColumnLabel
} from "../../../../../engine/cartilla-rules.adapter.js";

/** Anchos fijos sticky — mismos valores que arándano MP (contiguos sin cols 2–5). */
const ESPARRAGO_STICKY_COL_WIDTHS = {
  0: 90,
  1: 108,
  6: 246,
  9: 130
};

function syncEsparragoPtColgroup(tableEl, visualCols) {
  if (!tableEl) return;
  let cg = tableEl.querySelector("colgroup");
  if (!cg) {
    cg = document.createElement("colgroup");
    tableEl.insertBefore(cg, tableEl.firstChild);
  }
  cg.replaceChildren();
  visualCols.forEach((excelCol, displayIdx) => {
    const col = document.createElement("col");
    col.className = "agv-pt-col-data";
    col.dataset.colIndex = String(displayIdx);
    col.dataset.excelCol = String(excelCol);
    const stickyWidth = ESPARRAGO_STICKY_COL_WIDTHS[excelCol];
    if (stickyWidth != null) col.style.width = `${stickyWidth}px`;
    cg.appendChild(col);
  });
}

function applySticky(el, excelCol) {
  if (!getStickyColsPt().includes(excelCol)) return;
  el.classList.add("agv-pt-sticky-col", `agv-pt-sticky-col-${excelCol}`);
}

function makeCopyableCell(td, rawValue) {
  const text = String(rawValue ?? "").trim();
  if (!text) return;
  td.classList.add("agv-pt-cell-copy");
  td.dataset.copyValue = text;
  const hasError =
    td.classList.contains("agv-pt-cell-error-empty") ||
    td.classList.contains("agv-pt-cell-error-value");
  if (!hasError) {
    td.title = `Clic para copiar: ${text}`;
  } else if (td.title) {
    td.title = `${td.title} · Clic para copiar`;
  }
}

function buildPlainHeader(th, excelCol, displayIdx, headers, columnLabelsByIndex, reglas) {
  th.className = "agv-pt-data-header";
  th.dataset.colIndex = String(displayIdx);
  th.dataset.excelCol = String(excelCol);
  const label = resolveColumnLabel(excelCol, headers, columnLabelsByIndex);
  const hint = getColumnHintFromReglas(reglas, excelCol);
  th.textContent = label;
  th.title = hint
    ? `${hint} — clic para ocultar/mostrar columnas`
    : `${label} — clic para ocultar/mostrar columnas`;
  applySticky(th, excelCol);
}

function buildFilterHeader(th, excelCol, displayIdx, label, selectId) {
  th.className = "agv-pt-data-header agv-pt-data-header--filter";
  th.dataset.colIndex = String(displayIdx);
  th.dataset.excelCol = String(excelCol);
  th.innerHTML = `
    <div class="agv-pt-filter-head">
      <span class="agv-pt-filter-head__label">${label}</span>
      <select id="${selectId}" class="agv-pt-filter-select">
        <option value="TODOS">Todos</option>
      </select>
    </div>`;
  applySticky(th, excelCol);
}

function populateFilterSelect(selectEl, valores, valorActual, isClienteFilter) {
  if (!selectEl) return;
  selectEl.innerHTML = '<option value="TODOS">Todos</option>';
  valores.forEach((v) => {
    const opt = document.createElement("option");
    opt.value = v;
    if (v === valorActual) opt.selected = true;
    if (isClienteFilter && !isClientRegistered(v)) {
      opt.classList.add("agv-pt-filter-option--invalid");
      opt.textContent = `❌ ${v}`;
    } else {
      opt.textContent = v;
    }
    selectEl.appendChild(opt);
  });
}

function renderBodyRows(tbody, rows, tableEl) {
  tbody.innerHTML = "";
  rows.forEach((row) => {
    const tr = document.createElement("tr");
    getVisualColsPt().forEach((excelCol, displayIdx) => {
      const td = document.createElement("td");
      td.dataset.colIndex = String(displayIdx);
      td.dataset.excelCol = String(excelCol);
      td.textContent = formatCellDisplay(row[excelCol], excelCol, row);
      applyCellValidation(td, row, excelCol, row[excelCol]);
      applySticky(td, excelCol);
      if (excelCol === 0 || excelCol === 9) makeCopyableCell(td, row[excelCol]);
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  if (tableEl?._ptHiddenCols) {
    ensureProtectedColsVisible(tableEl);
    applyPtColumnVisibility(tableEl);
  }
}

function ensureProtectedColsVisible(tableEl) {
  if (!tableEl?._ptHiddenCols) return;
  getProtectedColIndicesPt().forEach((idx) => tableEl._ptHiddenCols.delete(idx));
}

function openColMenuForHeader(tableEl, menuEl, th) {
  const colIndex = Number(th.dataset.colIndex);
  if (!Number.isFinite(colIndex)) return;
  if (!tableEl._ptHiddenCols) tableEl._ptHiddenCols = new Set();
  ensureProtectedColsVisible(tableEl);

  const hideBtn = menuEl.querySelector('[data-action="hide"]');
  const showAllBtn = menuEl.querySelector('[data-action="show-all"]');
  const visibleCount = tableEl.querySelectorAll("thead th[data-col-index]:not(.agv-pt-col-hidden)").length;
  const isProtected = getProtectedColIndicesPt().has(colIndex);
  if (hideBtn) {
    hideBtn.disabled = isProtected || tableEl._ptHiddenCols.has(colIndex) || visibleCount <= 1;
  }
  if (showAllBtn) showAllBtn.disabled = tableEl._ptHiddenCols.size === 0;

  if (!menuEl.hidden && menuEl.parentElement === th) {
    menuEl.hidden = true;
    document.getElementById("agv-pt-table-wrap")?.appendChild(menuEl);
    return;
  }
  if (!menuEl.hidden) {
    menuEl.hidden = true;
    document.getElementById("agv-pt-table-wrap")?.appendChild(menuEl);
  }
  th.appendChild(menuEl);
  menuEl.hidden = false;
  hydrateLucideIcons(menuEl);
}

export function bindEsparragoPtColumnMenu(tableEl, menuEl) {
  bindColumnContextMenu(tableEl, menuEl, { protectedColIndices: getProtectedColIndicesPt() });
  if (!tableEl || tableEl.dataset.colClickBound === "1") return;
  tableEl.dataset.colClickBound = "1";
  tableEl.querySelector("thead")?.addEventListener("click", (e) => {
    if (e.target.closest("select, option, .agv-pt-filter-select")) return;
    const th = e.target.closest("th.agv-pt-data-header[data-col-index]");
    if (!th || !tableEl.contains(th)) return;
    e.preventDefault();
    e.stopPropagation();
    openColMenuForHeader(tableEl, menuEl, th);
  });
}

export function renderEsparragoPtTable({
  headerRow,
  bodyRows,
  headers,
  tableEl,
  allRowsForDate,
  filteredRows,
  onFilterChange
}) {
  headerRow.innerHTML = "";

  const columnLabelsByIndex = getColumnLabelsByIndex();
  const reglas = getReglasOrigen();

  getVisualColsPt().forEach((excelCol, displayIdx) => {
    const th = document.createElement("th");
    const filterClienteCol = getFilterClienteCol();
    const filterFormatoCol = getFilterFormatoCol();
    if (excelCol === filterClienteCol) {
      buildFilterHeader(
        th,
        excelCol,
        displayIdx,
        resolveColumnLabel(excelCol, headers, columnLabelsByIndex) || "Cliente Esp.",
        "agv-pt-filter-cliente"
      );
    } else if (excelCol === filterFormatoCol) {
      buildFilterHeader(
        th,
        excelCol,
        displayIdx,
        resolveColumnLabel(excelCol, headers, columnLabelsByIndex) || "Formato Asp",
        "agv-pt-filter-formato"
      );
    } else {
      buildPlainHeader(th, excelCol, displayIdx, headers, columnLabelsByIndex, reglas);
    }
    headerRow.appendChild(th);
  });

  if (tableEl) {
    tableEl.classList.add("agv-pt-table--esparrago");
    syncEsparragoPtColgroup(tableEl, getVisualColsPt());
    if (!tableEl._ptHiddenCols) tableEl._ptHiddenCols = new Set();
    ensureProtectedColsVisible(tableEl);
    delete tableEl.dataset.filtersBound;
  }

  bindCopyableCells(bodyRows);

  const refreshFilters = (dataActual, clienteVal, formatoVal) => {
    const clienteSel = document.getElementById("agv-pt-filter-cliente");
    const formatoSel = document.getElementById("agv-pt-filter-formato");
    const dataParaCliente = formatoVal === "TODOS" ? allRowsForDate : dataActual;
    const dataParaFormato = clienteVal === "TODOS" ? allRowsForDate : dataActual;
    const clientes = [...new Set(dataParaCliente.map((r) => String(r[getFilterClienteCol()] ?? "").trim()))].filter(Boolean).sort();
    const formatos = [...new Set(dataParaFormato.map((r) => String(r[getFilterFormatoCol()] ?? "").trim()))].filter(Boolean).sort();
    populateFilterSelect(clienteSel, clientes, clienteVal, true);
    populateFilterSelect(formatoSel, formatos, formatoVal, false);
  };

  const ejecutarFiltro = () => {
    const clienteVal = document.getElementById("agv-pt-filter-cliente")?.value || "TODOS";
    const formatoVal = document.getElementById("agv-pt-filter-formato")?.value || "TODOS";
    const dataFinal = allRowsForDate.filter((r) => {
      const matchCli = clienteVal === "TODOS" || String(r[getFilterClienteCol()] ?? "").trim() === clienteVal;
      const matchFor = formatoVal === "TODOS" || String(r[getFilterFormatoCol()] ?? "").trim() === formatoVal;
      return matchCli && matchFor;
    });
    renderBodyRows(bodyRows, dataFinal, tableEl);
    refreshFilters(dataFinal, clienteVal, formatoVal);
    onFilterChange?.(dataFinal.length, dataFinal);
  };

  renderBodyRows(bodyRows, filteredRows, tableEl);
  refreshFilters(filteredRows, "TODOS", "TODOS");

  if (!tableEl?.dataset.filtersBound) {
    if (tableEl) tableEl.dataset.filtersBound = "1";
    document.getElementById("agv-pt-filter-cliente")?.addEventListener("change", ejecutarFiltro);
    document.getElementById("agv-pt-filter-formato")?.addEventListener("change", ejecutarFiltro);
  }

  return ejecutarFiltro;
}

export function bindTableSearch(inputEl, tbody) {
  if (!inputEl || !tbody) return;
  inputEl.addEventListener("input", () => {
    const term = inputEl.value.trim().toUpperCase();
    tbody.querySelectorAll("tr").forEach((tr) => {
      if (!term) {
        tr.classList.remove("agv-pt-row--search-hidden");
        return;
      }
      let idText = "";
      let loteText = "";
      tr.querySelectorAll("td[data-excel-col]").forEach((td) => {
        if (td.dataset.excelCol === "0") idText = td.textContent.trim().toUpperCase();
        if (td.dataset.excelCol === "9") loteText = td.textContent.trim().toUpperCase();
      });
      tr.classList.toggle("agv-pt-row--search-hidden", !(idText.includes(term) || loteText.includes(term)));
    });
  });
}
