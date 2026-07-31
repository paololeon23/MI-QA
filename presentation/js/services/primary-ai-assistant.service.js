/**
 * Asistente IA para módulos primarios: Inicio, Variedades, Trazabilidad, Cartillas.
 * Las respuestas se basan en la pregunta + datos en vivo de la pantalla (no un blurb fijo).
 */

import {
  getActiveCrop,
  getActiveCropId,
  getCropStats,
  getCropTabs,
  getFundoAreaSummary,
  getGlobalStats,
  getTopVarietiesByArea,
  cropHasData,
  ensureCropHectaresData,
  isCropHectaresLoaded,
  maskIncognitoJsonText
} from "../config/crop-hectares.registry.js?v=20260800";
import { moduleLoaderService } from "./module-loader.service.js";
import {
  isBrandPixelMode,
  maskIncognitoNumber,
  finalizeIncognitoAiText
} from "../utils/brand-pixel.util.js";
import { i18nService } from "./i18n.service.js";
import { stateStore } from "../core/state-store.js";

function normalizeLangCode(raw = "") {
  const s = String(raw || "").trim();
  if (!s) return "";
  if (s.startsWith("zh")) return "zh-CN";
  if (s.startsWith("en")) return "en-US";
  if (s.startsWith("fr")) return "fr-MA";
  if (s.startsWith("es")) return "es-PE";
  return s;
}

export function getAiLanguageCode() {
  try {
    // Store/servicio primero (UI real). i18next a veces queda en el idioma anterior.
    const fromStore = stateStore?.get?.()?.currentLanguage;
    const fromService = i18nService?.getActiveLanguage?.() || i18nService?.activeLanguage;
    const fromHtml = document.documentElement?.lang;
    const fromI18next = window.i18next?.language;
    return (
      normalizeLangCode(fromStore) ||
      normalizeLangCode(fromService) ||
      normalizeLangCode(fromHtml) ||
      normalizeLangCode(fromI18next) ||
      "es-PE"
    );
  } catch {
    return "es-PE";
  }
}

function tAi(key, vars = {}) {
  try {
    if (typeof i18nService?.translate === "function") {
      const value = i18nService.translate(key, vars);
      if (value && value !== key) return value;
    }
  } catch {
    /* ignore */
  }
  return "";
}

function looksLikeI18nKey(value) {
  return /^[a-z][a-z0-9]*(\.[a-z0-9]+)+$/i.test(String(value || "").trim());
}

function pickLangText(row, lang) {
  if (!row) return "";
  if (String(lang).startsWith("en")) return row.en;
  if (String(lang).startsWith("fr")) return row.fr;
  if (String(lang).startsWith("zh")) return row.zh;
  return row.es;
}

function languageReplyRule(lang = "es-PE") {
  if (String(lang).startsWith("en")) {
    return "Reply in English. Use casual lowercase. Keep it short (max 3 sentences). Never list more than 5 varieties unless asked.";
  }
  if (String(lang).startsWith("fr")) {
    return "Réponds en français. Ton décontracté, surtout en minuscules. Max 3 phrases. Jamais plus de 5 variétés sauf demande.";
  }
  if (String(lang).startsWith("zh")) {
    return "请用简体中文简短回答（最多3句）。除非用户要求，否则不要列出超过5个品种。";
  }
  return "responde en español peruano. usa minúsculas y tono cercano. máximo 3 oraciones. nunca listes más de 5 variedades salvo que pidan la lista.";
}

function cropLabelForAi(cropId, fallback = "") {
  const map = {
    arandano: "sidebar.blueberry",
    esparrago: "sidebar.asparagus",
    palta: "sidebar.avocado",
    uva: "sidebar.grape"
  };
  const id = String(cropId || "").toLowerCase();
  const key = map[id];
  if (key) {
    const label = tAi(key);
    if (label) return label;
  }
  const hard = {
    arandano: { en: "Blueberry", fr: "Myrtille", zh: "蓝莓", es: "Arándano" },
    esparrago: { en: "Asparagus", fr: "Asperge", zh: "芦笋", es: "Espárrago" },
    palta: { en: "Avocado", fr: "Avocat", zh: "牛油果", es: "Palta" },
    uva: { en: "Grape", fr: "Raisin", zh: "葡萄", es: "Uva" }
  };
  const hardLabel = pickLangText(hard[id], getAiLanguageCode());
  if (hardLabel) return hardLabel;
  const fb = String(fallback || "").trim();
  if (fb && !looksLikeI18nKey(fb)) return fb;
  return id || "—";
}

function moduleLabelForAi(ctxOrId = "inicio") {
  const id = typeof ctxOrId === "string" ? ctxOrId : ctxOrId?.id;
  const hashHint = typeof ctxOrId === "object" ? ctxOrId?.hash || "" : "";
  const keyById = {
    inicio: "routes.inicio",
    variedades: "routes.dashboard",
    cartillas: "routes.cartillas",
    trazabilidad: String(hashHint).includes("chile")
      ? "routes.trazabilidadChile"
      : String(hashHint).includes("peru")
        ? "routes.trazabilidadPeru"
        : "routes.trazabilidad"
  };
  const key = keyById[id];
  if (key) {
    const label = tAi(key);
    if (label) return label;
  }
  const hard = {
    inicio: { en: "Home", fr: "Accueil", zh: "首页", es: "Inicio" },
    variedades: { en: "Varieties", fr: "Variétés", zh: "品种", es: "Variedades" },
    cartillas: { en: "Inspection Sheets", fr: "Fiches", zh: "检查卡", es: "Cartillas" },
    trazabilidad: { en: "Traceability", fr: "Traçabilité", zh: "追溯", es: "Trazabilidad" }
  };
  const hardLabel = pickLangText(hard[id], getAiLanguageCode());
  if (hardLabel) return hardLabel;
  const fromCtx = typeof ctxOrId === "object" ? ctxOrId?.label : "";
  if (fromCtx && !looksLikeI18nKey(fromCtx)) return fromCtx;
  return String(id || "");
}

/** Hectáreas legibles para UI/IA: siempre «1234.5 ha» (punto decimal, sin miles). */
function formatHa(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  const rounded = Math.round(n * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${text} ha`;
}

function anonymizeLabel(value) {
  return maskIncognitoJsonText(value);
}

function normalizeQuestion(question = "") {
  return String(question || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/** Código visible (E06 / E106) → prefijo + número. */
function parseParcelCode(value = "") {
  const m = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .match(/^([a-z@]+)(\d+)$/);
  if (!m) return null;
  return { prefix: m[1].replace(/@/g, "a"), num: Number(m[2]) };
}

/**
 * Compara códigos de etapa/campo tolerando ceros (E6 vs E06)
 * y modo incógnito (+100 / a→@), p. ej. E06 ↔ E106.
 */
function parcelCodesEqual(asked, actual) {
  const a = parseParcelCode(asked);
  const b = parseParcelCode(actual);
  if (a && b && a.prefix === b.prefix && a.num === b.num) return true;

  const askedNorm = String(asked || "")
    .toLowerCase()
    .replace(/\s+/g, "");
  const actualNorm = String(actual || "")
    .toLowerCase()
    .replace(/\s+/g, "");
  if (askedNorm && askedNorm === actualNorm) return true;

  const masked = String(maskIncognitoJsonText(actual) || "")
    .toLowerCase()
    .replace(/\s+/g, "");
  if (askedNorm && askedNorm === masked) return true;

  const m = parseParcelCode(masked);
  return Boolean(a && m && a.prefix === m.prefix && a.num === m.num);
}

/** Extrae E### / C### (y opcional fundo) de la pregunta. */
function extractParcelQuery(q = "") {
  const etapa = q.match(/\be\s*[-.]?\s*(\d{1,4})\b/);
  const campo = q.match(/\bc\s*[-.]?\s*(\d{1,4})\b/);
  const fundo =
    q.match(/\bfundo\s+([a-z0-9@]+)\b/) ||
    q.match(/\b(a\d+|ln|lc|@[0-9]+)\b/);
  return {
    etapa: etapa ? `E${etapa[1]}` : null,
    campo: campo ? `C${campo[1]}` : null,
    fundo: fundo ? String(fundo[1]).replace(/^fundo\s+/i, "") : null
  };
}

function getUiActiveFundoId() {
  return (
    document.querySelector("#fundoTablePanel")?.dataset?.fundo ||
    document.querySelector("[data-active-fundo]")?.dataset?.activeFundo ||
    ""
  );
}

function getCropParcels(cropId) {
  const tabs = getCropTabs() || [];
  const crop =
    (cropId && tabs.find((t) => t.id === cropId)) ||
    getActiveCrop() ||
    tabs.find((t) => t.id === getActiveCropId());
  return {
    crop,
    parcels: Array.isArray(crop?.parcels) ? crop.parcels : []
  };
}

/**
 * Resuelve consulta por etapa/campo:
 * - etapa+campo → variedad exacta (distingue SEKOYA POP vs BEAUTY, etc.)
 * - solo etapa + variedad → todas las variedades por campo de esa etapa
 * - solo etapa + “campo” → lista de campos
 * - solo campo + “etapa” → lista de etapas
 * Prioriza el fundo activo en Inicio si hay varias coincidencias.
 */
function answerParcelVarietyLookup(q, cropIdHint = null) {
  const { etapa, campo, fundo: fundoAsked } = extractParcelQuery(q);
  if (!etapa && !campo) return null;

  const { crop, parcels } = getCropParcels(cropIdHint);
  if (!parcels.length) {
    return "Aún no hay parcelas cargadas para buscar por etapa y campo.";
  }

  const activeFundo = getUiActiveFundoId();
  const cropName = crop?.nombre || "el cultivo activo";

  function scopeByFundo(rows) {
    let out = rows;
    if (fundoAsked) {
      const byFundo = out.filter(
        (p) =>
          parcelCodesEqual(fundoAsked, p.fundo) ||
          String(p.fundo || "")
            .toLowerCase()
            .includes(String(fundoAsked).toLowerCase()) ||
          anonymizeLabel(p.fundo).toLowerCase().includes(String(fundoAsked).toLowerCase())
      );
      if (byFundo.length) out = byFundo;
    } else if (activeFundo && out.length > 1) {
      const scoped = out.filter((p) => p.fundo === activeFundo);
      if (scoped.length) out = scoped;
    }
    return out;
  }

  // Solo etapa: ¿qué campos hay?
  if (etapa && !campo && /\bcampo/.test(q) && !/\bvariedad/.test(q)) {
    let matches = scopeByFundo(parcels.filter((p) => parcelCodesEqual(etapa, p.etapa)));
    if (!matches.length) {
      return `No encontré campos para la etapa ${etapa} en «${cropName}».`;
    }
    const campos = [
      ...new Set(matches.map((p) => anonymizeLabel(p.campo)).filter(Boolean))
    ].sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
    const fundoLabel = anonymizeLabel(matches[0].fundo) || matches[0].fundo;
    const showEtapa = anonymizeLabel(matches[0].etapa);
    return `En la etapa ${showEtapa} (fundo ${fundoLabel}) hay ${campos.length} campos: ${campos.join(", ")}.`;
  }

  // Solo etapa (+ variedad / “qué tiene”): listar variedad por campo
  if (etapa && !campo) {
    if (/\b(hectarea|hectareas|ha\b|area|superficie)\b/.test(q)) {
      return null;
    }
    if (!/\bvariedad/.test(q) && !/\b(tiene|tienen|hay|cual|cuales|que)\b/.test(q)) {
      return null;
    }
    let matches = scopeByFundo(parcels.filter((p) => parcelCodesEqual(etapa, p.etapa)));
    if (!matches.length) {
      return `No encontré parcelas para la etapa ${etapa} en «${cropName}».`;
    }
    const rows = matches
      .map((p) => ({
        campo: anonymizeLabel(p.campo) || p.campo,
        variedad: anonymizeLabel(p.variedad) || "(sin variedad)",
        sortKey: String(p.campo || "")
      }))
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey, "es", { numeric: true }));
    const byCampo = [
      ...new Map(rows.map((r) => [r.campo, r.variedad])).entries()
    ].map(([c, v]) => `${c}: ${v}`);
    const uniqueVars = [...new Set(rows.map((r) => r.variedad))];
    const fundoLabel = anonymizeLabel(matches[0].fundo) || matches[0].fundo;
    const showEtapa = anonymizeLabel(matches[0].etapa);
    return `En la etapa ${showEtapa} (fundo ${fundoLabel}) hay ${uniqueVars.length} variedades en ${byCampo.length} campos: ${byCampo.join("; ")}.`;
  }

  // Solo campo: ¿qué etapas hay?
  if (campo && !etapa && /\betapa/.test(q) && !/\bvariedad/.test(q)) {
    let matches = scopeByFundo(parcels.filter((p) => parcelCodesEqual(campo, p.campo)));
    if (!matches.length) {
      return `No encontré etapas para el campo ${campo} en «${cropName}».`;
    }
    const etapas = [
      ...new Set(matches.map((p) => anonymizeLabel(p.etapa)).filter(Boolean))
    ].sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
    const fundoLabel = anonymizeLabel(matches[0].fundo) || matches[0].fundo;
    const showCampo = anonymizeLabel(matches[0].campo);
    return `En el campo ${showCampo} (fundo ${fundoLabel}) hay ${etapas.length} etapas: ${etapas.join(", ")}.`;
  }

  // Solo campo + variedad: listar variedad por etapa
  if (campo && !etapa && /\bvariedad/.test(q)) {
    let matches = scopeByFundo(parcels.filter((p) => parcelCodesEqual(campo, p.campo)));
    if (!matches.length) {
      return `No encontré parcelas para el campo ${campo} en «${cropName}».`;
    }
    const rows = matches
      .map((p) => ({
        etapa: anonymizeLabel(p.etapa) || p.etapa,
        variedad: anonymizeLabel(p.variedad) || "(sin variedad)",
        sortKey: String(p.etapa || "")
      }))
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey, "es", { numeric: true }));
    const byEtapa = [
      ...new Map(rows.map((r) => [r.etapa, r.variedad])).entries()
    ].map(([e, v]) => `${e}: ${v}`);
    const fundoLabel = anonymizeLabel(matches[0].fundo) || matches[0].fundo;
    const showCampo = anonymizeLabel(matches[0].campo);
    return `En el campo ${showCampo} (fundo ${fundoLabel}) las variedades por etapa son: ${byEtapa.join("; ")}.`;
  }

  if (!etapa || !campo) return null;

  let matches = scopeByFundo(
    parcels.filter(
      (p) => parcelCodesEqual(etapa, p.etapa) && parcelCodesEqual(campo, p.campo)
    )
  );

  if (!matches.length) {
    return `No encontré una parcela con etapa ${etapa} y campo ${campo} en «${cropName}».`;
  }

  const showEtapa = anonymizeLabel(matches[0].etapa);
  const showCampo = anonymizeLabel(matches[0].campo);
  const unique = [
    ...new Map(
      matches.map((p) => {
        const variety = anonymizeLabel(p.variedad) || "(sin variedad)";
        const fundo = anonymizeLabel(p.fundo) || p.fundo || "—";
        return [`${fundo}|${variety}`, { variety, fundo, areaHa: p.areaHa }];
      })
    ).values()
  ];

  if (unique.length === 1) {
    const hit = unique[0];
    const area =
      hit.areaHa != null && Number.isFinite(Number(hit.areaHa))
        ? ` (${formatHa(isBrandPixelMode() ? maskIncognitoNumber(hit.areaHa) : hit.areaHa)})`
        : "";
    return `En etapa ${showEtapa} y campo ${showCampo} (fundo ${hit.fundo}) la variedad es ${hit.variety}${area}.`;
  }

  const list = unique
    .map((h) => `${h.variety} en fundo ${h.fundo}`)
    .join("; ");
  return `Hay ${unique.length} coincidencias para etapa ${showEtapa} y campo ${showCampo}: ${list}.`;
}

export function getPrimaryAiRouteContext(hash = window.location.hash || "#/inicio") {
  const h = String(hash || "").split("?")[0] || "#/inicio";
  if (h === "#/" || h === "#" || h === "#/inicio") {
    return {
      id: "inicio",
      hash: h,
      label: moduleLabelForAi("inicio"),
      allowed: true,
      purpose:
        "Vista gerencial del sistema AGV-MI (agroexportadora): resumen operativo con validación, hectáreas, fundos y variedades del cultivo activo."
    };
  }
  if (h === "#/dashboard") {
    return {
      id: "variedades",
      hash: h,
      label: moduleLabelForAi("variedades"),
      allowed: true,
      purpose:
        "Catálogo genético de variedades (genética, búsqueda y filtros) para consulta de referencia."
    };
  }
  if (h.startsWith("#/trazabilidad")) {
    return {
      id: "trazabilidad",
      hash: h,
      label: moduleLabelForAi({ id: "trazabilidad", hash: h }),
      allowed: true,
      purpose:
        "Consulta de códigos de trazabilidad (Perú/Chile) para interpretar packing, grower y datos de seguimiento."
    };
  }
  if (h === "#/cartillas") {
    return {
      id: "cartillas",
      hash: h,
      label: moduleLabelForAi("cartillas"),
      allowed: true,
      purpose:
        "Catálogo de cartillas de inspección por cultivo; búsqueda y filtros para aseguramiento de calidad."
    };
  }
  return {
    id: "fuera",
    hash: h,
    label: "Cultivos / otros",
    allowed: false,
    purpose:
      "Este asistente solo ayuda en Inicio, Variedades, Trazabilidad y Cartillas. Los cultivos MP/PT/Plagas tienen su propia pantalla."
  };
}

export function isPrimaryAiRoute(hash) {
  return getPrimaryAiRouteContext(hash).allowed;
}

function buildCropSnapshot(cropId) {
  const crop = (getCropTabs() || []).find((t) => t.id === cropId);
  if (!crop) return null;
  const stats = getCropStats(cropId) || {};
  // queries crudas → anonimizar en incógnito (getCropStats ya trae conteos/área +100)
  let fundos = [...(crop.queries?.getFundoAreaSummary?.() || [])].sort(
    (a, b) => (b.totalAreaHa || 0) - (a.totalAreaHa || 0)
  );
  let topVars = [...(crop.queries?.getTopVarietiesByArea?.(20) || [])];
  let varietyNames = [
    ...new Set((crop.parcels || []).map((p) => p.variedad).filter(Boolean))
  ].sort((a, b) => a.localeCompare(b, "es"));

  // queries crudas: anonimizar labels; las ha se enmascaran una sola vez aquí
  if (isBrandPixelMode()) {
    fundos = fundos.map((f) => ({
      ...f,
      fundo: anonymizeLabel(f.fundo),
      totalAreaHa: maskIncognitoNumber(f.totalAreaHa)
    }));
    topVars = topVars.map((v) => ({
      variedad: anonymizeLabel(v.variedad),
      areaHa: maskIncognitoNumber(v.areaHa)
    }));
    varietyNames = varietyNames.map((v) => anonymizeLabel(v));
  }

  return {
    id: cropId,
    nombre: crop.nombre || cropId,
    hasData: Boolean(crop.parcels?.length),
    fundos: Number(stats.fundoCount) || 0,
    variedades: Number(stats.varietyCount) || varietyNames.length || 0,
    parcelas: Number(stats.parcelCount) || 0,
    areaTexto: formatHa(stats.totalAreaHa),
    fundoNames: fundos.map((f) => f.fundo).filter(Boolean),
    varietyNames,
    topFundos: fundos.slice(0, 5).map((f) => `${f.fundo}: ${formatHa(f.totalAreaHa)}`),
    topVariedades: topVars.slice(0, 8).map((v) => `${v.variedad}: ${formatHa(v.areaHa)}`)
  };
}

/** Detecta si la pregunta nombra un cultivo del JSON (uva, arándano, etc.). */
export function resolveMentionedCropId(question = "") {
  const q = normalizeQuestion(question);
  const tabs = getCropTabs() || [];
  if (!tabs.length || !q) return null;

  const alias = [
    { id: "uva", re: /\b(uva|grape|vid)\b/ },
    { id: "arandano", re: /\b(arandano|blueberry)\b/ },
    { id: "esparrago", re: /\b(esparrago|asparagus)\b/ },
    { id: "palta", re: /\b(palta|aguacate|avocado)\b/ }
  ];
  for (const item of alias) {
    if (item.re.test(q) && tabs.some((t) => t.id === item.id)) return item.id;
  }
  for (const tab of tabs) {
    const name = normalizeQuestion(tab.nombre || tab.id);
    if (name.length >= 3 && q.includes(name)) return tab.id;
  }
  return null;
}

function collectInicioFacts() {
  try {
    if (!isCropHectaresLoaded()) {
      return { loaded: false };
    }
    const crop = getActiveCrop();
    const stats = getGlobalStats() || {};
    const tabs = getCropTabs() || [];
    const cultivosLista = tabs
      .map((t) => t.nombre || t.id)
      .filter(Boolean);
    const cultivosIds = tabs.map((t) => t.id).filter(Boolean);
    const porCultivo = {};
    for (const id of cultivosIds) {
      const snap = buildCropSnapshot(id);
      if (snap) porCultivo[id] = snap;
    }
    const porCultivoTexto = Object.values(porCultivo)
      .map((s) =>
        s.hasData
          ? `${s.nombre}: ${s.fundos} fundos (${s.fundoNames.join("/") || "—"}), ${s.variedades} variedades (${(s.varietyNames || []).slice(0, 8).join(", ") || "—"}), ${s.areaTexto}`
          : `${s.nombre}: sin registros`
      )
      .join(" · ");
    const fundos = [...(getFundoAreaSummary() || [])]
      .sort((a, b) => (b.totalAreaHa || 0) - (a.totalAreaHa || 0))
      .slice(0, 5);
    const topVars = (getTopVarietiesByArea(5) || []).slice(0, 5);
    const hasData = cropHasData();
    return {
      loaded: true,
      hasData,
      cultivoId: getActiveCropId(),
      cultivoNombre: crop?.nombre || getActiveCropId() || "—",
      cultivosLista,
      cultivosIds,
      cultivosTexto: cultivosLista.length ? cultivosLista.join(", ") : "—",
      porCultivo,
      porCultivoTexto,
      fundos: Number(stats.fundoCount) || 0,
      variedades: Number(stats.varietyCount) || 0,
      parcelas: Number(stats.parcelCount) || 0,
      areaHa: Number(stats.totalAreaHa) || 0,
      areaTexto: formatHa(stats.totalAreaHa),
      topFundos: fundos
        .map((f) => `${f.fundo}: ${formatHa(f.totalAreaHa)}`)
        .filter(Boolean),
      topVariedades: topVars
        .map((v) => `${v.variedad}: ${formatHa(v.areaHa)}`)
        .filter(Boolean),
      validacionUi: "100% (anillo de portada)"
    };
  } catch {
    return { loaded: false };
  }
}

function collectVariedadesFacts() {
  try {
    const inst = moduleLoaderService.currentModuleInstance;
    if (!inst?.rows) return null;
    const rows = inst.rows || [];
    const filtered =
      typeof inst.getFilteredRows === "function" ? inst.getFilteredRows() : rows;
    const licensors = new Set(rows.map((r) => r.licensor).filter(Boolean));
    const byLicensor = new Map();
    rows.forEach((r) => {
      const key = r.licensor || "(sin licenciatario)";
      byLicensor.set(key, (byLicensor.get(key) || 0) + 1);
    });
    const topLicensor = [...byLicensor.entries()].sort((a, b) => b[1] - a[1])[0] || null;
    const search = document.querySelector("#inpVarCatalogSearch")?.value?.trim() || "";
    return {
      total: maskIncognitoNumber(rows.length),
      visibles: maskIncognitoNumber(filtered.length),
      licenciatarios: maskIncognitoNumber(licensors.size),
      topLicensor: topLicensor
        ? `${anonymizeLabel(topLicensor[0])} (${maskIncognitoNumber(topLicensor[1])})`
        : null,
      busqueda: search || null
    };
  } catch {
    return null;
  }
}

function collectTrazabilidadFacts(ctx) {
  try {
    const inst = moduleLoaderService.currentModuleInstance;
    const code = document.querySelector("[data-trz-input]")?.value?.trim() || "";
    const meanings = [...document.querySelectorAll("[data-trz-meaning-grid] .trz-review__card-value")]
      .map((el) => el.textContent?.trim())
      .filter(Boolean)
      .slice(0, 8);
    const catalog = inst?.catalog;
    const packingCount = catalog?.packings ? Object.keys(catalog.packings).length : null;
    return {
      pais: ctx.label,
      countryKey: inst?.countryKey || null,
      codigoActual: code ? anonymizeLabel(code) : null,
      // Ya vienen enmascarados desde la UI si hay incógnito
      significadosVisibles: meanings,
      packingsEnCatalogo:
        packingCount == null ? null : maskIncognitoNumber(packingCount)
    };
  } catch {
    return { pais: ctx.label, codigoActual: null };
  }
}

function collectCartillasFacts() {
  try {
    const inst = moduleLoaderService.currentModuleInstance;
    const catalog = inst?.catalog;
    const crops = catalog?.crops || [];
    const totalItems = crops.reduce((n, c) => n + (c.items?.length || 0), 0);
    const active = inst?.activeCrop || null;
    const query = inst?.query || document.querySelector("[data-cartillas-search]")?.value || "";
    const activeCrop = crops.find((c) => c.code === active);
    return {
      cultivos: maskIncognitoNumber(crops.length),
      items: maskIncognitoNumber(totalItems),
      filtroCultivo: active,
      filtroCultivoNombre: activeCrop?.name || activeCrop?.nombre || active || "",
      itemsCultivoActivo:
        activeCrop?.items?.length == null
          ? null
          : maskIncognitoNumber(activeCrop.items.length),
      busqueda: String(query || "").trim() || null
    };
  } catch {
    return null;
  }
}

/** Brief dinámico según ruta + datos cargados en la UI. */
export function collectPrimaryAiLiveBrief(hash = window.location.hash) {
  const ctx = getPrimaryAiRouteContext(hash);
  const brief = {
    modulo: ctx.label,
    id: ctx.id,
    purpose: ctx.purpose,
    facts: null,
    factsText: ""
  };

  if (!ctx.allowed) {
    brief.factsText = ctx.purpose;
    return brief;
  }

  if (ctx.id === "inicio") brief.facts = collectInicioFacts();
  else if (ctx.id === "variedades") brief.facts = collectVariedadesFacts();
  else if (ctx.id === "trazabilidad") brief.facts = collectTrazabilidadFacts(ctx);
  else if (ctx.id === "cartillas") brief.facts = collectCartillasFacts();

  brief.factsText = formatFactsForPrompt(ctx.id, brief.facts);
  return brief;
}

function formatFactsForPrompt(id, facts) {
  if (!facts) return "Sin datos en vivo cargados aún.";
  if (id === "inicio") {
    if (facts.loaded === false) {
      return "Los datos de hectáreas aún no están cargados. No inventar cifras.";
    }
    return [
      `Cultivos del sistema: ${facts.cultivosTexto}.`,
      `Seleccionado en pantalla: ${facts.cultivoNombre}.`,
      `Datos por cultivo: ${facts.porCultivoTexto || "—"}.`,
      "Si preguntan por uva/arándano/espárrago/palta, usa la fila de ese cultivo. NUNCA digas que no hay datos de un cultivo si aparece arriba."
    ].join(" ");
  }
  if (id === "variedades") {
    return [
      `Variedades en catálogo: ${facts.total}. Visibles con filtro: ${facts.visibles}.`,
      `Genéticas: ${facts.licenciatarios}.`,
      facts.topLicensor ? `Más frecuente: ${facts.topLicensor}.` : "",
      facts.busqueda ? `Búsqueda actual: «${facts.busqueda}».` : "Sin búsqueda activa."
    ]
      .filter(Boolean)
      .join(" ");
  }
  if (id === "trazabilidad") {
    return [
      `País/módulo: ${facts.pais}.`,
      facts.codigoActual ? `Código en el campo: ${facts.codigoActual}.` : "No hay código ingresado.",
      facts.significadosVisibles?.length
        ? `Valores visibles: ${facts.significadosVisibles.join(" · ")}.`
        : "Sin desglose visible.",
      facts.packingsEnCatalogo != null ? `Packings en catálogo: ${facts.packingsEnCatalogo}.` : ""
    ]
      .filter(Boolean)
      .join(" ");
  }
  if (id === "cartillas") {
    return [
      `Cultivos en catálogo: ${facts.cultivos}. Items totales: ${facts.items}.`,
      facts.filtroCultivo
        ? `Filtro activo: ${facts.filtroCultivoNombre || facts.filtroCultivo}${
            facts.itemsCultivoActivo != null ? ` (${facts.itemsCultivoActivo} items)` : ""
          }.`
        : "",
      facts.busqueda ? `Búsqueda: «${facts.busqueda}».` : "Sin búsqueda."
    ]
      .filter(Boolean)
      .join(" ");
  }
  return JSON.stringify(facts);
}

function wantsModuleOverview(q) {
  return (
    /^(explica|resumen|resume|analiza|introduc)/.test(q) ||
    /\b(que es|que muestra|para que sirve|como funciona|ayuda|overview|introduccion|resumen general|datos actuales)\b/.test(
      q
    ) ||
    /explica\s+brevemente\s+este\s+modulo|resume\s+este\s+modulo|analiza\s+este\s+modulo|resumen\s+generico|resumen\s+general/.test(
      q
    )
  );
}

/** Resumen claro del módulo (sin saturar con cifras). */
export function buildPrimaryGenericSummary(hash = window.location.hash) {
  const ctx = getPrimaryAiRouteContext(hash);
  const brief = collectPrimaryAiLiveBrief(hash);
  const facts = brief.facts;

  if (ctx.id === "inicio" && facts?.loaded && facts?.cultivosTexto) {
    return `${ctx.purpose} Cultivos del sistema: ${facts.cultivosTexto}. Ahora estás viendo «${facts.cultivoNombre}».`;
  }
  if (ctx.id === "variedades" && facts) {
    return `${ctx.purpose} El catálogo ya está cargado para consulta y filtrado.`;
  }
  if (ctx.id === "trazabilidad") {
    const code = facts?.codigoActual;
    return code
      ? `${ctx.purpose} Hay un código cargado en pantalla listo para interpretar.`
      : `${ctx.purpose} Ingresa un código para ver su desglose.`;
  }
  if (ctx.id === "cartillas" && facts) {
    return `${ctx.purpose} Puedes filtrar por cultivo o buscar una cartilla.`;
  }
  return ctx.purpose;
}

export function isPrimarySummaryQuestion(question = "") {
  const q = normalizeQuestion(question);
  if (!q) return true;
  // Resumen/overview gana, salvo que pidan un conteo explícito
  if (!wantsModuleOverview(q)) return false;
  return !/\b(cuant[oa]?s?)\b/.test(q);
}

function asksAllCrops(q) {
  return (
    /\bcultivos?\b/.test(q) &&
    /\b(tenemos|hay|cuales|lista|disponibles|maneja|gestiona|existen|incluye|trabaja)\b/.test(q)
  );
}

function asksWhichOnes(q) {
  return (
    /^(y\s+)?(cuales?|cual|esos?|esas?|nombres?|lista(los|las)?|detalla|detalle|menciona)\b/.test(q) ||
    /\bcuales?\s+son\b/.test(q) ||
    /\by\s+cuales?\b/.test(q)
  );
}

function isFollowUpQuestion(q) {
  return (
    asksWhichOnes(q) ||
    /^(y\s+el\s+de|y\s+la\s+de|y\s+eso|y\s+esa|mas\s+detalle|continúa|continua)\b/.test(q) ||
    q.length <= 18 && /^(y\s+)/.test(q)
  );
}

/** «¿Qué fundo tiene más hectáreas?» / «fundo más grande» */
function asksLargestFundo(q) {
  if (!/\bfundo/.test(q) && !/\b(farm|ferme|农场)\b/.test(q)) return false;
  if (/\b(mas\s+grande|el\s+mayor|con\s+mas|tiene\s+mas|mayor\s+area|mas\s+area|largest|plus\s+grande)\b/.test(q)) {
    return true;
  }
  return (
    /\b(mas|mayor|maximo|top|primero|most|largest)\b/.test(q) &&
    /\b(hectareas?|hectares?|ha\b|areas?|superficie|面积)\b/.test(q)
  );
}

function asksLargestVariety(q) {
  const asksVar = /\bvariedad(es)?\b/.test(q) || /\b(variety|varieties|variete|varietes|品种)\b/.test(q);
  if (!asksVar) return false;
  const hasSize = /\b(mas|mayor|maximo|top|primero|most|largest|plus|最多)\b/.test(q);
  const hasArea = /\b(hectareas?|hectares?|ha\b|areas?|superficie|面积)\b/.test(q);
  if (hasSize && hasArea) return true;
  return /\bvariedad(es)?\b.*\b(mas|mayor)\b/.test(q) && hasArea;
}

function answerLargestVariety(cropName, topVariedades = []) {
  const top = String(topVariedades?.[0] || "").trim();
  if (!top) {
    return softAi(`en «${cropName}» aún no tengo ranking de variedades por hectáreas.`);
  }
  const sep = top.indexOf(":");
  const name = sep >= 0 ? top.slice(0, sep).trim() : top;
  const area = sep >= 0 ? top.slice(sep + 1).trim() : "";
  return softAi(
    area
      ? `en «${cropName}» la variedad con más hectáreas es ${name} (${area}).`
      : `en «${cropName}» la variedad con más hectáreas es ${name}.`
  );
}

/** Respuestas cortas y en minúsculas (nombres del JSON se respetan). */
function softAi(text = "") {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^([¡¿]?)([A-ZÁÉÍÓÚÑÜ])/, (_, p, c) => `${p}${c.toLowerCase()}`);
}

function shortVarietyPreview(names = [], limit = 5) {
  const list = (names || []).filter(Boolean);
  if (!list.length) return "";
  const head = list.slice(0, limit).join(", ");
  return list.length > limit ? `${head}…` : head;
}

function answerLargestFundo(cropName, topFundos = []) {
  const top = String(topFundos?.[0] || "").trim();
  if (!top) {
    return `En «${cropName}» no hay resumen de fundos por hectáreas.`;
  }
  const sep = top.indexOf(":");
  const name = sep >= 0 ? top.slice(0, sep).trim() : top;
  const area = sep >= 0 ? top.slice(sep + 1).trim() : "";
  return area
    ? `En «${cropName}» el fundo con más hectáreas es ${name} (${area}).`
    : `En «${cropName}» el fundo con más hectáreas es ${name}.`;
}

function detectIntent(q) {
  if (asksAllCrops(q)) return "cultivos";
  if (/\bvariedad/.test(q)) return "variedades";
  if (asksLargestVariety(q) || (/\bvariedad/.test(q) && /\b(mas|mayor)\b/.test(q) && /\b(hectarea|ha|area)\b/.test(q))) {
    return "variedades";
  }
  if (asksLargestFundo(q) || /\bfundo/.test(q)) return "fundos";
  if (/\b(hectarea|ha\b|area|superficie)/.test(q)) return "hectareas";
  if (asksWhichOnes(q)) return null;
  return null;
}

/**
 * Amplía seguimientos ("cuales son?", "y el de uva?") con el tema anterior.
 */
export function resolveConversationTurn(question = "", history = {}) {
  const raw = String(question || "").trim();
  const q = normalizeQuestion(raw);
  const mentioned = resolveMentionedCropId(q);
  const cropId = mentioned || history.lastCropId || null;
  let intent = detectIntent(q) || history.lastIntent || null;

  let effectiveQuestion = raw;

  if (isFollowUpQuestion(q) && (cropId || intent)) {
    if (intent === "variedades" && cropId) {
      effectiveQuestion = `¿Cuáles son las variedades del cultivo ${cropId}?`;
    } else if (intent === "fundos" && cropId) {
      effectiveQuestion = `¿Cuáles son los fundos del cultivo ${cropId}?`;
    } else if (intent === "hectareas" && cropId) {
      effectiveQuestion = `¿Cuántas hectáreas tiene ${cropId}?`;
    } else if (intent === "cultivos") {
      effectiveQuestion = "¿Qué cultivos tenemos?";
    } else if (cropId && !intent) {
      effectiveQuestion = `Detalle del cultivo ${cropId}`;
    } else if (history.lastQuestion) {
      effectiveQuestion = `${history.lastQuestion} — seguimiento: ${raw}`;
    }
  }

  // Si nombró cultivo + variedades en la misma frase
  if (mentioned && /\bvariedad/.test(q)) intent = "variedades";
  if (mentioned && /\bfundo/.test(q)) intent = "fundos";

  const nextHistory = {
    lastQuestion: effectiveQuestion,
    lastCropId: cropId || history.lastCropId || null,
    lastIntent: intent || history.lastIntent || null
  };

  return { effectiveQuestion, history: nextHistory, cropId: nextHistory.lastCropId, intent: nextHistory.lastIntent };
}

function answerCropSnapshot(q, snap, intentHint = null) {
  if (!snap) return null;
  if (!snap.hasData) {
    return softAi(
      `el cultivo «${snap.nombre}» está en el sistema, pero aún no tiene registros de hectáreas.`
    );
  }

  const parcelHit = answerParcelVarietyLookup(q, snap.id);
  if (parcelHit) return softAi(parcelHit);

  if (asksLargestVariety(q)) {
    return answerLargestVariety(snap.nombre, snap.topVariedades);
  }

  const wantFullList =
    asksWhichOnes(q) || /\b(lista|todas|cuales|nombres)\b/.test(q);
  const wantVarieties =
    intentHint === "variedades" ||
    /\bvariedad/.test(q) ||
    /\bcuales?\s+son\s+las\s+variedades/.test(q);

  const wantFundos =
    intentHint === "fundos" ||
    /\bfundo/.test(q) ||
    /\bcuales?\s+son\s+los\s+fundos/.test(q);

  if (wantVarieties) {
    if (wantFullList) {
      const preview = shortVarietyPreview(snap.varietyNames, 5);
      return softAi(
        preview
          ? `«${snap.nombre}» tiene ${snap.variedades} variedades. algunas: ${preview}.`
          : `«${snap.nombre}» registra ${snap.variedades} variedades.`
      );
    }
    const top = (snap.topVariedades || []).slice(0, 3).join("; ");
    return softAi(
      top
        ? `«${snap.nombre}» suma ${snap.variedades} variedades. top por área: ${top}.`
        : `«${snap.nombre}» registra ${snap.variedades} variedades.`
    );
  }

  if (asksLargestFundo(q)) {
    return softAi(answerLargestFundo(snap.nombre, snap.topFundos));
  }

  if (wantFundos) {
    const ranked = (snap.topFundos || []).slice(0, 4);
    if (ranked.length) {
      return softAi(
        `«${snap.nombre}» tiene ${snap.fundos} fundos. por área: ${ranked.join("; ")}.`
      );
    }
    return softAi(`«${snap.nombre}» tiene ${snap.fundos} fundos.`);
  }

  if (/\b(hectarea|hectareas|ha\b|area|superficie)\b/.test(q) || intentHint === "hectareas") {
    return softAi(`«${snap.nombre}» suma ${snap.areaTexto} en total.`);
  }

  return softAi(
    `«${snap.nombre}»: ${snap.fundos} fundos, ${snap.variedades} variedades y ${snap.areaTexto}.`
  );
}

function isGreeting(q = "") {
  return /^(hola|holi|buenas|buen\s+dia|buenos\s+dias|buenas\s+tardes|buenas\s+noches|hey|hi|hello|bonjour|salut|nihao|ninhao|你好|您好|que\s+tal|saludos)(!|\.|！|。)?$/i.test(
    String(q || "").trim()
  );
}

export function isPrimaryGreetingQuestion(question = "") {
  return isGreeting(normalizeQuestion(question));
}

function greetingReply(moduleLabel = "", cropName = "") {
  const lang = getAiLanguageCode();
  const mod = moduleLabel || moduleLabelForAi("inicio");
  const crop = String(cropName || "").trim();

  if (String(lang).startsWith("en")) {
    const extra = crop
      ? ` you're viewing «${crop}». ask about varieties, farms, tips, or whatever you need.`
      : ` ask for data, tips, or recommendations.`;
    return softAi(`hi! how can i help? i'm on ${mod}.${extra}`);
  }
  if (String(lang).startsWith("fr")) {
    const extra = crop
      ? ` tu vois «${crop}». demande variétés, fundos, tips ou ce dont tu as besoin.`
      : ` demande données, tips ou recommandations.`;
    return softAi(`salut ! je peux t'aider ? je suis sur ${mod}.${extra}`);
  }
  if (String(lang).startsWith("zh")) {
    const extra = crop
      ? ` 当前为「${crop}」。可问品种、农场、建议等。`
      : ` 可问数据、建议或推荐。`;
    return softAi(`你好！需要什么帮助？我在 ${mod}。${extra}`);
  }

  const extra = crop
    ? ` ahora ves «${crop}». pregúntame por variedad, etapa, lote o campo.`
    : ` pregúntame datos puntuales: variedad, etapa, lote o campo.`;
  return softAi(`hola amig@! ¿en qué te puedo ayudar? estoy en ${mod}.${extra}`);
}

const CROP_TIP_KINDS = ["lider", "fundo", "area", "top3", "diversidad", "segundo", "parcelas"];

function nextRotatingTipKind() {
  let idx = 0;
  try {
    idx = Number(sessionStorage.getItem("agv-ai-tip-idx") || "0") || 0;
    sessionStorage.setItem("agv-ai-tip-idx", String(idx + 1));
  } catch {
    idx = Math.floor(Date.now() / 20000);
  }
  return CROP_TIP_KINDS[Math.abs(idx) % CROP_TIP_KINDS.length];
}

function detectCropTipKind(q = "") {
  if (/\b(fundo|farm|ferme|农场)\b/.test(q)) return "fundo";
  if (/\b(top\s*3|ranking|podio|tres\s+primer|前三)\b/.test(q)) return "top3";
  if (/\b(divers|concentra|genetica|reparto|balance|多样性)\b/.test(q)) return "diversidad";
  if (/\b(segundo|2do|segunda|runner|第二)\b/.test(q)) return "segundo";
  if (/\b(parcela|lote|parcel|地块)\b/.test(q)) return "parcelas";
  if (/\b(area|hectarea|superficie|total\s+ha|总面积)\b/.test(q)) return "area";
  if (/\b(lider|mas\s+ha|mayor\s+superficie|top\s+variet)\b/.test(q)) return "lider";
  return null;
}

function parseRankEntry(entry = "") {
  const top = String(entry || "").trim();
  if (!top) return { name: "", area: "" };
  const sep = top.indexOf(":");
  return {
    name: sep >= 0 ? top.slice(0, sep).trim() : top,
    area: sep >= 0 ? top.slice(sep + 1).trim() : ""
  };
}

/** Tips anclados al JSON; rotan para ir descubriendo más datos. */
function answerRotatingCropTip(q, snap, facts) {
  const kind = detectCropTipKind(q) || nextRotatingTipKind();
  const crop = snap.nombre || facts.cultivoNombre;
  const v0 = parseRankEntry(snap.topVariedades?.[0]);
  const v1 = parseRankEntry(snap.topVariedades?.[1]);
  const f0 = parseRankEntry(snap.topFundos?.[0]);
  const top3 = (snap.topVariedades || []).slice(0, 3).join("; ") || "sin ranking";

  if (kind === "fundo" && f0.name) {
    return softAi(
      `en «${crop}», el fundo ${f0.name} concentra la mayor superficie${f0.area ? ` (${f0.area})` : ""}. tip: compara su peso contra el total ${snap.areaTexto}.`
    );
  }
  if (kind === "area") {
    return softAi(
      `«${crop}» suma ${snap.areaTexto} en ${snap.fundos} fundos y ${snap.variedades} variedades. tip: usa el ranking para ver quién empuja ese total.`
    );
  }
  if (kind === "top3") {
    return softAi(`en «${crop}» el top 3 por área es: ${top3}. tip: mira si el 1.º se aleja mucho del 2.º y 3.º.`);
  }
  if (kind === "diversidad") {
    return softAi(
      v0.name && v0.area
        ? `«${crop}» tiene ${snap.variedades} variedades; ${v0.name} lidera con ${v0.area}. tip: si una genética domina, conviene vigilar riesgo de concentración.`
        : `«${crop}» registra ${snap.variedades} variedades en ${snap.areaTexto}. tip: revisa el reparto para no depender de una sola genética.`
    );
  }
  if (kind === "segundo" && v1.name) {
    return softAi(
      `tras el líder, en «${crop}» sigue ${v1.name}${v1.area ? ` con ${v1.area}` : ""}. tip: el 2.º suele ser buen contraste operativo frente al 1.º.`
    );
  }
  if (kind === "parcelas") {
    return softAi(
      `«${crop}» tiene ${snap.parcelas} parcelas activas en ${snap.areaTexto}. tip: más parcelas no siempre es más área; mira el promedio por lote.`
    );
  }
  if (v0.name && v0.area) {
    return softAi(
      `en «${crop}», la variedad ${v0.name} lidera la superficie con ${v0.area}. tip: revisa si una sola genética concentra demasiadas hectáreas.`
    );
  }
  return softAi(`en «${crop}» el top por área es: ${top3}. tip: revisa si una sola genética concentra demasiadas hectáreas.`);
}

function answerInicioLocal(q, facts, turn = {}) {
  if (!facts || facts.loaded === false) {
    return softAi("los datos de inicio aún se están cargando. espera un momento y vuelve a preguntar.");
  }

  if (isGreeting(q)) {
    return greetingReply(
      moduleLabelForAi("inicio"),
      cropLabelForAi(facts.cultivoId, facts.cultivoNombre)
    );
  }

  if (isConversationalAdviceQuestion(q)) {
    const cropId = turn.cropId || resolveMentionedCropId(q) || facts.cultivoId;
    const snap = facts.porCultivo?.[cropId] || buildCropSnapshot(cropId);
    if (!snap?.hasData) {
      return softAi(`sobre «${facts.cultivoNombre}» aún faltan registros para recomendar con datos.`);
    }
    return answerRotatingCropTip(q, snap, facts);
  }

  if (asksAllCrops(q) && turn.intent !== "variedades") {
    const list = facts.cultivosTexto || facts.cultivosLista?.join(", ");
    if (!list || list === "—") {
      return softAi("aún no puedo leer la lista de cultivos. recarga inicio e inténtalo de nuevo.");
    }
    return softAi(
      `trabajamos estos cultivos: ${list}. ahora está seleccionado «${facts.cultivoNombre}».`
    );
  }

  const mentionedId = turn.cropId || resolveMentionedCropId(q);
  if (mentionedId) {
    const snap = facts.porCultivo?.[mentionedId] || buildCropSnapshot(mentionedId);
    const answered = answerCropSnapshot(q, snap, turn.intent);
    if (answered) return answered;
  }

  if (facts.hasData === false) {
    return softAi(`no hay registros de hectáreas para «${facts.cultivoNombre}». prueba otro cultivo.`);
  }

  const parcelHit = answerParcelVarietyLookup(q, turn.cropId || facts.cultivoId);
  if (parcelHit) return softAi(parcelHit);

  const existsHit = answerVarietyExistsLookup(q, turn.cropId || facts.cultivoId);
  if (existsHit) return softAi(existsHit);

  if (asksLargestVariety(q)) {
    return answerLargestVariety(facts.cultivoNombre, facts.topVariedades);
  }

  if (asksLargestFundo(q) || (turn.intent === "fundos" && /\b(hectarea|ha\b|area|superficie)\b/.test(q))) {
    return softAi(answerLargestFundo(facts.cultivoNombre, facts.topFundos));
  }
  if (/\bfundo/.test(q) || turn.intent === "fundos") {
    const ranked = (facts.topFundos || []).slice(0, 3);
    if (/\btop\s*3|ranking|tres\b/.test(q) && ranked.length) {
      return softAi(`top 3 fundos por hectáreas en «${facts.cultivoNombre}»: ${ranked.join("; ")}.`);
    }
    return softAi(
      ranked.length
        ? `en «${facts.cultivoNombre}» hay ${facts.fundos} fundos. por hectáreas: ${ranked.join("; ")}.`
        : `en «${facts.cultivoNombre}» hay ${facts.fundos} fundos.`
    );
  }
  if (/\b(hectarea|hectareas|ha\b|area|superficie)\b/.test(q) || turn.intent === "hectareas") {
    return softAi(`«${facts.cultivoNombre}» suma ${facts.areaTexto} en total.`);
  }
  if (/\bvariedad/.test(q)) {
    const snap = facts.porCultivo?.[facts.cultivoId] || buildCropSnapshot(facts.cultivoId);
    if (/\b(cuant|cuantas|cuantos|total)\b/.test(q) && !/\btop|mas\b/.test(q)) {
      return softAi(`«${facts.cultivoNombre}» tiene ${facts.variedades} variedades.`);
    }
    if (asksWhichOnes(q) || /\b(lista|todas|cuales)\b/.test(q)) {
      const preview = shortVarietyPreview(snap?.varietyNames, 5);
      return softAi(
        preview
          ? `«${facts.cultivoNombre}» tiene ${snap?.variedades ?? facts.variedades} variedades. algunas: ${preview}.`
          : `«${facts.cultivoNombre}» tiene ${facts.variedades} variedades.`
      );
    }
    const top = (facts.topVariedades || snap?.topVariedades || []).slice(0, 3).join("; ");
    return softAi(
      top
        ? `«${facts.cultivoNombre}» tiene ${facts.variedades} variedades. top por hectáreas: ${top}.`
        : `«${facts.cultivoNombre}» tiene ${facts.variedades} variedades.`
    );
  }
  if (/\b(parcela|lote)\b/.test(q)) {
    return softAi(`«${facts.cultivoNombre}»: ${facts.fundos} fundos, ${facts.variedades} variedades y ${facts.areaTexto}.`);
  }
  if (/\b(validacion|validar|anillo|portada)\b/.test(q)) {
    return softAi(`en inicio ves «${facts.cultivoNombre}» con ${facts.areaTexto}.`);
  }
  if (/\bactivo\b/.test(q) || /\bcultivo\s+activo\b/.test(q)) {
    return softAi(`el cultivo activo en pantalla es «${facts.cultivoNombre}».`);
  }
  if (wantsModuleOverview(q)) {
    return softAi(buildPrimaryGenericSummary());
  }

  return softAi(
    `estás en inicio. cultivos: ${facts.cultivosTexto}. ahora ves «${facts.cultivoNombre}».`
  );
}

/**
 * ¿Tenemos esta variedad? — busca en catálogo Variedades y/o parcelas del cultivo activo.
 */
function answerVarietyExistsLookup(q, cropIdHint = null) {
  if (/\bcuant/.test(q)) return null;
  const wantsExists =
    /\b(tenemos|existe|do\s+we\s+have|avons[- ]nous|有)\b/.test(q) ||
    /\b(esta|está)\s+en\s+(el\s+)?(catalogo|catálogo)\b/.test(q);
  if (!wantsExists) return null;

  const ql = normalizeQuestion(q);
  const candidates = [];

  try {
    const rows = moduleLoaderService.currentModuleInstance?.rows;
    if (Array.isArray(rows)) {
      rows.forEach((r) => {
        if (r?.variety) {
          candidates.push({
            name: String(r.variety),
            code: String(r.code || ""),
            licensor: r.licensor || "",
            source: "catalog"
          });
        }
      });
    }
  } catch {
    /* ignore */
  }

  const { crop, parcels } = getCropParcels(cropIdHint);
  const cropName = crop?.nombre || "el cultivo activo";
  [...new Set(parcels.map((p) => p.variedad).filter(Boolean))].forEach((name) => {
    candidates.push({ name: String(name), code: "", licensor: "", source: "parcel" });
  });

  candidates.sort((a, b) => String(b.name).length - String(a.name).length);

  for (const c of candidates) {
    const n = normalizeQuestion(c.name);
    const code = normalizeQuestion(c.code);
    if ((n.length >= 3 && ql.includes(n)) || (code.length >= 2 && ql.includes(code))) {
      const show = anonymizeLabel(c.name);
      if (c.source === "catalog") {
        return c.licensor
          ? `sí, «${show}» está en el catálogo (${anonymizeLabel(c.licensor)}).`
          : `sí, «${show}» está en el catálogo.`;
      }
      return `sí, «${show}» aparece en las parcelas de «${cropName}».`;
    }
  }

  const asked =
    ql.match(
      /\b(?:tenemos|existe|hay|do we have|avons nous)\s+(?:la\s+)?(?:variedad\s+)?([a-z0-9][\w .-]{1,40})/
    )?.[1] ||
    ql.match(/\bvariedad\s+([a-z0-9][\w .-]{1,40})/)?.[1] ||
    "";
  const name = String(asked || "")
    .replace(/\b(en el catalogo|en el catálogo|catalogo|catálogo)\b/g, "")
    .trim();
  if (name.length >= 2) {
    return `no encontré «${name}» en el catálogo ni en las parcelas de «${cropName}».`;
  }
  return null;
}

function answerVariedadesLocal(q, facts) {
  if (!facts) {
    return softAi("el catálogo de variedades aún no está cargado.");
  }

  const parcelHit = answerParcelVarietyLookup(q);
  if (parcelHit) return softAi(parcelHit);

  const existsHit = answerVarietyExistsLookup(q);
  if (existsHit) return softAi(existsHit);

  const openTalk = /\b(para\s+que|por\s+que|porque|mercado|exporta|buenos?|diversidad|cliente|beneficio)\b/.test(
    q
  );

  if (/\b(cuant|total)\b.*\bvariedad|\bvariedad.*\b(cuant|total|hay)\b/.test(q) || /\bcuantas?\s+hay\b/.test(q)) {
    if (/\b(visibl|filtrad)\b/.test(q)) {
      return softAi(`se ven ${facts.visibles} de ${facts.total} variedades con el filtro actual.`);
    }
    return softAi(`hay ${facts.total} variedades en el catálogo.`);
  }

  if (/\b(visibl|filtrad)\b/.test(q)) {
    return softAi(`se ven ${facts.visibles} de ${facts.total} variedades con el filtro actual.`);
  }

  if (/\b(cuant|cuantas|cuantos)\b/.test(q) && /\bgenetic/.test(q)) {
    return softAi(`hay ${facts.licenciatarios} genéticas en el catálogo.`);
  }

  if (
    /\bgenetic/.test(q) &&
    /\b(mas|mayor|principal|top|frecuente)\b/.test(q) &&
    !openTalk
  ) {
    return softAi(
      facts.topLicensor
        ? `la genética con más variedades es ${facts.topLicensor}.`
        : `hay ${facts.licenciatarios} genéticas en el catálogo.`
    );
  }

  if (/\bmas\s+variedad/.test(q) && /\bgenetic/.test(q)) {
    return softAi(
      facts.topLicensor
        ? `la genética con más variedades es ${facts.topLicensor}.`
        : `hay ${facts.licenciatarios} genéticas en el catálogo.`
    );
  }

  if (/\b(filtro|busqueda|buscar)\b/.test(q)) {
    return softAi(
      facts.busqueda
        ? `la búsqueda activa es «${facts.busqueda}».`
        : "no hay búsqueda activa en este momento."
    );
  }

  if (wantsModuleOverview(q)) {
    return softAi(
      `catálogo con ${facts.total} variedades y ${facts.licenciatarios} genéticas` +
        (facts.topLicensor ? `; la principal es ${facts.topLicensor}` : "") +
        "."
    );
  }

  // Borrador corto con hechos (sin “pregunta por…”): Gemini responde la pregunta abierta.
  return softAi(
    `datos del catálogo: ${facts.total} variedades, ${facts.licenciatarios} genéticas` +
      (facts.topLicensor ? `, principal ${facts.topLicensor}` : "") +
      "."
  );
}

function answerTrazabilidadLocal(q, facts) {
  const f = facts || {};
  if (/\bcodigo\b/.test(q) || /\bingres/.test(q)) {
    return softAi(
      f.codigoActual
        ? `el código en pantalla es «${f.codigoActual}».`
        : "aún no hay un código ingresado. escríbelo en el campo de traza."
    );
  }
  if (/\b(peru|chile|pais|estoy)\b/.test(q) && !/\btip\b|astuce|提示/.test(q)) {
    if (/\bestoy|peru|chile\b/.test(q) && !/\bdiferencia\b/.test(q)) {
      return softAi(`estás en ${f.pais || "trazabilidad"}.`);
    }
    return softAi(
      "traza perú y traza chile interpretan códigos según el país de origen. elige la opción del menú que corresponda."
    );
  }
  if (f.significadosVisibles?.length && /\b(significa|resultado|desglose|packing|grower|valores?|muestra)\b/.test(q)) {
    return softAi(
      `el desglose en pantalla: ${f.significadosVisibles.slice(0, 5).join(", ")}.`
    );
  }
  if (/\btip\b|astuce|提示|consej|util|useful/.test(q) || isConversationalAdviceQuestion(q)) {
    const tips = [
      "tip: lee el código de izquierda a derecha; cada bloque suele mapear packing, grower u origen.",
      "tip: elige primero perú o chile: el mismo formato no se interpreta igual en ambos países.",
      f.codigoActual
        ? `tip: ya tienes «${f.codigoActual}» en pantalla; valida que cada segmento tenga sentido en el desglose.`
        : "tip: pega un código completo antes de interpretar; un carácter de menos cambia el significado."
    ];
    let idx = 0;
    try {
      idx = Number(sessionStorage.getItem("agv-ai-trz-tip-idx") || "0") || 0;
      sessionStorage.setItem("agv-ai-trz-tip-idx", String(idx + 1));
    } catch {
      idx = Math.floor(Date.now() / 20000);
    }
    if (/\bpais|peru|chile|country|pays|国家/.test(q)) return softAi(tips[1]);
    return softAi(tips[Math.abs(idx) % tips.length]);
  }
  if (wantsModuleOverview(q)) {
    return softAi(buildPrimaryGenericSummary());
  }
  return softAi(
    f.codigoActual
      ? `módulo ${f.pais || "trazabilidad"}; código «${f.codigoActual}».`
      : `módulo ${f.pais || "trazabilidad"}; sin código ingresado.`
  );
}

function answerCartillasLocal(q, facts) {
  if (!facts) {
    return softAi("el catálogo de cartillas aún no está cargado. abre cartillas y vuelve a preguntar.");
  }
  if (/\b(item|cartilla|cuant)\b/.test(q) && !/\btip\b|astuce|提示/.test(q)) {
    return softAi(`el catálogo tiene cartillas organizadas en ${facts.cultivos} cultivos.`);
  }
  if (/\b(filtro|cultivo|busqueda)\b/.test(q) && !/\btip\b|astuce|提示/.test(q)) {
    if (facts.busqueda) return softAi(`la búsqueda activa es «${facts.busqueda}».`);
    if (facts.filtroCultivo && facts.filtroCultivo !== "all") {
      return softAi(`el filtro activo es «${facts.filtroCultivoNombre || facts.filtroCultivo}».`);
    }
    return softAi("no hay un filtro especial activo ahora.");
  }
  if (/\btip\b|astuce|提示|consej|util|useful/.test(q) || isConversationalAdviceQuestion(q)) {
    const tips = [
      `tip: filtra por cultivo (${facts.cultivos} en catálogo) antes de abrir una cartilla para no mezclar reglas.`,
      "tip: en cartillas, valida lotes con causa real; si falta sap, prioriza completar datos antes de interpretar.",
      facts.filtroCultivo && facts.filtroCultivo !== "all"
        ? `tip: ya filtras «${facts.filtroCultivoNombre || facts.filtroCultivo}»; cruza con el módulo pt/mp del mismo cultivo.`
        : "tip: usa el filtro de cultivo y la búsqueda juntos para acotar rápido la cartilla correcta."
    ];
    let idx = 0;
    try {
      idx = Number(sessionStorage.getItem("agv-ai-cart-tip-idx") || "0") || 0;
      sessionStorage.setItem("agv-ai-cart-tip-idx", String(idx + 1));
    } catch {
      idx = Math.floor(Date.now() / 20000);
    }
    if (/\bfiltro|filter|filtre|筛选/.test(q)) return softAi(tips[0]);
    return softAi(tips[Math.abs(idx) % tips.length]);
  }
  if (wantsModuleOverview(q)) {
    return softAi(buildPrimaryGenericSummary("#/cartillas"));
  }
  return softAi(
    `cartillas en ${facts.cultivos} cultivos` +
      (facts.filtroCultivo && facts.filtroCultivo !== "all"
        ? `; filtro «${facts.filtroCultivoNombre || facts.filtroCultivo}»`
        : "") +
      "."
  );
}

export function answerPrimaryAiLocal(question = "", hash = window.location.hash, history = {}) {
  const ctx = getPrimaryAiRouteContext(hash);
  const brief = collectPrimaryAiLiveBrief(hash);
  const turn = resolveConversationTurn(question, history);
  const q = normalizeQuestion(turn.effectiveQuestion);
  const pack = (text) => ({
    text: finalizeIncognitoAiText(text),
    history: turn.history,
    effectiveQuestion: turn.effectiveQuestion
  });

  if (!ctx.allowed) {
    return pack(ctx.purpose);
  }

  if (isGreeting(q)) {
    if (ctx.id === "inicio" && brief?.facts?.loaded) {
      return pack(
        greetingReply(
          moduleLabelForAi("inicio"),
          cropLabelForAi(brief.facts.cultivoId, brief.facts.cultivoNombre)
        )
      );
    }
    return pack(greetingReply(ctx.label || moduleLabelForAi(ctx)));
  }

  if (!q || (isPrimarySummaryQuestion(turn.effectiveQuestion) && !turn.cropId && !isFollowUpQuestion(normalizeQuestion(question)))) {
    if (ctx.id !== "inicio" && /\b(inicio|portada|home)\b/.test(q)) {
      return pack(buildPrimaryGenericSummary("#/inicio"));
    }
    if (ctx.id !== "variedades" && /\bvariedad/.test(q) && !/\bhectarea|\bfundo|\barea\b/.test(q) && !turn.cropId) {
      return pack(buildPrimaryGenericSummary("#/dashboard"));
    }
    if (ctx.id !== "trazabilidad" && /\btraza/.test(q)) {
      return pack(
        buildPrimaryGenericSummary(q.includes("chile") ? "#/trazabilidad/chile" : "#/trazabilidad/peru")
      );
    }
    if (ctx.id !== "cartillas" && /\bcartilla/.test(q)) {
      return pack(buildPrimaryGenericSummary("#/cartillas"));
    }
    if (!turn.cropId) {
      return pack(buildPrimaryGenericSummary(hash));
    }
  }

  if (/\b(navegar|menu|sidebar|donde\s+esta|como\s+llego)\b/.test(q)) {
    return pack(
      "En el menú izquierdo: Inicio, Variedades, Trazabilidad (Perú/Chile) y Cartillas. Este asistente solo responde sobre esos módulos, usando los datos que ves en pantalla."
    );
  }

  let text = "";
  if (ctx.id === "inicio") {
    text = answerInicioLocal(q, brief.facts, turn);
  } else if (ctx.id === "variedades") {
    text = answerVariedadesLocal(q, brief.facts);
  } else if (ctx.id === "trazabilidad") {
    text = answerTrazabilidadLocal(q, brief.facts);
  } else if (ctx.id === "cartillas") {
    text = answerCartillasLocal(q, brief.facts);
  } else {
    text = buildPrimaryGenericSummary(hash);
  }

  return pack(text);
}

export function isConversationalAdviceQuestion(question = "") {
  const q = normalizeQuestion(question);
  if (!q) return false;
  if (/\b(recomiend|recomendacion|consej|tip\b|tips|astuce|nota|importante|opin|suger|mejor|conviene|deberia|que\s+tal|charlar|convers|explica|por\s+que|ventaja|riesgo|cuidado|ojo\b|dato\s+clave|recommend|advice|suggest|提示)\b/.test(q)) {
    return true;
  }
  if (/donne(-moi)?\s+une\s+astuce/.test(q)) return true;
  if (/give\s+me\s+(an?\s+)?(important\s+|useful\s+)?tip/.test(q)) return true;
  if (/给.*提示/.test(String(question || ""))) return true;
  return false;
}

/**
 * La IA NO inventa datos duros; en modo consejo puede dar tips anclados al JSON.
 */
export function buildPrimaryAiPrompt(question, hash = window.location.hash, draftAnswer = "", options = {}) {
  const ctx = getPrimaryAiRouteContext(hash);
  const brief = collectPrimaryAiLiveBrief(hash);
  const q = String(question || "").trim() || "Dame un resumen claro de este módulo.";
  const qNorm = normalizeQuestion(q);
  const focused = buildFocusedContext(qNorm, ctx, brief);
  const draft = String(draftAnswer || buildPrimaryGenericSummary(hash)).trim();
  const advice = Boolean(options.advice) || isConversationalAdviceQuestion(q);
  const cropTalk = buildCropTalkContext(brief, qNorm);
  const lang = getAiLanguageCode();
  const langRule = languageReplyRule(lang);
  let mustLang = "";
  try {
    const v = i18nService?.translate?.("primaryAi.mustFollowLanguage");
    if (v && v !== "primaryAi.mustFollowLanguage") mustLang = v;
  } catch {
    /* ignore */
  }
  const langLock = mustLang || langRule;

  if (advice) {
    return `Eres el asistente conversacional de AG*-MI (agroexportadora en Olmos).

${langLock}

MÓDULO: ${ctx.label}
CONTEXTO:
${cropTalk || focused}

BORRADOR:
${draft}

PREGUNTA:
${q}

REGLAS:
- tono cercano, minúsculas, breve (1-3 oraciones).
- tips/recomendaciones solo con datos del contexto.
- copia EXACTA las cifras de hectáreas del borrador/contexto (ej. «603.5 ha»); no las acortes ni las partas.
- no inventes ha, códigos E/C, fundos ni variedades.
- no listes más de 5 variedades.
- sin markdown. marca tip con «tip:».
- responde solo el contenido útil; no digas el idioma ni metas del sistema.`;
  }

  return `Eres el asistente de AG*-MI (agroexportadora en Olmos).

${langLock}

MÓDULO: ${ctx.label}
HECHOS:
${focused}
${cropTalk ? `\nCONTEXTO:\n${cropTalk}` : ""}

BORRADOR (fuente de verdad):
${draft}

PREGUNTA:
${q}

TAREA:
- reescribe el borrador en 1-3 oraciones, minúsculas, claro.
- no inventes datos. no listes catálogos largos (máx 5 nombres).
- si el borrador ya da la variedad/fundo con más ha, conserva ese dato.
- sin markdown.
- responde solo el contenido útil; no digas el idioma ni metas del sistema.`;
}

function buildCropTalkContext(brief, qNorm = "") {
  const facts = brief?.facts;
  if (!facts?.loaded) return "";
  const mentioned = resolveMentionedCropId(qNorm);
  const cropId = mentioned || facts.cultivoId;
  const snap = facts.porCultivo?.[cropId] || buildCropSnapshot(cropId);
  if (!snap?.hasData) {
    return `Cultivo activo: ${facts.cultivoNombre}. Cultivos del sistema: ${facts.cultivosTexto}.`;
  }
  const topV = (snap.topVariedades || []).slice(0, 8).join("; ") || "—";
  const topF = (snap.topFundos || []).slice(0, 5).join("; ") || "—";
  const names = (snap.varietyNames || []).slice(0, 5).join(", ") || "—";
  return [
    `Cultivo: ${snap.nombre} (activo: ${facts.cultivoNombre}).`,
    `Área: ${snap.areaTexto}. Fundos: ${snap.fundos}. Variedades: ${snap.variedades}.`,
    `Top variedades por área: ${topV}.`,
    `Top fundos: ${topF}.`,
    `Ejemplos de variedades: ${names}.`
  ].join("\n");
}

function buildFocusedContext(qNorm, ctx, brief) {
  const facts = brief.facts;
  if (ctx.id === "inicio" && facts?.loaded) {
    const mentionedId = resolveMentionedCropId(qNorm);
    if (mentionedId && facts.porCultivo?.[mentionedId]) {
      const s = facts.porCultivo[mentionedId];
      return `Cultivo consultado: ${s.nombre}. Fundos: ${s.fundos} (${s.fundoNames.join(", ") || "—"}). Área: ${s.areaTexto}. Variedades: ${s.variedades}.`;
    }
    if (asksAllCrops(qNorm)) {
      return `Cultivos del sistema: ${facts.cultivosTexto}. Seleccionado ahora: ${facts.cultivoNombre}.`;
    }
    if (asksLargestFundo(qNorm) || /\bfundo/.test(qNorm)) {
      const ranked = (facts.topFundos || []).join("; ") || "—";
      return `Cultivo seleccionado: ${facts.cultivoNombre}. Fundos por área (mayor→menor): ${ranked}. Total cultivo: ${facts.areaTexto}.`;
    }
    if (/\b(hectarea|ha\b|area|superficie)/.test(qNorm)) {
      return `Cultivo seleccionado: ${facts.cultivoNombre}. Área total: ${facts.areaTexto}. Top fundos: ${(facts.topFundos || []).slice(0, 3).join("; ") || "—"}.`;
    }
    if (/\bvariedad/.test(qNorm)) {
      return `Cultivo seleccionado: ${facts.cultivoNombre}. Variedades: ${facts.variedades}.`;
    }
    return `Cultivos: ${facts.cultivosTexto}. Por cultivo: ${facts.porCultivoTexto}. Seleccionado: ${facts.cultivoNombre}.`;
  }
  return brief.factsText || ctx.purpose;
}

/** Preguntas de cifra/dato: la respuesta local es más precisa que el modelo. */
export function isPrimaryFactualQuestion(question = "") {
  const q = normalizeQuestion(question);
  if (!q || isPrimarySummaryQuestion(question)) return false;
  if (isConversationalAdviceQuestion(question)) return false;
  if (asksAllCrops(q)) return true;
  if (asksLargestVariety(q) || asksLargestFundo(q)) return true;
  if (/\be\s*[-.]?\s*\d{1,4}\b/.test(q) || /\bc\s*[-.]?\s*\d{1,4}\b/.test(q)) {
    return true;
  }
  // Mencionar cultivo solo cuenta como dato si piden cifra/lista, no consejo
  if (resolveMentionedCropId(q) && /\b(cuant|hectarea|ha\b|fundo|variedad|parcela|detalle|cuales)\b/.test(q)) {
    return true;
  }
  return /\b(cuant|cuanto|cuanta|cuantas|hectarea|ha\b|area|fundo|variedad|parcela|lote|item|cartilla|codigo|licenciat|validacion|filtro|busqueda|top|principal)\b/.test(
    q
  );
}

/** Solo rechaza respuestas claramente malas (no inventar / vacías / “no hay datos” falsos). */
export function isWeakPrimaryGeminiAnswer(text = "", question = "", draft = "") {
  const t = String(text || "").trim();
  if (t.length < 12) return true;
  const lower = t.toLowerCase();
  const q = normalizeQuestion(question);
  const d = String(draft || "");

  // Filtra fugas del prompt / meta-instrucciones (ej. «do not invent data. Max 5 names…»)
  if (
    /do not invent|don'?t invent|no inventes|max\s*\d+\s*names|m[aá]x\.?\s*\d+\s*nombres|sin markdown|fuente de verdad|reescribe el borrador|must follow|idoma ui|idioma ui:|ui language|\(\s*ui language|108%\s*spanish|no listes cat[aá]logos|borra?dor\s*\(fuente/i.test(
      t
    )
  ) {
    return true;
  }

  // Dice que no hay datos de un cultivo que sí preguntaron
  if (
    /uva|arandano|esparrago|palta/.test(q) &&
    /no (cuento|tengo|dispongo)|sin (informaci|datos)|no hay (informaci|datos)/i.test(t)
  ) {
    return true;
  }
  if (/como modelo de lenguaje|no tengo acceso a|como ia\b|soy una ia\b/i.test(lower)) {
    return true;
  }

  // Cifras de ha truncadas / repetidas (ej. «con 6 con 6» en vez de «603.5 ha»)
  if (/\bcon\s+\d{1,2}\s+con\s+\d{1,2}\b/i.test(t)) return true;
  if (/\blidera\b[\s\S]{0,40}\bcon\s+\d{1,2}(?!\d)(?![.,]\d)/i.test(t) && /\d+\.\d+\s*ha/i.test(d)) {
    return true;
  }

  // Borrador con ha claras: si Gemini pierde la cifra, usar el borrador
  const draftHa = d.match(/(\d+(?:\.\d+)?)\s*ha/gi) || [];
  if (draftHa.length) {
    const textHasFullHa = /(\d{2,}(?:\.\d+)?)\s*ha/i.test(t);
    if (!textHasFullHa) return true;
  }

  // Pregunta por variedad líder: la respuesta debe nombrar una variedad (no solo reglas)
  if (asksLargestVariety(q) && d.length > 20) {
    const draftName = d.match(/variedad(?:\s+con\s+m[aá]s\s+hect[aá]reas)?\s+es\s+([^.(]+)/i)?.[1]?.trim();
    if (draftName && draftName.length >= 3 && !t.toLowerCase().includes(draftName.toLowerCase().slice(0, Math.min(6, draftName.length)))) {
      return true;
    }
  }

  // Borrador con lista campo/etapa: si Gemini omite casi todo, usar el borrador
  const draftCodes = (d.match(/\b[ec]\d{1,4}\b/gi) || []).length;
  const textCodes = (t.match(/\b[ec]\d{1,4}\b/gi) || []).length;
  if (draftCodes >= 3 && textCodes < Math.max(2, Math.floor(draftCodes * 0.4))) {
    return true;
  }

  return false;
}
