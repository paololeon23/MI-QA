/**
 * En Netlify: toma GEMINI_API_KEY del entorno y la escribe en gemini.config.js
 * (así Gemini funciona en producción sin subir la key al repo).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.join(__dirname, "..", "presentation", "js", "config", "gemini.config.js");
const apiKey = String(process.env.GEMINI_API_KEY || "").trim();

if (!apiKey) {
  console.warn("[inject-gemini-config] GEMINI_API_KEY vacía — Gemini solo con respuesta local en este deploy.");
  process.exit(0);
}

let source = fs.readFileSync(configPath, "utf8");
if (!/apiKey:\s*["']/.test(source)) {
  console.error("[inject-gemini-config] No se encontró apiKey en gemini.config.js");
  process.exit(1);
}

const escaped = apiKey.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
source = source.replace(/apiKey:\s*["'][^"']*["']/, `apiKey: "${escaped}"`);
fs.writeFileSync(configPath, source, "utf8");
console.log("[inject-gemini-config] apiKey inyectada en gemini.config.js");
