/** Vista comparativa IPP vs ISP — Plagas Espárrago */

import {
  applyPlagasCellValidation,
  buildCompareRowGroups,
  cellDisplayValue,
  cellHasCompareError,
  getCompareColumnLabel,
  getCompareColumnsForPane
} from "./esparrago-plagas.validation.js";

const LOTE_IDX = 9;

function buildPaneContext(stats, tipo) {
  return {
    tipo,
    lotesIPP: stats.lotesIPP,
    lotesISP: stats.lotesISP,
    duplicadosCartilla: tipo === "IPP" ? stats.dupsIPP : stats.dupsISP
  };
}

function emptyPaneMessage(tipo, stats, t) {
  if (tipo === "IPP" && !stats.rowsIPP.length && stats.soloEnISP.length) {
    return t("plagasEsparrago.noIppRowsSoloIsp", { count: stats.soloEnISP.length });
  }
  if (tipo === "ISP" && !stats.rowsISP.length && stats.soloEnIPP.length) {
    return t("plagasEsparrago.noIspRowsSoloIpp", { count: stats.soloEnIPP.length });
  }
  return t("plagasEsparrago.noErrorRows");
}

function renderCompareTable(headerRow, bodyRows, headers, rows, tipo, config, stats, t, columnLabelsByIndex) {
  if (!headerRow || !bodyRows) return;

  const ctx = buildPaneContext(stats, tipo);
  const fixed = config.columnas_compare?.fijas_js ?? [0, 6, 9];
  const errorRows = rows;
  const visibleCols = errorRows.length
    ? getCompareColumnsForPane(errorRows, tipo, config, ctx, headers)
    : fixed;

  headerRow.replaceChildren();
  visibleCols.forEach((idx) => {
    const th = document.createElement("th");
    th.className = "agv-mp-table__col-header";
    th.textContent = getCompareColumnLabel(idx, headers, config, columnLabelsByIndex);
    th.scope = "col";
    headerRow.appendChild(th);
  });

  bodyRows.replaceChildren();
  if (!errorRows.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = Math.max(visibleCols.length, fixed.length);
    td.className = "agv-mp-compare-empty";
    td.textContent = emptyPaneMessage(tipo, stats, t);
    tr.appendChild(td);
    bodyRows.appendChild(tr);
    return;
  }

  renderCompareTableRows(bodyRows, errorRows, visibleCols, tipo, config, ctx, LOTE_IDX);
}

function appendCompareRow(tr, row, visibleCols, tipo, config, ctx, options = {}) {
  const { duplicateGroup = false, duplicateStart = false } = options;

  if (duplicateGroup) {
    tr.classList.add("agv-mp-compare-row--duplicate");
    tr.classList.add(duplicateStart ? "agv-mp-compare-row--duplicate-start" : "agv-mp-compare-row--duplicate-follow");
  }

  visibleCols.forEach((idx) => {
    const td = document.createElement("td");
    td.dataset.excelCol = String(idx);
    const val = cellDisplayValue(row[idx]);
    td.textContent = val;

    if (cellHasCompareError(row, idx, tipo, config, ctx)) {
      applyPlagasCellValidation(td, idx, row[idx], ctx, config);
    }

    tr.appendChild(td);
  });
}

function renderCompareTableRows(bodyRows, errorRows, visibleCols, tipo, config, ctx, loteIdx) {
  const groups = buildCompareRowGroups(errorRows, ctx.duplicadosCartilla || [], loteIdx);

  groups.forEach((group) => {
    const isDuplicateGroup = group.kind === "duplicate" && group.rows.length > 1;

    group.rows.forEach((row, rowIndex) => {
      const tr = document.createElement("tr");
      appendCompareRow(tr, row, visibleCols, tipo, config, ctx, {
        duplicateGroup: isDuplicateGroup,
        duplicateStart: isDuplicateGroup && rowIndex === 0
      });
      bodyRows.appendChild(tr);
    });
  });
}

export function renderComparePane({
  headerRow,
  bodyRows,
  headers,
  rows,
  tipo,
  config,
  stats,
  t,
  columnLabelsByIndex = {}
}) {
  renderCompareTable(headerRow, bodyRows, headers, rows, tipo, config, stats, t, columnLabelsByIndex);
}

function buildCompareChipList(items, htmlEscape) {
  return items
    .map((item) => `<span class="agv-mp-compare-card__chip">${htmlEscape(item)}</span>`)
    .join("");
}

function buildCompareWarnBlock(label, items, htmlEscape) {
  if (!items.length) return "";
  return `
    <div class="agv-mp-compare-card__warn-block">
      <span class="agv-mp-compare-card__warn-label">${htmlEscape(label)}</span>
      <div class="agv-mp-compare-card__chip-list">${buildCompareChipList(items, htmlEscape)}</div>
    </div>`;
}

export function buildCompareSummaryHtml(stats, t, htmlEscape) {
  const status = stats.hasIssues
    ? t("plagasEsparrago.statusWithIssues")
    : t("plagasEsparrago.statusOk");
  const statusClass = stats.hasIssues ? "agv-mp-compare-card__status--error" : "agv-mp-compare-card__status--ok";

  const metaBlocks = [
    buildCompareWarnBlock("Solo IPP", stats.soloEnIPP, htmlEscape),
    buildCompareWarnBlock("Solo ISP", stats.soloEnISP, htmlEscape),
    buildCompareWarnBlock("Dup IPP", stats.dupsIPP, htmlEscape),
    buildCompareWarnBlock("Dup ISP", stats.dupsISP, htmlEscape)
  ].filter(Boolean);

  const metaHtml = metaBlocks.length
    ? `<div class="agv-mp-compare-card__meta">${metaBlocks.join("")}</div>`
    : "";

  return `
    <div class="agv-mp-compare-card__head">
      <h3 class="agv-mp-compare-card__title">${htmlEscape(stats.fecha)} · IPP vs ISP</h3>
      <span class="agv-mp-compare-card__status ${statusClass}">${htmlEscape(status)}</span>
    </div>
    <div class="agv-mp-compare-card__body">
      <div class="agv-mp-compare-card__stats">
        <span class="agv-mp-compare-card__stat">
          <span class="agv-mp-compare-card__stat-label">IPP</span>
          <span class="agv-mp-compare-card__stat-value">${stats.rowsIPP.length}</span>
          <span class="agv-mp-compare-card__stat-unit">reg.</span>
        </span>
        <span class="agv-mp-compare-card__stat-divider" aria-hidden="true"></span>
        <span class="agv-mp-compare-card__stat">
          <span class="agv-mp-compare-card__stat-label">ISP</span>
          <span class="agv-mp-compare-card__stat-value">${stats.rowsISP.length}</span>
          <span class="agv-mp-compare-card__stat-unit">reg.</span>
        </span>
      </div>
      <p class="agv-mp-compare-card__errors">
        ${htmlEscape(t("plagasEsparrago.errorRowsCount", { count: stats.totalErrors }))}
      </p>
      ${metaHtml}
    </div>`;
}

function createCompareGridShell() {
  const grid = document.createElement("div");
  grid.className = "agv-mp-compare-grid";
  grid.innerHTML = `
    <div class="agv-mp-compare-pane agv-mp-compare-pane--ipp">
      <h4 class="agv-mp-compare-pane__title">IPP – Insp. Primarias Plagas</h4>
      <div class="agv-mp-table-scroll">
        <table class="agv-mp-table agv-mp-table--compare">
          <thead><tr class="agv-mp-compare-header-ipp"></tr></thead>
          <tbody class="agv-mp-compare-body-ipp"></tbody>
        </table>
      </div>
    </div>
    <div class="agv-mp-compare-pane agv-mp-compare-pane--isp">
      <h4 class="agv-mp-compare-pane__title">ISP – Insp. Secundaria Plagas</h4>
      <div class="agv-mp-table-scroll">
        <table class="agv-mp-table agv-mp-table--compare">
          <thead><tr class="agv-mp-compare-header-isp"></tr></thead>
          <tbody class="agv-mp-compare-body-isp"></tbody>
        </table>
      </div>
    </div>`;
  return grid;
}

export function mountCompareDateSection(parent, stats, headersByCartilla, config, t, columnLabelsByIndex = {}) {
  const section = document.createElement("section");
  section.className = "agv-mp-compare-date";

  const summary = document.createElement("div");
  summary.className = "agv-mp-compare-card";
  summary.innerHTML = buildCompareSummaryHtml(stats, t, (v) =>
    String(v)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
  );
  section.appendChild(summary);

  const grid = createCompareGridShell();
  section.appendChild(grid);

  renderComparePane({
    headerRow: grid.querySelector(".agv-mp-compare-header-ipp"),
    bodyRows: grid.querySelector(".agv-mp-compare-body-ipp"),
    headers: headersByCartilla.IPP || headersByCartilla.ISP || [],
    rows: stats.errorRowsIPP,
    tipo: "IPP",
    config,
    stats,
    t,
    columnLabelsByIndex
  });

  renderComparePane({
    headerRow: grid.querySelector(".agv-mp-compare-header-isp"),
    bodyRows: grid.querySelector(".agv-mp-compare-body-isp"),
    headers: headersByCartilla.ISP || headersByCartilla.IPP || [],
    rows: stats.errorRowsISP,
    tipo: "ISP",
    config,
    stats,
    t,
    columnLabelsByIndex
  });

  parent.appendChild(section);
  return section;
}

export function buildReviewAllTileHtml(item, t, htmlEscape) {
  const tileClass = item.hasIssues ? "agv-mp-tile--error" : "agv-mp-tile--ok";
  const badgeClass = item.hasIssues ? "agv-mp-tile__badge--error" : "agv-mp-tile__badge--ok";
  const estado = item.hasIssues ? t("plagasEsparrago.statusWithIssues") : t("plagasEsparrago.statusOk");
  return `
    <article class="agv-mp-tile ${tileClass}">
      <div class="agv-mp-tile__head">
        <span class="agv-mp-tile__date">${htmlEscape(item.fecha)}</span>
        <span class="agv-mp-tile__badge ${badgeClass}">${htmlEscape(estado)}</span>
      </div>
      <div class="agv-mp-tile__stats">
        <div class="agv-mp-tile__stat">
          <span class="agv-mp-tile__stat-val">${item.rowsIPP.length}</span>
          <span class="agv-mp-tile__stat-lbl">IPP</span>
        </div>
        <div class="agv-mp-tile__stat">
          <span class="agv-mp-tile__stat-val">${item.rowsISP.length}</span>
          <span class="agv-mp-tile__stat-lbl">ISP</span>
        </div>
        <div class="agv-mp-tile__stat">
          <span class="agv-mp-tile__stat-val">${item.totalErrors}</span>
          <span class="agv-mp-tile__stat-lbl">${t("plagasEsparrago.tileErrors")}</span>
        </div>
      </div>
    </article>`;
}

function buildReviewAllKpiGridHtml(items, t, htmlEscape) {
  const ok = items.filter((i) => !i.hasIssues).length;
  const bad = items.filter((i) => i.hasIssues).length;
  const totalErrors = items.reduce((sum, item) => sum + item.totalErrors, 0);
  const totalRows = items.reduce(
    (sum, item) => sum + item.rowsIPP.length + item.rowsISP.length,
    0
  );
  const avgRate = totalRows ? Math.round((totalErrors / totalRows) * 100) : 0;

  return `
      <div class="agv-mp-kpi-grid">
        <div class="agv-mp-kpi">
          <span class="agv-mp-kpi__icon agv-mp-kpi__icon--dates" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
          </span>
          <div class="agv-mp-kpi__body">
            <span class="agv-mp-kpi__value">${items.length}</span>
            <span class="agv-mp-kpi__label">${htmlEscape(t("plagasArandano.kpiDates"))}</span>
          </div>
        </div>
        <div class="agv-mp-kpi">
          <span class="agv-mp-kpi__icon agv-mp-kpi__icon--ok" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </span>
          <div class="agv-mp-kpi__body">
            <span class="agv-mp-kpi__value">${ok}</span>
            <span class="agv-mp-kpi__label">${htmlEscape(t("plagasArandano.kpiOk"))}</span>
          </div>
        </div>
        <div class="agv-mp-kpi">
          <span class="agv-mp-kpi__icon agv-mp-kpi__icon--error" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
          </span>
          <div class="agv-mp-kpi__body">
            <span class="agv-mp-kpi__value">${bad}</span>
            <span class="agv-mp-kpi__label">${htmlEscape(t("plagasArandano.kpiIssues"))}</span>
          </div>
        </div>
        <div class="agv-mp-kpi">
          <span class="agv-mp-kpi__icon agv-mp-kpi__icon--rows" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h10"/></svg>
          </span>
          <div class="agv-mp-kpi__body">
            <span class="agv-mp-kpi__value">${totalErrors}</span>
            <span class="agv-mp-kpi__label">${htmlEscape(t("plagasArandano.kpiErrorRows"))}</span>
          </div>
        </div>
      </div>
      <p class="agv-mp-dashboard__avg">${htmlEscape(t("plagasArandano.avgErrorRate", { pct: avgRate }))}</p>`;
}

export function mountReviewAllDashboard(container, items, headersByCartilla, config, t, htmlEscape, columnLabelsByIndex = {}) {
  const kpiHtml = buildReviewAllKpiGridHtml(items, t, htmlEscape);

  container.innerHTML = `
    <div class="agv-mp-dashboard">
      <div>
        <h3 class="agv-mp-dashboard__title">${htmlEscape(t("plagasEsparrago.summaryAllDates"))}</h3>
        <p class="agv-mp-dashboard__subtitle">${htmlEscape(t("plagasEsparrago.analysisByDate"))}</p>
      </div>
      ${kpiHtml}
      <div class="agv-mp-tile-grid">${items.map((item) => buildReviewAllTileHtml(item, t, htmlEscape)).join("")}</div>
      <div class="agv-mp-dashboard__details"></div>
    </div>`;

  const detailsEl = container.querySelector(".agv-mp-dashboard__details");
  const withIssues = items.filter((item) => item.hasIssues);
  if (!withIssues.length) {
    detailsEl.remove();
    return;
  }

  const title = document.createElement("h3");
  title.className = "agv-mp-dashboard__details-title";
  title.textContent = t("plagasEsparrago.errorsDetailHeading");
  detailsEl.appendChild(title);

  withIssues.forEach((stats) => {
    mountCompareDateSection(detailsEl, stats, headersByCartilla, config, t, columnLabelsByIndex);
  });
}
