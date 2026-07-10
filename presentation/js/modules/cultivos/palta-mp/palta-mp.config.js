/** Palta MP (MPCP) — carga validaciones JSON + reglas configuration-driven */

import { cargarReglasDesdeRuta } from "../../../../../engine/rule-engine.js";
import {
  getLongitudExactaDesdeReglas,
  mergeValidacionesDesdeReglas
} from "../../../../../engine/cartilla-rules.adapter.js";

let _validaciones = null;
let _reglas = null;
let _validationConfig = null;

export const CONFIG_PATH = "presentation/data/palta-mp-validaciones.json";
export const REGLAS_PATH = "rules/modulos/palta-mp.rules.json";

export async function loadPaltaMpValidaciones(version = "") {
  const qs = version ? `?v=${version}` : "";
  const [res, reglas] = await Promise.all([
    fetch(`${CONFIG_PATH}${qs}`),
    cargarReglasDesdeRuta(`${REGLAS_PATH}${qs}`).catch(() => null)
  ]);
  if (!res.ok) throw new Error("No se pudo cargar palta-mp-validaciones.json");
  _validaciones = await res.json();
  _reglas = reglas;
  _validationConfig = mergeValidacionesDesdeReglas(_validaciones, reglas, {
    duplicateRuleTipo: "duplicado_en_fecha"
  });
  return _validaciones;
}

export function getValidationConfig() {
  if (!_validationConfig) throw new Error("Validaciones Palta MP no cargadas");
  return _validationConfig;
}

export function getPaltaMpValidaciones() {
  if (!_validaciones) throw new Error("Validaciones Palta MP no cargadas");
  return _validaciones;
}

export const CARTILLA_CODE = "MPCP";
export const FILAS_SKIP = 5;

export function getTotalColumnas() {
  return getValidationConfig().total_columnas ?? 157;
}

export function getColInspeccionJs() {
  return getPaltaMpValidaciones().filtro_principal?.indice_js ?? 64;
}

export function getColLmrJs() {
  return getPaltaMpValidaciones().fecha_lmr?.indice_js ?? 71;
}

export function getColLoteJs() {
  return getPaltaMpValidaciones().validaciones_resumen?.lote?.indice_js ?? 9;
}

export function getLoteLongitudExacta() {
  const idx = getColLoteJs();
  const desdeReglas = getLongitudExactaDesdeReglas(_reglas, idx);
  if (desdeReglas != null) return desdeReglas;
  return getPaltaMpValidaciones().validaciones_resumen?.lote?.longitud ?? 10;
}

export function getPaltaMpReglas() {
  return _reglas;
}

export function getColInoloroJs() {
  return getPaltaMpValidaciones().col_inoloro_js ?? 68;
}

export function getStickyCols() {
  return getPaltaMpValidaciones().columnas_sticky ?? [0, 1, 6, 9];
}

export function getMostrarTodasColumnas() {
  return getPaltaMpValidaciones().mostrar_todas_columnas !== false;
}

export function getExportOrdenJs() {
  const cfg = getPaltaMpValidaciones();
  if (cfg.export_orden?.length) return cfg.export_orden;
  return buildDefaultExportOrden();
}

export function getExportTextColsExcel() {
  const cfg = getPaltaMpValidaciones();
  return new Set(cfg.export_texto_cols ?? [1, 10, 19]);
}

function buildDefaultExportOrden() {
  const orden = [];
  const col = (n) => orden.push(n - 1);
  const rango = (a, b) => {
    for (let n = a; n <= b; n++) col(n);
  };
  const vacio = () => orden.push(null);

  col(1);
  col(4);
  col(5);
  vacio();
  rango(10, 19);
  vacio();
  vacio();
  rango(28, 34);
  rango(35, 62);
  rango(64, 78);
  col(63);
  rango(79, 96);
  rango(97, 111);
  rango(113, 119);
  col(112);
  rango(135, 149);
  rango(151, 157);
  col(150);
  return orden;
}

export function getExcelCabecera() {
  const cab = getPaltaMpValidaciones().cabecera_excel;
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
  return getPaltaMpValidaciones().validacion_archivo ?? {};
}
