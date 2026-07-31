import { appConfig } from "../config/app.config.js";
import { getBrandLogoPath, getBrandMarkPath, isBrandPixelMode, toggleBrandPixelMode } from "../utils/brand-pixel.util.js";
import { i18nService } from "../services/i18n.service.js";
import { readLocalStorage, writeLocalStorage } from "../utils/safe-storage.util.js";
import { updateActiveSidebarLink, setPinnedPrimaryModule, closePrimaryPanelModules } from "../layouts/sidebar.layout.js";
import {
  seedSidebarActivityBoot,
  subscribeSidebarActivity
} from "../services/sidebar-activity.service.js";
import { renderSidebarActivityList } from "../layouts/sidebar-activity.layout.js";
import { hydrateLucideIcons, lucideIcon } from "../utils/lucide-icon.util.js";
import { mountSidebarAiAssistant } from "../modules/cultivos/esparrago-pt/esparrago-pt-ai-assistant.js";

const SIDEBAR_STORAGE_KEY = "agv-sidebar-collapsed";
const SIDEBAR_ACTIVITY_EXPANDED_KEY = "agv-sidebar-activity-expanded";
const SIDEBAR_ACTIVITY_PINNED_KEY = "agv-sidebar-activity-pinned";
const MOBILE_SHELL_MQ = window.matchMedia("(max-width: 768px)");

function isMobileShell() {
  return MOBILE_SHELL_MQ.matches;
}

function clearSidebarFlyoutPosition(flyout) {
  if (!flyout) return;
  flyout.style.top = "";
  flyout.style.bottom = "";
  flyout.style.maxHeight = "";
  flyout.style.overflowY = "";
}

/** Sube el flyout solo lo justo si se corta abajo (ej. Uva). */
function positionSidebarFlyout(groupElement) {
  const flyout = groupElement?.querySelector("[data-sidebar-flyout]");
  if (!flyout) return;
  clearSidebarFlyoutPosition(flyout);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (!groupElement.classList.contains("is-flyout-open")) return;

      const margin = 8;
      const viewportH = window.innerHeight;
      const rect = flyout.getBoundingClientRect();
      const overflow = rect.bottom - (viewportH - margin);

      // Solo un empujón mínimo hacia arriba (no anclar abajo del todo).
      if (overflow > 0) {
        flyout.style.top = `${-Math.ceil(overflow)}px`;
      }
    });
  });
}

function closeAllSidebarFlyouts(exceptGroup = null) {
  document.querySelectorAll("[data-sidebar-group].is-flyout-open").forEach((openGroup) => {
    if (exceptGroup && openGroup === exceptGroup) return;
    openGroup.classList.remove("is-flyout-open");
    clearSidebarFlyoutPosition(openGroup.querySelector("[data-sidebar-flyout]"));
  });
}

class SidebarController {
  initialize() {
    this.applyStoredCollapseState();
    this.restoreAlwaysExpandedGroups();
    this.bindCollapseToggle();
    this.bindMobileShellBehavior();
    this.bindSidebarSearch();
    this.bindGroupToggles();
    this.bindPrimaryLinkClicks();
    this.bindBrandHomeLink();
    this.bindActivityPanel();
    this.bindFlyoutViewportGuard();
    this.aiAssistant = mountSidebarAiAssistant();
  }

  /** En celular: menú off-canvas; inicia cerrado y se cierra al navegar / tocar fondo. */
  bindMobileShellBehavior() {
    const applicationShell = document.getElementById("applicationRoot");
    if (!applicationShell) return;

    const onViewportChange = () => {
      if (isMobileShell()) {
        this.setSidebarCollapsed(true, { persist: false });
        return;
      }
      applicationShell.classList.remove("is-sidebar-drawer-open");
      document.body.classList.remove("is-sidebar-drawer-open");
      this.applyStoredCollapseState();
    };

    if (typeof MOBILE_SHELL_MQ.addEventListener === "function") {
      MOBILE_SHELL_MQ.addEventListener("change", onViewportChange);
    } else {
      MOBILE_SHELL_MQ.addListener(onViewportChange);
    }

    applicationShell.addEventListener("click", (event) => {
      if (!isMobileShell()) return;
      if (!applicationShell.classList.contains("is-sidebar-drawer-open")) return;

      if (event.target === applicationShell) {
        this.setSidebarCollapsed(true, { persist: true });
        return;
      }

      const navLink = event.target.closest(".sidebar a[href^='#']");
      if (navLink) {
        window.setTimeout(() => {
          this.setSidebarCollapsed(true, { persist: true });
        }, 0);
      }
    });
  }

  setSidebarCollapsed(isCollapsed, { persist = true } = {}) {
    const applicationShell = document.getElementById("applicationRoot");
    const collapseButton = document.getElementById("btnSidebarCollapse");
    if (!applicationShell) return;

    if (isMobileShell()) {
      // Móvil: siempre estilos de menú expandido; solo abre/cierra el drawer.
      applicationShell.classList.remove("is-sidebar-collapsed");
      applicationShell.classList.toggle("is-sidebar-drawer-open", !isCollapsed);
      document.body.classList.toggle("is-sidebar-drawer-open", !isCollapsed);
      this.updateCollapseButtonIcon(collapseButton, isCollapsed);
      this.updateBrandLogo(false);
      if (persist) {
        writeLocalStorage(SIDEBAR_STORAGE_KEY, "true");
      }
      if (isCollapsed) {
        closeAllSidebarFlyouts();
      } else {
        this.restoreAlwaysExpandedGroups();
        updateActiveSidebarLink(window.location.hash || appConfig.defaultRoute);
      }
      return;
    }

    applicationShell.classList.remove("is-sidebar-drawer-open");
    document.body.classList.remove("is-sidebar-drawer-open");
    applicationShell.classList.toggle("is-sidebar-collapsed", isCollapsed);
    if (persist) {
      writeLocalStorage(SIDEBAR_STORAGE_KEY, String(isCollapsed));
    }
    this.updateCollapseButtonIcon(collapseButton, isCollapsed);
    this.updateBrandLogo(isCollapsed);

    if (isCollapsed) {
      closeAllSidebarFlyouts();
      document.querySelectorAll("[data-sidebar-group].is-expanded").forEach((group) => {
        if (!group.hasAttribute("data-always-expanded")) {
          group.classList.remove("is-expanded");
        }
      });
    } else {
      this.restoreAlwaysExpandedGroups();
      updateActiveSidebarLink(window.location.hash || appConfig.defaultRoute);
    }
  }

  bindFlyoutViewportGuard() {
    window.addEventListener("resize", () => {
      const open = document.querySelector("[data-sidebar-group].is-flyout-open");
      if (open) positionSidebarFlyout(open);
    });
  }

  bindBrandHomeLink() {
    const brandLink = document.getElementById("lnkSidebarBrand");
    if (!brandLink) {
      return;
    }

    brandLink.addEventListener("click", () => {
      closePrimaryPanelModules();
      setPinnedPrimaryModule(null);
      updateActiveSidebarLink(appConfig.defaultRoute, "primary");
    });
  }

  bindPrimaryLinkClicks() {
    const activeHash = () => window.location.hash || appConfig.defaultRoute;

    document.querySelectorAll(".sidebar__primary-panel .sidebar-nav-link").forEach((link) => {
      link.addEventListener("click", () => {
        closePrimaryPanelModules();
        setPinnedPrimaryModule(null);
        updateActiveSidebarLink(link.getAttribute("href") || activeHash(), "primary");
      });
    });

    document.querySelectorAll(".sidebar__primary-panel .sidebar-nav-tree__link").forEach((link) => {
      link.addEventListener("click", () => {
        updateActiveSidebarLink(link.getAttribute("href") || activeHash(), "route");
      });
    });
  }

  applyStoredCollapseState() {
    const applicationShell = document.getElementById("applicationRoot");
    if (!applicationShell) {
      return;
    }

    // En celular el menú empieza cerrado para no comer ancho de pantalla.
    const isCollapsed = isMobileShell() || readLocalStorage(SIDEBAR_STORAGE_KEY) === "true";
    this.setSidebarCollapsed(isCollapsed, { persist: false });
  }

  restoreAlwaysExpandedGroups() {
    document.querySelectorAll("[data-always-expanded]").forEach((groupElement) => {
      groupElement.classList.add("is-expanded");
    });
  }

  updateCollapseButtonIcon(collapseButton, isCollapsed) {
    if (!collapseButton) {
      return;
    }
    collapseButton.classList.toggle("is-expand-state", isCollapsed);
    collapseButton.setAttribute(
      "aria-label",
      i18nService.translate(isCollapsed ? "sidebar.expand" : "sidebar.collapse")
    );
  }

  updateBrandLogo(isCollapsed) {
    const logoImage = document.getElementById("imgApplicationLogo");
    if (!logoImage) {
      return;
    }

    const version = `?v=${appConfig.cacheBustingVersion}`;
    logoImage.src = isCollapsed
      ? `./${getBrandMarkPath()}${version}`
      : `./${getBrandLogoPath()}${version}`;

    if (isCollapsed) {
      logoImage.alt = "";
      logoImage.setAttribute("aria-hidden", "true");
    } else {
      logoImage.alt = "AGROVISION";
      logoImage.removeAttribute("aria-hidden");
    }
  }

  bindSidebarSearch() {
    const searchInput = document.getElementById("txtSidebarSearch");
    const applicationShell = document.getElementById("applicationRoot");

    if (!searchInput) {
      return;
    }

    searchInput.addEventListener("input", () => {
      this.filterSidebarNavigation(searchInput.value);
    });

    searchInput.addEventListener("click", () => {
      if (applicationShell?.classList.contains("is-sidebar-collapsed")) {
        document.getElementById("txtGlobalSearch")?.focus();
      }
    });
  }

  filterSidebarNavigation(query) {
    const navigationMenu = document.getElementById("sidebarNavigationMenu");
    if (!navigationMenu) {
      return;
    }

    const normalizedQuery = query.trim().toLowerCase();
    const isFiltering = normalizedQuery.length > 0;

    navigationMenu.querySelectorAll(".sidebar-nav-link").forEach((navigationLink) => {
      const linkText = navigationLink.textContent?.toLowerCase() ?? "";
      navigationLink.hidden = isFiltering && !linkText.includes(normalizedQuery);
    });

    navigationMenu.querySelectorAll("[data-sidebar-group]").forEach((groupElement) => {
      const groupLabel = groupElement.querySelector(".sidebar-nav-group__label")?.textContent?.toLowerCase() ?? "";
      const childLinks = groupElement.querySelectorAll(".sidebar-nav-tree__link");
      let hasVisibleChild = false;

      childLinks.forEach((childLink) => {
        const childText = childLink.textContent?.toLowerCase() ?? "";
        const matches = !isFiltering || childText.includes(normalizedQuery) || groupLabel.includes(normalizedQuery);
        childLink.hidden = isFiltering && !matches;
        if (matches && isFiltering) {
          hasVisibleChild = true;
        }
      });

      const groupMatches = !isFiltering || groupLabel.includes(normalizedQuery) || hasVisibleChild;
      groupElement.hidden = !groupMatches;

      if (isFiltering && groupMatches && hasVisibleChild) {
        groupElement.classList.add("is-expanded");
      }
    });

    const sectionLabel = navigationMenu.querySelector(".sidebar__section-label");
    const sectionDivider = navigationMenu.querySelector(".sidebar__nav-divider");
    if (sectionLabel) {
      sectionLabel.hidden = isFiltering;
    }
    if (sectionDivider) {
      sectionDivider.hidden = isFiltering;
    }

    if (!isFiltering) {
      updateActiveSidebarLink(window.location.hash || appConfig.defaultRoute);
    }
  }

  bindCollapseToggle() {
    const collapseButton = document.getElementById("btnSidebarCollapse");
    const applicationShell = document.getElementById("applicationRoot");

    if (!collapseButton || !applicationShell) {
      return;
    }

    collapseButton.addEventListener("click", () => {
      const currentlyClosed = isMobileShell()
        ? !applicationShell.classList.contains("is-sidebar-drawer-open")
        : applicationShell.classList.contains("is-sidebar-collapsed");
      const willCollapse = !currentlyClosed;

      applicationShell.classList.add("is-sidebar-collapsing");

      closeAllSidebarFlyouts();
      closePrimaryPanelModules();
      setPinnedPrimaryModule(null);

      this.setSidebarCollapsed(willCollapse, { persist: true });
      updateActiveSidebarLink(window.location.hash || appConfig.defaultRoute, "route");
      collapseButton.blur();

      window.requestAnimationFrame(() => {
        window.setTimeout(() => {
          applicationShell.classList.remove("is-sidebar-collapsing");
        }, 180);
      });
    });
  }

  bindGroupToggles() {
    const groupToggles = document.querySelectorAll("[data-sidebar-group-toggle]");

    groupToggles.forEach((toggleButton) => {
      toggleButton.addEventListener("click", (event) => {
        event.stopPropagation();

        const applicationShell = document.getElementById("applicationRoot");
        const groupElement = toggleButton.closest("[data-sidebar-group]");

        if (!groupElement) {
          return;
        }

        if (groupElement.hasAttribute("data-always-expanded")) {
          groupElement.classList.add("is-expanded");
          return;
        }

        if (applicationShell?.classList.contains("is-sidebar-collapsed")) {
          document.getElementById("sidebarActivityPanel")?.classList.remove("is-expanded");
          document.getElementById("btnSidebarActivityToggle")?.setAttribute("aria-expanded", "false");

          const isFlyoutOpen = groupElement.classList.contains("is-flyout-open");
          closeAllSidebarFlyouts();
          if (!isFlyoutOpen) {
            groupElement.classList.add("is-flyout-open");
            positionSidebarFlyout(groupElement);
          }
          const hash = window.location.hash || appConfig.defaultRoute;
          const moduleId = groupElement.dataset.sidebarGroup;
          if (
            groupElement.classList.contains("is-flyout-open") &&
            groupElement.classList.contains("sidebar-nav-group--module")
          ) {
            closePrimaryPanelModules(moduleId);
            groupElement.classList.add("is-flyout-open");
            positionSidebarFlyout(groupElement);
            setPinnedPrimaryModule(moduleId);
            updateActiveSidebarLink(hash, "module");
          } else {
            closePrimaryPanelModules();
            setPinnedPrimaryModule(null);
            updateActiveSidebarLink(hash, "collapse");
          }
          return;
        }

        const wasExpanded = groupElement.classList.contains("is-expanded");
        groupElement.classList.toggle("is-expanded");
        const hash = window.location.hash || appConfig.defaultRoute;
        const moduleId = groupElement.dataset.sidebarGroup;

        if (groupElement.classList.contains("sidebar-nav-group--module")) {
          if (groupElement.classList.contains("is-expanded")) {
            closePrimaryPanelModules(moduleId);
            groupElement.classList.add("is-expanded");
            setPinnedPrimaryModule(moduleId);
            updateActiveSidebarLink(hash, "module");
          } else {
            closePrimaryPanelModules();
            setPinnedPrimaryModule(null);
            updateActiveSidebarLink(hash, "collapse");
          }
          return;
        }

        if (!wasExpanded) {
          closePrimaryPanelModules();
          updateActiveSidebarLink(hash, "route");
        } else {
          updateActiveSidebarLink(hash, "collapse");
        }
      });
    });
  }

  destroy() {
    this.unsubscribeActivity?.();
    this.unsubscribeActivity = null;
  }

  bindActivityPanel() {
    const panel = document.getElementById("sidebarActivityPanel");
    const toggleButton = document.getElementById("btnSidebarActivityToggle");
    const refreshButton = document.getElementById("btnSidebarActivityRefresh");
    const pinButton = document.getElementById("btnSidebarActivityPin");
    const incognitoButton = document.getElementById("btnSidebarActivityIncognito");

    if (!panel) {
      return;
    }

    const syncIncognitoButton = () => {
      if (!incognitoButton) return;
      const on = isBrandPixelMode();
      incognitoButton.classList.toggle("is-active", on);
      incognitoButton.setAttribute("aria-pressed", String(on));
      const label = i18nService.translate(
        on ? "sidebar.activityIncognitoOn" : "sidebar.activityIncognito"
      );
      incognitoButton.setAttribute("aria-label", label);
      incognitoButton.title = label;
      incognitoButton.innerHTML = lucideIcon(on ? "eye-off" : "eye");
      hydrateLucideIcons(incognitoButton);
    };

    const isExpanded = readLocalStorage(SIDEBAR_ACTIVITY_EXPANDED_KEY) === "true";
    const isPinned = readLocalStorage(SIDEBAR_ACTIVITY_PINNED_KEY) === "true";
    panel.classList.toggle("is-expanded", isExpanded);
    panel.classList.toggle("is-pinned", isPinned);
    toggleButton?.setAttribute("aria-expanded", String(isExpanded));
    pinButton?.classList.toggle("is-active", isPinned);
    syncIncognitoButton();

    toggleButton?.addEventListener("click", () => {
      if (panel.classList.contains("is-pinned")) {
        return;
      }

      const applicationShell = document.getElementById("applicationRoot");
      const isCollapsed = applicationShell?.classList.contains("is-sidebar-collapsed");
      if (isCollapsed) {
        document.querySelectorAll("[data-sidebar-group].is-flyout-open").forEach((openGroup) => {
          openGroup.classList.remove("is-flyout-open");
        });
      }

      const nextExpanded = !panel.classList.contains("is-expanded");
      panel.classList.toggle("is-expanded", nextExpanded);
      toggleButton.setAttribute("aria-expanded", String(nextExpanded));
      writeLocalStorage(SIDEBAR_ACTIVITY_EXPANDED_KEY, String(nextExpanded));
    });

    pinButton?.addEventListener("click", () => {
      const nextPinned = !panel.classList.contains("is-pinned");
      panel.classList.toggle("is-pinned", nextPinned);
      pinButton.classList.toggle("is-active", nextPinned);
      writeLocalStorage(SIDEBAR_ACTIVITY_PINNED_KEY, String(nextPinned));
      if (nextPinned) {
        panel.classList.add("is-expanded");
        toggleButton?.setAttribute("aria-expanded", "true");
        writeLocalStorage(SIDEBAR_ACTIVITY_EXPANDED_KEY, "true");
      }
    });

    incognitoButton?.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleBrandPixelMode();
      syncIncognitoButton();
      const shell = document.getElementById("applicationRoot");
      const collapsed = Boolean(shell?.classList.contains("is-sidebar-collapsed"));
      this.updateBrandLogo(collapsed);
    });

    window.addEventListener("agv:brand-pixel-changed", syncIncognitoButton);

    refreshButton?.addEventListener("click", () => {
      refreshButton.classList.add("is-spinning");
      window.location.reload();
    });

    this.unsubscribeActivity = subscribeSidebarActivity((entries) => {
      renderSidebarActivityList(entries);
      hydrateLucideIcons(panel);
      syncIncognitoButton();
    });

    seedSidebarActivityBoot();
  }
}

export const sidebarController = new SidebarController();
