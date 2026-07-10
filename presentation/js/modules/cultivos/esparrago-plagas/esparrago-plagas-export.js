/** Exportación Excel — Plagas Espárrago (orden legacy) */

import {
  cellDisplayValue,
  collectLotes,
  findDuplicates,
  formatYyyyMmDd,
  getCellExportClass
} from "./esparrago-plagas.validation.js";

const LOTE_IDX = 9;
const FECHA_IDX = 76;

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

export function buildExportMatrix(rows, headers, config) {
  const exp = config.exportacion;
  const rango1 = rangeJs(exp.rango1.desde_js, exp.rango1.hasta_js);
  const rango2 = rangeJs(exp.rango2.desde_js, exp.rango2.hasta_js);
  const rango3 = rangeJs(exp.rango3.desde_js, exp.rango3.hasta_js);
  const fmtIdx = exp.formatear_fecha_js ?? 19;

  const headerRow = [
    ...rango1.map((idx) => headers[idx] || `Col ${idx + 1}`),
    exp.columnas_vacias[0] || "VACIO_1",
    ...rango2.map((idx) => headers[idx] || `Col ${idx + 1}`),
    exp.columnas_vacias[1] || "VACIO_2",
    exp.columnas_vacias[2] || "VACIO_3",
    ...rango3.map((idx) => headers[idx] || `Col ${idx + 1}`)
  ];

  const dataRows = rows.map((row) => [
    ...rango1.map((idx) => {
      let val = row[idx] ?? "";
      if (idx === fmtIdx) return formatYyyyMmDd(val) || val;
      return val;
    }),
    "",
    ...rango2.map((idx) => row[idx] ?? ""),
    "",
    "",
    ...rango3.map((idx) => row[idx] ?? "")
  ]);

  return [headerRow, ...dataRows];
}

export function writePlagasExportFile(rows, headers, config, fileName) {
  if (!window.XLSX?.utils) return false;
  const matrix = buildExportMatrix(rows, headers, config);
  const wb = window.XLSX.utils.book_new();
  const ws = window.XLSX.utils.aoa_to_sheet(matrix);
  window.XLSX.utils.book_append_sheet(wb, ws, "Revision_Export");
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
