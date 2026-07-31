/**
 * Copia este archivo como gemini.config.local.js y pega tu key de Google AI Studio.
 * En Netlify: Site settings → Environment variables (no subir la key al repo).
 */
export const geminiConfig = {
  provider: "gemini",
  apiKey: "",
  model: "gemini-2.5-flash",
  fallbackModels: ["gemini-2.0-flash", "gemini-flash-latest"]
};
