# Arquitectura — Motor de rutas en Marte

El sistema calcula una ruta de superficie con A* sobre una ventana cualquiera de Marte. El costo sale de cinco capas GeoTIFF de la NASA, normalizadas y ponderadas por el usuario. La extensión deja de ser una constante del cráter Gale: Gale es solo una ventana posible.

La interfaz sigue siendo la aplicación web (React, Vite, OpenLayers). La preparación de las capas y la grilla de costo se hacen en JavaScript con módulos ES (`.mjs`) y la librería `geotiff`.

## Escala

Los datasets de esta heurística son productos globales:

- MOLA cubre la topografía del planeta.
- Mars Odyssey GRS cubre la distribución de cloro.
- MGS MAG/ER cubre el magnetismo cortical.
- THEMIS (y TES, para inercia) cubren temperatura e inercia térmica a escala orbital.

La consulta define la ventana (longitud, latitud y resolución de trabajo). El motor recorta y remuestrea esa ventana, alinea las capas a la misma grilla y ejecuta A* ahí. Un archivo global de hasta unos 46 000 × 23 000 píxeles no entra entero en RAM: hace falta recorte, downsampling y lectura por teselas.

## Stack

- React 19 + Vite + Tailwind v4, para la interfaz y los pesos.
- OpenLayers y proj4, para el mapa y las proyecciones de Marte.
- Chart.js, para perfiles a lo largo de la ruta.
- Node.js con ES Modules (`.mjs`).
- `geotiff`, instalada con `npm install geotiff` dentro de `app`.

## Estructura del repositorio

```
NASASPACECUCKS/
├── Agents/                 Contexto de datasets, arquitectura, features y bitácora
├── README.md               Escala, requisitos, capas y fórmula de costo
└── app/
    ├── public/data/        Ventanas ya preparadas para el navegador
    ├── scripts/            Lectura y preparación en Node (`.mjs`)
    └── src/
        ├── lib/            Búsqueda (route, dem, explain…) y caminata (eva, useEva, suit, seguridad…)
        └── components/     Mapa y paneles; components/eva/ = reloj, HUD, seguridad y traje
docs/rumbo-marte/           Investigación de Rumbo Marte: riesgos, radiación, trajes, reto B
install.* · iniciar.*       Instalación y arranque (vite build + vite preview)
```

## Flujo

```
GeoTIFF NASA (GRS, RAD/MAG-ER, THEMIS, MOLA, TES)
        │
        ▼
recorte + downsampling + teselas
        │
        ▼
lectura con geotiff (.mjs) → matriz por capa
        │
        ▼
mínimo/máximo → normalización [0, 1] orientada a costo
        │
        ▼
pesos de la interfaz + pendiente MOLA (bloqueo 15–20°)
        │
        ▼
A*  →  ruta sobre la ventana elegida
```

## Capas de la heurística

Cinco variables entran en la decisión. Cuatro son términos ponderados. El relieve, además, cierra celdas.

| Capa | Qué se lee del píxel | Dataset | Papel en \(g(n)\) |
|---|---|---|---|
| Percloratos | Cloro como proxy de \(ClO_4^-\) | Mars Odyssey GRS | \(V_{corr} \cdot P_{corr}\). Más concentración, más costo |
| Radiación | Exposición (GCR y SPE) | Curiosity RAD + MGS MAG/ER, con la cota de MOLA | \(V_{rad} \cdot P_{rad}\). Más altura y menos magnetismo, más costo |
| Temperatura | Fluctuación térmica (temporada, latitud, altitud) | THEMIS | \(V_{temp} \cdot P_{temp}\). Más extremo, más costo |
| Inercia térmica | Arena suelta frente a roca | THEMIS o TES | \(V_{suelo} \cdot P_{suelo}\). Inercia baja, más costo |
| Relieve | Elevación y pendiente | MOLA | Pendiente > 15–20°: costo infinito. La cota alimenta radiación y el gradiente térmico |

## Costo

\[
f(n) = g(n) + h(n)
\]

\[
Costo = (V_{temp} \cdot P_{temp}) + (V_{rad} \cdot P_{rad}) + (V_{corr} \cdot P_{corr}) + (V_{suelo} \cdot P_{suelo})
\]

Cada \(V\) está en `[0, 1]` antes de multiplicar por \(P\). La normalización es en caliente: se toma el mínimo y el máximo de la matriz de esa ventana. Ejemplo de escala cruda: la altitud MOLA, de −8 200 m a +21 200 m, pasa a una penalización de 0 a 1. La inercia se invierte respecto al valor crudo, porque el suelo favorable es la inercia alta.

Una celda sin dato, fuera de la tesela o con pendiente por encima de 15–20° no entra en la suma: A* la trata como obstáculo.

Los pesos \(P_{temp}\), \(P_{rad}\), \(P_{corr}\) y \(P_{suelo}\) los fija el usuario en cada consulta. No hay un juego de pesos escrito solo para Gale.

## Lectura de los GeoTIFF

`geotiff` abre el `.tif` de la ventana de trabajo, toma la imagen y la banda principal, y expone ancho, alto y el valor en \((x, y)\). Esas lecturas son la grilla de A*. Varias capas se cargan de forma asíncrona y se alinean a la misma malla antes de normalizar.

Archivos de varias decenas de miles de píxeles por lado se preparan fuera de este paso (recorte y downsampling, por ejemplo con QGIS). En ejecución, la lectura va por teselas de la ventana pedida.

## Decisiones

- **Ventana, no planeta entero en RAM.** El soporte es global porque la ventana es libre. El ráster residente es el recorte de trabajo.
- **Misma escala antes de ponderar.** Sin la normalización `[0, 1]`, un peso de temperatura no es comparable con uno de cloro o de inercia.
- **Pendiente como muro.** El relieve no compite en la suma con los otros cuatro términos: a partir de 15–20° la celda es intransitable, y la elevación sí modifica radiación y temperatura.
- **Pesos en la interfaz.** La misma grilla puede priorizar traje (percloratos), dosis (radiación), energía térmica o transitabilidad del suelo.

## Transición desde el prototipo de Gale

El código que hoy corre sigue descargando ventanas fijas de Gale (DEM, dunas, temperatura de la Mars Climate Database, recorrido de Curiosity) y calcula A* con factores de ese prototipo: esfuerzo, radiación modelada, rugosidad, comunicación y dunas, con pesos fijos. Esa línea base queda descrita en `FEATURES_DISPONIBLES.md`. El motor de este documento la sustituye: GeoTIFF globales, cinco capas de esta heurística, normalización por matriz y pesos elegidos por el usuario. El trabajo pendiente está en `featuresImplementar.md`.

## Capa de caminata (Rumbo Marte)

Encima del motor de rutas hay una capa de operación que **no participa en el costo de A***. Toma la ruta ya calculada y simula a un astronauta recorriéndola, con reloj, HUD y alertas. Sigue sin haber servidor: el simulador corre con `setInterval` en el navegador y DONKI se consulta directo a `api.nasa.gov` (permite CORS).

```
ruta A* (cells) + why (giros) ──► useEva: congela el plan al salir
                                   │
dem (elev, slope, rad, visible,    ▼
sandRisk, baseCell) + MCD ──► eva.js: posición, lecturas por celda, estado EVA, margen de regreso
                                   │
                                   ├─► Watch / Hud / EvaPanel / SuitPanel
                                   ├─► routeEvaluator (ida y vuelta) y radiationLog (por sol)
                                   └─► App: la hora de la app sigue al reloj de la caminata (pasos de 2 h)
```

**Contrato con la malla.** `eva.js` solo exige `w`, `h`, `cellM`, `elev`, `slope` y `lonLat(x, y)`. `rad`, `visible`, `sandRisk` y `baseCell` son opcionales, para que el plan de migración a GeoTIFF no la rompa: sin `rad` usa la tasa de RAD (0.64 mSv/día) de `marsData.js`.

**Constantes.** La caminata, el evaluador de rutas y el traje leen la pendiente máxima y la velocidad de `constants.js`; no hay un segundo juego de límites.

