/** Modo pixel / easter egg de marca (logos + bot + título + AGV→AG* + JSON de hectáreas anonimizado). */

import { appConfig } from "../config/app.config.js";

const STORAGE_KEY = "agv-mi-brand-pixel";

const PATHS = {
  logo: "presentation/images/logo.png",
  logoPixel: "presentation/images/logo-pixelar.png",
  mark: "presentation/images/logo%20-%20copia.png",
  markPixel: "presentation/images/logo%20-%20copia-pixelar.png",
  bot: "presentation/images/bot.png",
  botPixel: "presentation/images/bot-desenfocado.png",
  cover:
    "https://res.cloudinary.com/qc9glj4k/image/upload/f_auto,q_auto,w_1672/v1784039085/mi-portada_x892bg.png",
  coverPixel:
    "https://res.cloudinary.com/qc9glj4k/image/upload/v1784818988/mi-portada_x892bg_1_apjcls.webp"
};

const ATTRS = ["title", "aria-label", "placeholder", "alt"];

function versionQs() {
  return `?v=${appConfig.cacheBustingVersion}`;
}

/**
 * Texto que viene del JSON (variedad, etapa, campo, cultivo, fundo visible).
 * a/A → @ y dígitos +100. No usar en labels i18n de la UI.
 */
export function maskIncognitoJsonText(value) {
  if (!isBrandPixelMode()) return String(value ?? "");
  return String(value ?? "")
    .replace(/[aA]/g, "@")
    .replace(/\d+/g, (digits) => String(Number(digits) + 100));
}

/** Número del JSON (ha, conteos): +100 en modo incógnito. */
export function maskIncognitoNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return isBrandPixelMode() ? n + 100 : n;
}

/**
 * Respuestas del asistente en incógnito: solo tapa marca.
 * NO aplica a→@ al texto completo (eso solo va en datos JSON: fundo, variedad, etc.).
 */
export function finalizeIncognitoAiText(text) {
  return maskBrandText(String(text ?? ""));
}

export function isBrandPixelMode() {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setBrandPixelMode(enabled) {
  try {
    if (enabled) sessionStorage.setItem(STORAGE_KEY, "1");
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function getBrandAcronym() {
  return isBrandPixelMode() ? "AG*" : "AGV";
}

/** En modo pixel: Agrovisión → agroexportadora, AGV → AG*. */
export function maskBrandText(text) {
  const value = String(text ?? "");
  if (!isBrandPixelMode()) return value;
  return value
    .replace(/\bAgrovisi[oó]n(?:\s+Per[uú])?(?:\s+SAC)?\b/gi, "agroexportadora")
    .replace(/\bAgrovision\b/gi, "agroexportadora")
    .replace(/\bAGV\b/g, "AG*");
}

export function getBrandLogoPath() {
  return isBrandPixelMode() ? PATHS.logoPixel : PATHS.logo;
}

export function getBrandMarkPath() {
  return isBrandPixelMode() ? PATHS.markPixel : PATHS.mark;
}

export function getBotImagePath() {
  return isBrandPixelMode() ? PATHS.botPixel : PATHS.bot;
}

export function getBotImageSrc() {
  return `${getBotImagePath()}${versionQs()}`;
}

export function getCoverImageSrc() {
  return isBrandPixelMode() ? PATHS.coverPixel : PATHS.cover;
}

export function getAppDocumentTitle() {
  return isBrandPixelMode() ? "MI" : appConfig.appName;
}

function rewriteBrandInString(value, toPixel) {
  const text = String(value ?? "");
  if (toPixel) return text.replace(/\bAGV\b/g, "AG*");
  return text.replace(/\bAG\*/g, "AGV");
}

/** Reescribe AGV ↔ AG* en textos e atributos visibles del DOM. */
export function applyBrandPixelText(root = document.body) {
  if (!root) return;
  const toPixel = isBrandPixelMode();

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (parent.closest("script, style, noscript, textarea, code, pre")) {
        return NodeFilter.FILTER_REJECT;
      }
      const value = node.nodeValue;
      if (!value) return NodeFilter.FILTER_REJECT;
      if (toPixel ? !value.includes("AGV") : !value.includes("AG*")) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    }
  });

  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach((node) => {
    node.nodeValue = rewriteBrandInString(node.nodeValue, toPixel);
  });

  const scope = root instanceof Element ? root : document.body;
  scope.querySelectorAll(ATTRS.map((a) => `[${a}]`).join(",")).forEach((el) => {
    ATTRS.forEach((attr) => {
      if (!el.hasAttribute(attr)) return;
      const current = el.getAttribute(attr);
      if (!current) return;
      if (toPixel ? !current.includes("AGV") : !current.includes("AG*")) return;
      el.setAttribute(attr, rewriteBrandInString(current, toPixel));
    });
  });
}

/** Limpia enmascarado viejo del sidebar (ya no se aplica ahí). */
function restoreLegacySidebarIncognitoMask() {
  const panel = document.querySelector(".sidebar__primary-panel");
  if (!panel) return;
  panel.querySelectorAll("[data-incognito-original]").forEach((el) => {
    el.textContent = el.getAttribute("data-incognito-original");
    el.removeAttribute("data-incognito-original");
  });
  panel.querySelectorAll("[data-incognito-tooltip-original]").forEach((el) => {
    el.setAttribute("data-sidebar-tooltip", el.getAttribute("data-incognito-tooltip-original"));
    el.removeAttribute("data-incognito-tooltip-original");
  });
}

/** Aplica logos, bot FAB, título y AGV/AG*. */
export function applyBrandPixelAssets() {
  const v = versionQs();
  const shell = document.getElementById("applicationRoot");
  const collapsed = Boolean(shell?.classList.contains("is-sidebar-collapsed"));
  const logo = document.getElementById("imgApplicationLogo");

  if (logo) {
    logo.src = `./${collapsed ? getBrandMarkPath() : getBrandLogoPath()}${v}`;
  }

  document.querySelectorAll(".agv-pt-ai__fab-img, .sidebar-ai-trigger__img").forEach((img) => {
    img.src = getBotImageSrc();
  });

  document.querySelectorAll("img.inicio-cover__bg").forEach((img) => {
    img.src = getCoverImageSrc();
  });

  document.title = getAppDocumentTitle();
  restoreLegacySidebarIncognitoMask();
  applyBrandPixelText(document.body);
}

export function toggleBrandPixelMode() {
  setBrandPixelMode(!isBrandPixelMode());
  applyBrandPixelAssets();
  window.dispatchEvent(new CustomEvent("agv:brand-pixel-changed"));
  return isBrandPixelMode();
}
