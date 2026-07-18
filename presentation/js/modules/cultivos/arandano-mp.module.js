import { GenericModuleController } from "../module-page.factory.js";
import { applyTranslationsToContainer } from "../../utils/i18n-dom.util.js";
import { refreshModuleLanguage } from "../../utils/module-i18n.util.js";
import { hydrateLucideIcons } from "../../utils/lucide-icon.util.js";
import { i18nService } from "../../services/i18n.service.js";
import { ArandanoMpService } from "./arandano-mp/arandano-mp.service.js";

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
    this.service = new ArandanoMpService();
  }

  async mount() {
    super.mount();
    const root = document.getElementById("moduleRoot");
    const appRoot = document.getElementById("agvMpApp");
    if (!root || !appRoot) return;

    applyTranslationsToContainer(root, { hydrateIcons: false });
    applyAttributeTranslations(appRoot);

    await this.service.init(appRoot);
    hydrateLucideIcons(root);
  }


  async onLanguageChange() {
    refreshModuleLanguage({
      appRootId: "agvMpApp",
      service: this.service
    });
  }

  destroy() {
    this.service.destroy();
    super.destroy();
  }
}
