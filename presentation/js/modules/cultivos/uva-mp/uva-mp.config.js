/** Uva MP (MPCUV) — carga validaciones JSON + reglas configuration-driven */

import { cargarReglasDesdeRuta } from "../../../../../engine/rule-engine.js";
import {
  getLongitudExactaDesdeReglas,
  mergeValidacionesDesdeReglas
} from "../../../../../engine/cartilla-rules.adapter.js";

let _validaciones = null;
let _reglas = null;
let _validationConfig = null;

export const CONFIG_PATH = "presentation/data/uva-mp-validaciones.json";
export const REGLAS_PATH = "rules/modulos/uva-mp.rules.json";

export async function loadUvaMpValidaciones(version = "") {
  const qs = version ? `?v=${version}` : "";
  const [res, reglas] = await Promise.all([
    fetch(`${CONFIG_PATH}${qs}`),
    cargarReglasDesdeRuta(`${REGLAS_PATH}${qs}`).catch(() => null)
  ]);
  if (!res.ok) throw new Error("No se pudo cargar uva-mp-validaciones.json");
  _validaciones = await res.json();
  _reglas = reglas;
  _validationConfig = mergeValidacionesDesdeReglas(_validaciones, reglas, {
    duplicateRuleTipo: "duplicado_en_fecha"
  });
  return _validaciones;
}

export function getValidationConfig() {
  if (!_validationConfig) throw new Error("Validaciones Uva MP no cargadas");
  return _validationConfig;
}

export function getUvaMpValidaciones() {
  if (!_validaciones) throw new Error("Validaciones Uva MP no cargadas");
  return _validaciones;
}

export const CARTILLA_CODE = "MPCUV";
export const FILAS_SKIP = 5;

export function getTotalColumnas() {
  return getValidationConfig().total_columnas ?? 187;
}

export function getColInspeccionJs() {
  return getUvaMpValidaciones().filtro_principal?.indice_js ?? 50;
}

export function getColLmrJs() {
  return getUvaMpValidaciones().fecha_lmr?.indice_js ?? 69;
}

export function getColLoteJs() {
  return getUvaMpValidaciones().validaciones_resumen?.lote?.indice_js ?? 9;
}

export function getLoteLongitudExacta() {
  const idx = getColLoteJs();
  const desdeReglas = getLongitudExactaDesdeReglas(_reglas, idx);
  if (desdeReglas != null) return desdeReglas;
  return getUvaMpValidaciones().validaciones_resumen?.lote?.longitud ?? 10;
}

export function getUvaMpReglas() {
  return _reglas;
}

export function getStickyCols() {
  return getUvaMpValidaciones().columnas_sticky ?? [0, 1, 6, 9];
}

export function getColumnsToShow() {
  const cfg = getUvaMpValidaciones().columnas_visibles_frontend;
  return {
    indices: cfg?.indices_js?.length
      ? [...cfg.indices_js]
      : [0, 1, 6, 9, 10, 11, 12, 13, 14, 15, 16, 17, 19, 28, 29, 30, 31, 32, 38, 50, 54, 65, 68, 69, 86, 88],
    extra: cfg?.extra?.length ? [...cfg.extra] : ["Suma Tonalidades", "Suma Calibres"]
  };
}

export function getExportOrdenJs() {
  const cfg = getUvaMpValidaciones();
  if (cfg.export_orden?.length) return cfg.export_orden;
  return buildDefaultExportOrden();
}

export function getExportTextColsExcel() {
  const cfg = getUvaMpValidaciones();
  return new Set(cfg.export_texto_cols ?? [20]);
}

function buildDefaultExportOrden() {
  return [
    19, 50, 0, 9, 10, 11, 12, 13, null, null, 16, 17, 18, null, 28, 29, 30, 31, 32, null, null,
    68, 54, 38, 88, 65, 86, 60, 61, 62, 63, 64, 55, 56, 57, 58, 59, 71, 67, 48, 66, 49, 34, 35,
    40, 75, 41, 85, 52, 51, 83, 74, 82, 81, 37, 46, 44, 47, 78, 87, 53, 72, 76, 84, 45, 79, 36,
    33, 39, 77, 70, 80, 42, 43, 73,
    123, 124, 125, 126, 127, 128, 129, 130, 131, 132, 133, 134, 135, 136, 137,
    106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122,
    89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105,
    null, null, null, null, null, 14, 15, 138, 139, 140, 141, 142, 143, 144, 145, 146, 147, 148, 149,
    150, 151, 152, 153, 154, 155, 156, 157, 158, 159, 160, 161, 162, 163, 164, 165, 166, 167, 168,
    169, 170, 171
  ];
}

export function getExcelCabecera() {
  const cab = getUvaMpValidaciones().cabecera_excel;
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
  return getUvaMpValidaciones().validacion_archivo ?? {};
}
