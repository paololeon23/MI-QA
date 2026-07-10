import { i18nService } from "../services/i18n.service.js";
// v20260827 — sidebar primary-panel module exclusivity
import { appConfig } from "../config/app.config.js";
import {
  primaryNavigationItems,
  moduleNavigationGroups,
  cropNavigationGroups
} from "../config/sidebar-navigation.config.js";
import { lucideIcon } from "../utils/lucide-icon.util.js";
import { renderCropIcon } from "../utils/crop-icon.util.js";
import { buildSidebarActivityMarkup } from "./sidebar-activity.layout.js";

const assetVersion = `?v=${appConfig.cacheBustingVersion}`;

function buildPrimaryLinkMarkup(navItem) {
  const label = i18nService.translate(navItem.labelKey);
  return `
    <a
      class="sidebar-nav-link"
      href="${navItem.href}"
      id="${navItem.id}"
      data-sidebar-tooltip="${label}"
    >
      <span class="sidebar-nav-link__icon">${lucideIcon(navItem.icon)}</span>
      <span class="sidebar-nav-link__text">${label}</span>
    </a>
  `;
}

function buildTreeLinksMarkup(children, { themeId = null, includeIds = true } = {}) {
  const cropThemeAttribute = themeId ? ` data-crop-theme="${themeId}"` : "";

  return children
    .map((childItem) => {
      const idAttribute = includeIds ? ` id="${childItem.id}"` : "";
      return `
        <a class="sidebar-nav-tree__link" href="${childItem.href}"${idAttribute}${cropThemeAttribute}>
          <span class="sidebar-nav-tree__dot"></span>
          <span class="sidebar-nav-tree__text">${i18nService.translate(childItem.labelKey)}</span>
          ${lucideIcon("chevron-right", "sidebar-nav-tree__arrow")}
        </a>
      `;
    })
    .join("");
}

function buildNavGroupMarkup(group, { variant = "crop" } = {}) {
  const expandedClass = group.defaultExpanded ? " is-expanded" : "";
  const alwaysExpandedAttribute = group.alwaysExpanded ? ' data-always-expanded="true"' : "";
  const defaultExpandedAttribute = group.defaultExpanded ? ' data-default-expanded="true"' : "";
  const treeLinks = buildTreeLinksMarkup(group.children, {
    themeId: variant === "crop" ? group.theme : null
  });
  const flyoutLinks = buildTreeLinksMarkup(group.children, {
    themeId: variant === "crop" ? group.theme : null,
    includeIds: false
  });
  const groupLabel = i18nService.translate(group.labelKey);
  const groupIconMarkup =
    variant === "crop"
      ? renderCropIcon(group.id)
      : lucideIcon(group.icon);
  const variantClass = variant === "module" ? " sidebar-nav-group--module" : "";

  return `
    <div
      class="sidebar-nav-group${expandedClass}${variantClass}"
      data-sidebar-group="${group.id}"${variant === "crop" ? ` data-crop-theme="${group.theme}"` : ""}${alwaysExpandedAttribute}${defaultExpandedAttribute}
      id="sidebarGroup${capitalize(group.id)}"
    >
      <button type="button" class="sidebar-nav-group__trigger" data-sidebar-group-toggle id="btnSidebarGroup${capitalize(group.id)}" data-sidebar-tooltip="${groupLabel}">
        <span class="sidebar-nav-group__icon">${groupIconMarkup}</span>
        <span class="sidebar-nav-group__label">${groupLabel}</span>
        ${lucideIcon("chevron-up", "sidebar-nav-group__chevron")}
      </button>
      <div class="sidebar-nav-tree" data-sidebar-submenu>
        ${treeLinks}
      </div>
      <div class="sidebar-nav-flyout" data-sidebar-flyout>
        <div class="sidebar-nav-flyout__header">${groupLabel}</div>
        <div class="sidebar-nav-flyout__tree">
          ${flyoutLinks}
        </div>
      </div>
    </div>
  `;
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function buildPrimarySectionMarkup() {
  const moduleGroupsByIndex = new Map(
    moduleNavigationGroups.map((group) => [group.insertAfterIndex ?? -1, group])
  );
  const primaryMarkup = [];
  const insertedGroupIds = new Set();

  primaryNavigationItems.forEach((navItem, index) => {
    primaryMarkup.push(buildPrimaryLinkMarkup(navItem));

    const moduleGroup = moduleGroupsByIndex.get(index);
    if (moduleGroup) {
      primaryMarkup.push(buildNavGroupMarkup(moduleGroup, { variant: "module" }));
      insertedGroupIds.add(moduleGroup.id);
    }
  });

  moduleGroupsByIndex.forEach((group, index) => {
    if (index >= primaryNavigationItems.length - 1 && !insertedGroupIds.has(group.id)) {
      primaryMarkup.push(buildNavGroupMarkup(group, { variant: "module" }));
    }
  });

  return primaryMarkup.join("");
}

export function buildSidebarMarkup() {
  const primarySection = buildPrimarySectionMarkup();
  const cropGroups = cropNavigationGroups
    .map((cropGroup) => buildNavGroupMarkup(cropGroup, { variant: "crop" }))
    .join("");

  return `
    <aside class="sidebar" id="sidebarNavigation">
      <div class="sidebar__brand">
        <img
          class="sidebar__logo"
          id="imgApplicationLogo"
          src="./${appConfig.brandLogoPath}${assetVersion}"
          alt="AGROVISION"
        />
      </div>

      <nav class="sidebar__nav" id="sidebarNavigationMenu">
        <div class="sidebar__search" role="search">
          ${lucideIcon("search", "sidebar__search-icon")}
          <input
            type="search"
            class="sidebar__search-input"
            id="txtSidebarSearch"
            data-i18n-placeholder="sidebar.searchPlaceholder"
            placeholder="${i18nService.translate("sidebar.searchPlaceholder")}"
            aria-label="${i18nService.translate("sidebar.searchLabel")}"
            autocomplete="off"
          />
        </div>
        <div class="sidebar__primary-panel">
          ${primarySection}
        </div>
        <span class="sidebar__nav-divider" aria-hidden="true"></span>
        <span class="sidebar__section-label">${i18nService.translate("sidebar.sectionCrops")}</span>
        ${cropGroups}
      </nav>

      ${buildSidebarActivityMarkup()}
    </aside>
  `;
}

export let pinnedPrimaryModuleId = null;

export function setPinnedPrimaryModule(id) {
  pinnedPrimaryModuleId = id || null;
}

export function closePrimaryPanelModules(exceptGroupId = null) {
  const panel = document.querySelector(".sidebar__primary-panel");
  if (!panel) {
    return;
  }

  panel.querySelectorAll(".sidebar-nav-group--module").forEach((group) => {
    if (exceptGroupId && group.dataset.sidebarGroup === exceptGroupId) {
      return;
    }
    group.classList.remove("is-expanded", "is-flyout-open");
  });
}

export function applyPrimaryPanelExclusivity(activeHash, focus = "route") {
  const panel = document.querySelector(".sidebar__primary-panel");
  if (!panel) {
    return;
  }

  const moduleGroups = [...panel.querySelectorAll(".sidebar-nav-group--module")];
  const primaryLinks = [...panel.querySelectorAll(".sidebar-nav-link")];
  const childLink = panel.querySelector(`.sidebar-nav-tree__link[href="${activeHash}"]`);
  const primaryLink = panel.querySelector(`.sidebar-nav-link[href="${activeHash}"]`);
  const expandedModule = panel.querySelector(
    ".sidebar-nav-group--module.is-expanded, .sidebar-nav-group--module.is-flyout-open"
  );
  const pinnedModule = pinnedPrimaryModuleId
    ? panel.querySelector(`[data-sidebar-group="${pinnedPrimaryModuleId}"]`)
    : null;

  const clearModuleActive = () => moduleGroups.forEach((group) => group.classList.remove("is-route-active"));
  const clearPrimaryActive = () => primaryLinks.forEach((link) => link.classList.remove("is-active"));

  if (focus === "primary") {
    pinnedPrimaryModuleId = null;
  }

  if (childLink) {
    pinnedPrimaryModuleId = childLink.closest("[data-sidebar-group]")?.dataset.sidebarGroup || null;
    clearPrimaryActive();
    const parent = childLink.closest(".sidebar-nav-group--module");
    moduleGroups.forEach((group) => group.classList.toggle("is-route-active", group === parent));
    return;
  }

  if (pinnedModule && focus !== "primary") {
    const isOpen =
      pinnedModule.classList.contains("is-expanded") || pinnedModule.classList.contains("is-flyout-open");
    if (isOpen) {
      clearPrimaryActive();
      moduleGroups.forEach((group) => group.classList.toggle("is-route-active", group === pinnedModule));
      return;
    }
    pinnedPrimaryModuleId = null;
  }

  if (focus === "module" && expandedModule) {
    pinnedPrimaryModuleId = expandedModule.dataset.sidebarGroup || null;
    clearPrimaryActive();
    moduleGroups.forEach((group) => group.classList.toggle("is-route-active", group === expandedModule));
    return;
  }

  if (focus === "primary") {
    clearModuleActive();
    primaryLinks.forEach((link) => link.classList.toggle("is-active", link.getAttribute("href") === activeHash));
    return;
  }

  if (primaryLink) {
    pinnedPrimaryModuleId = null;
    clearModuleActive();
    primaryLinks.forEach((link) => link.classList.toggle("is-active", link.getAttribute("href") === activeHash));
    return;
  }

  clearModuleActive();
  primaryLinks.forEach((link) => link.classList.toggle("is-active", link.getAttribute("href") === activeHash));
}

export function syncSidebarGroupActiveStates(activeHash) {
  document.querySelectorAll("[data-sidebar-group]").forEach((groupElement) => {
    if (groupElement.closest(".sidebar__primary-panel")) {
      return;
    }

    const hasActiveChild = Boolean(
      groupElement.querySelector(`.sidebar-nav-tree__link[href="${activeHash}"]`)
    );
    groupElement.classList.toggle("is-route-active", hasActiveChild);
  });
}

export function updateActiveSidebarLink(activeHash, focus = "route") {
  const panel = document.querySelector(".sidebar__primary-panel");
  const childInPrimary = panel?.querySelector(`.sidebar-nav-tree__link[href="${activeHash}"]`);
  const primaryLinkMatch = panel?.querySelector(`.sidebar-nav-link[href="${activeHash}"]`);

  // Cierre manual del usuario: no reabrir el grupo aunque la ruta hija siga activa
  if (focus === "collapse") {
    const allLinks = document.querySelectorAll(".sidebar-nav-link, .sidebar-nav-tree__link");
    allLinks.forEach((navigationLink) => {
      const isActive = navigationLink.getAttribute("href") === activeHash;
      navigationLink.classList.toggle("is-active", isActive);
    });
    syncSidebarGroupActiveStates(activeHash);
    applyPrimaryPanelExclusivity(activeHash, "route");

    const applicationRoot = document.getElementById("applicationRoot");
    const cropMatch = activeHash.match(/#\/([^/]+)/);
    const cropId = cropMatch?.[1];
    const knownCrops = ["uva", "arandano", "esparrago", "palta"];
    if (applicationRoot) {
      if (knownCrops.includes(cropId)) {
        applicationRoot.dataset.activeCrop = cropId;
      } else {
        delete applicationRoot.dataset.activeCrop;
      }
    }
    return;
  }

  const keepModuleOpen = focus === "module" || Boolean(childInPrimary);

  if (!keepModuleOpen) {
    closePrimaryPanelModules();
    if (focus === "primary" || primaryLinkMatch) {
      pinnedPrimaryModuleId = null;
    }
  } else if (childInPrimary) {
    const parentId = childInPrimary.closest("[data-sidebar-group]")?.dataset.sidebarGroup;
    closePrimaryPanelModules(parentId);
    if (parentId) {
      panel.querySelector(`[data-sidebar-group="${parentId}"]`)?.classList.add("is-expanded");
    }
  } else if (focus === "module" && pinnedPrimaryModuleId) {
    closePrimaryPanelModules(pinnedPrimaryModuleId);
    panel?.querySelector(`[data-sidebar-group="${pinnedPrimaryModuleId}"]`)?.classList.add("is-expanded");
  }

  const allLinks = document.querySelectorAll(".sidebar-nav-link, .sidebar-nav-tree__link");
  allLinks.forEach((navigationLink) => {
    const isActive = navigationLink.getAttribute("href") === activeHash;
    navigationLink.classList.toggle("is-active", isActive);
  });

  syncSidebarGroupActiveStates(activeHash);
  applyPrimaryPanelExclusivity(activeHash, focus);

  const applicationRoot = document.getElementById("applicationRoot");
  const cropMatch = activeHash.match(/#\/([^/]+)/);
  const cropId = cropMatch?.[1];
  const knownCrops = ["uva", "arandano", "esparrago", "palta"];
  if (applicationRoot) {
    if (knownCrops.includes(cropId)) {
      applicationRoot.dataset.activeCrop = cropId;
    } else {
      delete applicationRoot.dataset.activeCrop;
    }
  }
}
