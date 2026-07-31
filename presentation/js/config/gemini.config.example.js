/**
 * Copia este archivo como gemini.config.local.js y pega tu key de Google AI Studio.
 * Netlify: variable de entorno GEMINI_API_KEY.
 */
export const geminiConfig = {
  provider: "gemini",
  apiKey: "TU_GEMINI_API_KEY",
  model: "gemini-2.5-flash",
  fallbackModels: ["gemini-2.0-flash", "gemini-flash-latest"]
};
