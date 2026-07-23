/**
 * Catálogo de columnas SAP por perfil (mp / pt / plagas).
 * Fuente: presentation/data/sap-columnas.json
 */

import { appConfig } from "./app.config.js";

const SAP_COLUMNAS_PATH = "presentation/data/sap-columnas.json";

let _catalog = null;
let _loadPromise = null;

export async function loadSapColumnasCatalog(version = appConfig.cacheBustingVersion) {
  if (_catalog) return _catalog;
  if (_loadPromise) return _loadPromise;
  const qs = version ? `?v=${version}` : "";
  _loadPromise = fetch(`${SAP_COLUMNAS_PATH}${qs}`)
    .then((res) => {
      if (!res.ok) throw new Error("No se pudo cargar sap-columnas.json");
      return res.json();
    })
    .then((json) => {
      _catalog = json;
      return _catalog;
    })
    .catch((err) => {
      _loadPromise = null;
      throw err;
    });
  return _loadPromise;
}

export function getSapColumnasCatalog() {
  return _catalog;
}

export function getSapPerfil(perfil) {
  return _catalog?.[perfil] || null;
}
