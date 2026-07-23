import { appConfig } from "../config/app.config.js";
import { ensureStylesheets } from "../utils/ensure-stylesheet.util.js";
import { ensureXlsxJs } from "../utils/ensure-xlsx.util.js";

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
   * Prefetch en paralelo: CSS + HTML + módulo (+ XLSX si aplica).
   */
  async preloadRoute(viewPath, modulePath, abortSignal, routeMeta = {}) {
    const tasks = [
      this.loadView(viewPath, abortSignal),
      this.loadModule(modulePath),
      ensureStylesheets(routeMeta.stylesheets || [])
    ];
    if (routeMeta.needsXlsx) {
      tasks.push(ensureXlsxJs());
    }
    const [viewContent, dynamicModule] = await Promise.all(tasks);
    return { viewContent, dynamicModule };
  }

  /**
   * Prefetch en segundo plano (hover / idle). Ignora abortos.
   */
  prefetchRoute(viewPath, modulePath, routeMeta = {}) {
    if (this.isRouteCached(viewPath, modulePath)) return;
    this.preloadRoute(viewPath, modulePath, undefined, routeMeta).catch(() => {});
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

  /** Traducir UI dinámica del módulo activo sin remount (conserva tabla/datos). */
  async applyLanguageChange(languageCode) {
    const instance = this.currentModuleInstance;
    if (instance && typeof instance.onLanguageChange === "function") {
      await instance.onLanguageChange(languageCode);
    }
  }
}

export const moduleLoaderService = new ModuleLoaderService();
