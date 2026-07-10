import { i18nService } from "../services/i18n.service.js";
import { hydrateLucideIcons } from "./lucide-icon.util.js";

export function applyTranslationsToContainer(containerElement) {
  if (!containerElement) {
    return;
  }

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

  hydrateLucideIcons(containerElement);
}
