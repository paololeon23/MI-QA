import { appConfig } from "../config/app.config.js";

class ModuleLoaderService {
  constructor() {
    this.currentModuleInstance = null;
    /** @type {Map<string, string>} */
    this.viewCache = new Map();
    /** @type {Map<string, Promise<any>>} */
    this.moduleCache = new Map();
  }

  viewCacheKey(viewPath) {
    return `${viewPath}?v=${appConfig.cacheBustingVersion}`;
  }

  isRouteCached(viewPath, modulePath) {
    const viewKey = this.viewCacheKey(viewPath);
    const moduleKey = `${modulePath}?v=${appConfig.cacheBustingVersion}`;
    return this.viewCache.has(viewKey) && this.moduleCache.has(moduleKey);
  }

  async loadView(viewPath, abortSignal) {
    const key = this.viewCacheKey(viewPath);
    if (this.viewCache.has(key)) {
      return this.viewCache.get(key);
    }

    const response = await fetch(key, { signal: abortSignal });
    if (!response.ok) {
      throw new Error(`View not found: ${viewPath}`);
    }
    const text = await response.text();
    this.viewCache.set(key, text);
    return text;
  }

  async loadModule(modulePath) {
    const key = `${modulePath}?v=${appConfig.cacheBustingVersion}`;
    if (!this.moduleCache.has(key)) {
      this.moduleCache.set(
        key,
        import(`../../../${modulePath}?v=${appConfig.cacheBustingVersion}`)
      );
    }
    return this.moduleCache.get(key);
  }

  /**
   * Prefetch en paralelo: HTML de vista + módulo JS.
   */
  async preloadRoute(viewPath, modulePath, abortSignal) {
    const [viewContent, dynamicModule] = await Promise.all([
      this.loadView(viewPath, abortSignal),
      this.loadModule(modulePath)
    ]);
    return { viewContent, dynamicModule };
  }

  /**
   * Prefetch en segundo plano (hover / idle). Ignora abortos.
   */
  prefetchRoute(viewPath, modulePath) {
    if (this.isRouteCached(viewPath, modulePath)) return;
    this.preloadRoute(viewPath, modulePath).catch(() => {});
  }

  async mountModule(modulePath, moduleContext, preloadedModule = null) {
    if (
      this.currentModuleInstance &&
      typeof this.currentModuleInstance.destroy === "function"
    ) {
      this.currentModuleInstance.destroy();
    }

    const dynamicModule = preloadedModule || (await this.loadModule(modulePath));
    this.currentModuleInstance = new dynamicModule.ModuleController(moduleContext);
    await this.currentModuleInstance.mount();
  }
}

export const moduleLoaderService = new ModuleLoaderService();
