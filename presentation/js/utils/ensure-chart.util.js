/** Carga diferida de Chart.js (~200KB) solo cuando un módulo lo necesita. */

let chartLoadPromise = null;

export function ensureChartJs() {
  if (window.Chart) return Promise.resolve(window.Chart);
  if (chartLoadPromise) return chartLoadPromise;

  chartLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-agv-chart]');
    if (existing) {
      existing.addEventListener("load", () => resolve(window.Chart));
      existing.addEventListener("error", () => reject(new Error("Chart.js no cargó")));
      return;
    }
    const script = document.createElement("script");
    script.src = "presentation/vendor/chart.umd.min.js?v=20260800";
    script.async = true;
    script.dataset.agvChart = "1";
    script.onload = () => resolve(window.Chart);
    script.onerror = () => reject(new Error("Chart.js no cargó"));
    document.head.appendChild(script);
  });

  return chartLoadPromise;
}
