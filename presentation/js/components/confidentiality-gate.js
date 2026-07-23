/** Aviso de confidencialidad y uso académico — bloquea la app hasta aceptar. */

import { appConfig } from "../config/app.config.js";
import { i18nService } from "../services/i18n.service.js";
import { toggleBrandPixelMode, isBrandPixelMode } from "../utils/brand-pixel.util.js";

const STORAGE_KEY = "agv-mi-confidentiality-accepted-v15";
const IMAGE_SRC = `presentation/images/bot-desenfocado.png?v=${appConfig.cacheBustingVersion}`;

/** Icono estilo “incógnito” (sombrero + gafas). */
const INCOGNITO_ICON = `
  <svg class="agv-confidentiality-gate__pixel-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
    <path fill="currentColor" d="M12 2.25c-2.35 0-4.4 1.2-5.45 3.05-.35.6.05 1.35.75 1.45h9.4c.7-.1 1.1-.85.75-1.45C16.4 3.45 14.35 2.25 12 2.25Z"/>
    <path fill="currentColor" d="M3.75 8.35h16.5c.55 0 1 .45 1 1v.85c0 .55-.45 1-1 1H3.75c-.55 0-1-.45-1-1v-.85c0-.55.45-1 1-1Z"/>
    <path fill="currentColor" d="M8.1 12.35a3.65 3.65 0 1 0 0 7.3 3.65 3.65 0 0 0 0-7.3Zm0 1.7a1.95 1.95 0 1 1 0 3.9 1.95 1.95 0 0 1 0-3.9Z"/>
    <path fill="currentColor" d="M15.9 12.35a3.65 3.65 0 1 0 0 7.3 3.65 3.65 0 0 0 0-7.3Zm0 1.7a1.95 1.95 0 1 1 0 3.9 1.95 1.95 0 0 1 0-3.9Z"/>
    <path fill="currentColor" d="M11.15 15.55h1.7c.35 0 .65.3.65.65s-.3.65-.65.65h-1.7c-.35 0-.65-.3-.65-.65s.3-.65.65-.65Z"/>
  </svg>
`;

function t(key) {
  return i18nService.translate(key);
}

function alreadyAccepted() {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function markAccepted() {
  try {
    sessionStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* ignore quota / private mode */
  }
}

/**
 * Muestra el aviso a pantalla completa. Resuelve al aceptar.
 * Si ya se aceptó en esta sesión, resuelve de inmediato.
 * @returns {Promise<void>}
 */
export function showConfidentialityGate() {
  if (alreadyAccepted()) return Promise.resolve();

  return new Promise((resolve) => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const overlay = document.createElement("div");
    overlay.className = "agv-confidentiality-gate";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "agv-confidentiality-title");

    overlay.innerHTML = `
      <div class="agv-confidentiality-gate__card">
        <button
          type="button"
          class="agv-confidentiality-gate__pixel${isBrandPixelMode() ? " is-active" : ""}"
          data-action="pixel"
          aria-label="${t("confidentiality.pixelToggle")}"
          title="${t("confidentiality.pixelToggle")}"
        >
          ${INCOGNITO_ICON}
        </button>
        <div class="agv-confidentiality-gate__visual" aria-hidden="true">
          <img
            class="agv-confidentiality-gate__img"
            src="${IMAGE_SRC}"
            alt=""
            width="280"
            height="280"
            decoding="async"
          />
        </div>
        <div class="agv-confidentiality-gate__body">
          <h2 id="agv-confidentiality-title" class="agv-confidentiality-gate__title">
            ${t("confidentiality.title")}
          </h2>
          <p class="agv-confidentiality-gate__lead">${t("confidentiality.lead")}</p>
          <div class="agv-confidentiality-gate__points">
            <p>
              <strong>${t("confidentiality.reserveLabel")}</strong>
              ${t("confidentiality.reserveText")}
            </p>
            <p>
              <strong>${t("confidentiality.securityLabel")}</strong>
              ${t("confidentiality.securityText")}
            </p>
          </div>
          <p class="agv-confidentiality-gate__accept-note">${t("confidentiality.acceptNote")}</p>
          <button type="button" class="agv-confidentiality-gate__btn" data-action="accept">
            ${t("confidentiality.acceptBtn")}
          </button>
        </div>
      </div>
    `;

    const finish = () => {
      markAccepted();
      overlay.classList.add("agv-confidentiality-gate--leaving");
      window.setTimeout(() => {
        overlay.remove();
        document.body.style.overflow = prevOverflow;
        resolve();
      }, 220);
    };

    const pixelBtn = overlay.querySelector('[data-action="pixel"]');
    pixelBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      const on = toggleBrandPixelMode();
      pixelBtn.classList.toggle("is-active", on);
    });

    overlay.querySelector('[data-action="accept"]')?.addEventListener("click", finish);
    document.body.appendChild(overlay);

    requestAnimationFrame(() => {
      overlay.classList.add("agv-confidentiality-gate--visible");
      overlay.querySelector('[data-action="accept"]')?.focus();
    });
  });
}
