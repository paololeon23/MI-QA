import { routesConfig } from "../config/routes.config.js";
import {
  primaryNavigationItems,
  moduleNavigationGroups,
  cropNavigationGroups
} from "../config/sidebar-navigation.config.js";
import {
  formatAreaHa,
  getCropTabs
} from "../config/crop-hectares.registry.js?v=20260800";
import { i18nService } from "../services/i18n.service.js";
import { setGlobalSearchJump } from "../utils/global-search-jump.util.js";

const EXTRA_KEYWORDS = {
  "#/inicio": ["home", "inicio", "dashboard inicio", "hectareas", "fundo"],
  "#/dashboard": ["variedades", "catalogo", "genetica", "varieties"],
  "#/cartillas": ["cartillas", "checklist", "inspeccion", "codigos"],
  "#/trazabilidad": ["trazabilidad", "traza", "codigo", "lote"],
  "#/trazabilidad/peru": ["peru", "traza peru", "pe"],
  "#/trazabilidad/chile": ["chile", "traza chile", "cl"],
  "#/arandano/mp": ["arandano", "blueberry", "mp", "materia prima", "recepcion"],
  "#/arandano/pt": ["arandano", "blueberry", "pt", "producto terminado", "exportacion"],
  "#/arandano/plagas": ["arandano", "plagas", "pmpar", "fitosanitario"],
  "#/esparrago/mp": ["esparrago", "asparagus", "mp", "materia prima"],
  "#/esparrago/pt": ["esparrago", "asparagus", "pt", "producto terminado"],
  "#/esparrago/plagas": ["esparrago", "plagas"],
  "#/palta/mp": ["palta", "avocado", "mp", "materia prima"],
  "#/palta/pt": ["palta", "avocado", "pt", "producto terminado"],
  "#/palta/plagas": ["palta", "plagas"],
  "#/uva/mp": ["uva", "grape", "mp", "materia prima"],
  "#/uva/pt": ["uva", "grape", "pt", "producto terminado"],
  "#/uva/plagas": ["uva", "plagas"]
};

function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function encodeJump(payload) {
  return encodeURIComponent(JSON.stringify(payload ?? {}));
}

function decodeJump(value) {
  try {
    return JSON.parse(decodeURIComponent(value || "") || "{}");
  } catch {
    return {};
  }
}

function areaMatchesQuery(areaHa, query) {
  const formatted = formatAreaHa(areaHa);
  const raw = String(areaHa);
  const q = normalize(query).replace(",", ".");
  return (
    normalize(formatted).includes(normalize(query)) ||
    normalize(formatted).replace(",", ".").includes(q) ||
    raw.includes(q) ||
    Number.parseFloat(q) === areaHa
  );
}

function collectModuleEntries() {
  const entries = new Map();

  const upsert = (href, labelKey, groupLabelKey = "", icon = "file-text") => {
    if (!href || !routesConfig[href]) return;
    const current = entries.get(href) ?? {
      href,
      labelKey,
      groupLabelKey,
      icon,
      keywords: new Set(EXTRA_KEYWORDS[href] ?? [])
    };
    if (labelKey) current.labelKey = labelKey;
    if (groupLabelKey) current.groupLabelKey = groupLabelKey;
    if (icon) current.icon = icon;
    (EXTRA_KEYWORDS[href] ?? []).forEach((kw) => current.keywords.add(kw));
    entries.set(href, current);
  };

  primaryNavigationItems.forEach((item) => upsert(item.href, item.labelKey, "", item.icon));
  moduleNavigationGroups.forEach((group) => {
    (group.children ?? []).forEach((child) => {
      upsert(child.href, child.labelKey, group.labelKey, group.icon);
    });
  });
  cropNavigationGroups.forEach((group) => {
    (group.children ?? []).forEach((child) => {
      upsert(child.href, child.labelKey, group.labelKey, group.icon);
    });
  });
  Object.keys(routesConfig).forEach((href) => {
    if (!entries.has(href)) upsert(href, routesConfig[href].titleKey);
  });

  return [...entries.values()];
}

function searchModules(query) {
  const normalized = normalize(query);
  if (!normalized) return [];

  return collectModuleEntries()
    .map((entry) => {
      const label = i18nService.translate(entry.labelKey);
      const group = entry.groupLabelKey ? i18nService.translate(entry.groupLabelKey) : "";
      const haystack = normalize([label, group, entry.href, ...entry.keywords].join(" "));
      const score = haystack.includes(normalized)
        ? normalize(label).startsWith(normalized)
          ? 0
          : 1
        : -1;
      return {
        type: "module",
        href: entry.href,
        title: label,
        location: group || i18nService.translate("labels.searchOpenModule"),
        path: entry.href.replace("#/", ""),
        jump: { route: entry.href },
        score
      };
    })
    .filter((item) => item.score >= 0)
    .sort((a, b) => a.score - b.score || a.title.localeCompare(b.title, "es"))
    .slice(0, 5);
}

function searchHectaresData(query) {
  const normalized = normalize(query);
  if (!normalized || normalized.length < 1) return [];

  const hits = [];
  const crops = getCropTabs();

  crops.forEach((crop) => {
    const cropName = crop.nombre || crop.id;
    const summaries = crop.queries?.getFundoAreaSummary?.() ?? [];

    summaries.forEach((summary) => {
      const totalLabel = formatAreaHa(summary.totalAreaHa);
      const fundoHay = normalize(`fundo ${summary.fundo} total ${totalLabel} ha ${cropName}`);
      const matchesFundo =
        fundoHay.includes(normalized) ||
        areaMatchesQuery(summary.totalAreaHa, query) ||
        normalize(summary.fundo) === normalized;

      if (matchesFundo) {
        hits.push({
          type: "data",
          href: "#/inicio",
          title: `${totalLabel} ha — Fundo ${summary.fundo}`,
          location: i18nService.translate("labels.searchLocatedIn", {
            place: `${i18nService.translate("routes.inicio")} › ${cropName} › Fundo ${summary.fundo}`
          }),
          path: "inicio",
          jump: {
            route: "#/inicio",
            cropId: crop.id,
            fundo: summary.fundo,
            mode: "fundo-total"
          },
          score: areaMatchesQuery(summary.totalAreaHa, query) ? 0 : 2
        });
      }
    });

    (crop.parcels ?? []).forEach((parcel) => {
      const areaLabel = formatAreaHa(parcel.areaHa);
      const hay = normalize(
        `${parcel.cultivo} ${parcel.fundo} ${parcel.etapa} ${parcel.campo} ${parcel.variedad} ${areaLabel} ha`
      );
      if (!hay.includes(normalized) && !areaMatchesQuery(parcel.areaHa, query)) return;

      hits.push({
        type: "data",
        href: "#/inicio",
        title: `${parcel.variedad} · ${areaLabel} ha`,
        location: i18nService.translate("labels.searchLocatedIn", {
          place: `${i18nService.translate("routes.inicio")} › ${cropName} › Fundo ${parcel.fundo} › ${parcel.etapa}/${parcel.campo}`
        }),
        path: "inicio",
        jump: {
          route: "#/inicio",
          cropId: crop.id,
          fundo: parcel.fundo,
          filterText: parcel.variedad,
          mode: "parcel"
        },
        score: areaMatchesQuery(parcel.areaHa, query) ? 1 : 3
      });
    });
  });

  const seen = new Set();
  return hits
    .sort((a, b) => a.score - b.score || a.title.localeCompare(b.title, "es"))
    .filter((item) => {
      const key = `${item.title}|${item.location}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 6);
}

class GlobalSearchController {
  constructor() {
    this.onInput = this.handleInput.bind(this);
    this.onKeyDown = this.handleKeyDown.bind(this);
    this.onResultsClick = this.handleResultsClick.bind(this);
    this.onDocumentClick = this.handleDocumentClick.bind(this);
    this.activeIndex = -1;
  }

  initialize() {
    this.destroy();
    this.root = document.querySelector(".topbar__search");
    this.input = document.getElementById("txtGlobalSearch");
    this.results = document.getElementById("topbarSearchResults");

    if (!this.root || !this.input || !this.results) return;

    this.input.addEventListener("input", this.onInput);
    this.input.addEventListener("keydown", this.onKeyDown);
    this.input.addEventListener("focus", this.onInput);
    this.results.addEventListener("click", this.onResultsClick);
    document.addEventListener("click", this.onDocumentClick);
  }

  destroy() {
    this.input?.removeEventListener("input", this.onInput);
    this.input?.removeEventListener("keydown", this.onKeyDown);
    this.input?.removeEventListener("focus", this.onInput);
    this.results?.removeEventListener("click", this.onResultsClick);
    document.removeEventListener("click", this.onDocumentClick);
    this.hideResults();
  }

  handleDocumentClick(event) {
    if (!(event.target instanceof Element)) return;
    if (event.target.closest(".topbar__search")) return;
    this.hideResults();
  }

  handleInput() {
    this.renderResults(this.input?.value ?? "");
  }

  handleKeyDown(event) {
    if (!this.root?.classList.contains("is-open")) {
      if (event.key === "ArrowDown" && (this.input?.value ?? "").trim()) {
        this.renderResults(this.input.value);
      }
      return;
    }

    const options = [...(this.results?.querySelectorAll("[data-search-href]") ?? [])];
    if (!options.length) {
      if (event.key === "Escape") this.hideResults();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      this.activeIndex = (this.activeIndex + 1) % options.length;
      this.syncActiveOption(options);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      this.activeIndex = (this.activeIndex - 1 + options.length) % options.length;
      this.syncActiveOption(options);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const target = options[this.activeIndex] ?? options[0];
      if (target) this.navigateFromElement(target);
    } else if (event.key === "Escape") {
      event.preventDefault();
      this.hideResults();
      this.input?.blur();
    }
  }

  handleResultsClick(event) {
    const option = event.target.closest("[data-search-href]");
    if (!option) return;
    event.preventDefault();
    this.navigateFromElement(option);
  }

  syncActiveOption(options) {
    options.forEach((option, index) => {
      option.classList.toggle("is-active", index === this.activeIndex);
      option.setAttribute("aria-selected", index === this.activeIndex ? "true" : "false");
      if (index === this.activeIndex) option.scrollIntoView({ block: "nearest" });
    });
  }

  search(query) {
    const modules = searchModules(query);
    const data = searchHectaresData(query);
    return [...modules, ...data].slice(0, 10);
  }

  renderResults(query) {
    if (!this.results || !this.root) return;

    const trimmed = String(query ?? "").trim();
    if (!trimmed) {
      this.hideResults();
      return;
    }

    const matches = this.search(trimmed);
    this.activeIndex = matches.length ? 0 : -1;

    if (!matches.length) {
      this.results.innerHTML = `
        <p class="topbar__search-empty">${escapeHtml(i18nService.translate("labels.searchNoResults"))}</p>
      `;
      this.root.classList.add("is-open");
      this.input?.setAttribute("aria-expanded", "true");
      this.results.hidden = false;
      return;
    }

    this.results.innerHTML = matches
      .map((item, index) => {
        const typeLabel =
          item.type === "data"
            ? i18nService.translate("labels.searchTypeData")
            : i18nService.translate("labels.searchTypeModule");
        return `
        <button
          type="button"
          class="topbar__search-option${index === 0 ? " is-active" : ""}"
          data-search-href="${escapeHtml(item.href)}"
          data-search-jump="${encodeJump(item.jump)}"
          role="option"
          aria-selected="${index === 0 ? "true" : "false"}"
        >
          <span class="topbar__search-option-badge topbar__search-option-badge--${item.type}">${escapeHtml(typeLabel)}</span>
          <span class="topbar__search-option-main">
            <strong class="topbar__search-option-title">${escapeHtml(item.title)}</strong>
            <span class="topbar__search-option-location">${escapeHtml(item.location)}</span>
          </span>
        </button>
      `;
      })
      .join("");

    this.root.classList.add("is-open");
    this.input?.setAttribute("aria-expanded", "true");
    this.results.hidden = false;
  }

  navigateFromElement(element) {
    const href = element.getAttribute("data-search-href");
    const jump = decodeJump(element.getAttribute("data-search-jump"));
    this.navigate(href, jump);
  }

  navigate(href, jump = {}) {
    if (!href) return;
    setGlobalSearchJump({ ...jump, route: href });
    this.hideResults();
    if (this.input) this.input.value = "";

    const current = window.location.hash || "#/inicio";
    if (current === href) {
      window.dispatchEvent(new CustomEvent("agv:global-search-jump"));
    } else {
      window.location.hash = href;
    }
  }

  hideResults() {
    this.activeIndex = -1;
    this.root?.classList.remove("is-open");
    this.input?.setAttribute("aria-expanded", "false");
    if (this.results) {
      this.results.hidden = true;
      this.results.innerHTML = "";
    }
  }
}

export const globalSearchController = new GlobalSearchController();
