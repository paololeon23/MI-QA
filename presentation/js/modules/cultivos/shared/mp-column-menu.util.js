/**
 * Menú ocultar / mostrar columnas — tablas MP (mismo patrón que PT / Plagas).
 */

import { i18nService } from "../../../services/i18n.service.js";
import { hydrateLucideIcons } from "../../../utils/lucide-icon.util.js";

function closeMpColumnMenu(menuEl) {
  if (!menuEl) return;
  menuEl.hidden = true;
  const host = document.getElementById("agvMpApp");
  if (host && menuEl.parentElement !== host) host.appendChild(menuEl);
}

export function applyMpColumnVisibility(tableEl) {
  if (!tableEl?._mpHiddenCols) return;
  tableEl.querySelectorAll("[data-col-index]").forEach((el) => {
    const idx = Number(el.dataset.colIndex);
    if (!Number.isFinite(idx)) return;
    el.classList.toggle("agv-mp-col-hidden", tableEl._mpHiddenCols.has(idx));
  });
}

/**
 * @param {HTMLTableElement|null} tableEl
 * @param {HTMLElement|null} menuEl
 * @param {{ protectedColIndices?: Set<number>|number[], onVisibilityChange?: () => void }} [options]
 */
export function bindMpColumnContextMenu(tableEl, menuEl, options = {}) {
  if (!tableEl || !menuEl) return;
  if (!tableEl._mpHiddenCols) tableEl._mpHiddenCols = new Set();

  const protectedColIndices =
    options.protectedColIndices instanceof Set
      ? options.protectedColIndices
      : new Set(options.protectedColIndices || []);
  const isProtectedCol = (colIndex) => protectedColIndices.has(colIndex);

  if (!menuEl.querySelector("[data-action]")) {
    menuEl.className = menuEl.className || "agv-mp-col-menu";
    menuEl.setAttribute("role", "menu");
    menuEl.innerHTML = `
      <button type="button" class="agv-mp-col-menu__item" data-action="hide" role="menuitem">
        <i data-lucide="eye-off" aria-hidden="true"></i>
        <span>${i18nService.translate("plagasArandano.hideColumn")}</span>
      </button>
      <button type="button" class="agv-mp-col-menu__item" data-action="show-all" role="menuitem">
        <i data-lucide="columns-3" aria-hidden="true"></i>
        <span>${i18nService.translate("plagasArandano.showAllColumnsShort")}</span>
      </button>`;
    hydrateLucideIcons(menuEl);
  }

  if (tableEl.dataset.colMenuBound === "1") {
    applyMpColumnVisibility(tableEl);
    return;
  }
  tableEl.dataset.colMenuBound = "1";

  tableEl.addEventListener("contextmenu", (e) => {
    const th = e.target.closest("th.agv-mp-table__col-header[data-col-index], th[data-col-index]");
    if (!th || !tableEl.contains(th)) return;
    e.preventDefault();

    const colIndex = Number(th.dataset.colIndex);
    if (!Number.isFinite(colIndex)) return;

    const hideBtn = menuEl.querySelector('[data-action="hide"]');
    const showAllBtn = menuEl.querySelector('[data-action="show-all"]');
    const visibleCount = tableEl.querySelectorAll(
      "thead th[data-col-index]:not(.agv-mp-col-hidden)"
    ).length;
    if (hideBtn) {
      hideBtn.disabled =
        isProtectedCol(colIndex) ||
        tableEl._mpHiddenCols.has(colIndex) ||
        visibleCount <= 1;
    }
    if (showAllBtn) showAllBtn.disabled = tableEl._mpHiddenCols.size === 0;

    const rect = th.getBoundingClientRect();
    if (menuEl.parentElement !== document.body) document.body.appendChild(menuEl);
    menuEl.hidden = false;
    menuEl.dataset.colIndex = String(colIndex);
    menuEl.style.left = `${Math.min(rect.left, window.innerWidth - 180)}px`;
    menuEl.style.top = `${rect.bottom + 6}px`;
    hydrateLucideIcons(menuEl);
  });

  menuEl.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn || btn.disabled) return;
    e.preventDefault();
    e.stopPropagation();

    const colIndex = Number(menuEl.dataset.colIndex);

    if (btn.dataset.action === "hide" && Number.isFinite(colIndex)) {
      if (isProtectedCol(colIndex)) return;
      const visible = tableEl.querySelectorAll(
        "thead th[data-col-index]:not(.agv-mp-col-hidden)"
      ).length;
      if (visible <= 1) return;
      tableEl._mpHiddenCols.add(colIndex);
      applyMpColumnVisibility(tableEl);
      options.onVisibilityChange?.();
    } else if (btn.dataset.action === "show-all") {
      tableEl._mpHiddenCols.clear();
      applyMpColumnVisibility(tableEl);
      options.onVisibilityChange?.();
    }
    closeMpColumnMenu(menuEl);
  });

  document.addEventListener("click", (e) => {
    if (menuEl.hidden) return;
    if (menuEl.contains(e.target)) return;
    closeMpColumnMenu(menuEl);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMpColumnMenu(menuEl);
  });
}

/**
 * Buscador ID / Lote — mismo comportamiento que Arándano PT.
 * @param {HTMLInputElement|null} inputEl
 * @param {HTMLElement|null} tbody
 * @param {{ idColJs?: number, loteColJs?: number }} [options]
 */
export function bindMpTableSearch(inputEl, tbody, options = {}) {
  if (!inputEl || !tbody || inputEl.dataset.searchBound === "1") return;
  inputEl.dataset.searchBound = "1";
  const idCol = String(options.idColJs ?? 0);
  const loteCol = String(options.loteColJs ?? 9);

  inputEl.addEventListener("input", () => {
    const term = inputEl.value.trim().toUpperCase();
    tbody.querySelectorAll("tr").forEach((tr) => {
      if (!term) {
        tr.classList.remove("agv-mp-row--search-hidden");
        return;
      }
      let idText = "";
      let loteText = "";
      tr.querySelectorAll("td[data-col-index]").forEach((td) => {
        if (td.dataset.colIndex === idCol) idText = td.textContent.trim().toUpperCase();
        if (td.dataset.colIndex === loteCol) loteText = td.textContent.trim().toUpperCase();
      });
      tr.classList.toggle(
        "agv-mp-row--search-hidden",
        !(idText.includes(term) || loteText.includes(term))
      );
    });
  });
}
