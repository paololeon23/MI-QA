/**
 * Gemini (Google AI Studio) — config pública (sin secretos).
 * Para clave local: copia gemini.config.example.js → gemini.config.local.js
 * y pon tu API key ahí (ese archivo no se sube al repo).
 */
export const geminiConfig = {
  apiKey: "",
  model: "gemini-2.5-flash",
  fallbackModels: [
    "gemini-2.0-flash",
    "gemini-flash-latest",
    "gemini-3.1-flash-lite"
  ],
  endpointBase: "https://generativelanguage.googleapis.com/v1beta/models",
  interactionsUrl: "https://generativelanguage.googleapis.com/v1beta/interactions",
  preferInteractions: false,
  generation: {
    temperature: 0.2,
    topP: 0.4,
    topK: 32,
    maxOutputTokens: 220
  },
  systemInstruction: `Eres redactor de AGV-MI. Los datos ya vienen del sistema (JSON/pantalla).
Tu única tarea: redactar 1-2 oraciones claras con esos hechos.
Prohibido inventar cifras, cultivos o fundos. Prohibido decir que faltan datos si están en el contexto.
Español simple. Sin markdown.`
};
