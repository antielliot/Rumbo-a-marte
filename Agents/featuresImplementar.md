# Por implementar

Paso del prototipo de Gale (fetches de ventanas fijas) al motor global descrito en `contexto_datasets_nasa.md` y `ARQUITECTURA.md`. Sin este trabajo, la app sigue calculando solo el cráter Gale.

## Escala

- Aceptar una ventana cualquiera de Marte (límites y resolución de trabajo) en lugar del recuadro 136.4–139.2°E / −6.8 a −4.0°N.
- Preparar cada GeoTIFF de esa ventana con recorte y downsampling antes de leerlo.
- Leer por teselas. Los rásteres crudos (hasta unos 46 000 × 23 000 píxeles) no se cargan enteros.

## Dependencia

- En `app`: `npm install geotiff`.
- Lectura de `.tif` en módulos ES (`.mjs`), de forma asíncrona, una matriz por capa, con consulta por celda \((x, y)\).

## Capas que tienen que alimentar A*

1. **Percloratos** — Mars Odyssey GRS, mapas de cloro como proxy de \(ClO_4^-\). A más concentración, más costo.
2. **Radiación** — Curiosity RAD como referencia de dosis, MGS MAG/ER como escudo cortical, elevación MOLA como atmósfera. A más altura y menos magnetismo, más costo.
3. **Temperatura** — THEMIS, gradiente de temporada, latitud y altitud. A más extremo, más costo.
4. **Inercia térmica** — THEMIS o TES. Inercia baja (arena o polvo) cuesta más; inercia alta (roca) cuesta menos.
5. **Relieve** — MOLA. Pendiente por encima de 15–20°: celda intransitable. La cota también entra en radiación y temperatura. Rango de referencia −8 200 m a +21 200 m, normalizado a `[0, 1]`.

## Normalización y costo

- Por cada matriz, mínimo y máximo de la ventana cargada, escala `[0, 1]`, sentido de costo de esa capa (la inercia se orienta al revés del valor crudo).
- Pesos de la interfaz: \(P_{temp}\), \(P_{rad}\), \(P_{corr}\), \(P_{suelo}\).
- Celda transitable: \((V_{temp} \cdot P_{temp}) + (V_{rad} \cdot P_{rad}) + (V_{corr} \cdot P_{corr}) + (V_{suelo} \cdot P_{suelo})\).
- Búsqueda A* con \(f(n) = g(n) + h(n)\) sobre esas grillas alineadas.
- Excluir pendiente excesiva, fuera de tesela y sin dato.

## Interfaz

- Controles para los cuatro pesos, aplicados a la consulta en curso.
- La ruta y el mapa corresponden a la ventana pedida, no a una máscara permanente de Gale.

## Qué deja de ser el camino de datos

Los fetches actuales (`fetch-dem`, `fetch-dem-1m`, `fetch-dunes`, `fetch-curiosity`, `fetch-mcd`) y los factores fijos del prototipo (esfuerzo, rugosidad, comunicación, dunas, temperatura solo como escenario horario) no son la heurística de este plan. Siguen en el repo como demo hasta que las cinco capas GeoTIFF cubran la misma búsqueda.
