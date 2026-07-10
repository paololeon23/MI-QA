import { GenericModuleController } from "../module-page.factory.js";
import { applyTranslationsToContainer } from "../../utils/i18n-dom.util.js";
import { hydrateLucideIcons } from "../../utils/lucide-icon.util.js";
import { i18nService } from "../../services/i18n.service.js";
import { UvaMpService } from "./uva-mp/uva-mp.service.js";

function applyAttributeTranslations(root) {
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

export class ModuleController extends GenericModuleController {
  constructor(moduleContext) {
    super(moduleContext);
    this.service = new UvaMpService();
  }

  async mount() {
    super.mount();
    const root = document.getElementById("moduleRoot");
    const appRoot = document.getElementById("agvMpApp");
    if (!root || !appRoot) return;

    applyTranslationsToContainer(root);
    applyAttributeTranslations(appRoot);
    hydrateLucideIcons(root);

    await this.service.init(appRoot);
    hydrateLucideIcons(root);
  }

  destroy() {
    this.service.destroy();
    super.destroy();
  }
}
