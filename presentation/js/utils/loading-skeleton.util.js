export function renderModuleSkeleton() {
  return `
    <div class="module-loading-overlay fade-in" id="moduleLoadingOverlay">
      <div class="skeleton-grid">
        <div class="skeleton-loader skeleton-card"></div>
        <div class="skeleton-loader skeleton-card"></div>
        <div class="skeleton-loader skeleton-card"></div>
        <div class="skeleton-loader skeleton-card"></div>
      </div>
      <div class="skeleton-loader skeleton-block skeleton-block--xl"></div>
    </div>
  `;
}
