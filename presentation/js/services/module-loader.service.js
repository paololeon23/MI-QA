import { appConfig } from "../config/app.config.js";

class ModuleLoaderService {
  constructor() {
    this.currentModuleInstance = null;
  }

  async loadView(viewPath, abortSignal) {
    const response = await fetch(
      `${viewPath}?v=${appConfig.cacheBustingVersion}`,
      { signal: abortSignal }
    );
    if (!response.ok) {
      throw new Error(`View not found: ${viewPath}`);
    }
    return response.text();
  }

  async loadModule(modulePath) {
    const dynamicModule = await import(
      `../../../${modulePath}?v=${appConfig.cacheBustingVersion}`
    );
    return dynamicModule;
  }

  async mountModule(modulePath, moduleContext) {
    if (
      this.currentModuleInstance &&
      typeof this.currentModuleInstance.destroy === "function"
    ) {
      this.currentModuleInstance.destroy();
    }

    const dynamicModule = await this.loadModule(modulePath);
    this.currentModuleInstance = new dynamicModule.ModuleController(moduleContext);
    this.currentModuleInstance.mount();
  }
}

export const moduleLoaderService = new ModuleLoaderService();
