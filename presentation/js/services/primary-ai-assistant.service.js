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

function formatHa(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${n.toLocaleString("es-PE", { maximumFractionDigits: 1 })} ha`;
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

export function getPrimaryAiRouteContext(hash = window.location.hash || "#/inicio") {
  const h = String(hash || "").split("?")[0] || "#/inicio";
  if (h === "#/" || h === "#" || h === "#/inicio") {
    return {
      id: "inicio",
      label: "Inicio",
      allowed: true,
      purpose:
        "Vista gerencial del sistema AGV-MI (agroexportadora): resumen operativo con validación, hectáreas, fundos y variedades del cultivo activo."
    };
  }
  if (h === "#/dashboard") {
    return {
      id: "variedades",
      label: "Variedades",
      allowed: true,
      purpose:
        "Catálogo genético de variedades (licenciatarios, genética, búsqueda y filtros) para consulta de referencia."
    };
  }
  if (h.startsWith("#/trazabilidad")) {
    return {
      id: "trazabilidad",
      label: h.includes("chile") ? "Traza Chile" : h.includes("peru") ? "Traza Perú" : "Trazabilidad",
      allowed: true,
      purpose:
        "Consulta de códigos de trazabilidad (Perú/Chile) para interpretar packing, grower y datos de seguimiento."
    };
  }
  if (h === "#/cartillas") {
    return {
      id: "cartillas",
      label: "Cartillas",
      allowed: true,
      purpose:
        "Catálogo de cartillas de inspección por cultivo; búsqueda y filtros para aseguramiento de calidad."
    };
  }
  return {
    id: "fuera",
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
      return "JSON de hectáreas aún no cargado. No inventar cifras.";
    }
    return [
      `Cultivos del sistema: ${facts.cultivosTexto}.`,
      `Seleccionado en pantalla: ${facts.cultivoNombre}.`,
      `Datos por cultivo (fuente JSON): ${facts.porCultivoTexto || "—"}.`,
      "Si preguntan por uva/arándano/espárrago/palta, usa la fila de ese cultivo. NUNCA digas que no hay datos de un cultivo si aparece arriba."
    ].join(" ");
  }
  if (id === "variedades") {
    return [
      `Variedades en catálogo: ${facts.total}. Visibles con filtro: ${facts.visibles}.`,
      `Licenciatarios: ${facts.licenciatarios}.`,
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
  if (!/\bfundo/.test(q)) return false;
  if (/\b(mas\s+grande|el\s+mayor|con\s+mas|tiene\s+mas|mayor\s+area|mas\s+area)\b/.test(q)) {
    return true;
  }
  return (
    /\b(mas|mayor|maximo|top|primero)\b/.test(q) &&
    /\b(hectarea|ha\b|area|superficie)\b/.test(q)
  );
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
    return `El cultivo «${snap.nombre}» está en el sistema, pero aún no tiene registros de hectáreas en el JSON.`;
  }

  const varietyList = snap.varietyNames?.length
    ? snap.varietyNames.join(", ")
    : (snap.topVariedades || [])
        .map((line) => String(line).split(":")[0].trim())
        .filter(Boolean)
        .join(", ");

  const wantVarieties =
    intentHint === "variedades" ||
    /\bvariedad/.test(q) ||
    /\bcuales?\s+son\s+las\s+variedades/.test(q);

  const wantFundos =
    intentHint === "fundos" ||
    /\bfundo/.test(q) ||
    /\bcuales?\s+son\s+los\s+fundos/.test(q);

  if (wantVarieties) {
    return varietyList
      ? `«${snap.nombre}» tiene ${snap.variedades} variedades: ${varietyList}.`
      : `«${snap.nombre}» registra ${snap.variedades} variedades.`;
  }

  if (asksLargestFundo(q)) {
    return answerLargestFundo(snap.nombre, snap.topFundos);
  }

  if (wantFundos) {
    const ranked = (snap.topFundos || []).slice(0, 6);
    if (ranked.length) {
      return `«${snap.nombre}» tiene ${snap.fundos} fundos. Por área: ${ranked.join("; ")}.`;
    }
    const names = snap.fundoNames?.slice(0, 8) || [];
    return names.length
      ? `«${snap.nombre}» tiene ${snap.fundos} fundos: ${names.join(", ")}.`
      : `«${snap.nombre}» tiene ${snap.fundos} fundos.`;
  }

  if (/\b(hectarea|hectareas|ha\b|area|superficie)\b/.test(q) || intentHint === "hectareas") {
    return `«${snap.nombre}» suma ${snap.areaTexto} en total.`;
  }

  const names = snap.fundoNames?.slice(0, 6) || [];
  return names.length
    ? `«${snap.nombre}» tiene ${snap.fundos} fundos (${names.join(", ")}), ${snap.variedades} variedades y ${snap.areaTexto}.`
    : `«${snap.nombre}» tiene ${snap.fundos} fundos, ${snap.variedades} variedades y ${snap.areaTexto}.`;
}

function answerInicioLocal(q, facts, turn = {}) {
  if (!facts || facts.loaded === false) {
    return "Los datos de Inicio aún se están cargando. Espera un momento y vuelve a preguntar.";
  }

  if (asksAllCrops(q) && turn.intent !== "variedades") {
    const list = facts.cultivosTexto || facts.cultivosLista?.join(", ");
    if (!list || list === "—") {
      return "Aún no puedo leer la lista de cultivos. Recarga Inicio e inténtalo de nuevo.";
    }
    return `En AGV-MI trabajamos estos cultivos: ${list}. Ahora mismo en pantalla está seleccionado «${facts.cultivoNombre}».`;
  }

  const mentionedId = turn.cropId || resolveMentionedCropId(q);
  if (mentionedId) {
    const snap = facts.porCultivo?.[mentionedId] || buildCropSnapshot(mentionedId);
    const answered = answerCropSnapshot(q, snap, turn.intent);
    if (answered) return answered;
  }

  if (facts.hasData === false) {
    return `No hay registros de hectáreas para «${facts.cultivoNombre}». Prueba otro cultivo en Inicio.`;
  }

  // Fundo + hectáreas: responder el fundo mayor (no el total del cultivo).
  if (asksLargestFundo(q) || (turn.intent === "fundos" && /\b(hectarea|ha\b|area|superficie)\b/.test(q))) {
    return answerLargestFundo(facts.cultivoNombre, facts.topFundos);
  }
  if (/\bfundo/.test(q) || turn.intent === "fundos") {
    const ranked = (facts.topFundos || []).slice(0, 4);
    return ranked.length
      ? `En «${facts.cultivoNombre}» hay ${facts.fundos} fundos. Por área: ${ranked.join("; ")}.`
      : `En «${facts.cultivoNombre}» hay ${facts.fundos} fundos.`;
  }
  if (/\b(hectarea|hectareas|ha\b|area|superficie)\b/.test(q) || turn.intent === "hectareas") {
    return `El cultivo «${facts.cultivoNombre}» suma ${facts.areaTexto} en total.`;
  }
  if (/\bvariedad/.test(q)) {
    const snap = facts.porCultivo?.[facts.cultivoId] || buildCropSnapshot(facts.cultivoId);
    if (snap?.varietyNames?.length) {
      return `«${facts.cultivoNombre}» tiene ${snap.variedades} variedades: ${snap.varietyNames.join(", ")}.`;
    }
    return `En «${facts.cultivoNombre}» se registran ${facts.variedades} variedades.`;
  }
  if (/\b(parcela|lote)\b/.test(q)) {
    return `Hay ${facts.parcelas} parcelas activas en «${facts.cultivoNombre}».`;
  }
  if (/\b(validacion|validar|anillo|portada)\b/.test(q)) {
    return "La portada de Inicio muestra el estado de validación junto al resumen del cultivo activo.";
  }
  if (/\bactivo\b/.test(q) || /\bcultivo\s+activo\b/.test(q)) {
    return `El cultivo activo en pantalla es «${facts.cultivoNombre}».`;
  }
  if (wantsModuleOverview(q)) {
    return buildPrimaryGenericSummary();
  }

  return `Estás en Inicio. Los cultivos del sistema son: ${facts.cultivosTexto}. Ahora ves «${facts.cultivoNombre}».`;
}

function answerVariedadesLocal(q, facts) {
  if (!facts) {
    return "El catálogo de Variedades aún no está cargado. Entra a Variedades y vuelve a preguntar.";
  }
  if (/\b(cuant|total|hay|cuantas)\b.*\bvariedad|\bvariedad.*\b(cuant|total|hay)\b/.test(q) || /\bcuantas?\s+hay\b/.test(q)) {
    return `Hay ${facts.total} variedades en el catálogo.`;
  }
  if (/\blicenci/.test(q)) {
    return `El catálogo agrupa ${facts.licenciatarios} licenciatarios.`;
  }
  if (/\bgenetic/.test(q) || /\bmas\s+frecuente|\btop\b/.test(q)) {
    return facts.topLicensor
      ? `El más frecuente es ${facts.topLicensor}.`
      : `Hay ${facts.licenciatarios} licenciatarios en el catálogo.`;
  }
  if (/\b(filtro|busqueda|buscar)\b/.test(q)) {
    return facts.busqueda
      ? `La búsqueda activa es «${facts.busqueda}».`
      : "No hay búsqueda activa en este momento.";
  }
  if (wantsModuleOverview(q)) {
    return buildPrimaryGenericSummary("#/dashboard");
  }
  return "Estás en Variedades. Puedes preguntar por el total, licenciatarios o el filtro activo.";
}

function answerTrazabilidadLocal(q, facts) {
  const f = facts || {};
  if (/\bcodigo\b/.test(q) || /\bingres/.test(q)) {
    return f.codigoActual
      ? `El código en pantalla es «${f.codigoActual}».`
      : "Aún no hay un código ingresado. Escríbelo en el campo de traza.";
  }
  if (/\b(peru|chile|pais|diferencia)\b/.test(q)) {
    return "Traza Perú y Traza Chile interpretan códigos según el país de origen. Elige la opción del menú que corresponda.";
  }
  if (f.significadosVisibles?.length && /\b(significa|resultado|desglose|packing|grower)\b/.test(q)) {
    return `El desglose del código ya aparece en pantalla (${f.significadosVisibles.slice(0, 3).join(", ")}).`;
  }
  if (wantsModuleOverview(q)) {
    return buildPrimaryGenericSummary();
  }
  return `Estás en ${f.pais || "Trazabilidad"}. Ingresa un código o pregunta la diferencia entre Perú y Chile.`;
}

function answerCartillasLocal(q, facts) {
  if (!facts) {
    return "El catálogo de Cartillas aún no está cargado. Abre Cartillas y vuelve a preguntar.";
  }
  if (/\b(item|cartilla|cuant)\b/.test(q)) {
    return `El catálogo tiene cartillas organizadas en ${facts.cultivos} cultivos.`;
  }
  if (/\b(filtro|cultivo|busqueda)\b/.test(q)) {
    if (facts.busqueda) return `La búsqueda activa es «${facts.busqueda}».`;
    if (facts.filtroCultivo && facts.filtroCultivo !== "all") {
      return `El filtro activo es «${facts.filtroCultivoNombre || facts.filtroCultivo}».`;
    }
    return "No hay un filtro especial activo ahora.";
  }
  if (wantsModuleOverview(q)) {
    return buildPrimaryGenericSummary("#/cartillas");
  }
  return "Estás en Cartillas. Pregunta por el filtro activo o para qué sirve el módulo.";
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

/**
 * La IA NO inventa datos: solo redacta un resumen usando hechos del JSON/HTML.
 */
export function buildPrimaryAiPrompt(question, hash = window.location.hash, draftAnswer = "") {
  const ctx = getPrimaryAiRouteContext(hash);
  const brief = collectPrimaryAiLiveBrief(hash);
  const q = String(question || "").trim() || "Dame un resumen claro de este módulo.";
  const qNorm = normalizeQuestion(q);
  const focused = buildFocusedContext(qNorm, ctx, brief);
  const draft = String(draftAnswer || buildPrimaryGenericSummary(hash)).trim();

  return `Eres redactor de AG*-MI (agroexportadora en Olmos). NO eres fuente de datos.

MÓDULO: ${ctx.label}
PARA QUÉ SIRVE: ${ctx.purpose}

HECHOS DEL SISTEMA (JSON / pantalla — única verdad):
${focused}

BORRADOR YA CALCULADO CON ESOS HECHOS:
${draft}

PREGUNTA DEL USUARIO:
${q}

TU ÚNICA TAREA:
- Reescribe el borrador en 1-2 oraciones claras y fáciles de entender.
- Usa SOLO los HECHOS y el BORRADOR. No inventes números, fundos ni cultivos.
- No digas que faltan datos si aparecen en HECHOS.
- No agregues temas que el usuario no preguntó.
- No uses nombres de empresa reales (Agrovisión/AGV); reemplázalos por «agroexportadora» o AG*.
- No reemplaces letras por @ en la prosa. Solo conserva @ o +100 si ya vienen así en HECHOS/BORRADOR (fundos, variedades, códigos).
- Español simple. Sin markdown.`;
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
  if (asksAllCrops(q)) return true;
  if (resolveMentionedCropId(q)) return true;
  return /\b(cuant|cuanto|cuanta|cuantas|hectarea|ha\b|area|fundo|variedad|parcela|lote|item|cartilla|codigo|licenciat|validacion|filtro|busqueda|top|principal)\b/.test(
    q
  );
}

/** Solo rechaza respuestas claramente malas (no inventar / vacías / “no hay datos” falsos). */
export function isWeakPrimaryGeminiAnswer(text = "", question = "") {
  const t = String(text || "").trim();
  if (t.length < 12) return true;
  const lower = t.toLowerCase();
  const q = normalizeQuestion(question);

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
  return false;
}
