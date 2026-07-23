/**
 * Adaptador configuration-driven: convierte rules/modulos/*.rules.json
 * al formato validaciones_por_columna usado por la UI de cartillas.
 */

const CLAVES_METADATO = new Set([
  "numero",
  "nombre-de-la-columna",
  "que-se-revisa",
  "aplica-a-cartilla"
]);

function jsIndex(numero) {
  return Number(numero) - 1;
}

function tieneReglasActivas(col) {
  if (!col || typeof col !== "object") return false;
  return Object.keys(col).some((clave) => !CLAVES_METADATO.has(clave));
}

const ALIAS_PLACEHOLDERS = {
  longitud: "longitud-exacta",
  columna: "nombre-de-la-columna",
  nombre: "nombre-de-la-columna",
  "valor-esperado": "igual-a-valor"
};

function varsDesdeReglaColumna(col, extras = {}) {
  const vars = { ...extras };

  if (!col || typeof col !== "object") return vars;

  const nombre = String(col["nombre-de-la-columna"] || "").trim();
  if (nombre) {
    vars["nombre-de-la-columna"] = nombre;
    vars.columna = nombre;
  }
  if (col.numero != null) vars.numero = String(col.numero);

  [
    "longitud-exacta",
    "maximo-de-caracteres",
    "minimo",
    "maximo",
    "igual-a-valor",
    "contiene-texto"
  ].forEach((clave) => {
    if (col[clave] != null) vars[clave] = String(col[clave]);
  });

  if (col["longitud-exacta"] != null) vars.longitud = String(col["longitud-exacta"]);
  if (col["igual-a-valor"] != null) vars["valor-esperado"] = String(col["igual-a-valor"]);

  if (vars.texto != null && vars["longitud-detectada"] == null) {
    vars["longitud-detectada"] = String(String(vars.texto).length);
  }
  if (vars.valor != null && vars.detectado == null && vars.texto == null) {
    const texto = String(vars.valor);
    vars.texto = texto;
    vars["longitud-detectada"] = String(texto.length);
  }

  return vars;
}

function interpolarMensaje(template, vars) {
  return String(template).replace(/\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}/g, (_, key) => {
    if (vars[key] != null && String(vars[key]).trim() !== "") return String(vars[key]);
    const alias = ALIAS_PLACEHOLDERS[key];
    if (alias && vars[alias] != null) return String(vars[alias]);
    return `{{${key}}}`;
  });
}

function mensajeAutomatico(col, vars, tipoFallo) {
  const nombre = vars.columna || "Campo";
  if (tipoFallo === "obligatorio" || tipoFallo === "vacio") {
    return `${nombre} obligatorio`;
  }
  if (tipoFallo === "longitud" && vars["longitud-exacta"] != null) {
    const detectado = vars["longitud-detectada"] ?? vars.detectado ?? "?";
    return `${nombre}: debe tener exactamente ${vars["longitud-exacta"]} caracteres (detectados: ${detectado})`;
  }
  if (tipoFallo === "rango") {
    const partes = [];
    if (vars.minimo != null) partes.push(`mínimo ${vars.minimo}`);
    if (vars.maximo != null) partes.push(`máximo ${vars.maximo}`);
    return partes.length ? `${nombre}: ${partes.join(", ")}` : `${nombre}: valor fuera de rango`;
  }
  if (tipoFallo === "igualdad" && vars["valor-esperado"] != null) {
    return `${nombre}: debe ser ${vars["valor-esperado"]}`;
  }
  return `${nombre}: valor no válido`;
}

/**
 * Resuelve si-falla-mostrar sustituyendo {{placeholders}} con valores de la regla y del contexto.
 * @param {object} col — entrada de reglas.columnas
 * @param {object} extras — valor, texto, detectado, longitud-detectada, lote, etc.
 * @param {string|null} tipoFallo — obligatorio | longitud | rango | igualdad | ...
 */
export function resolverMensajeRegla(col, extras = {}, tipoFallo = null) {
  const vars = varsDesdeReglaColumna(col, extras);
  const template = col?.["si-falla-mostrar"];
  if (template != null && String(template).trim()) {
    return interpolarMensaje(String(template).trim(), vars);
  }
  return mensajeAutomatico(col, vars, tipoFallo);
}

function mensajeColumna(col, fallback, extras = {}, tipoFallo = null) {
  if (col?.["si-falla-mostrar"]) {
    return resolverMensajeRegla(col, extras, tipoFallo);
  }
  if (fallback && /\{\{/.test(fallback)) {
    return interpolarMensaje(fallback, varsDesdeReglaColumna(col, extras));
  }
  return fallback;
}

function mapIgualAValor(valor, mensaje) {
  const texto = String(valor);
  if (/^\d+$/.test(texto)) {
    return { tipo: "valor_exacto", valor: texto, mensaje };
  }
  return { tipo: "texto_exacto", valor: texto, mensaje };
}

/**
 * @param {object} col — entrada de reglas.columnas
 * @param {{ duplicateRuleTipo?: string }} options
 */
export function reglaColumnaAValidaciones(col, options = {}) {
  if (!tieneReglasActivas(col)) return null;

  const reglas = [];
  const nombre = String(col["nombre-de-la-columna"] || "").trim();

  if (col["es-obligatorio"]) {
    reglas.push({
      tipo: "obligatorio",
      mensaje: mensajeColumna(col, nombre ? `${nombre} obligatorio` : "Campo obligatorio")
    });
  }

  if (col["longitud-exacta"] != null) {
    const len = col["longitud-exacta"];
    reglas.push({
      tipo: "longitud_exacta",
      valor: len,
      mensaje: mensajeColumna(col, `Debe tener ${len} caracteres`)
    });
  }

  if (col["contiene-texto"] != null) {
    const fragmento = col["contiene-texto"];
    reglas.push({
      tipo: "contiene_texto",
      valor: fragmento,
      mensaje: mensajeColumna(col, `Debe incluir ${fragmento}`)
    });
  }

  if (col["igual-a-valor"] != null) {
    reglas.push(
      mapIgualAValor(
        col["igual-a-valor"],
        mensajeColumna(col, `Debe ser ${col["igual-a-valor"]}`)
      )
    );
  }

  if (col["igual-a-columna"] != null) {
    const ref = col["igual-a-columna"];
    const columnaJs =
      typeof ref === "number" ? jsIndex(ref) : jsIndex(ref?.numero ?? ref);
    reglas.push({
      tipo: "igual_a_columna",
      columna_js: columnaJs,
      mensaje: mensajeColumna(col, "No coincide con columna de referencia")
    });
  }

  if (col.minimo != null || col.maximo != null) {
    reglas.push({
      tipo: "rango_numerico",
      minimo: col.minimo ?? null,
      maximo: col.maximo ?? null,
      mensaje: mensajeColumna(col, "Valor fuera de rango")
    });
  }

  if (col["patron-regex"]) {
    reglas.push({
      tipo: col["validar-solo-si-tiene-valor"] ? "regex_opcional" : "regex",
      patron: col["patron-regex"],
      mensaje: mensajeColumna(col, "Formato inválido")
    });
  }

  if (col["formato-hora"]) {
    reglas.push({
      tipo: "formato_hora",
      mensaje: mensajeColumna(col, "Formato HH:MM inválido")
    });
  }

  if (Array.isArray(col["valores-permitidos"]) && col["valores-permitidos"].length) {
    reglas.push({
      tipo: "lista_valores",
      valores: col["valores-permitidos"],
      mensaje: mensajeColumna(col, "Valor no permitido")
    });
  }

  if (col["debe-existir-en-catalogo"]) {
    reglas.push({
      tipo: "codigo_en_catalogo",
      catalogo: col["debe-existir-en-catalogo"],
      mensaje: mensajeColumna(col, "Código no válido en catálogo")
    });
  }

  if (col["no-puede-repetirse"]) {
    const duplicateTipo = options.duplicateRuleTipo || "duplicado_en_fecha";
    reglas.push({
      tipo: duplicateTipo,
      mensaje:
        duplicateTipo === "duplicado_en_cartilla"
          ? "Duplicado"
          : "Lote {{lote}} duplicado en esta fecha"
    });
  }

  if (col["debe-estar-vacio"]) {
    reglas.push({
      tipo: "debe_estar_vacio",
      mensaje: mensajeColumna(col, "Debe estar vacío")
    });
  }

  if (!reglas.length) return null;

  return {
    indice_js: jsIndex(col.numero),
    columna_excel: col.numero,
    campo: nombre || undefined,
    reglas
  };
}

export function buildValidacionesPorColumnaFromReglas(reglas, options = {}) {
  const columnas = Array.isArray(reglas?.columnas) ? reglas.columnas : [];
  return columnas
    .map((col) => reglaColumnaAValidaciones(col, options))
    .filter(Boolean)
    .sort((a, b) => a.indice_js - b.indice_js);
}

export function getReglaColumnaPorNumero(reglas, numero) {
  const n = Number(numero);
  return (reglas?.columnas || []).find((col) => Number(col.numero) === n) || null;
}

export function getReglaColumnaPorIndice(reglas, indiceJs) {
  return getReglaColumnaPorNumero(reglas, indiceJs + 1);
}

/** Nombres de columna desde rules.json (índice JS → nombre). */
export function buildColumnLabelsByIndex(reglas) {
  const map = {};
  (reglas?.columnas || []).forEach((col) => {
    const numero = Number(col.numero);
    if (!Number.isFinite(numero) || numero < 1) return;
    const name = String(col["nombre-de-la-columna"] || "").trim();
    if (name) map[numero - 1] = name;
  });
  return map;
}

/** Mensaje de error configurado en rules.json para una columna. */
export function getFailMessageFromReglas(reglas, indiceJs, fallback = "", extras = {}, tipoFallo = null) {
  const col = getReglaColumnaPorIndice(reglas, indiceJs);
  if (!col?.["si-falla-mostrar"]) return fallback;
  if (fallback && Object.keys(extras).length === 0 && tipoFallo == null) {
    return fallback;
  }
  const resolved = resolverMensajeRegla(col, extras, tipoFallo);
  return resolved || fallback;
}

/** Hint de cabecera: que-se-revisa o nombre de columna. */
export function getColumnHintFromReglas(reglas, indiceJs) {
  const col = getReglaColumnaPorIndice(reglas, indiceJs);
  const revisa = col?.["que-se-revisa"];
  if (revisa != null && String(revisa).trim()) return String(revisa).trim();
  const name = col?.["nombre-de-la-columna"];
  return name != null && String(name).trim() ? String(name).trim() : "";
}

/** Etiqueta visible: prioriza rules.json, luego encabezado del Excel. */
export function resolveColumnLabel(indiceJs, headers, columnLabelsByIndex, options = {}) {
  const preferExcel = options.preferExcel === true;
  const headerText = headers?.[indiceJs];
  const headerTrim = headerText != null ? String(headerText).trim() : "";
  const rulesLabel = columnLabelsByIndex?.[indiceJs];

  if (!preferExcel && rulesLabel) return rulesLabel;
  if (headerTrim) return headerTrim;
  if (rulesLabel) return rulesLabel;
  return `Col ${indiceJs + 1}`;
}

export function getLongitudExactaDesdeReglas(reglas, indiceJs) {
  const col = getReglaColumnaPorIndice(reglas, indiceJs);
  const len = col?.["longitud-exacta"];
  return len != null ? Number(len) : null;
}

function buildResumenLote(reglas, config) {
  const resumen = { ...(config?.validaciones_resumen?.lote || {}) };
  const colLote = getReglaColumnaPorNumero(reglas, resumen.columna_excel ?? 10);
  if (!colLote) return resumen;

  if (colLote["longitud-exacta"] != null) {
    resumen.longitud = colLote["longitud-exacta"];
    resumen.indice_js = jsIndex(colLote.numero);
    resumen.columna_excel = colLote.numero;
  }
  if (colLote["no-puede-repetirse"]) {
    resumen.sin_duplicados = true;
  }
  return resumen;
}

/**
 * Fusiona reglas del JSON de configuración (rules.json) sobre el config de UI.
 * Las reglas del archivo de reglas tienen prioridad; se conservan tipos extra del config (ej. cruce_ipp_isp).
 */
export function mergeValidacionesDesdeReglas(config, reglas, options = {}) {
  if (!reglas) return config;

  const fromRules = buildValidacionesPorColumnaFromReglas(reglas, options);
  const preserveTipos = new Set(options.preserveRuleTipos || ["cruce_ipp_isp"]);
  const byIndex = new Map();

  (config?.validaciones_por_columna || []).forEach((col) => {
    byIndex.set(col.indice_js, {
      ...col,
      reglas: [...(col.reglas || [])]
    });
  });

  fromRules.forEach((col) => {
    const existing = byIndex.get(col.indice_js);
    const preserved = (existing?.reglas || []).filter((r) => preserveTipos.has(r.tipo));
    byIndex.set(col.indice_js, {
      ...existing,
      ...col,
      campo: col.campo || existing?.campo,
      reglas: [...col.reglas, ...preserved]
    });
  });

  const validacionesResumen = {
    ...(config?.validaciones_resumen || {}),
    lote: buildResumenLote(reglas, config)
  };

  const colProductor = getReglaColumnaPorNumero(reglas, validacionesResumen.productor?.columna_excel ?? 13);
  if (colProductor?.["igual-a-valor"] != null) {
    validacionesResumen.productor = {
      ...(validacionesResumen.productor || {}),
      valor: String(colProductor["igual-a-valor"]),
      indice_js: jsIndex(colProductor.numero),
      columna_excel: colProductor.numero
    };
  }

  return {
    ...config,
    total_columnas: reglas["total-columnas"] ?? config.total_columnas,
    validaciones_por_columna: [...byIndex.values()].sort((a, b) => a.indice_js - b.indice_js),
    validaciones_resumen: validacionesResumen,
    _reglasOrigen: reglas
  };
}

export function getLongitudExactaDesdeConfig(config, indiceJs) {
  const col = (config?.validaciones_por_columna || []).find((c) => c.indice_js === indiceJs);
  const rule = col?.reglas?.find((r) => r.tipo === "longitud_exacta");
  if (rule?.valor != null) return Number(rule.valor);
  return getLongitudExactaDesdeReglas(config?._reglasOrigen, indiceJs);
}
