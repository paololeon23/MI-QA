/** Palta PT (PTCP) — carga validaciones JSON + reglas configuration-driven */

import { cargarReglasDesdeRuta } from "../../../../../engine/rule-engine.js";
import { mergeValidacionesDesdeReglas } from "../../../../../engine/cartilla-rules.adapter.js";

let _validaciones = null;
let _reglas = null;
let _validationConfig = null;

export const CONFIG_PATH = "presentation/data/palta-pt-validaciones.json";
export const REGLAS_PATH = "rules/modulos/palta-pt.rules.json";

function attachRangosObligatorios(config, base) {
  const rangos = base?.validaciones_resumen?.obligatorias_rangos_excel || [[74, 119]];
  const rangosObligatorios = rangos.map(([desdeExcel, hastaExcel]) => ({
    desde_js: desdeExcel - 1,
    hasta_js: hastaExcel - 1,
    mensaje: `Campo obligatorio (${desdeExcel}-${hastaExcel})`
  }));
  return { ...config, rangos_obligatorios: rangosObligatorios };
}

export async function loadPaltaPtValidaciones(version = "") {
  const qs = version ? `?v=${version}` : "";
  const [res, reglas] = await Promise.all([
    fetch(`${CONFIG_PATH}${qs}`),
    cargarReglasDesdeRuta(`${REGLAS_PATH}${qs}`).catch(() => null)
  ]);
  if (!res.ok) throw new Error("No se pudo cargar palta-pt-validaciones.json");
  _validaciones = await res.json();
  _reglas = reglas;
  _validationConfig = attachRangosObligatorios(
    mergeValidacionesDesdeReglas(_validaciones, reglas),
    _validaciones
  );
  return _validaciones;
}

export function getPaltaPtValidaciones() {
  if (!_validaciones) throw new Error("Validaciones Palta PT no cargadas");
  return _validaciones;
}

export function getValidationConfig() {
  if (!_validationConfig) throw new Error("Validaciones Palta PT no cargadas");
  return _validationConfig;
}

export const CARTILLA_CODE = "PTCP";
export const CARTILLA_HEADER_ROW = 4;
export const CARTILLA_HEADER_COL = 9;
export const HEADER_ROW_INDEX = 5;
export const DATA_START_INDEX = 6;

export function getTotalColumnas() {
  return getValidationConfig().total_columnas ?? 119;
}

/** Fecha de embalaje (filtro principal) — js 54 */
export function getColEmbalajeJs() {
  return getPaltaPtValidaciones().filtro_principal?.indice_js ?? 54;
}

/** Fecha de cosecha — js 53 */
export function getColCosechaJs() {
  return getPaltaPtValidaciones().validaciones_resumen?.fecha_cosecha_excel
    ? getPaltaPtValidaciones().validaciones_resumen.fecha_cosecha_excel - 1
    : 53;
}

export function getColTrazabilidadJs() {
  return getPaltaPtValidaciones().validaciones_resumen?.trazabilidad_excel
    ? getPaltaPtValidaciones().validaciones_resumen.trazabilidad_excel - 1
    : 72;
}

export function getColumnasFront() {
  const cfg = getPaltaPtValidaciones().columnas_visibles_frontend;
  if (cfg?.indices_js?.length) return [...cfg.indices_js, ...(cfg.extra ?? [])];
  return [
    0, 3, 4, 6, 9, 10, 27, 33, 37, 38, 51, 53, 54, 55, 60, 65, 69, 70, 71, 72, "E_C"
  ];
}

export function getStickyColsPt() {
  return getPaltaPtValidaciones().columnas_sticky ?? [0, 6, 9];
}

export function getProtectedColIndicesPt() {
  const visual = getColumnasFront();
  const sticky = getStickyColsPt();
  return new Set(
    sticky
      .map((excelCol) => visual.indexOf(excelCol))
      .filter((i) => i >= 0)
  );
}

export function getFilterDestinoCol() {
  return getPaltaPtValidaciones().filtros_tabla?.destino_indice_js ?? 51;
}

export function getFilterFormatoCol() {
  return getPaltaPtValidaciones().filtros_tabla?.formato_indice_js ?? 55;
}

export function getExcelCabecera() {
  const cab = getPaltaPtValidaciones().cabecera_excel;
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
  return getPaltaPtValidaciones().validacion_archivo ?? {};
}

export function getExportOrderJs() {
  const exp = getPaltaPtValidaciones().exportacion;
  if (exp?.orden_indices_js?.length) return [...exp.orden_indices_js];
  const out = [];
  for (let i = 0; i < getTotalColumnas(); i++) out.push(i);
  return out;
}

export function getExportTextColsJs() {
  const exp = getPaltaPtValidaciones().exportacion;
  if (exp?.texto_indices_js) return new Set(exp.texto_indices_js);
  const out = new Set();
  for (let i = 0; i <= 55; i++) out.add(i);
  return out;
}
