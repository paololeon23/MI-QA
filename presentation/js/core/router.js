import { routesConfig } from "../config/routes.config.js";
import { appConfig } from "../config/app.config.js";
import { i18nService } from "../services/i18n.service.js";
import { moduleLoaderService } from "../services/module-loader.service.js";
import {
  updateActiveSidebarLink,
  updateTopbarTitle,
  updateBreadcrumbModule
} from "../controllers/shell.controller.js";
import { stateStore } from "./state-store.js";
import { renderModuleSkeleton } from "../utils/loading-skeleton.util.js";
import { applyTranslationsToContainer } from "../utils/i18n-dom.util.js";
import { pushSidebarActivity } from "../services/sidebar-activity.service.js";

class Router {
  constructor() {
    this.isStarted = false;
    this.boundNavigate = () => this.navigate();
    this.navigationAbortController = null;
  }

  async navigate() {
    const currentHash = window.location.hash || appConfig.defaultRoute;
    const routeDefinition =
      routesConfig[currentHash] ?? routesConfig[appConfig.defaultRoute];

    if (this.navigationAbortController) {
      this.navigationAbortController.abort();
    }
    this.navigationAbortController = new AbortController();

    stateStore.set({ currentRoute: currentHash });
    updateTopbarTitle(routeDefinition.titleKey);
    updateActiveSidebarLink(currentHash);
    updateBreadcrumbModule(currentHash);

    pushSidebarActivity({
      type: "nav",
      label: i18nService.translate(routeDefinition.titleKey),
      detail: currentHash.replace(/^#\//, "")
    });

    const moduleInnerContainer = document.getElementById("dynamicModuleInner");
    if (!moduleInnerContainer) {
      return;
    }

    moduleInnerContainer.innerHTML = renderModuleSkeleton();

    try {
      const viewContent = await moduleLoaderService.loadView(
        routeDefinition.viewPath,
        this.navigationAbortController.signal
      );

      moduleInnerContainer.innerHTML = `<div class="fade-in-up">${viewContent}</div>`;
      applyTranslationsToContainer(moduleInnerContainer);

      await moduleLoaderService.mountModule(routeDefinition.modulePath, {
        routeHash: currentHash,
        language: stateStore.get().currentLanguage
      });
    } catch (navigationError) {
      if (navigationError.name !== "AbortError") {
        moduleInnerContainer.innerHTML = `
          <div class="module-empty-state fade-in">
            <img class="module-empty-state__illustration" src="presentation/images/illustrations/ai-automation.svg" alt="" />
            <h2 class="module-empty-state__title">${i18nService.translate("errors.moduleLoad")}</h2>
            <p class="module-empty-state__text">${navigationError.message}</p>
          </div>
        `;
      }
    }
  }

  start() {
    if (!this.isStarted) {
      window.addEventListener("hashchange", this.boundNavigate);
      this.isStarted = true;
    }
    this.navigate();
  }

  async refreshCurrentRoute() {
    await this.navigate();
  }
}

export const router = new Router();
