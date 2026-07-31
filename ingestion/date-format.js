/**
 * Fechas SAP/Excel en ingestión: YYYYMMDD / ISO / serial → DD/MM/YYYY.
 * Copia mínima (ingestion no depende de presentation/).
 */

export function parseFlexibleDateToISO(valor) {
  if (valor == null || valor === "") return "";
  if (typeof valor === "number" && Number.isFinite(valor) && valor > 20000 && valor < 80000) {
    const fecha = new Date(Math.round((valor - 25569) * 86400 * 1000));
    if (Number.isNaN(fecha.getTime())) return "";
    const y = fecha.getUTCFullYear();
    const m = String(fecha.getUTCMonth() + 1).padStart(2, "0");
    const d = String(fecha.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  const texto = String(valor).trim();
  if (!texto) return "";
  if (/^\d{5,6}(\.\d+)?$/.test(texto)) {
    const n = Number(texto);
    if (Number.isFinite(n) && n > 20000 && n < 80000) return parseFlexibleDateToISO(n);
  }
  if (/^\d{8}$/.test(texto)) {
    const y = Number(texto.slice(0, 4));
    const m = Number(texto.slice(4, 6));
    const d = Number(texto.slice(6, 8));
    if (y < 1990 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return "";
    return `${texto.slice(0, 4)}-${texto.slice(4, 6)}-${texto.slice(6, 8)}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(texto)) return texto.slice(0, 10);
  if (/^\d{2}[/-]\d{2}[/-]\d{4}$/.test(texto)) {
    const [d, m, y] = texto.split(/[/-]/);
    return `${y}-${m}-${d}`;
  }
  if (/^\d{2}[/-]\d{2}[/-]\d{2}$/.test(texto)) {
    const [d, m, y] = texto.split(/[/-]/);
    const fullY = Number(y) <= 50 ? `20${y}` : `19${y}`;
    return `${fullY}-${m}-${d}`;
  }
  const parsed = Date.parse(texto);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 10) : "";
}

export function formatDateValueToDMY(valor) {
  const iso = parseFlexibleDateToISO(valor);
  if (!iso) return null;
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function applyDateDisplayFormatToRows(rows = [], headers = [], excelColsHint = [20, 21, 41, 51]) {
  const set = new Set();
  (excelColsHint || []).forEach((c) => {
    const n = Number(c);
    if (Number.isFinite(n) && n >= 1) set.add(n - 1);
  });
  (headers || []).forEach((h, i) => {
    const n = String(h ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    if (!n || /\bhora\b/.test(n)) return;
    if (n.includes("fecha") || n.includes("date") || /\blmr\b/.test(n)) set.add(i);
  });
  const cols = set.size ? [...set] : [19, 20, 40, 50];

  return (rows || []).map((row) => {
    if (!Array.isArray(row)) return row;
    const copy = [...row];
    Object.keys(row).forEach((key) => {
      if (Number.isNaN(Number(key))) copy[key] = row[key];
    });
    cols.forEach((js) => {
      if (js < 0 || js >= copy.length) return;
      const formatted = formatDateValueToDMY(copy[js]);
      if (formatted) copy[js] = formatted;
    });
    return copy;
  });
}
