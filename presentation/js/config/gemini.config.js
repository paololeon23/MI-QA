/**
 * LLM del asistente — Google Gemini (AI Studio).
 * - Local: gemini.config.local.js (gitignore) con apiKey.
 * - Netlify: GEMINI_API_KEY (scripts/inject-gemini-config.mjs).
 *
 * Usar generateContent + modelos reales (gemini-2.5-flash).
 * No usar nombres inventados tipo gemini-3.6-flash.
 */
export const geminiConfig = {
  provider: "gemini",
  apiKey: "",
  model: "gemini-2.5-flash",
  fallbackModels: ["gemini-2.0-flash", "gemini-flash-latest"],
  endpointBase: "https://generativelanguage.googleapis.com/v1beta/models",
  /** Desactivado: generateContent es la vía estable en navegador. */
  preferInteractions: false,
  interactionsUrl: "https://generativelanguage.googleapis.com/v1beta/interactions",
  generation: {
    temperature: 0.2,
    topP: 0.4,
    topK: 32,
    maxOutputTokens: 420
  },
  systemInstruction: `You are the AGV-MI conversational assistant (agroexporter).
Use JSON/screen data as the source of truth.
You may give tips anchored to that data.
Never invent hectares, E/C codes, farms, or varieties missing from context.
Always follow the UI language indicated in each prompt (es/en/fr/zh). No markdown.`
};
