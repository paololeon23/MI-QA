const primaryRouteKeys = {
  inicio: "routes.inicio",
  dashboard: "routes.dashboard",
  trazabilidad: "routes.trazabilidad",
  cartillas: "routes.cartillas"
};

const breadcrumbSegmentMap = {
  uva: "sidebar.grape",
  arandano: "sidebar.blueberry",
  esparrago: "sidebar.asparagus",
  palta: "sidebar.avocado",
  peru: "routes.trazabilidadPeru",
  chile: "routes.trazabilidadChile",
  mp: "labels.rawMaterial",
  pt: "labels.finishedProduct",
  plagas: "labels.pests",
  fqo: "labels.fqo"
};

export function buildBreadcrumbSegments(routeHash, translate) {
  const routePath = routeHash.replace("#/", "").trim();
  const segments = routePath.split("/").filter(Boolean);

  if (segments.length === 0 || segments[0] === "inicio") {
    return [{ label: translate("routes.inicio"), isActive: true }];
  }

  if (segments.length === 1 && primaryRouteKeys[segments[0]]) {
    return [{ label: translate(primaryRouteKeys[segments[0]]), isActive: true }];
  }

  if (segments[0] === "trazabilidad") {
    const crumbs = [{ label: translate("routes.trazabilidad"), isActive: false }];

    if (segments.length >= 2) {
      const countryKey = breadcrumbSegmentMap[segments[1]];
      crumbs.push({
        label: countryKey ? translate(countryKey) : segments[1],
        isActive: true
      });
    } else {
      crumbs[0].isActive = true;
    }

    return crumbs;
  }

  const crumbs = [{ label: translate("sidebar.sectionCrops"), isActive: false }];

  if (segments.length >= 1) {
    const cropKey = breadcrumbSegmentMap[segments[0]];
    crumbs.push({
      label: cropKey ? translate(cropKey) : segments[0],
      isActive: segments.length === 1
    });
  }

  if (segments.length >= 2) {
    const moduleKey = breadcrumbSegmentMap[segments[1]];
    crumbs.push({
      label: moduleKey ? translate(moduleKey) : segments[1].toUpperCase(),
      isActive: true
    });
  }

  return crumbs;
}

export function renderBreadcrumbHtml(routeHash, translate) {
  const segments = buildBreadcrumbSegments(routeHash, translate);

  return segments
    .map((segment, index) => {
      const separator =
        index < segments.length - 1
          ? `<i data-lucide="chevron-right" class="topbar__breadcrumb-separator" aria-hidden="true"></i>`
          : "";
      const activeClass = segment.isActive ? " topbar__breadcrumb-segment--active" : "";
      return `<span class="topbar__breadcrumb-segment${activeClass}">${segment.label}</span>${separator}`;
    })
    .join("");
}
