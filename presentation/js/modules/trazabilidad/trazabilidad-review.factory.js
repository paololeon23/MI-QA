import { GenericModuleController } from "../module-page.factory.js";
import { applyTranslationsToContainer } from "../../utils/i18n-dom.util.js";
import { refreshModuleLanguage } from "../../utils/module-i18n.util.js";
import { i18nService } from "../../services/i18n.service.js";
import { hydrateLucideIcons } from "../../utils/lucide-icon.util.js";
import { appConfig } from "../../config/app.config.js";
import {
  EXPECTED_TRACE_LEN,
  TRACE_SEGMENTS,
  normalizeTraceCode,
  resolveTraceability
} from "./pe-traceability.parse.js";

const CATALOG_URL = `presentation/data/pe-traceability.catalog.json?v=${appConfig.cacheBustingVersion}`;

function t(key, vars = {}) {
  let text = i18nService.translate(key);
  Object.entries(vars).forEach(([name, value]) => {
    text = text.replaceAll(`{{${name}}}`, String(value));
  });
  return text;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function createTraceReviewController(options) {
  const {
    countryKey = "PERU",
    titleKey,
    inputLabelKey,
    examplePlaceholder = "4A07A00125216"
  } = options;

  return class TraceReviewModuleController extends GenericModuleController {
    constructor(moduleContext) {
      super(moduleContext);
      this.catalog = null;
      this.countryKey = countryKey;
    }

    async mount() {
      super.mount();
      const root = document.querySelector("[data-trz-review]") || document.getElementById("moduleRoot");
      if (!root) return;

      this.root = root;
      this.input = root.querySelector("[data-trz-input]");
      this.splitBtn = root.querySelector("[data-trz-split]");
      this.clearBtn = root.querySelector("[data-trz-clear]");
      this.errorEl = root.querySelector("[data-trz-error]");
      this.splitBox = root.querySelector("[data-trz-split-box]");
      this.matrix = root.querySelector("[data-trz-matrix]");
      this.meaningBox = root.querySelector("[data-trz-meaning]");
      this.meaningGrid = root.querySelector("[data-trz-meaning-grid]");

      applyTranslationsToContainer(root, { hydrateIcons: false });
      if (titleKey) {
        const title = root.querySelector("[data-trz-title]");
        if (title) title.textContent = t(titleKey);
      }
      if (inputLabelKey) {
        const labelText = root.querySelector("[data-trz-label-text]");
        if (labelText) labelText.textContent = t(inputLabelKey);
      }
      if (this.input && !this.input.value) {
        this.input.placeholder = examplePlaceholder;
      }

      this.bindEvents();
      hydrateLucideIcons(root);
      this.renderEmpty();

      try {
        this.catalog = await this.loadCatalog();
      } catch {
        this.showError(t("trazabilidadReview.catalogError"));
      }
    }

    async loadCatalog() {
      const response = await fetch(CATALOG_URL);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    }

    bindEvents() {
      this.onSplit = () => this.renderLive(this.input?.value || "");
      this.onClear = () => {
        if (!this.input) return;
        this.input.value = "";
        this.input.focus();
        this.renderEmpty();
        this.showError("");
      };
      this.onKey = (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          this.renderLive(this.input?.value || "");
        }
      };
      this.onInputNormalize = () => {
        if (!this.input) return;
        const next = normalizeTraceCode(this.input.value);
        if (this.input.value !== next) {
          const pos = this.input.selectionStart;
          this.input.value = next;
          try {
            this.input.setSelectionRange(pos, pos);
          } catch {
            /* ignore */
          }
        }
        this.renderLive(next);
      };

      this.splitBtn?.addEventListener("click", this.onSplit);
      this.clearBtn?.addEventListener("click", this.onClear);
      this.input?.addEventListener("keydown", this.onKey);
      this.input?.addEventListener("input", this.onInputNormalize);
    }

    showError(message) {
      if (!this.errorEl) return;
      if (!message) {
        this.errorEl.hidden = true;
        this.errorEl.textContent = "";
        return;
      }
      this.errorEl.hidden = false;
      this.errorEl.textContent = message;
    }

    renderEmpty() {
      const emptyCells = TRACE_SEGMENTS.map((seg) => ({
        key: seg.key,
        len: seg.len,
        header: seg.header,
        labelKey: seg.labelKey,
        code: "—"
      }));
      this.renderMatrix(emptyCells, { empty: true });
      this.renderMeanings(
        TRACE_SEGMENTS.map((seg) => ({
          key: seg.key,
          labelKey: seg.labelKey,
          code: "—",
          value: null
        }))
      );
    }

    /** Tiempo real: actualiza matriz + detalle al escribir. */
    renderLive(raw) {
      const code = normalizeTraceCode(raw);
      this.showError("");

      if (!code) {
        this.renderEmpty();
        return;
      }

      if (code.length < EXPECTED_TRACE_LEN) {
        this.renderEmpty();
        return;
      }

      if (code.length > EXPECTED_TRACE_LEN) {
        this.showError(
          t("trazabilidadReview.lenError", {
            n: EXPECTED_TRACE_LEN,
            current: code.length
          })
        );
        this.renderEmpty();
        return;
      }

      if (!this.catalog) {
        this.showError(t("trazabilidadReview.catalogError"));
        this.renderEmpty();
        return;
      }

      const resolved = resolveTraceability(code, this.catalog, {
        countryKey: this.countryKey
      });
      if (!resolved.ok) {
        this.showError(
          t("trazabilidadReview.lenError", {
            n: resolved.expectedLength,
            current: code.length
          })
        );
        this.renderEmpty();
        return;
      }

      this.renderMatrix(resolved.cells);
      this.renderMeanings(resolved.meanings);
    }

    renderMatrix(cells, options = {}) {
      if (!this.matrix) return;
      const empty = Boolean(options.empty);
      const lenRow = cells.map((c) => `<td class="trz-review__len">${c.len}</td>`).join("");
      const headRow = cells
        .map((c) => {
          const title = c.labelKey ? t(c.labelKey) : c.header;
          return `<th class="trz-review__head" scope="col">${escapeHtml(title)}</th>`;
        })
        .join("");
      const valRow = cells
        .map(
          (c) =>
            `<td class="trz-review__val${empty || c.code === "—" ? " is-empty" : ""}">${escapeHtml(c.code)}</td>`
        )
        .join("");

      this.matrix.innerHTML = `
        <thead>
          <tr>${lenRow}</tr>
          <tr>${headRow}</tr>
        </thead>
        <tbody>
          <tr>${valRow}</tr>
        </tbody>
      `;
    }

    renderMeanings(meanings) {
      if (!this.meaningGrid) return;
      this.meaningGrid.innerHTML = meanings
        .map((item) => {
          const hasValue = Boolean(item.value);
          const warn = item.warnKey ? escapeHtml(t(item.warnKey)) : "";
          const note =
            item.noteKey && item.noteVars
              ? `<p class="trz-review__card-meta">${escapeHtml(t(item.noteKey, item.noteVars))}</p>`
              : warn
                ? `<p class="trz-review__card-meta">${warn}</p>`
                : "";
          return `
            <article class="trz-review__card${item.warnKey ? " is-warn" : ""}">
              <div class="trz-review__card-top">
                <span class="trz-review__card-label">${escapeHtml(t(item.labelKey))}</span>
                <code class="trz-review__card-code">${escapeHtml(item.code)}</code>
              </div>
              <p class="trz-review__card-value${hasValue ? "" : " is-empty"}">
                ${hasValue ? escapeHtml(item.value) : "—"}
              </p>
              ${note}
            </article>
          `;
        })
        .join("");
    }

    async onLanguageChange() {
      if (!this.root) return;
      await refreshModuleLanguage(this.root, { hydrateIcons: false });
      const title = this.root.querySelector("[data-trz-title]");
      if (title && titleKey) title.textContent = t(titleKey);
      const labelText = this.root.querySelector("[data-trz-label-text]");
      if (labelText && inputLabelKey) labelText.textContent = t(inputLabelKey);
      hydrateLucideIcons(this.root);
      this.renderLive(this.input?.value || "");
    }

    destroy() {
      this.splitBtn?.removeEventListener("click", this.onSplit);
      this.clearBtn?.removeEventListener("click", this.onClear);
      this.input?.removeEventListener("keydown", this.onKey);
      this.input?.removeEventListener("input", this.onInputNormalize);
    }
  };
}
