import {
  analizarReporte,
  cargarCatalogosParaReglas,
  cargarReglasDesdeRuta
} from "../../../../../engine/rule-engine.js";
import { buildPtCompuestaColumnMap } from "../../../../../engine/pt-rule-validators.js";
import { CARTILLA_ORDER } from "./arandano-pt.config.js";

export const REGLAS_POR_CARTILLA = {
  PTHPA: "rules/modulos/arandano-pt-pthpar.rules.json",
  PTLPA: "rules/modulos/arandano-pt-ptlpar.rules.json",
  PTBPA: "rules/modulos/arandano-pt-ptbpar.rules.json"
};

export function resolvePlantillaId(headerCount, reglas) {
  const esperado = reglas?.["total-columnas"];
  if (esperado && headerCount === esperado) return String(esperado);
  return null;
}

export function buildProfileFromReglas(reglas) {
  const cfg = reglas["configuracion-cartillas"] || {};
  const ui = reglas["configuracion-ui"] || {};
  const js = (n) => (n != null ? n - 1 : null);

  return {
    id: String(reglas["total-columnas"]),
    totalColumnas: reglas["total-columnas"],
    cols: {
      id: 0,
      cartilla: js(cfg["columna-cartilla"]),
      usuario: js(cfg["columna-usuario"]),
      lote: js(cfg["columna-lote"]),
      cantMuestra: js(11),
      medMuestra: js(12),
      notaCondicion: js(28),
      calibreAr: js(cfg["columna-calibre-ar"]),
      cliente: js(cfg["columna-cliente"]),
      destino: js(cfg["columna-destino"]),
      fechaInspeccion: js(cfg["columna-fecha-inspeccion"]),
      fechaLmr: js(cfg["columna-fecha-lmr"]),
      subgrupo: js(cfg["columna-subgrupo"]),
      tPulpa: js(cfg["columna-t-pulpa"]),
      trazabilidad: js(cfg["columna-trazabilidad"])
    },
    columnasFront: ui["columnas-front"] || [],
    headerLabels: Object.fromEntries(
      Object.entries(ui["header-labels"] || {}).map(([k, v]) => [Number(k), v])
    ),
    reordenPthpa: reglas["reorden-ptpha-ptlpa"] || null
  };
}

export function fixProfileColsFromReglas(profile, reglas) {
  const byNum = {};
  (reglas.columnas || []).forEach((col) => {
    byNum[col.numero] = col["nombre-de-la-columna"];
  });

  const findCol = (...needles) => {
    const entry = Object.entries(byNum).find(([, name]) =>
      needles.some((n) => String(name).toLowerCase().includes(n))
    );
    return entry ? Number(entry[0]) - 1 : null;
  };

  profile.cols.lote = findCol("lote") ?? profile.cols.lote;
  profile.cols.cantMuestra = findCol("cant muestra") ?? profile.cols.cantMuestra;
  profile.cols.medMuestra = findCol("med muestra") ?? profile.cols.medMuestra;
  profile.cols.notaCondicion = findCol("nota condicion", "nota condición") ?? profile.cols.notaCondicion;
  profile.cols.calibreAr = findCol("calibre ar") ?? profile.cols.calibreAr;
  profile.cols.cliente = findCol("cliente ar") ?? profile.cols.cliente;
  profile.cols.destino = findCol("destino") ?? profile.cols.destino;
  profile.cols.fechaInspeccion = findCol("fecha de inspección", "fecha de inspeccion") ?? profile.cols.fechaInspeccion;
  profile.cols.fechaLmr = findCol("fecha actualización lmr", "fecha actualizacion lmr") ?? profile.cols.fechaLmr;
  profile.cols.subgrupo = findCol("subgrupo") ?? profile.cols.subgrupo;
  profile.cols.tPulpa = findCol("pulpa") ?? profile.cols.tPulpa;
  profile.cols.trazabilidad = findCol("trazabilidad") ?? profile.cols.trazabilidad;
  profile.cols.usuario = findCol("usuario") ?? profile.cols.usuario;
  profile.cols.cartilla = findCol("inspección código", "inspeccion codigo") ?? profile.cols.cartilla;
  return profile;
}

export function rowToRegistro(row, filaNum) {
  const _cols = {};
  row.forEach((val, idx) => {
    _cols[String(idx + 1)] = val ?? "";
  });
  return { fila: filaNum, _cols };
}

export function buildErrorMap(resultado, compuestaColumnMap) {
  const map = new Map();

  const addError = (fila, colNum, tipo, problema) => {
    if (!colNum) return;
    if (!map.has(fila)) map.set(fila, new Map());
    const filaMap = map.get(fila);
    const existing = filaMap.get(colNum);
    if (!existing || tipo === "obligatorio") {
      filaMap.set(colNum, { tipo, problema });
    }
  };

  (resultado?.columnasDetalle || []).forEach((col) => {
    const colNum = col.numeroColumna;
    (col.detalle || []).forEach((item) => {
      if (col.esCompuesta) {
        let cols = compuestaColumnMap.get(col.nombreColumna);
        if (!cols?.length) {
          for (const [msg, nums] of compuestaColumnMap.entries()) {
            if (item.problema?.includes(msg) || msg.includes(item.problema?.slice(0, 20))) {
              cols = nums;
              break;
            }
          }
        }
        if (cols?.length) {
          cols.forEach((n) => addError(item.fila, n, item.tipo, item.problema));
        } else {
          addError(item.fila, colNum, item.tipo, item.problema);
        }
      } else {
        addError(item.fila, colNum, item.tipo, item.problema);
      }
    });
  });

  return map;
}

function parseFechaIso(valor) {
  const texto = String(valor ?? "").trim();
  if (!texto) return "";
  if (typeof valor === "number" && Number.isFinite(valor)) {
    const d = new Date(Math.round((valor - 25569) * 86400 * 1000));
    return d.toISOString().slice(0, 10);
  }
  if (/^\d{8}$/.test(texto)) {
    return `${texto.slice(0, 4)}-${texto.slice(4, 6)}-${texto.slice(6, 8)}`;
  }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(texto)) {
    const [d, m, y] = texto.split("/");
    return `${y}-${m}-${d}`;
  }
  const fecha = Date.parse(texto);
  return Number.isFinite(fecha) ? new Date(fecha).toISOString().slice(0, 10) : "";
}

export function computeFechaLmrMayoritaria(rows, colLmrJs) {
  const fechas = rows.map((r) => parseFechaIso(r[colLmrJs])).filter(Boolean);
  const conteo = {};
  fechas.forEach((f) => {
    conteo[f] = (conteo[f] || 0) + 1;
  });
  const sorted = Object.entries(conteo).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] || "";
}

export async function loadReglasPt() {
  const entradas = await Promise.all(
    CARTILLA_ORDER.map(async (cartilla) => {
      const reglas = await cargarReglasDesdeRuta(REGLAS_POR_CARTILLA[cartilla]);
      return [cartilla, reglas];
    })
  );
  const reglasByCartilla = Object.fromEntries(entradas);
  const catalogos = await cargarCatalogosParaReglas(reglasByCartilla.PTBPA);
  return { reglasByCartilla, catalogos };
}

export function analyzePtRows(rows, reglas, catalogos, cartilla, fechaLmrMayoritaria) {
  const registros = rows.map((row) => rowToRegistro(row, row._filaNum));
  const compuestaMap = buildPtCompuestaColumnMap(reglas["validaciones-compuestas"]);
  const resultado = analizarReporte(
    { filas: registros, cultivo: "arandano" },
    reglas,
    { cartilla, fechaLmrMayoritaria, catalogos }
  );
  const errorMap = buildErrorMap(resultado, compuestaMap);
  return { resultado, errorMap, compuestaMap };
}

export function incidentsForRow(errorMap, filaNum) {
  const filaMap = errorMap.get(filaNum);
  if (!filaMap) return [];
  return [...filaMap.values()].map((v) => v.problema);
}
