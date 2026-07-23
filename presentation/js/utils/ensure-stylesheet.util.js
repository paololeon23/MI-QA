/** Carga CSS de módulos bajo demanda (no bloquea Inicio). */

import { appConfig } from "../config/app.config.js";

const loadedHrefs = new Set();

function withVersion(href) {
  if (href.includes("?v=")) return href;
  return `${href}?v=${appConfig.cacheBustingVersion}`;
}

/**
 * @param {string|string[]} hrefs
 * @returns {Promise<void>}
 */
export function ensureStylesheets(hrefs = []) {
  const list = (Array.isArray(hrefs) ? hrefs : [hrefs]).filter(Boolean);
  if (!list.length) return Promise.resolve();

  return Promise.all(
    list.map(
      (href) =>
        new Promise((resolve) => {
          const url = withVersion(href);
          if (loadedHrefs.has(url) || document.querySelector(`link[data-agv-css="${url}"]`)) {
            loadedHrefs.add(url);
            resolve();
            return;
          }
          const link = document.createElement("link");
          link.rel = "stylesheet";
          link.href = url;
          link.dataset.agvCss = url;
          link.onload = () => {
            loadedHrefs.add(url);
            resolve();
          };
          link.onerror = () => resolve();
          document.head.appendChild(link);
        })
    )
  );
}
