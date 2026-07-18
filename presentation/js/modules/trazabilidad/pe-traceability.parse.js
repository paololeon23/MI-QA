/** AGV Trace — parseo código 13 chars (cartilla PE-F-PNN-001, foco Arándano). */

export const TRACE_SEGMENTS = [
  { key: "year", len: 1, header: "AÑO", labelKey: "trazabilidadReview.seg.year" },
  { key: "country", len: 1, header: "PAÍS", labelKey: "trazabilidadReview.seg.country" },
  { key: "packing", len: 2, header: "PACKING", labelKey: "trazabilidadReview.seg.packing" },
  { key: "grower", len: 1, header: "PRODUCTOR", labelKey: "trazabilidadReview.seg.grower" },
  { key: "sector", len: 2, header: "SECTOR", labelKey: "trazabilidadReview.seg.sector" },
  { key: "crop", len: 1, header: "CULTIVO", labelKey: "trazabilidadReview.seg.crop" },
  { key: "variety", len: 2, header: "VARIEDAD", labelKey: "trazabilidadReview.seg.variety" },
  { key: "julian", len: 3, header: "JULIANO", labelKey: "trazabilidadReview.seg.julian" }
];

export const EXPECTED_TRACE_LEN = TRACE_SEGMENTS.reduce((n, s) => n + s.len, 0);
export const ARANDANO_CROP_CODE = "1";

const MONTHS_ES = [
  "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
  "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"
];

export function normalizeTraceCode(raw) {
  return String(raw ?? "")
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "");
}

export function parseTraceCode(raw) {
  const code = normalizeTraceCode(raw);
  if (code.length !== EXPECTED_TRACE_LEN) return null;

  let offset = 0;
  const parts = {};
  for (const seg of TRACE_SEGMENTS) {
    parts[seg.key] = code.slice(offset, offset + seg.len);
    offset += seg.len;
  }

  return {
    code,
    ...parts,
    stage: parts.sector.charAt(0),
    field: parts.sector.charAt(1)
  };
}

function julianToDate(year, julianDay) {
  const day = Number.parseInt(julianDay, 10);
  if (!Number.isFinite(year) || !Number.isFinite(day) || day < 1 || day > 366) {
    return null;
  }
  const date = new Date(year, 0);
  date.setDate(day);
  if (date.getFullYear() !== year) return null;
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const longEs = `${Number(dd)} DE ${MONTHS_ES[date.getMonth()]}`;
  return {
    iso: `${year}-${mm}-${dd}`,
    display: `${dd}/${mm}/${year}`,
    dayOfYear: String(day).padStart(3, "0"),
    longEs
  };
}

function lookup(map, code) {
  if (!map || code == null || code === "") return null;
  if (Object.prototype.hasOwnProperty.call(map, code)) return map[code];
  if (/^\d+$/.test(code)) {
    const padded = code.padStart(2, "0");
    if (Object.prototype.hasOwnProperty.call(map, padded)) return map[padded];
    const bare = String(Number(code));
    if (Object.prototype.hasOwnProperty.call(map, bare)) return map[bare];
  }
  return null;
}

/**
 * @param {string} raw
 * @param {object} catalog
 * @param {{ countryKey?: string }} [options]
 */
export function resolveTraceability(raw, catalog, options = {}) {
  const parsed = parseTraceCode(raw);
  if (!parsed) {
    return {
      ok: false,
      error: "length",
      expectedLength: EXPECTED_TRACE_LEN,
      code: normalizeTraceCode(raw)
    };
  }

  const countryKey = String(options.countryKey || "PERU").toUpperCase();
  const years = catalog?.years || {};
  const countries = catalog?.countries || {};
  const packingSedes = catalog?.packingSedes || {};
  const packingsByCountry = catalog?.packingsByCountry || {};
  const growersByCountry = catalog?.growersByCountry || {};

  // Catálogos 100% independientes por país (sin mezclar Perú ↔ Chile).
  const packings =
    packingsByCountry[countryKey] ||
    (countryKey === "CHILE" ? {} : catalog?.packings || {});
  const growers =
    growersByCountry[countryKey] ||
    (countryKey === "CHILE" ? {} : catalog?.growers || {});

  const stages = countryKey === "PERU" ? catalog?.stages || {} : {};
  const fields = countryKey === "PERU" ? catalog?.fields || {} : {};
  const crops = catalog?.crops || {};
  const varieties = catalog?.varietiesByCrop?.[ARANDANO_CROP_CODE] || {};

  const expectedCountryCode = countryKey === "CHILE" ? "I" : "A";
  const yearFull = years[parsed.year] ?? null;
  const yearNum = typeof yearFull === "number" ? yearFull : Number(yearFull);
  const julianDate = julianToDate(yearNum, parsed.julian);
  const stageLabel = lookup(stages, parsed.stage);
  const fieldLabel = lookup(fields, parsed.field);
  const plantLabel = lookup(packings, parsed.packing);
  const plantSede = plantLabel ? lookup(packingSedes, parsed.packing) : null;

  const cropIsArandano = parsed.crop === ARANDANO_CROP_CODE;
  const cropLabel = cropIsArandano
    ? lookup(crops, parsed.crop) || "BLUEBERRY (ARÁNDANO)"
    : null;
  const varietyLabel = cropIsArandano ? lookup(varieties, parsed.variety) : null;

  let sectorValue = null;
  if (countryKey === "CHILE") {
    sectorValue = `SECTOR ${parsed.sector}`;
  } else if (stageLabel || fieldLabel) {
    sectorValue = [stageLabel, fieldLabel].filter(Boolean).join(" · ");
  }

  const julianValue = julianDate
    ? `${julianDate.dayOfYear} (${julianDate.longEs})`
    : null;

  const countryValue = lookup(countries, parsed.country);
  const countryMismatch = parsed.country !== expectedCountryCode;

  const cells = TRACE_SEGMENTS.map((seg) => ({
    key: seg.key,
    len: seg.len,
    header: seg.header,
    labelKey: seg.labelKey,
    code: parsed[seg.key]
  }));

  const meanings = [
    {
      key: "year",
      labelKey: "trazabilidadReview.seg.year",
      code: parsed.year,
      value: yearFull != null ? String(yearFull) : null,
      noteKey: "trazabilidadReview.yearMeta",
      noteVars: { digit: parsed.year }
    },
    {
      key: "country",
      labelKey: "trazabilidadReview.seg.country",
      code: parsed.country,
      value: countryValue,
      warnKey: countryMismatch ? "trazabilidadReview.countryMismatch" : null
    },
    {
      key: "packing",
      labelKey: "trazabilidadReview.seg.packing",
      code: parsed.packing,
      value: plantLabel,
      noteKey: plantSede ? "trazabilidadReview.plantMeta" : null,
      noteVars: plantSede ? { sede: plantSede } : null
    },
    {
      key: "grower",
      labelKey: "trazabilidadReview.seg.grower",
      code: parsed.grower,
      value: lookup(growers, parsed.grower)
    },
    {
      key: "sector",
      labelKey: "trazabilidadReview.seg.sector",
      code: parsed.sector,
      value: sectorValue,
      noteKey: countryKey === "PERU" ? "trazabilidadReview.sectorMeta" : null,
      noteVars:
        countryKey === "PERU"
          ? {
              stageCode: parsed.stage,
              stage: stageLabel || "—",
              fieldCode: parsed.field,
              field: fieldLabel || "—"
            }
          : null
    },
    {
      key: "crop",
      labelKey: "trazabilidadReview.seg.crop",
      code: parsed.crop,
      value: cropLabel,
      warnKey: cropIsArandano ? null : "trazabilidadReview.onlyArandano"
    },
    {
      key: "variety",
      labelKey: "trazabilidadReview.seg.variety",
      code: parsed.variety,
      value: varietyLabel,
      warnKey: cropIsArandano ? null : "trazabilidadReview.onlyArandano"
    },
    {
      key: "julian",
      labelKey: "trazabilidadReview.seg.julian",
      code: parsed.julian,
      value: julianValue || julianDate?.display || null,
      noteKey: julianDate ? "trazabilidadReview.julianMeta" : null,
      noteVars: julianDate ? { day: julianDate.dayOfYear } : null
    }
  ];

  return {
    ok: true,
    code: parsed.code,
    cells,
    meanings,
    cropIsArandano,
    julianDate,
    yearFull,
    plantSede,
    countryMismatch
  };
}
