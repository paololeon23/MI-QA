import { geminiConfig as geminiConfigDefaults } from "../config/gemini.config.js";
import {
  answerPrimaryAiLocal,
  buildPrimaryAiPrompt,
  buildPrimaryGenericSummary,
  getPrimaryAiRouteContext,
  getAiLanguageCode,
  isPrimaryAiRoute,
  isPrimaryFactualQuestion,
  isPrimarySummaryQuestion,
  isConversationalAdviceQuestion,
  isWeakPrimaryGeminiAnswer,
  isPrimaryGreetingQuestion,
  resolveConversationTurn
} from "./primary-ai-assistant.service.js";
import { ensureCropHectaresData } from "../config/crop-hectares.registry.js?v=20260800";
import { finalizeIncognitoAiText } from "../utils/brand-pixel.util.js";
import { i18nService } from "./i18n.service.js";

/**
 * Arquitectura:
 * 1) JSON / HTML = precisión (fuente de verdad)
 * 2) Gemini (generateContent) = redacta con tono de IA (sin inventar)
 *
 * Modelos válidos: gemini-2.5-flash, gemini-2.0-flash, …
 * No usar nombres inventados (gemini-3.6-flash, etc.) → 400/404.
 */

const GEMINI_TIMEOUT_MS = 15000;
const RETRYABLE_STATUS = new Set([429, 503]);
const NEXT_MODEL_STATUS = new Set([400, 404]);

/** Config efectiva: defaults públicos + override local (gitignore) si existe. */
let geminiConfig = { ...geminiConfigDefaults };
let geminiConfigLoadPromise = null;

async function ensureGeminiConfigLoaded() {
  if (!geminiConfigLoadPromise) {
    geminiConfigLoadPromise = (async () => {
      try {
        const mod = await import("../config/gemini.config.local.js");
        if (mod?.geminiConfig && typeof mod.geminiConfig === "object") {
          geminiConfig = { ...geminiConfigDefaults, ...mod.geminiConfig };
        }
      } catch {
        /* Netlify / sin archivo local: solo defaults */
      }
      return geminiConfig;
    })();
  }
  return geminiConfigLoadPromise;
}

function friendlyApiError(err) {
  const msg = String(err?.message || "");
  const lower = msg.toLowerCase();
  const status = Number(err?.status) || 0;
  if (lower.includes("timeout") || lower.includes("timed out") || err?.name === "TimeoutError") {
    return "La IA tardó demasiado.";
  }
  if (lower.includes("failed to fetch") || lower.includes("network")) {
    return "No hay conexión con la IA (red o API).";
  }
  if (status === 429 || lower.includes("quota") || lower.includes("rate")) {
    return "Cuota Gemini agotada o límite de peticiones (429). Espera un momento.";
  }
  if (status === 503 || lower.includes("unavailable") || lower.includes("overloaded")) {
    return "Gemini no está disponible ahora (503). Reintenta en unos segundos.";
  }
  if (
    lower.includes("api key") ||
    lower.includes("api_key") ||
    lower.includes("permission") ||
    lower.includes("unrestricted") ||
    lower.includes("blocked") ||
    status === 403 ||
    status === 401
  ) {
    return "La API key de Gemini fue rechazada. Revisa la variable de entorno en Netlify o gemini.config.local.js.";
  }
  return msg || "Error de red o API";
}

function mergeAbortSignals(signals = []) {
  const list = signals.filter(Boolean);
  if (!list.length) return undefined;
  if (list.length === 1) return list[0];
  if (typeof AbortSignal.any === "function") return AbortSignal.any(list);
  const controller = new AbortController();
  for (const signal of list) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      break;
    }
    signal.addEventListener("abort", () => controller.abort(signal.reason), { once: true });
  }
  return controller.signal;
}

function timeoutSignal(ms) {
  if (typeof AbortSignal.timeout === "function") return AbortSignal.timeout(ms);
  const controller = new AbortController();
  setTimeout(() => controller.abort(new DOMException("Timeout", "TimeoutError")), ms);
  return controller.signal;
}

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason || new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener?.(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason || new DOMException("Aborted", "AbortError"));
      },
      { once: true }
    );
  });
}

function authHeaders() {
  return {
    "Content-Type": "application/json",
    "x-goog-api-key": geminiConfig.apiKey
  };
}

function cleanModelText(text) {
  return String(text || "")
    .replace(/^\(?\s*Context\s*&\s*Date\)?\s*:?\s*\*?\s*/i, "")
    .replace(/^```[\w]*\n?|\n?```$/g, "")
    .trim();
}

export function extractGeminiAnswerText(data) {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts) && parts.length) {
    const visible = parts
      .filter((p) => p && typeof p.text === "string" && !p.thought)
      .map((p) => p.text.trim())
      .filter(Boolean);
    const text = (visible.length ? visible : parts.map((p) => p?.text).filter(Boolean)).join("\n").trim();
    return cleanModelText(text);
  }
  return "";
}

function buildGenerationConfig(options = {}) {
  const base = geminiConfig.generation || {};
  return {
    temperature: options.temperature ?? base.temperature ?? 0.2,
    topP: options.topP ?? base.topP ?? 0.5,
    topK: options.topK ?? base.topK ?? 40,
    maxOutputTokens: options.maxOutputTokens ?? base.maxOutputTokens ?? 280
  };
}

/** Modelos reales de AI Studio (evitar 3.x inventados → 400/404). */
function normalizeGeminiModels(list = []) {
  const allowed = [];
  const seen = new Set();
  for (const raw of list) {
    let m = String(raw || "")
      .trim()
      .replace(/^google\//, "");
    if (!m || m.includes("/")) continue;
    // Alias peligrosos que ya generaron 404/400 en el dashboard
    if (/gemini-3\.\d/i.test(m) || /gemini-3\.6/i.test(m)) {
      m = "gemini-2.5-flash";
    }
    if (seen.has(m)) continue;
    seen.add(m);
    allowed.push(m);
  }
  return allowed.length ? allowed : ["gemini-2.5-flash", "gemini-2.0-flash"];
}

async function postGemini(url, body, options = {}) {
  const signal = mergeAbortSignals([
    options.signal,
    timeoutSignal(options.timeoutMs ?? GEMINI_TIMEOUT_MS)
  ]);

  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: authHeaders(),
      signal,
      body: JSON.stringify(body)
    });
  } catch (err) {
    if (options.signal?.aborted) throw err;
    if (err?.name === "AbortError" || err?.name === "TimeoutError") {
      const timeoutErr = new Error("Timeout Gemini");
      timeoutErr.name = "TimeoutError";
      timeoutErr.isTimeout = true;
      throw timeoutErr;
    }
    const netErr = new Error(err?.message || "Failed to fetch");
    netErr.isNetwork = true;
    throw netErr;
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const apiMsg = data?.error?.message || `Error Gemini HTTP ${response.status}`;
    const err = new Error(apiMsg);
    err.status = response.status;
    throw err;
  }
  const text = extractGeminiAnswerText(data);
  if (!text.trim()) throw new Error("Gemini no devolvió texto útil.");
  return text.trim();
}

/**
 * generateContent — mismo patrón que AI Studio recomienda:
 * POST .../models/gemini-2.5-flash:generateContent
 */
async function requestGenerateContent(model, prompt, options = {}) {
  const { endpointBase, systemInstruction } = geminiConfig;
  const url = `${endpointBase}/${encodeURIComponent(model)}:generateContent`;
  const generationConfig = buildGenerationConfig(options);
  const fullPrompt = systemInstruction ? `${systemInstruction}\n\n${prompt}` : prompt;

  // 1) Cuerpo mínimo (como el ejemplo de AI Studio) — evita 400 por campos extra
  try {
    return await postGemini(
      url,
      {
        contents: [{ parts: [{ text: fullPrompt }] }],
        generationConfig
      },
      options
    );
  } catch (err) {
    const status = Number(err?.status) || 0;
    if (status === 404 || status === 429 || status === 503) throw err;
    // 2) Reintento aún más simple (sin generationConfig)
    if (status === 400) {
      return postGemini(
        url,
        {
          contents: [{ parts: [{ text: fullPrompt }] }]
        },
        options
      );
    }
    throw err;
  }
}

async function requestGeminiModel(model, prompt, options = {}) {
  const maxAttempts = 3;
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await requestGenerateContent(model, prompt, options);
    } catch (err) {
      lastError = err;
      if (err?.name === "AbortError" && options.signal?.aborted) throw err;
      if (err?.isTimeout || err?.name === "TimeoutError") throw err;

      const status = Number(err?.status) || 0;
      if (NEXT_MODEL_STATUS.has(status)) throw err;

      if (RETRYABLE_STATUS.has(status) && attempt < maxAttempts) {
        const waitMs = 600 * attempt * attempt;
        await sleep(waitMs, options.signal);
        continue;
      }
      throw err;
    }
  }
  throw lastError || new Error("No se pudo contactar a Gemini.");
}

function hasGeminiKey() {
  const key = String(geminiConfig.apiKey || "").trim();
  return Boolean(key) && !key.startsWith("TU_");
}

export async function generateGeminiText(prompt, options = {}) {
  await ensureGeminiConfigLoaded();

  if (!hasGeminiKey()) {
    throw new Error("Falta configurar la API key de Gemini (Netlify env o gemini.config.local.js).");
  }

  const preferred = Array.isArray(options.preferModels) ? options.preferModels : [];
  const models = normalizeGeminiModels([
    ...preferred,
    geminiConfig.model,
    ...(geminiConfig.fallbackModels || [])
  ]);

  let lastError = null;
  for (const candidate of models) {
    try {
      return await requestGeminiModel(candidate, prompt, options);
    } catch (err) {
      lastError = err;
      if (err?.name === "AbortError" && options.signal?.aborted) throw err;
      if (err?.isTimeout || err?.name === "TimeoutError") continue;
      const status = Number(err?.status) || 0;
      // 400/404 → siguiente modelo; 429/503 ya reintentaron dentro del modelo
      if (NEXT_MODEL_STATUS.has(status) || RETRYABLE_STATUS.has(status)) continue;
    }
  }

  throw lastError || new Error(friendlyApiError(lastError) || "No se pudo contactar a Gemini.");
}

/**
 * Datos (JSON/HTML) → precisión.
 * Gemini → conversación + tips anclados a esos hechos.
 * options.history: { lastCropId, lastIntent, lastQuestion, messages[] }
 */
export async function generatePrimaryAssistantReply(userQuestion = "", options = {}) {
  await ensureGeminiConfigLoaded();
  const hash = options.hash || window.location.hash || "#/inicio";
  const ctx = getPrimaryAiRouteContext(hash);
  const question = String(userQuestion || "").trim();
  const historyIn = options.history || {};
  const uiLang = getAiLanguageCode();
  const nonSpanishUi = !String(uiLang).startsWith("es");

  const localizedFallback = () => {
    try {
      const v = i18nService?.translate?.("primaryAi.localFallback");
      if (v && v !== "primaryAi.localFallback") return v;
    } catch {
      /* ignore */
    }
    if (String(uiLang).startsWith("en")) {
      return "i already have the on-screen data. ask again in a short sentence.";
    }
    if (String(uiLang).startsWith("fr")) {
      return "j'ai déjà les données à l'écran. repose ta question en une phrase courte.";
    }
    if (String(uiLang).startsWith("zh")) {
      return "屏幕数据已就绪。请用一句话再问一次。";
    }
    return "ya tengo los datos en pantalla. vuelve a preguntar en una frase corta.";
  };

  try {
    await Promise.race([
      ensureCropHectaresData(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout hectáreas")), 4000))
    ]);
  } catch {
    /* ok */
  }

  const localResult = answerPrimaryAiLocal(question, hash, historyIn);
  const dataText =
    (typeof localResult === "string" ? localResult : localResult?.text) ||
    finalizeIncognitoAiText(buildPrimaryGenericSummary(hash));
  const historyOut =
    typeof localResult === "object" && localResult?.history
      ? { ...historyIn, ...localResult.history }
      : { ...historyIn };
  const effectiveQuestion =
    (typeof localResult === "object" && localResult?.effectiveQuestion) || question;

  const pack = (text, source) => ({
    text: finalizeIncognitoAiText(text),
    source,
    history: historyOut
  });

  // Fuera de alcance / saludo: el texto local ya respeta idioma (saludo) o es contextual.
  if (!ctx.allowed) {
    return pack(nonSpanishUi ? localizedFallback() : dataText, "data");
  }

  if (isPrimaryGreetingQuestion(effectiveQuestion) || isPrimaryGreetingQuestion(question)) {
    return pack(dataText, "greeting");
  }

  const isAdvice = isConversationalAdviceQuestion(effectiveQuestion);
  const isFactual = !isAdvice && isPrimaryFactualQuestion(effectiveQuestion);
  // Tip local anclado a datos: no reescribir (evita cifras rotas tipo «con 6 con 6»)
  if (isAdvice && /\btip:\s*/i.test(dataText)) {
    return pack(dataText, "data");
  }
  // Datos duros ya resueltos en JSON: no pasar por Gemini (evita fugas de prompt en inglés)
  const groundedLocal =
    /\d+(?:\.\d+)?\s*ha/i.test(dataText) ||
    /variedad con m[aá]s hect|fundo con m[aá]s hect|top\s*\d|suma .+ ha/i.test(dataText) ||
    /gen[eé]tica con m[aá]s variedades|hay \d+ variedades en el cat[aá]logo|hay \d+ gen[eé]ticas/i.test(
      dataText
    );
  if (isFactual && groundedLocal) {
    return pack(dataText, "data");
  }
  const defaultAsk =
    i18nService?.translate?.("primaryAi.defaultAsk") ||
    "Dame un resumen claro de este módulo.";
  const prompt = buildPrimaryAiPrompt(
    effectiveQuestion || question || defaultAsk,
    hash,
    dataText,
    { advice: isAdvice || !isFactual }
  );

  try {
    const text = await generateGeminiText(prompt, {
      signal: options.signal,
      timeoutMs: GEMINI_TIMEOUT_MS,
      temperature: isFactual ? 0.15 : isAdvice ? 0.45 : 0.3,
      topP: isFactual ? 0.35 : 0.55,
      maxOutputTokens: isFactual ? 420 : 520
    });

    if (isWeakPrimaryGeminiAnswer(text, effectiveQuestion, dataText)) {
      // No devolver borrador en español si la UI no es español.
      return pack(nonSpanishUi ? localizedFallback() : dataText, "data");
    }

    const softened = String(text || "")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^([¡¿]?)([A-ZÁÉÍÓÚÑÜ])/, (_, p, c) => `${p}${c.toLowerCase()}`);

    return pack(softened, isAdvice ? "llm-advice" : isFactual ? "llm-data" : "llm-chat");
  } catch (err) {
    if (err?.name === "AbortError" && options.signal?.aborted) throw err;
    return pack(nonSpanishUi ? localizedFallback() : dataText, "data");
  }
}

export {
  isPrimaryAiRoute,
  getPrimaryAiRouteContext,
  answerPrimaryAiLocal,
  buildPrimaryGenericSummary,
  isPrimarySummaryQuestion,
  isPrimaryFactualQuestion,
  resolveConversationTurn
};
