import { GenericModuleController } from "../module-page.factory.js";
import { applyTranslationsToContainer } from "../../utils/i18n-dom.util.js";
import { hydrateLucideIcons } from "../../utils/lucide-icon.util.js";
import {
  applyAttributeTranslations,
  refreshModuleLanguage
} from "../../utils/module-i18n.util.js";
import { EsparragoPtService } from "./esparrago-pt/esparrago-pt.service.js";

export class ModuleController extends GenericModuleController {
  constructor(moduleContext) {
    super(moduleContext);
    this.service = new EsparragoPtService();
  }

  async mount() {
    super.mount();
    const root = document.getElementById("moduleRoot");
    const appRoot = document.getElementById("agvPtApp");
    if (!root || !appRoot) return;

    applyTranslationsToContainer(root, { hydrateIcons: false });
    applyAttributeTranslations(appRoot);

    await this.service.init(appRoot);
    hydrateLucideIcons(root);
  }

  async onLanguageChange() {
    refreshModuleLanguage({
      appRootId: "agvPtApp",
      service: this.service
    });
  }

  destroy() {
    this.service.destroy();
    super.destroy();
  }
}
