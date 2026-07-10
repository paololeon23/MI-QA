/**
 * Helpers de rendimiento para tablas de resultados MP.
 * Evita pintar cientos de columnas: solo sticky/contexto + columnas con error.
 */

export const DEFAULT_MP_CONTEXT_COLS_JS = [0, 1, 6, 9, 10];

/**
 * @param {Array<{ originalIndex: number, header?: string }>} allColumns
 * @param {Map<number, Map<number, unknown>>|null} errorMap filaNum → (colExcel → err)
 * @param {Array<{ _filaNum?: number }>} filas
 * @param {number[]} [contextColsJs]
 */
export function pickResultColumns(
  allColumns,
  errorMap,
  filas,
  contextColsJs = DEFAULT_MP_CONTEXT_COLS_JS
) {
  const needed = new Set(contextColsJs);
  (filas || []).forEach((row) => {
    const filaMap = errorMap?.get(row._filaNum);
    if (!filaMap) return;
    filaMap.forEach((_err, colNum) => needed.add(colNum - 1));
  });
  return (allColumns || []).filter((col) => needed.has(col.originalIndex));
}

/**
 * Índices JS a mostrar cuando no hay lista de columnas tipada (ej. Palta).
 * @param {number} totalCols
 * @param {Map<number, Map<number, unknown>>|null} errorMap
 * @param {Array<{ _filaNum?: number }>} filas
 * @param {number[]} [contextColsJs]
 * @param {number[]} [stickyColsJs]
 */
export function pickResultColumnIndexes(
  totalCols,
  errorMap,
  filas,
  contextColsJs = DEFAULT_MP_CONTEXT_COLS_JS,
  stickyColsJs = [0, 1, 6, 9]
) {
  const needed = new Set([...contextColsJs, ...stickyColsJs]);
  (filas || []).forEach((row) => {
    const filaMap = errorMap?.get(row._filaNum);
    if (!filaMap) return;
    filaMap.forEach((_err, colNum) => {
      const js = colNum - 1;
      if (js >= 0 && js < totalCols) needed.add(js);
    });
  });
  return [...needed].filter((i) => i >= 0 && i < totalCols).sort((a, b) => a - b);
}

/**
 * Agrupa filas por fecha de inspección (usa cache _fechaInspeccionISO si existe).
 */
export function groupRowsByInspectionDate(rows, colFechaJs, parseExcelDateISO) {
  const byDate = new Map();
  (rows || []).forEach((row) => {
    const iso = row._fechaInspeccionISO || parseExcelDateISO(row[colFechaJs]);
    if (!iso) return;
    if (!row._fechaInspeccionISO) row._fechaInspeccionISO = iso;
    if (!byDate.has(iso)) byDate.set(iso, []);
    byDate.get(iso).push(row);
  });
  return byDate;
}

/**
 * Placeholders colapsables; la tabla se monta al abrir (toggle).
 * @param {Array} items con filasDetalle
 * @param {(item: object, idx: number) => string} metaHtml
 */
export function buildLazyDateDetailPlaceholders(items, htmlEscape, metaLabel) {
  return (items || [])
    .filter((item) => item.filasDetalle?.length)
    .map(
      (item, idx) => `
        <details class="agv-mp-date-detail" data-todo-detail="${idx}">
          <summary class="agv-mp-date-detail__head">
            <h4 class="agv-mp-date-detail__title">${htmlEscape(item.fecha)}</h4>
            <span class="agv-mp-date-detail__meta">${htmlEscape(metaLabel(item))} · clic para ver</span>
          </summary>
          <div class="agv-mp-date-detail__body" data-todo-body="${idx}">
            <p class="agv-mp-date-detail__loading">Cargando tabla…</p>
          </div>
        </details>`
    )
    .join("");
}

/**
 * Bind lazy load de tablas en details[data-todo-detail].
 */
export function bindLazyDateDetailTables(container, detailItems, renderTableHtml) {
  if (!container) return;
  const items = (detailItems || []).filter((item) => item.filasDetalle?.length);
  container.querySelectorAll("details[data-todo-detail]").forEach((detailsEl) => {
    detailsEl.addEventListener("toggle", () => {
      if (!detailsEl.open || detailsEl.dataset.loaded === "1") return;
      const idx = Number(detailsEl.dataset.todoDetail);
      const item = items[idx];
      const body = detailsEl.querySelector(`[data-todo-body="${idx}"]`);
      if (!item || !body) return;
      body.innerHTML = renderTableHtml(item, idx);
      detailsEl.dataset.loaded = "1";
    });
  });
}
