/**
 * Sticky Id / IC / Usuario / Lote — mismo enfoque que Arándano MP y Espárrago MP:
 * anchos fijos + left acumulado para que el scroll no se meta bajo las fijas.
 */

export const DEFAULT_MP_STICKY_COLS = [0, 1, 6, 9];

/** Anchos base (Usuario ancho por emails; ellipsis corta el resto). */
export const DEFAULT_MP_STICKY_WIDTHS = {
  0: 88,
  1: 108,
  6: 260,
  9: 118
};

/** Encabezados cortos en columnas angostas (tooltip = título completo). */
export const DEFAULT_MP_STICKY_HEADER_SHORT = {
  0: "Id",
  1: "IC",
  6: "Usuario",
  9: "Lote"
};

export const DEFAULT_MP_STICKY_HEADER_TITLE = {
  0: "Id",
  1: "Inspección código",
  6: "Usuario",
  9: "Lote"
};

/**
 * @param {HTMLElement|null|undefined} tableEl
 * @param {number[]} [stickyCols]
 * @param {Record<number, number>} [widths]
 */
export function syncMpStickyOffsets(
  tableEl,
  stickyCols = DEFAULT_MP_STICKY_COLS,
  widths = DEFAULT_MP_STICKY_WIDTHS
) {
  if (!tableEl) return;
  let left = 0;
  stickyCols.forEach((idx) => {
    const cells = tableEl.querySelectorAll(`.agv-mp-sticky-col-${idx}`);
    if (!cells.length) return;
    const width = widths[idx] ?? 90;
    cells.forEach((el) => {
      el.style.boxSizing = "border-box";
      el.style.left = `${left}px`;
      el.style.width = `${width}px`;
      el.style.minWidth = `${width}px`;
      el.style.maxWidth = `${width}px`;
    });
    left += width;
  });
}
