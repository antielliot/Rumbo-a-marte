# Contexto y requerimientos: motor de rutas en Marte (NASA Space Apps)

Documento de referencia del pivot. La búsqueda A* usa capas GeoTIFF de la NASA sobre una ventana cualquiera del planeta. El cráter Gale no es el dominio del sistema: puede ser una ventana de prueba, igual que cualquier otro sector.

## 1. Objetivo

Calcular rutas óptimas en la superficie de Marte con A*. El costo de la ruta combina variables ambientales y geológicas leídas de datasets reales en GeoTIFF (`.tif`). El usuario asigna un peso a cada variable en la interfaz.

La cobertura de los productos es global (MOLA, GRS, MAG/ER, THEMIS, TES). La ventana de cálculo es un parámetro. Los archivos originales llegan a unos 46 000 × 23 000 píxeles, así que la ventana se recorta, se reduce de resolución y se lee por teselas. El mapa planetario crudo no se carga de una vez en RAM.

## 2. Variables y datasets

Cada variable es una capa ráster de la grilla de navegación. Tras la lectura, cada capa se normaliza a `[0, 1]` (0 favorable, 1 costoso) antes de aplicar el peso.

### A. Percloratos (salud del traje)

- **Variable:** concentración de percloratos (\(ClO_4^-\)). Son oxidantes tóxicos y corrosivos. La capa usable es la distribución de cloro.
- **Dataset:** **Mars Odyssey GRS (Gamma Ray Spectrometer)**.
- **Impacto en A*:** mayor concentración, mayor costo.

### B. Radiación (GCR y SPE)

- **Variable:** exposición a radiación. A menor elevación hay más atmósfera protectora. El magnetismo cortical ofrece escudos locales.
- **Dataset:** **Curiosity RAD** (magnitud de referencia) y **MGS MAG/ER (Mars Global Surveyor Magnetometer)** para el magnetismo cortical. La elevación sale de **MOLA**.
- **Impacto en A*:** mayor elevación y menor magnetismo, mayor costo.

### C. Temperatura

- **Variable:** fluctuación térmica.
- **Dataset:** **THEMIS (Thermal Emission Imaging System)**. El gradiente combina temporada, latitud y altitud.
- **Impacto en A*:** temperaturas extremas, mayor costo.

### D. Relieve (pendiente)

- **Variable:** elevación y grados de inclinación.
- **Dataset:** **MOLA (Mars Orbiter Laser Altimeter)**. La pendiente se deriva de la elevación. Rango de cota de referencia: −8 200 m a +21 200 m, que pasa a una penalización de 0 a 1 cuando la cota se usa como capa continua.
- **Impacto en A*:** pendiente mayor a 15–20°, costo infinito (obstáculo intransitable). La cota también alimenta radiación y el gradiente térmico.

### E. Inercia térmica (transitabilidad)

- **Variable:** inercia térmica. Distingue arena suelta (riesgo de hundimiento) de roca sólida.
- **Dataset:** **THEMIS** o **TES**.
- **Impacto en A*:** inercia baja (arena o polvo), mayor costo energético. Inercia alta (roca), menor costo. En la fórmula entra como \(V_{suelo}\).

## 3. Lógica del algoritmo A*

\[
f(n) = g(n) + h(n)
\]

\(g(n)\) suma el costo desde el origen hasta el nodo actual. Integrar las capas en \(g(n)\) exige normalizar cada GeoTIFF a `[0, 1]` antes de los pesos. La normalización es en caliente: mínimo y máximo de la matriz de esa ventana, y el sentido de la capa (en la inercia térmica, el valor crudo alto es el suelo favorable, así que la penalización va al revés).

**Costo de una celda transitable:**

\[
Costo = (V_{temp} \cdot P_{temp}) + (V_{rad} \cdot P_{rad}) + (V_{corr} \cdot P_{corr}) + (V_{suelo} \cdot P_{suelo})
\]

\(V\) es el valor normalizado de 0 a 1. \(P\) es el peso de la interfaz. El relieve no añade un quinto sumando: por encima de 15–20° la celda no se evalúa, y su elevación ya participa en \(V_{rad}\) y en la temperatura.

## 4. Stack y procesamiento

- **Entorno:** JavaScript / Node.js con ES Modules (`.mjs`).
- **Lectura de ráster:** librería `geotiff`.
- **Instalación:** dentro de `app`, `npm install geotiff`.

La lectura de un `.tif` de trabajo entrega ancho, alto y el valor de la banda principal en cada celda \((x, y)\), para que A* consulte la grilla sin asumir un recorte de Gale. Varias capas se cargan de forma asíncrona, se alinean a la misma malla y se normalizan por separado.

### GeoTIFF pesados

1. Los `.tif` de archivo (hasta ~46 000 × 23 000) se recortan a la ventana y se bajan de resolución antes de la búsqueda (QGIS u otra herramienta de remuestreo).
2. En ejecución, la lectura es por teselas de esa ventana. No se materializa el planeta entero en una sola matriz.
3. Cada matriz residente se normaliza con su propio mínimo y máximo. La altitud MOLA (−8 200 m a +21 200 m) es el caso de escala: un metro de cota no se suma con un conteo de cloro ni con un valor de inercia.

## 5. Pipeline

1. Cargar los `.tif` de la ventana (GRS, RAD/MAG-ER, THEMIS, MOLA, TES) de forma asíncrona.
2. Normalizar cada capa a `[0, 1]` con el sentido de costo de la sección 2.
3. Ejecutar A* sobre las grillas superpuestas, con el objeto de pesos del usuario y con la pendiente MOLA como obstáculo a partir de 15–20°.

El desglose de tareas está en `featuresImplementar.md`. La vista de módulos está en `ARQUITECTURA.md`.
