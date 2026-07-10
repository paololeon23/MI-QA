/** Dashboard resumen todas las fechas — Plagas Palta (port mostrarResumenTodasFechas) */

import { renderNestedErrorTableHtml } from "./palta-plagas-table.js";

function buildReviewAllTileHtml(item, t, htmlEscape) {
  const tileClass = item.tieneErrores ? "agv-mp-tile--error" : "agv-mp-tile--ok";
  const badgeClass = item.tieneErrores ? "agv-mp-tile__badge--error" : "agv-mp-tile__badge--ok";
  const estado = item.tieneErrores
    ? t("plagasArandano.statusWithIssues")
    : t("plagasArandano.statusOk");
  const dupTxt = item.lotesDuplicados?.length
    ? `<p class="agv-mp-tile__dup">${htmlEscape(t("plagasArandano.duplicateLots"))}: ${htmlEscape(item.lotesDuplicados.join(", "))}</p>`
    : "";
  const pct = item.totalFilas ? Math.round((item.filasConError / item.totalFilas) * 100) : 0;

  return `
    <article class="agv-mp-tile ${tileClass}">
      <div class="agv-mp-tile__head">
        <span class="agv-mp-tile__date">${htmlEscape(item.fecha)}</span>
        <span class="agv-mp-tile__badge ${badgeClass}">${htmlEscape(estado)}</span>
      </div>
      <div class="agv-mp-tile__stats">
        <div class="agv-mp-tile__stat">
          <span class="agv-mp-tile__stat-val">${item.totalFilas}</span>
          <span class="agv-mp-tile__stat-lbl">${t("plagasArandano.tileRecords")}</span>
        </div>
        <div class="agv-mp-tile__stat">
          <span class="agv-mp-tile__stat-val">${item.filasConError}</span>
          <span class="agv-mp-tile__stat-lbl">${t("plagasArandano.tileErrors")}</span>
        </div>
        <div class="agv-mp-tile__stat">
          <span class="agv-mp-tile__stat-val">${pct}%</span>
          <span class="agv-mp-tile__stat-lbl">${t("plagasArandano.tileRate")}</span>
        </div>
      </div>
      ${dupTxt}
    </article>`;
}

function buildReviewAllKpiGridHtml(items, t, htmlEscape) {
  const ok = items.filter((i) => !i.tieneErrores).length;
  const bad = items.filter((i) => i.tieneErrores).length;
  const totalErrors = items.reduce((sum, item) => sum + item.filasConError, 0);
  const totalRows = items.reduce((sum, item) => sum + item.totalFilas, 0);
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

export function mountReviewAllDashboard(
  container,
  items,
  headers,
  config,
  t,
  htmlEscape,
  columnLabelsByIndex = {}
) {
  const kpiHtml = buildReviewAllKpiGridHtml(items, t, htmlEscape);

  container.innerHTML = `
    <div class="agv-mp-dashboard">
      <div>
        <h3 class="agv-mp-dashboard__title">${htmlEscape(t("plagasArandano.summaryAllDates"))}</h3>
        <p class="agv-mp-dashboard__subtitle">${htmlEscape(t("plagasArandano.analysisByDate"))}</p>
      </div>
      ${kpiHtml}
      <div class="agv-mp-tile-grid">${items.map((item) => buildReviewAllTileHtml(item, t, htmlEscape)).join("")}</div>
      <div class="agv-mp-dashboard__details"></div>
    </div>`;

  const detailsEl = container.querySelector(".agv-mp-dashboard__details");
  const withIssues = items.filter((item) => item.errorRows?.length);
  if (!withIssues.length) {
    detailsEl.remove();
    return;
  }

  const title = document.createElement("h3");
  title.className = "agv-mp-dashboard__details-title";
  title.textContent = t("plagasArandano.errorsDetailHeading");
  detailsEl.appendChild(title);

  withIssues.forEach((item) => {
    const section = document.createElement("section");
    section.className = "agv-mp-date-detail";
    section.innerHTML = `
      <header class="agv-mp-date-detail__head">
        <h4 class="agv-mp-date-detail__title">${htmlEscape(item.fecha)}</h4>
        <span class="agv-mp-date-detail__meta">${htmlEscape(
          t("plagasArandano.errorRowsCount", {
            errors: item.filasConError,
            total: item.totalFilas
          })
        )}</span>
      </header>
      ${renderNestedErrorTableHtml(item.errorRows, headers, config, columnLabelsByIndex, htmlEscape, t)}`;
    detailsEl.appendChild(section);
  });
}
