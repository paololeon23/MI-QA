/** Espárrago PT (PTES) — carga validaciones JSON + reglas configuration-driven */

import { cargarReglasDesdeRuta } from "../../../../../engine/rule-engine.js";
import {
  buildColumnLabelsByIndex,
  mergeValidacionesDesdeReglas
} from "../../../../../engine/cartilla-rules.adapter.js";

let _validaciones = null;
let _reglas = null;
let _validationConfig = null;

export const CONFIG_PATH = "presentation/data/esparrago-pt-validaciones.json";
export const REGLAS_PATH = "rules/modulos/esparrago-pt.rules.json";

export async function loadEsparragoPtValidaciones(version = "") {
  const qs = version ? `?v=${version}` : "";
  const [res, reglas] = await Promise.all([
    fetch(`${CONFIG_PATH}${qs}`),
    cargarReglasDesdeRuta(`${REGLAS_PATH}${qs}`).catch(() => null)
  ]);
  if (!res.ok) throw new Error("No se pudo cargar esparrago-pt-validaciones.json");
  _validaciones = await res.json();
  _reglas = reglas;
  _validationConfig = reglas
    ? mergeValidacionesDesdeReglas(_validaciones, reglas)
    : { ..._validaciones, validaciones_por_columna: [] };
  return _validaciones;
}

export function getEsparragoPtValidaciones() {
  if (!_validaciones) throw new Error("Validaciones PT Espárrago no cargadas");
  return _validaciones;
}

export function getValidationConfig() {
  if (!_validationConfig) throw new Error("Validaciones PT Espárrago no cargadas");
  return _validationConfig;
}

export function getReglasOrigen() {
  return _reglas;
}

export function getColumnLabelsByIndex() {
  return buildColumnLabelsByIndex(_reglas);
}

export function getTotalColumnas() {
  return getValidationConfig().total_columnas ?? 137;
}

export const CARTILLA_CODE = "PTES";
export const CARTILLA_HEADER_ROW = 4;
export const CARTILLA_HEADER_COL = 9;
export const HEADER_ROW_INDEX = 5;
export const DATA_START_INDEX = 6;

export function getColInspeccionJs() {
  return getEsparragoPtValidaciones().filtro_principal?.indice_js ?? 46;
}

export function getColLmrJs() {
  return getEsparragoPtValidaciones().fecha_lmr?.indice_js ?? 51;
}

export function getVisualColsPt() {
  return getEsparragoPtValidaciones().columnas_visibles_frontend?.indices_js ?? [0, 1, 6, 9];
}

export function getStickyColsPt() {
  return getEsparragoPtValidaciones().columnas_sticky ?? [0, 1, 6, 9];
}

/** Índices de columna en tabla (display) que no se pueden ocultar — mismas que sticky. */
export function getProtectedColIndicesPt() {
  const visual = getVisualColsPt();
  return new Set(
    getStickyColsPt()
      .map((excelCol) => visual.indexOf(excelCol))
      .filter((i) => i >= 0)
  );
}

export function getFilterClienteCol() {
  return getEsparragoPtValidaciones().filtros_tabla?.cliente_indice_js ?? 37;
}

export function getFilterFormatoCol() {
  return getEsparragoPtValidaciones().filtros_tabla?.formato_indice_js ?? 49;
}

export function getExcelCabecera() {
  const cab = getEsparragoPtValidaciones().cabecera_excel;
  if (!cab) {
    return {
      titulo: { fila: 1, columna: 1 },
      campos: [
        { clave: "empresa", fila: 3, columna: 2 },
        { clave: "mandante", fila: 3, columna: 4 },
        { clave: "cultivo", fila: 4, columna: 7 },
        { clave: "grupo", fila: 4, columna: 9 },
        { clave: "estado", fila: 4, columna: 14 }
      ]
    };
  }
  return {
    titulo: { fila: cab.titulo.fila_js + 1, columna: cab.titulo.col_js + 1 },
    campos: cab.campos.map((f) => ({
      clave: f.clave,
      fila: f.fila_js + 1,
      columna: f.col_js + 1
    }))
  };
}

function range(from, to) {
  const out = [];
  for (let i = from; i <= to; i++) out.push(i);
  return out;
}

export function getExportOrderJs() {
  const exp = getEsparragoPtValidaciones().exportacion;
  if (exp?.orden_indices_js) {
    const base = [...exp.orden_indices_js];
    if (!base.some((i) => i >= 38)) base.push(...range(38, 132));
    return base;
  }
  return [3, 4, 9, 10, 27, 33, 34, 35, 36, 37, ...range(38, 132)];
}

export function getExportTextColsJs() {
  const exp = getEsparragoPtValidaciones().exportacion;
  return new Set(exp?.texto_indices_js ?? [9, 50]);
}

export function getExportDateColsJs() {
  const exp = getEsparragoPtValidaciones().exportacion;
  return new Set(exp?.fecha_indices_js ?? [3, 45, 46, 51]);
}
