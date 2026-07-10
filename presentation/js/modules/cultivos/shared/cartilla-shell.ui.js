import { i18nService } from "../../../services/i18n.service.js";
import { hydrateLucideIcons } from "../../../utils/lucide-icon.util.js";

function t(i18nPrefix, key, vars = {}) {
  let text = i18nService.translate(`${i18nPrefix}.${key}`);
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

export class CartillaShellUi {
  constructor({ root, ids, cssPrefix, i18nPrefix = "plagasArandano" }) {
    this.root = root;
    this.ids = ids;
    this.cssPrefix = cssPrefix;
    this.i18nPrefix = i18nPrefix;
    this.refs = {};
  }

  cls(part) {
    return `${this.cssPrefix}-${part}`;
  }

  cacheDom() {
    const q = (id) => this.root.querySelector(`#${id}`);
    const ids = this.ids;

    this.refs = {
      fileInput: q(ids.fileInput),
      runReviewBtn: q(ids.runReview),
      reviewAllBtn: q(ids.reviewAll),
      exportExcelErroresBtn: q(ids.exportErrors),
      clearBtn: q(ids.clear),
      exportBtn: q(ids.exportFiltered),
      inspectionSelect:
        (ids.inspectionDate && q(ids.inspectionDate)) ||
        (ids.packagingDate && q(ids.packagingDate)),
      inspectionTypeSelect: ids.inspectionType ? q(ids.inspectionType) : null,
      lmrSelect: ids.lmrDate ? q(ids.lmrDate) : null,
      notificationIcon: ids.notificationIcon ? q(ids.notificationIcon) : null,
      notificationCount: ids.notificationCount ? q(ids.notificationCount) : null,
      cosechaSelect: ids.harvestDate ? q(ids.harvestDate) : null,
      resultsHeader: q(ids.resultsHeader),
      resultsBody: q(ids.resultsBody),
      resultsTable: q(ids.resultsTable),
      resumenTodasFechasEl: q(ids.resumenTodas),
      resultsSection: q(ids.resultsSection),
      totalFilasDiv: q(ids.totalFilas),
      resultsTitleEl: q(ids.resultsTitle),
      resultsSubtitleEl: q(ids.resultsSubtitle),
      resultsIconEl: q(ids.resultsIcon),
      fileFieldEl: q(ids.fileWrap),
      reviewStatsEl: q(ids.reviewStats),
      liveBadgeEl: q(ids.liveBadge),
      liveLabelEl: q(ids.liveLabel),
      excelInsightEl: q(ids.excelInsight),
      tableSearchWrap: ids.tableSearchWrap ? q(ids.tableSearchWrap) : null,
      tableSearch: ids.tableSearch ? q(ids.tableSearch) : null,
      tableWrap: ids.tableWrap ? q(ids.tableWrap) : null,
      colMenuEl: ids.colMenu ? q(ids.colMenu) : null
    };

    return this.refs;
  }

  setLiveStatus(active) {
    const { liveBadgeEl, liveLabelEl } = this.refs;
    if (liveBadgeEl) {
      liveBadgeEl.classList.toggle("is-live", active);
      liveBadgeEl.title = t(
        this.i18nPrefix,
        active ? "liveTitleActive" : "liveTitleIdle"
      );
    }
    if (liveLabelEl) {
      liveLabelEl.textContent = t(this.i18nPrefix, "liveIdle");
    }
  }

  renderExcelInsightEmpty() {
    const { excelInsightEl } = this.refs;
    if (!excelInsightEl) return;

    excelInsightEl.className = `${this.cls("excel-insight")} ${this.cls("excel-insight")}--empty`;
    excelInsightEl.innerHTML = `
      <div class="${this.cls("excel-insight__body")}">
        <div class="${this.cls("excel-insight__placeholder")}">
          <i data-lucide="file-spreadsheet" aria-hidden="true"></i>
          <p>${htmlEscape(t(this.i18nPrefix, "excelInsightEmpty"))}</p>
        </div>
      </div>`;
    hydrateLucideIcons(excelInsightEl);
  }

  setAuxButtonsDisabled(disabled) {
    const { reviewAllBtn, exportExcelErroresBtn } = this.refs;
    [reviewAllBtn, exportExcelErroresBtn].forEach((btn) => {
      if (btn) btn.disabled = disabled;
    });
  }

  resetDashboard({ preserveFileInput = false } = {}) {
    const refs = this.refs;

    if (refs.resultsHeader) refs.resultsHeader.innerHTML = "";
    if (refs.resultsBody) refs.resultsBody.innerHTML = "";
    if (refs.resultsTable) refs.resultsTable.hidden = true;
    if (refs.resultsSection) {
      refs.resultsSection.classList.remove("is-visible", `${this.cls("results")}--ok`, `${this.cls("results")}--errors`);
    }
    if (refs.resultsSubtitleEl) refs.resultsSubtitleEl.textContent = "";
    if (refs.resultsIconEl) {
      refs.resultsIconEl.innerHTML = '<i data-lucide="triangle-alert"></i>';
    }

    if (refs.inspectionSelect) {
      refs.inspectionSelect.innerHTML = `<option value="" disabled selected>${htmlEscape(t(this.i18nPrefix, "selectDate"))}</option>`;
      refs.inspectionSelect.disabled = true;
    }

    if (refs.inspectionTypeSelect) {
      const moduleKey = this.i18nPrefix.startsWith("pt")
        ? `${this.i18nPrefix.charAt(2).toLowerCase()}${this.i18nPrefix.slice(3)}Pt`
        : `${this.i18nPrefix.charAt(6).toLowerCase()}${this.i18nPrefix.slice(7)}Mp`;
      const cartillaLabel =
        i18nService.translate(`${moduleKey}.selectCartilla`) ||
        i18nService.translate("arandanoMp.selectCartilla");
      const cartillaText =
        cartillaLabel === `${moduleKey}.selectCartilla` || cartillaLabel === "arandanoMp.selectCartilla"
          ? "Selecciona tipo"
          : cartillaLabel;
      refs.inspectionTypeSelect.innerHTML = `<option value="" disabled selected>${htmlEscape(cartillaText)}</option>`;
      refs.inspectionTypeSelect.disabled = true;
    }

    if (refs.lmrSelect) {
      const moduleKey = this.i18nPrefix.startsWith("pt")
        ? `${this.i18nPrefix.charAt(2).toLowerCase()}${this.i18nPrefix.slice(3)}Pt`
        : `${this.i18nPrefix.charAt(6).toLowerCase()}${this.i18nPrefix.slice(7)}Mp`;
      const lmrLabel =
        i18nService.translate(`${moduleKey}.lmrAutoDate`) ||
        i18nService.translate("arandanoMp.lmrAutoDate");
      const lmrText =
        lmrLabel === `${moduleKey}.lmrAutoDate` || lmrLabel === "arandanoMp.lmrAutoDate"
          ? "Se actualizará automáticamente"
          : lmrLabel;
      refs.lmrSelect.innerHTML = `<option value="" selected>${htmlEscape(lmrText)}</option>`;
      refs.lmrSelect.disabled = true;
      refs.lmrSelect.classList.remove(`${this.cls("input")}--warning`);
    }

    if (refs.notificationIcon) {
      refs.notificationIcon.classList.remove("error");
      refs.notificationIcon.classList.add("ok");
    }

    if (refs.notificationCount) {
      refs.notificationCount.textContent = "0";
    }

    if (refs.cosechaSelect) {
      refs.cosechaSelect.innerHTML = `<option value="" selected>${htmlEscape(t(this.i18nPrefix, "autoDate"))}</option>`;
      refs.cosechaSelect.disabled = true;
      refs.cosechaSelect.classList.remove(`${this.cls("input")}--warning`);
    }

    if (refs.runReviewBtn) refs.runReviewBtn.disabled = true;
    if (refs.exportBtn) refs.exportBtn.disabled = true;
    if (!preserveFileInput && refs.fileInput) {
      refs.fileInput.value = "";
      refs.fileInput.removeAttribute("title");
    }
    if (!preserveFileInput && refs.fileFieldEl) refs.fileFieldEl.classList.remove("is-loaded");

    if (refs.reviewStatsEl) {
      refs.reviewStatsEl.innerHTML = "";
      refs.reviewStatsEl.hidden = true;
    }

    if (refs.resumenTodasFechasEl) {
      refs.resumenTodasFechasEl.innerHTML = "";
      refs.resumenTodasFechasEl.hidden = true;
    }

    if (refs.totalFilasDiv) refs.totalFilasDiv.textContent = "";

    this.setAuxButtonsDisabled(true);
    this.setLiveStatus(false);
    this.renderExcelInsightEmpty();
    if (refs.resultsIconEl) hydrateLucideIcons(refs.resultsIconEl);
  }
}
