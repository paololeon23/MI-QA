import { i18nService } from "../services/i18n.service.js";
import {
  calculateJulianDay,
  formatCompactDate
} from "../utils/date-formatter.util.js";
import { getLanguageByCode, languagesConfig } from "../config/languages.config.js";
import { buildLanguageSelectorMarkup } from "./language-selector.layout.js";
import { renderBreadcrumbHtml } from "../utils/breadcrumb.util.js";
import { buildSidebarCollapseIconMarkup } from "./sidebar-collapse-icon.layout.js";
import { lucideIcon } from "../utils/lucide-icon.util.js";
import { hydrateLucideIcons } from "../utils/lucide-icon.util.js";
import { getBrandAcronym } from "../utils/brand-pixel.util.js";

function buildDatetimeMarkup(locale) {
  const displayDate = formatCompactDate(new Date(), locale);
  const julianDay = calculateJulianDay();

  return `
    <div class="topbar__datetime-pill" id="panelTopbarDatetime">
      <div class="topbar__datetime-item">
        ${lucideIcon("calendar", "topbar__datetime-icon")}
        <span class="topbar__datetime-value" id="txtTopbarDate">${displayDate}</span>
      </div>
      <span class="topbar__datetime-divider" aria-hidden="true"></span>
      <div class="topbar__datetime-item">
        ${lucideIcon("globe-2", "topbar__datetime-icon")}
        <span class="topbar__datetime-label">${i18nService.translate("labels.julian")}</span>
        <span class="topbar__datetime-value" id="txtTopbarJulian">${julianDay}</span>
      </div>
    </div>
  `;
}

export function buildTopbarMarkup(currentLanguageCode, routeHash = "#/inicio") {
  const activeLanguage = getLanguageByCode(currentLanguageCode) ?? languagesConfig[0];
  const breadcrumbHtml = renderBreadcrumbHtml(routeHash, (key) => i18nService.translate(key));

  return `
    <header class="topbar" id="applicationTopbar">
      <div class="topbar__leading">
        <button
          type="button"
          class="topbar__sidebar-toggle"
          id="btnSidebarCollapse"
          aria-label="${i18nService.translate("sidebar.collapse")}"
        >
          ${buildSidebarCollapseIconMarkup()}
        </button>
        <div class="topbar__primary">
          <nav class="topbar__breadcrumb" id="navBreadcrumb" aria-label="Breadcrumb">
            <span class="topbar__breadcrumb-root">${i18nService.translate("breadcrumb.home")}</span>
            ${lucideIcon("chevron-right", "topbar__breadcrumb-separator")}
            <span class="topbar__breadcrumb-segment" data-brand-acronym>${getBrandAcronym()}</span>
            ${lucideIcon("chevron-right", "topbar__breadcrumb-separator")}
            <span id="navBreadcrumbDynamic">${breadcrumbHtml}</span>
          </nav>
          <h1 class="topbar__title" id="txtTopbarTitle"></h1>
        </div>
      </div>

      <div class="topbar__center">
        <div class="topbar__search">
          ${lucideIcon("search", "topbar__search-icon")}
          <input
            type="search"
            class="topbar__search-input"
            id="txtGlobalSearch"
            data-i18n-placeholder="labels.searchPlaceholder"
            placeholder="${i18nService.translate("labels.searchPlaceholder")}"
            autocomplete="off"
            aria-autocomplete="list"
            aria-controls="topbarSearchResults"
            aria-expanded="false"
          />
          <div
            class="topbar__search-results"
            id="topbarSearchResults"
            role="listbox"
            aria-label="${i18nService.translate("labels.searchResults")}"
            hidden
          ></div>
        </div>
      </div>

      <div class="topbar__actions">
        ${buildDatetimeMarkup(activeLanguage.locale)}

        <span class="topbar__actions-divider" aria-hidden="true"></span>

        <span class="topbar__status-badge" id="badgeSystemStatus">
          <span class="topbar__status-dot"></span>
          <span data-i18n="labels.online">${i18nService.translate("labels.online")}</span>
        </span>

        ${buildLanguageSelectorMarkup(currentLanguageCode)}
      </div>
    </header>
  `;
}

export function updateTopbarTitle(titleKey) {
  const topbarTitle = document.getElementById("txtTopbarTitle");
  if (topbarTitle) {
    topbarTitle.textContent = i18nService.translate(titleKey);
  }
}

export function updateTopbarDatetime(languageCode) {
  const activeLanguage = getLanguageByCode(languageCode) ?? languagesConfig[0];
  const dateElement = document.getElementById("txtTopbarDate");
  const julianElement = document.getElementById("txtTopbarJulian");

  if (dateElement) {
    dateElement.textContent = formatCompactDate(new Date(), activeLanguage.locale);
  }
  if (julianElement) {
    julianElement.textContent = String(calculateJulianDay());
  }
}

export function updateBreadcrumbModule(activeHash) {
  const breadcrumbContainer = document.getElementById("navBreadcrumbDynamic");
  if (!breadcrumbContainer) {
    return;
  }
  breadcrumbContainer.innerHTML = renderBreadcrumbHtml(activeHash, (key) =>
    i18nService.translate(key)
  );
  hydrateLucideIcons(breadcrumbContainer);
}
