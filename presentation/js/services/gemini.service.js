import { geminiConfig as geminiConfigDefaults } from "../config/gemini.config.js";
import {
  answerPrimaryAiLocal,
  buildPrimaryAiPrompt,
  buildPrimaryGenericSummary,
  getPrimaryAiRouteContext,
  isPrimaryAiRoute,
  isPrimaryFactualQuestion,
  isPrimarySummaryQuestion,
  isWeakPrimaryGeminiAnswer,
  resolveConversationTurn,
  resolveMentionedCropId
} from "./primary-ai-assistant.service.js";
import { ensureCropHectaresData } from "../config/crop-hectares.registry.js?v=20260800";
import { finalizeIncognitoAiText } from "../utils/brand-pixel.util.js";

/**
 * Arquitectura:
 * 1) JSON / HTML = precisión (fuente de verdad)
 * 2) Gemini = solo redacta el resumen con esos hechos
 */

const GEMINI_TIMEOUT_MS = 15000;

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
  if (lower.includes("timeout") || lower.includes("timed out") || err?.name === "TimeoutError") {
    return "La IA tardó demasiado.";
  }
  if (lower.includes("failed to fetch") || lower.includes("network")) {
    return "No hay conexión con Gemini (red o API).";
  }
  if (lower.includes("prepayment") || lower.includes("credits") || lower.includes("billing")) {
    return "Los créditos de Gemini se agotaron.";
  }
  if (
    lower.includes("api key") ||
    lower.includes("api_key") ||
    lower.includes("permission") ||
    lower.includes("unrestricted") ||
    lower.includes("blocked") ||
    lower.includes("403")
  ) {
    return "La API key fue rechazada. En AI Studio restrínela a Gemini API o crea una auth key nueva.";
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

  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return cleanModelText(data.output_text);
  }
  if (typeof data?.outputText === "string" && data.outputText.trim()) {
    return cleanModelText(data.outputText);
  }

  const outputs = data?.outputs || data?.output || [];
  if (Array.isArray(outputs)) {
    const chunks = outputs
      .map((o) => o?.text?.text || o?.text || "")
      .filter((t) => typeof t === "string" && t.trim());
    if (chunks.length) return cleanModelText(chunks.join("\n"));
  }

  const steps = data?.steps || [];
  if (Array.isArray(steps)) {
    const texts = [];
    for (const step of steps) {
      const content = step?.modelOutput?.content || step?.model_output?.content || [];
      for (const c of content) {
        const t = c?.text?.text || c?.text || "";
        if (typeof t === "string" && t.trim()) texts.push(t.trim());
      }
    }
    if (texts.length) return cleanModelText(texts.join("\n"));
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

async function requestGenerateContent(model, prompt, options = {}, withExtras = true) {
  const { endpointBase, systemInstruction } = geminiConfig;
  const url = `${endpointBase}/${encodeURIComponent(model)}:generateContent`;
  const generationConfig = buildGenerationConfig(options);

  if (withExtras) {
    generationConfig.thinkingConfig = { thinkingBudget: 0 };
  }

  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig
  };
  if (withExtras && systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] };
  } else if (!withExtras && systemInstruction) {
    // Sin systemInstruction ni thinking: prompt autocontenido
    body.contents = [{ parts: [{ text: `${systemInstruction}\n\n${prompt}` }] }];
    delete body.generationConfig.thinkingConfig;
  }

  return postGemini(url, body, options);
}

async function requestInteractions(model, prompt, options = {}) {
  const { interactionsUrl, systemInstruction } = geminiConfig;
  const input = systemInstruction ? `${systemInstruction}\n\n---\n${prompt}` : prompt;
  return postGemini(interactionsUrl, { model, input }, options);
}

async function requestGeminiModel(model, prompt, options = {}) {
  // 1) generateContent (fiable en navegador)
  try {
    return await requestGenerateContent(model, prompt, options, true);
  } catch (err) {
    if (err?.name === "AbortError" && options.signal?.aborted) throw err;
    if (err?.isTimeout || err?.name === "TimeoutError") throw err;
    const msg = String(err?.message || "").toLowerCase();
    if (msg.includes("thinking") || msg.includes("unknown name") || msg.includes("systeminstruction")) {
      try {
        return await requestGenerateContent(model, prompt, options, false);
      } catch (err2) {
        if (err2?.name === "AbortError" && options.signal?.aborted) throw err2;
      }
    }
  }

  // 2) Interactions API (doc nueva)
  try {
    return await requestInteractions(model, prompt, options);
  } catch (err) {
    if (err?.name === "AbortError" && options.signal?.aborted) throw err;
    throw err;
  }
}

export async function generateGeminiText(prompt, options = {}) {
  await ensureGeminiConfigLoaded();
  const { apiKey, model, fallbackModels = [] } = geminiConfig;
  if (!apiKey || apiKey.startsWith("TU_")) {
    throw new Error("Falta configurar la API key de Gemini.");
  }

  const preferred = Array.isArray(options.preferModels) ? options.preferModels : [];
  const models = [...preferred, model, ...fallbackModels].filter(
    (m, i, arr) => m && arr.indexOf(m) === i
  );

  let lastError = null;
  for (const candidate of models) {
    try {
      return await requestGeminiModel(candidate, prompt, options);
    } catch (err) {
      lastError = err;
      if (err?.name === "AbortError" && options.signal?.aborted) throw err;
      // Timeout: probar siguiente modelo una vez más rápido
      if (err?.isTimeout || err?.name === "TimeoutError") continue;
    }
  }

  throw lastError || new Error("No se pudo contactar a Gemini.");
}

/**
 * Datos (JSON/HTML) → precisión.
 * Gemini → solo redacta resumen con esos hechos.
 * options.history: { lastCropId, lastIntent, lastQuestion } para seguir la conversación.
 */
export async function generatePrimaryAssistantReply(userQuestion = "", options = {}) {
  await ensureGeminiConfigLoaded();
  const hash = options.hash || window.location.hash || "#/inicio";
  const ctx = getPrimaryAiRouteContext(hash);
  const question = String(userQuestion || "").trim();
  const historyIn = options.history || {};

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
      ? localResult.history
      : historyIn;
  const effectiveQuestion =
    (typeof localResult === "object" && localResult?.effectiveQuestion) || question;

  const pack = (text, source) => ({
    text: finalizeIncognitoAiText(text),
    source,
    history: historyOut
  });

  if (!ctx.allowed) {
    return pack(dataText, "data");
  }

  const qNorm = String(effectiveQuestion || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const wantsDataOnly =
    isPrimaryFactualQuestion(effectiveQuestion) ||
    Boolean(resolveMentionedCropId(effectiveQuestion)) ||
    Boolean(historyOut.lastCropId && /cuales|variedad|fundo|hectarea|detalle/.test(qNorm)) ||
    /\b(cuant|fundo|hectarea|ha\b|variedad|parcela|codigo|item|filtro)\b/.test(qNorm);

  // Preguntas de dato / seguimiento de dato: sin IA inventando
  if (question && wantsDataOnly && !isPrimarySummaryQuestion(effectiveQuestion)) {
    return pack(dataText, "data");
  }

  const prompt = buildPrimaryAiPrompt(
    effectiveQuestion || "Dame un resumen claro de este módulo.",
    hash,
    dataText
  );

  try {
    const text = await generateGeminiText(prompt, {
      signal: options.signal,
      timeoutMs: GEMINI_TIMEOUT_MS,
      temperature: 0.15,
      topP: 0.35,
      maxOutputTokens: 220
    });

    if (isWeakPrimaryGeminiAnswer(text, effectiveQuestion)) {
      return pack(dataText, "data");
    }

    return pack(text, "gemini-summary");
  } catch (err) {
    if (err?.name === "AbortError" && options.signal?.aborted) throw err;
    return pack(dataText, "data");
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
