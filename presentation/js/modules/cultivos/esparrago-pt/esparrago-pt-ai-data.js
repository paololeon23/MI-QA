/**
 * Extracto del Excel PT Espárrago para el asistente (Gemini o modo local sin créditos).
 * Usa encabezados reales del archivo + valores únicos por columna.
 */

import { parseFechaToISO, formatISOToDMY } from "./esparrago-pt.validation.js";

function stripDiacritics(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function normalizeHeaderKey(value) {
  return stripDiacritics(String(value || "").toLowerCase())
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function isLikelyDateHeader(headerKey) {
  return /\bfecha\b/.test(headerKey) || /\bdate\b/.test(headerKey);
}

function formatCell(val, headerKey) {
  if (val == null || val === "") return "";
  if (isLikelyDateHeader(headerKey) || typeof val === "number") {
    const iso = parseFechaToISO(val);
    if (iso) return formatISOToDMY(iso);
  }
  return String(val).trim();
}

function countUniqueForCol(rows, colIdx, headerKey, limit = 25) {
  const map = new Map();
  for (const row of rows || []) {
    const v = formatCell(row?.[colIdx], headerKey);
    if (!v) continue;
    map.set(v, (map.get(v) || 0) + 1);
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es"))
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));
}

function formatList(items) {
  if (!items?.length) return "ninguno";
  return items.map((i) => `${i.name} (${i.count})`).join("; ");
}

function findColIndex(headers, aliases) {
  const list = headers || [];
  const norms = list.map((h) => normalizeHeaderKey(h));
  for (const alias of aliases) {
    const a = normalizeHeaderKey(alias);
    const exact = norms.findIndex((n) => n === a);
    if (exact >= 0) return exact;
  }
  for (const alias of aliases) {
    const a = normalizeHeaderKey(alias);
    const partial = norms.findIndex((n) => n.includes(a) || a.includes(n));
    if (partial >= 0) return partial;
  }
  return -1;
}

/** Columnas prioritarias para el chat local (por alias de encabezado). */
const PRIORITY_COLUMNS = [
  { key: "id", aliases: ["id"], limit: 8 },
  { key: "inspeccion", aliases: ["inspeccion codigo", "inspeccion", "inspección código"], limit: 8 },
  { key: "fechaRegistro", aliases: ["fecha registro", "fecha de registro"], limit: 12 },
  { key: "usuario", aliases: ["usuario", "user", "correo"], limit: 25 },
  { key: "lote", aliases: ["lote"], limit: 15 },
  { key: "estado", aliases: ["estado"], limit: 10 },
  { key: "tipoCalidad", aliases: ["tipo calidad"], limit: 8 },
  { key: "cantMuestra", aliases: ["cant muestra", "cantidad muestra"], limit: 8 },
  { key: "medMuestra", aliases: ["med muestra", "medida muestra"], limit: 8 },
  { key: "notaCondicion", aliases: ["nota condicion", "nota condición"], limit: 10 },
  { key: "productor", aliases: ["productor"], limit: 10 },
  { key: "campo", aliases: ["campo"], limit: 10 },
  { key: "pallet", aliases: ["pallet"], limit: 10 },
  { key: "guia", aliases: ["guia de remision", "guía de remisión"], limit: 8 }
];

/**
 * @param {any[][]} rows
 * @param {object} analysis
 * @param {string[]} headers
 */
export function buildEsparragoPtAiDataBrief(rows, analysis = {}, headers = []) {
  const headerList = Array.isArray(headers) ? headers.map((h) => String(h ?? "").trim()) : [];
  const columnsCatalog = [];
  const byKey = {};

  for (const def of PRIORITY_COLUMNS) {
    const idx = findColIndex(headerList, def.aliases);
    if (idx < 0) continue;
    const header = headerList[idx] || def.aliases[0];
    const headerKey = normalizeHeaderKey(header);
    const values = countUniqueForCol(rows, idx, headerKey, def.limit);
    const entry = {
      key: def.key,
      header,
      index: idx,
      values,
      valuesTexto: formatList(values)
    };
    columnsCatalog.push(entry);
    byKey[def.key] = entry;
  }

  // Si faltan encabezados, usar índices fijos PTES como respaldo
  if (!columnsCatalog.length) {
    const fallback = [
      ["fechaRegistro", 3, "Fecha registro"],
      ["usuario", 6, "Usuario"],
      ["lote", 9, "Lote"],
      ["estado", 5, "Estado"]
    ];
    for (const [key, idx, header] of fallback) {
      const values = countUniqueForCol(rows, idx, normalizeHeaderKey(header), 20);
      const entry = { key, header, index: idx, values, valuesTexto: formatList(values) };
      columnsCatalog.push(entry);
      byKey[key] = entry;
    }
  }

  const headersAvailable = headerList.filter(Boolean).slice(0, 40);

  return {
    ...analysis,
    rowsCount: rows?.length ?? 0,
    headersAvailable,
    columnsCatalog,
    columnsKnown: columnsCatalog.map((c) => c.header),
    // Accesos rápidos (compat)
    usuariosTexto: byKey.usuario?.valuesTexto || "ninguno",
    lotesTexto: byKey.lote?.valuesTexto || "ninguno",
    estadosTexto: byKey.estado?.valuesTexto || "ninguno",
    productoresTexto: byKey.productor?.valuesTexto || "ninguno",
    camposTexto: byKey.campo?.valuesTexto || "ninguno",
    fechasRegistroTexto: byKey.fechaRegistro?.valuesTexto || "ninguno",
    byKey
  };
}

function scoreHeaderMatch(questionNorm, headerNorm) {
  if (!questionNorm || !headerNorm) return 0;
  if (questionNorm.includes(headerNorm) || headerNorm.includes(questionNorm)) return 100;
  const qTokens = questionNorm.split(" ").filter((t) => t.length > 2);
  const hTokens = headerNorm.split(" ").filter((t) => t.length > 2);
  let hits = 0;
  for (const ht of hTokens) {
    if (qTokens.some((qt) => qt === ht || qt.includes(ht) || ht.includes(qt))) hits += 1;
  }
  if (!hits) return 0;
  return hits * 20 + (hits === hTokens.length ? 30 : 0);
}

const QUESTION_ALIASES = [
  { keys: ["usuario"], patterns: [/usuario/, /\buser\b/, /correo/, /email/, /nombre/] },
  { keys: ["lote"], patterns: [/\blote/] },
  { keys: ["fechaRegistro"], patterns: [/fecha\s*reg/, /registraron/, /registrad/] },
  { keys: ["estado"], patterns: [/\bestado/] },
  { keys: ["productor"], patterns: [/productor/] },
  { keys: ["campo"], patterns: [/\bcampo/] },
  { keys: ["pallet"], patterns: [/pallet|palet/] },
  { keys: ["cantMuestra"], patterns: [/cant(?:idad)?\s*muestra/, /\bmuestra/] },
  { keys: ["medMuestra"], patterns: [/med(?:ida)?\s*muestra/, /unidad/] },
  { keys: ["notaCondicion"], patterns: [/nota\s*condici/, /\bnota\b/, /condicion/] },
  { keys: ["inspeccion"], patterns: [/inspecci[oó]n\s*c[oó]digo/, /\bptev\b/, /codigo\s*inspec/] },
  { keys: ["tipoCalidad"], patterns: [/tipo\s*calidad/, /calidad/] },
  { keys: ["guia"], patterns: [/gu[ií]a/, /remisi[oó]n/] },
  { keys: ["id"], patterns: [/\bid\b/, /identificador/] }
];

/**
 * Respuesta local basada en encabezados/valores del Excel (sin Gemini).
 */
export function answerEsparragoPtFromHeaders(snapshot, userQuestion = "", options = {}) {
  const s = snapshot || {};
  const mode = options.mode === "intro" ? "intro" : "chat";
  const fechaInsp = String(s.fechaLabel || "—").replace(/undefined\//g, "").trim() || "—";
  const total = s.total ?? s.rowsCount ?? 0;
  const ok = s.ok ?? 0;
  const errors = s.errors ?? 0;
  const q = String(userQuestion || "").toLowerCase();
  const qNorm = normalizeHeaderKey(userQuestion);
  const byKey = s.byKey || {};
  const catalog = s.columnsCatalog || [];

  if (mode === "intro") {
    const headersHint = (s.columnsKnown || []).slice(0, 8).join(", ");
    const users = byKey.usuario?.valuesTexto;
    const fechas = byKey.fechaRegistro?.valuesTexto;
    return `Informe Espárrago PT · inspección ${fechaInsp} · ${total} registros. Encabezados clave: ${headersHint || "según Excel"}.${fechas && fechas !== "ninguno" ? ` Fecha registro: ${fechas}.` : ""}${users && users !== "ninguno" ? ` Usuarios: ${users}.` : ""} Lectura para gerencia con datos del archivo cargado.`;
  }

  if (/cu[aá]ntos?\s+registros|total\s+filas|cuantas\s+filas/.test(q)) {
    return `El reporte tiene ${total} registros (${ok} OK, ${errors} con error).`;
  }
  if (/error|desviaci|problema/.test(q)) {
    return errors > 0
      ? `Hay ${errors} registro(s) con error y ${ok} correctos, de un total de ${total}.`
      : `No se detectaron errores en los ${total} registros del reporte.`;
  }
  if (/inspecci[oó]n(?!\s*c[oó]digo)|fecha\s*inspecci|filtro/.test(q) && !/registr/.test(q)) {
    return `La fecha de inspección seleccionada (filtro) es ${fechaInsp}.`;
  }
  if (/recomend|suger|continuar|listo\s+para/.test(q)) {
    return errors > 0
      ? `Antes de continuar, revisar los ${errors} registro(s) con error. Inspección: ${fechaInsp}.`
      : `Con los datos actuales (${total} registros, inspección ${fechaInsp}) no hay errores en el extracto; se puede continuar con seguimiento normal.`;
  }
  if (/encabezad|columnas?\s+hay|que\s+columnas|que\s+campos\s+tiene/.test(q)) {
    const list = (s.headersAvailable || s.columnsKnown || []).slice(0, 20).join(", ");
    return list
      ? `Encabezados disponibles en el Excel: ${list}.`
      : "No hay encabezados cargados en el extracto.";
  }

  // 1) Alias por tipo de pregunta
  for (const alias of QUESTION_ALIASES) {
    if (!alias.patterns.some((re) => re.test(q))) continue;
    for (const key of alias.keys) {
      const col = byKey[key];
      if (col?.valuesTexto && col.valuesTexto !== "ninguno") {
        return `Según la columna «${col.header}»: ${col.valuesTexto}.`;
      }
      if (col) {
        return `La columna «${col.header}» está en el Excel, pero sin valores en este extracto.`;
      }
    }
  }

  // 2) Match directo contra encabezados del catálogo
  let best = null;
  let bestScore = 0;
  for (const col of catalog) {
    const score = scoreHeaderMatch(qNorm, normalizeHeaderKey(col.header));
    if (score > bestScore) {
      bestScore = score;
      best = col;
    }
  }
  if (best && bestScore >= 20) {
    if (best.valuesTexto && best.valuesTexto !== "ninguno") {
      return `Según la columna «${best.header}»: ${best.valuesTexto}.`;
    }
    return `La columna «${best.header}» no tiene valores en este extracto.`;
  }

  // 3) Match contra lista completa de encabezados (aunque no estén en catálogo de valores)
  const headers = s.headersAvailable || [];
  for (const h of headers) {
    const hn = normalizeHeaderKey(h);
    if (hn.length < 3) continue;
    if (scoreHeaderMatch(qNorm, hn) >= 40) {
      return `El Excel incluye la columna «${h}». Abre el detalle de la tabla para ver sus valores, o reformula preguntando por esa columna.`;
    }
  }

  const resumenCols = (s.columnsKnown || []).slice(0, 6).join(", ");
  return `No encontré un dato exacto para esa pregunta en el extracto local. Puedes preguntar por: ${resumenCols || "Usuario, Lote, Fecha registro"}. Inspección: ${fechaInsp}. Registros: ${total}.`;
}
