import { i18nService } from "../services/i18n.service.js";
import { stateStore } from "../core/state-store.js";
import { buildSidebarMarkup } from "../layouts/sidebar.layout.js";
import { buildTopbarMarkup } from "../layouts/topbar.layout.js";
import { sidebarController } from "./sidebar.controller.js";
import { globalSearchController } from "./global-search.controller.js";

class ShellController {
  constructor() {
    this.boundCloseDropdowns = this.closeAllDropdowns.bind(this);
    this.onLanguageChange = null;
  }

  initialize(onLanguageChangeCallback) {
    this.onLanguageChange = onLanguageChangeCallback;
    sidebarController.initialize();
    globalSearchController.initialize();
    this.bindLanguageSelector();
    this.bindGlobalClickOutside();
  }

  bindLanguageSelector() {
    const languageSelector = document.getElementById("languageSelector");
    const languageTrigger = document.getElementById("btnLanguageSelector");
    const languageOptions = document.querySelectorAll("[data-language-code]");

    if (!languageSelector || !languageTrigger) {
      return;
    }

    languageTrigger.addEventListener("click", (event) => {
      event.stopPropagation();
      languageSelector.classList.toggle("is-open");
    });

    languageOptions.forEach((optionElement) => {
      optionElement.addEventListener("click", async (event) => {
        event.stopPropagation();
        const selectedLanguage = optionElement.dataset.languageCode;
        const currentLanguage = stateStore.get().currentLanguage;

        if (selectedLanguage === currentLanguage) {
          languageSelector.classList.remove("is-open");
          return;
        }

        if (typeof this.onLanguageChange === "function") {
          await this.onLanguageChange(selectedLanguage);
        }

        languageSelector.classList.remove("is-open");
      });
    });
  }

  bindGlobalClickOutside() {
    document.removeEventListener("click", this.boundCloseDropdowns);
    document.addEventListener("click", this.boundCloseDropdowns);
  }

  closeAllDropdowns(event) {
    const languageSelector = document.getElementById("languageSelector");
    if (languageSelector) {
      languageSelector.classList.remove("is-open");
    }

    const clickTarget = event?.target;
    if (!(clickTarget instanceof Element && clickTarget.closest(".topbar__search"))) {
      globalSearchController.hideResults();
    }

    if (clickTarget instanceof Element && clickTarget.closest("[data-sidebar-flyout], [data-sidebar-group-toggle]")) {
      return;
    }

    document.querySelectorAll("[data-sidebar-group].is-flyout-open").forEach((openGroup) => {
      openGroup.classList.remove("is-flyout-open");
    });
  }

  destroy() {
    document.removeEventListener("click", this.boundCloseDropdowns);
    globalSearchController.destroy();
    sidebarController.destroy();
  }
}

export const shellController = new ShellController();

export function renderApplicationShell(currentLanguageCode) {
  const currentRoute = stateStore.get().currentRoute ?? "#/inicio";
  return `
    ${buildSidebarMarkup()}
    ${buildTopbarMarkup(currentLanguageCode, currentRoute)}
    <main class="main-content" id="dynamicModuleContainer">
      <div class="main-content__inner" id="dynamicModuleInner"></div>
    </main>
    <footer class="footer" id="applicationFooter">
      <span id="txtFooterLeft">${i18nService.translate("labels.footerLeft")}</span>
      <div class="footer__version">
        <span class="footer__dot"></span>
        <span id="txtFooterRight">${i18nService.translate("labels.footerRight")}</span>
      </div>
    </footer>
  `;
}

export { updateActiveSidebarLink, setPinnedPrimaryModule, closePrimaryPanelModules } from "../layouts/sidebar.layout.js";
export { updateTopbarTitle, updateBreadcrumbModule, updateTopbarDatetime } from "../layouts/topbar.layout.js";
