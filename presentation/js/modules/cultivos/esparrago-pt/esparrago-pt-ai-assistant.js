import {
  generatePrimaryAssistantReply,
  getPrimaryAiRouteContext,
  isPrimaryAiRoute
} from "../../../services/gemini.service.js";
import { getBotImageSrc } from "../../../utils/brand-pixel.util.js";

const QUICK_PROMPTS_BY_ROUTE = {
  inicio: [
    { id: "resumen", label: "Resumen general", question: "Dame un resumen general de Inicio." },
    { id: "cultivos", label: "¿Qué cultivos?", question: "¿Qué cultivos tenemos?" },
    { id: "fundos", label: "¿Cuántos fundos?", question: "¿Cuántos fundos hay?" }
  ],
  variedades: [
    { id: "resumen", label: "Resumen general", question: "Dame un resumen general de Variedades." },
    { id: "total", label: "¿Cuántas variedades?", question: "¿Cuántas variedades hay en el catálogo?" },
    { id: "lic", label: "Licenciatarios", question: "¿Cuántos licenciatarios hay?" }
  ],
  trazabilidad: [
    { id: "resumen", label: "Resumen general", question: "Dame un resumen general de Trazabilidad." },
    { id: "codigo", label: "Código actual", question: "¿Qué código hay ingresado?" },
    { id: "pais", label: "Perú vs Chile", question: "¿Qué diferencia hay entre Traza Perú y Traza Chile?" }
  ],
  cartillas: [
    { id: "resumen", label: "Resumen general", question: "Dame un resumen general de Cartillas." },
    { id: "total", label: "¿Cuántas cartillas?", question: "¿Cuántas cartillas hay?" },
    { id: "filtro", label: "Filtro activo", question: "¿Qué filtro está activo?" }
  ],
  fuera: [
    { id: "donde", label: "¿Dónde ayuda?", question: "¿En qué módulos ayuda este asistente?" }
  ]
};

const WAIT_MESSAGES = [
  "Iniciando conversación con la IA…",
  "Conectando con el asistente…",
  "Preparando una respuesta breve…",
  "Casi listo…"
];

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function currentPrompts() {
  const ctx = getPrimaryAiRouteContext();
  const list = QUICK_PROMPTS_BY_ROUTE[ctx.id] || QUICK_PROMPTS_BY_ROUTE.fuera;
  return list.slice(0, 3);
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

  // Quitar restos del intento en sidebar
  document.getElementById("btnSidebarAiAssistant")?.remove();

  const host = document.createElement("div");
  host.id = "agv-pt-ai-assistant";
  host.className = "agv-pt-ai";
  host.setAttribute("data-module", "primary-ai");
  host.innerHTML = `
    <div class="agv-pt-ai__panel" id="agv-pt-ai-panel" hidden>
      <header class="agv-pt-ai__panel-head">
        <div>
          <p class="agv-pt-ai__eyebrow">Asistente IA</p>
          <h4 class="agv-pt-ai__title" id="agv-pt-ai-title">Ayuda del menú principal</h4>
        </div>
        <button type="button" class="agv-pt-ai__close" id="agv-pt-ai-close" aria-label="Cerrar">×</button>
      </header>
      <div class="agv-pt-ai__body" id="agv-pt-ai-body">
        <p class="agv-pt-ai__hint">Pregunta sobre Inicio, Variedades, Trazabilidad o Cartillas.</p>
      </div>
      <div class="agv-pt-ai__chips" id="agv-pt-ai-chips"></div>
      <form class="agv-pt-ai__form" id="agv-pt-ai-form">
        <input
          type="text"
          id="agv-pt-ai-input"
          class="agv-pt-ai__input"
          placeholder="Pregunta sobre este módulo…"
          autocomplete="off"
        />
        <button type="submit" class="agv-pt-ai__send" id="agv-pt-ai-send">Enviar</button>
      </form>
    </div>
    <div class="agv-pt-ai__hint-cloud" id="agv-pt-ai-hint-cloud">¡Resumen IA!</div>
    <button type="button" class="agv-pt-ai__fab" id="agv-pt-ai-fab" aria-label="Abrir Asistente IA" title="Asistente IA">
      <img src="${getBotImageSrc()}" alt="Asistente IA" class="agv-pt-ai__fab-img" width="72" height="72" decoding="async" />
    </button>
  `;
  document.body.appendChild(host);

  const panel = host.querySelector("#agv-pt-ai-panel");
  const body = host.querySelector("#agv-pt-ai-body");
  const chips = host.querySelector("#agv-pt-ai-chips");
  const form = host.querySelector("#agv-pt-ai-form");
  const input = host.querySelector("#agv-pt-ai-input");
  const closeBtn = host.querySelector("#agv-pt-ai-close");
  const titleEl = host.querySelector("#agv-pt-ai-title");
  const fab = host.querySelector("#agv-pt-ai-fab");
  const hintCloud = host.querySelector("#agv-pt-ai-hint-cloud");

  let abortController = null;
  let open = false;
  let waitTimer = null;
  let waitIndex = 0;
  let requestSeq = 0;
  /** Memoria corta para seguimientos: "cuales son?", "y el de uva?" */
  let chatHistory = { lastCropId: null, lastIntent: null, lastQuestion: null };

  const renderChips = () => {
    chips.innerHTML = currentPrompts()
      .map(
        (p) =>
          `<button type="button" class="agv-pt-ai__chip" data-prompt-id="${p.id}">${htmlEscape(p.label)}</button>`
      )
      .join("");
  };

  const syncVisibility = () => {
    const allowed = isPrimaryAiRoute();
    host.classList.toggle("is-route-hidden", !allowed);
    if (!allowed && open) setOpen(false);
  };

  const setControlsBusy = (busy) => {
    form.querySelector("button")?.toggleAttribute("disabled", busy);
    chips.querySelectorAll("button").forEach((b) => {
      b.disabled = busy;
    });
  };

  const stopWaitMessages = () => {
    if (waitTimer) {
      clearInterval(waitTimer);
      waitTimer = null;
    }
    waitIndex = 0;
    body.classList.remove("is-loading");
  };

  const renderWaitStatus = (message, userQuestion = "") => {
    body.innerHTML = `
      <div class="agv-pt-ai__status" role="status" aria-live="polite">
        ${
          userQuestion
            ? `<p class="agv-pt-ai__user-q"><span>Tu pregunta:</span> ${htmlEscape(userQuestion)}</p>`
            : ""
        }
        <span class="agv-pt-ai__status-dots" aria-hidden="true"><i></i><i></i><i></i></span>
        <p class="agv-pt-ai__loading">${htmlEscape(message)}</p>
        <p class="agv-pt-ai__status-sub">Espera un momento; la conversación está en curso.</p>
      </div>
    `;
  };

  const startWaitMessages = (userQuestion = "") => {
    stopWaitMessages();
    body.classList.add("is-loading");
    waitIndex = 0;
    renderWaitStatus(WAIT_MESSAGES[0], userQuestion);
    waitTimer = setInterval(() => {
      waitIndex = Math.min(waitIndex + 1, WAIT_MESSAGES.length - 1);
      const msgEl = body.querySelector(".agv-pt-ai__loading");
      if (msgEl) msgEl.textContent = WAIT_MESSAGES[waitIndex];
    }, 1400);
  };

  const renderAnswer = (text, meta = "", userQuestion = "", notice = "") => {
    body.innerHTML = `
      ${
        userQuestion
          ? `<p class="agv-pt-ai__user-q"><span>Tu pregunta:</span> ${htmlEscape(userQuestion)}</p>`
          : ""
      }
      ${meta ? `<p class="agv-pt-ai__meta">${htmlEscape(meta)}</p>` : ""}
      <div class="agv-pt-ai__answer">${htmlEscape(text)}</div>
      ${notice ? `<p class="agv-pt-ai__notice">${htmlEscape(notice)}</p>` : ""}
    `;
  };

  const refreshHeader = () => {
    const ctx = getPrimaryAiRouteContext();
    if (titleEl) titleEl.textContent = ctx.allowed ? `Ayuda · ${ctx.label}` : "Solo menú principal";
    renderChips();
  };

  const ask = async (question, { fromUser = false } = {}) => {
    const q = String(question || "").trim();
    const hash = window.location.hash || "#/inicio";
    const ctx = getPrimaryAiRouteContext(hash);

    abortController?.abort();
    const mySeq = ++requestSeq;
    abortController = new AbortController();

    setControlsBusy(true);
    startWaitMessages(fromUser ? q : "");

    try {
      const result = await generatePrimaryAssistantReply(
        q || "Dame un resumen general de este módulo.",
        {
          hash,
          signal: abortController.signal,
          fromOpen: !fromUser,
          forceGemini: fromUser,
          history: chatHistory
        }
      );
      if (mySeq !== requestSeq) return;
      if (result?.history) chatHistory = { ...chatHistory, ...result.history };
      stopWaitMessages();
      const answerText = String(result?.text || "").trim();
      renderAnswer(
        answerText || "No hay una respuesta disponible ahora. Prueba de nuevo o usa Resumen general.",
        ctx.allowed ? `Módulo · ${ctx.label}` : "Fuera de alcance",
        fromUser ? q : "",
        result?.notice || ""
      );
    } catch (err) {
      if (mySeq !== requestSeq) return;
      stopWaitMessages();
      const fallback =
        err?.name === "AbortError"
          ? "La consulta anterior se canceló. Envía de nuevo tu pregunta."
          : `No se pudo responder: ${err?.message || "error"}. Intenta de nuevo.`;
      renderAnswer(fallback, "", fromUser ? q : "");
    } finally {
      if (mySeq === requestSeq) {
        setControlsBusy(false);
        input?.focus?.();
      }
    }
  };

  const setOpen = (next) => {
    if (next && !isPrimaryAiRoute()) return;
    open = next;
    panel.hidden = !open;
    hintCloud.hidden = open;
    fab.classList.toggle("is-open", open);

    if (open) {
      chatHistory = { lastCropId: null, lastIntent: null, lastQuestion: null };
      refreshHeader();
      ask("Dame un resumen general de este módulo.", { fromUser: false });
      input?.focus?.();
    }
  };

  fab.addEventListener("click", () => setOpen(!open));
  closeBtn.addEventListener("click", () => setOpen(false));

  chips.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-prompt-id]");
    if (!btn) return;
    const item = currentPrompts().find((p) => p.id === btn.dataset.promptId);
    if (item) ask(item.question, { fromUser: true });
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const q = input.value.trim();
    if (!q) {
      input.focus();
      return;
    }
    input.value = "";
    ask(q, { fromUser: true });
  });

  window.addEventListener("hashchange", () => {
    syncVisibility();
    if (open) refreshHeader();
  });

  syncVisibility();
  renderChips();

  mounted = {
    syncTrigger: syncVisibility,
    syncVisibility,
    open: () => setOpen(true),
    close: () => setOpen(false),
    destroy() {
      requestSeq += 1;
      abortController?.abort();
      stopWaitMessages();
      host.remove();
      document.getElementById("btnSidebarAiAssistant")?.remove();
      mounted = null;
    }
  };

  return mounted;
}

export function mountEsparragoPtAiAssistant() {
  return mountSidebarAiAssistant();
}
