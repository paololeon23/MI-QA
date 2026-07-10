/** Catálogos PT Arándano — calibres, variedades, destinos. */

export const CALIBRES_MAP = {
  A: "+12mm", Ñ: "+13mm", B: "+14mm", C: "+15mm", D: "+16mm",
  U: "+17mm", K: "+18mm", F: "+19mm", G: "+20mm", H: "+21mm",
  I: "+22mm", T: "+23mm", Q: "+24mm", P: "+10mm", O: "+11mm",
  N: "-12mm", J: "JUMBO", E: "EXTRA JUMBO", S: "SUPER JUMBO", X: "MIXTO",
  M: "MEDIUM", L: "L", R: "R", LL: "NO COMBINADO", Z: "SIN CALIBRAR"
};

export const CALIBRES_SUBGRUPO = {
  R1: "+14mm", R2: "+12mm", R3: "+10mm",
  M1: "+16mm", M2: "+15mm", M3: "+14mm",
  J1: "+18mm", J2: "+19mm", J3: "+20mm", J4: "+18mm",
  SJ1: "+21mm", SJ2: "+22mm", SJ3: "+24mm"
};

export const CATEGORIAS_FRUTIST = {
  REGULAR: ["R1", "R2", "R3"],
  MIXED: ["M1", "M2", "M3"],
  JUMBO: ["J1", "J2", "J3", "J4"],
  "SUPER JUMBO": ["SJ1", "SJ2", "SJ3"]
};

export const DESTINO_EQUIVALENCIAS = {
  "MEDIO ORIENTE": "ASIA",
  ASIA: "ASIA",
  EUROPA: "EUROPA",
  CANADA: "CANADA",
  USA: "USA",
  BRASIL: "BRASIL"
};

export const PAIS_DESTINO = [
  { cliente: "THE FRUITIST CO", destino: "CANADA" },
  { cliente: "BENASSI", destino: "BRASIL" },
  { cliente: "WISH FARMS INC.", destino: "USA" },
  { cliente: "GIUMARRA INTERNATIONAL BERRY, LLC", destino: "USA" },
  { cliente: "SUNBELLE", destino: "USA" },
  { cliente: "THE FRUITIST CO", destino: "USA" },
  { cliente: "SUN BELLE INC", destino: "USA" },
  { cliente: "TF INTERNATIONAL", destino: "USA" },
  { cliente: "DRISCOLL´S INC.", destino: "USA" },
  { cliente: "LUCKY BERRY LTD", destino: "MEDIO ORIENTE" },
  { cliente: "NATIV BUSINESS CONSULTING LTD", destino: "MEDIO ORIENTE" },
  { cliente: "KIBSONS INTERNATIONAL LLC", destino: "MEDIO ORIENTE" },
  { cliente: "ET OCEAN TRADING", destino: "MEDIO ORIENTE" },
  { cliente: "FARZANA LLC", destino: "MEDIO ORIENTE" },
  { cliente: "SPINNEYS DUBAI LLC", destino: "MEDIO ORIENTE" },
  { cliente: "BERRY MOUNT ARABIO", destino: "MEDIO ORIENTE" },
  { cliente: "FRANCAISE FOOD CO", destino: "MEDIO ORIENTE" },
  { cliente: "SHARBATLY FRUIT", destino: "MEDIO ORIENTE" },
  { cliente: "BARAKAT VEGETABLES AND FRUITS CO.LLC", destino: "MEDIO ORIENTE" },
  { cliente: "BERRY MOUNT V&F", destino: "MEDIO ORIENTE" },
  { cliente: "CARREFOUR", destino: "MEDIO ORIENTE" },
  { cliente: "FRESH FRUIT", destino: "MEDIO ORIENTE" },
  { cliente: "PURE HARVEST", destino: "MEDIO ORIENTE" },
  { cliente: "SUMA FRUITS INTERNATIONAL", destino: "MEDIO ORIENTE" },
  { cliente: "AL SHAHABI TRADING CO", destino: "MEDIO ORIENTE" },
  { cliente: "AGROVISION EUROPE B.V.", destino: "EUROPA" },
  { cliente: "AARTSEN BREDA B.V.", destino: "EUROPA" },
  { cliente: "EDEKA AG FRUCHTKONTOR WEST", destino: "EUROPA" },
  { cliente: "ALDI", destino: "EUROPA" },
  { cliente: "CARREFOUR", destino: "EUROPA" },
  { cliente: "BC NATURE AGV EU", destino: "EUROPA" },
  { cliente: "AMETLLER ORIGIN", destino: "EUROPA" },
  { cliente: "BIEDRONKA", destino: "EUROPA" },
  { cliente: "BYBLUE", destino: "EUROPA" },
  { cliente: "COLINA", destino: "EUROPA" },
  { cliente: "CONSUM", destino: "EUROPA" },
  { cliente: "COOP NORDICS (GRAPEHUB)", destino: "EUROPA" },
  { cliente: "DAY", destino: "EUROPA" },
  { cliente: "DOLE", destino: "EUROPA" },
  { cliente: "TESCO DPS", destino: "EUROPA" },
  { cliente: "REWE-WOF", destino: "EUROPA" },
  { cliente: "PRIMAFRUITS", destino: "EUROPA" },
  { cliente: "COOP DOLE", destino: "EUROPA" },
  { cliente: "VTO (METRO)", destino: "EUROPA" },
  { cliente: "AGROVISION UK", destino: "EUROPA" },
  { cliente: "COSTCO UK", destino: "EUROPA" },
  { cliente: "GLOBAL PACIFIC", destino: "EUROPA" },
  { cliente: "MARK & SPENCER", destino: "EUROPA" },
  { cliente: "ABBGROWERS B.V", destino: "EUROPA" },
  { cliente: "MARKS & SPENCER", destino: "EUROPA" },
  { cliente: "COOP NORDICS", destino: "EUROPA" },
  { cliente: "MINORI BUAH NUSANTARA", destino: "EUROPA" },
  { cliente: "COOP TRADING", destino: "EUROPA" },
  { cliente: "DRISCOLL'S OF EUROPE", destino: "EUROPA" },
  { cliente: "DRISCOLL´S INC.", destino: "ASIA" },
  { cliente: "DRISCOLL´S SALAH AL AMOUDI", destino: "ASIA" },
  { cliente: "AARTSEN ASIA", destino: "ASIA" },
  { cliente: "JIAXING HI GO IMPORT", destino: "ASIA" },
  { cliente: "FRUITIST SHANGHAI", destino: "ASIA" },
  { cliente: "HEMA", destino: "ASIA" },
  { cliente: "RAINDEW", destino: "ASIA" },
  { cliente: "RIVERKING INTERNATIONAL", destino: "ASIA" },
  { cliente: "SAM´S", destino: "ASIA" },
  { cliente: "XINPU", destino: "ASIA" },
  { cliente: "XINQIN", destino: "ASIA" },
  { cliente: "DAILY HARVEST", destino: "ASIA" },
  { cliente: "DJ EXPORTS", destino: "ASIA" },
  { cliente: "NKG TRADING COMPANY", destino: "ASIA" },
  { cliente: "PT. MINORI BUAH NUSANTARA", destino: "ASIA" },
  { cliente: "D´FRESH", destino: "ASIA" },
  { cliente: "KHAISHEN TRADING", destino: "ASIA" },
  { cliente: "HUPCO", destino: "ASIA" },
  { cliente: "GLOBAL TRADE", destino: "ASIA" },
  { cliente: "COSTCO TW", destino: "ASIA" },
  { cliente: "FULLBLOOM", destino: "ASIA" },
  { cliente: "POMINA ENTERPRISE", destino: "ASIA" },
  { cliente: "HUPCO PTE LTD", destino: "ASIA" },
  { cliente: "TAIWAN FULLBLOOM INT'L LTD.", destino: "ASIA" },
  { cliente: "POMINA", destino: "ASIA" },
  { cliente: "D.J. EXPORTS PVT. LTD.", destino: "ASIA" },
  { cliente: "AGROVISION CHINA", destino: "ASIA" },
  { cliente: "RIVERKING INTERNATIONAL CO., LTD", destino: "ASIA" },
  { cliente: "AARTSEN ASIA LIMITED", destino: "ASIA" },
  { cliente: "COSTCO WHOLESALE TAIWAN, INC.", destino: "ASIA" },
  { cliente: "SAM'S", destino: "ASIA" },
  { cliente: "BERRY MOUNT VEGETABLES AND FRUIT", destino: "ASIA" },
  { cliente: "FRESH FRUIT", destino: "ASIA" },
  { cliente: "NGK TRADING", destino: "ASIA" },
  { cliente: "D'FRESH SDN BHD", destino: "ASIA" },
  { cliente: "SHARBATLY FRUIT", destino: "ASIA" }
];

export const VAR_MAP = {
  "01": ["Ventura", "FALL CREEK"], "02": ["Emerald", "FALL CREEK"], "03": ["Biloxi", "FALL CREEK"],
  "05": ["Snowchaser", "FALL CREEK"], "12": ["Jupiter Blue", "FALL CREEK"], "13": ["Bianca Blue", "FALL CREEK"],
  "14": ["Atlas Blue", "FALL CREEK"], "15": ["Biloxi Orgánico", "FALL CREEK"], "16": ["Sekoya Beauty", "FALL CREEK"],
  "18": ["Sekoya Pop", "FALL CREEK"], "27": ["Atlas Blue Orgánico", "FALL CREEK"], "36": ["FCM17-132", "FALL CREEK"],
  "37": ["FCM15-005", "FALL CREEK"], "38": ["FCM15-003", "FALL CREEK"], "40": ["FCM14-057", "FALL CREEK"],
  "41": ["Azra", "FALL CREEK"], "49": ["Sekoya Pop Orgánica", "FALL CREEK"], "58": ["Ventura Orgánico", "FALL CREEK"],
  C0: ["FCE15-087", "FALL CREEK"], C1: ["FCE18-012", "FALL CREEK"], C2: ["FCE18-015", "FALL CREEK"],
  "17": ["Kirra", "Driscoll´s"], "19": ["Arana", "Driscoll´s"], "20": ["Stella Blue", "Driscoll´s"],
  "21": ["Terrapin", "Driscoll´s"], "26": ["Rosita", "Driscoll´s"], "28": ["Arana Orgánico", "Driscoll´s"],
  "29": ["Stella Blue Orgánico", "Driscoll´s"], "30": ["Kirra Orgánico", "Driscoll´s"], "31": ["Regina", "Driscoll´s"],
  "34": ["Raymi Orgánico", "Driscoll´s"], "45": ["Raymi", "Driscoll´s"], "50": ["Rosita Orgánica", "Driscoll´s"],
  "06": ["Mágica", "OZBLU"], "07": ["Bella", "OZBLU"], "08": ["Bonita", "OZBLU"],
  "09": ["Julieta", "OZBLU"], "10": ["Zila", "OZBLU"], "11": ["Magnifica", "OZBLU"],
  "22": ["PLA Blue-Malibu", "Planasa"], "23": ["PLA Blue-Madeira", "Planasa"], "24": ["PLA Blue-Masirah", "Planasa"],
  "35": ["Manila", "Planasa"],
  "51": ["Megaone", "IQ BERRIES"], "53": ["Megacrisp", "IQ BERRIES"], "54": ["Megaearly", "IQ BERRIES"],
  "55": ["Megagem", "IQ BERRIES"], "56": ["Megastar", "IQ BERRIES"], "57": ["Megagrand", "IQ BERRIES"],
  "04": ["Springhigh", "Univ. Florida"], "33": ["Magnus", "Univ. Florida"], "39": ["Colosus", "Univ. Florida"],
  "42": ["Raven", "Univ. Florida"], "43": ["Avanti", "Univ. Florida"], "46": ["Patrecia", "Univ. Florida"],
  "47": ["Wayne", "Univ. Florida"], "48": ["Bobolink", "Univ. Florida"], "52": ["Keecrisp", "Universidad de Florida"],
  "67": ["Albus (FL 11-051)", "Universidad de Florida"], "68": ["Falco (FL 17-141)", "Universidad de Florida"],
  "69": ["FL-11-158", "Universidad de Florida"], "70": ["FL-10-179", "Universidad de Florida"],
  B9: ["FL 19-006", "Universidad de Florida"], C3: ["FL09-279", "Universidad de Florida"], C4: ["FL12-236", "Universidad de Florida"],
  "25": ["Mixto", ""], "32": ["I+D", ""], "44": ["Merliah", "Mountain Blue"],
  "62": ["FCM15-000", "_"], "63": ["FCM15-010", "_"], "64": ["FCM-17010", "_"], "65": ["Valentina", "_"]
};

export function normalizarDestino(destino) {
  if (!destino) return "";
  const destinoUpper = String(destino).toUpperCase().trim();
  return DESTINO_EQUIVALENCIAS[destinoUpper] || destinoUpper;
}

export function validarClienteDestino(cliente, destino) {
  if (!cliente || !destino) return { valido: false, mensaje: "" };
  const clienteUpper = String(cliente).toUpperCase().trim();
  const destinoNormalizado = normalizarDestino(destino);
  const destinosPermitidos = PAIS_DESTINO
    .filter((pd) => pd.cliente.toUpperCase().trim() === clienteUpper)
    .map((pd) => normalizarDestino(pd.destino));
  if (!destinosPermitidos.length) return { valido: true, mensaje: "" };
  const esValido = destinosPermitidos.includes(destinoNormalizado);
  return {
    valido: esValido,
    mensaje: esValido ? "" : `${cliente} solo acepta: ${destinosPermitidos.join(", ")} (actual: ${destino})`
  };
}

export function extraerTrazabilidad(codigo) {
  const texto = String(codigo ?? "").trim();
  if (texto.length < 13) return null;
  return {
    año: texto.charAt(0),
    pais: texto.charAt(1),
    packing: texto.substring(2, 4),
    productor: texto.charAt(4),
    sector: { etapa: texto.charAt(5), campo: texto.charAt(6) },
    cultivo: texto.charAt(7),
    variedad: texto.substring(8, 10),
    juliano: texto.substring(10)
  };
}

export function esClienteEspecial(cliente) {
  const c = String(cliente ?? "").trim();
  return c === "THE FRUITIST CO" || c === "COSTCO";
}

/** Calibre palabra+código solo si no es Costco/Costco UK con destino EUROPA. */
export function usaCalibreEspecial(cliente, destino) {
  const c = String(cliente ?? "").trim();
  const d = normalizarDestino(destino);
  if (d === "EUROPA" && (c === "COSTCO" || c === "COSTCO UK")) return false;
  return esClienteEspecial(c);
}

export function esSubgrupoNA(val) {
  return String(val ?? "").trim().toUpperCase() === "N/A";
}

export function getJulianoFromDate(fechaTexto) {
  if (!fechaTexto) return null;
  const partes = String(fechaTexto).includes("/")
    ? fechaTexto.split("/")
    : fechaTexto.split("-").reverse();
  const [dd, mm, yyyy] = partes.map(Number);
  if (!yyyy || !mm || !dd) return null;
  const fechaObj = new Date(yyyy, mm - 1, dd);
  const start = new Date(yyyy, 0, 0);
  const diff = fechaObj - start;
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  return String(dayOfYear).padStart(3, "0");
}
