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
import { applyBrandPixelAssets, isBrandPixelMode } from "../utils/brand-pixel.util.js";

class Router {
  constructor() {
    this.isStarted = false;
    this.boundNavigate = () => this.navigate();
    this.navigationAbortController = null;
    this.prefetchBound = false;
    this.idlePrefetchDone = false;
  }

  async navigate() {
    const currentHash = window.location.hash || appConfig.defaultRoute;
    const routeDefinition =
      routesConfig[currentHash] ?? routesConfig[appConfig.defaultRoute];

    if (this.navigationAbortController) {
      this.navigationAbortController.abort();
    }
    this.navigationAbortController = new AbortController();
    const { signal } = this.navigationAbortController;

    stateStore.set({ currentRoute: currentHash });
    updateTopbarTitle(routeDefinition.titleKey);
    updateActiveSidebarLink(currentHash);
    updateBreadcrumbModule(currentHash);

    // No bloquear el paint con la actividad del sidebar
    queueMicrotask(() => {
      pushSidebarActivity({
        type: "nav",
        label: i18nService.translate(routeDefinition.titleKey),
        detail: currentHash.replace(/^#\//, "")
      });
    });

    const moduleInnerContainer = document.getElementById("dynamicModuleInner");
    if (!moduleInnerContainer) {
      return;
    }

    const alreadyCached = moduleLoaderService.isRouteCached(
      routeDefinition.viewPath,
      routeDefinition.modulePath
    );

    // Solo skeleton si aún no está en cache (primera visita)
    if (!alreadyCached) {
      moduleInnerContainer.innerHTML = renderModuleSkeleton();
    }

    try {
      const { viewContent, dynamicModule } = await moduleLoaderService.preloadRoute(
        routeDefinition.viewPath,
        routeDefinition.modulePath,
        signal,
        routeDefinition
      );

      if (signal.aborted) return;

      moduleInnerContainer.innerHTML = viewContent;
      applyTranslationsToContainer(moduleInnerContainer, { hydrateIcons: false });

      await moduleLoaderService.mountModule(
        routeDefinition.modulePath,
        {
          routeHash: currentHash,
          language: stateStore.get().currentLanguage
        },
        dynamicModule
      );

      if (isBrandPixelMode()) applyBrandPixelAssets();

      this.scheduleIdlePrefetch();
    } catch (navigationError) {
      if (navigationError.name !== "AbortError") {
        moduleInnerContainer.innerHTML = `
          <div class="module-empty-state">
            <h2 class="module-empty-state__title">${i18nService.translate("errors.moduleLoad")}</h2>
            <p class="module-empty-state__text">${navigationError.message}</p>
          </div>
        `;
      }
    }
  }

  /** Prefetch al pasar el mouse / focus sobre links del menú */
  bindSidebarPrefetch() {
    if (this.prefetchBound) return;
    this.prefetchBound = true;

    const prefetchFromLink = (link) => {
      const href = link.getAttribute("href");
      if (!href || !routesConfig[href]) return;
      const route = routesConfig[href];
      moduleLoaderService.prefetchRoute(route.viewPath, route.modulePath, route);
    };

    document.addEventListener(
      "pointerenter",
      (event) => {
        const link = event.target?.closest?.("a[href^='#/']");
        if (link) prefetchFromLink(link);
      },
      true
    );

    document.addEventListener(
      "focusin",
      (event) => {
        const link = event.target?.closest?.("a[href^='#/']");
        if (link) prefetchFromLink(link);
      },
      true
    );
  }

  /** Tras la primera ruta, precarga el resto en idle (todas las pestañas listas) */
  scheduleIdlePrefetch() {
    if (this.idlePrefetchDone) return;
    this.idlePrefetchDone = true;

    const run = () => {
      Object.values(routesConfig).forEach((route) => {
        moduleLoaderService.prefetchRoute(route.viewPath, route.modulePath, {
          stylesheets: route.stylesheets,
          needsXlsx: false
        });
      });
    };

    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(run, { timeout: 2500 });
    } else {
      window.setTimeout(run, 800);
    }
  }

  start() {
    if (!this.isStarted) {
      window.addEventListener("hashchange", this.boundNavigate);
      this.isStarted = true;
    }
    this.bindSidebarPrefetch();
    return this.navigate();
  }

  async refreshCurrentRoute() {
    await this.navigate();
  }
}

export const router = new Router();
