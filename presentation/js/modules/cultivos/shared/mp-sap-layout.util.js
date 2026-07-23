/**
 * Expande layouts SAP compactos al cargar Excel.
 * Perfiles en presentation/data/sap-columnas.json (mp | pt | plagas).
 * No mezcla MP/PT (15+Nota+5) con Plagas (bloque continuo 21).
 */

const NOTA_CONDICION_JS = 27;
const AFTER_SAP5_JS = 33;

/** Plagas IPP/ISP: Excel 13–33 → JS 12–32; Hora Insp en Excel 34 → JS 33. */
const PLAGAS_SAP_START_JS = 12;
const PLAGAS_AFTER_SAP_JS = 33;

const INSERTED_HEADER_BY_JS = {
  12: "Productor",
  13: "Guía de Remisión",
  14: "Etapa",
  15: "Campo",
  16: "Turno",
  17: "Fundo",
  18: "Variedad",
  19: "Fecha Cosecha",
  20: "Fecha de Producción",
  21: "Tecnologia de Postcosecha PT",
  22: "Calibre",
  23: "Tipo de Embalado",
  24: "Categoria",
  25: "Turno Linea",
  26: "Linea",
  28: "Tipo de formato",
  29: "Etiqueta",
  30: "Jaba",
  31: "Viaje",
  32: "Peso Bruto"
};

function normHeader(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function isNotaCondicionHeader(normalized) {
  return (
    normalized === "nota condicion" ||
    normalized === "nota condición" ||
    (normalized.includes("nota") && normalized.includes("condicion"))
  );
}

function isSap5ZoneHeader(normalized) {
  return (
    normalized.includes("tipo de formato") ||
    normalized.includes("tipo formato") ||
    normalized === "etiqueta" ||
    normalized === "jaba" ||
    normalized === "viaje" ||
    normalized.includes("peso bruto")
  );
}

function isHoraInspOrProdiplona(normalized) {
  return (
    normalized.includes("hora insp") ||
    normalized.includes("prodiplona")
  );
}

function findNotaCondicionJs(headers) {
  for (let i = 0; i < headers.length; i += 1) {
    if (isNotaCondicionHeader(normHeader(headers[i]))) return i;
  }
  return -1;
}

function findHoraInspJs(headers) {
  for (let i = 0; i < headers.length; i += 1) {
    if (isHoraInspOrProdiplona(normHeader(headers[i]))) return i;
  }
  return -1;
}

function labelMapFromMpPtPerfil(perfil) {
  const antes = perfil?.columnas_sap_antes_nota;
  const despues = perfil?.columnas_sap_despues_nota;
  if (!Array.isArray(antes) || !Array.isArray(despues)) return null;
  const map = { ...INSERTED_HEADER_BY_JS };
  antes.forEach((name, i) => {
    map[12 + i] = name;
  });
  despues.forEach((name, i) => {
    map[28 + i] = name;
  });
  return map;
}

function insertColumns(headers, rows, atJs, labels) {
  const count = labels.length;
  const empties = Array.from({ length: count }, () => "");
  const nextHeaders = [...headers.slice(0, atJs), ...labels, ...headers.slice(atJs)];
  const nextRows = (rows || []).map((row) => {
    const base = Array.isArray(row) ? [...row] : [];
    while (base.length < atJs) base.push("");
    return [...base.slice(0, atJs), ...empties, ...base.slice(atJs)];
  });
  return { headers: nextHeaders, rows: nextRows };
}

function labelsForMpPtInsert(startJs, count, labelByJs) {
  return Array.from({ length: count }, (_, i) => labelByJs[startJs + i] || "");
}

/**
 * Quita errores «obligatorio» de columnas SAP que se insertaron vacías al alinear layout.
 * No oculta otros tipos (LMR, rangos, etc.) ni obligatorios de columnas que sí venían en el Excel.
 */
export function stripInsertedSapObligatorioErrors(errorMap, insertedJsIndexes = []) {
  if (!errorMap?.size || !insertedJsIndexes?.length) return errorMap;
  const skipColNums = new Set(
    insertedJsIndexes.map((js) => Number(js) + 1).filter((n) => Number.isFinite(n) && n > 0)
  );
  if (!skipColNums.size) return errorMap;

  [...errorMap.entries()].forEach(([filaNum, filaMap]) => {
    if (!filaMap?.size) return;
    [...filaMap.entries()].forEach(([colNum, err]) => {
      if (!skipColNums.has(Number(colNum))) return;
      const tipo = String(err?.tipo || "").toLowerCase();
      const msg = String(err?.problema || err?.message || "").toLowerCase();
      if (tipo === "obligatorio" || msg.includes("obligatorio")) {
        filaMap.delete(colNum);
      }
    });
    if (!filaMap.size) errorMap.delete(filaNum);
  });
  return errorMap;
}

/**
 * MP / PT: 15 SAP + Nota (Excel 28) + 5 SAP → negocio en Excel 34.
 * @param {unknown[]} headers
 * @param {unknown[][]} dataRows
 * @param {object|null} [perfil] perfil mp|pt desde sap-columnas.json
 */
export function expandMissingSapLayout(headers, dataRows = [], perfil = null) {
  const labelByJs = labelMapFromMpPtPerfil(perfil) || INSERTED_HEADER_BY_JS;
  let nextHeaders = [...(headers || [])];
  let nextRows = (dataRows || []).map((r) => (Array.isArray(r) ? [...r] : []));
  let insertedSap15 = 0;
  let insertedSap5 = 0;
  const insertedJsIndexes = [];

  const emptyResult = () => ({
    headers: nextHeaders,
    rows: nextRows,
    expanded: false,
    insertedSap15: 0,
    insertedSap5: 0,
    insertedJsIndexes: []
  });

  const notaJs = findNotaCondicionJs(nextHeaders);
  if (notaJs < 0) return emptyResult();

  if (notaJs < NOTA_CONDICION_JS) {
    insertedSap15 = NOTA_CONDICION_JS - notaJs;
    for (let i = 0; i < insertedSap15; i += 1) insertedJsIndexes.push(notaJs + i);
    ({ headers: nextHeaders, rows: nextRows } = insertColumns(
      nextHeaders,
      nextRows,
      notaJs,
      labelsForMpPtInsert(notaJs, insertedSap15, labelByJs)
    ));
  }

  const notaNow = findNotaCondicionJs(nextHeaders);
  const afterNotaJs = notaNow >= 0 ? notaNow + 1 : -1;
  const afterNorm = afterNotaJs >= 0 ? normHeader(nextHeaders[afterNotaJs]) : "";

  if (
    afterNotaJs >= 0 &&
    afterNotaJs < AFTER_SAP5_JS &&
    afterNorm &&
    !isSap5ZoneHeader(afterNorm)
  ) {
    insertedSap5 = AFTER_SAP5_JS - afterNotaJs;
    for (let i = 0; i < insertedSap5; i += 1) insertedJsIndexes.push(afterNotaJs + i);
    ({ headers: nextHeaders, rows: nextRows } = insertColumns(
      nextHeaders,
      nextRows,
      afterNotaJs,
      labelsForMpPtInsert(afterNotaJs, insertedSap5, labelByJs)
    ));
  }

  return {
    headers: nextHeaders,
    rows: nextRows,
    expanded: insertedSap15 > 0 || insertedSap5 > 0,
    insertedSap15,
    insertedSap5,
    insertedJsIndexes
  };
}

/**
 * Plagas IPP/ISP: bloque continuo de 21 columnas (Excel 13–33) antes de Hora Insp / Prodiplona.
 * @param {unknown[]} headers
 * @param {unknown[][]} dataRows
 * @param {object|null} [perfil] perfil plagas desde sap-columnas.json
 */
export function expandPlagasSapLayout(headers, dataRows = [], perfil = null) {
  const sapNames = Array.isArray(perfil?.columnas) ? perfil.columnas : [];
  let nextHeaders = [...(headers || [])];
  let nextRows = (dataRows || []).map((r) => (Array.isArray(r) ? [...r] : []));

  const horaJs = findHoraInspJs(nextHeaders);
  if (horaJs < 0) {
    return {
      headers: nextHeaders,
      rows: nextRows,
      expanded: false,
      insertedSap21: 0
    };
  }

  // Plantilla completa: Hora Insp ya en Excel 34 (JS 33).
  if (horaJs >= PLAGAS_AFTER_SAP_JS) {
    return {
      headers: nextHeaders,
      rows: nextRows,
      expanded: false,
      insertedSap21: 0
    };
  }

  // Compacta: Hora Insp pegada tras Med Muestra → insertar bloque 21 (o el hueco necesario).
  const insertedSap21 = PLAGAS_AFTER_SAP_JS - horaJs;
  const insertAt = Math.min(horaJs, PLAGAS_SAP_START_JS);
  const labels =
    sapNames.length >= insertedSap21
      ? sapNames.slice(0, insertedSap21)
      : [
          ...sapNames,
          ...Array.from({ length: Math.max(0, insertedSap21 - sapNames.length) }, () => "")
        ];

  ({ headers: nextHeaders, rows: nextRows } = insertColumns(
    nextHeaders,
    nextRows,
    insertAt,
    labels
  ));

  return {
    headers: nextHeaders,
    rows: nextRows,
    expanded: insertedSap21 > 0,
    insertedSap21
  };
}
