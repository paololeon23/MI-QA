import { GenericModuleController } from "../module-page.factory.js";
import { applyTranslationsToContainer } from "../../utils/i18n-dom.util.js";
import { refreshModuleLanguage } from "../../utils/module-i18n.util.js";
import { i18nService } from "../../services/i18n.service.js";
import { hydrateLucideIcons } from "../../utils/lucide-icon.util.js";
import { appConfig } from "../../config/app.config.js";
import {
  maskIncognitoJsonText,
  maskIncognitoNumber
} from "../../utils/brand-pixel.util.js";

const CATALOG_URL = `presentation/data/cartillas-catalog.json?v=${appConfig.cacheBustingVersion}`;

function t(key) {
  return i18nService.translate(key);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function normalizeSearch(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export class ModuleController extends GenericModuleController {
  constructor(moduleContext) {
    super(moduleContext);
    this.catalog = null;
    this.query = "";
    this.activeCrop = "CUA01";
  }

  async mount() {
    super.mount();
    const root = document.querySelector("[data-cartillas-root]") || document.getElementById("moduleRoot");
    if (!root) return;

    this.root = root;
    this.cropsEl = root.querySelector("[data-cartillas-crops]");
    this.summaryEl = root.querySelector("[data-cartillas-summary]");
    this.filtersEl = root.querySelector("[data-cartillas-filters]");
    this.searchEl = root.querySelector("[data-cartillas-search]");
    this.clearEl = root.querySelector("[data-cartillas-clear]");

    applyTranslationsToContainer(root, { hydrateIcons: false });
    this.bindEvents();

    try {
      const response = await fetch(CATALOG_URL);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      this.catalog = await response.json();
      this.renderFilters();
      this.render();
    } catch {
      if (this.cropsEl) {
        this.cropsEl.innerHTML = `<p class="cartillas-page__empty">${escapeHtml(t("cartillas.loadError"))}</p>`;
      }
    }

    hydrateLucideIcons(root);
    window.addEventListener("agv:brand-pixel-changed", this.onBrandPixelChanged);
  }

  onBrandPixelChanged = () => {
    this.renderFilters();
    this.render();
  };

  bindEvents() {
    this.onSearch = () => {
      this.query = this.searchEl?.value || "";
      if (this.clearEl) this.clearEl.hidden = !this.query;
      this.render();
    };
    this.onClear = () => {
      if (this.searchEl) this.searchEl.value = "";
      this.query = "";
      if (this.clearEl) this.clearEl.hidden = true;
      this.searchEl?.focus();
      this.render();
    };
    this.onFilterClick = (event) => {
      const btn = event.target.closest("[data-crop-filter]");
      if (!btn) return;
      this.activeCrop = btn.getAttribute("data-crop-filter") || "all";
      this.renderFilters();
      this.render();
    };

    this.searchEl?.addEventListener("input", this.onSearch);
    this.clearEl?.addEventListener("click", this.onClear);
    this.filtersEl?.addEventListener("click", this.onFilterClick);
  }

  renderFilters() {
    if (!this.filtersEl || !this.catalog) return;
    const crops = this.catalog.crops || [];
    const buttons = [
      ...crops.map((crop) => ({
        id: crop.code,
        label: crop.nameKey ? t(crop.nameKey) : crop.name
      })),
      { id: "all", label: t("cartillas.filterAll") }
    ];

    this.filtersEl.innerHTML = buttons
      .map((btn) => {
        const active = this.activeCrop === btn.id;
        return `
          <button
            type="button"
            class="cartillas-page__filter${active ? " is-active" : ""}"
            data-crop-filter="${escapeHtml(btn.id)}"
            role="tab"
            aria-selected="${active ? "true" : "false"}"
          >${escapeHtml(btn.label)}</button>
        `;
      })
      .join("");
  }

  render() {
    if (!this.catalog || !this.cropsEl) return;
    const q = normalizeSearch(this.query);
    const crops = (this.catalog.crops || []).filter((crop) => {
      if (this.activeCrop === "all") return true;
      return crop.code === this.activeCrop;
    });

    let visibleItems = 0;
    const sections = crops
      .map((crop) => {
        const cropName = crop.nameKey ? t(crop.nameKey) : crop.name;
        const items = crop.items || [];
        const matchedItems = items.filter((item) => {
          if (!q) return true;
          const hay = normalizeSearch(
            `${item.name} ${item.code} ${item.id ?? ""} ${cropName} ${crop.code}`
          );
          return hay.includes(q);
        });

        if (!matchedItems.length) return "";
        visibleItems += matchedItems.length;

        const rows = matchedItems
          .map((item) => {
            const codeHtml = item.code
              ? `<span class="cartillas-crop__code">${escapeHtml(maskIncognitoJsonText(item.code))}</span>`
              : `<span class="cartillas-crop__empty">—</span>`;
            const idHtml =
              item.id != null
                ? `<span class="cartillas-crop__id">${escapeHtml(maskIncognitoNumber(item.id))}</span>`
                : `<span class="cartillas-crop__empty">—</span>`;
            return `
              <tr>
                <td><span class="cartillas-status cartillas-status--ok">${escapeHtml(t("cartillas.statusAvailable"))}</span></td>
                <td class="cartillas-crop__name-cell">${escapeHtml(maskIncognitoJsonText(item.name))}</td>
                <td>${codeHtml}</td>
                <td>${idHtml}</td>
              </tr>
            `;
          })
          .join("");

        return `
          <section class="cartillas-crop" data-crop-code="${escapeHtml(crop.code)}">
            <header class="cartillas-crop__head">
              <h2 class="cartillas-crop__name">${escapeHtml(cropName)}</h2>
              <div class="cartillas-crop__meta">
                <span class="cartillas-crop__badge">${escapeHtml(t("cartillas.cropCode"))} <code>${escapeHtml(maskIncognitoJsonText(crop.code))}</code></span>
                <span class="cartillas-crop__badge">${escapeHtml(t("cartillas.cropId"))} <code>${escapeHtml(maskIncognitoNumber(crop.id))}</code></span>
                <span class="cartillas-crop__badge">${maskIncognitoNumber(matchedItems.length)} ${escapeHtml(t("cartillas.itemCount"))}</span>
              </div>
            </header>
            <div class="cartillas-crop__table-wrap">
              <table class="cartillas-crop__table">
                <thead>
                  <tr>
                    <th>${escapeHtml(t("cartillas.col.estado"))}</th>
                    <th>${escapeHtml(t("cartillas.col.name"))}</th>
                    <th>${escapeHtml(t("cartillas.col.code"))}</th>
                    <th>${escapeHtml(t("cartillas.col.id"))}</th>
                  </tr>
                </thead>
                <tbody>${rows}</tbody>
              </table>
            </div>
          </section>
        `;
      })
      .filter(Boolean)
      .join("");

    if (!sections) {
      this.cropsEl.innerHTML = `<p class="cartillas-page__empty">${escapeHtml(t("cartillas.noResults"))}</p>`;
    } else {
      this.cropsEl.innerHTML = sections;
    }

    if (this.summaryEl) {
      const totalAll = (this.catalog.crops || []).reduce((n, c) => n + (c.items?.length || 0), 0);
      const cropsCount = maskIncognitoNumber((this.catalog.crops || []).length);
      const itemsCount = maskIncognitoNumber(q || this.activeCrop !== "all" ? visibleItems : totalAll);
      this.summaryEl.innerHTML = `
        <span class="cartillas-page__pill">${escapeHtml(t("cartillas.summaryCrops"))} <strong>${cropsCount}</strong></span>
        <span class="cartillas-page__pill">${escapeHtml(t("cartillas.summaryItems"))} <strong>${itemsCount}</strong></span>
      `;
    }

    hydrateLucideIcons(this.root);
  }

  async onLanguageChange() {
    if (!this.root) return;
    await refreshModuleLanguage(this.root, { hydrateIcons: false });
    this.renderFilters();
    this.render();
  }

  destroy() {
    window.removeEventListener("agv:brand-pixel-changed", this.onBrandPixelChanged);
    this.searchEl?.removeEventListener("input", this.onSearch);
    this.clearEl?.removeEventListener("click", this.onClear);
    this.filtersEl?.removeEventListener("click", this.onFilterClick);
  }
}
