/**
 * MPHPAR (MPHA): normaliza columnas al orden canónico antes de validar.
 * Si el Excel ya viene en ese orden, no se toca.
 */

const LARVA = "Pudrición con Larva";
const SUM_COND = "Sumatoria Defectos de Condición";
const SUM_CAL = "Sumatoria Defectos de Calidad";

/** Orden final esperado (Excel 1..104). */
export const MPHA_TARGET_HEADERS = [
  "Id",
  "Inspección código",
  "Inspección descripción",
  "Fecha registro",
  "Hora",
  "Estado",
  "Usuario",
  "Tipo Calidad",
  "Pallet",
  "Lote",
  "Cant Muestra",
  "Med Muestra",
  "Productor",
  "Guía de Remisión",
  "Etapa",
  "Campo",
  "Turno",
  "Fundo",
  "Variedad",
  "Fecha Cosecha",
  "Fecha de Producción",
  "Tecnologia de Postcosecha PT",
  "Calibre",
  "Tipo de Embalado",
  "Categoria",
  "Turno Linea",
  "Linea",
  "Nota Condicion",
  "Tipo de formato",
  "Etiqueta",
  "Jaba",
  "Viaje",
  "Peso Bruto",
  "Condición Transporte",
  "Deformes",
  "Desgarro Pedicelar",
  "Deshidratación",
  "Días de Precosecha",
  "Polvo",
  "Exudación Jugo",
  "Fecha de inspección",
  "Fruto Mojada/ Condensada",
  "Fruto Rojo",
  "Fruto Verde",
  "Herida Abierta",
  "Hongo",
  "Inoloro",
  "Insecto",
  "Jabas sobre Pallet",
  "Limpieza de Transporte",
  "Fecha Actualización LMR",
  "Observación",
  "Pedúnculo",
  "Pudrición",
  "Pudrición con Larva",
  "Restos Florales",
  "Residuos",
  "Russet",
  "Sin Pruina",
  "T° Ambiente",
  "T° PULPA",
  "Transporte Protegido",
  "Turno",
  "Trazabilidad",
  "Pudrición",
  "Hongo",
  "Fruta Mojada / Condensada",
  "Exudación Jugo",
  "Herida Abierta",
  "Desgarro Pedicelar",
  "Deshidratación",
  "Presencia de insectos",
  "Residuos",
  "Polvo",
  "Fruto Verde",
  "Fruto Rojo",
  "Sin pruina",
  "Heridas Cicatrizadas / Russet",
  "Restos florales",
  "Presencia de Pedúnculo",
  "Deformes",
  "Sumatoria Defectos de Calidad",
  "Pudrición con Larva",
  "Sumatoria Defectos de Condición",
  "Pudrición",
  "Hongo",
  "Fruta Mojada / Condensada",
  "Exudación Jugo",
  "Herida Abierta",
  "Desgarro Pedicelar",
  "Deshidratación",
  "Presencia de insectos",
  "Residuos",
  "Polvo",
  "Fruto Verde",
  "Fruto Rojo",
  "Sin pruina",
  "Heridas Cicatrizadas / Russet",
  "Restos florales",
  "Presencia de Pedúnculo",
  "Deformes",
  "Sumatoria Defectos de Calidad",
  "Pudrición con Larva",
  "Sumatoria Defectos de Condición"
];

function normHeader(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s*\/\s*/g, "/")
    .trim();
}

function isLarva(h) {
  const n = normHeader(h);
  return n.includes("pudricion") && n.includes("larva");
}

function isSumCond(h) {
  const n = normHeader(h);
  return n.includes("sumatoria") && n.includes("condicion");
}

function isSumCal(h) {
  const n = normHeader(h);
  return n.includes("sumatoria") && n.includes("calidad");
}

function isPudricionOnly(h) {
  const n = normHeader(h);
  return n.includes("pudricion") && !n.includes("larva");
}

function isInsectos(h) {
  return normHeader(h).includes("presencia de insectos") || normHeader(h) === "insectos";
}

/** ¿Ya está en el orden canónico? */
export function isMphaCanonicalLayout(headers = []) {
  if (!Array.isArray(headers) || headers.length !== 104) return false;
  // Anclas clave (JS 0-based)
  return (
    isLarva(headers[54]) &&
    isInsectos(headers[71]) &&
    isSumCal(headers[81]) &&
    isLarva(headers[82]) &&
    isSumCond(headers[83]) &&
    isInsectos(headers[91]) &&
    isSumCal(headers[101]) &&
    isLarva(headers[102]) &&
    isSumCond(headers[103])
  );
}

function insertColumn(headers, rows, excelCol1Based, headerName) {
  const js = excelCol1Based - 1;
  const nextHeaders = [...headers];
  nextHeaders.splice(js, 0, headerName);
  const nextRows = rows.map((row) => {
    const copy = Array.isArray(row) ? [...row] : [];
    copy.splice(js, 0, "");
    return copy;
  });
  return { headers: nextHeaders, rows: nextRows };
}

/**
 * Mueve Sumatoria Condición detrás de Sumatoria Calidad e inserta/ubica Larva.
 * Entrada típica: SumCond | insectos…Deformes | [Larva?] | SumCal | …
 * Salida:         insectos…Deformes | SumCal | Larva | SumCond | …
 */
function moveSumCondBlockAfterSumCal(headers, rows, excelColSumCond) {
  const sumJs = excelColSumCond - 1;
  if (sumJs < 0 || sumJs >= headers.length) {
    return { headers, rows, changed: false };
  }
  if (!isSumCond(headers[sumJs])) {
    return { headers, rows, changed: false };
  }

  let i = sumJs + 1;
  const defectStart = i;
  while (
    i < headers.length &&
    !isSumCal(headers[i]) &&
    !isLarva(headers[i]) &&
    !isSumCond(headers[i])
  ) {
    i += 1;
  }
  const defectEnd = i;

  let larvaJsBefore = -1;
  if (i < headers.length && isLarva(headers[i])) {
    larvaJsBefore = i;
    i += 1;
  }

  if (i >= headers.length || !isSumCal(headers[i])) {
    return { headers, rows, changed: false };
  }
  const sumCalJs = i;

  let afterStart = sumCalJs + 1;
  let larvaJsAfter = -1;
  if (afterStart < headers.length && isLarva(headers[afterStart])) {
    larvaJsAfter = afterStart;
    afterStart += 1;
  }

  const larvaHeader =
    (larvaJsBefore >= 0 ? headers[larvaJsBefore] : null) ||
    (larvaJsAfter >= 0 ? headers[larvaJsAfter] : null) ||
    LARVA;

  const defects = headers.slice(defectStart, defectEnd);
  const before = headers.slice(0, sumJs);
  const after = headers.slice(afterStart);
  const nextHeaders = [
    ...before,
    ...defects,
    headers[sumCalJs],
    larvaHeader,
    headers[sumJs],
    ...after
  ];

  const nextRows = rows.map((row) => {
    const copy = Array.isArray(row) ? [...row] : [];
    const larvaVal =
      larvaJsBefore >= 0 ? copy[larvaJsBefore] : larvaJsAfter >= 0 ? copy[larvaJsAfter] : "";
    return [
      ...copy.slice(0, sumJs),
      ...copy.slice(defectStart, defectEnd),
      copy[sumCalJs],
      larvaVal,
      copy[sumJs],
      ...copy.slice(afterStart)
    ];
  });

  return { headers: nextHeaders, rows: nextRows, changed: true };
}

/**
 * Normaliza layout MPHPAR al orden canónico.
 * @returns {{ headers: unknown[], rows: unknown[][], normalized: boolean, steps: string[] }}
 */
export function normalizeMphaColumnLayout(headers = [], dataRows = []) {
  let nextHeaders = [...(headers || [])];
  let nextRows = (dataRows || []).map((r) => (Array.isArray(r) ? [...r] : []));
  const steps = [];

  if (isMphaCanonicalLayout(nextHeaders)) {
    return { headers: nextHeaders, rows: nextRows, normalized: false, steps };
  }

  // 1) Col 55 = Pudrición con Larva (después de Pudrición en 54)
  if (nextHeaders.length >= 54) {
    const h54 = nextHeaders[53];
    const h55 = nextHeaders[54];
    if (isPudricionOnly(h54) && !isLarva(h55)) {
      ({ headers: nextHeaders, rows: nextRows } = insertColumn(
        nextHeaders,
        nextRows,
        55,
        LARVA
      ));
      steps.push("insert-larva-55");
    }
  }

  if (isMphaCanonicalLayout(nextHeaders)) {
    return { headers: nextHeaders, rows: nextRows, normalized: steps.length > 0, steps };
  }

  // 2) Bloque 1: mover SumCond (~72) → después de SumCal, con Larva en 83
  // Buscar primera SumCond después de Trazabilidad/defectos (~col 65+)
  let firstSumCondExcel = -1;
  for (let excel = 65; excel <= 80; excel++) {
    if (isSumCond(nextHeaders[excel - 1])) {
      firstSumCondExcel = excel;
      break;
    }
  }
  if (firstSumCondExcel > 0) {
    const r1 = moveSumCondBlockAfterSumCal(nextHeaders, nextRows, firstSumCondExcel);
    if (r1.changed) {
      nextHeaders = r1.headers;
      nextRows = r1.rows;
      steps.push(`move-sumcond-${firstSumCondExcel}-after-sumcal`);
    }
  }

  if (isMphaCanonicalLayout(nextHeaders)) {
    return { headers: nextHeaders, rows: nextRows, normalized: true, steps };
  }

  // 3) Bloque 2: misma lógica en la segunda SumCond (~92+)
  // No reutilizar el “export viejo” (92→104 directo): shift 93→92 + Larva en 103
  let secondSumCondExcel = -1;
  for (let excel = 85; excel <= 100; excel++) {
    if (isSumCond(nextHeaders[excel - 1])) {
      secondSumCondExcel = excel;
      break;
    }
  }
  if (secondSumCondExcel > 0) {
    const r2 = moveSumCondBlockAfterSumCal(nextHeaders, nextRows, secondSumCondExcel);
    if (r2.changed) {
      nextHeaders = r2.headers;
      nextRows = r2.rows;
      steps.push(`move-sumcond-${secondSumCondExcel}-after-sumcal`);
    }
  }

  // Si quedó en 104 y anclas ok, fijar nombres canónicos en larvas/sumatorias
  if (nextHeaders.length === 104) {
    const ensureName = (js, name, test) => {
      if (!test(nextHeaders[js])) nextHeaders[js] = name;
    };
    ensureName(54, LARVA, isLarva);
    ensureName(81, SUM_CAL, isSumCal);
    ensureName(82, LARVA, isLarva);
    ensureName(83, SUM_COND, isSumCond);
    ensureName(101, SUM_CAL, isSumCal);
    ensureName(102, LARVA, isLarva);
    ensureName(103, SUM_COND, isSumCond);
  }

  return {
    headers: nextHeaders,
    rows: nextRows,
    normalized: steps.length > 0,
    steps
  };
}
