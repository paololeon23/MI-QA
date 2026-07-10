/** Exportación Excel filtrado — Uva MP (MPCUV) */

import { getExportOrdenJs, getExportTextColsExcel } from "./uva-mp.config.js";
import { parseFlexibleNumber, parseExcelDateISO, valorCelda } from "./uva-mp.validation.js";

export function valorCeldaExport(val, indiceOrigen, textColsExcel) {
  if (val === undefined || val === null || valorCelda(val).trim() === "") {
    return "";
  }

  const colExcel = indiceOrigen + 1;
  if (textColsExcel.has(colExcel)) {
    const iso = parseExcelDateISO(val);
    if (iso) return formatISOToDMYExport(iso);
    return valorCelda(val);
  }

  const n = parseFlexibleNumber(val);
  if (Number.isFinite(n)) return n;
  return valorCelda(val);
}

function formatISOToDMYExport(iso) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function buildFilteredSheetData(rows, headers) {
  const order = getExportOrdenJs();
  const textCols = getExportTextColsExcel();

  const encabezados = order.map((indice) =>
    indice === null ? "" : headers[indice] || ""
  );

  const wsData = [
    encabezados.map((h) => ({
      v: h || "",
      t: "s",
      s: { font: { bold: true } }
    }))
  ];

  rows.forEach((row) => {
    wsData.push(
      order.map((indice) => {
        if (indice === null) return "";
        const val = valorCeldaExport(row[indice], indice, textCols);
        if (val === "") return "";
        if (typeof val === "number") return { v: val, t: "n" };
        return { v: String(val), t: "s" };
      })
    );
  });

  return wsData;
}

function estiloExportCeldaError(cellClass) {
  const isEmpty = cellClass === "agv-mp-cell-error-empty";
  if (isEmpty) {
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

export function buildFullSheetDataWithErrors(rows, headers, totalCols, getCellMeta) {
  const wsData = [];

  wsData.push(
    headers.map((header) => ({
      v: header || "",
      t: "s",
      s: { font: { bold: true } }
    }))
  );

  rows.forEach((row) => {
    const linea = [];
    for (let js = 0; js < totalCols; js++) {
      const raw = row[js];
      let val;
      if ([19, 50, 69].includes(js)) {
        const iso = parseExcelDateISO(raw);
        val = iso ? iso : valorCelda(raw);
      } else {
        val = valorCelda(raw);
      }
      const { cellClass } = getCellMeta(row, js);

      if (!cellClass) {
        if (val === "") linea.push("");
        else if (typeof val === "number") linea.push(val);
        else linea.push({ v: val, t: "s" });
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

  return wsData;
}

export function writeUvaMpWorkbook(filename, sheetName, wsData) {
  const wb = window.XLSX.utils.book_new();
  const ws = window.XLSX.utils.aoa_to_sheet(wsData);
  window.XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  window.XLSX.writeFile(wb, filename);
}
