import { GenericModuleController } from "../module-page.factory.js";
import {
  getActiveCropId,
  getCropTabs,
  getCropStats,
  getFundosList,
  getParcelsByFundo,
  getFundoAreaSummary,
  getGlobalStats,
  formatAreaHa,
  cropHasData,
  setActiveCropId,
  getUniqueEtapas as getCropUniqueEtapas
} from "../../config/crop-hectares.registry.js?v=20260800";
import { applyTranslationsToContainer } from "../../utils/i18n-dom.util.js";
import { i18nService } from "../../services/i18n.service.js";
import { hydrateLucideIcons } from "../../utils/lucide-icon.util.js";
import {
  renderInicioVarietyCharts,
  renderInicioDonutCharts,
  renderInicioVarietiesChart,
  renderInicioEtapasChart,
  destroyInicioVarietyCharts,
  resizeInicioVarietyCharts
} from "./inicio-varieties-charts.service.js";

const FUNDO_THEMES = {
  A9: { label: "Fundo A9", accent: "#0E1B40", soft: "rgba(125, 226, 255, 0.18)", border: "rgba(31, 54, 104, 0.28)" },
  C5: { label: "Fundo C5", accent: "#1F3668", soft: "rgba(125, 226, 255, 0.14)", border: "rgba(31, 54, 104, 0.22)" },
  C6: { label: "Fundo C6", accent: "#3d5a8a", soft: "rgba(125, 226, 255, 0.2)", border: "rgba(61, 90, 138, 0.28)" },
  LN: { label: "Fundo LN", accent: "#1F3668", soft: "rgba(125, 226, 255, 0.24)", border: "rgba(125, 226, 255, 0.4)" },
  LC: { label: "Fundo LC", accent: "#3d5a8a", soft: "rgba(125, 226, 255, 0.16)", border: "rgba(61, 90, 138, 0.24)" }
};

let activeFundoId = "";

function syncActiveFundoId() {
  const fundos = getFundosList();
  if (!fundos.length) {
    activeFundoId = "";
    return;
  }
  if (!fundos.includes(activeFundoId)) {
    activeFundoId = fundos[0];
  }
}

const tableState = {
  filterText: "",
  filterEtapa: "all",
  sortKey: "etapa",
  sortDir: "asc"
};

const chartFilterState = {
  donutEtapa: "all",
  varietiesFundo: "all",
  etapasFundo: "all"
};

function resetTableState() {
  tableState.filterText = "";
  tableState.filterEtapa = "all";
  tableState.sortKey = "etapa";
  tableState.sortDir = "asc";
}

function isTableFiltered() {
  return Boolean(tableState.filterText.trim()) || tableState.filterEtapa !== "all";
}

function getUniqueEtapas(fundo) {
  return [...new Set(getParcelsByFundo(fundo).map((parcel) => parcel.etapa))];
}

function matchesFilter(parcel) {
  const query = tableState.filterText.trim().toLowerCase();
  if (tableState.filterEtapa !== "all" && parcel.etapa !== tableState.filterEtapa) {
    return false;
  }
  if (!query) {
    return true;
  }
  const haystack = `${parcel.cultivo ?? ""} ${parcel.etapa} ${parcel.campo} ${parcel.variedad}`.toLowerCase();
  return haystack.includes(query);
}

function compareParcels(left, right, sortKey) {
  const direction = tableState.sortDir === "asc" ? 1 : -1;

  if (sortKey === "areaHa") {
    return (left.areaHa - right.areaHa) * direction;
  }

  const primary = String(left[sortKey]).localeCompare(String(right[sortKey]), "es", {
    numeric: true,
    sensitivity: "base"
  });

  if (primary !== 0) {
    return primary * direction;
  }

  if (sortKey === "etapa") {
    return left.campo.localeCompare(right.campo, "es", { numeric: true });
  }

  if (sortKey === "campo") {
    return left.etapa.localeCompare(right.etapa, "es", { numeric: true });
  }

  if (sortKey === "variedad") {
    return left.etapa.localeCompare(right.etapa, "es", { numeric: true });
  }

  return 0;
}

function getPreparedParcels(fundo) {
  const sortKey = tableState.sortKey || "etapa";
  return getParcelsByFundo(fundo)
    .filter(matchesFilter)
    .sort((left, right) => compareParcels(left, right, sortKey));
}

function buildDataRowMarkup(parcel) {
  return `
    <tr class="inicio-varieties__data-row">
      <td class="inicio-varieties__cell-cultivo">
        <span class="inicio-varieties__crop-dot" aria-hidden="true"></span>
        <span>${parcel.cultivo ?? "—"}</span>
      </td>
      <td class="inicio-varieties__cell-etapa">${parcel.etapa}</td>
      <td class="inicio-varieties__cell-campo">${parcel.campo}</td>
      <td class="inicio-varieties__cell-variedad">${parcel.variedad}</td>
      <td class="inicio-varieties__area-cell">${formatAreaHa(parcel.areaHa)}</td>
    </tr>
  `;
}

function buildTableRowsMarkup(fundo) {
  const parcels = getPreparedParcels(fundo);
  const fundoTotal = getParcelsByFundo(fundo).reduce((sum, parcel) => sum + parcel.areaHa, 0);
  const filtered = isTableFiltered();
  let rows = parcels.map((parcel) => buildDataRowMarkup(parcel)).join("");

  if (!rows) {
    rows = `
      <tr class="inicio-varieties__empty-row">
        <td colspan="5" data-i18n="inicio.tableNoResults"></td>
      </tr>
    `;
  }

  const visibleTotal = parcels.reduce((sum, parcel) => sum + parcel.areaHa, 0);
  const totalValue = filtered ? visibleTotal : fundoTotal;

  rows += `
    <tr class="inicio-varieties__total-row">
      <td colspan="4">${
        filtered
          ? '<span data-i18n="inicio.tableFilteredTotal"></span>'
          : `Total ${FUNDO_THEMES[fundo]?.label ?? `Fundo ${fundo}`}`
      }</td>
      <td>${formatAreaHa(totalValue)}</td>
    </tr>
  `;

  return rows;
}

function buildSortIconMarkup(sortKey) {
  const isActive = tableState.sortKey === sortKey;
  const iconName = !isActive
    ? "arrow-up-down"
    : tableState.sortDir === "asc"
      ? "arrow-up"
      : "arrow-down";
  const activeClass = isActive ? " is-active" : "";
  return `<i data-lucide="${iconName}" class="inicio-varieties__sort-icon${activeClass}" aria-hidden="true"></i>`;
}

function buildSortableHeaderMarkup(sortKey, i18nKey) {
  const isActive = tableState.sortKey === sortKey ? " is-active" : "";
  return `
    <button
      type="button"
      class="inicio-varieties__th-sort${isActive}"
      data-sort-key="${sortKey}"
    >
      <span data-i18n="${i18nKey}"></span>
      ${buildSortIconMarkup(sortKey)}
    </button>
  `;
}

function buildEtapaFilterOptionsMarkup(fundo) {
  const etapas = getUniqueEtapas(fundo);
  const options = etapas
    .map((etapa) => {
      const selected = tableState.filterEtapa === etapa ? " selected" : "";
      return `<option value="${etapa}"${selected}>${etapa}</option>`;
    })
    .join("");

  const allSelected = tableState.filterEtapa === "all" ? " selected" : "";
  return `
    <option value="all"${allSelected} data-i18n="inicio.tableFilterEtapaAll"></option>
    ${options}
  `;
}

function renderCoverPanel() {
  const insightRoot = document.getElementById("coverInsightCard");
  if (!insightRoot) {
    return;
  }

  const stats = getGlobalStats();
  const ringRadius = 42;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const varietiesLine = i18nService
    .translate("inicio.coverVarietiesLine")
    .replace("{{count}}", String(stats.varietyCount));

  insightRoot.innerHTML = `
    <div class="inicio-cover__insight-head">
      <i data-lucide="badge-check" aria-hidden="true"></i>
      <span data-i18n="inicio.coverInsightTitle"></span>
    </div>
    <div class="inicio-cover__insight-hero">
      <div class="inicio-cover__insight-ring" aria-hidden="true">
        <svg viewBox="0 0 100 100" shape-rendering="geometricPrecision">
          <defs>
            <linearGradient id="coverInsightRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#5eb8d9"></stop>
              <stop offset="100%" stop-color="#22c55e"></stop>
            </linearGradient>
          </defs>
          <circle class="inicio-cover__insight-ring-glow" cx="50" cy="50" r="${ringRadius}"></circle>
          <circle class="inicio-cover__insight-ring-track" cx="50" cy="50" r="${ringRadius}"></circle>
          <circle
            class="inicio-cover__insight-ring-value"
            cx="50"
            cy="50"
            r="${ringRadius}"
            stroke-dasharray="${ringCircumference}"
            stroke-dashoffset="0"
          ></circle>
        </svg>
        <div class="inicio-cover__insight-ring-label">
          <strong>100</strong>
          <span data-i18n="inicio.coverValidated"></span>
        </div>
      </div>
      <p class="inicio-cover__insight-hero-desc" data-i18n="inicio.coverValidatedDesc"></p>
    </div>
    <div class="inicio-cover__insight-stats">
      <div class="inicio-cover__insight-stat">
        <strong>${stats.fundoCount}</strong>
        <span data-i18n="inicio.kpiFundos"></span>
      </div>
      <div class="inicio-cover__insight-stat inicio-cover__insight-stat--text">
        <span>${varietiesLine}</span>
      </div>
    </div>
    <p class="inicio-cover__insight-note">
      <i data-lucide="info" aria-hidden="true"></i>
      <span data-i18n="inicio.coverInsightNote"></span>
    </p>
  `;

  applyTranslationsToContainer(insightRoot);
  hydrateLucideIcons(insightRoot);
}

function buildFundoTabsMarkup() {
  const fundos = getFundosList();
  const summaries = getFundoAreaSummary();

  return fundos
    .map((fundo) => {
      const summary = summaries.find((item) => item.fundo === fundo);
      const isActive = fundo === activeFundoId ? " is-active" : "";
      return `
        <button
          type="button"
          class="inicio-varieties__tab${isActive}"
          data-fundo-tab="${fundo}"
          id="btnFundoTab${fundo}"
          role="tab"
          aria-selected="${fundo === activeFundoId}"
          aria-controls="fundoTablePanel"
        >
          <span class="inicio-varieties__tab-name">${FUNDO_THEMES[fundo]?.label ?? `Fundo ${fundo}`}</span>
          <span class="inicio-varieties__tab-meta">${formatAreaHa(summary?.totalAreaHa ?? 0)} ha</span>
        </button>
      `;
    })
    .join("");
}

function updateTableBody() {
  const tableBody = document.getElementById("fundoTableBody");
  if (!tableBody) {
    return;
  }
  tableBody.innerHTML = buildTableRowsMarkup(activeFundoId);
  applyTranslationsToContainer(tableBody);
}

function updateSortHeaders() {
  const tablePanel = document.getElementById("fundoTablePanel");

  document.querySelectorAll("[data-sort-key]").forEach((button) => {
    const sortKey = button.dataset.sortKey;
    const isActive = tableState.sortKey === sortKey;
    button.classList.toggle("is-active", isActive);

    const iconName = !isActive
      ? "arrow-up-down"
      : tableState.sortDir === "asc"
        ? "arrow-up"
        : "arrow-down";

    const oldIcon = button.querySelector(".inicio-varieties__sort-icon");
    const newIcon = document.createElement("i");
    newIcon.setAttribute("data-lucide", iconName);
    newIcon.className = `inicio-varieties__sort-icon${isActive ? " is-active" : ""}`;
    newIcon.setAttribute("aria-hidden", "true");

    if (oldIcon) {
      oldIcon.replaceWith(newIcon);
    } else {
      button.appendChild(newIcon);
    }
  });

  if (tablePanel) {
    hydrateLucideIcons(tablePanel);
  }
}

function bindTableControls() {
  const filterInput = document.getElementById("txtFundoTableFilter");
  const etapaSelect = document.getElementById("selFundoTableEtapa");

  filterInput?.addEventListener("input", () => {
    tableState.filterText = filterInput.value;
    updateTableBody();
  });

  etapaSelect?.addEventListener("change", () => {
    tableState.filterEtapa = etapaSelect.value;
    updateTableBody();
  });

  document.querySelectorAll("[data-sort-key]").forEach((button) => {
    button.addEventListener("click", () => {
      const sortKey = button.dataset.sortKey;
      if (!sortKey) {
        return;
      }
      if (tableState.sortKey === sortKey) {
        if (tableState.sortDir === "asc") {
          tableState.sortDir = "desc";
        } else {
          tableState.sortKey = "etapa";
          tableState.sortDir = "asc";
        }
      } else {
        tableState.sortKey = sortKey;
        tableState.sortDir = sortKey === "areaHa" ? "desc" : "asc";
      }
      updateTableBody();
      updateSortHeaders();
    });
  });
}

function renderActiveFundoTable(fundo) {
  const tablePanel = document.getElementById("fundoTablePanel");
  const tableBody = document.getElementById("fundoTableBody");
  const tableHead = document.getElementById("fundoTableHead");
  const tablesRoot = document.getElementById("varietiesTablesRoot");
  const etapaSelect = document.getElementById("selFundoTableEtapa");
  const filterInput = document.getElementById("txtFundoTableFilter");

  if (!tablePanel || !tableBody || !tableHead || !tablesRoot) {
    return;
  }

  const summary = getFundoAreaSummary().find((item) => item.fundo === fundo);
  const theme = FUNDO_THEMES[fundo];
  const stagesLabel = summary?.stages?.join(" · ") ?? "";

  activeFundoId = fundo;
  tablesRoot.dataset.activeFundo = fundo;
  tablePanel.dataset.fundo = fundo;

  tableHead.innerHTML = `
    <h5 class="inicio-varieties__table-card-title">${theme?.label ?? `Fundo ${fundo}`}</h5>
    <p class="inicio-varieties__table-card-meta">${stagesLabel} · ${formatAreaHa(summary?.totalAreaHa ?? 0)} ha</p>
  `;

  if (etapaSelect) {
    etapaSelect.innerHTML = buildEtapaFilterOptionsMarkup(fundo);
  }
  if (filterInput) {
    filterInput.value = tableState.filterText;
  }

  tableBody.innerHTML = buildTableRowsMarkup(fundo);
  applyTranslationsToContainer(tableHead);
  applyTranslationsToContainer(document.getElementById("fundoTableToolbar"));
  applyTranslationsToContainer(tableBody);
  updateSortHeaders();
}

function renderTablesSection() {
  const tablesRoot = document.getElementById("varietiesTablesRoot");
  if (!tablesRoot) {
    return;
  }

  syncActiveFundoId();

  if (!cropHasData()) {
    tablesRoot.innerHTML = `
      <div class="inicio-varieties__tables-head">
        <h4 class="inicio-varieties__tables-title" data-i18n="inicio.tablesTitle"></h4>
        <p class="inicio-varieties__tables-subtitle" data-i18n="inicio.tablesSubtitle"></p>
      </div>
      <p class="inicio-varieties__empty-crop" data-i18n="inicio.cropNoData"></p>
    `;
    applyTranslationsToContainer(tablesRoot);
    return;
  }

  tablesRoot.innerHTML = `
    <div class="inicio-varieties__tables-head">
      <h4 class="inicio-varieties__tables-title" data-i18n="inicio.tablesTitle"></h4>
      <p class="inicio-varieties__tables-subtitle" data-i18n="inicio.tablesSubtitle"></p>
    </div>

    <div class="inicio-varieties__tabs" id="fundoTabsList" role="tablist" aria-label="Fundos">
      ${buildFundoTabsMarkup()}
    </div>

    <article class="inicio-varieties__table-card" id="fundoTablePanel" data-fundo="${activeFundoId}" role="tabpanel">
      <header class="inicio-varieties__table-card-head">
        <div class="inicio-varieties__scorecard-intro" id="fundoTableHead"></div>
        <div class="inicio-varieties__scorecard-actions" id="fundoTableToolbar">
          <label class="inicio-varieties__table-search">
            <i data-lucide="search" aria-hidden="true"></i>
            <input
              type="search"
              class="inicio-varieties__table-search-input"
              id="txtFundoTableFilter"
              data-i18n-placeholder="inicio.tableFilterPlaceholder"
              autocomplete="off"
            />
          </label>
          <label class="inicio-varieties__table-select-wrap">
            <select class="inicio-varieties__table-select" id="selFundoTableEtapa" aria-label="Etapa">
              ${buildEtapaFilterOptionsMarkup(activeFundoId)}
            </select>
          </label>
          <span class="inicio-varieties__campaign-badge" data-i18n="inicio.campaignBadge"></span>
        </div>
      </header>

      <div class="inicio-varieties__table-scroll">
        <table class="inicio-varieties__table">
          <thead>
            <tr>
              <th scope="col" class="inicio-varieties__th-cultivo">${buildSortableHeaderMarkup("cultivo", "inicio.tableCultivo")}</th>
              <th scope="col">${buildSortableHeaderMarkup("etapa", "inicio.tableEtapa")}</th>
              <th scope="col">${buildSortableHeaderMarkup("campo", "inicio.tableCampo")}</th>
              <th scope="col">${buildSortableHeaderMarkup("variedad", "inicio.tableVariedad")}</th>
              <th scope="col" class="inicio-varieties__th-area">${buildSortableHeaderMarkup("areaHa", "inicio.tableArea")}</th>
            </tr>
          </thead>
          <tbody id="fundoTableBody"></tbody>
        </table>
      </div>
    </article>
  `;

  applyTranslationsToContainer(tablesRoot);
  renderActiveFundoTable(activeFundoId);
  bindFundoTabs();
  bindTableControls();
  hydrateLucideIcons(document.getElementById("fundoTableToolbar"));
}

function getCropOptionMeta(cropId) {
  const crop = getCropTabs().find((entry) => entry.id === cropId);
  if (!crop) {
    return { label: cropId, area: "0.0" };
  }

  const stats = getCropStats(crop.id);
  return {
    label: i18nService.translate(crop.labelKey),
    area: formatAreaHa(stats.totalAreaHa)
  };
}

function buildCropSelectMarkup() {
  const activeCropId = getActiveCropId();
  const active = getCropOptionMeta(activeCropId);

  const options = getCropTabs()
    .map((crop) => {
      const label = i18nService.translate(crop.labelKey);
      const isSelected = crop.id === activeCropId;

      return `
        <button
          type="button"
          class="inicio-crop-select__option${isSelected ? " is-selected" : ""}"
          data-crop-id="${crop.id}"
          role="option"
          aria-selected="${isSelected}"
        >
          <span class="inicio-crop-select__option-copy">
            <span class="inicio-crop-select__option-name">${label}</span>
            <span class="inicio-crop-select__option-meta">${formatAreaHa(getCropStats(crop.id).totalAreaHa)} ha</span>
          </span>
          <i data-lucide="check" class="inicio-crop-select__option-check" aria-hidden="true"></i>
        </button>
      `;
    })
    .join("");

  return `
    <button
      type="button"
      class="inicio-crop-select__trigger"
      id="btnCropSelect"
      aria-haspopup="listbox"
      aria-expanded="false"
    >
      <span class="inicio-crop-select__trigger-copy">
        <span class="inicio-crop-select__trigger-name">${active.label}</span>
        <span class="inicio-crop-select__trigger-meta">${active.area} ha</span>
      </span>
      <i data-lucide="chevron-down" class="inicio-crop-select__chevron" aria-hidden="true"></i>
    </button>
    <div class="inicio-crop-select__menu" id="cropSelectMenu" role="listbox" aria-label="Cultivo">
      ${options}
    </div>
  `;
}

function openCropSelectMenu() {
  const root = document.getElementById("cropSelectRoot");
  const trigger = document.getElementById("btnCropSelect");
  if (!root || !trigger) {
    return;
  }

  root.classList.add("is-open");
  trigger.setAttribute("aria-expanded", "true");
}

function closeCropSelectMenu() {
  const root = document.getElementById("cropSelectRoot");
  const trigger = document.getElementById("btnCropSelect");
  root?.classList.remove("is-open");
  trigger?.setAttribute("aria-expanded", "false");
}

function applyCropChange(cropId) {
  if (!cropId || cropId === getActiveCropId()) {
    return;
  }

  setActiveCropId(cropId);
  resetChartFilters();
  resetTableState();
  syncActiveFundoId();
  renderCropSelect();
  renderKpiStrip();
  renderTablesSection();
  scheduleChartRender();
}

function renderCropSelect() {
  const cropSelectRoot = document.getElementById("cropSelectRoot");
  if (!cropSelectRoot) {
    return;
  }

  closeCropSelectMenu();
  cropSelectRoot.innerHTML = buildCropSelectMarkup();
  hydrateLucideIcons(cropSelectRoot);
}

function bindCropSelect() {
  const cropSelectRoot = document.getElementById("cropSelectRoot");
  if (!cropSelectRoot || cropSelectRoot.dataset.bound === "true") {
    return;
  }

  cropSelectRoot.dataset.bound = "true";

  cropSelectRoot.addEventListener("click", (event) => {
    const trigger = event.target.closest("#btnCropSelect");
    const option = event.target.closest("[data-crop-id]");

    if (trigger) {
      event.stopPropagation();
      const isOpen = cropSelectRoot.classList.contains("is-open");
      if (isOpen) {
        closeCropSelectMenu();
      } else {
        openCropSelectMenu();
      }
      return;
    }

    if (option) {
      event.stopPropagation();
      applyCropChange(option.dataset.cropId);
      closeCropSelectMenu();
    }
  });

  document.addEventListener("click", (event) => {
    if (!cropSelectRoot.contains(event.target)) {
      closeCropSelectMenu();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeCropSelectMenu();
    }
  });
}

function updateActiveCropTitle() {
  const titleRoot = document.getElementById("txtActiveCropHectaresTitle");
  if (!titleRoot) {
    return;
  }

  titleRoot.setAttribute("data-i18n", "inicio.hectaresSectionTitle");
  applyTranslationsToContainer(titleRoot);
}

function bindFundoTabs() {
  const tabButtons = document.querySelectorAll("[data-fundo-tab]");
  tabButtons.forEach((tabButton) => {
    tabButton.addEventListener("click", () => {
      const fundo = tabButton.dataset.fundoTab;
      if (!fundo || fundo === activeFundoId) {
        return;
      }

      document.querySelectorAll("[data-fundo-tab]").forEach((button) => {
        const isActive = button.dataset.fundoTab === fundo;
        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-selected", String(isActive));
      });

      resetTableState();
      renderActiveFundoTable(fundo);
    });
  });
}

function buildMiniBarsSvg(values) {
  const max = Math.max(...values, 1);
  const barWidth = 7;
  const gap = 5;
  const chartHeight = 26;
  const baseY = 30;
  const rects = values
    .map((value, index) => {
      const height = Math.max(2, Math.round((value / max) * chartHeight));
      const x = index * (barWidth + gap) + 1;
      const y = baseY - height;
      return `<rect class="inicio-varieties__kpi-bar inicio-varieties__kpi-bar--${index + 1}" x="${x}" y="${y}" width="${barWidth}" height="${height}" rx="2"/>`;
    })
    .join("");
  const width = values.length * (barWidth + gap);

  return `<svg class="inicio-varieties__kpi-spark" viewBox="0 0 ${width} 32" aria-hidden="true">${rects}</svg>`;
}

function buildKpiCardsData(stats) {
  const summaries = getFundoAreaSummary();
  const fundoList = summaries.map((item) => item.fundo).join(" · ");

  return [
    {
      id: "fundos",
      value: stats.fundoCount,
      labelKey: "inicio.kpiFundos",
      meta: fundoList,
      bars: summaries.map((item) => item.parcelCount)
    },
    {
      id: "area",
      value: formatAreaHa(stats.totalAreaHa),
      labelKey: "inicio.kpiTotalArea",
      meta: `${stats.fundoCount} fundos`,
      bars: summaries.map((item) => item.totalAreaHa)
    },
    {
      id: "varieties",
      value: stats.varietyCount,
      valueSuffix: "+",
      labelKey: "inicio.kpiVarieties",
      meta: `${formatAreaHa(stats.totalAreaHa)} ha`,
      bars: summaries.map((item) => item.varieties.length)
    }
  ];
}

function buildKpiValueMarkup(card) {
  if (!card.valueSuffix) {
    return `<span class="inicio-varieties__kpi-value">${card.value}</span>`;
  }

  return `
    <span class="inicio-varieties__kpi-value-wrap">
      <span class="inicio-varieties__kpi-value">${card.value}</span>
      <span class="inicio-varieties__kpi-value-suffix" aria-hidden="true">${card.valueSuffix}</span>
    </span>
  `;
}

function buildKpiCardMarkup(card) {
  return `
    <article class="inicio-varieties__kpi inicio-varieties__kpi--${card.id}">
      <span class="inicio-varieties__kpi-label" data-i18n="${card.labelKey}"></span>
      <div class="inicio-varieties__kpi-main">
        ${buildKpiValueMarkup(card)}
        ${buildMiniBarsSvg(card.bars)}
      </div>
      <span class="inicio-varieties__kpi-meta">${card.meta}</span>
    </article>
  `;
}

function renderKpiStrip() {
  const kpiRoot = document.getElementById("varietiesKpiStrip");
  if (!kpiRoot) {
    return;
  }

  const stats = getGlobalStats();
  const cards = buildKpiCardsData(stats);

  kpiRoot.innerHTML = cards.map(buildKpiCardMarkup).join("");
  applyTranslationsToContainer(kpiRoot);
}

function resetChartFilters() {
  chartFilterState.donutEtapa = "all";
  chartFilterState.varietiesFundo = "all";
  chartFilterState.etapasFundo = "all";
}

const CHART_FILTER_CONTROLS = [
  {
    rootId: "chartFilterDonutEtapa",
    filterKey: "donut-etapa",
    type: "etapa",
    stateKey: "donutEtapa",
    ariaKey: "inicio.chartFilterAriaEtapa"
  },
  {
    rootId: "chartFilterVarietiesFundo",
    filterKey: "varieties-fundo",
    type: "fundo",
    stateKey: "varietiesFundo",
    ariaKey: "inicio.chartFilterAriaFundo"
  },
  {
    rootId: "chartFilterEtapasFundo",
    filterKey: "etapas-fundo",
    type: "fundo",
    stateKey: "etapasFundo",
    ariaKey: "inicio.chartFilterAriaFundo"
  }
];

function buildChartFilterSelectOptions(type) {
  if (type === "etapa") {
    const etapas = getCropUniqueEtapas();
    const options = [{ value: "all", label: i18nService.translate("inicio.chartFilterAllEtapas") }];
    etapas.forEach((etapa) => options.push({ value: etapa, label: etapa }));
    return options;
  }

  const fundos = getFundosList();
  const options = [{ value: "all", label: i18nService.translate("inicio.chartFilterAllFundos") }];
  fundos.forEach((fundo) => options.push({ value: fundo, label: `Fundo ${fundo}` }));
  return options;
}

function getChartFilterSelectedLabel(options, selectedValue) {
  return options.find((option) => option.value === selectedValue)?.label ?? options[0]?.label ?? "";
}

function buildChartFilterSelectMarkup({ type, stateKey, ariaKey }) {
  const options = buildChartFilterSelectOptions(type);
  const validValues = new Set(options.map((option) => option.value));
  if (!validValues.has(chartFilterState[stateKey])) {
    chartFilterState[stateKey] = "all";
  }

  const selectedValue = chartFilterState[stateKey];
  const selectedLabel = getChartFilterSelectedLabel(options, selectedValue);
  const isDisabled = options.length <= 1;
  const menuOptions = options
    .map(
      (option) => `
        <button
          type="button"
          class="inicio-chart-filter-select__option${option.value === selectedValue ? " is-selected" : ""}"
          data-filter-value="${option.value}"
          role="option"
          aria-selected="${option.value === selectedValue}"
        >
          <span class="inicio-chart-filter-select__option-label">${option.label}</span>
          <i data-lucide="check" class="inicio-chart-filter-select__option-check" aria-hidden="true"></i>
        </button>
      `
    )
    .join("");

  return `
    <button
      type="button"
      class="inicio-chart-filter-select__trigger"
      aria-haspopup="listbox"
      aria-expanded="false"
      ${isDisabled ? "disabled" : ""}
    >
      <span class="inicio-chart-filter-select__trigger-label">${selectedLabel}</span>
      <i data-lucide="chevron-down" class="inicio-chart-filter-select__chevron" aria-hidden="true"></i>
    </button>
    <div class="inicio-chart-filter-select__menu" role="listbox" aria-label="${i18nService.translate(ariaKey)}">
      ${menuOptions}
    </div>
  `;
}

function closeAllChartFilterMenus() {
  document.querySelectorAll(".inicio-chart-filter-select.is-open").forEach((filterRoot) => {
    filterRoot.classList.remove("is-open");
    filterRoot.querySelector(".inicio-chart-filter-select__trigger")?.setAttribute("aria-expanded", "false");
  });
}

function applyChartFilterValue(filterKey, value) {
  if (filterKey === "donut-etapa") {
    chartFilterState.donutEtapa = value;
    return;
  }

  if (filterKey === "varieties-fundo") {
    chartFilterState.varietiesFundo = value;
    return;
  }

  if (filterKey === "etapas-fundo") {
    chartFilterState.etapasFundo = value;
  }
}

function renderChartFilterControls() {
  CHART_FILTER_CONTROLS.forEach(({ rootId, filterKey, type, stateKey, ariaKey }) => {
    const filterRoot = document.getElementById(rootId);
    if (!filterRoot) {
      return;
    }

    filterRoot.className = "inicio-chart-filter-select";
    filterRoot.dataset.chartFilter = filterKey;
    filterRoot.innerHTML = buildChartFilterSelectMarkup({ type, stateKey, ariaKey });
    hydrateLucideIcons(filterRoot);
  });
}

function getInicioChartFilters() {
  return {
    donut: chartFilterState.donutEtapa !== "all" ? { etapa: chartFilterState.donutEtapa } : {},
    varieties: chartFilterState.varietiesFundo !== "all" ? { fundo: chartFilterState.varietiesFundo } : {},
    etapas: chartFilterState.etapasFundo !== "all" ? { fundo: chartFilterState.etapasFundo } : {}
  };
}

function bindChartFilters() {
  const analyticsSection = document.getElementById("sectionVarietiesAnalytics");
  if (!analyticsSection || analyticsSection.dataset.chartFiltersBound === "true") {
    return;
  }

  analyticsSection.dataset.chartFiltersBound = "true";
  analyticsSection.addEventListener("click", (event) => {
    const filterRoot = event.target.closest(".inicio-chart-filter-select");
    const trigger = event.target.closest(".inicio-chart-filter-select__trigger");
    const option = event.target.closest("[data-filter-value]");

    if (trigger && filterRoot) {
      event.stopPropagation();
      const isOpen = filterRoot.classList.contains("is-open");
      closeAllChartFilterMenus();
      if (!isOpen && !trigger.disabled) {
        filterRoot.classList.add("is-open");
        trigger.setAttribute("aria-expanded", "true");
      }
      return;
    }

    if (option && filterRoot) {
      event.stopPropagation();
      const filterKey = filterRoot.dataset.chartFilter;
      const nextValue = option.dataset.filterValue;
      if (!filterKey || !nextValue) {
        return;
      }

      applyChartFilterValue(filterKey, nextValue);
      closeAllChartFilterMenus();
      renderChartFilterControls();
      refreshSingleChart(filterKey);
    }
  });

  document.addEventListener("click", () => {
    closeAllChartFilterMenus();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeAllChartFilterMenus();
    }
  });
}

function refreshSingleChart(filterKey) {
  const chartFilters = getInicioChartFilters();

  requestAnimationFrame(() => {
    requestAnimationFrame(async () => {
      if (filterKey === "donut-etapa") {
        await renderInicioDonutCharts(chartFilters.donut);
        return;
      }

      if (filterKey === "varieties-fundo") {
        await renderInicioVarietiesChart(chartFilters.varieties);
        return;
      }

      if (filterKey === "etapas-fundo") {
        await renderInicioEtapasChart(chartFilters.etapas);
      }
    });
  });
}

function scheduleChartRender() {
  requestAnimationFrame(() => {
    requestAnimationFrame(async () => {
      renderChartFilterControls();
      await renderInicioVarietyCharts(getInicioChartFilters());
      applyTranslationsToContainer(document.getElementById("sectionVarietiesAnalytics"));
    });
  });
}

export class ModuleController extends GenericModuleController {
  constructor(moduleContext) {
    super(moduleContext);
    this.onResize = this.handleResize.bind(this);
    this.resizeObserver = null;
  }

  mount() {
    super.mount();
    renderCoverPanel();
    applyTranslationsToContainer(document.querySelector(".inicio-cover"));
    hydrateLucideIcons(document.querySelector(".inicio-cover"));
    syncActiveFundoId();
    updateActiveCropTitle();
    renderCropSelect();
    bindCropSelect();
    renderKpiStrip();
    renderTablesSection();
    renderChartFilterControls();
    bindChartFilters();
    scheduleChartRender();
    this.bindChartResizeObserver();
    window.addEventListener("resize", this.onResize);
  }

  bindChartResizeObserver() {
    const chartsSection = document.querySelector(".inicio-varieties__charts");
    if (!chartsSection || !window.ResizeObserver) {
      return;
    }

    this.resizeObserver = new ResizeObserver(() => {
      resizeInicioVarietyCharts();
    });
    this.resizeObserver.observe(chartsSection);
  }

  handleResize() {
    resizeInicioVarietyCharts();
  }

  destroy() {
    window.removeEventListener("resize", this.onResize);
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    destroyInicioVarietyCharts();
  }
}
