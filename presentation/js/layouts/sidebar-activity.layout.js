import { i18nService } from "../services/i18n.service.js";
import { lucideIcon } from "../utils/lucide-icon.util.js";

function htmlEscape(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildTimelineItemMarkup(entry) {
  const detail = entry.detail
    ? `<span class="sidebar-activity__item-detail">${htmlEscape(entry.detail)}</span>`
    : "";

  return `
    <li class="sidebar-activity__item sidebar-activity__item--${htmlEscape(entry.type)}" data-activity-id="${htmlEscape(entry.id)}">
      <span class="sidebar-activity__item-dot" aria-hidden="true"></span>
      <div class="sidebar-activity__item-content">
        <span class="sidebar-activity__item-label">${htmlEscape(entry.label)}</span>
        ${detail}
      </div>
      <time class="sidebar-activity__item-time">${htmlEscape(entry.time)}</time>
    </li>
  `;
}

export function renderSidebarActivityList(activityEntries = []) {
  const listElement = document.getElementById("sidebarActivityList");
  if (!listElement) {
    return;
  }

  const countElement = document.getElementById("sidebarActivityCount");
  if (countElement) {
    countElement.textContent = String(activityEntries.length);
    countElement.hidden = activityEntries.length === 0;
  }

  if (!activityEntries.length) {
    listElement.innerHTML = `
      <p class="sidebar-activity__empty">
        ${htmlEscape(i18nService.translate("sidebar.activityEmpty"))}
      </p>
    `;
    return;
  }

  listElement.innerHTML = `
    <ol class="sidebar-activity__timeline">
      ${activityEntries.map(buildTimelineItemMarkup).join("")}
    </ol>
  `;
}

export function buildSidebarActivityMarkup() {
  return `
    <section class="sidebar-activity" id="sidebarActivityPanel" aria-label="${i18nService.translate("sidebar.activityLabel")}">
      <header class="sidebar-activity__header">
        <button
          type="button"
          class="sidebar-activity__toggle"
          id="btnSidebarActivityToggle"
          aria-expanded="false"
          aria-controls="sidebarActivityBody"
          data-sidebar-tooltip="${i18nService.translate("sidebar.activityTitle")}"
        >
          <span class="sidebar-activity__icon" aria-hidden="true">${lucideIcon("history")}</span>
          ${lucideIcon("chevron-down", "sidebar-activity__chevron")}
          <span class="sidebar-activity__title">${i18nService.translate("sidebar.activityTitle")}</span>
        </button>
        <span class="sidebar-activity__count" id="sidebarActivityCount" hidden>0</span>
        <div class="sidebar-activity__actions">
          <button
            type="button"
            class="sidebar-activity__action"
            id="btnSidebarActivityPin"
            aria-label="${i18nService.translate("sidebar.activityPin")}"
            title="${i18nService.translate("sidebar.activityPin")}"
          >
            ${lucideIcon("pin")}
          </button>
          <button
            type="button"
            class="sidebar-activity__action"
            id="btnSidebarActivityRefresh"
            aria-label="${i18nService.translate("sidebar.activityRefresh")}"
            title="${i18nService.translate("sidebar.activityRefresh")}"
          >
            ${lucideIcon("refresh-cw")}
          </button>
        </div>
      </header>
      <div class="sidebar-activity__body" id="sidebarActivityBody">
        <div class="sidebar-activity__flyout-bar">
          <span class="sidebar-activity__flyout-title">${i18nService.translate("sidebar.activityTitle")}</span>
        </div>
        <div class="sidebar-activity__list" id="sidebarActivityList"></div>
      </div>
    </section>
  `;
}
