/** Validaciones PT Arándano — incidencias por fila y estilos de celda. */

import {
  CALIBRES_MAP,
  CALIBRES_SUBGRUPO,
  CATEGORIAS_FRUTIST,
  VAR_MAP,
  usaCalibreEspecial,
  esSubgrupoNA,
  extraerTrazabilidad,
  getJulianoFromDate,
  validarClienteDestino
} from "./arandano-pt.catalogs.js";

const PALABRAS_PROHIBIDAS_CALIBRE = [
  "JUMBO", "MIXED", "REGULAR", "SUPER JUMBO", "MEDIUM", "EXTRA JUMBO", "MIXTO", "NO COMBINADO", "SIN CALIBRAR"
];

export function getRowValues(row, profile) {
  const c = profile.cols;
  return {
    id: row[c.id],
    usuario: row[c.usuario],
    lote: row[c.lote],
    cantMuestra: row[c.cantMuestra],
    medMuestra: row[c.medMuestra],
    notaCondicion: row[c.notaCondicion],
    calibreAr: row[c.calibreAr],
    cliente: String(row[c.cliente] ?? "").trim(),
    destino: row[c.destino],
    subGrupo: row[c.subgrupo],
    tPulpa: row[c.tPulpa],
    trazCode: row[c.trazabilidad]
  };
}

export function collectRowIncidents(row, profile, fechaInspeccion) {
  const v = getRowValues(row, profile);
  const incidencias = [];
  const especial = usaCalibreEspecial(v.cliente, v.destino);

  if (!v.cliente) incidencias.push("Cliente no definido");
  if (v.cliente === "TF INTERNATIONAL") incidencias.push("Cliente incorrecto (debe ser THE FRUITIST CO)");
  if (!v.lote) incidencias.push("Lote vacío");
  else if (String(v.lote).length !== 12) incidencias.push(`Lote incorrecto (${String(v.lote).length} dígitos)`);

  const cantNum = Number(v.cantMuestra);
  if (!v.cantMuestra || cantNum <= 100) incidencias.push("Cantidad muestra insuficiente (≤ 100)");
  else if (cantNum > 530) incidencias.push(`Cantidad muestra excede límite (${cantNum} > 530)`);

  if (!v.medMuestra || String(v.medMuestra).toUpperCase() !== "UNIDADES") {
    incidencias.push("Med. Muestra debe ser 'UNIDADES'");
  }
  if (!v.notaCondicion) incidencias.push("Falta Nota Condición (Col 28)");

  if (!v.destino) incidencias.push("Falta Destino");
  else if (v.cliente) {
    let errorDestino = false;
    if (v.cliente === "THE FRUITIST CO" && !["USA", "CANADA"].includes(String(v.destino))) {
      incidencias.push(`Destino ${v.destino} no permitido para Fruitist (debe ser USA o CANADA)`);
      errorDestino = true;
    } else if (v.cliente === "FRUITIST SHANGHAI" && v.destino !== "ASIA") {
      incidencias.push(`Destino ${v.destino} no permitido para Fruitist Shanghai (debe ser ASIA)`);
      errorDestino = true;
    } else if (v.cliente === "COSTCO" && !["USA", "CANADA", "EUROPA"].includes(String(v.destino))) {
      incidencias.push(`Destino ${v.destino} no permitido para Costco (debe ser USA/CANADA/EUROPA)`);
      errorDestino = true;
    }
    if (!errorDestino) {
      const val = validarClienteDestino(v.cliente, v.destino);
      if (!val.valido && val.mensaje) incidencias.push(val.mensaje);
    }
  }

  if (especial) {
    const categorias = ["JUMBO", "MIXED", "REGULAR", "SUPER JUMBO"];
    if (!v.calibreAr) incidencias.push("Calibre AR vacío (obligatorio)");
    if (!v.subGrupo) incidencias.push("Subgrupo vacío (obligatorio)");
    else if (esSubgrupoNA(v.subGrupo)) incidencias.push("Subgrupo no puede ser N/A para cliente especial");
    if (v.calibreAr && v.subGrupo && !esSubgrupoNA(v.subGrupo)) {
      const categoriaReal = String(v.calibreAr).toUpperCase().trim();
      if (!categorias.includes(categoriaReal)) {
        incidencias.push(`Calibre "${v.calibreAr}" inválido (solo: JUMBO / MIXED / REGULAR / SUPER JUMBO)`);
      } else if (!CATEGORIAS_FRUTIST[categoriaReal]?.includes(v.subGrupo)) {
        incidencias.push(`Subgrupo ${v.subGrupo} no pertenece a ${categoriaReal}`);
      }
    }
  } else {
    if (v.cliente) {
      if (!v.calibreAr) incidencias.push("Falta Calibre AR — cliente regular");
      else {
        const trad = CALIBRES_MAP[v.calibreAr] || v.calibreAr;
        if (PALABRAS_PROHIBIDAS_CALIBRE.includes(trad)) {
          incidencias.push(`Calibre "${v.calibreAr}" no permitido para cliente regular (debe ser letra: A, B, K, etc.)`);
        }
      }
    }
    if (!esSubgrupoNA(v.subGrupo)) {
      if (!String(v.subGrupo ?? "").trim()) {
        incidencias.push("Subgrupo vacío — debe ser N/A");
      } else {
        incidencias.push(`Subgrupo debe ser N/A (valor incorrecto: ${v.subGrupo})`);
      }
    }
  }

  const numPulpa = Number(v.tPulpa);
  if (!v.tPulpa) incidencias.push("Falta T. Pulpa (Col 58)");
  else if (Number.isNaN(numPulpa) || numPulpa <= 0 || numPulpa > 5) {
    incidencias.push(`T. Pulpa fuera de rango (${v.tPulpa})`);
  }

  if (!v.trazCode) incidencias.push("Trazabilidad vacía");
  else {
    const traz = extraerTrazabilidad(v.trazCode);
    const julianoFecha = getJulianoFromDate(fechaInspeccion);
    const esDriscoll = v.cliente && v.cliente.toUpperCase().startsWith("DRISCOLL");
    if (traz && julianoFecha) {
      const julianoActual = parseInt(julianoFecha, 10);
      const julianoTraz = parseInt(traz.juliano, 10);
      if (esDriscoll) {
        if (julianoTraz !== julianoActual && julianoTraz !== julianoActual + 1) {
          incidencias.push(`Día juliano (${traz.juliano}) debe ser ${julianoFecha} o ${String(julianoActual + 1).padStart(3, "0")} para Driscoll's`);
        }
      } else if (julianoTraz !== julianoActual) {
        incidencias.push(`Día juliano (${traz.juliano}) no coincide con fecha (${julianoFecha})`);
      }
    }
    if (String(v.trazCode).length > 13) incidencias.push("Trazabilidad excede 13 caracteres");
    if (traz && !VAR_MAP[traz.variedad]) incidencias.push(`Código variedad (${traz.variedad}) no existe`);
    const varNombre = traz ? VAR_MAP[traz.variedad]?.[0] || "" : "";
    if (varNombre === "Sekoya Pop Orgánica" && String(v.trazCode)[4] !== "E") {
      incidencias.push("Falta letra 'E' en trazabilidad (Sekoya Pop Orgánica)");
    }
  }

  return incidencias;
}

export function collectWhatsappIncidents(row, profile, fechaInspeccion) {
  return collectRowIncidents(row, profile, fechaInspeccion);
}

export function buildCalibreCalculado(row, profile) {
  const c = profile.cols;
  const cliente = String(row[c.cliente] ?? "").trim();
  const calibreAR = row[c.calibreAr];
  const subGrupo = row[c.subgrupo];
  const destino = row[c.destino];
  const especial = usaCalibreEspecial(cliente, destino);

  if (especial) {
    const categorias = ["JUMBO", "MIXED", "REGULAR", "SUPER JUMBO"];
    if (!calibreAR) return { text: "", error: true };
    let categoriaReal = CALIBRES_MAP[calibreAR] || calibreAR;
    if (categoriaReal === "MEDIUM") categoriaReal = "MIXED";
    if (!categorias.includes(categoriaReal)) return { text: String(calibreAR), error: true };
    if (subGrupo && CALIBRES_SUBGRUPO[subGrupo]) return { text: CALIBRES_SUBGRUPO[subGrupo], error: false };
    return { text: categoriaReal, error: true };
  }

  const desc = CALIBRES_MAP[calibreAR] || "";
  if (!calibreAR) return { text: "", error: true };
  const palabras = ["JUMBO", "MIXED", "REGULAR", "SUPER JUMBO", "MEDIUM", "EXTRA JUMBO", "MIXTO", "NO COMBINADO", "SIN CALIBRAR"];
  if (palabras.includes(desc)) return { text: `ERROR: ${desc}`, error: true };
  return { text: desc, error: false };
}

export function markDuplicateLotes(rows, profile) {
  const colLote = profile.cols.lote;
  const conteo = {};
  rows.forEach((r) => {
    const lote = String(r[colLote] ?? "").trim();
    if (lote) conteo[lote] = (conteo[lote] || 0) + 1;
  });
  rows.forEach((r) => {
    const lote = String(r[colLote] ?? "").trim();
    r.__duplicado = Boolean(lote && conteo[lote] > 1);
  });
}

export function formatSubgrupoCellValue(row, profile, cliente) {
  const c = profile.cols;
  const destino = row[c.destino];
  const raw = row[c.subgrupo];
  if (usaCalibreEspecial(cliente, destino)) {
    return formatCellValue(raw, c.subgrupo);
  }
  if (esSubgrupoNA(raw)) return "N/A";
  return formatCellValue(raw, c.subgrupo);
}

export function formatCellValue(val, colIndex) {
  if (val === null || val === undefined) return "";
  if (colIndex === 3 && typeof val === "number") {
    const f = new Date(Math.round((val - 25569) * 86400 * 1000));
    return `${String(f.getUTCDate()).padStart(2, "0")}/${String(f.getUTCMonth() + 1).padStart(2, "0")}/${f.getUTCFullYear()}`;
  }
  return String(val);
}

export function applyDestinoValidation(td, cliente, destino) {
  if (!destino) {
    td.classList.add("agv-pt-cell-error-empty");
    td.title = "Destino vacío (obligatorio)";
    return;
  }
  if (!cliente) return;
  let error = false;
  if (cliente === "THE FRUITIST CO" && !["USA", "CANADA"].includes(String(destino))) {
    td.classList.add("agv-pt-cell-error-value");
    td.title = `The Fruitist Co solo acepta USA o CANADA (actual: ${destino})`;
    error = true;
  } else if (cliente === "FRUITIST SHANGHAI" && destino !== "ASIA") {
    td.classList.add("agv-pt-cell-error-value");
    td.title = `Fruitist Shanghai solo acepta ASIA (actual: ${destino})`;
    error = true;
  } else if (cliente === "COSTCO" && !["USA", "CANADA", "EUROPA"].includes(String(destino))) {
    td.classList.add("agv-pt-cell-error-value");
    td.title = `Costco solo acepta USA/CANADA/EUROPA (actual: ${destino})`;
    error = true;
  }
  if (!error) {
    const val = validarClienteDestino(cliente, destino);
    if (!val.valido) {
      td.classList.add("agv-pt-cell-error-value");
      td.title = val.mensaje;
    }
  }
}
