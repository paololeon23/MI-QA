import { appConfig } from "./config/app.config.js";
import { initCropHectaresData } from "./config/crop-hectares.registry.js?v=20260800";
import { i18nService } from "./services/i18n.service.js";
import {
  renderApplicationShell,
  shellController,
  updateTopbarDatetime
} from "./controllers/shell.controller.js";
import { router } from "./core/router.js";
import { stateStore } from "./core/state-store.js";
import { hydrateLucideIcons } from "./utils/lucide-icon.util.js";

function renderBootstrapError(errorMessage) {
  const applicationRoot = document.getElementById("applicationRoot");
  applicationRoot.innerHTML = `
    <div class="bootstrap-error">
      <h1 class="bootstrap-error__title">AGV 2026 - MI</h1>
      <p class="bootstrap-error__message">Error al iniciar la aplicación</p>
      <pre class="bootstrap-error__detail">${errorMessage}</pre>
      <p class="bootstrap-error__hint">Abre el proyecto con Live Server o cualquier servidor estático local.</p>
    </div>
  `;
}

async function handleLanguageChange(selectedLanguage) {
  await i18nService.loadLanguage(selectedLanguage);
  stateStore.set({ currentLanguage: selectedLanguage });
  document.documentElement.lang = selectedLanguage.split("-")[0];
  await renderApplicationShellAndBind(selectedLanguage);
  updateTopbarDatetime(selectedLanguage);
  await router.refreshCurrentRoute();
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
  router.start();
}

bootstrapApplication().catch((bootstrapError) => {
  console.error("[AGV 2026] Bootstrap error:", bootstrapError);
  renderBootstrapError(bootstrapError.message);
});
