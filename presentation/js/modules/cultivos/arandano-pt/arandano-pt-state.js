/** Persistencia local — orden de filas y marcas verde/naranja por cartilla+fecha. */

const STORAGE_KEY = "agv-pt-session-state";

function sessionKey(cartilla, fechaIso) {
  return `${cartilla}|${fechaIso}`;
}

export function rowStateKey(row, profile) {
  const id = String(row[profile.cols.id] ?? "").trim();
  const lote = String(row[profile.cols.lote] ?? "").trim();
  return `${id}::${lote}`;
}

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeAll(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* quota / modo privado */
  }
}

export function savePtTableState(cartilla, fechaIso, rows, profile) {
  if (!cartilla || !fechaIso || !profile) return;
  const all = readAll();
  all[sessionKey(cartilla, fechaIso)] = {
    order: rows.map((r) => rowStateKey(r, profile)),
    marks: Object.fromEntries(
      rows.map((r) => [rowStateKey(r, profile), r.__mark || ""]).filter(([, m]) => m)
    ),
    savedAt: Date.now()
  };
  writeAll(all);
}

export function applyPtTableState(cartilla, fechaIso, rows, profile) {
  const saved = readAll()[sessionKey(cartilla, fechaIso)];
  if (!saved?.order?.length) return rows;

  const byKey = new Map(rows.map((r) => [rowStateKey(r, profile), r]));
  const ordered = [];

  saved.order.forEach((key) => {
    const row = byKey.get(key);
    if (row) {
      ordered.push(row);
      byKey.delete(key);
    }
  });
  byKey.forEach((row) => ordered.push(row));

  ordered.forEach((row) => {
    const mark = saved.marks?.[rowStateKey(row, profile)];
    if (mark === "green" || mark === "orange") row.__mark = mark;
  });

  return ordered;
}

export function clearPtTableState(cartilla, fechaIso) {
  const all = readAll();
  delete all[sessionKey(cartilla, fechaIso)];
  writeAll(all);
}

export function clearAllPtTableState() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* modo privado */
  }
}
