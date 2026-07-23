import { appConfig } from "../../../config/app.config.js";
import { AGV_MP_SHELL_IDS } from "../shared/cartilla-shell.ids.js";
import { CartillaShellUi } from "../shared/cartilla-shell.ui.js";
import { hydrateLucideIcons } from "../../../utils/lucide-icon.util.js";
import { i18nService } from "../../../services/i18n.service.js";
import { showMpDialog } from "../arandano-mp/arandano-mp-dialog.js";
import { cargarReglasDesdeRuta } from "../../../../../engine/rule-engine.js";
import { mergeValidacionesDesdeReglas } from "../../../../../engine/cartilla-rules.adapter.js";
import {
  buildColumnLabelsByIndex,
  CARTILLA,
  CONFIG_PATH,
  FECHA_COSECHA_IDX,
  FECHA_INSPECCION_IDX,
  MIN_FILAS,
  REGLAS_PATH,
  TOTAL_COLUMNAS
} from "./uva-plagas.config.js";
import {
  analyzeInspectionDate,
  buildMissingInspectionAlertHtml,
  cellDisplayValue,
  ejecutarValidacion,
  findRowsMissingInspectionDate,
  formatRowDates,
  isHarvestAfterInspection,
  limpiarMarcasValidacion,
  ordenarFechasDDMMYYYY,
  rowHasMarkedErrors
} from "./uva-plagas.validation.js";
import { mountReviewAllDashboard } from "./uva-plagas-compare.js";
import { writePlagasErrorsExport, writePlagasExportFile } from "./uva-plagas-export.js";
import { renderUvaPlagasTable, refreshUvaPlagasHeaderLabels } from "./uva-plagas-table.js";
import {
  createCartillaAnalysisController,
  headersToAnalysisColumns
} from "../shared/cartilla-analysis.js";

function t(key, vars = {}) {
  let text = i18nService.translate(key);
  Object.entries(vars).forEach(([name, value]) => {
    text = text.replace(`{{${name}}}`, String(value));
  });
  return text;
}

function htmlEscape(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function ensureXlsx() {
  if (window.XLSX?.read && window.XLSX?.utils) return true;
  showMpDialog({
    icon: "error",
    title: t("plagasArandano.error"),
    text: t("plagasArandano.errorXlsxLibrary")
  });
  return false;
}

function readSheetCell(sheet, filaJs, colJs) {
  const value = sheet[filaJs]?.[colJs];
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function majorityHarvestDate(rows, fechaIdx, cosechaIdx, fecha) {
  const dates = rows
    .filter((r) => cellDisplayValue(r[fechaIdx]) === fecha)
    .map((r) => cellDisplayValue(r[cosechaIdx]))
    .filter(Boolean);
  const conteo = {};
  dates.forEach((d) => {
    conteo[d] = (conteo[d] || 0) + 1;
  });
  const sorted = Object.entries(conteo).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] || "";
}

export class UvaPlagasService {
  constructor() {
    this.shell = null;
    this.config = null;
    this.reglas = null;
    this.columnLabelsByIndex = {};
    this.rawData = [];
    this.headers = [];
    this.processedData = [];
    this.excelCabecera = null;
    this.abortController = null;
  }

  async init(appRoot) {
    const version = appConfig.cacheBustingVersion;
    const [configRes, reglas] = await Promise.all([
      fetch(`${CONFIG_PATH}?v=${version}`),
      cargarReglasDesdeRuta(`${REGLAS_PATH}?v=${version}`)
    ]);
    if (!configRes.ok) throw new Error("No se pudieron cargar las reglas de Plagas Uva");
    const configBase = await configRes.json();
    this.reglas = reglas;
    this.config = mergeValidacionesDesdeReglas(configBase, reglas, {
      duplicateRuleTipo: "duplicado_en_fecha"
    });
    this.columnLabelsByIndex = buildColumnLabelsByIndex(reglas);

    this.shell = new CartillaShellUi({
      root: appRoot,
      ids: AGV_MP_SHELL_IDS,
      cssPrefix: "agv-mp",
      i18nPrefix: "plagasUva"
    });
    this.shell.cacheDom();
    this.cartillaAnalysis = createCartillaAnalysisController({
      getRoot: () => this.shell?.root,
      hostSelector: "#agv-mp-cartilla-analysis",
      showDialog: (opts) => showMpDialog(opts),
      t,
      htmlEscape
    });
    this.bindEvents();
    this.shell.resetDashboard();
    this.shell.renderExcelInsightEmpty();
    this.shell.setLiveStatus(false);
    hydrateLucideIcons(appRoot);
  }

  bindEvents() {
    this.abortController?.abort();
    this.abortController = new AbortController();
    const { signal } = this.abortController;
    const refs = this.shell.refs;

    refs.fileInput?.addEventListener("change", (e) => this.onFileSelected(e), { signal });
    refs.inspectionSelect?.addEventListener("change", () => this.onInspectionDateChange(), { signal });
    refs.runReviewBtn?.addEventListener("click", () => this.onRunReview(), { signal });
    refs.exportBtn?.addEventListener("click", () => this.onExport(), { signal });
    refs.clearBtn?.addEventListener("click", () => this.onClear(), { signal });
    refs.reviewAllBtn?.addEventListener("click", () => this.onReviewAll(), { signal });
    refs.exportExcelErroresBtn?.addEventListener("click", () => this.onExportErrors(), { signal });
  }

  hasLoadedData() {
    return this.rawData.length > 0;
  }

  getAllFechas() {
    const fechaIdx = this.config.filtro_principal?.indice_js ?? FECHA_INSPECCION_IDX;
    return ordenarFechasDDMMYYYY([
      ...new Set(this.rawData.map((r) => cellDisplayValue(r[fechaIdx])).filter(Boolean))
    ]);
  }

  syncButtons() {
    const refs = this.shell.refs;
    const fecha = refs.inspectionSelect?.value;
    const hasData = this.hasLoadedData();
    if (refs.runReviewBtn) refs.runReviewBtn.disabled = !hasData || !fecha;
    if (refs.exportBtn) refs.exportBtn.disabled = !hasData || !this.processedData.length;
    if (refs.reviewAllBtn) refs.reviewAllBtn.disabled = !hasData;
    if (refs.exportExcelErroresBtn) refs.exportExcelErroresBtn.disabled = !hasData;
  }

  resetDataState() {
    this.rawData = [];
    this.headers = [];
    this.processedData = [];
    this.excelCabecera = null;
  }

  parseExcelCabecera(sheet) {
    const cfg = this.config.cabecera_excel;
    const meta = { titulo: readSheetCell(sheet, cfg.titulo.fila_js, cfg.titulo.col_js) };
    cfg.campos.forEach((field) => {
      meta[field.clave] = readSheetCell(sheet, field.fila_js, field.col_js);
    });
    meta.grupo = meta.grupo || CARTILLA;
    return meta;
  }

  validateFileSheet(data, fileName) {
    const v = this.config.validacion_archivo;
    const cartillaRaw = readSheetCell(data, v.fila_grupo_js, v.col_grupo_js).toUpperCase();
    const estado = readSheetCell(data, v.fila_estado_js, v.col_estado_js).toUpperCase();

    if (cartillaRaw !== v.cartilla_esperada) {
      return {
        ok: false,
        html: this.fileErrorCard(fileName, `Cartilla debe ser ${v.cartilla_esperada}`)
      };
    }
    if (estado !== v.estado_esperado) {
      return { ok: false, html: this.fileErrorCard(fileName, "No está ENVIADA") };
    }
    if (data.length < MIN_FILAS) {
      return {
        ok: false,
        html: this.fileErrorCard(fileName, `Debe tener mínimo ${MIN_FILAS} filas (tiene ${data.length})`)
      };
    }
    const headerRow = data[this.config.fila_encabezados_js] || [];
    if (headerRow.length !== TOTAL_COLUMNAS) {
      return {
        ok: false,
        html: this.fileErrorCard(
          fileName,
          `Debe tener ${TOTAL_COLUMNAS} columnas (tiene ${headerRow.length})`
        )
      };
    }
    return { ok: true };
  }

  fileErrorCard(name, reason) {
    return `
      <div class="agv-mp-file-error-card">
        <span class="agv-mp-file-error-card__name">${htmlEscape(name)}</span>
        <small>${htmlEscape(reason)}</small>
      </div>`;
  }

  async onFileSelected(event) {
    const file = (event.target.files || [])[0];
    if (!file) return;
    if (!ensureXlsx()) return;

    this.resetDataState();
    this.resetResultsUi();

    try {
      const buffer = await file.arrayBuffer();
      const wb = window.XLSX.read(buffer, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = window.XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
      const check = this.validateFileSheet(data, file.name);

      if (!check.ok) {
        await showMpDialog({
          icon: "error",
          title: t("plagasArandano.error"),
          html: `<div class="agv-mp-dialog__html--stacked">${check.html}</div>`,
          wide: true
        });
        if (this.shell.refs.fileInput) this.shell.refs.fileInput.value = "";
        return;
      }

      this.headers = data[this.config.fila_encabezados_js] || [];
      this.rawData = data
        .slice(this.config.fila_inicio_datos_js)
        .filter((row) => row.some((c) => String(c ?? "").trim()))
        .map((row) => {
          const copy = [...row];
          formatRowDates(copy, this.config);
          return copy;
        });

      const tipoFila = String(this.rawData[0]?.[1] ?? "").trim().toUpperCase();
      if (tipoFila !== CARTILLA) {
        await showMpDialog({
          icon: "error",
          title: t("plagasArandano.error"),
          text: "Este archivo no corresponde a Plagas Uva (PMPU)."
        });
        if (this.shell.refs.fileInput) this.shell.refs.fileInput.value = "";
        return;
      }

      this.excelCabecera = this.parseExcelCabecera(data);

      showMpDialog({
        icon: "success",
        title: "Excel cargado",
        html: `Cartilla <b>${htmlEscape(this.config?.cartilla || "PMPU")}</b> · <b>${this.rawData.length}</b> registros · <b>${this.config?.total_columnas || 0}</b> columnas`,
        timer: 1800,
        showConfirmButton: false
      });

      const sinFechaInspeccion = findRowsMissingInspectionDate(this.rawData, this.config);
      if (sinFechaInspeccion.length) {
        await showMpDialog({
          icon: "warning",
          title: t("plagasUva.missingInspectionTitle"),
          html: `<div class="agv-mp-dialog__html--scroll">${buildMissingInspectionAlertHtml(sinFechaInspeccion)}</div>`,
          wide: true
        });
      }

      this.populateFechasSelect();
      this.shell.setLiveStatus(true);
      this.renderExcelInsight();
    } catch {
      await showMpDialog({
        icon: "error",
        title: t("plagasArandano.error"),
        text: "Error al leer el contenido del Excel"
      });
      if (this.shell.refs.fileInput) this.shell.refs.fileInput.value = "";
    }

    this.syncButtons();
  }

  populateFechasSelect() {
    const fechas = this.getAllFechas();
    const sel = this.shell.refs.inspectionSelect;
    if (!sel) return;
    sel.innerHTML = `<option value="" disabled selected>${t("plagasUva.selectDate")}</option>`;
    fechas.forEach((f) => sel.add(new Option(f, f)));
    sel.disabled = fechas.length === 0;

    const cosechaSel = this.shell.refs.cosechaSelect;
    if (cosechaSel) {
      cosechaSel.innerHTML = `<option value="" selected>${htmlEscape(t("plagasUva.autoDate"))}</option>`;
      cosechaSel.disabled = true;
      cosechaSel.classList.remove("agv-mp-input--warning");
    }
  }

  syncHarvestDateField() {
    const fecha = this.shell.refs.inspectionSelect?.value;
    const cosechaSel = this.shell.refs.cosechaSelect;
    if (!cosechaSel) return;

    if (!fecha) {
      cosechaSel.innerHTML = `<option value="" selected>${htmlEscape(t("plagasUva.autoDate"))}</option>`;
      cosechaSel.disabled = true;
      cosechaSel.classList.remove("agv-mp-input--warning");
      return;
    }

    const fechaIdx = this.config.filtro_principal?.indice_js ?? FECHA_INSPECCION_IDX;
    const cosechaIdx = this.config.fecha_cosecha?.indice_js ?? FECHA_COSECHA_IDX;
    const cosecha = majorityHarvestDate(this.rawData, fechaIdx, cosechaIdx, fecha);

    cosechaSel.replaceChildren();
    const opt = document.createElement("option");
    opt.value = cosecha;
    opt.textContent = cosecha || t("plagasUva.autoDate");
    opt.selected = true;
    cosechaSel.appendChild(opt);
    cosechaSel.disabled = true;

    if (cosecha && isHarvestAfterInspection(cosecha, fecha)) {
      cosechaSel.classList.add("agv-mp-input--warning");
      showMpDialog({
        icon: "warning",
        title: t("plagasArandano.attention"),
        text: t("plagasArandano.harvestAfterInspection")
      });
    } else {
      cosechaSel.classList.remove("agv-mp-input--warning");
    }
  }

  onInspectionDateChange() {
    this.syncHarvestDateField();
    this.resetResultsUi();
    this.syncButtons();
  }

  getRowsForDate(fecha) {
    const fechaIdx = this.config.filtro_principal?.indice_js ?? FECHA_INSPECCION_IDX;
    return this.rawData
      .filter((r) => cellDisplayValue(r[fechaIdx]) === fecha)
      .map((r) => [...r]);
  }

  updateResultsHeader(errorCount, totalRows, fecha) {
    const refs = this.shell.refs;
    const hasErrors = errorCount > 0;

    refs.resultsSection?.classList.remove("agv-mp-results--ok", "agv-mp-results--errors");
    refs.resultsSection?.classList.add(hasErrors ? "agv-mp-results--errors" : "agv-mp-results--ok");

    if (refs.resultsTitleEl) {
      refs.resultsTitleEl.textContent = hasErrors
        ? t("plagasUva.errorRowsTitle")
        : t("plagasArandano.allCorrect");
    }
    if (refs.resultsSubtitleEl) {
      refs.resultsSubtitleEl.textContent = fecha
        ? t("plagasArandano.resultsInspectionDate", { date: fecha })
        : "";
    }
    if (refs.resultsIconEl) {
      refs.resultsIconEl.innerHTML = hasErrors
        ? '<i data-lucide="triangle-alert"></i>'
        : '<i data-lucide="circle-check"></i>';
    }
    if (refs.totalFilasDiv) {
      refs.totalFilasDiv.textContent = hasErrors
        ? t("plagasArandano.resultsErrorSummary", { errors: errorCount, total: totalRows })
        : t("plagasArandano.totalRecords", { count: totalRows });
    }
    hydrateLucideIcons(this.shell.root);
  }

  async onRunReview() {
    const fecha = this.shell.refs.inspectionSelect?.value;
    if (!fecha) return;

    this.hideResumenTodas();
    const rows = this.getRowsForDate(fecha);
    limpiarMarcasValidacion(rows);
    const { lotesDuplicados } = ejecutarValidacion(rows, this.config);
    this.processedData = rows;

    const syncContext = { duplicadosLote: lotesDuplicados };
    const { errorCount, totalRows } = renderUvaPlagasTable({
      headerRow: this.shell.refs.resultsHeader,
      bodyRows: this.shell.refs.resultsBody,
      headers: this.headers,
      rows,
      config: this.config,
      syncContext,
      columnLabelsByIndex: this.columnLabelsByIndex,
      t
    });

    this.updateResultsHeader(errorCount, totalRows, fecha);

    if (this.shell.refs.resultsTable) {
      this.shell.refs.resultsTable.classList.add("agv-mp-table--uva");
      this.shell.refs.resultsTable.hidden = false;
    }
    if (this.shell.refs.resultsSection) {
      this.shell.refs.resultsSection.hidden = false;
      this.shell.refs.resultsSection.classList.add("is-visible");
    }

    const filasConError = rows.filter((row) => rowHasMarkedErrors(row));
    this.cartillaAnalysis?.present({
      rows,
      filasConError,
      errorMap: null,
      duplicateLotes: new Set(lotesDuplicados || []),
      colLoteJs: 9,
      columns: headersToAnalysisColumns(this.headers),
      cartilla: CARTILLA,
      fechaLabel: fecha || "—"
    });

    this.syncButtons();
    hydrateLucideIcons(this.shell.root);
    this.shell.refs.resultsSection?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  onReviewAll() {
    if (!this.hasLoadedData()) return;
    const fechas = this.getAllFechas();
    if (!fechas.length) {
      showMpDialog({
        icon: "info",
        title: t("plagasArandano.noDates"),
        text: t("plagasArandano.noDatesText")
      });
      return;
    }

    const items = fechas.map((fecha) => analyzeInspectionDate(fecha, this.rawData, this.config));

    const el = this.shell.refs.resumenTodasFechasEl;
    if (el) {
      mountReviewAllDashboard(
        el,
        items,
        this.headers,
        this.config,
        t,
        htmlEscape,
        this.columnLabelsByIndex
      );
      el.hidden = false;
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    this.resetResultsUi();
    hydrateLucideIcons(this.shell.root);
    showMpDialog({
      icon: "success",
      title: t("plagasArandano.analysisComplete"),
      text: t("plagasArandano.analysisCompleteText", { count: items.length }),
      timer: 2200,
      showConfirmButton: false
    });
    this.syncButtons();
  }

  onExportErrors() {
    if (!this.hasLoadedData() || !ensureXlsx()) return;
    if (
      writePlagasErrorsExport({
        rows: this.rawData,
        headers: this.headers,
        config: this.config
      })
    ) {
      showMpDialog({
        icon: "success",
        title: t("plagasArandano.exportGenerated"),
        text: t("plagasArandano.exportGeneratedHighlight"),
        timer: 2200,
        showConfirmButton: false
      });
    }
  }

  renderExcelInsight() {
    const { excelInsightEl } = this.shell.refs;
    if (!excelInsightEl) return;
    const meta = this.excelCabecera;
    const p = (part) => this.shell.cls(part);

    if (!meta) {
      this.shell.renderExcelInsightEmpty();
      return;
    }

    const ringRadius = 42;
    const ringCircumference = 2 * Math.PI * ringRadius;
    const grupo = meta.grupo || CARTILLA;
    const estado = meta.estado || "—";
    const reportTitle = meta.titulo || "";

    excelInsightEl.className = `${p("excel-insight")} ${p("excel-insight")}--loaded`;
    excelInsightEl.innerHTML = `
      ${reportTitle ? `<p class="${p("excel-insight__report")}">${htmlEscape(reportTitle)}</p>` : ""}
      <div class="${p("excel-insight__body")}">
        <div class="${p("excel-insight__top")}">
          <div class="${p("excel-insight__primary")}">
            <div class="${p("excel-insight__stat")} ${p("excel-insight__stat")}--primary">
              <span class="${p("excel-insight__stat-label")}">${htmlEscape(t("plagasArandano.metaCompany"))}</span>
              <strong>${htmlEscape(meta.empresa || "—")}</strong>
            </div>
            <div class="${p("excel-insight__stat")} ${p("excel-insight__stat")}--primary">
              <span class="${p("excel-insight__stat-label")}">${htmlEscape(t("plagasArandano.metaClient"))}</span>
              <strong>${htmlEscape(meta.mandante || "—")}</strong>
            </div>
          </div>
          <div class="${p("excel-insight__ring")}" aria-hidden="true">
            <svg viewBox="0 0 100 100" shape-rendering="geometricPrecision">
              <defs>
                <linearGradient id="uvaPlagasInsightRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#5eb8d9"></stop>
                  <stop offset="100%" stop-color="#22c55e"></stop>
                </linearGradient>
              </defs>
              <circle class="${p("excel-insight__ring-glow")}" cx="50" cy="50" r="${ringRadius}"></circle>
              <circle class="${p("excel-insight__ring-track")}" cx="50" cy="50" r="${ringRadius}"></circle>
              <circle class="${p("excel-insight__ring-value")}" cx="50" cy="50" r="${ringRadius}" stroke-dasharray="${ringCircumference}" stroke-dashoffset="0"></circle>
            </svg>
            <div class="${p("excel-insight__ring-label")}">
              <strong>${htmlEscape(grupo)}</strong>
              <span>${htmlEscape(t("plagasArandano.metaGroup"))}</span>
            </div>
          </div>
        </div>
        <div class="${p("excel-insight__stats")}">
          <div class="${p("excel-insight__stat")}">
            <span class="${p("excel-insight__stat-label")}">${htmlEscape(t("plagasArandano.metaCrop"))}</span>
            <strong>${htmlEscape(meta.cultivo || "—")}</strong>
          </div>
          <div class="${p("excel-insight__stat")} ${p("excel-insight__stat")}--status">
            <span class="${p("excel-insight__stat-label")}">${htmlEscape(t("plagasArandano.metaStatus"))}</span>
            <strong>${htmlEscape(estado)}</strong>
          </div>
        </div>
      </div>`;
    hydrateLucideIcons(excelInsightEl);
  }

  renderExportFechaCards(fechas, fechaActual) {
    return `
      <div class="agv-mp-dialog__fechas">
        ${fechas
          .map((f) => {
            const esActual = f === fechaActual;
            return `
            <div class="agv-mp-dialog__fecha-card${esActual ? " agv-mp-dialog__fecha-card--actual" : " agv-mp-dialog__fecha-card--removable"}">
              <span class="agv-mp-dialog__fecha-text">${htmlEscape(f)}</span>
              ${
                esActual
                  ? ""
                  : `<button type="button" class="agv-mp-dialog__fecha-delete" data-fecha="${htmlEscape(f)}" aria-label="${htmlEscape(t("plagasArandano.removeDate"))}">
                      <i data-lucide="x" aria-hidden="true"></i>
                    </button>`
              }
            </div>`;
          })
          .join("")}
      </div>`;
  }

  async onExport() {
    const fechaActual = this.shell.refs.inspectionSelect?.value;
    if (!this.processedData.length || !fechaActual) {
      showMpDialog({
        icon: "error",
        title: t("plagasArandano.error"),
        text: t("plagasUva.noExportData")
      });
      return;
    }

    const fechaIdx = this.config.filtro_principal?.indice_js ?? FECHA_INSPECCION_IDX;
    let fechasDisponibles = this.getAllFechas();

    const buildExportHtml = () => `
      <div class="agv-mp-dialog__export">
        <div class="agv-mp-dialog__export-meta">
          <span class="agv-mp-dialog__export-label">${htmlEscape(t("plagasArandano.exportReviewDate"))}</span>
          <strong class="agv-mp-dialog__export-value">${htmlEscape(fechaActual)}</strong>
        </div>
        <div class="agv-mp-dialog__export-section">
          <span class="agv-mp-dialog__export-label">${htmlEscape(t("plagasArandano.exportJoinDates"))}</span>
          ${this.renderExportFechaCards(fechasDisponibles, fechaActual)}
        </div>
      </div>`;

    const result = await new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.className = "agv-mp-dialog-overlay";
      overlay.innerHTML = `
        <div class="agv-mp-dialog agv-mp-dialog--wide">
          <h3 class="agv-mp-dialog__title">${htmlEscape(t("plagasArandano.exportTitle"))}</h3>
          <div class="agv-mp-dialog__html" id="agv-uva-plagas-export-body">${buildExportHtml()}</div>
          <div class="agv-mp-dialog__actions">
            <button type="button" class="agv-mp-dialog__btn agv-mp-dialog__btn--primary" data-action="single">${htmlEscape(t("plagasArandano.exportThisDate"))}</button>
            <button type="button" class="agv-mp-dialog__btn agv-mp-dialog__btn--secondary" data-action="merge">${htmlEscape(t("plagasArandano.exportJoinSelected"))}</button>
            <button type="button" class="agv-mp-dialog__btn agv-mp-dialog__btn--ghost" data-action="cancel">${htmlEscape(t("plagasArandano.cancel"))}</button>
          </div>
        </div>`;

      const bodyEl = overlay.querySelector("#agv-uva-plagas-export-body");
      const refreshExportDialog = () => {
        bodyEl.innerHTML = buildExportHtml();
        hydrateLucideIcons(overlay);
      };

      overlay.addEventListener("click", (e) => {
        const removeBtn = e.target.closest(".agv-mp-dialog__fecha-delete");
        if (removeBtn) {
          fechasDisponibles = fechasDisponibles.filter((x) => x !== removeBtn.dataset.fecha);
          refreshExportDialog();
          return;
        }
        const btn = e.target.closest("[data-action]");
        if (!btn) {
          if (e.target === overlay) {
            overlay.remove();
            resolve("cancel");
          }
          return;
        }
        overlay.remove();
        resolve(btn.dataset.action);
      });

      document.body.appendChild(overlay);
      hydrateLucideIcons(overlay);
    });

    if (result === "single") {
      writePlagasExportFile(
        this.processedData,
        this.headers,
        `Export_Plaga_Uva_${String(fechaActual).replaceAll("/", "-")}.xlsx`
      );
    } else if (result === "merge") {
      const rows = this.rawData.filter((r) =>
        fechasDisponibles.includes(cellDisplayValue(r[fechaIdx]))
      );
      writePlagasExportFile(rows, this.headers, "Export_Plaga_Uva_Fechas_Unidas.xlsx");
    }
  }

  hideResumenTodas() {
    const el = this.shell.refs.resumenTodasFechasEl;
    if (el) {
      el.innerHTML = "";
      el.hidden = true;
    }
  }

  resetResultsUi() {
    const refs = this.shell.refs;
    if (refs.resultsHeader) refs.resultsHeader.replaceChildren();
    if (refs.resultsBody) refs.resultsBody.replaceChildren();
    if (refs.resultsTable) refs.resultsTable.hidden = true;
    if (refs.resultsSection) {
      refs.resultsSection.hidden = true;
      refs.resultsSection.classList.remove("is-visible", "agv-mp-results--ok", "agv-mp-results--errors");
    }
    if (refs.totalFilasDiv) refs.totalFilasDiv.textContent = "";
    this.processedData = [];
    this.cartillaAnalysis?.clear();
  }

  onClear() {
    this.resetDataState();
    this.resetResultsUi();
    this.hideResumenTodas();
    if (this.shell.refs.fileInput) this.shell.refs.fileInput.value = "";
    this.populateFechasSelect();
    this.shell.setLiveStatus(false);
    this.shell.renderExcelInsightEmpty();
    this.syncButtons();
    showMpDialog({
      icon: "success",
      title: t("plagasArandano.cleared"),
      text: t("plagasArandano.clearedText"),
      timer: 1000,
      showConfirmButton: false
    });
  }

  onLanguageChange() {
    refreshUvaPlagasHeaderLabels(
      this.shell?.refs?.resultsHeader,
      this.headers,
      this.columnLabelsByIndex,
      this.config
    );
  }

  destroy() {
    this.abortController?.abort();
    this.abortController = null;
    this.shell = null;
  }
}
