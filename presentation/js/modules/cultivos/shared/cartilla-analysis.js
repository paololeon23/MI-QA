/**
 * Análisis gerencial de cartilla — compartido (MP / PT / Plagas).
 * Semáforo + conformidad + causa + lotes, sin tocar la lógica de validación.
 */

function defaultHtmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isWeakCause(cause) {
  const c = String(cause || "").toLowerCase();
  return (
    c.includes("obligatorio") ||
    c.includes("desviación de validación") ||
    c.includes("desviacion de validacion")
  );
}

function cellHasDisplayData(row, colJs) {
  if (!row || !Number.isFinite(colJs) || colJs < 0) return false;
  const raw = row[colJs];
  if (raw == null) return false;
  return String(raw).trim() !== "";
}

/**
 * Solo errores de celdas rojas CON dato (mismo criterio visual que la tabla).
 * No incluye vacíos/obligatorio vacío ni columnas sin pintar con valor.
 * @returns {{ causes: string[], columns: string[], pairs: { cause: string, column: string, weak: boolean, colNum: number|null }[] }}
 */
export function extractRowErrorHints(row, options = {}) {
  const {
    errorMap = null,
    duplicateLotes = new Set(),
    colLoteJs = 9,
    headerByColNum = new Map(),
    t = (k) => k
  } = options;

  const pairs = [];
  const seen = new Set();

  const pushPair = (cause, column, colNum = null) => {
    const c = String(cause || t("cartillaAnalysis.genericError")).trim();
    if (!c) return;
    const col = String(column || "").trim() || (colNum != null ? `Col ${colNum}` : "Col");
    const key = `${colNum ?? col}|${c}`;
    if (seen.has(key)) return;
    seen.add(key);
    pairs.push({
      cause: c,
      column: col,
      colNum: colNum == null ? null : Number(colNum),
      weak: isWeakCause(c)
    });
  };

  const resolveHeader = (colNum) => {
    const n = Number(colNum);
    if (!Number.isFinite(n) || n < 1) return "Col";
    return headerByColNum.get(n) || `Col ${n}`;
  };

  const filaMap = errorMap?.get?.(row._filaNum);
  if (filaMap?.size) {
    filaMap.forEach((err, colNum) => {
      const js = Number(colNum) - 1;
      // Solo celdas con dato en rojo (no vacíos obligatorios).
      if (!cellHasDisplayData(row, js)) return;
      pushPair(
        err?.problema || err?.tipo || t("cartillaAnalysis.genericError"),
        resolveHeader(colNum),
        colNum
      );
    });
  }

  if (row._errorCols instanceof Map) {
    row._errorCols.forEach((msg, colJs) => {
      const js = Number(colJs);
      if (!cellHasDisplayData(row, js)) return;
      const cause =
        typeof msg === "string" ? msg : msg?.problema || t("cartillaAnalysis.genericError");
      const colNum = js + 1;
      pushPair(cause, resolveHeader(colNum), colNum);
    });
  } else if (row._errorCols instanceof Set) {
    row._errorCols.forEach((colJs) => {
      const js = Number(colJs);
      if (!cellHasDisplayData(row, js)) return;
      const colNum = js + 1;
      pushPair(t("cartillaAnalysis.genericError"), resolveHeader(colNum), colNum);
    });
  }

  if (Array.isArray(row._errors) && row._errors.length) {
    row._errors.forEach((err) => {
      if (typeof err === "string") return;
      const colNum = err.colNum ?? (err.colJs != null ? err.colJs + 1 : err.col);
      if (colNum == null) return;
      const js = Number(colNum) - 1;
      if (!cellHasDisplayData(row, js)) return;
      pushPair(
        err?.message || err?.problema || err?.msg || t("cartillaAnalysis.genericError"),
        resolveHeader(colNum),
        colNum
      );
    });
  }

  const lote = String(row[colLoteJs] ?? "").trim();
  if (
    lote &&
    cellHasDisplayData(row, colLoteJs) &&
    (row._errorLote || row.__duplicado || duplicateLotes?.has?.(lote))
  ) {
    pushPair(t("plagasArandano.duplicateLots"), resolveHeader(colLoteJs + 1), colLoteJs + 1);
  }

  pairs.sort((a, b) => Number(a.weak) - Number(b.weak));

  return {
    causes: pairs.map((p) => p.cause),
    columns: pairs.map((p) => p.column),
    pairs
  };
}

/**
 * @param {object} params
 */
export function buildCartillaAnalysis(params) {
  const {
    rows = [],
    filasConError = [],
    errorMap = null,
    duplicateLotes = new Set(),
    colLoteJs = 9,
    colIdJs = 0,
    columns = [],
    cartilla = "",
    fechaLabel = "",
    t,
    htmlEscape = defaultHtmlEscape,
    translateHeader = (h) => h
  } = params;

  const total = rows.length;
  const errors = filasConError.length;
  const ok = Math.max(total - errors, 0);
  const conformity = total ? Math.round((ok / total) * 100) : 100;

  let level = "ok";
  if (errors > 0 && conformity >= 95) level = "warn";
  if (errors > 0 && conformity < 95) level = "critical";

  const headerByColNum = new Map();
  columns.forEach((col) => {
    const idx = typeof col === "object" ? col.originalIndex : col;
    const header = typeof col === "object" ? col.header : String(col);
    if (idx == null || !Number.isFinite(Number(idx))) return;
    // Solo clave Excel 1-based (igual que errorMap). No usar idx 0-based:
    // pisaría la columna anterior (ej. LMR 51 ← Observación).
    headerByColNum.set(Number(idx) + 1, translateHeader(header, idx));
  });

  const causeCount = new Map();
  const colCount = new Map();
  const loteDetails = new Map();

  filasConError.forEach((row) => {
    const lote = String(row[colLoteJs] ?? "").trim() || t("cartillaAnalysis.unknownLot");
    const id = String(row[colIdJs] ?? "").trim();
    const entry = loteDetails.get(lote) || {
      lote,
      ids: [],
      columns: new Set(),
      hints: [],
      count: 0,
      strong: 0
    };
    entry.count += 1;
    if (id && !entry.ids.includes(id)) entry.ids.push(id);

    const { causes, pairs } = extractRowErrorHints(row, {
      errorMap,
      duplicateLotes,
      colLoteJs,
      headerByColNum,
      t
    });

    pairs.forEach((p) => {
      if (p.column) {
        entry.columns.add(p.column);
        if (!p.weak) colCount.set(p.column, (colCount.get(p.column) || 0) + 1);
      }
    });

    // Literal: "ID · Columna roja · mensaje" (máx. 4 celdas con dato).
    for (const p of pairs) {
      if (entry.hints.length >= 4) break;
      const idPart = id ? `ID ${id} · ` : "";
      const hint = `${idPart}${p.column} · ${p.cause}`;
      if (hint && !entry.hints.includes(hint)) {
        entry.hints.push(hint);
        if (!p.weak) entry.strong += 1;
      }
    }
    loteDetails.set(lote, entry);

    if (!causes.length) {
      causeCount.set(
        t("cartillaAnalysis.genericError"),
        (causeCount.get(t("cartillaAnalysis.genericError")) || 0) + 1
      );
      return;
    }
    // Si la fila ya tiene error fuerte, no sumar «Campo obligatorio» al ranking.
    const hasStrong = pairs.some((p) => !p.weak);
    causes.forEach((cause) => {
      if (hasStrong && isWeakCause(cause)) return;
      causeCount.set(cause, (causeCount.get(cause) || 0) + 1);
    });
  });

  const rankedCauses = [...causeCount.entries()].sort((a, b) => {
    const aWeak = isWeakCause(a[0]) ? 1 : 0;
    const bWeak = isWeakCause(b[0]) ? 1 : 0;
    if (aWeak !== bWeak) return aWeak - bWeak;
    return b[1] - a[1];
  });
  const topCause = rankedCauses[0] || null;
  const topColumn = [...colCount.entries()].sort((a, b) => b[1] - a[1])[0] || null;
  const topLotes = [...loteDetails.values()]
    .sort(
      (a, b) =>
        (b.strong || 0) - (a.strong || 0) ||
        b.count - a.count ||
        a.lote.localeCompare(b.lote)
    )
    .slice(0, 8)
    .map((entry) => ({
      lote: entry.lote,
      ids: entry.ids.slice(0, 6),
      columns: [...entry.columns].slice(0, 12),
      hints: (entry.hints || []).slice(0, 4),
      count: entry.count
    }));
  const dupSize = duplicateLotes?.size ?? 0;

  const trafficLabel =
    level === "ok"
      ? t("cartillaAnalysis.trafficOk")
      : level === "warn"
        ? t("cartillaAnalysis.trafficWarn")
        : t("cartillaAnalysis.trafficCritical");

  const reading =
    level === "ok"
      ? t("cartillaAnalysis.readingOk")
      : topCause
        ? t("cartillaAnalysis.readingErrors", { cause: topCause[0], lots: String(topLotes.length) })
        : t("cartillaAnalysis.readingErrorsGeneric");

  return {
    cartilla,
    fechaLabel,
    total,
    errors,
    ok,
    conformity,
    level,
    trafficLabel,
    reading,
    topCause,
    topColumn,
    topLotes,
    duplicateCount: dupSize,
    icon: level === "ok" ? "success" : level === "warn" ? "warning" : "error",
    htmlEscape
  };
}

function renderKpis(analysis, t) {
  const esc = analysis.htmlEscape;
  return `
    <div class="agv-cartilla-analysis__kpis">
      <div class="agv-cartilla-analysis__kpi">
        <span class="agv-cartilla-analysis__kpi-label">${esc(t("cartillaAnalysis.conformity"))}</span>
        <strong class="agv-cartilla-analysis__kpi-value">${analysis.conformity}%</strong>
      </div>
      <div class="agv-cartilla-analysis__kpi">
        <span class="agv-cartilla-analysis__kpi-label">${esc(t("cartillaAnalysis.records"))}</span>
        <strong class="agv-cartilla-analysis__kpi-value">${analysis.ok}/${analysis.total}</strong>
      </div>
      <div class="agv-cartilla-analysis__kpi">
        <span class="agv-cartilla-analysis__kpi-label">${esc(t("cartillaAnalysis.errors"))}</span>
        <strong class="agv-cartilla-analysis__kpi-value">${analysis.errors}</strong>
      </div>
      <div class="agv-cartilla-analysis__kpi">
        <span class="agv-cartilla-analysis__kpi-label">${esc(t("cartillaAnalysis.traffic"))}</span>
        <strong class="agv-cartilla-analysis__kpi-value">${esc(analysis.trafficLabel)}</strong>
      </div>
    </div>`;
}

function renderDetails(analysis, t) {
  const esc = analysis.htmlEscape;
  const causeText = analysis.topCause
    ? `${esc(analysis.topCause[0])} (${analysis.topCause[1]})`
    : esc(t("cartillaAnalysis.noCause"));
  const columnText = analysis.topColumn
    ? `${esc(analysis.topColumn[0])} (${analysis.topColumn[1]})`
    : esc(t("cartillaAnalysis.seeTable"));

  const lotesHtml = analysis.topLotes.length
    ? `<ul class="agv-cartilla-analysis__lots">${analysis.topLotes
        .map((item) => {
          const lote = Array.isArray(item) ? item[0] : item.lote;
          const ids = Array.isArray(item) ? [] : item.ids || [];
          const idsText = ids.length ? ids.join(", ") : "—";
          const hints = Array.isArray(item) ? [] : item.hints || [];
          const hintsHtml = hints.length
            ? `<div class="agv-cartilla-analysis__lot-cols">${hints
                .map((h) => esc(h))
                .join("<br>")}</div>`
            : "";
          return `<li class="agv-cartilla-analysis__lot">
            <div class="agv-cartilla-analysis__lot-main">
              <strong class="agv-cartilla-analysis__lot-code">${esc(lote)}</strong>
              <span class="agv-cartilla-analysis__lot-id">${esc(t("cartillaAnalysis.lotId", { id: idsText }))}</span>
            </div>
            ${hintsHtml}
          </li>`;
        })
        .join("")}</ul>`
    : `<p class="agv-cartilla-analysis__empty">${esc(t("cartillaAnalysis.noLots"))}</p>`;

  const dupLine =
    analysis.duplicateCount > 0
      ? `<p class="agv-cartilla-analysis__dup">${esc(
          t("cartillaAnalysis.duplicates", { count: String(analysis.duplicateCount) })
        )}</p>`
      : "";

  return `
    <div class="agv-cartilla-analysis__grid">
      <div class="agv-cartilla-analysis__block">
        <span class="agv-cartilla-analysis__block-label">${esc(t("cartillaAnalysis.mainCause"))}</span>
        <p class="agv-cartilla-analysis__block-value">${causeText}</p>
      </div>
      <div class="agv-cartilla-analysis__block">
        <span class="agv-cartilla-analysis__block-label">${esc(t("cartillaAnalysis.mainColumn"))}</span>
        <p class="agv-cartilla-analysis__block-value">${columnText}</p>
      </div>
    </div>
    <div class="agv-cartilla-analysis__block agv-cartilla-analysis__block--lots">
      <span class="agv-cartilla-analysis__block-label">${esc(t("cartillaAnalysis.topLots"))}</span>
      ${lotesHtml}
    </div>
    ${dupLine}
    <p class="agv-cartilla-analysis__reading">${esc(analysis.reading)}</p>`;
}

export function htmlCartillaAnalysisModal(analysis, t) {
  const esc = analysis.htmlEscape;
  return `
    <div class="agv-cartilla-analysis agv-cartilla-analysis--modal agv-cartilla-analysis--${analysis.level}">
      <p class="agv-cartilla-analysis__meta">${esc(analysis.cartilla)} · ${esc(analysis.fechaLabel)}</p>
      ${renderKpis(analysis, t)}
      ${renderDetails(analysis, t)}
    </div>`;
}

export function htmlCartillaAnalysisPanel(analysis, t) {
  const esc = analysis.htmlEscape;
  return `
    <div class="agv-cartilla-analysis agv-cartilla-analysis--panel agv-cartilla-analysis--${analysis.level}">
      <div class="agv-cartilla-analysis__head">
        <div>
          <h4 class="agv-cartilla-analysis__title">${esc(t("cartillaAnalysis.title"))}</h4>
          <p class="agv-cartilla-analysis__meta">${esc(analysis.cartilla)} · ${esc(analysis.fechaLabel)}</p>
        </div>
        <span class="agv-cartilla-analysis__badge">${esc(analysis.trafficLabel)}</span>
      </div>
      ${renderKpis(analysis, t)}
      ${renderDetails(analysis, t)}
    </div>`;
}

/**
 * Controlador ligero para enganchar panel + modal en cualquier servicio.
 */
export function createCartillaAnalysisController(options) {
  const {
    getRoot,
    hostSelector,
    showDialog,
    t,
    htmlEscape = defaultHtmlEscape
  } = options;

  let lastAnalysis = null;

  const getHost = () => getRoot()?.querySelector(hostSelector) || null;

  const clear = () => {
    const host = getHost();
    if (host) {
      host.innerHTML = "";
      host.hidden = true;
    }
    lastAnalysis = null;
  };

  const present = (analysisParams) => {
    const analysis = buildCartillaAnalysis({ ...analysisParams, t, htmlEscape });
    lastAnalysis = analysis;
    const host = getHost();
    if (host) {
      host.innerHTML = htmlCartillaAnalysisPanel(analysis, t);
      host.hidden = false;
    }
    if (typeof showDialog === "function") {
      showDialog({
        icon: analysis.icon,
        title: t("cartillaAnalysis.title"),
        html: htmlCartillaAnalysisModal(analysis, t),
        confirmButtonText: t("cartillaAnalysis.continue"),
        wide: true
      });
    }
    return analysis;
  };

  const refreshPanel = (analysisParams) => {
    if (!analysisParams) {
      if (!lastAnalysis) return null;
      const host = getHost();
      if (host) {
        host.innerHTML = htmlCartillaAnalysisPanel(lastAnalysis, t);
        host.hidden = false;
      }
      return lastAnalysis;
    }
    const analysis = buildCartillaAnalysis({ ...analysisParams, t, htmlEscape });
    lastAnalysis = analysis;
    const host = getHost();
    if (host) {
      host.innerHTML = htmlCartillaAnalysisPanel(analysis, t);
      host.hidden = false;
    }
    return analysis;
  };

  return {
    clear,
    present,
    refreshPanel,
    getLast: () => lastAnalysis
  };
}

/**
 * Deriva filas con error desde celdas pintadas en el DOM.
 * Anota row._errorCols con los índices JS de las celdas en rojo (dataset.excelCol).
 */
export function deriveFilasConErrorFromDom(
  tbody,
  rows,
  selector = ".agv-pt-cell-error-empty, .agv-pt-cell-error-value, .agv-mp-cell-error-empty, .agv-mp-cell-error-value"
) {
  if (!tbody || !rows?.length) return [];
  const out = [];
  [...tbody.children].forEach((tr, i) => {
    const row = rows[i];
    if (!row) return;
    const errorCells = tr.querySelectorAll(selector);
    if (!errorCells.length) return;
    const cols = new Set();
    errorCells.forEach((td) => {
      const js = Number(td.dataset.excelCol);
      if (Number.isFinite(js) && js >= 0) cols.add(js);
    });
    row._errorCols = cols;
    out.push(row);
  });
  return out;
}

/** Convierte headers string[] a columnas para buildCartillaAnalysis. */
export function headersToAnalysisColumns(headers = []) {
  return headers.map((header, originalIndex) =>
    typeof header === "object" && header != null
      ? {
          header: header.header ?? String(header),
          originalIndex: header.originalIndex ?? originalIndex
        }
      : { header: String(header ?? ""), originalIndex }
  );
}

/** Compat: alias usado por Espárrago MP. */
export const buildEsparragoMpCartillaAnalysis = buildCartillaAnalysis;
