import { appConfig } from "../../../config/app.config.js";
import { AGV_MP_SHELL_IDS } from "../shared/cartilla-shell.ids.js";
import { CartillaShellUi } from "../shared/cartilla-shell.ui.js";
import { hydrateLucideIcons } from "../../../utils/lucide-icon.util.js";
import { i18nService } from "../../../services/i18n.service.js";
import { showMpDialog } from "../arandano-mp/arandano-mp-dialog.js";
import {
  analyzeDateComparison,
  buildDuplicateAlertHtml,
  cellDisplayValue,
  collectLotes,
  findDuplicates
} from "./esparrago-plagas.validation.js";
import {
  buildCompareSummaryHtml,
  mountReviewAllDashboard,
  renderComparePane
} from "./esparrago-plagas-compare.js";
import { writePlagasExportFile, writePlagasErrorsExport } from "./esparrago-plagas-export.js";
import { buildColumnLabelsByIndex, REGLAS_PATH } from "./esparrago-plagas-rules.helper.js";
import { cargarReglasDesdeRuta } from "../../../../../engine/rule-engine.js";
import { mergeValidacionesDesdeReglas } from "../../../../../engine/cartilla-rules.adapter.js";

const CONFIG_PATH = "presentation/data/plagas-esparrago-validaciones.json";
const CARTILLA_ORDER = ["IPP", "ISP"];
const LOTE_IDX = 9;
const FECHA_IDX = 76;

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

export class EsparragoPlagasService {
  constructor() {
    this.shell = null;
    this.config = null;
    this.reglas = null;
    this.columnLabelsByIndex = {};
    this.rawDataByCartilla = { IPP: [], ISP: [] };
    this.headersByCartilla = { IPP: [], ISP: [] };
    this.excelCabeceraByCartilla = { IPP: null, ISP: null };
    this.abortController = null;
  }

  async init(appRoot) {
    const version = appConfig.cacheBustingVersion;
    const [configRes, reglas] = await Promise.all([
      fetch(`${CONFIG_PATH}?v=${version}`),
      cargarReglasDesdeRuta(`${REGLAS_PATH}?v=${version}`)
    ]);
    if (!configRes.ok) throw new Error("No se pudieron cargar las reglas de Plagas Espárrago");
    const configBase = await configRes.json();
    this.reglas = reglas;
    this.config = mergeValidacionesDesdeReglas(configBase, reglas, {
      duplicateRuleTipo: "duplicado_en_cartilla",
      preserveRuleTipos: ["cruce_ipp_isp"]
    });
    this.columnLabelsByIndex = buildColumnLabelsByIndex(reglas);

    this.shell = new CartillaShellUi({
      root: appRoot,
      ids: AGV_MP_SHELL_IDS,
      cssPrefix: "agv-mp",
      i18nPrefix: "plagasEsparrago"
    });
    this.shell.cacheDom();
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

    refs.fileInput?.setAttribute("multiple", "multiple");
    refs.fileInput?.addEventListener("change", (e) => this.onFilesSelected(e), { signal });
    refs.inspectionTypeSelect?.addEventListener("change", () => this.onCartillaChange(), { signal });
    refs.inspectionSelect?.addEventListener("change", () => this.onInspectionDateChange(), { signal });
    refs.runReviewBtn?.addEventListener("click", () => this.onRunReview(), { signal });
    refs.exportBtn?.addEventListener("click", () => this.onExport(), { signal });
    refs.clearBtn?.addEventListener("click", () => this.onClear(), { signal });
    refs.reviewAllBtn?.addEventListener("click", () => this.onReviewAll(), { signal });
    refs.exportExcelErroresBtn?.addEventListener("click", () => this.onExportErrors(), { signal });
  }

  hasLoadedData() {
    return CARTILLA_ORDER.some((c) => this.rawDataByCartilla[c]?.length > 0);
  }

  getAllFechas() {
    const set = new Set();
    CARTILLA_ORDER.forEach((cartilla) => {
      this.rawDataByCartilla[cartilla].forEach((row) => {
        const f = cellDisplayValue(row[FECHA_IDX]);
        if (f) set.add(f);
      });
    });
    return [...set].sort();
  }

  syncButtons() {
    const refs = this.shell.refs;
    const tipo = refs.inspectionTypeSelect?.value;
    const fecha = refs.inspectionSelect?.value;
    const hasData = this.hasLoadedData();
    const hasCartilla = Boolean(tipo && this.rawDataByCartilla[tipo]?.length);
    if (refs.runReviewBtn) refs.runReviewBtn.disabled = !hasData || !fecha;
    if (refs.exportBtn) refs.exportBtn.disabled = !hasCartilla || !fecha;
    if (refs.reviewAllBtn) refs.reviewAllBtn.disabled = !hasData;
    if (refs.exportExcelErroresBtn) refs.exportExcelErroresBtn.disabled = !hasData;
  }

  resetDataState() {
    this.rawDataByCartilla = { IPP: [], ISP: [] };
    this.headersByCartilla = { IPP: [], ISP: [] };
    this.excelCabeceraByCartilla = { IPP: null, ISP: null };
  }

  parseExcelCabecera(sheet, cartilla) {
    const cfg = this.config.cabecera_excel;
    const meta = { titulo: readSheetCell(sheet, cfg.titulo.fila_js, cfg.titulo.col_js) };
    cfg.campos.forEach((field) => {
      meta[field.clave] = readSheetCell(sheet, field.fila_js, field.col_js);
    });
    meta.grupo = meta.grupo || cartilla;
    return meta;
  }

  validateFileSheet(data, fileName) {
    const v = this.config.validacion_archivo;
    const cartillaRaw = readSheetCell(data, v.fila_grupo_js, v.col_grupo_js).toUpperCase();
    const estado = readSheetCell(data, v.fila_estado_js, v.col_estado_js).toUpperCase();

    if (!v.cartillas_permitidas.includes(cartillaRaw)) {
      return { ok: false, html: this.fileErrorCard(fileName, "No es cartilla IPP/ISP") };
    }
    if (estado !== v.estado_esperado) {
      return { ok: false, html: this.fileErrorCard(fileName, "No está ENVIADA") };
    }
    return { ok: true, cartilla: cartillaRaw };
  }

  fileErrorCard(name, reason) {
    return `
      <div class="agv-mp-file-error-card">
        <span class="agv-mp-file-error-card__name">${htmlEscape(name)}</span>
        <small>${htmlEscape(reason)}</small>
      </div>`;
  }

  async onFilesSelected(event) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    if (!ensureXlsx()) return;

    this.resetDataState();
    this.resetResultsUi();

    let archivosConError = [];
    let archivosProcesados = 0;

    for (const file of files) {
      try {
        const buffer = await file.arrayBuffer();
        const wb = window.XLSX.read(buffer, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = window.XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
        const check = this.validateFileSheet(data, file.name);
        if (!check.ok) {
          archivosConError.push(check.html);
          continue;
        }
        const cartilla = check.cartilla;
        this.headersByCartilla[cartilla] = data[this.config.fila_encabezados_js] || [];
        this.rawDataByCartilla[cartilla] = data
          .slice(this.config.fila_inicio_datos_js)
          .filter((row) => row.some((c) => String(c ?? "").trim()));
        this.excelCabeceraByCartilla[cartilla] = this.parseExcelCabecera(data, cartilla);
        archivosProcesados += 1;
      } catch {
        archivosConError.push(this.fileErrorCard(file.name, "Error al leer el contenido del Excel"));
      }
    }

    if (archivosConError.length) {
      await showMpDialog({
        icon: archivosProcesados > 0 ? "warning" : "error",
        title: archivosProcesados > 0 ? t("plagasEsparrago.partialLoadTitle") : t("plagasEsparrago.fileErrorTitle"),
        html: `<div class="agv-mp-dialog__html--stacked"><p>${t("plagasEsparrago.partialLoadLead")}</p>${archivosConError.join("")}</div>`,
        wide: true
      });
    } else if (archivosProcesados > 0) {
      const cartillas = CARTILLA_ORDER.filter((c) => this.rawDataByCartilla[c]?.length);
      const totalRows = cartillas.reduce(
        (sum, cartilla) => sum + (this.rawDataByCartilla[cartilla]?.length || 0),
        0
      );
      showMpDialog({
        icon: "success",
        title: "Excel cargado",
        html: `Cartilla(s) <b>${htmlEscape(cartillas.join(", "))}</b> · <b>${totalRows}</b> registros · <b>${this.config?.total_columnas || 0}</b> columnas`,
        timer: 1800,
        showConfirmButton: false
      });
    }

    if (archivosProcesados > 0) {
      this.populateCartillaSelect();
      this.shell.setLiveStatus(true);
      this.renderExcelInsight();
    } else if (this.shell.refs.fileInput) {
      this.shell.refs.fileInput.value = "";
    }
    this.syncButtons();
  }

  populateCartillaSelect() {
    const sel = this.shell.refs.inspectionTypeSelect;
    if (!sel) return;
    sel.innerHTML = `<option value="" disabled selected>${t("plagasEsparrago.selectTypeOption")}</option>`;
    let count = 0;
    CARTILLA_ORDER.forEach((k) => {
      if (this.rawDataByCartilla[k]?.length) {
        sel.add(new Option(k, k));
        count += 1;
      }
    });
    sel.disabled = count === 0;
    this.populateFechasSelect();
  }

  populateFechasSelect() {
    const fechas = this.getAllFechas();
    const sel = this.shell.refs.inspectionSelect;
    if (sel) {
      sel.innerHTML = `<option value="" disabled selected>${t("plagasEsparrago.selectDate")}</option>`;
      fechas.forEach((f) => sel.add(new Option(f, f)));
      sel.disabled = fechas.length === 0;
    }
  }

  onCartillaChange() {
    const tipo = this.shell.refs.inspectionTypeSelect?.value;
    if (!tipo) return;
    this.resetResultsUi();
    this.renderExcelInsight();
    this.syncButtons();
  }

  onInspectionDateChange() {
    this.resetResultsUi();
    this.syncButtons();
  }

  renderCompareView(stats) {
    const root = this.shell.root;
    const summaryEl = root.querySelector("#agv-mp-compare-summary");
    const refs = this.shell.refs;
    if (summaryEl) {
      summaryEl.innerHTML = `<div class="agv-mp-compare-card">${buildCompareSummaryHtml(stats, t, htmlEscape)}</div>`;
    }

    renderComparePane({
      headerRow: root.querySelector("#agv-mp-compare-header-ipp"),
      bodyRows: root.querySelector("#agv-mp-compare-body-ipp"),
      headers: this.headersByCartilla.IPP || this.headersByCartilla.ISP || [],
      rows: stats.errorRowsIPP,
      tipo: "IPP",
      config: this.config,
      stats,
      t,
      columnLabelsByIndex: this.columnLabelsByIndex
    });

    renderComparePane({
      headerRow: root.querySelector("#agv-mp-compare-header-isp"),
      bodyRows: root.querySelector("#agv-mp-compare-body-isp"),
      headers: this.headersByCartilla.ISP || this.headersByCartilla.IPP || [],
      rows: stats.errorRowsISP,
      tipo: "ISP",
      config: this.config,
      stats,
      t,
      columnLabelsByIndex: this.columnLabelsByIndex
    });

    if (refs.resultsSection) {
      refs.resultsSection.hidden = false;
      refs.resultsSection.removeAttribute("hidden");
      refs.resultsSection.classList.add("is-visible");
    }
    if (refs.resumenTodasFechasEl) {
      refs.resumenTodasFechasEl.hidden = true;
      refs.resumenTodasFechasEl.innerHTML = "";
    }
  }

  getRowsForDate(cartilla, fecha) {
    return (this.rawDataByCartilla[cartilla] || []).filter(
      (r) => cellDisplayValue(r[FECHA_IDX]) === fecha
    );
  }

  getLoteSyncContext(fecha) {
    const lotesIPP = collectLotes(this.getRowsForDate("IPP", fecha), LOTE_IDX);
    const lotesISP = collectLotes(this.getRowsForDate("ISP", fecha), LOTE_IDX);
    return {
      lotesIPP,
      lotesISP,
      dupsIPP: findDuplicates(lotesIPP),
      dupsISP: findDuplicates(lotesISP)
    };
  }

  async onRunReview() {
    const fecha = this.shell.refs.inspectionSelect?.value;
    if (!fecha) return;

    const stats = analyzeDateComparison(fecha, this.rawDataByCartilla, this.config, LOTE_IDX, FECHA_IDX);

    if (stats.dupsIPP.length || stats.dupsISP.length) {
      await showMpDialog({
        icon: "error",
        title: t("plagasEsparrago.duplicateLotsTitle"),
        html: `<div class="agv-mp-dialog__html--stacked">${buildDuplicateAlertHtml(stats.dupsIPP, stats.dupsISP)}</div>`
      });
    }

    this.renderCompareView(stats);
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

    const items = fechas.map((fecha) => analyzeDateComparison(fecha, this.rawDataByCartilla, this.config, LOTE_IDX, FECHA_IDX));

    const el = this.shell.refs.resumenTodasFechasEl;
    if (el) {
      mountReviewAllDashboard(el, items, this.headersByCartilla, this.config, t, htmlEscape, this.columnLabelsByIndex);
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
    let exported = 0;
    CARTILLA_ORDER.forEach((cartilla) => {
      const rows = this.rawDataByCartilla[cartilla];
      const headers = this.headersByCartilla[cartilla];
      if (!rows?.length || !headers?.length) return;
      if (writePlagasErrorsExport({ cartilla, rows, headers, config: this.config, rawDataByCartilla: this.rawDataByCartilla })) {
        exported += 1;
      }
    });
    if (exported) {
      showMpDialog({
        icon: "success",
        title: t("plagasArandano.exportGenerated"),
        text: t("plagasArandano.exportGeneratedHighlight"),
        timer: 2200,
        showConfirmButton: false
      });
    }
  }

  getInsightCartilla() {
    const selected = this.shell.refs.inspectionTypeSelect?.value;
    if (selected && this.excelCabeceraByCartilla[selected]) return selected;
    return CARTILLA_ORDER.find((c) => this.excelCabeceraByCartilla[c]);
  }

  renderExcelInsight() {
    const { excelInsightEl } = this.shell.refs;
    if (!excelInsightEl) return;
    const cartilla = this.getInsightCartilla();
    const meta = cartilla ? this.excelCabeceraByCartilla[cartilla] : null;
    const p = (part) => this.shell.cls(part);

    if (!meta) {
      this.shell.renderExcelInsightEmpty();
      return;
    }

    const ringRadius = 42;
    const ringCircumference = 2 * Math.PI * ringRadius;
    const grupo = meta.grupo || cartilla || "—";
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
                <linearGradient id="pmparInsightRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
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
    const tipo = this.shell.refs.inspectionTypeSelect?.value;
    const fechaActual = this.shell.refs.inspectionSelect?.value;
    if (!tipo || !this.rawDataByCartilla[tipo]?.length) {
      showMpDialog({ icon: "error", title: t("plagasArandano.error"), text: t("plagasEsparrago.noExportData") });
      return;
    }

    let fechasDisponibles = [
      ...new Set(this.rawDataByCartilla[tipo].map((r) => cellDisplayValue(r[FECHA_IDX])).filter(Boolean))
    ].sort((a, b) => {
      const pa = a.split("/").map(Number);
      const pb = b.split("/").map(Number);
      return new Date(pa[2], pa[1] - 1, pa[0]) - new Date(pb[2], pb[1] - 1, pb[0]);
    });

    const buildExportHtml = () => `
      <div class="agv-mp-dialog__export">
        <div class="agv-mp-dialog__export-meta">
          <span class="agv-mp-dialog__export-label">${htmlEscape(t("plagasEsparrago.exportDialogActive"))}</span>
          <strong class="agv-mp-dialog__export-value">${htmlEscape(tipo)}</strong>
        </div>
        <div class="agv-mp-dialog__export-meta">
          <span class="agv-mp-dialog__export-label">${htmlEscape(t("plagasArandano.exportReviewDate"))}</span>
          <strong class="agv-mp-dialog__export-value">${htmlEscape(fechaActual || "—")}</strong>
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
          <h3 class="agv-mp-dialog__title">${htmlEscape(t("plagasEsparrago.exportDialogTitle", { cartilla: tipo }))}</h3>
          <div class="agv-mp-dialog__html" id="agv-esp-plagas-export-body">${buildExportHtml()}</div>
          <div class="agv-mp-dialog__actions">
            <button type="button" class="agv-mp-dialog__btn agv-mp-dialog__btn--primary" data-action="single">${htmlEscape(t("plagasEsparrago.exportSingle"))}</button>
            <button type="button" class="agv-mp-dialog__btn agv-mp-dialog__btn--secondary" data-action="merge">${htmlEscape(t("plagasEsparrago.exportMerge"))}</button>
            <button type="button" class="agv-mp-dialog__btn agv-mp-dialog__btn--ghost" data-action="cancel">${htmlEscape(t("plagasEsparrago.cancel"))}</button>
          </div>
        </div>`;

      const bodyEl = overlay.querySelector("#agv-esp-plagas-export-body");
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

    const headers = this.headersByCartilla[tipo];
    if (result === "single") {
      const rows = this.getRowsForDate(tipo, fechaActual);
      writePlagasExportFile(rows, headers, this.config, `Export_${tipo}_${String(fechaActual).replaceAll("/", "-")}.xlsx`);
    } else if (result === "merge") {
      const rows = this.rawDataByCartilla[tipo].filter((r) => fechasDisponibles.includes(cellDisplayValue(r[FECHA_IDX])));
      writePlagasExportFile(rows, headers, this.config, `Export_${tipo}_Unificado.xlsx`);
    }
  }

  resetResultsUi() {
    const refs = this.shell.refs;
    const root = this.shell.root;
    root.querySelector("#agv-mp-compare-summary")?.replaceChildren();
    root.querySelector("#agv-mp-compare-header-ipp")?.replaceChildren();
    root.querySelector("#agv-mp-compare-body-ipp")?.replaceChildren();
    root.querySelector("#agv-mp-compare-header-isp")?.replaceChildren();
    root.querySelector("#agv-mp-compare-body-isp")?.replaceChildren();
    if (refs.resultsSection) {
      refs.resultsSection.hidden = true;
      refs.resultsSection.classList.remove("is-visible");
    }
  }

  onClear() {
    this.resetDataState();
    this.resetResultsUi();
    const el = this.shell.refs.resumenTodasFechasEl;
    if (el) {
      el.innerHTML = "";
      el.hidden = true;
    }
    if (this.shell.refs.fileInput) this.shell.refs.fileInput.value = "";
    this.populateCartillaSelect();
    this.shell.setLiveStatus(false);
    this.shell.renderExcelInsightEmpty();
    this.syncButtons();
    showMpDialog({
      icon: "success",
      title: t("plagasEsparrago.clearSuccessTitle"),
      text: t("plagasEsparrago.clearSuccessText"),
      timer: 1000,
      showConfirmButton: false
    });
  }

  destroy() {
    this.abortController?.abort();
    this.abortController = null;
    this.shell = null;
  }
}
