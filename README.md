# Rumbo a Marte

Proyecto del equipo para el NASA Space Apps Hackathon (reto *Interplanetary Survival Guide: Martian Map*). Es el motor de rutas **Mars Route** sobre el relieve real del cráter Gale, con la capa de caminata de **Rumbo Marte**: reloj OLED de 4 botones, visor HUD, seguridad (radiación, clima espacial, margen de regreso) y evaluación del traje.

## Cómo correrlo

**En Visual Studio Code** (Node 20.19 o superior; el equipo usa 24):

1. Abre la carpeta del repo.
2. En la terminal: `npm install` (instala también lo de `app/`) y luego `npm run dev`. Abre http://localhost:5173.
3. O sin terminal: **F5** ("Rumbo a Marte (Chrome)") arranca el servidor y abre el navegador. En *Terminal → Ejecutar tarea* están "instalar", "correr" y "pruebas".

**En GitHub, sin instalar nada:**

- **Codespaces:** botón verde *Code → Codespaces → Create codespace on main*. Instala todo y abre la app en una pestaña.
- **GitHub Pages:** una sola vez, *Settings → Pages → Source: GitHub Actions*. Desde entonces cada push a `main` corre las pruebas y publica la app en `https://<usuario>.github.io/<repo>/`.

Otros comandos desde la raíz: `npm test` (18 pruebas), `npm run build`. Detalle de lo que se combinó: `Agents/CAMBIOS.md`.

---

# NASA Space Apps — Motor de rutas en Marte

Sistema de rutas óptimas sobre la superficie de Marte. El costo de cada celda sale del algoritmo A* y de capas GeoTIFF (`.tif`) de la NASA. El usuario asigna el peso de cada variable en la interfaz.

La malla no está fija en el cráter Gale. Gale puede usarse como ventana de ejemplo. La extensión geográfica es un parámetro: cualquier región de Marte cuyos rásteres quepan en memoria tras recorte, reducción de resolución y lectura por teselas.

## Requisitos

- Git
- Node 24 (en Mac/Linux: `nvm use`; en Windows: nvm-windows o el instalador de nodejs.org)
- Un editor
- Procesamiento de GeoTIFF pesados con la librería `geotiff`, en módulos ES (`.mjs`)
- Normalización de cada capa a una escala común `[0, 1]` antes de aplicar los pesos

Los productos originales de la NASA llegan a unos 46 000 × 23 000 píxeles. El motor trabaja con archivos ya recortados a la ventana de interés y reducidos de resolución (por ejemplo en QGIS), y los lee por teselas. Un mapa global completo no se carga de una vez en RAM.

Instalación de la librería de lectura, dentro de `app`:

```bash
npm install geotiff
```

`npm install` en `app` también la trae: `geotiff` ya figura en las dependencias de desarrollo del proyecto.

## Arrancar

1. `git clone https://github.com/AHHMED-J/NASASPACECUCKS.git && cd NASASPACECUCKS`
2. `cp .env.example .env` (en Windows: `copy .env.example .env`) y rellena las claves pedidas por el chat privado.
3. `cd app && npm install && npm install geotiff && npm run dev`
4. Abre http://localhost:5173

## Instalar sin línea de comandos

En la raíz: `install.sh` / `install.bat` (instala y compila) y luego `iniciar.sh` / `iniciar.bat` (abre http://localhost:4173). Con la app abierta, Chrome o Edge permiten **instalarla** como app (PWA): la interfaz y los datos de Gale quedan guardados para abrirla sin red. Los mosaicos de NASA Trek y DONKI sí necesitan internet.

Pruebas: `cd app && npm test` (vitest).

## Caminata y seguridad (Rumbo Marte)

Panel derecho de la app. Sobre la ruta A* simula a un astronauta caminando y le da lo que necesita para volver con vida:

- **Reloj OLED sin pantalla táctil** con 4 botones físicos (PÁG, ▲, ▼, OK), porque los guantes presurizados no permiten pantallas táctiles. En el teclado: `P`, flechas, `Enter`, `H`.
- **Visor HUD** del casco (tecla `H`): rumbo, flecha al destino o al refugio, estado y consumibles, sin bajar la vista.
- **Estado EVA** verde, ámbar o rojo, con radiación del modelo del equipo, temperatura de la MCD, línea de vista con la base, dunas USGS, Sol, polvo y **margen de regreso** de O₂.
- **Tormenta solar** (manual o confirmada con **NASA DONKI**) y **tormenta de polvo**.
- **Traje lunar contra traje marciano** en las condiciones de la caminata.

Recorrido para la demo: **Salir desde la base** → clic en un destino a unos 8 km → en el reloj `P` hasta EVA y `Enter` → activa la **tormenta solar** → `H` para el visor → `Enter` para ir al refugio.

Lo que es supuesto (marcado en `app/src/lib/eva.js`): tormenta solar ×8, refugio al 15 %, O₂ de 8 h con consumo según la pendiente, batería de 900 Wh a 100 W, perclorato 0.5 %. Los umbrales del traje son de demostración: ajustarlos con NASA-STD-3001.

Para la presentación: por qué OLED (las LCD comunes no aguantan el frío ni el vacío; el negro no gasta energía), botones físicos, HUD, vidrio de zafiro o de baja expansión térmica, sellos de baja emisión de gases y alertas calculadas en el traje por el retraso de 3 a 22 minutos con la Tierra. Investigación completa en `docs/rumbo-marte/`.

## Reglas

- Instalar paquetes con `npm install <paquete>` y hacer commit de `package.json` y `package-lock.json`. El lockfile no se borra.
- Tras un pull con dependencias nuevas: `npm install`.
- Nunca subas `.env`. Las variables `VITE_*` son visibles en el navegador: no pongas secretos ahí.
- Nombres de archivo con mayúsculas exactas (`Header.jsx` se importa como `./Header`).

## Capas de la heurística A*

Cada variable es un ráster alineado a la misma grilla. El valor de celda se normaliza a `[0, 1]` (0 favorable, 1 costoso) con el mínimo y el máximo de esa matriz, y después se multiplica por el peso que eligió el usuario.

| Capa | Variable | Dataset | Efecto en A* |
|---|---|---|---|
| Percloratos | Concentración de percloratos (\(ClO_4^-\)), a partir de los mapas de cloro | Mars Odyssey GRS (Gamma Ray Spectrometer) | Más cloro → más costo (oxidante tóxico y corrosivo para el traje) |
| Radiación | Exposición a GCR y SPE. La elevación aproxima el espesor de atmósfera; el magnetismo cortical es un escudo local | Curiosity RAD (referencia medida) y MGS MAG/ER (Mars Global Surveyor Magnetometer) | Más elevación y menos magnetismo → más costo |
| Temperatura | Fluctuación térmica. El gradiente combina temporada, latitud y altitud | THEMIS (Thermal Emission Imaging System) | Temperaturas extremas → más costo |
| Relieve | Elevación y pendiente (slope) | MOLA (Mars Orbiter Laser Altimeter) | Pendiente mayor a 15–20° → costo infinito (celda intransitable). La cota también entra en el término de radiación |
| Inercia térmica | Transitabilidad del suelo: arena suelta o roca | THEMIS o TES | Inercia baja (arena o polvo, riesgo de hundimiento) → más costo. Inercia alta (roca) → menos costo |

La elevación MOLA va de unos −8 200 m a +21 200 m. Ese rango, como el resto de capas, se traduce a una penalización de 0 a 1 antes de ponderar. La pendiente no es un peso más: por encima del umbral la celda queda fuera del grafo.

## Costo de la ruta

\[
f(n) = g(n) + h(n)
\]

\(g(n)\) acumula el costo de las celdas ya recorridas. En una celda transitable:

\[
Costo = (V_{temp} \cdot P_{temp}) + (V_{rad} \cdot P_{rad}) + (V_{corr} \cdot P_{corr}) + (V_{suelo} \cdot P_{suelo})
\]

\(V\) es el valor normalizado de 0 a 1. \(P\) es el peso de la interfaz. \(V_{suelo}\) sale de la inercia térmica, orientada para que la arena pese más que la roca. \(V_{rad}\) combina la elevación (menos atmósfera) y el magnetismo cortical (menos campo, más exposición), con Curiosity RAD como ancla de la magnitud.

## Stack

- Interfaz: React 19, Vite, Tailwind v4, OpenLayers, proj4, Chart.js.
- Datos y búsqueda: JavaScript en ES Modules (`.mjs`), Node, librería `geotiff` (`npm install geotiff`).
- Lectura: ancho, alto y valor de cada píxel de la banda principal del `.tif`, para consultar la celda \((x, y)\) durante A*.
- Normalización en caliente: mínimo y máximo de cada matriz cargada, escala `[0, 1]`, con el sentido de costo de esa capa.
- Memoria: recorte previo, downsampling y tiling. Los `.tif` de trabajo son ventanas reducidas, no el ráster global crudo.

El detalle de datasets, la fórmula y las reglas de memoria están en `Agents/contexto_datasets_nasa.md`. La estructura del motor y de la capa de caminata está en `Agents/ARQUITECTURA.md`.
