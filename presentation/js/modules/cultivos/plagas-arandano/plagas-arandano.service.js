import { appConfig } from "../../../config/app.config.js";
import { i18nService } from "../../../services/i18n.service.js";
import { hydrateLucideIcons } from "../../../utils/lucide-icon.util.js";
import { showPlagasDialog } from "./plagas-arandano-dialog.js";
import { cargarReglasDesdeRuta } from "../../../../../engine/rule-engine.js";
import { mergeValidacionesDesdeReglas } from "../../../../../engine/cartilla-rules.adapter.js";
import { ejecutarValidacionPlagasArandano } from "./plagas-arandano.validation.js";
import { translateExcelHeader } from "../../../utils/excel-header-i18n.util.js";
import { refreshTranslatedHeaderRow } from "../../../utils/table-header-i18n.util.js";

const VALIDACIONES_PATH = "presentation/data/plagas-arandano-validaciones.json";
const REGLAS_PATH = "rules/modulos/arandano-plagas.rules.json";
const VAR_MAP_PATH = "presentation/data/catalogos/var-map-arandano.json";

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

function ensureXlsxLibrary() {
  if (window.XLSX?.read && window.XLSX?.utils) return true;
  showPlagasDialog({
    icon: "error",
    title: t("plagasArandano.error"),
    text: t("plagasArandano.errorXlsxLibrary")
  });
  return false;
}

function valorCeldaParaMostrar(val) {
  if (val === null || val === undefined) return "";
  if (typeof val === "object" && val !== null) {
    if ("w" in val && val.w != null && String(val.w).trim() !== "") return String(val.w);
    if ("v" in val && val.v !== undefined && val.v !== null && val.v !== "") return String(val.v);
    if (Array.isArray(val.r)) {
      return val.r.map((x) => (x && x.w != null ? x.w : x.t) || "").join("");
    }
  }
  return String(val);
}

function parseFlexibleNumber(val) {
  if (val === null || val === undefined) return NaN;
  if (typeof val === "object" && val !== null) {
    if ("v" in val && val.v !== undefined && val.v !== null && val.v !== "") {
      return parseFlexibleNumber(val.v);
    }
    if ("w" in val && val.w !== undefined && val.w !== null && String(val.w).trim() !== "") {
      return parseFlexibleNumber(val.w);
    }
    if (Array.isArray(val.r)) {
      const rich = val.r.map((x) => (x && x.w != null ? x.w : x.t) || "").join("");
      if (rich.trim()) return parseFlexibleNumber(rich);
    }
  }
  if (typeof val === "number" && !Number.isNaN(val)) return val;
  let s = String(val).trim().replace(/^\uFEFF/, "").replace(/<[^>]+>/g, "");
  s = s.replace(/\u00A0/g, " ").replace(/[\u200B-\u200D\uFEFF]/g, "");
  s = s.replace(/[$€£]/g, "").trim();
  s = s.replace(/[\uFF10-\uFF19]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xff10 + 0x30)
  );
  s = s.replace(/\uFF0E/g, ".").replace(/\uFF0C/g, ",");
  s = s.replace(/\s/g, "");
  if (s === "") return NaN;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > lastDot) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (lastComma >= 0 && lastDot >= 0) {
    s = s.replace(/,/g, "");
  } else {
    s = s.replace(",", ".");
  }
  let n = Number(s);
  if (!Number.isNaN(n)) return n;
  const m = s.match(/-?\d+(?:[.,]\d+)?/);
  if (!m) return NaN;
  let tNum = m[0].replace(",", ".");
  if (tNum.includes(".") && tNum.lastIndexOf(".") !== tNum.indexOf(".")) {
    tNum = tNum.replace(/\./g, "").replace(",", ".");
  }
  n = Number(tNum);
  return Number.isNaN(n) ? NaN : n;
}

function formatExcelDate(str) {
  if (!str) return "";
  str = str.toString().trim();
  if (/^\d{8}$/.test(str)) {
    const y = str.slice(0, 4);
    const m = str.slice(4, 6);
    const d = str.slice(6, 8);
    return `${d}/${m}/${y}`;
  }
  if (/\d{1,2}\/\d{1,2}\/\d{4}/.test(str)) {
    const [d, m, y] = str.split("/");
    return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
  }
  return "";
}

function ordenarFechasDDMMYYYY(fechas) {
  return [...fechas].sort((a, b) => {
    const pa = a.split("/").map(Number);
    const pb = b.split("/").map(Number);
    return new Date(pa[2], pa[1] - 1, pa[0]) - new Date(pb[2], pb[1] - 1, pb[0]);
  });
}

function buildVarMapLookup(catalog) {
  const lookup = {};
  Object.keys(catalog.entradas || {}).forEach((code) => {
    lookup[code] = catalog.entradas[code];
  });
  return lookup;
}

export class PlagasArandanoService {
  constructor() {
    this.config = null;
    this.varMap = {};
    this.rawData = [];
    this.processedData = [];
    this.columns = [];
    this.excelLoaded = false;
    this.columnsToShow = [];
    this.columnasARevisar = [];
    this.hiddenColumnIndices = new Set();
    this.colMenuEl = null;
    this.colMenuColIndex = null;
    this.excelCabecera = null;
    this.excelFileName = "";
    this.abortController = null;
    this.root = null;
  }

  async init(appRoot) {
    this.root = appRoot;
    const version = appConfig.cacheBustingVersion;
    const [rulesRes, varRes, reglasModulo] = await Promise.all([
      fetch(`${VALIDACIONES_PATH}?v=${version}`),
      fetch(`${VAR_MAP_PATH}?v=${version}`),
      cargarReglasDesdeRuta(`${REGLAS_PATH}?v=${version}`).catch(() => null)
    ]);
    if (!rulesRes.ok || !varRes.ok) {
      throw new Error("No se pudieron cargar las reglas de Plagas Arándano");
    }
    const configBase = await rulesRes.json();
    const varCatalog = await varRes.json();
    this.varMap = buildVarMapLookup(varCatalog);
    this.config = mergeValidacionesDesdeReglas(configBase, reglasModulo, {
      duplicateRuleTipo: "sin_duplicados_en_fecha",
      preserveRuleTipos: ["igual_a_fecha_inspeccion"]
    });
    this.columnsToShow = [...this.config.columnas_visibles_frontend.indices_js];
    this.columnasARevisar = [...this.config.columnas_a_revisar.indices_js];
    this.cacheDom();
    this.bindEvents();
    this.resetDashboard();
  }

  cacheDom() {
    const app = this.root;
    if (!app) return;

    this.fileInput = app.querySelector("#pmpar-file-input");
    this.runReviewBtn = app.querySelector("#pmpar-run-review");
    this.reviewAllBtn = app.querySelector("#pmpar-review-all");
    this.exportExcelErroresBtn = app.querySelector("#pmpar-export-errors");
    this.clearBtn = app.querySelector("#pmpar-clear");
    this.exportBtn = app.querySelector("#pmpar-export-filtered");
    this.inspectionSelect = app.querySelector("#pmpar-inspection-date");
    this.cosechaSelect = app.querySelector("#pmpar-harvest-date");
    this.resultsHeader = app.querySelector("#pmpar-results-header");
    this.resultsBody = app.querySelector("#pmpar-results-body");
    this.resultsTable = app.querySelector("#pmpar-results-table");
    this.resumenTodasFechasEl = app.querySelector("#pmpar-resumen-todas");
    this.resultsSection = app.querySelector("#pmpar-results-section");
    this.totalFilasDiv = app.querySelector("#pmpar-total-filas");
    this.resultsTitleEl = app.querySelector("#pmpar-results-title");
    this.resultsSubtitleEl = app.querySelector("#pmpar-results-subtitle");
    this.resultsIconEl = app.querySelector("#pmpar-results-icon");
    this.fileFieldEl = app.querySelector("#pmpar-file-wrap");
    this.reviewStatsEl = app.querySelector("#pmpar-review-stats");
    this.liveBadgeEl = app.querySelector("#pmpar-live-badge");
    this.liveLabelEl = app.querySelector("#pmpar-live-label");
    this.excelInsightEl = app.querySelector("#pmpar-excel-insight");
    this.ensureColumnMenu();
  }

  setLiveStatus(active) {
    if (this.liveBadgeEl) {
      this.liveBadgeEl.classList.toggle("is-live", active);
      this.liveBadgeEl.title = t(
        active ? "plagasArandano.liveTitleActive" : "plagasArandano.liveTitleIdle"
      );
    }
    if (this.liveLabelEl) {
      this.liveLabelEl.textContent = t("plagasArandano.liveIdle");
    }
  }

  refreshIcons() {
    if (this.root) hydrateLucideIcons(this.root);
    if (this.excelInsightEl) hydrateLucideIcons(this.excelInsightEl);
  }

  readSheetCell(sheet, row, col) {
    const value = sheet[row]?.[col];
    if (value === null || value === undefined) return "";
    return String(value).trim();
  }

  parseExcelCabecera(sheet) {
    const cfg = this.config?.cabecera_excel;
    if (!cfg) return null;

    const meta = {
      titulo: this.readSheetCell(sheet, cfg.titulo?.fila_js ?? 0, cfg.titulo?.col_js ?? 0)
    };

    (cfg.campos || []).forEach((field) => {
      meta[field.clave] = this.readSheetCell(sheet, field.fila_js, field.valor_col_js);
    });

    return meta;
  }

  validateArchivoOnLoad(rawSheet) {
    const rules = this.config?.validacion_archivo || [];
    const skip = this.config?.filas_ignoradas_al_cargar ?? 5;
    const minRows = skip + 2;

    if (!Array.isArray(rawSheet) || rawSheet.length < minRows) {
      return {
        ok: false,
        message: t("plagasArandano.errorArchivoVacio")
      };
    }

    for (const rule of rules) {
      if (rule.regla === "cantidad_columnas") {
        const expected = rule.valor ?? this.config?.total_columnas ?? 111;
        const headerRow = rawSheet[skip] || [];
        if (headerRow.length !== expected) {
          return {
            ok: false,
            message: t(rule.mensaje_i18n || "plagasArandano.errorColumns", { count: expected })
          };
        }
        continue;
      }

      if (rule.regla === "cabecera_celda") {
        const actual = this.readSheetCell(rawSheet, rule.fila_js, rule.col_js).toUpperCase();
        const expected = String(rule.valor_esperado || "").toUpperCase();
        if (!expected || actual !== expected) {
          return {
            ok: false,
            message: t(rule.mensaje_i18n || "plagasArandano.errorArchivoInvalido", {
              esperado: expected,
              encontrado: actual || t("plagasArandano.valorDesconocido")
            })
          };
        }
        continue;
      }

      if (rule.regla === "tipo_cartilla") {
        const idx = rule.indice_js ?? 1;
        const expected = String(rule.valor_esperado || "PMPAR").toUpperCase();
        const firstDataRow = rawSheet[skip + 1] || [];
        const actual = String(firstDataRow[idx] ?? "")
          .trim()
          .toUpperCase();
        if (actual !== expected) {
          return {
            ok: false,
            message: t(rule.mensaje_i18n || "plagasArandano.errorCartilla", {
              cartilla: expected,
              encontrado: actual || t("plagasArandano.valorDesconocido")
            })
          };
        }
      }
    }

    return { ok: true };
  }

  renderExcelInsight() {
    if (!this.excelInsightEl) return;

    if (!this.excelCabecera) {
      this.excelInsightEl.className = "pmpar-excel-insight pmpar-excel-insight--empty";
      this.excelInsightEl.innerHTML = `
        <div class="pmpar-excel-insight__body">
          <div class="pmpar-excel-insight__placeholder">
            <i data-lucide="file-spreadsheet" aria-hidden="true"></i>
            <p>${htmlEscape(t("plagasArandano.excelInsightEmpty"))}</p>
          </div>
        </div>`;
      this.refreshIcons();
      return;
    }

    const meta = this.excelCabecera;
    const ringRadius = 42;
    const ringCircumference = 2 * Math.PI * ringRadius;
    const grupo = meta.grupo || "—";
    const estado = meta.estado || "—";
    const reportTitle = meta.titulo || "";

    this.excelInsightEl.className = "pmpar-excel-insight pmpar-excel-insight--loaded";
    this.excelInsightEl.innerHTML = `
      ${
        reportTitle
          ? `<p class="pmpar-excel-insight__report">${htmlEscape(reportTitle)}</p>`
          : ""
      }
      <div class="pmpar-excel-insight__body">
        <div class="pmpar-excel-insight__top">
          <div class="pmpar-excel-insight__primary">
            <div class="pmpar-excel-insight__stat pmpar-excel-insight__stat--primary">
              <span class="pmpar-excel-insight__stat-label">${htmlEscape(t("plagasArandano.metaCompany"))}</span>
              <strong>${htmlEscape(meta.empresa || "—")}</strong>
            </div>
            <div class="pmpar-excel-insight__stat pmpar-excel-insight__stat--primary">
              <span class="pmpar-excel-insight__stat-label">${htmlEscape(t("plagasArandano.metaClient"))}</span>
              <strong>${htmlEscape(meta.mandante || "—")}</strong>
            </div>
          </div>
          <div class="pmpar-excel-insight__ring" aria-hidden="true">
            <svg viewBox="0 0 100 100" shape-rendering="geometricPrecision">
              <defs>
                <linearGradient id="pmparInsightRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#5eb8d9"></stop>
                  <stop offset="100%" stop-color="#22c55e"></stop>
                </linearGradient>
              </defs>
              <circle class="pmpar-excel-insight__ring-glow" cx="50" cy="50" r="${ringRadius}"></circle>
              <circle class="pmpar-excel-insight__ring-track" cx="50" cy="50" r="${ringRadius}"></circle>
              <circle
                class="pmpar-excel-insight__ring-value"
                cx="50"
                cy="50"
                r="${ringRadius}"
                stroke-dasharray="${ringCircumference}"
                stroke-dashoffset="0"
              ></circle>
            </svg>
            <div class="pmpar-excel-insight__ring-label">
              <strong>${htmlEscape(grupo)}</strong>
              <span>${htmlEscape(t("plagasArandano.metaGroup"))}</span>
            </div>
          </div>
        </div>
        <div class="pmpar-excel-insight__stats">
          <div class="pmpar-excel-insight__stat">
            <span class="pmpar-excel-insight__stat-label">${htmlEscape(t("plagasArandano.metaCrop"))}</span>
            <strong>${htmlEscape(meta.cultivo || "—")}</strong>
          </div>
          <div class="pmpar-excel-insight__stat pmpar-excel-insight__stat--status">
            <span class="pmpar-excel-insight__stat-label">${htmlEscape(t("plagasArandano.metaStatus"))}</span>
            <strong>${htmlEscape(estado)}</strong>
          </div>
        </div>
      </div>`;

    this.refreshIcons();
  }

  bindEvents() {
    this.abortController = new AbortController();
    const { signal } = this.abortController;

    this.fileInput?.addEventListener("change", (e) => this.onFileChange(e), { signal });
    this.inspectionSelect?.addEventListener("change", () => this.syncFechas(), { signal });
    this.runReviewBtn?.addEventListener("click", () => this.procesarTodoExcel(), { signal });
    this.reviewAllBtn?.addEventListener("click", () => this.reviewAll(), { signal });
    this.exportExcelErroresBtn?.addEventListener("click", () => this.exportExcelCompletoErroresResaltados(), {
      signal
    });
    this.exportBtn?.addEventListener("click", () => this.onExportClick(), { signal });
    this.clearBtn?.addEventListener("click", () => this.onClear(), { signal });
    this.root?.addEventListener("contextmenu", (event) => this.onTableHeaderContextMenu(event), {
      signal
    });
    this.colMenuEl?.addEventListener("click", (event) => this.onColumnMenuClick(event), { signal });
    document.addEventListener("click", (event) => this.onColumnMenuOutsideClick(event), { signal });
    document.addEventListener("keydown", (event) => this.onColumnMenuKeydown(event), { signal });
    window.addEventListener("resize", () => this.closeColumnMenu(), { signal });
    window.addEventListener("scroll", () => this.closeColumnMenu(), { signal, capture: true });
  }

  destroy() {
    this.closeColumnMenu();
    this.colMenuEl?.remove();
    this.colMenuEl = null;
    this.abortController?.abort();
    this.abortController = null;
  }

  onLanguageChange() {
    refreshTranslatedHeaderRow(this.resultsHeader, (idx) => this.columns[idx]?.header || "");
  }

  setPlagasAuxButtonsDisabled(disabled) {
    [this.reviewAllBtn, this.exportExcelErroresBtn].forEach((btn) => {
      if (!btn) return;
      btn.disabled = disabled;
    });
  }

  resetDashboard() {
    this.rawData = [];
    this.processedData = [];
    this.columns = [];
    this.excelLoaded = false;

    if (this.resultsHeader) this.resultsHeader.innerHTML = "";
    if (this.resultsBody) this.resultsBody.innerHTML = "";
    if (this.resultsTable) this.resultsTable.hidden = true;
    if (this.resultsSection) {
      this.resultsSection.classList.remove("is-visible", "pmpar-results--ok", "pmpar-results--errors");
    }
    if (this.resultsSubtitleEl) this.resultsSubtitleEl.textContent = "";
    if (this.resultsIconEl) {
      this.resultsIconEl.innerHTML = '<i data-lucide="triangle-alert"></i>';
    }

    if (this.inspectionSelect) {
      this.inspectionSelect.innerHTML = `<option value="" disabled selected>${t("plagasArandano.selectDate")}</option>`;
      this.inspectionSelect.disabled = true;
    }

    if (this.cosechaSelect) {
      this.cosechaSelect.innerHTML = `<option value="" selected>${t("plagasArandano.autoDate")}</option>`;
      this.cosechaSelect.disabled = true;
      this.cosechaSelect.classList.remove("pmpar-input--warning");
    }

    if (this.runReviewBtn) this.runReviewBtn.disabled = true;
    if (this.exportBtn) this.exportBtn.disabled = true;
    if (this.fileInput) this.fileInput.value = "";
    if (this.fileFieldEl) this.fileFieldEl.classList.remove("is-loaded");

    this.ocultarReviewStats();
    this.setLiveStatus(false);

    if (this.totalFilasDiv) {
      this.totalFilasDiv.textContent = "";
    }

    if (this.resumenTodasFechasEl) {
      this.resumenTodasFechasEl.innerHTML = "";
      this.resumenTodasFechasEl.hidden = true;
    }
    this.setPlagasAuxButtonsDisabled(true);
    this.resetHiddenColumns();
    this.excelCabecera = null;
    this.excelFileName = "";
    this.renderExcelInsight();
    this.refreshIcons();
  }

  syncFechas() {
    if (!this.excelLoaded) return;
    const sel = this.inspectionSelect.value;
    if (!sel) return;

    const idxCosecha = this.config.filtro_principal.indice_js === 71 ? 19 : 19;
    const idxInspeccion = this.config.filtro_principal.indice_js;
    const matchingRows = this.rawData.filter((r) => r[idxInspeccion] === sel);
    if (!matchingRows.length) return;

    const cosecha = matchingRows[0][idxCosecha] || "";
    this.cosechaSelect.innerHTML = "";
    const option = document.createElement("option");
    option.value = cosecha;
    option.textContent = cosecha || t("plagasArandano.autoDate");
    this.cosechaSelect.appendChild(option);
    this.cosechaSelect.value = cosecha;
    this.cosechaSelect.disabled = true;
    this.cosechaSelect.classList.remove("pmpar-input--warning");

    if (cosecha) {
      const [d1, m1, y1] = sel.split("/").map(Number);
      const [d2, m2, y2] = cosecha.split("/").map(Number);
      if (new Date(y2, m2 - 1, d2) > new Date(y1, m1 - 1, d1)) {
        this.cosechaSelect.classList.add("pmpar-input--warning");
        showPlagasDialog({
          icon: "warning",
          title: t("plagasArandano.attention"),
          text: t("plagasArandano.harvestAfterInspection")
        });
      }
    }
  }

  onFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!ensureXlsxLibrary()) {
      if (this.fileInput) this.fileInput.value = "";
      if (this.fileFieldEl) this.fileFieldEl.classList.remove("is-loaded");
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const wb = window.XLSX.read(new Uint8Array(ev.target.result), { type: "array" });
      const rawSheet = window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
        header: 1,
        raw: false
      });

      const validation = this.validateArchivoOnLoad(rawSheet);
      if (!validation.ok) {
        showPlagasDialog({
          icon: "error",
          title: t("plagasArandano.error"),
          text: validation.message
        });
        this.resetDashboard();
        return;
      }

      if (this.fileFieldEl) this.fileFieldEl.classList.add("is-loaded");

      this.excelFileName = file.name;
      this.excelCabecera = this.parseExcelCabecera(rawSheet);
      this.renderExcelInsight();

      let sheet = rawSheet.slice();
      const skip = this.config.filas_ignoradas_al_cargar || 5;
      sheet.splice(0, skip);

      this.columns = sheet[0].map((header, i) => ({
        id: `col_${i + 1}`,
        header,
        originalIndex: i
      }));
      this.rawData = sheet.slice(1).filter((row) => row.some((cell) => cell !== "" && cell !== null));

      const idxCosecha = 19;
      const idxInspeccion = this.config.filtro_principal.indice_js;
      this.rawData.forEach((row) => {
        row[idxCosecha] = formatExcelDate(row[idxCosecha]);
        row[idxInspeccion] = formatExcelDate(row[idxInspeccion]);
      });

      const inspectionDates = [...new Set(this.rawData.map((r) => r[idxInspeccion]).filter(Boolean))];
      this.inspectionSelect.innerHTML = "";
      inspectionDates.forEach((date) => {
        const opt = document.createElement("option");
        opt.value = date;
        opt.textContent = date;
        this.inspectionSelect.appendChild(opt);
      });

      this.inspectionSelect.disabled = !inspectionDates.length;
      this.runReviewBtn.disabled = !inspectionDates.length;
      this.setPlagasAuxButtonsDisabled(!inspectionDates.length);
      this.excelLoaded = true;
      this.setLiveStatus(true);
      this.syncFechas();

      const cartillaCode = this.config?.cartilla || "PMPAR";
      const totalColumnas = this.config?.total_columnas || this.columns.length;
      showPlagasDialog({
        icon: "success",
        title: "Excel cargado",
        html: `Cartilla <b>${htmlEscape(cartillaCode)}</b> · <b>${this.rawData.length}</b> registros · <b>${totalColumnas}</b> columnas`,
        timer: 1800,
        showConfirmButton: false
      });
    };
    reader.readAsArrayBuffer(file);
  }

  limpiarMarcasValidacion(rows) {
    rows.forEach((row) => {
      delete row._errors;
      delete row._errorLote;
    });
  }

  ejecutarValidacion(rows) {
    return ejecutarValidacionPlagasArandano(rows, this.config, {
      catalogoVariedades: this.varMap
    });
  }

  obtenerTituloColumna(i) {
    const titles = {
      9: t("plagasArandano.tipLote"),
      10: t("plagasArandano.tipSample500"),
      11: t("plagasArandano.tipGrams"),
      12: t("plagasArandano.tipProducer"),
      13: t("plagasArandano.tipTg"),
      14: t("plagasArandano.tipDigit"),
      15: t("plagasArandano.tipDigit"),
      18: t("plagasArandano.ruleVarietyInvalid"),
      19: t("plagasArandano.ruleHarvestEqualsInspection"),
      71: t("plagasArandano.inspectionDate")
    };

    if (
      (i >= 10 && i <= 20 && i !== 16) ||
      (i >= 28 && i <= 32) ||
      (i >= 83 && i <= 110)
    ) {
      return titles[i] || t("plagasArandano.ruleRequired");
    }
    return titles[i] || "";
  }

  mensajeErrorColumna(row, colIdx) {
    const pref = `Columna ${colIdx + 1}: `;
    const err = (row._errors || []).find((e) => e.startsWith(pref));
    if (err) return err.slice(pref.length);
    return this.obtenerTituloColumna(colIdx);
  }

  getVisibleColumnIndices() {
    return this.columnsToShow.filter((colIndex) => !this.hiddenColumnIndices.has(colIndex));
  }

  getVisibleColumnCount() {
    return this.getVisibleColumnIndices().length;
  }

  resetHiddenColumns() {
    this.hiddenColumnIndices.clear();
    this.applyColumnVisibility();
    this.closeColumnMenu();
  }

  ensureColumnMenu() {
    if (this.colMenuEl) return;

    const menu = document.createElement("div");
    menu.id = "pmpar-col-menu";
    menu.className = "pmpar-col-menu";
    menu.hidden = true;
    menu.setAttribute("role", "menu");
    menu.innerHTML = `
      <button type="button" class="pmpar-col-menu__item" data-action="hide" role="menuitem">
        <i data-lucide="eye-off" aria-hidden="true"></i>
        <span data-menu-label="hide"></span>
      </button>
      <button type="button" class="pmpar-col-menu__item" data-action="show-all" role="menuitem">
        <i data-lucide="columns-3" aria-hidden="true"></i>
        <span data-menu-label="show-all"></span>
      </button>`;
    document.body.appendChild(menu);
    this.colMenuEl = menu;
  }

  renderColumnMenuLabels() {
    if (!this.colMenuEl) return;
    const hideLabel = this.colMenuEl.querySelector('[data-menu-label="hide"]');
    const showAllLabel = this.colMenuEl.querySelector('[data-menu-label="show-all"]');
    if (hideLabel) hideLabel.textContent = t("plagasArandano.hideColumn");
    if (showAllLabel) showAllLabel.textContent = t("plagasArandano.showAllColumnsShort");
    hydrateLucideIcons(this.colMenuEl);
  }

  updateColumnMenuState() {
    if (!this.colMenuEl || this.colMenuColIndex === null) return;

    const hideBtn = this.colMenuEl.querySelector('[data-action="hide"]');
    const showAllBtn = this.colMenuEl.querySelector('[data-action="show-all"]');
    const colIndex = this.colMenuColIndex;
    const isHidden = this.hiddenColumnIndices.has(colIndex);
    const canHide = !isHidden && this.getVisibleColumnCount() > 1;

    if (hideBtn) hideBtn.disabled = !canHide;
    if (showAllBtn) showAllBtn.disabled = this.hiddenColumnIndices.size === 0;
  }

  openColumnMenu(header, colIndex) {
    this.ensureColumnMenu();
    this.renderColumnMenuLabels();
    this.colMenuColIndex = colIndex;
    this.colMenuEl.hidden = false;
    this.updateColumnMenuState();

    const rect = header.getBoundingClientRect();
    this.colMenuEl.style.left = `${rect.left}px`;
    this.colMenuEl.style.top = `${rect.bottom + 6}px`;

    requestAnimationFrame(() => {
      if (!this.colMenuEl || this.colMenuEl.hidden) return;
      const menuRect = this.colMenuEl.getBoundingClientRect();
      let left = rect.left;
      let top = rect.bottom + 6;

      if (menuRect.right > window.innerWidth - 8) {
        left = Math.max(8, window.innerWidth - menuRect.width - 8);
      }
      if (menuRect.bottom > window.innerHeight - 8) {
        top = Math.max(8, rect.top - menuRect.height - 6);
      }

      this.colMenuEl.style.left = `${left}px`;
      this.colMenuEl.style.top = `${top}px`;
    });
  }

  closeColumnMenu() {
    if (this.colMenuEl) this.colMenuEl.hidden = true;
    this.colMenuColIndex = null;
  }

  onTableHeaderContextMenu(event) {
    const header = event.target.closest("th.pmpar-table__col-header[data-col-index]");
    if (!header || !this.root?.contains(header)) return;

    event.preventDefault();
    const colIndex = Number(header.dataset.colIndex);
    if (!Number.isFinite(colIndex)) return;

    this.openColumnMenu(header, colIndex);
  }

  onColumnMenuClick(event) {
    const button = event.target.closest("[data-action]");
    if (!button || button.disabled || !this.colMenuEl?.contains(button)) return;

    event.preventDefault();
    event.stopPropagation();

    const action = button.dataset.action;
    if (action === "hide" && this.colMenuColIndex !== null) {
      this.hideColumn(this.colMenuColIndex);
    } else if (action === "show-all") {
      this.showAllColumns();
    }

    this.closeColumnMenu();
  }

  onColumnMenuOutsideClick(event) {
    if (!this.colMenuEl || this.colMenuEl.hidden) return;
    if (this.colMenuEl.contains(event.target)) return;
    this.closeColumnMenu();
  }

  onColumnMenuKeydown(event) {
    if (event.key === "Escape") this.closeColumnMenu();
  }

  hideColumn(colIndex) {
    if (!this.columnsToShow.includes(colIndex) || this.hiddenColumnIndices.has(colIndex)) {
      return;
    }

    if (this.getVisibleColumnCount() <= 1) {
      showPlagasDialog({
        icon: "info",
        title: t("plagasArandano.attention"),
        text: t("plagasArandano.cannotHideLastColumn")
      });
      return;
    }

    this.hiddenColumnIndices.add(colIndex);
    this.applyColumnVisibility();
  }

  showAllColumns() {
    if (!this.hiddenColumnIndices.size) return;
    this.hiddenColumnIndices.clear();
    this.applyColumnVisibility();
  }

  applyColumnVisibility() {
    if (!this.root) return;

    this.root.querySelectorAll("[data-col-index]").forEach((element) => {
      const colIndex = Number(element.dataset.colIndex);
      element.classList.toggle("pmpar-col-hidden", this.hiddenColumnIndices.has(colIndex));
    });

    const okCell = this.resultsBody?.querySelector(".pmpar-row-ok td");
    if (okCell) {
      okCell.colSpan = Math.max(this.getVisibleColumnCount(), 1);
    }

    this.updateColumnMenuState();
  }

  getCellRenderMeta(row, colIndex) {
    const raw = row[colIndex];
    const val =
      raw === null || raw === undefined || raw === "" ? "" : valorCeldaParaMostrar(raw);
    let cellClass = "";
    let tieneError = false;

    if (colIndex === 9 && row._errorLote) {
      tieneError = true;
      cellClass = val ? "pmpar-cell-error-value" : "pmpar-cell-error-empty";
    }

    if (
      this.columnasARevisar.includes(colIndex) &&
      (row._errors || []).some((e) => e.startsWith(`Columna ${colIndex + 1}: `))
    ) {
      tieneError = true;
      cellClass = val ? "pmpar-cell-error-value" : "pmpar-cell-error-empty";
    }

    return {
      val,
      cellClass,
      title: tieneError ? this.mensajeErrorColumna(row, colIndex) : ""
    };
  }

  buildColumnHeaderHtml(colIndex) {
    const rawHeader = this.columns[colIndex]?.header || "";
    const label = htmlEscape(translateExcelHeader(rawHeader, colIndex));
    const hint = htmlEscape(t("plagasArandano.hideColumnHint"));
    return `<th class="pmpar-table__col-header" data-col-index="${colIndex}" data-excel-header="${htmlEscape(rawHeader)}" title="${hint}">${label}</th>`;
  }

  buildColumnCellHtml(row, colIndex) {
    const { val, cellClass, title } = this.getCellRenderMeta(row, colIndex);
    const classAttr = cellClass ? ` class="${cellClass}"` : "";
    const titleAttr = title ? ` title="${htmlEscape(title)}"` : "";
    return `<td data-col-index="${colIndex}"${classAttr}${titleAttr}>${htmlEscape(val)}</td>`;
  }

  createColumnHeaderTh(colIndex) {
    const th = document.createElement("th");
    th.className = "pmpar-table__col-header";
    th.dataset.colIndex = String(colIndex);
    th.dataset.excelHeader = this.columns[colIndex]?.header || "";
    th.textContent = translateExcelHeader(th.dataset.excelHeader, colIndex);
    th.title = t("plagasArandano.hideColumnHint");
    return th;
  }

  createColumnDataTd(row, colIndex) {
    const { val, cellClass, title } = this.getCellRenderMeta(row, colIndex);
    const td = document.createElement("td");
    td.dataset.colIndex = String(colIndex);
    if (cellClass) td.className = cellClass;
    td.textContent = val;
    if (title) td.title = title;
    return td;
  }

  ocultarResumenTodasFechas() {
    if (this.resumenTodasFechasEl) {
      this.resumenTodasFechasEl.innerHTML = "";
      this.resumenTodasFechasEl.hidden = true;
    }
    if (this.resultsSection) this.resultsSection.classList.remove("is-visible");
  }

  ocultarReviewStats() {
    if (this.reviewStatsEl) {
      this.reviewStatsEl.innerHTML = "";
      this.reviewStatsEl.hidden = true;
    }
  }

  limpiarVistaRevision() {
    this.ocultarReviewStats();
    if (this.resultsSection) {
      this.resultsSection.classList.remove(
        "is-visible",
        "pmpar-results--ok",
        "pmpar-results--errors"
      );
    }
    if (this.resultsHeader) this.resultsHeader.innerHTML = "";
    if (this.resultsBody) this.resultsBody.innerHTML = "";
    if (this.resultsTable) this.resultsTable.hidden = true;
    if (this.totalFilasDiv) this.totalFilasDiv.textContent = "";
  }

  renderReviewStats(filasConError, lotesDuplicados = []) {
    if (!this.reviewStatsEl) return;

    const total = this.processedData.length;
    const errors = filasConError.length;
    const pct = total ? Math.round((errors / total) * 100) : 0;
    const fecha = this.inspectionSelect?.value || "";
    const dups = lotesDuplicados.length;

    this.reviewStatsEl.hidden = false;
    this.reviewStatsEl.innerHTML = `
      <header class="pmpar-mini-grid__head">
        <h4 class="pmpar-mini-grid__title">${t("plagasArandano.reviewStatsTitle")}</h4>
        <span class="pmpar-mini-grid__date">${htmlEscape(fecha)}</span>
      </header>
      <div class="pmpar-mini-grid__body">
        <div class="pmpar-mini">
          <span class="pmpar-mini__val">${total}</span>
          <span class="pmpar-mini__lbl">${t("plagasArandano.statRecords")}</span>
        </div>
        <div class="pmpar-mini pmpar-mini--err">
          <span class="pmpar-mini__val">${errors}</span>
          <span class="pmpar-mini__lbl">${t("plagasArandano.statErrors")}</span>
        </div>
        <div class="pmpar-mini ${pct > 0 ? "pmpar-mini--warn" : "pmpar-mini--ok"}">
          <span class="pmpar-mini__val">${pct}%</span>
          <span class="pmpar-mini__lbl">${t("plagasArandano.statRate")}</span>
        </div>
        <div class="pmpar-mini ${dups ? "pmpar-mini--warn" : ""}">
          <span class="pmpar-mini__val">${dups}</span>
          <span class="pmpar-mini__lbl">${t("plagasArandano.statDupLots")}</span>
        </div>
      </div>`;
  }

  htmlTablaFilasConError(filas, options = {}) {
    const { titled = true } = options;
    if (!filas?.length) return "";
    const thead = this.columnsToShow.map((colIndex) => this.buildColumnHeaderHtml(colIndex)).join("");

    const tbody = filas
      .map((row) => {
        const tds = this.columnsToShow
          .map((colIndex) => this.buildColumnCellHtml(row, colIndex))
          .join("");
        return `<tr>${tds}</tr>`;
      })
      .join("");

    const titleBlock = titled
      ? `<p class="pmpar-nested-table-title">${t("plagasArandano.errorRowsTitle")}</p>`
      : "";

    return `
      <div class="pmpar-nested-table-wrap">
        ${titleBlock}
        <div class="pmpar-table-scroll">
          <table class="pmpar-table">
            <thead class="pmpar-table__head"><tr>${thead}</tr></thead>
            <tbody class="pmpar-table__body">${tbody}</tbody>
          </table>
        </div>
      </div>`;
  }

  mostrarResumenTodasFechas(items) {
    if (!this.resumenTodasFechasEl) return;

    let ok = 0;
    let bad = 0;
    let totalErrors = 0;

    const tiles = items
      .map((item) => {
        totalErrors += item.filasConError;
        if (item.tieneErrores) bad += 1;
        else ok += 1;

        const tileClass = item.tieneErrores ? "pmpar-tile--error" : "pmpar-tile--ok";
        const badgeClass = item.tieneErrores
          ? "pmpar-tile__badge--error"
          : "pmpar-tile__badge--ok";
        const estado = item.tieneErrores
          ? t("plagasArandano.statusWithIssues")
          : t("plagasArandano.statusOk");

        const dupTxt = item.lotesDuplicados.length
          ? `<p class="pmpar-tile__dup">${t("plagasArandano.duplicateLots")}: ${htmlEscape(item.lotesDuplicados.join(", "))}</p>`
          : "";

        const pct = item.totalFilas ? Math.round((item.filasConError / item.totalFilas) * 100) : 0;

        return `
        <article class="pmpar-tile ${tileClass}">
          <div class="pmpar-tile__head">
            <span class="pmpar-tile__date">${htmlEscape(item.fecha)}</span>
            <span class="pmpar-tile__badge ${badgeClass}">${estado}</span>
          </div>
          <div class="pmpar-tile__stats">
            <div class="pmpar-tile__stat">
              <span class="pmpar-tile__stat-val">${item.totalFilas}</span>
              <span class="pmpar-tile__stat-lbl">${t("plagasArandano.tileRecords")}</span>
            </div>
            <div class="pmpar-tile__stat">
              <span class="pmpar-tile__stat-val">${item.filasConError}</span>
              <span class="pmpar-tile__stat-lbl">${t("plagasArandano.tileErrors")}</span>
            </div>
            <div class="pmpar-tile__stat">
              <span class="pmpar-tile__stat-val">${pct}%</span>
              <span class="pmpar-tile__stat-lbl">${t("plagasArandano.tileRate")}</span>
            </div>
          </div>
          ${dupTxt}
        </article>`;
      })
      .join("");

    const details = items
      .filter((item) => item.filasDetalle?.length)
      .map(
        (item) => `
        <section class="pmpar-date-detail">
          <header class="pmpar-date-detail__head">
            <h4 class="pmpar-date-detail__title">${htmlEscape(item.fecha)}</h4>
            <span class="pmpar-date-detail__meta">${t("plagasArandano.errorRowsCount", {
              errors: item.filasConError,
              total: item.totalFilas
            })}</span>
          </header>
          ${this.htmlTablaFilasConError(item.filasDetalle, { titled: false })}
        </section>`
      )
      .join("");

    const detailsBlock = details
      ? `<div class="pmpar-dashboard__details">
          <h3 class="pmpar-dashboard__details-title">${t("plagasArandano.errorsDetailHeading")}</h3>
          ${details}
        </div>`
      : "";

    const totalRows = items.reduce((sum, item) => sum + item.totalFilas, 0);
    const avgRate = totalRows ? Math.round((totalErrors / totalRows) * 100) : 0;

    this.resumenTodasFechasEl.innerHTML = `
      <div class="pmpar-dashboard">
        <div>
          <h3 class="pmpar-dashboard__title">${t("plagasArandano.summaryAllDates")}</h3>
          <p class="pmpar-dashboard__subtitle">${t("plagasArandano.analysisByDate")}</p>
        </div>
        <div class="pmpar-kpi-grid">
          <div class="pmpar-kpi">
            <span class="pmpar-kpi__icon pmpar-kpi__icon--dates" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
            </span>
            <div class="pmpar-kpi__body">
              <span class="pmpar-kpi__value">${items.length}</span>
              <span class="pmpar-kpi__label">${t("plagasArandano.kpiDates")}</span>
            </div>
          </div>
          <div class="pmpar-kpi">
            <span class="pmpar-kpi__icon pmpar-kpi__icon--ok" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </span>
            <div class="pmpar-kpi__body">
              <span class="pmpar-kpi__value">${ok}</span>
              <span class="pmpar-kpi__label">${t("plagasArandano.kpiOk")}</span>
            </div>
          </div>
          <div class="pmpar-kpi">
            <span class="pmpar-kpi__icon pmpar-kpi__icon--error" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
            </span>
            <div class="pmpar-kpi__body">
              <span class="pmpar-kpi__value">${bad}</span>
              <span class="pmpar-kpi__label">${t("plagasArandano.kpiIssues")}</span>
            </div>
          </div>
          <div class="pmpar-kpi">
            <span class="pmpar-kpi__icon pmpar-kpi__icon--rows" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h10"/></svg>
            </span>
            <div class="pmpar-kpi__body">
              <span class="pmpar-kpi__value">${totalErrors}</span>
              <span class="pmpar-kpi__label">${t("plagasArandano.kpiErrorRows")}</span>
            </div>
          </div>
        </div>
        <p class="pmpar-dashboard__avg">${t("plagasArandano.avgErrorRate", { pct: avgRate })}</p>
        <div class="pmpar-tile-grid">${tiles}</div>
        ${detailsBlock}
      </div>`;

    this.resumenTodasFechasEl.hidden = false;
    this.limpiarVistaRevision();
    this.resetHiddenColumns();
    this.exportBtn.disabled = true;

    showPlagasDialog({
      icon: "success",
      title: t("plagasArandano.analysisComplete"),
      text: t("plagasArandano.analysisCompleteText", { count: items.length }),
      timer: 2200
    });
  }

  reviewAll() {
    if (!this.excelLoaded || !this.rawData.length) return;
    const idxInspeccion = this.config.filtro_principal.indice_js;
    const fechas = ordenarFechasDDMMYYYY([
      ...new Set(this.rawData.map((r) => r[idxInspeccion]).filter(Boolean))
    ]);
    if (!fechas.length) {
      showPlagasDialog({
        icon: "info",
        title: t("plagasArandano.noDates"),
        text: t("plagasArandano.noDatesText")
      });
      return;
    }

    const items = [];
    fechas.forEach((fecha) => {
      const filas = this.rawData.filter((r) => r[idxInspeccion] === fecha).map((r) => [...r]);
      const { lotesDuplicados } = this.ejecutarValidacion(filas);
      const filasConError = filas.filter(
        (r) => r._errorLote || (r._errors && r._errors.length > 0)
      );
      items.push({
        fecha,
        lotesDuplicados,
        totalFilas: filas.length,
        filasConError: filasConError.length,
        filasDetalle: filasConError,
        tieneErrores: filasConError.length > 0 || lotesDuplicados.length > 0
      });
    });
    this.mostrarResumenTodasFechas(items);
  }

  procesarTodoExcel() {
    if (!this.excelLoaded || !this.inspectionSelect.value) return;
    this.ocultarResumenTodasFechas();
    this.resetHiddenColumns();
    const idxInspeccion = this.config.filtro_principal.indice_js;
    this.processedData = this.rawData.filter((r) => r[idxInspeccion] === this.inspectionSelect.value);
    this.limpiarMarcasValidacion(this.processedData);
    const { lotesDuplicados } = this.ejecutarValidacion(this.processedData);
    if (lotesDuplicados.length) {
      showPlagasDialog({
        icon: "warning",
        title: t("plagasArandano.duplicateLotsTitle"),
        html: lotesDuplicados.map((l) => htmlEscape(l)).join("<br>")
      });
    }

    const filasConError = this.processedData.filter(
      (r) => r._errorLote || (r._errors && r._errors.length > 0)
    );
    this.renderReviewStats(filasConError, lotesDuplicados);
    this.renderTable();
  }

  updateResultsHeader(filasConError) {
    const total = this.processedData.length;
    const fecha = this.inspectionSelect?.value || "";

    this.resultsSection?.classList.remove("pmpar-results--ok", "pmpar-results--errors");
    this.resultsSection?.classList.add(
      filasConError.length ? "pmpar-results--errors" : "pmpar-results--ok"
    );

    if (this.resultsTitleEl) {
      this.resultsTitleEl.textContent = filasConError.length
        ? t("plagasArandano.errorRowsTitle")
        : t("plagasArandano.allCorrect");
    }

    if (this.resultsSubtitleEl) {
      this.resultsSubtitleEl.textContent = fecha
        ? t("plagasArandano.resultsInspectionDate", { date: fecha })
        : "";
    }

    if (this.resultsIconEl) {
      this.resultsIconEl.innerHTML = filasConError.length
        ? '<i data-lucide="triangle-alert"></i>'
        : '<i data-lucide="circle-check"></i>';
    }

    if (this.totalFilasDiv) {
      this.totalFilasDiv.textContent =
        filasConError.length > 0
          ? t("plagasArandano.resultsErrorSummary", {
              errors: filasConError.length,
              total
            })
          : t("plagasArandano.totalRecords", { count: total });
    }

    this.refreshIcons();
  }

  renderTable() {
    this.resultsHeader.innerHTML = "";
    this.resultsBody.innerHTML = "";

    const filasConError = this.processedData.filter(
      (r) => r._errorLote || (r._errors && r._errors.length > 0)
    );

    this.updateResultsHeader(filasConError);

    if (filasConError.length === 0) {
      const tr = document.createElement("tr");
      tr.className = "pmpar-row-ok";
      const td = document.createElement("td");
      td.colSpan = Math.max(this.getVisibleColumnCount(), 1);
      td.textContent = t("plagasArandano.noErrorsOnInspection");
      tr.appendChild(td);
      this.resultsBody.appendChild(tr);

      showPlagasDialog({
        icon: "success",
        title: t("plagasArandano.allCorrect"),
        text: t("plagasArandano.noErrorsOnInspection")
      });
    } else {
      this.columnsToShow.forEach((colIndex) => {
        this.resultsHeader.appendChild(this.createColumnHeaderTh(colIndex));
      });

      filasConError.forEach((row) => {
        const tr = document.createElement("tr");
        this.columnsToShow.forEach((colIndex) => {
          tr.appendChild(this.createColumnDataTd(row, colIndex));
        });
        this.resultsBody.appendChild(tr);
      });
    }

    this.resultsTable.hidden = false;
    if (this.resultsSection) this.resultsSection.classList.add("is-visible");
    this.applyColumnVisibility();
    this.exportBtn.disabled = false;
  }

  mostrarTotalPorFecha() {
    /* resumen en barra de resultados vía updateResultsHeader */
  }

  renderFechaCards(fechasSeleccionadas, fechaActual) {
    return `
      <div class="pmpar-dialog__fechas">
        ${fechasSeleccionadas
          .map((f) => {
            const esActual = f === fechaActual;
            return `
            <div class="pmpar-dialog__fecha-card${esActual ? " pmpar-dialog__fecha-card--actual" : " pmpar-dialog__fecha-card--removable"}">
              <span class="pmpar-dialog__fecha-text">${htmlEscape(f)}</span>
              ${
                esActual
                  ? ""
                  : `<button type="button" class="pmpar-dialog__fecha-delete" data-fecha="${htmlEscape(f)}" aria-label="${htmlEscape(t("plagasArandano.removeDate"))}">
                      <i data-lucide="x" aria-hidden="true"></i>
                    </button>`
              }
            </div>`;
          })
          .join("")}
      </div>`;
  }

  onExportClick() {
    if (!this.processedData.length) return;
    if (!ensureXlsxLibrary()) return;

    const idxInspeccion = this.config.filtro_principal.indice_js;
    let fechasSeleccionadas = [...new Set(this.rawData.map((r) => r[idxInspeccion]).filter(Boolean))];
    const fechaActual = this.inspectionSelect.value;

    const buildHtml = () => `
      <div class="pmpar-dialog__export">
        <div class="pmpar-dialog__export-meta">
          <span class="pmpar-dialog__export-label">${htmlEscape(t("plagasArandano.exportReviewDate"))}</span>
          <strong class="pmpar-dialog__export-value">${htmlEscape(fechaActual)}</strong>
        </div>
        <div class="pmpar-dialog__export-section">
          <span class="pmpar-dialog__export-label">${htmlEscape(t("plagasArandano.exportJoinDates"))}</span>
          ${this.renderFechaCards(fechasSeleccionadas, fechaActual)}
        </div>
      </div>`;

    const overlay = document.createElement("div");
    overlay.className = "pmpar-dialog-overlay";
    overlay.innerHTML = `
      <div class="pmpar-dialog pmpar-dialog--wide">
        <h3 class="pmpar-dialog__title">${t("plagasArandano.exportTitle")}</h3>
        <div class="pmpar-dialog__html" id="pmparExportDialogBody">${buildHtml()}</div>
        <div class="pmpar-dialog__actions">
          <button type="button" class="pmpar-dialog__btn pmpar-dialog__btn--primary" data-action="confirm">${t("plagasArandano.exportThisDate")}</button>
          <button type="button" class="pmpar-dialog__btn pmpar-dialog__btn--secondary" data-action="deny">${t("plagasArandano.exportJoinSelected")}</button>
          <button type="button" class="pmpar-dialog__btn pmpar-dialog__btn--ghost" data-action="cancel">${t("plagasArandano.cancel")}</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);
    hydrateLucideIcons(overlay);

    const bodyEl = overlay.querySelector("#pmparExportDialogBody");
    const refreshExportDialog = () => {
      bodyEl.innerHTML = buildHtml();
      hydrateLucideIcons(overlay);
    };

    bodyEl.addEventListener("click", (event) => {
      const btn = event.target.closest(".pmpar-dialog__fecha-delete");
      if (!btn) return;
      const f = btn.dataset.fecha;
      if (f === fechaActual) return;
      fechasSeleccionadas = fechasSeleccionadas.filter((x) => x !== f);
      refreshExportDialog();
    });

    overlay.addEventListener("click", (event) => {
      const action = event.target.closest("[data-action]")?.dataset.action;
      if (!action) {
        if (event.target === overlay) {
          overlay.remove();
        }
        return;
      }

      if (action === "confirm") {
        this.exportExcelFiltrado(
          this.processedData,
          `Export_Plaga_Arandano_${fechaActual.replaceAll("/", "-")}.xlsx`
        );
      } else if (action === "deny") {
        const dataUnida = this.rawData.filter((r) => fechasSeleccionadas.includes(r[idxInspeccion]));
        this.exportExcelFiltrado(dataUnida, "Export_Plaga_Arandano_Fechas_Unidas.xlsx");
      }
      overlay.remove();
    });
  }

  columnaExportComoNumero(jsCol) {
    return (
      (jsCol >= 14 && jsCol <= 16) ||
      (jsCol >= 28 && jsCol <= 110 && jsCol !== 71)
    );
  }

  valorExportConNumeroParcial(val, jsCol) {
    if (val === undefined || val === null) return undefined;
    if (typeof val === "string" && val.trim() === "") return undefined;
    if (!this.columnaExportComoNumero(jsCol)) return val;
    const n = parseFlexibleNumber(val);
    if (Number.isNaN(n)) return valorCeldaParaMostrar(val);
    return n;
  }

  estiloExportCeldaError(cellClass) {
    const exp = this.config.exportacion || {};
    const isEmpty = cellClass === "pmpar-cell-error-empty";
    if (isEmpty) {
      return {
        fill: {
          patternType: "solid",
          fgColor: { rgb: exp.color_celda_vacia_rgb || "FFC94C4C" }
        },
        font: {
          color: { rgb: exp.color_celda_vacia_texto_rgb || "FFFFFFFF" },
          bold: true
        }
      };
    }
    return {
      fill: {
        patternType: "solid",
        fgColor: { rgb: exp.color_celda_valor_rgb || "FFFEE2E2" }
      },
      font: {
        color: { rgb: exp.color_celda_valor_texto_rgb || "FFC94C4C" },
        bold: true
      }
    };
  }

  celdaExportConEstilo(row, colIndex) {
    const val = this.valorExportConNumeroParcial(row[colIndex], colIndex);
    const { cellClass } = this.getCellRenderMeta(row, colIndex);
    if (!cellClass) {
      if (val === undefined) return "";
      return val;
    }
    return {
      v: val === undefined ? "" : val,
      t: typeof val === "number" ? "n" : "s",
      s: this.estiloExportCeldaError(cellClass)
    };
  }

  exportExcelCompletoErroresResaltados() {
    if (!this.excelLoaded || !this.rawData.length) return;
    if (!ensureXlsxLibrary()) return;

    const COLS = this.config.total_columnas || 111;
    const filas = this.rawData.map((r) => [...r]);
    this.ejecutarValidacion(filas);

    const wsData = [
      this.columns.map((col) => ({
        v: col.header,
        t: "s",
        s: { font: { bold: true } }
      }))
    ];
    filas.forEach((row) => {
      const linea = [];
      for (let c = 0; c < COLS; c++) {
        linea.push(this.celdaExportConEstilo(row, c));
      }
      wsData.push(linea);
    });

    const wb = window.XLSX.utils.book_new();
    const ws = window.XLSX.utils.aoa_to_sheet(wsData);
    window.XLSX.utils.book_append_sheet(wb, ws, "Plagas");
    const nombre = `Plagas_Arandano_ErroresResaltados_${new Date().toISOString().slice(0, 10)}.xlsx`;
    window.XLSX.writeFile(wb, nombre);

    showPlagasDialog({
      icon: "success",
      title: t("plagasArandano.exportGenerated"),
      text: t("plagasArandano.exportGeneratedHighlight"),
      timer: 2200
    });
  }

  exportExcelFiltrado(data, nombreArchivo) {
    if (!ensureXlsxLibrary()) return;

    const wsData = [];
    wsData.push([
      ...Array.from({ length: 10 }, (_, i) => this.columns[i + 9].header),
      this.columns[19].header,
      "",
      ...Array.from({ length: 5 }, (_, i) => this.columns[i + 28].header),
      "",
      "",
      ...this.columns.slice(33).map((c) => c.header)
    ]);

    data.forEach((row) => {
      wsData.push([
        ...Array.from({ length: 10 }, (_, i) =>
          this.valorExportConNumeroParcial(row[i + 9], i + 9)
        ),
        this.valorExportConNumeroParcial(row[19], 19),
        "",
        ...Array.from({ length: 5 }, (_, i) =>
          this.valorExportConNumeroParcial(row[i + 28], i + 28)
        ),
        "",
        "",
        ...row.slice(33).map((v, i) => this.valorExportConNumeroParcial(v, i + 33))
      ]);
    });

    const wb = window.XLSX.utils.book_new();
    const ws = window.XLSX.utils.aoa_to_sheet(wsData);
    window.XLSX.utils.book_append_sheet(wb, ws, "Export");
    window.XLSX.writeFile(wb, nombreArchivo);
  }

  onClear() {
    this.resetDashboard();
    showPlagasDialog({
      icon: "success",
      title: t("plagasArandano.cleared"),
      text: t("plagasArandano.clearedText"),
      timer: 1200,
      showConfirmButton: false
    });
  }
}
