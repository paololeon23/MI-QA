/**
 * Registro de actividad reciente para el panel inferior del sidebar.
 */

import { appConfig } from "../config/app.config.js";
import { routesConfig } from "../config/routes.config.js";
import { stateStore } from "../core/state-store.js";

const MAX_ENTRIES = 8;
const entries = [];
const listeners = new Set();

function formatTime(date) {
  return date.toLocaleTimeString("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

export function pushSidebarActivity({ type = "nav", label, detail = "" }) {
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    label: String(label || "").trim(),
    detail: String(detail || "").trim(),
    time: formatTime(new Date())
  };

  if (!entry.label) {
    return;
  }

  const duplicate = entries[0];
  if (duplicate && duplicate.label === entry.label && duplicate.detail === entry.detail) {
    duplicate.time = entry.time;
    listeners.forEach((listener) => listener(entries));
    return;
  }

  entries.unshift(entry);
  if (entries.length > MAX_ENTRIES) {
    entries.length = MAX_ENTRIES;
  }

  listeners.forEach((listener) => listener(entries));
}

export function getSidebarActivity() {
  return [...entries];
}

export function clearSidebarActivity() {
  entries.length = 0;
  listeners.forEach((listener) => listener(entries));
}

export function seedSidebarActivityBoot() {
  clearSidebarActivity();

  const moduleCount = Object.keys(routesConfig).length;
  const language = stateStore.get().currentLanguage || appConfig.defaultLanguage;

  pushSidebarActivity({
    type: "system",
    label: appConfig.appName,
    detail: `v${appConfig.appVersion}`
  });
  pushSidebarActivity({
    type: "system",
    label: `${moduleCount} módulos`,
    detail: "4 cultivos"
  });
  pushSidebarActivity({
    type: "system",
    label: "Idioma",
    detail: language
  });
}

export function subscribeSidebarActivity(listener) {
  listeners.add(listener);
  listener(entries);
  return () => listeners.delete(listener);
}
