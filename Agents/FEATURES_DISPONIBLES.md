# Features

Alcance del hackathon: rutas dinámicas en cualquier ventana de Marte, con A* sobre GeoTIFF. Abajo, el contrato de ese motor y, al final, lo que el repositorio todavía ejecuta.

## Escala

- Consulta por ventana geográfica, no por un recuadro fijo del cráter Gale.
- Productos de cobertura global: MOLA, Mars Odyssey GRS, MGS MAG/ER, THEMIS y TES.
- La ventana se recorta, se baja de resolución y se lee por teselas para poder usar archivos que, en bruto, llegan a unos 46 000 × 23 000 píxeles.

## Ruta (A*)

- Inicio y destino sobre la ventana elegida.
- Costo \(f(n) = g(n) + h(n)\).
- Celda transitable:

  \(Costo = (V_{temp} \cdot P_{temp}) + (V_{rad} \cdot P_{rad}) + (V_{corr} \cdot P_{corr}) + (V_{suelo} \cdot P_{suelo})\)

- Cada \(V\) normalizado de 0 a 1 con el mínimo y el máximo de su matriz (0 favorable, 1 costoso).
- Pesos \(P\) definidos en la interfaz para esa consulta.
- Pendiente MOLA mayor a 15–20°: celda intransitable (costo infinito).
- Celdas sin dato quedan fuera del grafo.

## Capas que pesan en la heurística

| Capa | Dataset | Lectura |
|---|---|---|
| Percloratos | Mars Odyssey GRS | Mapas de cloro como proxy de \(ClO_4^-\). Más concentración, más costo |
| Radiación (GCR y SPE) | Curiosity RAD y MGS MAG/ER | Más elevación (menos atmósfera) y menos magnetismo cortical, más costo. La cota sale de MOLA |
| Temperatura | THEMIS | Gradiente por temporada, latitud y altitud. Extremos, más costo |
| Relieve | MOLA | Elevación para radiación y temperatura; pendiente como obstáculo a partir de 15–20°. Rango de cota de referencia: −8 200 m a +21 200 m, pasado a `[0, 1]` |
| Inercia térmica | THEMIS o TES | Inercia baja (arena o polvo), más costo. Inercia alta (roca), menos costo |

## Datos

- Entrada de trabajo: GeoTIFF (`.tif`) de esas misiones, ya recortados y remuestreados.
- Lectura en Node con módulos `.mjs` y `geotiff` (`npm install geotiff` en `app`).
- Normalización en caliente por capa, antes de aplicar pesos.
- Varias capas cargadas de forma asíncrona y alineadas a la misma grilla.

## Interfaz prevista sobre este motor

- Mapa de la ventana consultada.
- Controles de peso: temperatura, radiación, percloratos y suelo (inercia térmica).
- Ruta dibujada entre inicio y destino, con el relieve usado como barrera de pendiente.

## Prototipo que sigue en el repositorio

La rama de demo todavía planea sobre Gale (~311 × 311 km, 136.4–139.2°E / −6.8 a −4.0°N) con fetches a ventanas ya convertidas, no con esta pila de GeoTIFF.

- Mapa de Gale, marcador de Bradbury Landing, capas de radiación modelada, rugosidad, comunicación, dunas USGS y sombras.
- A* con pesos fijos: esfuerzo, radiación, rugosidad, comunicación y dunas, normalizados de 0 a 1, y bloqueo por pendiente mayor a 20°.
- Perfil de elevación, hora y temperatura de la Mars Climate Database (condición temporal, fuera del costo espacial), comparación con el recorrido de Curiosity.
- Scripts actuales: `npm run fetch-dem`, `fetch-dem-1m`, `fetch-dunes`, `fetch-curiosity`, `fetch-mcd`.

Ese prototipo es la línea base. El motor de las secciones anteriores es el que la documentación de arquitectura toma como sistema objetivo. Lo que falta para llegar ahí está en `featuresImplementar.md`.

## Caminata y seguridad (Rumbo Marte)

Capa de operación sobre la ruta A*. No cambia el costo de la ruta: simula a un astronauta recorriéndola y le muestra lo que necesita para volver con vida. Todo en el navegador.

- **Caminata simulada** sobre la ruta A* congelada al salir: 2.7 km/h (`CONST.WALK_KMH`), más lenta con polvo; tiempo acelerado ×60, ×240 o ×900. Al volver a la salida se recargan O₂ y batería.
- **Lecturas por celda:** elevación, pendiente, radiación (`dem.rad`), línea de vista con la base, dunas USGS; temperatura y presión de la MCD a la hora simulada; elevación del Sol.
- **Estado EVA** verde, ámbar o rojo con sus razones. Rojo: 3 mSv/día o más, polvo τ ≥ 3, margen de regreso en rojo o batería bajo 10 %. Ámbar: margen bajo, sin línea de vista, de noche, dunas, a más de 10 km de la base, pendiente mayor a 15° o radiación elevada.
- **Margen de regreso** (*walkback* de Apolo): O₂ restante entre el tiempo para volver por el camino recorrido. Verde desde 1.5×, ámbar desde 1.3×, rojo debajo.
- **Reloj OLED sin táctil:** 4 botones (PÁG, ▲, ▼, OK) y teclado. Páginas NAV, POS, SEG y EVA.
- **Visor HUD** (tecla `H`): cinta de rumbo con destino, refugio, base, cima del Monte Sharp y última posición de Curiosity; en rojo, OK = ir al refugio.
- **Clima espacial:** tormenta solar manual (×8 fuera del refugio), tormenta de polvo (τ 4.5) y consulta a **NASA DONKI** (`VITE_NASA_API_KEY`, o `DEMO_KEY`).
- **Evaluador de rutas** del equipo aplicado a la ruta (ida y vuelta) y **bitácora de dosis por sol**.
- **Traje:** 13 o 14 chequeos (radiación, presión, térmico, O₂, batería, enfriamiento, CO₂, polvo, perclorato, peso aparente, biometría, movilidad, refugio ante tormenta) para un traje lunar o uno marciano; retraso de comunicación Tierra–Marte.
- **Instalable (PWA)** y scripts `install` / `iniciar` en la raíz.

