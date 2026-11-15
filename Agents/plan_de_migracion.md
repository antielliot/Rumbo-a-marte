# Plan de migración — A* sobre cualquier ventana de Marte

Hoja de ruta para salir del prototipo de Gale (fetch de archivos ya cortados) hacia el motor de `contexto_datasets_nasa.md`. Este documento no cambia código.

**Por dónde empezar a programar**

1. `app/scripts/parser_tiff.mjs`, copiando la lectura por ventana de `fetch-dem.mjs` (líneas 14–28) y quitando el `BOX` de Gale y el cálculo de rugosidad.
2. `app/src/lib/normalizar.mjs`, para pasar cada banda a `[0, 1]` antes de ponderar.
3. `app/src/lib/heuristica_astar.mjs`, reutilizando el montículo y los 8 vecinos de `route.js`, con la fórmula nueva.
4. `App.jsx`: pesos de la interfaz y una sola grilla de la ventana pedida.
5. Borrar los módulos de la sección 1 solo cuando una ruta de prueba salga de los tres módulos nuevos.

El primer objetivo demostrable es una ventana distinta de 136.4–139.2°E / −6.8 a −4.0°N, leída de un `.tif` con `geotiff`, normalizada y recorrida por A*. Gale puede seguir siendo el bbox de esa prueba, pasado como argumento, no como constante.

---

## 1. Análisis de brechas (Gap Analysis)

El A* ya existe (`findRoute` en `app/src/lib/route.js`) y `fetch-dem.mjs` ya abre un GeoTIFF con `geotiff` (`fromUrl` + `readRasters({ window })`). Lo que sobra es el dominio Gale y los factores que la fórmula nueva no usa: esfuerzo, rugosidad, comunicación, dunas y el modelo de radiación anclado en Gale.

La fórmula vigente en `prepare` es `1 + w.rad * radRisk + w.rough * roughRisk + w.comm * commRisk + w.sand * sandRisk`, más el esfuerzo de `effortRisk` dentro de `findRoute`. La fórmula objetivo es \((V_{temp} \cdot P_{temp}) + (V_{rad} \cdot P_{rad}) + (V_{corr} \cdot P_{corr}) + (V_{suelo} \cdot P_{suelo})\), con la pendiente como obstáculo. Esos símbolos de riesgo no tienen equivalente y se eliminan.

### Constantes y pesos atados a Gale

| Archivo | Símbolo | Por qué sobra |
|---|---|---|
| `app/src/lib/constants.js` | `CONST.BASE` (`lat: -4.5895`, `lon: 137.4417`, Bradbury Landing) | Única base de comunicación y de excursión. El costo nuevo no tiene línea de vista ni base. |
| `app/src/lib/constants.js` | `CONST.ANTENNA_H_M` | Solo lo usa `viewshed` junto con `CONST.BASE`. |
| `app/src/lib/constants.js` | `CONST.CELL_M = 200` | Resolución del DEM de Gale. La celda tiene que salir de la ventana leída (`cellM` ya viaja en el JSON del DEM). |
| `app/src/lib/constants.js` | Entradas `base`, `antenna` y `cell` de `FIXED` | Describen las tres constantes anteriores en el panel de datos. |
| `app/src/App.jsx` | `W` (`effort: 1, rad: 2, rough: 1, comm: 1, sand: 1`) | Pesos fijos del prototipo. La interfaz tiene que exponer \(P_{temp}\), \(P_{rad}\), \(P_{corr}\), \(P_{suelo}\). |
| `app/src/App.jsx` | `W_RELIEF` | Modo “solo relieve” de la comparación con Curiosity. Ese modo no está en el motor nuevo. |
| `app/src/App.jsx` | `loadDem()` y `loadDem('gale50')` | Cargan `gale-dem.*` y `gale50-dem.*`. El segundo existe solo para la zona de Curiosity. |

### Funciones que dejan de alimentar el costo

| Archivo | Función o bloque | Por qué sobra |
|---|---|---|
| `app/src/lib/dem.js` | `loadDem` (default `'gale'`) | Hace `fetch` de `${prefix}-dem.f32`, `${prefix}-dem.json` y `${prefix}-rough.f32`. Es el camino de archivos preparados de Gale. |
| `app/src/lib/dem.js` | `loadDunes`, `rasterDunes`, `SUB` | Rasterizan `gale-dunes.json`. La inercia térmica sustituye a las dunas; el md no menciona el USGS MGD3. |
| `app/src/lib/dem.js` | Percentil 95 y `roughRisk` dentro de `buildDem` | La rugosidad no entra en la suma. |
| `app/src/lib/dem.js` | Llamadas a `viewshed` y `simulate` al final de `buildDem` | Construyen `commRisk` y `radRisk` del prototipo. |
| `app/src/lib/effort.js` | `effortJ`, `effortRel`, `effortRisk`, `EFFORT_REL_MIN`, `EFFORT_REL_MAX` | Esfuerzo de Minetti. El relieve nuevo bloquea por pendiente; no suma un costo metabólico. |
| `app/src/lib/comm.js` | `viewshed` | Línea de vista desde Bradbury Landing (`CONST.BASE`). Sin término de comunicación. |
| `app/src/lib/radiation.js` | `radiationFor`, `simulate`, `SOLAR`, `REF`, `pressureAt`, `RISK_LO`, `RISK_HI` | Modelo Guo 2018 anclado en Gale (`REF.elev = -4400`, `REF.pressure = 840`). El md pide otra capa: Curiosity RAD + MGS MAG/ER + cota MOLA. No reutilizar esta función como \(V_{rad}\). |
| `app/src/lib/sun.js` | `shadeMap` | Capa visual de sombra. No está en la heurística. `sunPosition` se queda sin llamador si desaparece esa capa. |
| `app/src/lib/temperature.js` | `loadTemp` | Lee `gale-temp.json` (Mars Climate Database en un punto del centro de Gale). \(V_{temp}\) tiene que ser un ráster THEMIS, no esa tabla horaria. |
| `app/src/lib/curiosity.js` | `loadCuriosity`, `compareRoutes`, `cutAtSol`, `solDate` | Benchmark del recorrido de Curiosity. El propio archivo dice que no entra en A*. El md de arquitectura no lo conserva. |
| `app/src/lib/route.js` | Cuerpo de `prepare` que lee `radRisk`, `roughRisk`, `commRisk`, `sandRisk` | Es la función de costo del prototipo, incluido el `1 +` que la fórmula nueva no tiene. |
| `app/src/lib/route.js` | `isBlocked` cuando exige `elev[i] <= maxElev` | El filtro de altura máxima no está en el md. El bloqueo que sí está es la pendiente y la celda sin dato. |
| `app/src/lib/explain.js` | Claves `effort`, `sand`, `comm`, `rough`, `height` de `REASONS`, `ZERO`, `evaluate` y el objeto `why` | Esas frases explican factores que se eliminan. El motivo `height` corresponde al filtro de altura máxima. |

### Scripts y datos de un solo cráter

| Archivo | Símbolo | Por qué sobra |
|---|---|---|
| `app/scripts/fetch-dem.mjs` | `BOX` (136.4–139.2°E, −6.8 a −4.0°N) y las salidas `gale-dem.f32`, `gale-rough.f32`, `gale-dem.json` | El recuadro y los nombres son Gale. El bucle de rugosidad 3×3 (líneas 30–46) no tiene destino en la heurística. La lectura con ventana sí se conserva, movida al parser. |
| `app/scripts/fetch-dem-1m.mjs` | `URL_DEM` del mosaico `MSL_Gale_DEM_Mosaic_1m`, `CELL_M = 50`, salidas `gale50-*` | Producto exclusivo de Gale / Curiosity. |
| `app/scripts/fetch-dunes.mjs` | `BOX` idéntico al de Gale | Recorta dunas al cráter. La capa no entra en el costo. |
| `app/scripts/fetch-mcd.mjs` | Lectura de `gale-dem.json` y el punto medio de ese bbox | Clima de un punto de Gale. No produce el ráster de temperatura. |
| `app/scripts/fetch-curiosity.mjs` | Descarga `MSL_traverse.json` / `MSL_waypoints.json` | Solo alimenta el benchmark. |
| `app/package.json` | Scripts `fetch-dem`, `fetch-dem-1m`, `fetch-mcd`, `fetch-curiosity`, `fetch-dunes` | Atajos a los cinco scripts anteriores. |

Dejan de ser la entrada de la app: `app/public/data/gale-dem.f32`, `gale-dem.json`, `gale-rough.f32`, `gale50-dem.f32`, `gale50-dem.json`, `gale50-rough.f32`, `gale-dunes.json`, `gale-temp.json`, `curiosity-traverse.json`.

### Supuestos de esta sección

- **Supuesto.** El benchmark de Curiosity, la tarjeta horaria de la MCD y la capa de sombra se quitan del camino de la heurística. El md no dice que haya que conservarlos como modo demo.
- **Supuesto.** `CONST.MAX_SLOPE_DEG = 20` no se borra. El md dice “pendientes mayores a 15–20 grados” y no elige un número. Se mantiene 20°, que es el umbral ya codificado, hasta que el equipo fije uno.
- **Supuesto.** `CONST.WALK_KMH`, `CONST.DOSE_LIMIT_MSV`, `CONST.SUIT_EXT_K` y `CONST.MAX_EXCURSION_KM` no entran en \(g(n)\). Sobra usarlos como aviso de la ruta (excursión desde la base, dosis del modelo Guo, temperatura MCD). No se borran en el primer corte si alguna cifra sigue mostrándose; dejan de justificar módulos enteros.
- **Supuesto.** El `1 +` de `prepare` y el filtro `maxElev` se eliminan porque no aparecen en la fórmula del md. No se sustituyen por otro costo base.

---

## 2. Archivos a modificar

Orden interno de cada archivo: primero desenganchar Gale y los factores viejos, después enchufar la grilla normalizada. No reescribir la UI de mapa antes de que `buscarRuta` acepte la grilla nueva.

### `app/src/lib/route.js`

**Cambia.** `prepare`, `findRoute` y `stepParts` dejan de conocer `effort`, `rad`, `rough`, `comm` y `sand`. Esa lógica pasa a `heuristica_astar.mjs` (sección 3). Cuando `App.jsx` y `explain.js` importen el módulo nuevo, este archivo se elimina para no dejar dos A*.

**Queda igual hasta el traslado.** `MinHeap`, los desplazamientos `DX`/`DY`, el coste diagonal `LEN`, la heurística octil `hh`, la prohibición de cortar esquinas y la reconstrucción de `cells` + `distanceKm`.

**Supuesto.** \(h(n)\) no está definida en el md. Se conserva la distancia octil de `hh`, multiplicada por el costo mínimo por metro de la grilla ya ponderada, porque hoy es admisible. Si el costo mínimo es 0 (todos los pesos a 0), \(h\) debe ser 0.

**Supuesto.** El md llama “costo de celda” a la suma ponderada y no dice si se multiplica por la longitud del paso. Se multiplica por `dist` (como hace `findRoute` con `dist * step`) para que el paso diagonal no cueste lo mismo que el ortogonal en metros. El sumando `1` no se copia.

### `app/src/lib/dem.js`

**Cambia.** `loadDem` deja de ser la fuente. Pasa a cargar la ventana que escribió el parser (metadatos + bandas), con el bbox que venga en el JSON, no con el prefijo `'gale'` / `'gale50'`. `buildDem` se reduce a geometría y pendiente: de la elevación MOLA salen `slope` (el bucle de diferencias centrales, líneas 72–81), `lonLat`, `cellOf`, `dLon`, `dLat`. Se eliminan rugosidad, dunas, `viewshed` y `simulate`.

**Queda igual.** El contrato que ya consumen el mapa y el perfil: `w`, `h`, `n`, `cellM`, `elev`, `bbox` / `lonMin`…`latMax`, `lonLat(x, y)`, `cellOf(lon, lat)`. `NaN` sigue significando sin dato.

**Supuesto.** Las otras capas llegan ya alineadas a esta malla. `dem.js` no remuestrea. Quién alinea es el parser (supuesto de la sección 3).

### `app/src/lib/constants.js`

**Cambia.** Se quitan `BASE`, `ANTENNA_H_M`, `CELL_M` y las filas `base`, `antenna` y `cell` de `FIXED`. `MAX_SLOPE_DEG` se documenta como umbral de obstáculo (supuesto: 20°).

**Queda igual.** El arreglo `FIXED` como lista que pinta `DataPanel`, más `WALK_KMH` si el cartel de tiempo a pie se conserva. `MARS_OBLIQUITY_DEG` se queda solo si `shadeMap` sigue vivo; si la capa de sombra se elimina, esta constante se queda sin uso y se borra con `sun.js`.

### `app/src/lib/explain.js`

**Cambia.** `REASONS`, `ZERO` y `evaluate` pasan a los componentes de la fórmula nueva: `temp`, `rad`, `corr`, `suelo`, más bloqueo `slope` y `nodata`. Las frases de dunas, rugosidad, comunicación, subida metabólica y altura máxima se reescriben o se eliminan. `explainRoute` sigue llamando al desglose del mismo A* (`partesPaso`), no a una fórmula paralela.

**Queda igual.** `lineCells`, `distSeg`, `turns` (Douglas–Peucker) y la comparación tramo real contra atajo recto.

**Supuesto.** El md no pide el explicador de giros. Se conserva porque `App.jsx` y `MapView.jsx` ya lo muestran. No se inventan motivos nuevos más allá de los cuatro términos y del bloqueo por pendiente o sin dato.

### `app/src/App.jsx`

**Cambia.**

- El subtítulo “Gale · navegación EVA” y el estado doble `craterDem` / `detailDem`.
- `W`, `W_RELIEF`, el `useMemo` de `w`, y la sección “Comparar con Curiosity” (`bench`, `curiosity`, `benchRes`, `benchSand`, `solIdx`, `useCuriosityEnds`).
- `LAYERS`: quitar `rough`, `comm`, `shade`, `sand`. Sustituir por las capas normalizadas (`temp`, `rad`, `corr`, `suelo`) y la pendiente como máscara de bloqueo, no como peso.
- El efecto que llama a `radiationFor` con la presión de `temp.table` (MCD). \(V_{rad}\) llega ya en la grilla.
- El control “Altura máxima” y `filter.maxElev`. El filtro de búsqueda queda en pendiente (`CONST.MAX_SLOPE_DEG`) y celdas sin dato.
- Cuatro controles de peso, uno por término, que forman el objeto que recibe `buscarRuta`.
- `stats`: dejar de acumular `effortRel`, `dose` con `dem.rad` y `vis` con `dem.visible` / `baseCell`. Esos campos dependen de módulos que se eliminan.

**Queda igual.** Clic de inicio y clic de destino, un solo A* por par de puntos (`job`), reinicio al tercer clic, tarjeta de distancia / tiempo / elevación, y el perfil. `onPick` sigue traduciendo lon/lat con `cellOf`.

### `app/src/components/MapView.jsx`

**Cambia.** `heatUrl`: el mapa de nombres `rad` / `rough` / `comm` / `shade` / `sand` pasa a las bandas normalizadas. La máscara roja de `maskCanvas` usa el bloqueo nuevo (pendiente y sin dato), sin “muy alto”. Se quitan el marcador de base Bradbury y la polilínea de Curiosity.

**Queda igual.** Proyección `EPSG:104905`, teselas Trek MOLA (esa URL ya es global), `reliefUrl`, el dibujo de la ruta, los marcadores de giro y el atajo punteado.

### `app/src/components/DataPanel.jsx`

**Cambia.** El párrafo que describe `distancia × (1 + preferencias + esfuerzo)`. Las filas de estación, hora, actividad solar (`SOLAR`) y altura máxima dejan de presentarse como entradas del costo. El texto de esfuerzo, dunas, rugosidad y comunicación se sustituye por las cinco capas y la fórmula del md. Hoy el panel importa `SOLAR` desde `radiation.js` y `SEASONS` desde `temperature.js`: esos import hay que cortarlos al borrar esos módulos.

**Queda igual.** El patrón `Row` / `KIND` / `FIXED` y el cierre del panel.

### `app/src/components/ElevationProfile.jsx`

**Cambia.** Nada, mientras la grilla conserve `elev`, `w`, `cellM` y `route.cells`.

**Queda igual.** El componente entero.

### `app/src/components/TemperatureCard.jsx`

**Cambia.** `App.jsx` deja de pasarle la tabla MCD como si fuera \(V_{temp}\).

**Queda igual.** El componente, sin montarlo, hasta que exista una lectura puntual de la capa THEMIS. **Supuesto:** el md no describe esta tarjeta. No se reescribe para “simular” el gradiente temporada/latitud/altitud.

### `app/package.json`

**Cambia.** Se retiran los cinco scripts `fetch-*` cuando sus archivos salgan. Entra un script que llame al parser con un bbox (por ejemplo `preparar-ventana`). `geotiff` sigue siendo la librería de lectura.

**Queda igual.** `dev`, `build`, `preview`, React, Vite, OpenLayers, proj4, Chart.js.

**Supuesto.** `geotiff` está en `devDependencies` y solo lo importan los scripts de Node. Se queda ahí mientras el `.tif` se lea en Node. Pasarlo a `dependencies` solo tendría sentido si el navegador leyera el COG, y el md no obliga a eso (ver sección 3).

### `app/src/main.jsx` y `app/vite.config.js`

No se tocan.

---

## 3. Nuevos módulos a crear

Tres módulos. El primero y el tercero son los que el equipo nombró. El segundo existe porque el md exige normalizar antes de ponderar y esa función no cabe ni en el lector ni en A* sin mezclar responsabilidades.

**Supuesto de proceso (el md no elige).** No hay servidor en el código ni en la arquitectura. `dem.js` hoy hace `fetch` de binarios ya cortados; `geotiff` solo corre en los scripts. La zona dinámica, en este plan, es el bbox que se le pasa al script de preparación. El navegador sigue calculando A* sobre la ventana ya reducida, que es lo que `App.jsx` hace hoy con `findRoute`.

**Supuesto alternativo, no implementado aquí.** Elegir la zona con un clic y leer el `.tif` dentro de Vite exigiría mover `geotiff` al bundle y repetir `readRasters({ window })` en el cliente. No está decidido. No se construye un backend en este plan.

**Supuesto de productos.** En el repo solo hay URL de elevación: el MOLA–HRSC global en `fetch-dem.mjs` (`URL_DEM`) y el mosaico de 1 m de Gale en `fetch-dem-1m.mjs`. GRS, MAG/ER, THEMIS y TES no tienen ruta ni URL. El parser recibe esas rutas por argumento. No se inventan enlaces.

### `app/scripts/parser_tiff.mjs`

Lee una banda de un GeoTIFF y devuelve solo la ventana pedida, en una malla común.

**Funciones**

- `bboxAVentana(image, bbox) → { x0, y0, x1, y1, ancho, alto }`
  - Entrada: imagen de `geotiff` (`getOrigin`, `getResolution` o `getBoundingBox`, como en `fetch-dem.mjs` y `fetch-dem-1m.mjs`) y `bbox = { lonMin, lonMax, latMin, latMax }`.
  - Salida: índices de píxel. Si el bbox cae fuera del archivo, error explícito. No sustituye un bbox vacío por el de Gale.
- `leerBanda({ origen, bbox, maxLado }) → { ancho, alto, bbox, cellM, nodata, valores }`
  - Entrada: `origen` es ruta de archivo (`fromFile`) o URL (`fromUrl`). `maxLado` es el lado máximo de la grilla de trabajo.
  - Salida: `valores` como `Float32Array` con `NaN` donde el píxel sea el nodata GDAL. No incluye rugosidad.
  - Si la ventana nativa supera `maxLado`, remuestrea **antes** de devolver el array (sección 4). No lee el ráster entero para recortarlo después.
- `leerCapas({ archivos, bbox, maxLado }) → { ancho, alto, bbox, cellM, elev, cloro, mag, temp, suelo }`
  - Entrada: rutas por capa. `elev` es MOLA (obligatoria: de ahí salen la pendiente y la alineación). Las otras pueden faltar.
  - Salida: bandas del mismo `ancho × alto`.
  - **Supuesto de alineación.** El md dice “alinear a la misma malla” y no dice el método. GRS y MAG/ER son mucho más gruesos que MOLA. Supuesto: la malla maestra es la ventana MOLA ya limitada por `maxLado`; el resto se lleva a esa malla por vecino más cercano. Si una capa no cubre el bbox, sus celdas quedan en `NaN` y A* las trata como sin dato.

**Quién lo llama.** Un script corto de CLI (puede vivir al final de este mismo archivo, al estilo de los `fetch-*.mjs` actuales) recibe el bbox y las rutas, llama a `leerCapas`, pasa cada banda por `normalizar.mjs` y escribe en `app/public/data/` un JSON de metadatos más un binario por banda. `dem.js` hace `fetch` de esa salida. El CLI no calcula la ruta.

### `app/src/lib/normalizar.mjs`

**Funciones**

- `rango(valores) → { min, max }`
  - Ignora `NaN`. Si no hay ningún valor finito, error.
- `normalizarCapa(valores, { invertir }) → Float32Array`
  - Entrada: matriz cruda y un flag.
  - Salida: misma forma, cada valor finito en `[0, 1]`, `NaN` intacto. `invertir: false` pone el máximo crudo en 1. `invertir: true` pone el máximo crudo en 0.
  - Sentido por capa, según el md:
    - Percloratos (cloro GRS): `invertir: false` (más concentración, más costo).
    - Inercia térmica: `invertir: true` (el md lo dice: inercia alta es suelo favorable, así que \(V_{suelo}\) va al revés).
    - Magnetismo cortical: `invertir: true` si luego se usa como penalización (menos campo, más costo).
    - Elevación, cuando alimenta radiación: `invertir: false` (más cota, más costo). El rango de referencia del md es −8 200 m a +21 200 m, pero el mínimo y el máximo se calculan sobre la ventana cargada, no sobre ese rango planetario. Esos números solo sirven de comprobación.
- `combinarRadiacion({ vElev, vMag }) → Float32Array`
  - **Sin fórmula en el md.** Dice que más elevación y menos magnetismo cuestan más, y que Curiosity RAD es la referencia de magnitud. No dice cómo se mezclan los tres ni en qué unidades.
  - **Supuesto de arranque, para poder integrar el resto:** \(V_{rad} = vElev\). `vMag` se calcula y se guarda, y no entra en la suma hasta que el equipo escriba la mezcla en este apartado. RAD no se convierte a mSv dentro de esta función: en el repo, el único número de RAD es el ancla de Gale dentro de `radiation.js` (`REF.doseEq = 0.67`), y ese modelo se elimina.
- `combinarTemperatura(rasterThemis) → Float32Array`
  - **Supuesto.** El md pide a la vez un min-max a `[0, 1]` y penalizar “temperaturas extremas” (las dos colas), y además un gradiente de temporada, latitud y altitud, sin ecuación. Esas frases no definen la misma función. La primera versión es `normalizarCapa(raster, { invertir: false })` sobre el único ráster THEMIS que se haya pasado. No se fabrica un término de distancia a una temperatura cómoda ni se combina con la tabla MCD.

**Quién lo llama.** El CLI del parser, después de `leerCapas` y antes de escribir los binarios. A* solo ve bandas ya en `[0, 1]`.

### `app/src/lib/heuristica_astar.mjs`

A* de 8 vecinos sobre la grilla ya normalizada. Sustituye a `route.js`.

**Funciones**

- `costoCelda(v, pesos) → number`
  - Entrada: `v = { temp, rad, corr, suelo }` en `[0, 1]` y `pesos = { temp, rad, corr, suelo }` (los \(P\) de la interfaz).
  - Salida: la suma del md. Sin `1 +` y sin esfuerzo.
- `marcarObstaculos(grilla, umbralPendiente) → Float32Array`
  - Entrada: `grilla` con `elev`, `slope` y las cuatro bandas; `umbralPendiente` en grados (llamada inicial: `CONST.MAX_SLOPE_DEG`).
  - Salida: costo estático por celda, o `Infinity` si la pendiente supera el umbral, si `elev` es `NaN`, o si falta alguna banda usada por un peso distinto de 0.
  - **Supuesto.** Una capa con peso 0 puede estar toda en `NaN` y no bloquea. Una capa con peso mayor que 0 y valor `NaN` bloquea esa celda. El md dice que la celda sin dato no entra en la suma; no dice qué pasa si falta solo una capa.
- `buscarRuta(grilla, inicio, destino, pesos, umbralPendiente) → { cells, distanceKm } | null`
  - Entrada: `inicio` y `destino` como `[x, y]` de celda, el mismo convenio que `findRoute`.
  - Salida: el mismo objeto que hoy devuelve `findRoute`, para no rehacer `MapView` ni `ElevationProfile`. `null` si origen o destino están bloqueados o no hay camino.
  - Comportamiento que se trae de `route.js`: montículo, 8 vecinos, no cortar esquinas, heurística octil.
- `partesPaso(grilla, i, j, pesos) → { dist, temp, rad, corr, suelo }`
  - Entrada: índices de celda lineales, como `stepParts`.
  - Salida: metros equivalentes por componente, para `explain.js`. La suma de los cuatro términos por `dist` es el costo del paso.

**Quién lo llama.** `App.jsx` llama a `buscarRuta` donde hoy llama a `findRoute`. `explain.js` llama a `partesPaso` y a la prueba de bloqueo donde hoy llama a `stepParts` e `isBlocked`. `MapView.jsx` usa la misma prueba de bloqueo para la máscara. Nadie dentro de estos módulos importa React ni hace `fetch`.

### Objeto grilla que viaja entre los tres

```
{
  w, h, n, cellM, bbox,
  elev, slope,          // MOLA; slope se calcula en dem.js
  vTemp, vRad, vCorr, vSuelo,   // [0, 1] o NaN
  lonLat, cellOf
}
```

`parser_tiff.mjs` produce elevación y bandas crudas. `normalizar.mjs` produce las cuatro `v*`. `dem.js` añade pendiente y coordenadas. `heuristica_astar.mjs` solo lee números.

---

## 4. Advertencias de rendimiento

### Memoria al abrir un `.tif`

Los productos citados en el md llegan a unos 46 000 × 23 000 píxeles. Una banda en `Float32` de ese tamaño son unos 4,2 GB (46 000 × 23 000 × 4). Cinco bandas, más la copia normalizada, superan la RAM de una máquina de hackathon. `readRasters()` sin `window` materializa esa banda: es el fallo que hay que evitar.

Hechos del código actual que marcan el límite conocido:

- `fetch-dem.mjs` abre un GeoTIFF que el propio comentario estima en ~11 GB y solo lee la ventana de Gale (`readRasters({ window: [x0, y0, x1, y1], samples: [0] })`). Esa ventana cabe: 829 × 830 celdas en `gale-dem.json`.
- `fetch-dem-1m.mjs` no carga el mosaico de 3,6 GB: pide filas sueltas y promedia a celdas de 50 m.
- `MinHeap` en `route.js` está comentado para mallas de ~1 millón de celdas. Gale (829 × 830) está debajo de ese techo. Un planeta entero, no.

Reglas para el parser:

- Prohibido llamar a `readRasters` sin `window`, salvo que el archivo ya sea el recorte de la ventana.
- Una banda residente por capa de la ventana, no el archivo global y además la ventana.
- Convertir a `Float32` y soltar el typed array crudo en cuanto la normalización haya escrito su salida. A* no necesita el valor crudo y el normalizado a la vez, excepto la elevación: esa se queda en metros para la pendiente, el perfil y el mapa.
- Respetar el nodata GDAL antes de normalizar. Un 0 de relleno o un −9999 entrarían en el mínimo y el máximo y aplastarían el `[0, 1]`.
- `geotiff` en Node, como hoy. Abrir el archivo global dentro del bundle de Vite repetiría el problema en el navegador, con menos memoria.

### Dónde recortar y dónde bajar la resolución

El downsampling va **antes** de construir la grilla de A*, nunca dentro de `buscarRuta`.

1. **Recorte por bbox, en `bboxAVentana`.** Es el `window` que ya calcula `fetch-dem.mjs` (líneas 19–26) a partir de origen y resolución. Aquí se aplica a cualquier bbox, no al `BOX` de Gale. Con un COG o un TIFF sin compresión que acepte peticiones por rango, esto evita descargar el resto del planeta. El comentario de `fetch-dem.mjs` cifra esa descarga de Gale en ~1,4 MB.

2. **Tope de lado, en `leerBanda`, antes de asignar el `Float32Array`.** **Supuesto de presupuesto:** `maxLado = 1024` (como mucho ~1 millón de celdas, el orden que el montículo actual ya contempla). Si `x1 - x0` o `y1 - y0` pasan de ese tope, no se lee la ventana a resolución nativa. Ahí está el downsampling: o `readRasters` con ancho y alto de salida menores que la ventana, o el promedio por bloques que ya hace `fetch-dem-1m.mjs` (`CELL_M`, filas muestreadas, `CONCURRENCY`). El segundo patrón es el que hay que copiar cuando el píxel nativo es mucho más fino que la celda de la ruta (el mosaico de 1 m es el ejemplo, aunque ese archivo concreto sea de Gale y se deje de usar).

3. **Pendiente después del remuestreo, en `dem.js`.** La pendiente sobre el píxel nativo de un ráster fino, y luego un A* sobre esa malla, no entra en memoria. Se baja la resolución primero y las diferencias centrales corren sobre la celda de trabajo. A 200 m el propio `FIXED` de `constants.js` ya advierte que la pendiente se suaviza: el umbral de 20° en una celda gruesa deja pasar laderas reales más fuertes. Es una limitación conocida, no un motivo para subir la resolución de toda la ventana.

4. **Productos que no se puedan leer por ventana.** El md pide recorte y downsampling previos (QGIS u otra herramienta) para los `.tif` de archivo. Eso aplica a GRS, MAG/ER, THEMIS y TES mientras no exista una URL que acepte lectura parcial, porque esas URL no están en el repo. El archivo que entra a `leerBanda` debe ser ya un recorte de la región de trabajo, no el mosaico planetario. El vecino más cercano hacia la malla MOLA (supuesto de la sección 3) ocurre después de ese recorte, sobre dos arrays pequeños.

5. **Normalización sobre la ventana, no sobre el planeta.** El mínimo y el máximo se calculan en el array ya recortado y remuestreado. Normalizar el GeoTIFF global exigiría recorrerlo entero.

6. **A* no pagina celdas.** Cuando `marcarObstaculos` y `buscarRuta` arrancan, la grilla cabe en un `Float32Array` por banda. Si no cabe, se baja `maxLado` en el parser. No se añade un A* por teselas: el md pide teselas para la lectura, y no describe cómo se cosería el camino entre teselas.
