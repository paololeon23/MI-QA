/** Uva PT (PTCUV) — carga validaciones JSON + reglas configuration-driven */

import { cargarReglasDesdeRuta } from "../../../../../engine/rule-engine.js";
import { mergeValidacionesDesdeReglas } from "../../../../../engine/cartilla-rules.adapter.js";

let _validaciones = null;
let _reglas = null;
let _validationConfig = null;

export const CONFIG_PATH = "presentation/data/uva-pt-validaciones.json";
export const REGLAS_PATH = "rules/modulos/uva-pt.rules.json";

export async function loadUvaPtValidaciones(version = "") {
  const qs = version ? `?v=${version}` : "";
  const [res, reglas] = await Promise.all([
    fetch(`${CONFIG_PATH}${qs}`),
    cargarReglasDesdeRuta(`${REGLAS_PATH}${qs}`).catch(() => null)
  ]);
  if (!res.ok) throw new Error("No se pudo cargar uva-pt-validaciones.json");
  _validaciones = await res.json();
  _reglas = reglas;
  _validationConfig = mergeValidacionesDesdeReglas(_validaciones, reglas);
  return _validaciones;
}

export function getUvaPtValidaciones() {
  if (!_validaciones) throw new Error("Validaciones Uva PT no cargadas");
  return _validaciones;
}

export function getValidationConfig() {
  if (!_validationConfig) throw new Error("Validaciones Uva PT no cargadas");
  return _validationConfig;
}

export function getUvaPtReglas() {
  return _reglas;
}

export const CARTILLA_CODE = "PTCUV";
export const MIN_FILAS = 7;
export const HEADER_ROW_INDEX = 5;
export const DATA_START_INDEX = 6;

export function getTotalColumnas() {
  return getValidationConfig().total_columnas ?? 184;
}

/** Fecha de inspección (filtro principal) — excel 54 / js 53 */
export function getColInspeccionJs() {
  return getUvaPtValidaciones().filtro_principal?.indice_js ?? 53;
}

/** Fecha de cosecha (auto) — excel 52 / js 51 */
export function getColCosechaJs() {
  return getUvaPtValidaciones().fecha_cosecha?.indice_js ?? 51;
}

/** Fecha de embalaje (auto) — excel 53 / js 52 */
export function getColEmbalajeJs() {
  return getUvaPtValidaciones().fecha_embalaje?.indice_js ?? 52;
}

/** Fecha actualización LMR (auto) — excel 71 / js 70 */
export function getColLmrJs() {
  return getUvaPtValidaciones().fecha_lmr?.indice_js ?? 70;
}

export function getSumaTonalidadesConfig() {
  return getUvaPtValidaciones().validaciones_resumen?.suma_tonalidades ?? {
    desde_excel: 60,
    hasta_excel: 69,
    igual_a_excel: 11,
    tolerancia: 0.01
  };
}

export function getColumnasFront() {
  const cfg = getUvaPtValidaciones().columnas_visibles_frontend;
  if (cfg?.indices_js?.length) return [...cfg.indices_js, ...(cfg.extra ?? [])];
  return [
    0, 1, 6, 9, 10, 37, 38, 40, 53, 54, 55, 69, 71, 73, 75, 76, 83, 91, 92, 94, 95,
    "Suma Tonalidades"
  ];
}

export function getStickyColsPt() {
  return getUvaPtValidaciones().columnas_sticky ?? [0, 1, 6, 9];
}

export function getProtectedColIndicesPt() {
  const visual = getColumnasFront();
  const sticky = getStickyColsPt();
  return new Set(sticky.map((excelCol) => visual.indexOf(excelCol)).filter((i) => i >= 0));
}

export function getExcelCabecera() {
  const cab = getUvaPtValidaciones().cabecera_excel;
  if (!cab) return null;
  return {
    titulo: { fila: cab.titulo.fila_js + 1, columna: cab.titulo.col_js + 1 },
    campos: cab.campos.map((f) => ({
      clave: f.clave,
      fila: f.fila_js + 1,
      columna: f.col_js + 1
    }))
  };
}

export function getValidacionArchivo() {
  return getUvaPtValidaciones().validacion_archivo ?? {};
}

export function getExportOrderJs() {
  const exp = getUvaPtValidaciones().exportacion;
  if (exp?.orden_indices_js?.length) return [...exp.orden_indices_js];
  const out = [];
  for (let i = 0; i < getTotalColumnas(); i++) out.push(i);
  return out;
}

export function getExportTextColsJs() {
  const exp = getUvaPtValidaciones().exportacion;
  if (exp?.texto_indices_js) return new Set(exp.texto_indices_js);
  const out = new Set();
  for (let i = 0; i <= 55; i++) out.add(i);
  return out;
}
