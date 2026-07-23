import { appConfig } from "./app.config.js";
import { createHectaresQueries, formatAreaHa as formatAreaHaRaw } from "./crop-hectares.util.js";
import {
  isBrandPixelMode,
  maskIncognitoJsonText,
  maskIncognitoNumber
} from "../utils/brand-pixel.util.js";

const DATA_PATH = "presentation/data/cultivos-hectareas.json";

let cropHectaresRegistry = {};
let cropHectaresTabOrder = [];
let activeCropId = "arandano";
let loadPromise = null;

function buildRegistryFromData(data) {
  cropHectaresTabOrder = Array.isArray(data.ordenTabs) ? data.ordenTabs : [];
  cropHectaresRegistry = {};

  cropHectaresTabOrder.forEach((cropId) => {
    const crop = data.cultivos?.[cropId];
    if (!crop) {
      return;
    }

    const parcels = Array.isArray(crop.registros) ? crop.registros : [];
    const fundosOrder = Array.isArray(crop.fundosOrder) ? crop.fundosOrder : [];

    cropHectaresRegistry[cropId] = {
      id: cropId,
      nombre: crop.nombre ?? cropId,
      labelKey: crop.labelKey,
      hectaresTitleKey: crop.hectaresTitleKey,
      fundosOrder,
      parcels,
      queries: createHectaresQueries(parcels, fundosOrder)
    };
  });

  if (!cropHectaresRegistry[activeCropId]) {
    activeCropId = cropHectaresTabOrder.find((cropId) => cropHectaresRegistry[cropId]) ?? "arandano";
  }
}

export async function initCropHectaresData() {
  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = (async () => {
    const response = await fetch(`${DATA_PATH}?v=${appConfig.cacheBustingVersion}`);
    if (!response.ok) {
      throw new Error(`No se pudo cargar ${DATA_PATH} (${response.status})`);
    }

    const data = await response.json();
    buildRegistryFromData(data);
  })();

  return loadPromise;
}

function getActiveCropEntry() {
  return cropHectaresRegistry[activeCropId] ?? cropHectaresRegistry.arandano ?? null;
}

function getQueries() {
  return getActiveCropEntry()?.queries ?? createHectaresQueries([], []);
}

function anonymizeStats(stats) {
  if (!isBrandPixelMode() || !stats) return stats;
  return {
    ...stats,
    fundoCount: maskIncognitoNumber(stats.fundoCount),
    varietyCount: maskIncognitoNumber(stats.varietyCount),
    parcelCount: maskIncognitoNumber(stats.parcelCount),
    totalAreaHa: maskIncognitoNumber(stats.totalAreaHa)
  };
}

function anonymizeParcel(parcel) {
  if (!isBrandPixelMode() || !parcel) return parcel;
  return {
    ...parcel,
    cultivo: maskIncognitoJsonText(parcel.cultivo),
    etapa: maskIncognitoJsonText(parcel.etapa),
    campo: maskIncognitoJsonText(parcel.campo),
    variedad: maskIncognitoJsonText(parcel.variedad),
    areaHa: maskIncognitoNumber(parcel.areaHa)
    // fundo se mantiene real para filtros/temas; al mostrar usar maskIncognitoJsonText
  };
}

export function getActiveCropId() {
  return activeCropId;
}

export function getActiveCrop() {
  return getActiveCropEntry();
}

export function setActiveCropId(cropId) {
  if (!cropHectaresRegistry[cropId]) {
    return;
  }
  activeCropId = cropId;
}

export function getCropTabs() {
  return cropHectaresTabOrder
    .map((cropId) => cropHectaresRegistry[cropId])
    .filter(Boolean);
}

export function getCropStats(cropId = activeCropId) {
  const crop = cropHectaresRegistry[cropId];
  const stats =
    crop?.queries?.getGlobalStats() ?? {
      fundoCount: 0,
      varietyCount: 0,
      parcelCount: 0,
      totalAreaHa: 0
    };
  return anonymizeStats(stats);
}

/** IDs reales de fundo (para lógica). Para UI usar maskIncognitoJsonText. */
export function getFundosList() {
  return getQueries().getFundosList();
}

export function getParcelsByFundo(fundo) {
  return getQueries().getParcelsByFundo(fundo).map(anonymizeParcel);
}

export function getFundoAreaSummary(filters = {}) {
  const rows = getQueries().getFundoAreaSummary(filters);
  if (!isBrandPixelMode()) return rows;
  return rows.map((item) => ({
    ...item,
    totalAreaHa: maskIncognitoNumber(item.totalAreaHa),
    varieties: (item.varieties || []).map((v) => maskIncognitoJsonText(v)),
    stages: (item.stages || []).map((s) => maskIncognitoJsonText(s)),
    parcelCount: maskIncognitoNumber(item.parcelCount)
  }));
}

export function getGlobalStats(filters = {}) {
  return anonymizeStats(getQueries().getGlobalStats(filters));
}

export function getTopVarietiesByArea(limit = 8, filters = {}) {
  const rows = getQueries().getTopVarietiesByArea(limit, filters);
  if (!isBrandPixelMode()) return rows;
  return rows.map((item) => ({
    variedad: maskIncognitoJsonText(item.variedad),
    areaHa: maskIncognitoNumber(item.areaHa)
  }));
}

export function getEtapaAreaSummary(filters = {}) {
  const rows = getQueries().getEtapaAreaSummary(filters);
  if (!isBrandPixelMode()) return rows;
  return rows.map((item) => ({
    etapa: maskIncognitoJsonText(item.etapa),
    areaHa: maskIncognitoNumber(item.areaHa)
  }));
}

export function getUniqueEtapas(filters = {}) {
  const etapas = getQueries().getUniqueEtapas(filters);
  if (!isBrandPixelMode()) return etapas;
  return etapas.map((e) => maskIncognitoJsonText(e));
}

export function cropHasData(cropId = activeCropId) {
  const crop = cropHectaresRegistry[cropId];
  return Boolean(crop?.parcels?.length);
}

export function isCropHectaresLoaded() {
  return Object.keys(cropHectaresRegistry).length > 0;
}

/** Garantiza el JSON maestro cargado (misma instancia que Inicio). */
export async function ensureCropHectaresData() {
  await initCropHectaresData();
  return isCropHectaresLoaded();
}

/** Formatea ha; el +100 ya viene en los getters si hay modo incógnito. */
export function formatAreaHa(value, locale = "es-PE") {
  return formatAreaHaRaw(value, locale);
}

export { maskIncognitoJsonText };
