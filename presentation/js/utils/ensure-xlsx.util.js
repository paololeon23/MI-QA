/** Carga diferida de SheetJS (~415KB) solo cuando hace falta Excel. */

import { appConfig } from "../config/app.config.js";

let xlsxLoadPromise = null;

export function ensureXlsxJs() {
  if (window.XLSX?.read && window.XLSX?.utils) {
    return Promise.resolve(window.XLSX);
  }
  if (xlsxLoadPromise) return xlsxLoadPromise;

  xlsxLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector("script[data-agv-xlsx]");
    if (existing) {
      existing.addEventListener("load", () => resolve(window.XLSX));
      existing.addEventListener("error", () => reject(new Error("SheetJS no cargó")));
      return;
    }
    const script = document.createElement("script");
    script.src = `presentation/vendor/xlsx.full.min.js?v=${appConfig.cacheBustingVersion}`;
    script.async = true;
    script.dataset.agvXlsx = "1";
    script.onload = () => resolve(window.XLSX);
    script.onerror = () => reject(new Error("SheetJS no cargó"));
    document.head.appendChild(script);
  });

  return xlsxLoadPromise;
}

/** Prefetch en idle (no bloquea el primer paint). */
export function prefetchXlsxJs() {
  const run = () => {
    ensureXlsxJs().catch(() => {});
  };
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(run, { timeout: 4000 });
  } else {
    setTimeout(run, 2000);
  }
}
