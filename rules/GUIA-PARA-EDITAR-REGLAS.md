# Guía para editar las reglas de validación

Esta guía es para auxiliares de información. **No necesita saber programación.**

## ¿Dónde están las reglas?

Todas las reglas viven en **`rules/modulos/`**, un archivo por cultivo y módulo:

| Archivo | Ruta en el sistema |
|---------|-------------------|
| `arandano-mp-mpbar.rules.json`, `arandano-mp-mpgar.rules.json`, `arandano-mp-mpha.rules.json` | `#/arandano/mp` |
| `arandano-pt-ptbpar.rules.json`, `arandano-pt-ptlpar.rules.json`, `arandano-pt-pthpar.rules.json` | `#/arandano/pt` |
| `arandano-plagas.rules.json` | `#/arandano/plagas` |
| `esparrago-plagas.rules.json` | `#/esparrago/plagas` |
| `esparrago-mp-mpes.rules.json` | `#/esparrago/mp` |
| `uva-mp.rules.json` | `#/uva/mp` |
| … | (mismo patrón: `{cultivo}-{mp\|pt\|plagas}.rules.json`) |

**No use** la carpeta `rules/cultivos/` — ya no se usa. Solo edite `rules/modulos/`.

## Estructura del archivo

```json
{
  "total-columnas": 111,
  "configuracion-lectura": {
    "fila-encabezados": 6
  },
  "columnas": [
    {
      "numero": 10,
      "nombre-de-la-columna": "Lote",
      "es-obligatorio": true,
      "longitud-exacta": 10,
      "si-falla-mostrar": "Mensaje si falla"
    }
  ],
  "validaciones-compuestas": [],
  "validaciones-archivo": []
}
```

- `total-columnas`: cantidad de columnas del reporte (el nombre del Excel puede cambiar).
- `columnas`: lista en orden con `numero` y `nombre-de-la-columna` literal del Excel.
- Agregue las reglas **en la misma columna**, no en otro archivo.
- Use siempre `numero` cuando el Excel repite el mismo nombre de columna.

## Cómo cambiar una regla

1. Abra el archivo del módulo (ejemplo: `rules/modulos/arandano-plagas.rules.json`).
2. Busque la columna por `"numero"` o `"nombre-de-la-columna"`.
3. Cambie solo valores entre comillas o números.
4. Guarde y recargue la página del sistema.

## Reglas por columna

| Qué revisa | Qué escribir en la columna |
|------------|----------------------------|
| Campo obligatorio | `"es-obligatorio": true` |
| Rango numérico | `"minimo": 0`, `"maximo": 100` |
| Valor exacto | `"igual-a-valor": 500` |
| Lista de valores | `"valores-permitidos": ["A", "B"]` |
| Longitud exacta | `"longitud-exacta": 10` |
| Máximo de caracteres | `"maximo-de-caracteres": 12` |
| Formato (regex) | `"patron-regex": "^TG\\d{2}-\\d{8}$"` |
| Igual a otra columna | `"igual-a-columna": 72` |
| Catálogo (variedades) | `"debe-existir-en-catalogo": "var-map-arandano"` |
| Validar solo si tiene valor | `"validar-solo-si-tiene-valor": true` |
| Sin repetir | `"no-puede-repetirse": true` |
| Sin repetir por fecha | `"no-puede-repetirse": true`, `"agrupar-por-columna": 72` |
| Suma al final | `"debe-ser-suma-de": [91, 92, 93]` |
| Tolerancia en suma | `"tolerancia": 0.01` |
| Mensaje si falla | `"si-falla-mostrar": "Texto para el usuario"` |

### Ejemplo: Lote (columna 10)

```json
{
  "numero": 10,
  "nombre-de-la-columna": "Lote",
  "es-obligatorio": true,
  "longitud-exacta": 10,
  "no-puede-repetirse": true,
  "agrupar-por-columna": 72,
  "si-falla-mostrar": "Lote obligatorio, 10 caracteres, sin duplicar en la misma fecha"
}
```

### Ejemplo: sumatoria

```json
{
  "numero": 101,
  "nombre-de-la-columna": "Sumatoria Defectos de Calidad",
  "debe-ser-suma-de": [91, 92, 93, 94, 95, 96, 97, 98, 99, 100],
  "tolerancia": 0,
  "si-falla-mostrar": "La sumatoria no coincide"
}
```

## Validaciones compuestas (al final del JSON)

Reglas que cruzan varias columnas:

```json
{
  "tipo": "igual-entre-columnas",
  "columna-a": 20,
  "columna-b": 72,
  "si-falla-mostrar": "Fecha cosecha debe ser igual a fecha de inspección"
}
```

## Validaciones de archivo (al final del JSON)

```json
{
  "tipo": "total-columnas",
  "valor": 111,
  "si-falla-mostrar": "El archivo debe tener 111 columnas"
}
```

## Qué NO tocar

- Llaves `{` `}` y corchetes `[` `]`
- Comas entre bloques
- Nombres técnicos: `"columnas"`, `"nombre-de-la-columna"`, etc.

## Archivos pendientes por crear

Cuando se trabaje otro cultivo/módulo, crear el JSON correspondiente en `rules/modulos/`:

- `uva-mp.rules.json`, `uva-pt.rules.json`, `uva-plagas.rules.json`
- `esparrago-pt.rules.json`, `palta-mp.rules.json`, `palta-pt.rules.json`, `palta-plagas.rules.json`

---

*Última actualización: junio 2026 · AGV 2026 — Olmos*
