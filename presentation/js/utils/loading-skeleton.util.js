/** Skeleton mínimo — solo primera visita a una pestaña (sin cache). */
export function renderModuleSkeleton() {
  return `
    <div class="module-loading-overlay" id="moduleLoadingOverlay" aria-busy="true">
      <div class="skeleton-loader skeleton-block skeleton-block--xl"></div>
    </div>
  `;
}
