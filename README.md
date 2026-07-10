# AGV 2026 — Sistema web de análisis de reportes

Tesis Olmos 2026 · UPAO

**Tecnologías:** HTML · CSS · JavaScript (ES Modules) · SheetJS · Navegador

---

## Arquitectura — Configuration Driven Architecture (CDA)

El sistema separa **configuración** (reglas JSON) de **código** (motor e interfaz). El comportamiento de validación se controla editando archivos de configuración sin modificar el motor ni la presentación.

| Capa | Carpeta | Responsabilidad |
|------|---------|-----------------|
| **1 — Presentación** | `presentation/` | Interfaz web, navegación, módulos por cultivo |
| **2 — Ingestión** | `ingestion/` | Lectura de `.xlsx` / `.csv` con SheetJS → filas estructuradas |
| **3 — Motor (Dominio)** | `engine/` | Evaluación de reglas sobre datos ingeridos |
| **4 — Reglas** | `rules/modulos/` | Reglas de negocio en `*.rules.json` |

### Flujo de datos

```
Usuario (navegador)
  → Presentación envía archivo
  → Ingestión normaliza filas
  → Motor lee reglas JSON y valida
  → Presentación muestra resultados / exporta Excel
```

### Despliegue

`rules/*.rules.json` → `git push` → GitHub → Netlify (hosting estático + CDN)

---

## Estructura

```
presentation/  → Interfaz web (HTML, CSS, JS)
ingestion/     → Capa de ingesta de reportes Excel/CSV
engine/        → Motor de análisis
rules/         → Reglas en JSON
index.html
```

---

## Rutas

`#/inicio` · `#/dashboard` · `#/trazabilidad` · `#/cartillas` · cultivos (`#/uva/mp`, `#/uva/pt`, …)
