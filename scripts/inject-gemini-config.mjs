/**
 * En Netlify: inyecta GEMINI_API_KEY en presentation/js/config/gemini.config.js
 * sin subir secretos al repo.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.join(__dirname, "..", "presentation", "js", "config", "gemini.config.js");

const geminiKey = String(process.env.GEMINI_API_KEY || "").trim();

if (!geminiKey) {
  console.warn(
    "[inject-gemini-config] Sin GEMINI_API_KEY — solo respuesta local en este deploy."
  );
  process.exit(0);
}

let source = fs.readFileSync(configPath, "utf8");

function injectField(src, fieldName, value) {
  const re = new RegExp(`${fieldName}:\\s*["'][^"']*["']`);
  if (!re.test(src)) {
    console.error(`[inject-gemini-config] No se encontró ${fieldName} en gemini.config.js`);
    process.exit(1);
  }
  const escaped = String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return src.replace(re, `${fieldName}: "${escaped}"`);
}

source = injectField(source, "apiKey", geminiKey);
source = injectField(source, "provider", "gemini");
console.log("[inject-gemini-config] apiKey Gemini inyectada");

fs.writeFileSync(configPath, source, "utf8");
