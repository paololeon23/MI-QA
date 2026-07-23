/** Rutas + estilos/XLSX bajo demanda (Inicio arranca ligero). */

const MODULE_PAGES = "presentation/css/pages/module-pages.css";
const CARTILLA_ANALYSIS = "presentation/css/pages/cartilla-analysis.css";

export const routesConfig = {
  "#/inicio": {
    titleKey: "routes.inicio",
    viewPath: "presentation/views/dashboard/inicio.html",
    modulePath: "presentation/js/modules/dashboard/inicio.module.js",
    stylesheets: []
  },
  "#/dashboard": {
    titleKey: "routes.dashboard",
    viewPath: "presentation/views/dashboard/dashboard.html",
    modulePath: "presentation/js/modules/dashboard/dashboard.module.js",
    stylesheets: ["presentation/css/pages/varieties-catalog.css"]
  },
  "#/trazabilidad": {
    titleKey: "routes.trazabilidad",
    viewPath: "presentation/views/trazabilidad/trazabilidad.html",
    modulePath: "presentation/js/modules/trazabilidad/trazabilidad.module.js",
    stylesheets: ["presentation/css/pages/trazabilidad-peru.css"]
  },
  "#/trazabilidad/peru": {
    titleKey: "routes.trazabilidadPeru",
    viewPath: "presentation/views/trazabilidad/trazabilidad-peru.html",
    modulePath: "presentation/js/modules/trazabilidad/trazabilidad-peru.module.js",
    stylesheets: ["presentation/css/pages/trazabilidad-peru.css"]
  },
  "#/trazabilidad/chile": {
    titleKey: "routes.trazabilidadChile",
    viewPath: "presentation/views/trazabilidad/trazabilidad-chile.html",
    modulePath: "presentation/js/modules/trazabilidad/trazabilidad-chile.module.js",
    stylesheets: ["presentation/css/pages/trazabilidad-peru.css"]
  },
  "#/cartillas": {
    titleKey: "routes.cartillas",
    viewPath: "presentation/views/cartillas/cartillas.html",
    modulePath: "presentation/js/modules/cartillas/cartillas.module.js",
    stylesheets: ["presentation/css/pages/cartillas.css"]
  },
  "#/uva/mp": {
    titleKey: "cultivo.uvaMp.title",
    viewPath: "presentation/views/cultivos/uva-mp.html",
    modulePath: "presentation/js/modules/cultivos/uva-mp.module.js",
    needsXlsx: true,
    stylesheets: [MODULE_PAGES, CARTILLA_ANALYSIS, "presentation/css/pages/uva-mp.css"]
  },
  "#/uva/pt": {
    titleKey: "cultivo.uvaPt.title",
    viewPath: "presentation/views/cultivos/uva-pt.html",
    modulePath: "presentation/js/modules/cultivos/uva-pt.module.js",
    needsXlsx: true,
    stylesheets: [MODULE_PAGES, CARTILLA_ANALYSIS, "presentation/css/pages/uva-pt.css"]
  },
  "#/uva/plagas": {
    titleKey: "cultivo.uvaPlagas.title",
    viewPath: "presentation/views/cultivos/uva-plagas.html",
    modulePath: "presentation/js/modules/cultivos/uva-plagas.module.js",
    needsXlsx: true,
    stylesheets: [MODULE_PAGES, "presentation/css/pages/plagas-arandano.css"]
  },
  "#/arandano/mp": {
    titleKey: "cultivo.arandanoMp.title",
    viewPath: "presentation/views/cultivos/arandano-mp.html",
    modulePath: "presentation/js/modules/cultivos/arandano-mp.module.js",
    needsXlsx: true,
    stylesheets: [MODULE_PAGES, CARTILLA_ANALYSIS, "presentation/css/pages/arandano-mp.css"]
  },
  "#/arandano/pt": {
    titleKey: "cultivo.arandanoPt.title",
    viewPath: "presentation/views/cultivos/arandano-pt.html",
    modulePath: "presentation/js/modules/cultivos/arandano-pt.module.js",
    needsXlsx: true,
    stylesheets: [MODULE_PAGES, CARTILLA_ANALYSIS, "presentation/css/pages/arandano-pt.css"]
  },
  "#/arandano/plagas": {
    titleKey: "cultivo.arandanoPlagas.title",
    viewPath: "presentation/views/cultivos/arandano-plagas.html",
    modulePath: "presentation/js/modules/cultivos/arandano-plagas.module.js",
    needsXlsx: true,
    stylesheets: [MODULE_PAGES, "presentation/css/pages/plagas-arandano.css"]
  },
  "#/esparrago/mp": {
    titleKey: "cultivo.esparragoMp.title",
    viewPath: "presentation/views/cultivos/esparrago-mp.html",
    modulePath: "presentation/js/modules/cultivos/esparrago-mp.module.js",
    needsXlsx: true,
    stylesheets: [MODULE_PAGES, CARTILLA_ANALYSIS, "presentation/css/pages/esparrago-mp.css"]
  },
  "#/esparrago/pt": {
    titleKey: "cultivo.esparragoPt.title",
    viewPath: "presentation/views/cultivos/esparrago-pt.html",
    modulePath: "presentation/js/modules/cultivos/esparrago-pt.module.js",
    needsXlsx: true,
    stylesheets: [
      MODULE_PAGES,
      CARTILLA_ANALYSIS,
      "presentation/css/pages/esparrago-pt.css",
      "presentation/css/pages/esparrago-mp.css"
    ]
  },
  "#/esparrago/plagas": {
    titleKey: "cultivo.esparragoPlagas.title",
    viewPath: "presentation/views/cultivos/esparrago-plagas.html",
    modulePath: "presentation/js/modules/cultivos/esparrago-plagas.module.js",
    needsXlsx: true,
    stylesheets: [MODULE_PAGES, "presentation/css/pages/plagas-arandano.css"]
  },
  "#/palta/mp": {
    titleKey: "cultivo.paltaMp.title",
    viewPath: "presentation/views/cultivos/palta-mp.html",
    modulePath: "presentation/js/modules/cultivos/palta-mp.module.js",
    needsXlsx: true,
    stylesheets: [MODULE_PAGES, CARTILLA_ANALYSIS, "presentation/css/pages/palta-mp.css"]
  },
  "#/palta/pt": {
    titleKey: "cultivo.paltaPt.title",
    viewPath: "presentation/views/cultivos/palta-pt.html",
    modulePath: "presentation/js/modules/cultivos/palta-pt.module.js",
    needsXlsx: true,
    stylesheets: [MODULE_PAGES, CARTILLA_ANALYSIS, "presentation/css/pages/palta-pt.css"]
  },
  "#/palta/plagas": {
    titleKey: "cultivo.paltaPlagas.title",
    viewPath: "presentation/views/cultivos/palta-plagas.html",
    modulePath: "presentation/js/modules/cultivos/palta-plagas.module.js",
    needsXlsx: true,
    stylesheets: [MODULE_PAGES, "presentation/css/pages/plagas-arandano.css"]
  }
};
