/** Exportación Excel — Plagas Palta (orden legacy EXPORT_ORDEN) */

import {
  EXPORT_COLUMNAS_TEXTO,
  EXPORT_ORDEN,
  TOTAL_COLUMNAS
} from "./palta-plagas.config.js";
import {
  cellDisplayValue,
  ejecutarValidacion,
  formatYyyyMmDd,
  limpiarMarcasValidacion,
  parseFlexibleNumber,
  rowHasMarkedErrors
} from "./palta-plagas.validation.js";

function estiloFilaErrorSuave(config) {
  const exp = config.exportacion || {};
  return {
    fill: { patternType: "solid", fgColor: { rgb: exp.color_fila_error_rgb || "FFFFEBEB" } }
  };
}

function celdaVacia(val) {
  return cellDisplayValue(val) === "";
}

/** Exportación filtrada: valor según legacy valorExportCelda */
export function valorExportCelda(val, colExcel) {
  if (val === undefined || val === null || celdaVacia(val)) return undefined;
  if (colExcel === 20 || colExcel === 82) {
    const f = formatYyyyMmDd(val);
    return f || cellDisplayValue(val);
  }
  if (EXPORT_COLUMNAS_TEXTO.has(colExcel)) return cellDisplayValue(val);
  const n = parseFlexibleNumber(val);
  if (!Number.isFinite(n)) return cellDisplayValue(val);
  return n;
}

export function buildExportHeaderRow(headers) {
  return EXPORT_ORDEN.map((indice) =>
    indice === null ? undefined : headers[indice] || `Col ${indice + 1}`
  );
}

export function buildExportDataRow(row) {
  return EXPORT_ORDEN.map((indice) => {
    if (indice === null) return undefined;
    return valorExportCelda(row[indice], indice + 1);
  });
}

export function writePlagasExportFile(rows, headers, fileName) {
  if (!window.XLSX?.utils) return false;
  const matrix = [buildExportHeaderRow(headers), ...rows.map((row) => buildExportDataRow(row))];
  const wb = window.XLSX.utils.book_new();
  const ws = window.XLSX.utils.aoa_to_sheet(matrix);
  window.XLSX.utils.book_append_sheet(wb, ws, "Export");
  window.XLSX.writeFile(wb, fileName);
  return true;
}

export function writePlagasErrorsExport({ rows, headers, config }) {
  if (!window.XLSX?.utils || !rows?.length || !headers?.length) return false;

  const filas = rows.map((r) => [...r]);
  limpiarMarcasValidacion(filas);
  ejecutarValidacion(filas, config);

  const wsData = [
    headers.map((header) => ({
      v: header || "",
      t: "s",
      s: { font: { bold: true } }
    }))
  ];

  filas.forEach((row) => {
    const linea = [];
    const hasRowError = rowHasMarkedErrors(row);

    for (let js = 0; js < TOTAL_COLUMNAS; js += 1) {
      const val = valorExportCelda(row[js], js + 1);
      if (hasRowError) {
        linea.push({
          v: val === undefined ? "" : val,
          t: typeof val === "number" ? "n" : "s",
          s: estiloFilaErrorSuave(config)
        });
      } else if (val === undefined) {
        linea.push("");
      } else if (typeof val === "number") {
        linea.push(val);
      } else {
        linea.push(String(val));
      }
    }
    wsData.push(linea);
  });

  const wb = window.XLSX.utils.book_new();
  const ws = window.XLSX.utils.aoa_to_sheet(wsData);
  window.XLSX.utils.book_append_sheet(wb, ws, "Plagas");
  const stamp = new Date().toISOString().slice(0, 10);
  window.XLSX.writeFile(wb, `Plagas_Palta_ErroresResaltados_${stamp}.xlsx`, { cellStyles: true });
  return true;
}
