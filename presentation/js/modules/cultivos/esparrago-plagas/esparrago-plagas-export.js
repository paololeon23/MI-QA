/** Exportación Excel — Plagas Espárrago (orden legacy) */

import {
  cellDisplayValue,
  collectLotes,
  findDuplicates,
  formatPlagasCellDisplay,
  getCellExportClass
} from "./esparrago-plagas.validation.js";

const LOTE_IDX = 9;
const FECHA_IDX = 76;

/** Excel: fechas se exportan como texto dd/mm/yyyy (no como número serial). */
const DATE_COLS_JS = new Set([3, 19, 20, 76]);
/** Excel cols que deben quedar como texto: 10 Lote, 13 Productor, 19 Variedad. */
const TEXT_COLS_EXCEL = new Set([10, 13, 19]);

function parseFlexibleNumber(val) {
  const str = cellDisplayValue(val).replace(/\s/g, "").replace(",", ".");
  if (!str) return NaN;
  const n = Number(str);
  return Number.isFinite(n) ? n : NaN;
}

/** Valor de celda para export: número si aplica; fechas y cols 10/13/19 como texto. */
function valorExportCelda(idx, rawVal) {
  if (DATE_COLS_JS.has(idx)) {
    return formatPlagasCellDisplay(idx, rawVal) || "";
  }
  const excelCol = idx + 1;
  if (TEXT_COLS_EXCEL.has(excelCol)) {
    return cellDisplayValue(rawVal);
  }
  const display = formatPlagasCellDisplay(idx, rawVal);
  if (display === "") return "";
  const n = parseFlexibleNumber(rawVal);
  if (Number.isFinite(n)) return n;
  return display;
}

function estiloExportCeldaError(cellClass) {
  if (cellClass === "agv-mp-cell-error-empty") {
    return {
      fill: { patternType: "solid", fgColor: { rgb: "FFC94C4C" } },
      font: { color: { rgb: "FFFFFFFF" }, bold: true }
    };
  }
  return {
    fill: { patternType: "solid", fgColor: { rgb: "FFFEE2E2" } },
    font: { color: { rgb: "FFC94C4C" }, bold: true }
  };
}

function buildRowValidationContext(row, cartilla, rawDataByCartilla) {
  const fecha = cellDisplayValue(row[FECHA_IDX]);
  const rowsIPP = (rawDataByCartilla.IPP || []).filter(
    (r) => cellDisplayValue(r[FECHA_IDX]) === fecha
  );
  const rowsISP = (rawDataByCartilla.ISP || []).filter(
    (r) => cellDisplayValue(r[FECHA_IDX]) === fecha
  );
  const lotesIPP = collectLotes(rowsIPP, LOTE_IDX);
  const lotesISP = collectLotes(rowsISP, LOTE_IDX);
  const dupsIPP = findDuplicates(lotesIPP);
  const dupsISP = findDuplicates(lotesISP);
  return {
    tipo: cartilla,
    duplicadosCartilla: cartilla === "IPP" ? dupsIPP : dupsISP,
    lotesIPP,
    lotesISP
  };
}

function rangeJs(from, to) {
  const out = [];
  for (let i = from; i <= to; i += 1) out.push(i);
  return out;
}

/** Ordenar de A a Z por Lote (Excel col 10 / JS 9). */
function sortRowsByLoteAsc(rows) {
  return [...(rows || [])].sort((a, b) => {
    const la = cellDisplayValue(a?.[LOTE_IDX]);
    const lb = cellDisplayValue(b?.[LOTE_IDX]);
    return la.localeCompare(lb, "es", { numeric: true, sensitivity: "base" });
  });
}

export function buildExportMatrix(rows, headers, config) {
  const exp = config.exportacion;
  const rango1 = rangeJs(exp.rango1.desde_js, exp.rango1.hasta_js);
  const rango2 = rangeJs(exp.rango2.desde_js, exp.rango2.hasta_js);
  const rango3 = rangeJs(exp.rango3.desde_js, exp.rango3.hasta_js);
  const sortedRows = sortRowsByLoteAsc(rows);

  const headerRow = [
    ...rango1.map((idx) => headers[idx] || `Col ${idx + 1}`),
    exp.columnas_vacias[0] || "VACIO_1",
    ...rango2.map((idx) => headers[idx] || `Col ${idx + 1}`),
    exp.columnas_vacias[1] || "VACIO_2",
    exp.columnas_vacias[2] || "VACIO_3",
    ...rango3.map((idx) => headers[idx] || `Col ${idx + 1}`)
  ];

  const formatCell = (idx, row) => valorExportCelda(idx, row[idx] ?? "");

  const dataRows = sortedRows.map((row) => [
    ...rango1.map((idx) => formatCell(idx, row)),
    "",
    ...rango2.map((idx) => formatCell(idx, row)),
    "",
    "",
    ...rango3.map((idx) => formatCell(idx, row))
  ]);

  return [headerRow, ...dataRows];
}

export function writePlagasExportFile(rows, headers, config, fileName, sheetName = "Sheet1") {
  if (!window.XLSX?.utils) return false;
  const matrix = buildExportMatrix(rows, headers, config);
  const wb = window.XLSX.utils.book_new();
  const ws = window.XLSX.utils.aoa_to_sheet(matrix);
  window.XLSX.utils.book_append_sheet(wb, ws, sheetName);
  window.XLSX.writeFile(wb, fileName);
  return true;
}

/**
 * Un archivo: hoja IPP primero, luego hoja ISP.
 * Las fechas elegidas van unidas dentro de cada hoja.
 * @param {{ IPP?: unknown[][], ISP?: unknown[][] }} rowsByCartilla
 * @param {{ IPP?: unknown[], ISP?: unknown[] }|unknown[]} headersByCartilla
 */
export function writePlagasIppIspExportFile(rowsByCartilla, headersByCartilla, config, fileName) {
  if (!window.XLSX?.utils) return false;

  const resolveHeaders = (cartilla) => {
    if (Array.isArray(headersByCartilla)) return headersByCartilla;
    return headersByCartilla?.[cartilla] || headersByCartilla?.IPP || headersByCartilla?.ISP || [];
  };

  const wb = window.XLSX.utils.book_new();
  let sheets = 0;

  ["IPP", "ISP"].forEach((cartilla) => {
    if (!Object.prototype.hasOwnProperty.call(rowsByCartilla || {}, cartilla)) return;
    const rows = rowsByCartilla[cartilla] || [];
    const headers = resolveHeaders(cartilla);
    if (!headers.length) return;
    const matrix = buildExportMatrix(rows, headers, config);
    const ws = window.XLSX.utils.aoa_to_sheet(matrix);
    window.XLSX.utils.book_append_sheet(wb, ws, cartilla);
    sheets += 1;
  });

  if (!sheets) return false;
  window.XLSX.writeFile(wb, fileName);
  return true;
}

export function writePlagasErrorsExport({ cartilla, rows, headers, config, rawDataByCartilla }) {
  if (!window.XLSX?.utils || !rows?.length || !headers?.length) return false;

  const totalCols = headers.length;
  const wsData = [
    headers.map((header) => ({
      v: header || "",
      t: "s",
      s: { font: { bold: true } }
    }))
  ];

  rows.forEach((row) => {
    const ctx = buildRowValidationContext(row, cartilla, rawDataByCartilla);
    const linea = [];
    for (let js = 0; js < totalCols; js += 1) {
      const val = row[js] ?? "";
      const cellClass = getCellExportClass(js, val, ctx, config);
      if (!cellClass) {
        if (val === "") linea.push("");
        else if (typeof val === "number") linea.push(val);
        else linea.push(String(val));
      } else {
        linea.push({
          v: val === "" ? "" : val,
          t: typeof val === "number" ? "n" : "s",
          s: estiloExportCeldaError(cellClass)
        });
      }
    }
    wsData.push(linea);
  });

  const wb = window.XLSX.utils.book_new();
  const ws = window.XLSX.utils.aoa_to_sheet(wsData);
  window.XLSX.utils.book_append_sheet(wb, ws, cartilla);
  const stamp = new Date().toISOString().slice(0, 10);
  window.XLSX.writeFile(wb, `Plagas_Esparrago_${cartilla}_Errores_${stamp}.xlsx`);
  return true;
}
