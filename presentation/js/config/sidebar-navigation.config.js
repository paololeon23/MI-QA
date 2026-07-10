export const primaryNavigationItems = [
  { href: "#/inicio", icon: "home", labelKey: "routes.inicio", id: "lnkSidebarInicio" },
  { href: "#/dashboard", icon: "cherry", labelKey: "routes.dashboard", id: "lnkSidebarDashboard" },
  { href: "#/cartillas", icon: "clipboard-list", labelKey: "routes.cartillas", id: "lnkSidebarCartillas" }
];

export const moduleNavigationGroups = [
  {
    id: "trazabilidad",
    icon: "route",
    labelKey: "routes.trazabilidad",
    insertAfterIndex: 1,
    children: [
      { href: "#/trazabilidad/peru", labelKey: "routes.trazabilidadPeru", id: "lnkSidebarTrazabilidadPeru" },
      { href: "#/trazabilidad/chile", labelKey: "routes.trazabilidadChile", id: "lnkSidebarTrazabilidadChile" }
    ]
  }
];

export const cropNavigationGroups = [
  {
    id: "arandano",
    theme: "arandano",
    icon: "cherry",
    labelKey: "sidebar.blueberry",
    defaultExpanded: false,
    children: [
      { href: "#/arandano/mp", labelKey: "routes.arandanoMp", id: "lnkSidebarArandanoMp" },
      { href: "#/arandano/pt", labelKey: "routes.arandanoPt", id: "lnkSidebarArandanoPt" },
      { href: "#/arandano/plagas", labelKey: "routes.arandanoPlagas", id: "lnkSidebarArandanoPlagas" }
    ]
  },
  {
    id: "esparrago",
    theme: "esparrago",
    icon: "sprout",
    labelKey: "sidebar.asparagus",
    defaultExpanded: false,
    children: [
      { href: "#/esparrago/mp", labelKey: "routes.esparragoMp", id: "lnkSidebarEsparragoMp" },
      { href: "#/esparrago/pt", labelKey: "routes.esparragoPt", id: "lnkSidebarEsparragoPt" },
      { href: "#/esparrago/plagas", labelKey: "routes.esparragoPlagas", id: "lnkSidebarEsparragoPlagas" }
    ]
  },
  {
    id: "palta",
    theme: "palta",
    icon: "palta",
    labelKey: "sidebar.avocado",
    defaultExpanded: false,
    children: [
      { href: "#/palta/mp", labelKey: "routes.paltaMp", id: "lnkSidebarPaltaMp" },
      { href: "#/palta/pt", labelKey: "routes.paltaPt", id: "lnkSidebarPaltaPt" },
      { href: "#/palta/plagas", labelKey: "routes.paltaPlagas", id: "lnkSidebarPaltaPlagas" }
    ]
  },
  {
    id: "uva",
    theme: "uva",
    icon: "grape",
    labelKey: "sidebar.grape",
    defaultExpanded: false,
    children: [
      { href: "#/uva/mp", labelKey: "routes.uvaMp", id: "lnkSidebarUvaMp" },
      { href: "#/uva/pt", labelKey: "routes.uvaPt", id: "lnkSidebarUvaPt" },
      { href: "#/uva/plagas", labelKey: "routes.uvaPlagas", id: "lnkSidebarUvaPlagas" }
    ]
  }
];
