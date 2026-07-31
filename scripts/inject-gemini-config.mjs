/**
 * En Netlify: lee la variable de entorno de Gemini e inyecta apiKey
 * en presentation/js/config/gemini.config.js (sin subir secretos al repo).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.join(__dirname, "..", "presentation", "js", "config", "gemini.config.js");

const envName = ["GEMINI", "API", "KEY"].join("_");
const geminiKey = String(process.env[envName] || "").trim();

if (!geminiKey) {
  console.warn(
    "[inject-gemini-config] Sin key de Gemini en el entorno — solo respuesta local en este deploy."
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
