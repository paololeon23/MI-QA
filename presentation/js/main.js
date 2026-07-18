import { appConfig } from "./config/app.config.js";
import { routesConfig } from "./config/routes.config.js";
import { initCropHectaresData } from "./config/crop-hectares.registry.js?v=20260800";
import { i18nService } from "./services/i18n.service.js";
import {
  renderApplicationShell,
  shellController,
  updateTopbarDatetime,
  updateTopbarTitle,
  updateActiveSidebarLink,
  updateBreadcrumbModule
} from "./controllers/shell.controller.js";
import { router } from "./core/router.js";
import { stateStore } from "./core/state-store.js";
import { moduleLoaderService } from "./services/module-loader.service.js";
import { hydrateLucideIcons } from "./utils/lucide-icon.util.js";
import { applyTranslationsToContainer } from "./utils/i18n-dom.util.js";

document.title = appConfig.appName;

function renderBootstrapError(errorMessage) {
  const applicationRoot = document.getElementById("applicationRoot");
  applicationRoot.innerHTML = `
    <div class="bootstrap-error">
      <h1 class="bootstrap-error__title">${appConfig.appName}</h1>
      <p class="bootstrap-error__message">Error al iniciar la aplicación</p>
      <pre class="bootstrap-error__detail">${errorMessage}</pre>
      <p class="bootstrap-error__hint">Abre el proyecto con Live Server o cualquier servidor estático local.</p>
    </div>
  `;
}

/**
 * Cambia idioma sin destruir el módulo activo (tabla/Excel cargados).
 * Solo reconstruye chrome (sidebar/topbar/footer) y re-traduce la vista actual.
 */
async function handleLanguageChange(selectedLanguage) {
  await i18nService.loadLanguage(selectedLanguage);
  stateStore.set({ currentLanguage: selectedLanguage });
  document.documentElement.lang = selectedLanguage.split("-")[0];

  const applicationRoot = document.getElementById("applicationRoot");
  const moduleInner = document.getElementById("dynamicModuleInner");
  const stash = document.createDocumentFragment();
  if (moduleInner) stash.appendChild(moduleInner);

  shellController.destroy();
  applicationRoot.innerHTML = renderApplicationShell(selectedLanguage);

  const freshInner = document.getElementById("dynamicModuleInner");
  const preserved = stash.firstChild;
  if (preserved && freshInner) {
    freshInner.replaceWith(preserved);
  }

  shellController.initialize(handleLanguageChange);
  // Solo hidratar chrome nuevo — no tocar el módulo (conserva tabla/Excel).
  hydrateLucideIcons(document.getElementById("sidebarNavigation"));
  hydrateLucideIcons(document.getElementById("applicationTopbar"));
  hydrateLucideIcons(document.getElementById("applicationFooter"));
  updateTopbarDatetime(selectedLanguage);

  const currentHash = stateStore.get().currentRoute || appConfig.defaultRoute;
  const routeDefinition =
    routesConfig[currentHash] ?? routesConfig[appConfig.defaultRoute];
  updateTopbarTitle(routeDefinition.titleKey);
  updateActiveSidebarLink(currentHash);
  updateBreadcrumbModule(currentHash);
  document.title = appConfig.appName;

  const activeModule = document.getElementById("dynamicModuleInner");
  applyTranslationsToContainer(activeModule, { hydrateIcons: false });
  await moduleLoaderService.applyLanguageChange(selectedLanguage);
}

async function renderApplicationShellAndBind(languageCode) {
  shellController.destroy();
  const applicationRoot = document.getElementById("applicationRoot");
  applicationRoot.innerHTML = renderApplicationShell(languageCode);
  shellController.initialize(handleLanguageChange);
  hydrateLucideIcons(applicationRoot);
}

async function bootstrapApplication() {
  if (!window.luxon) {
    throw new Error("Luxon no cargó. Verifica tu conexión o el CDN.");
  }

  if (!window.lucide) {
    throw new Error("Lucide no cargó. Verifica tu conexión o el CDN.");
  }

  await i18nService.initialize(appConfig.defaultLanguage);
  await initCropHectaresData();
  stateStore.set({ currentLanguage: appConfig.defaultLanguage });
  document.documentElement.lang = appConfig.defaultLanguage.split("-")[0];

  await renderApplicationShellAndBind(appConfig.defaultLanguage);
  updateTopbarDatetime(appConfig.defaultLanguage);
  document.title = appConfig.appName;
  router.start();
}

bootstrapApplication().catch((bootstrapError) => {
  console.error(`[${appConfig.appName}] Bootstrap error:`, bootstrapError);
  renderBootstrapError(bootstrapError.message);
});
