import { i18nService } from "../services/i18n.service.js";
import { hydrateLucideIcons } from "./lucide-icon.util.js";

/**
 * @param {ParentNode|null} containerElement
 * @param {{ hydrateIcons?: boolean }} [options]
 */
export function applyTranslationsToContainer(containerElement, options = {}) {
  if (!containerElement) {
    return;
  }

  const { hydrateIcons = true } = options;

  const translatableElements = containerElement.querySelectorAll("[data-i18n]");
  translatableElements.forEach((element) => {
    const translationKey = element.getAttribute("data-i18n");
    element.textContent = i18nService.translate(translationKey);
  });

  const placeholderElements = containerElement.querySelectorAll("[data-i18n-placeholder]");
  placeholderElements.forEach((element) => {
    const translationKey = element.getAttribute("data-i18n-placeholder");
    element.setAttribute("placeholder", i18nService.translate(translationKey));
  });

  if (hydrateIcons) {
    hydrateLucideIcons(containerElement);
  }
}
