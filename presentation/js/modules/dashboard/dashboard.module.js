import { appConfig } from "../../config/app.config.js";
import { i18nService } from "../../services/i18n.service.js";
import { hydrateLucideIcons } from "../../utils/lucide-icon.util.js";
import { applyTranslationsToContainer } from "../../utils/i18n-dom.util.js";
import {
  maskIncognitoJsonText,
  maskIncognitoNumber
} from "../../utils/brand-pixel.util.js";

const VAR_MAP_PATH = "presentation/data/catalogos/var-map-arandano.json";

function t(key, vars = {}) {
  let text = i18nService.translate(key);
  Object.entries(vars).forEach(([name, value]) => {
    text = text.replace(`{{${name}}}`, String(value));
  });
  return text;
}

function htmlEscape(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function compareCodes(leftCode, rightCode) {
  const leftNumeric = /^\d+$/.test(leftCode);
  const rightNumeric = /^\d+$/.test(rightCode);

  if (leftNumeric && rightNumeric) {
    return Number(leftCode) - Number(rightCode);
  }

  if (leftNumeric !== rightNumeric) {
    return leftNumeric ? -1 : 1;
  }

  return leftCode.localeCompare(rightCode, undefined, { numeric: true, sensitivity: "base" });
}

function normalizeLicensor(licensor) {
  const value = String(licensor ?? "").trim();
  if (!value || value === "_") {
    return "";
  }
  return value;
}

function buildRows(catalogData) {
  return Object.entries(catalogData.entradas ?? {}).map(([code, entry]) => ({
    code,
    variety: entry?.variedad ?? "",
    licensor: normalizeLicensor(entry?.licenciante)
  }));
}

function countUniqueLicensors(rows) {
  return new Set(rows.map((row) => row.licensor).filter(Boolean)).size;
}

function getUniqueLicensors(rows) {
  return [...new Set(rows.map((row) => row.licensor).filter(Boolean))].sort((left, right) =>
    left.localeCompare(right, "es", { sensitivity: "base" })
  );
}

function countByLicensor(rows) {
  const counts = new Map();

  rows.forEach((row) => {
    const key = row.licensor || "";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });

  return [...counts.entries()].sort((left, right) => right[1] - left[1]);
}

function buildMiniBarsSvg(values) {
  if (!values.length) {
    return "";
  }

  const barWidth = 5;
  const gap = 3;
  const chartHeight = 28;
  const max = Math.max(...values, 1);
  const baseY = 30;
  const rects = values
    .slice(0, 4)
    .map((value, index) => {
      const height = Math.max(2, Math.round((value / max) * chartHeight));
      const x = index * (barWidth + gap) + 1;
      const y = baseY - height;
      return `<rect class="inicio-varieties__kpi-bar inicio-varieties__kpi-bar--${index + 1}" x="${x}" y="${y}" width="${barWidth}" height="${height}" rx="2"/>`;
    })
    .join("");
  const width = Math.min(values.length, 4) * (barWidth + gap);

  return `<svg class="inicio-varieties__kpi-spark" viewBox="0 0 ${width} 32" aria-hidden="true">${rects}</svg>`;
}

function countOrganic(rows) {
  return rows.filter((row) => /org[aá]nic/i.test(row.variety)).length;
}

function countWithoutGenetics(rows) {
  return rows.filter((row) => !row.licensor).length;
}

function getTopGenetics(rows) {
  const counts = countByLicensor(rows).filter(([name]) => name);
  return counts[0] ?? ["—", 0];
}

function geneticsChipMarkup(name, count, isActive) {
  const display = name ? maskIncognitoJsonText(name) : t("dashboard.noLicensor");
  const value = name ? htmlEscape(name) : "__empty__";
  const activeClass = isActive ? " is-active" : "";
  const emptyClass = name ? "" : " var-catalog-page__genetics-chip--empty";

  return `
    <button
      type="button"
      class="var-catalog-page__genetics-chip${activeClass}${emptyClass}"
      data-genetics-filter="${value}"
      aria-pressed="${isActive ? "true" : "false"}"
    >
      <span class="var-catalog-page__genetics-chip-name">${htmlEscape(display)}</span>
      <span class="var-catalog-page__genetics-chip-count">${maskIncognitoNumber(count)}</span>
    </button>
  `;
}
function licensorBadgeMarkup(licensor) {
  const display = licensor ? maskIncognitoJsonText(licensor) : t("dashboard.noLicensor");
  const modifier = licensor ? "" : " var-catalog-page__genetics-badge--empty";

  return `<span class="var-catalog-page__genetics-badge${modifier}">${htmlEscape(display)}</span>`;
}

function compareRows(left, right, sortKey, sortDir) {
  const direction = sortDir === "asc" ? 1 : -1;

  if (sortKey === "code") {
    return compareCodes(left.code, right.code) * direction;
  }

  if (sortKey === "variety") {
    const primary = left.variety.localeCompare(right.variety, "es", { sensitivity: "base" });
    return (primary || compareCodes(left.code, right.code)) * direction;
  }

  const leftLicensor = left.licensor || t("dashboard.noLicensor");
  const rightLicensor = right.licensor || t("dashboard.noLicensor");
  const primary = leftLicensor.localeCompare(rightLicensor, "es", { sensitivity: "base" });
  return (primary || compareCodes(left.code, right.code)) * direction;
}

export class ModuleController {
  constructor(moduleContext) {
    this.moduleContext = moduleContext;
    this.catalogData = null;
    this.rows = [];
    this.tableState = {
      sortKey: "code",
      sortDir: "asc",
      filterLicensor: "all"
    };
    this.onSearchInput = this.handleSearchInput.bind(this);
    this.onLicensorChange = this.handleLicensorChange.bind(this);
    this.onSortClick = this.handleSortClick.bind(this);
    this.onGeneticsChipClick = this.handleGeneticsChipClick.bind(this);
  }

  async mount() {
    await this.loadCatalog();
    this.bindEvents();
    this.renderAll();
    hydrateLucideIcons(document.getElementById("moduleRoot"));
    window.addEventListener("agv:brand-pixel-changed", this.onBrandPixelChanged);
  }

  onBrandPixelChanged = () => {
    this.renderAll();
  };

  async onLanguageChange() {
    this.renderAll();
    hydrateLucideIcons(document.getElementById("moduleRoot"));
  }

  async loadCatalog() {
    const response = await fetch(`${VAR_MAP_PATH}?v=${appConfig.cacheBustingVersion}`);
    if (!response.ok) {
      throw new Error(t("dashboard.loadError"));
    }

    this.catalogData = await response.json();
    this.rows = buildRows(this.catalogData);
  }

  bindEvents() {
    document.getElementById("inpVarCatalogSearch")?.addEventListener("input", this.onSearchInput);
    document.getElementById("selVarCatalogLicensor")?.addEventListener("change", this.onLicensorChange);

    document.querySelectorAll("#varCatalogTablePanel [data-sort-key]").forEach((button) => {
      button.addEventListener("click", this.onSortClick);
    });

    document.getElementById("varCatalogGeneticsGrid")?.addEventListener("click", this.onGeneticsChipClick);
  }

  handleGeneticsChipClick(event) {
    const chip = event.target.closest("[data-genetics-filter]");
    if (!chip) {
      return;
    }

    const filterValue = chip.dataset.geneticsFilter;
    const isActive =
      this.tableState.filterLicensor === filterValue ||
      (filterValue === "__empty__" && this.tableState.filterLicensor === "__empty__");

    this.tableState.filterLicensor = isActive ? "all" : filterValue;

    const selectElement = document.getElementById("selVarCatalogLicensor");
    if (selectElement) {
      selectElement.value = this.tableState.filterLicensor;
    }

    this.renderGeneticsGrid();
    this.renderTable();
    this.renderMeta();
  }

  handleSearchInput() {
    this.renderTable();
    this.renderMeta();
  }

  handleLicensorChange(event) {
    this.tableState.filterLicensor = event.target.value;
    this.renderGeneticsGrid();
    this.renderTable();
    this.renderMeta();
  }

  handleSortClick(event) {
    const button = event.currentTarget;
    const sortKey = button?.dataset?.sortKey;
    if (!sortKey) {
      return;
    }

    if (this.tableState.sortKey === sortKey) {
      if (this.tableState.sortDir === "asc") {
        this.tableState.sortDir = "desc";
      } else {
        this.tableState.sortKey = "code";
        this.tableState.sortDir = "asc";
      }
    } else {
      this.tableState.sortKey = sortKey;
      this.tableState.sortDir = "asc";
    }

    this.updateSortHeaders();
    this.renderTable();
  }

  getFilteredRows() {
    const searchTerm = document.getElementById("inpVarCatalogSearch")?.value?.trim().toLowerCase() ?? "";

    return this.rows.filter((row) => {
      const matchesLicensor =
        this.tableState.filterLicensor === "all" ||
        (this.tableState.filterLicensor === "__empty__" ? !row.licensor : row.licensor === this.tableState.filterLicensor);

      if (!matchesLicensor) {
        return false;
      }

      if (!searchTerm) {
        return true;
      }

      const haystack = `${row.code} ${row.variety} ${row.licensor}`.toLowerCase();
      return haystack.includes(searchTerm);
    });
  }

  getPreparedRows() {
    return this.getFilteredRows().sort((left, right) =>
      compareRows(left, right, this.tableState.sortKey, this.tableState.sortDir)
    );
  }

  isFiltered() {
    const searchTerm = document.getElementById("inpVarCatalogSearch")?.value?.trim() ?? "";
    return Boolean(searchTerm) || this.tableState.filterLicensor !== "all";
  }

  renderAll() {
    this.renderStats();
    this.renderLicensorSelect();
    this.renderGeneticsGrid();
    this.updateSortHeaders();
    this.renderTable();
    this.renderMeta();
    applyTranslationsToContainer(document.getElementById("moduleRoot"));
  }

  renderStats() {
    const statsContainer = document.getElementById("varCatalogStats");
    if (!statsContainer) {
      return;
    }

    const totalVarieties = maskIncognitoNumber(this.rows.length);
    const totalLicensors = maskIncognitoNumber(countUniqueLicensors(this.rows));
    const distribution = countByLicensor(this.rows);
    const barValues = distribution.map(([, count]) => count);
    const [topNameRaw, topCountRaw] = getTopGenetics(this.rows);
    const topName = topNameRaw && topNameRaw !== "—" ? maskIncognitoJsonText(topNameRaw) : topNameRaw;
    const topCount = maskIncognitoNumber(topCountRaw);
    const organicCount = maskIncognitoNumber(countOrganic(this.rows));
    const noGeneticsCount = countWithoutGenetics(this.rows);

    statsContainer.innerHTML = `
      <article class="inicio-varieties__kpi inicio-varieties__kpi--varieties">
        <span class="inicio-varieties__kpi-label">${htmlEscape(t("dashboard.statVarieties"))}</span>
        <div class="inicio-varieties__kpi-main">
          <span class="inicio-varieties__kpi-value">${totalVarieties}</span>
          ${buildMiniBarsSvg(barValues)}
        </div>
        <span class="inicio-varieties__kpi-meta">${htmlEscape(t("dashboard.statVarietiesMeta"))}</span>
      </article>
      <article class="inicio-varieties__kpi inicio-varieties__kpi--fundos">
        <span class="inicio-varieties__kpi-label">${htmlEscape(t("dashboard.statLicensors"))}</span>
        <div class="inicio-varieties__kpi-main">
          <span class="inicio-varieties__kpi-value">${totalLicensors}</span>
          ${buildMiniBarsSvg(barValues.slice(0, 4))}
        </div>
        <span class="inicio-varieties__kpi-meta">${htmlEscape(t("dashboard.statLicensorsMeta"))}</span>
      </article>
      <article class="inicio-varieties__kpi inicio-varieties__kpi--area">
        <span class="inicio-varieties__kpi-label">${htmlEscape(t("dashboard.statTopGenetics"))}</span>
        <div class="inicio-varieties__kpi-main">
          <div class="var-catalog-page__kpi-main--compact">
            <span class="var-catalog-page__kpi-top-name">${htmlEscape(topName)}</span>
            <span class="inicio-varieties__kpi-value">${topCount}</span>
          </div>
          ${buildMiniBarsSvg(barValues.slice(0, 4))}
        </div>
        <span class="inicio-varieties__kpi-meta">${htmlEscape(t("dashboard.statTopGeneticsMeta", { name: topName, count: topCount }))}</span>
      </article>
      <article class="inicio-varieties__kpi inicio-varieties__kpi--varieties var-catalog-page__kpi--organic">
        <span class="inicio-varieties__kpi-label">${htmlEscape(t("dashboard.statOrganic"))}</span>
        <div class="inicio-varieties__kpi-main">
          <span class="inicio-varieties__kpi-value">${organicCount}</span>
          ${buildMiniBarsSvg([organicCount, noGeneticsCount, Math.max(this.rows.length - countOrganic(this.rows) - noGeneticsCount, 1)])}
        </div>
        <span class="inicio-varieties__kpi-meta">${htmlEscape(t("dashboard.statOrganicMeta"))}</span>
      </article>
    `;
  }

  renderGeneticsGrid() {
    const gridElement = document.getElementById("varCatalogGeneticsGrid");
    const metaElement = document.getElementById("txtVarCatalogGeneticsMeta");
    if (!gridElement) {
      return;
    }

    const distribution = countByLicensor(this.rows);
    const geneticsCount = distribution.filter(([name]) => name).length;
    const currentFilter = this.tableState.filterLicensor;

    if (metaElement) {
      metaElement.textContent = t("dashboard.geneticsGridMeta", {
        count: maskIncognitoNumber(geneticsCount)
      });
    }

    gridElement.innerHTML = distribution
      .map(([name, count]) => {
        const filterValue = name || "__empty__";
        const isActive = currentFilter === filterValue || (currentFilter === "__empty__" && !name);
        return geneticsChipMarkup(name, count, isActive);
      })
      .join("");
  }

  renderLicensorSelect() {
    const selectElement = document.getElementById("selVarCatalogLicensor");
    if (!selectElement) {
      return;
    }

    const licensors = getUniqueLicensors(this.rows);
    const hasEmpty = this.rows.some((row) => !row.licensor);
    const currentValue = this.tableState.filterLicensor;

    const options = [
      `<option value="all"${currentValue === "all" ? " selected" : ""}>${htmlEscape(t("dashboard.filterAll"))}</option>`
    ];

    licensors.forEach((licensor) => {
      const selected = currentValue === licensor ? " selected" : "";
      options.push(
        `<option value="${htmlEscape(licensor)}"${selected}>${htmlEscape(maskIncognitoJsonText(licensor))}</option>`
      );
    });

    if (hasEmpty) {
      const selected = currentValue === "__empty__" ? " selected" : "";
      options.push(
        `<option value="__empty__"${selected}>${htmlEscape(t("dashboard.filterNoLicensor"))}</option>`
      );
    }

    selectElement.innerHTML = options.join("");
  }

  updateSortHeaders() {
    const tablePanel = document.getElementById("varCatalogTablePanel");

    document.querySelectorAll("#varCatalogTablePanel [data-sort-key]").forEach((button) => {
      const sortKey = button.dataset.sortKey;
      const isActive = this.tableState.sortKey === sortKey;
      button.classList.toggle("is-active", isActive);

      const iconName = !isActive
        ? "arrow-up-down"
        : this.tableState.sortDir === "asc"
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

  renderTable() {
    const tableBody = document.getElementById("tblVarCatalogBody");
    if (!tableBody) {
      return;
    }

    const preparedRows = this.getPreparedRows();
    let rowsMarkup = "";

    if (!preparedRows.length) {
      rowsMarkup = `
        <tr class="inicio-varieties__empty-row">
          <td colspan="4">${htmlEscape(t("dashboard.emptyResults"))}</td>
        </tr>
      `;
    } else {
      rowsMarkup = preparedRows
        .map(
          (row) => `
        <tr class="inicio-varieties__data-row">
          <td class="var-catalog-page__cell-code">
            <span class="var-catalog-page__code-pill">${htmlEscape(maskIncognitoJsonText(row.code))}</span>
          </td>
          <td class="inicio-varieties__cell-variedad var-catalog-page__cell-variedad">${htmlEscape(maskIncognitoJsonText(row.variety))}</td>
          <td class="var-catalog-page__cell-licensor">${licensorBadgeMarkup(row.licensor)}</td>
          <td class="var-catalog-page__cell-estado">
            <span class="var-catalog-page__status var-catalog-page__status--ok">${htmlEscape(t("dashboard.statusActive"))}</span>
          </td>
        </tr>
      `
        )
        .join("");
    }

    const totalLabel = this.isFiltered()
      ? t("dashboard.tableFilteredTotal")
      : t("dashboard.tableTotal");

    rowsMarkup += `
      <tr class="inicio-varieties__total-row">
        <td colspan="3">${htmlEscape(totalLabel)}</td>
        <td>${preparedRows.length}</td>
      </tr>
    `;

    tableBody.innerHTML = rowsMarkup;
  }

  renderMeta() {
    const countElement = document.getElementById("txtVarCatalogCount");

    if (countElement) {
      const filteredCount = this.getFilteredRows().length;
      countElement.textContent = t("dashboard.showingCount", {
        count: maskIncognitoNumber(filteredCount),
        total: maskIncognitoNumber(this.rows.length)
      });
    }
  }

  destroy() {
    window.removeEventListener("agv:brand-pixel-changed", this.onBrandPixelChanged);
    document.getElementById("inpVarCatalogSearch")?.removeEventListener("input", this.onSearchInput);
    document.getElementById("selVarCatalogLicensor")?.removeEventListener("change", this.onLicensorChange);

    document.querySelectorAll("#varCatalogTablePanel [data-sort-key]").forEach((button) => {
      button.removeEventListener("click", this.onSortClick);
    });

    document.getElementById("varCatalogGeneticsGrid")?.removeEventListener("click", this.onGeneticsChipClick);
  }
}
