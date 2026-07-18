/** Helpers i18n de módulos — display only (no toca validación). */

import { i18nService } from "../services/i18n.service.js";
import { applyTranslationsToContainer } from "./i18n-dom.util.js";

export function applyAttributeTranslations(root) {
  if (!root) return;
  root.querySelectorAll("[data-i18n-title]").forEach((element) => {
    const key = element.getAttribute("data-i18n-title");
    if (key) element.setAttribute("title", i18nService.translate(key));
  });
  root.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
    const key = element.getAttribute("data-i18n-aria-label");
    if (key) element.setAttribute("aria-label", i18nService.translate(key));
  });
}

/**
 * Re-traduce UI del módulo activo tras cambio de idioma.
 * Conserva DOM/datos; solo textos con data-i18n (+ service hook opcional).
 */
export function refreshModuleLanguage({
  moduleRootId = "moduleRoot",
  appRootId = null,
  service = null
} = {}) {
  const root = document.getElementById(moduleRootId);
  const appRoot = appRootId ? document.getElementById(appRootId) : null;
  applyTranslationsToContainer(root, { hydrateIcons: false });
  applyAttributeTranslations(appRoot || root);
  if (service && typeof service.onLanguageChange === "function") {
    service.onLanguageChange();
  }
}
