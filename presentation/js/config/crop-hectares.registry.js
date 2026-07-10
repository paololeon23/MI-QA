import { appConfig } from "./app.config.js";
import { createHectaresQueries, formatAreaHa } from "./crop-hectares.util.js";

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
  return (
    crop?.queries?.getGlobalStats() ?? {
      fundoCount: 0,
      varietyCount: 0,
      parcelCount: 0,
      totalAreaHa: 0
    }
  );
}

export function getFundosList() {
  return getQueries().getFundosList();
}

export function getParcelsByFundo(fundo) {
  return getQueries().getParcelsByFundo(fundo);
}

export function getFundoAreaSummary(filters = {}) {
  return getQueries().getFundoAreaSummary(filters);
}

export function getGlobalStats(filters = {}) {
  return getQueries().getGlobalStats(filters);
}

export function getTopVarietiesByArea(limit = 8, filters = {}) {
  return getQueries().getTopVarietiesByArea(limit, filters);
}

export function getEtapaAreaSummary(filters = {}) {
  return getQueries().getEtapaAreaSummary(filters);
}

export function getUniqueEtapas(filters = {}) {
  return getQueries().getUniqueEtapas(filters);
}

export function cropHasData(cropId = activeCropId) {
  const crop = cropHectaresRegistry[cropId];
  return Boolean(crop?.parcels?.length);
}

export { formatAreaHa };
