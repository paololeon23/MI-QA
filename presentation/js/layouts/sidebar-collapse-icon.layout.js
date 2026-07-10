export function buildSidebarCollapseIconMarkup() {
  return `
    <svg class="topbar__sidebar-toggle-icon" viewBox="0 0 20 16" aria-hidden="true" focusable="false">
      <rect x="3" y="1.5" width="14" height="1.75" rx="0.875" />
      <rect x="7" y="7.125" width="10" height="1.75" rx="0.875" />
      <path d="M3 8 L6.5 5.25 L6.5 10.75 Z" />
      <rect x="3" y="12.75" width="14" height="1.75" rx="0.875" />
    </svg>
  `;
}
