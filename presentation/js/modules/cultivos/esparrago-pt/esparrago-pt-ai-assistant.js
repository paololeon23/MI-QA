import {
  generatePrimaryAssistantReply,
  getPrimaryAiRouteContext,
  isPrimaryAiRoute
} from "../../../services/gemini.service.js";
import { getBotImageSrc } from "../../../utils/brand-pixel.util.js";
import { i18nService } from "../../../services/i18n.service.js";
import { stateStore } from "../../../core/state-store.js";

/** Preguntas preguardadas = solo datos de pantalla (ha, fundos, variedades, genética). */
const CHIP_CATALOG = {
  "es-PE": {
    inicio: [
      { id: "top-var", label: "¿Qué variedad tiene más hectáreas?", question: "¿qué variedad tiene más hectáreas?" },
      { id: "top-fundo", label: "¿Qué fundo tiene más hectáreas?", question: "¿qué fundo tiene más hectáreas?" },
      { id: "area", label: "¿Cuántas hectáreas hay en total?", question: "¿cuántas hectáreas hay en total?" },
      { id: "top3", label: "Top 3 variedades por hectáreas", question: "dame el top 3 de variedades por hectáreas" },
      { id: "fundos-n", label: "¿Cuántos fundos hay?", question: "¿cuántos fundos hay?" },
      { id: "vars-n", label: "¿Cuántas variedades hay?", question: "¿cuántas variedades hay?" },
      { id: "cultivos", label: "¿Qué cultivos hay?", question: "¿qué cultivos hay en el sistema?" },
      { id: "top-fundos", label: "Top 3 fundos por hectáreas", question: "dame el top 3 de fundos por hectáreas" }
    ],
    variedades: [
      { id: "genetica-top", label: "¿Qué genética tiene más variedades?", question: "¿qué genética tiene más variedades en el catálogo?" },
      { id: "total", label: "¿Cuántas variedades hay en el catálogo?", question: "¿cuántas variedades hay en el catálogo?" },
      { id: "cuantas-gen", label: "¿Cuántas genéticas hay?", question: "¿cuántas genéticas hay en el catálogo?" },
      { id: "visibles", label: "¿Cuántas variedades se ven filtradas?", question: "¿cuántas variedades están visibles con el filtro actual?" }
    ],
    trazabilidad: [
      { id: "codigo", label: "¿Qué código tengo ingresado?", question: "¿qué código de trazabilidad hay ingresado ahora?" },
      { id: "pais", label: "¿Estoy en traza Perú o Chile?", question: "¿estoy en trazabilidad Perú o Chile?" },
      { id: "packing", label: "¿Qué packing muestra el código?", question: "¿qué packing muestra el desglose del código actual?" },
      { id: "desglose", label: "¿Qué valores muestra el desglose?", question: "¿qué valores del desglose del código se ven en pantalla?" }
    ],
    cartillas: [
      { id: "filtro", label: "¿Qué filtro está activo?", question: "¿qué filtro de cartillas está activo?" },
      { id: "total", label: "¿Cuántas cartillas hay?", question: "¿cuántas cartillas hay en el catálogo?" },
      { id: "cultivos", label: "¿Cuántos cultivos hay en cartillas?", question: "¿cuántos cultivos hay en el catálogo de cartillas?" },
      { id: "cultivo", label: "¿Cuántas hay del filtro actual?", question: "¿cuántas cartillas hay del cultivo filtrado?" }
    ],
    fuera: [{ id: "donde", label: "¿En qué módulos me ayudas?", question: "¿en qué módulos ayuda este asistente?" }]
  },
  "en-US": {
    inicio: [
      { id: "top-var", label: "Which variety has the most hectares?", question: "which variety has the most hectares?" },
      { id: "top-fundo", label: "Which farm has the most hectares?", question: "which farm has the most hectares?" },
      { id: "area", label: "How many hectares in total?", question: "how many hectares are there in total?" },
      { id: "top3", label: "Top 3 varieties by hectares", question: "give me the top 3 varieties by hectares" },
      { id: "fundos-n", label: "How many farms are there?", question: "how many farms are there?" },
      { id: "vars-n", label: "How many varieties are there?", question: "how many varieties are there?" },
      { id: "cultivos", label: "Which crops are there?", question: "which crops are in the system?" },
      { id: "top-fundos", label: "Top 3 farms by hectares", question: "give me the top 3 farms by hectares" }
    ],
    variedades: [
      { id: "genetica-top", label: "Which genetics has the most varieties?", question: "which genetics has the most varieties in the catalog?" },
      { id: "total", label: "How many varieties in the catalog?", question: "how many varieties are in the catalog?" },
      { id: "cuantas-gen", label: "How many genetics are there?", question: "how many genetics are in the catalog?" },
      { id: "visibles", label: "How many varieties are visible filtered?", question: "how many varieties are visible with the current filter?" }
    ],
    trazabilidad: [
      { id: "codigo", label: "What code is entered?", question: "what traceability code is entered now?" },
      { id: "pais", label: "Peru or Chile trace?", question: "am I on Peru or Chile traceability?" },
      { id: "packing", label: "Which packing does the code show?", question: "which packing does the current code breakdown show?" },
      { id: "desglose", label: "What values does the breakdown show?", question: "what breakdown values are visible on screen?" }
    ],
    cartillas: [
      { id: "filtro", label: "What filter is active?", question: "what sheet filter is active?" },
      { id: "total", label: "How many sheets are there?", question: "how many inspection sheets are there?" },
      { id: "cultivos", label: "How many crops in sheets?", question: "how many crops are in the sheets catalog?" },
      { id: "cultivo", label: "How many for the current filter?", question: "how many sheets for the filtered crop?" }
    ],
    fuera: [{ id: "donde", label: "Which modules can you help with?", question: "which modules does this assistant help with?" }]
  },
  "fr-MA": {
    inicio: [
      { id: "top-var", label: "Quelle variété a le plus d'hectares ?", question: "quelle variété a le plus d'hectares ?" },
      { id: "top-fundo", label: "Quelle ferme a le plus d'hectares ?", question: "quelle ferme a le plus d'hectares ?" },
      { id: "area", label: "Combien d'hectares au total ?", question: "combien d'hectares y a-t-il au total ?" },
      { id: "top3", label: "Top 3 variétés par hectares", question: "donne le top 3 des variétés par hectares" },
      { id: "fundos-n", label: "Combien de fermes ?", question: "combien de fermes y a-t-il ?" },
      { id: "vars-n", label: "Combien de variétés ?", question: "combien de variétés y a-t-il ?" },
      { id: "cultivos", label: "Quelles cultures y a-t-il ?", question: "quelles cultures y a-t-il dans le système ?" },
      { id: "top-fundos", label: "Top 3 fermes par hectares", question: "donne le top 3 des fermes par hectares" }
    ],
    variedades: [
      { id: "genetica-top", label: "Quelle génétique a le plus de variétés ?", question: "quelle génétique a le plus de variétés dans le catalogue ?" },
      { id: "total", label: "Combien de variétés au catalogue ?", question: "combien de variétés y a-t-il dans le catalogue ?" },
      { id: "cuantas-gen", label: "Combien de génétiques ?", question: "combien de génétiques y a-t-il dans le catalogue ?" },
      { id: "visibles", label: "Combien de variétés filtrées ?", question: "combien de variétés sont visibles avec le filtre actuel ?" }
    ],
    trazabilidad: [
      { id: "codigo", label: "Quel code est saisi ?", question: "quel code de traçabilité est saisi ?" },
      { id: "pais", label: "Pérou ou Chili ?", question: "suis-je en traçabilité Pérou ou Chili ?" },
      { id: "packing", label: "Quel packing apparaît ?", question: "quel packing montre le détail du code actuel ?" },
      { id: "desglose", label: "Quelles valeurs du détail ?", question: "quelles valeurs du détail sont visibles à l'écran ?" }
    ],
    cartillas: [
      { id: "filtro", label: "Quel filtre est actif ?", question: "quel filtre de fiches est actif ?" },
      { id: "total", label: "Combien de fiches ?", question: "combien de fiches y a-t-il ?" },
      { id: "cultivos", label: "Combien de cultures en fiches ?", question: "combien de cultures y a-t-il dans le catalogue de fiches ?" },
      { id: "cultivo", label: "Combien pour le filtre actuel ?", question: "combien de fiches pour la culture filtrée ?" }
    ],
    fuera: [{ id: "donde", label: "Quels modules peux-tu aider ?", question: "dans quels modules cet assistant aide-t-il ?" }]
  },
  "zh-CN": {
  inicio: [
      { id: "top-var", label: "哪个品种公顷最多？", question: "哪个品种公顷数最多？" },
      { id: "top-fundo", label: "哪个农场公顷最多？", question: "哪个农场公顷数最多？" },
      { id: "area", label: "总共有多少公顷？", question: "总共有多少公顷？" },
      { id: "top3", label: "公顷前三品种", question: "按公顷给出前三品种" },
      { id: "fundos-n", label: "有多少农场？", question: "有多少农场？" },
      { id: "vars-n", label: "有多少品种？", question: "有多少品种？" },
      { id: "cultivos", label: "有哪些作物？", question: "系统里有哪些作物？" },
      { id: "top-fundos", label: "公顷前三农场", question: "按公顷给出前三农场" }
  ],
  variedades: [
      { id: "genetica-top", label: "哪个遗传学品种最多？", question: "目录里哪个遗传学拥有最多品种？" },
      { id: "total", label: "目录里有多少品种？", question: "目录里有多少品种？" },
      { id: "cuantas-gen", label: "有多少遗传学？", question: "目录里有多少遗传学？" },
      { id: "visibles", label: "筛选后可见多少品种？", question: "当前筛选下可见多少品种？" }
  ],
  trazabilidad: [
      { id: "codigo", label: "当前编码是什么？", question: "当前输入了什么追溯编码？" },
      { id: "pais", label: "秘鲁还是智利？", question: "我现在在秘鲁还是智利追溯？" },
      { id: "packing", label: "显示哪个 packing？", question: "当前编码拆解显示哪个 packing？" },
      { id: "desglose", label: "拆解显示哪些值？", question: "屏幕上拆解显示了哪些值？" }
  ],
  cartillas: [
      { id: "filtro", label: "当前筛选是什么？", question: "当前检查卡筛选是什么？" },
      { id: "total", label: "有多少检查卡？", question: "有多少检查卡？" },
      { id: "cultivos", label: "检查卡有多少作物？", question: "检查卡目录里有多少作物？" },
      { id: "cultivo", label: "当前筛选有多少？", question: "筛选作物有多少检查卡？" }
    ],
    fuera: [{ id: "donde", label: "支持哪些模块？", question: "这个助手支持哪些模块？" }]
  }
};

/** Cola visible por ruta: al pulsar se elimina y entra otra. */
const chipVisibleByRoute = Object.create(null);
const chipQueueByRoute = Object.create(null);

const WAIT_BY_LANG = {
  "es-PE": ["preparando respuesta…", "revisando los datos…", "casi listo…"],
  "en-US": ["preparing answer…", "checking data…", "almost ready…"],
  "fr-MA": ["préparation…", "vérification des données…", "presque prêt…"],
  "zh-CN": ["正在准备…", "正在查看数据…", "马上好…"]
};

function normalizeLangCode(raw = "") {
  const s = String(raw || "").trim();
  if (!s) return "";
  if (s.startsWith("zh")) return "zh-CN";
  if (s.startsWith("en")) return "en-US";
  if (s.startsWith("fr")) return "fr-MA";
  if (s.startsWith("es")) return "es-PE";
  return s;
}

function currentLang() {
  try {
    const fromStore = stateStore?.get?.()?.currentLanguage;
    const fromService = i18nService?.getActiveLanguage?.() || i18nService?.activeLanguage;
    const fromHtml = document.documentElement?.lang;
    const fromI18next = window.i18next?.language;
    return (
      normalizeLangCode(fromStore) ||
      normalizeLangCode(fromService) ||
      normalizeLangCode(fromHtml) ||
      normalizeLangCode(fromI18next) ||
      "es-PE"
    );
  } catch {
    return "es-PE";
  }
}

function waitPhrase(step = 0) {
  const list = WAIT_BY_LANG[currentLang()] || WAIT_BY_LANG["es-PE"];
  return list[Math.min(step, list.length - 1)] || list[0];
}

function greetingWord() {
  const lang = currentLang();
  if (String(lang).startsWith("zh")) return "你好";
  if (String(lang).startsWith("en")) return "hello";
  if (String(lang).startsWith("fr")) return "bonjour";
  return "hola";
}

function tPrimary(key, fallback = "") {
  try {
    const value = i18nService?.translate?.(key);
    if (value && value !== key) return value;
  } catch {
    /* ignore */
  }
  return fallback;
}

function aiUiText() {
  // Toda palabrita del chrome sale de i18n (idioma UI).
  return {
    eyebrow: tPrimary("primaryAi.eyebrow", "Asistente IA"),
    titleHelp: tPrimary("primaryAi.titleHelp", "ayuda"),
    titleOutside: tPrimary("primaryAi.titleOutside", "solo menú principal"),
    hint: tPrimary("primaryAi.hint", ""),
    placeholder: tPrimary("primaryAi.placeholder", "escribe tu pregunta…"),
    send: tPrimary("primaryAi.send", "Enviar"),
    close: tPrimary("primaryAi.close", "Cerrar"),
    fab: tPrimary("primaryAi.fab", "Abrir Asistente IA"),
    cloud: tPrimary("primaryAi.cloud", "¡Resumen IA!"),
    yourQuestion: tPrimary("primaryAi.yourQuestion", "tu pregunta:"),
    moduleMeta: tPrimary("primaryAi.moduleMeta", "módulo"),
    outOfScope: tPrimary("primaryAi.outOfScope", "fuera de alcance"),
    noAnswer: tPrimary("primaryAi.noAnswer", "no hay respuesta ahora. prueba de nuevo."),
    cancelled: tPrimary("primaryAi.cancelled", "la consulta se canceló. envía de nuevo tu pregunta."),
    failed: tPrimary("primaryAi.failed", "no se pudo responder"),
    defaultAsk: tPrimary("primaryAi.defaultAsk", "dame un resumen corto de este módulo"),
    wait1: tPrimary("primaryAi.wait1", "preparando respuesta…"),
    wait2: tPrimary("primaryAi.wait2", "revisando los datos…"),
    wait3: tPrimary("primaryAi.wait3", "casi listo…")
  };
}

function chipPoolForRoute(routeId) {
  const lang = currentLang();
  const pack =
    CHIP_CATALOG[lang] ||
    (String(lang).startsWith("en")
      ? CHIP_CATALOG["en-US"]
      : String(lang).startsWith("fr")
        ? CHIP_CATALOG["fr-MA"]
        : String(lang).startsWith("zh")
          ? CHIP_CATALOG["zh-CN"]
          : CHIP_CATALOG["es-PE"]);
  return pack[routeId] || pack.fuera || CHIP_CATALOG["es-PE"].fuera;
}

function resetChipQueues() {
  Object.keys(chipVisibleByRoute).forEach((k) => delete chipVisibleByRoute[k]);
  Object.keys(chipQueueByRoute).forEach((k) => delete chipQueueByRoute[k]);
}

function shuffleCopy(list = []) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

function ensureChipQueue(routeId) {
  const pool = chipPoolForRoute(routeId);
  if (!pool.length) {
    chipVisibleByRoute[routeId] = [];
    chipQueueByRoute[routeId] = [];
    return;
  }
  if (!chipVisibleByRoute[routeId]?.length && !chipQueueByRoute[routeId]?.length) {
    chipQueueByRoute[routeId] = shuffleCopy(pool);
    chipVisibleByRoute[routeId] = chipQueueByRoute[routeId].splice(0, Math.min(3, pool.length));
  }
}

/** Tras pulsar: saca esa pregunta y mete otra distinta. */
function consumeChip(routeId, usedId) {
  ensureChipQueue(routeId);
  const visible = chipVisibleByRoute[routeId] || [];
  chipVisibleByRoute[routeId] = visible.filter((c) => c.id !== usedId);
  let queue = chipQueueByRoute[routeId] || [];
  if (!queue.length) {
    const pool = chipPoolForRoute(routeId);
    const shown = new Set(chipVisibleByRoute[routeId].map((c) => c.id));
    shown.add(usedId);
    queue = shuffleCopy(pool.filter((c) => !shown.has(c.id)));
    if (!queue.length) queue = shuffleCopy(pool.filter((c) => c.id !== usedId));
    chipQueueByRoute[routeId] = queue;
  }
  while (chipVisibleByRoute[routeId].length < 3 && chipQueueByRoute[routeId].length) {
    const next = chipQueueByRoute[routeId].shift();
    if (!next) break;
    if (chipVisibleByRoute[routeId].some((c) => c.id === next.id)) continue;
    chipVisibleByRoute[routeId].push(next);
  }
}

function pickSmartChips(routeId, count = 3) {
  ensureChipQueue(routeId);
  return (chipVisibleByRoute[routeId] || []).slice(0, count);
}

function currentPrompts() {
  const ctx = getPrimaryAiRouteContext();
  return pickSmartChips(ctx.id || "fuera", 3);
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

let mounted = null;

/**
 * Bot flotante esquina inferior derecha.
 * Solo visible en Inicio, Variedades, Trazabilidad y Cartillas.
 */
export function mountSidebarAiAssistant() {
  if (mounted) {
    mounted.syncVisibility();
    return mounted;
  }

  document.getElementById("btnSidebarAiAssistant")?.remove();

  const host = document.createElement("div");
  host.id = "agv-pt-ai-assistant";
  host.className = "agv-pt-ai";
  host.setAttribute("data-module", "primary-ai");
  const ui0 = aiUiText();
  host.innerHTML = `
    <div class="agv-pt-ai__panel" id="agv-pt-ai-panel" hidden>
      <header class="agv-pt-ai__panel-head">
        <div>
          <p class="agv-pt-ai__eyebrow" id="agv-pt-ai-eyebrow">${htmlEscape(ui0.eyebrow)}</p>
          <h4 class="agv-pt-ai__title" id="agv-pt-ai-title">${htmlEscape(ui0.titleHelp)}</h4>
        </div>
        <button type="button" class="agv-pt-ai__close" id="agv-pt-ai-close" aria-label="${htmlEscape(ui0.close)}">×</button>
      </header>
      <div class="agv-pt-ai__body" id="agv-pt-ai-body">
        <p class="agv-pt-ai__hint" id="agv-pt-ai-hint" hidden></p>
        <div class="agv-pt-ai__answer" id="agv-pt-ai-answer" hidden></div>
      </div>
      <div class="agv-pt-ai__chips" id="agv-pt-ai-chips"></div>
    </div>
    <button type="button" class="agv-pt-ai__fab" id="agv-pt-ai-fab" aria-label="${htmlEscape(ui0.fab)}" title="${htmlEscape(ui0.fab)}">
      <img class="agv-pt-ai__fab-img" id="agv-pt-ai-fab-img" alt="" width="56" height="56" />
    </button>
  `;
  document.body.appendChild(host);

  const panel = host.querySelector("#agv-pt-ai-panel");
  const fab = host.querySelector("#agv-pt-ai-fab");
  const fabImg = host.querySelector("#agv-pt-ai-fab-img");
  const closeBtn = host.querySelector("#agv-pt-ai-close");
  const answerEl = host.querySelector("#agv-pt-ai-answer");
  const chipsEl = host.querySelector("#agv-pt-ai-chips");
  const titleEl = host.querySelector("#agv-pt-ai-title");
  const hintEl = host.querySelector("#agv-pt-ai-hint");
  const eyebrowEl = host.querySelector("#agv-pt-ai-eyebrow");

  let busy = false;
  let abortCtrl = null;
  let history = {};

  function syncFabImage() {
    if (fabImg) fabImg.src = getBotImageSrc();
  }

  function renderChips() {
    const prompts = currentPrompts();
    chipsEl.innerHTML = prompts
      .map(
        (p) =>
          `<button type="button" class="agv-pt-ai__chip" data-prompt-id="${htmlEscape(p.id)}" ${busy ? "disabled" : ""}>${htmlEscape(p.label)}</button>`
      )
      .join("");
    chipsEl.querySelectorAll(".agv-pt-ai__chip").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (busy) return;
        const id = btn.getAttribute("data-prompt-id");
        const ctx = getPrimaryAiRouteContext();
        const hit = prompts.find((p) => p.id === id);
        if (!hit?.question) return;
        consumeChip(ctx.id || "fuera", id);
        renderChips();
        ask(hit.question);
      });
    });
  }

  function syncChrome() {
    const ui = aiUiText();
    const ctx = getPrimaryAiRouteContext();
    if (eyebrowEl) eyebrowEl.textContent = ui.eyebrow;
    if (titleEl) {
      titleEl.textContent = ctx.allowed
        ? `${ui.titleHelp} · ${ctx.label || ""}`
        : ui.titleOutside;
    }
    if (hintEl) {
      hintEl.textContent = ui.hint || "";
      hintEl.hidden = !String(ui.hint || "").trim();
    }
    if (closeBtn) closeBtn.setAttribute("aria-label", ui.close);
    if (fab) {
      fab.setAttribute("aria-label", ui.fab);
      fab.title = ui.fab;
    }
    renderChips();
    syncFabImage();
  }

  function syncVisibility() {
    const allowed = isPrimaryAiRoute();
    host.hidden = !allowed;
    if (!allowed) {
      panel.hidden = true;
      if (abortCtrl) {
        abortCtrl.abort();
        abortCtrl = null;
      }
      busy = false;
    } else {
      syncChrome();
    }
  }

  function setAnswer(html, visible = true) {
    answerEl.hidden = !visible;
    answerEl.innerHTML = html;
  }

  async function ask(question) {
    const q = String(question || "").trim();
    if (!q || busy) return;
    busy = true;
    renderChips();
    if (abortCtrl) abortCtrl.abort();
    abortCtrl = new AbortController();
    const ui = aiUiText();
    const ctx = getPrimaryAiRouteContext();
    setAnswer(
      `<div class="agv-pt-ai__user-q"><span>${htmlEscape(ui.yourQuestion)}</span> ${htmlEscape(q)}</div>
       <p class="agv-pt-ai__meta">${htmlEscape(ui.moduleMeta)} · ${htmlEscape(ctx.label || "")}</p>
       <p class="agv-pt-ai__wait" id="agv-pt-ai-wait">${htmlEscape(waitPhrase(0))}</p>`,
      true
    );
    let step = 0;
    const waitTimer = setInterval(() => {
      step += 1;
      const waitEl = answerEl.querySelector("#agv-pt-ai-wait");
      if (waitEl) waitEl.textContent = waitPhrase(step);
    }, 900);

    try {
      const result = await generatePrimaryAssistantReply(q, {
        signal: abortCtrl.signal,
        history
      });
      history = result?.history || history;
      const text = String(result?.text || ui.noAnswer).trim();
      setAnswer(
        `<div class="agv-pt-ai__user-q"><span>${htmlEscape(ui.yourQuestion)}</span> ${htmlEscape(q)}</div>
         <p class="agv-pt-ai__meta">${htmlEscape(ui.moduleMeta)} · ${htmlEscape(ctx.label || "")}</p>
         <p class="agv-pt-ai__text">${htmlEscape(text)}</p>`,
        true
      );
    } catch (err) {
      if (err?.name === "AbortError") {
        setAnswer(
          `<p class="agv-pt-ai__text">${htmlEscape(ui.cancelled)}</p>`,
          true
        );
      } else {
        setAnswer(
          `<p class="agv-pt-ai__text">${htmlEscape(ui.failed)}: ${htmlEscape(err?.message || "")}</p>`,
          true
        );
      }
    } finally {
      clearInterval(waitTimer);
      busy = false;
      abortCtrl = null;
      renderChips();
    }
  }

  fab.addEventListener("click", () => {
    syncVisibility();
    if (host.hidden) return;
    panel.hidden = !panel.hidden;
    if (!panel.hidden) syncChrome();
  });
  closeBtn.addEventListener("click", () => {
    panel.hidden = true;
  });

  window.addEventListener("hashchange", () => {
    history = {};
    resetChipQueues();
    syncVisibility();
  });
  document.addEventListener("agv:language-changed", () => {
    resetChipQueues();
    syncChrome();
  });
  document.addEventListener("agv:brand-pixel-changed", () => syncFabImage());

  syncVisibility();
  mounted = { syncVisibility, host };
  return mounted;
}

export function syncSidebarAiAssistant() {
  if (mounted) mounted.syncVisibility();
  else mountSidebarAiAssistant();
}
