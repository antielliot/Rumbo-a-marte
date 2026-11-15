# Bitácora de cambios — Motor de rutas en Marte

Resumen simple de cada cambio. Hora del Pacífico (PST). Lo más nuevo va arriba.

Cada entrada indica qué agente hizo el cambio. Hasta la entrada de las 17:09, los cambios de hoy los hizo **Claude** (Anthropic): Opus 5.5 hasta las 14:59 y Sonnet 5.5 después. Las entradas de las 17:31 y las 18:04 las hizo **Grok**. La entrada del 2026-11-15 09:16 la hizo **Claude** (Opus 5.5).

---

## 2026-11-15 09:16 — Rumbo Marte integrado: caminata, reloj, HUD, seguridad y traje

**Agente:** Claude (Opus 5.5)

Se juntó el proyecto **Rumbo Marte** (antes una app aparte, con servidor y terreno inventado) con esta app. Todo corre **en el navegador, sin servidor**, como pide `ARQUITECTURA.md`, y **sobre los datos reales de Gale**. El terreno inventado de Rumbo Marte se descartó.

**Qué se agregó (panel derecho):**

- **Caminata simulada** sobre la ruta A*: el astronauta avanza a 2.7 km/h (`CONST.WALK_KMH`). En cada celda lee del DEM la pendiente, la radiación (`dem.rad`, modelo Guo), la línea de vista con la base y las dunas del USGS; de la MCD, la temperatura y la presión; y la posición del Sol. Al salir, la ruta **se congela** (A* se recalcula cuando cambia la hora y el astronauta no debe saltar de camino).
- **Reloj OLED sin táctil** con 4 botones (PÁG, ▲, ▼, OK) y teclado (`P`, flechas, `Enter`, `H`). Páginas NAV (flecha, distancia, siguiente giro de "Por qué esta ruta"), POS, SEG y EVA (iniciar, pausar, ir al refugio, velocidad, terminar).
- **Visor HUD** a pantalla completa: cinta de rumbo con destino, refugio, base, cima del Monte Sharp (máximo del DEM) y última posición de Curiosity (recorrido NASA/JPL). En alerta roja la flecha apunta al refugio y OK te lleva.
- **Seguridad:** estado EVA verde, ámbar o rojo con razones, margen de regreso de O₂ (*walkback* de Apolo), dosis de la caminata, tormenta solar, tormenta de polvo, consulta a **NASA DONKI** y bitácora de dosis por sol.
- **Traje:** 13 o 14 chequeos con las condiciones de la caminata; compara un traje lunar (AxEMU) con un concepto marciano. Retraso de comunicación Tierra–Marte.
- **Evaluador del equipo** (hoja "Comparador de rutas") aplicado a la ruta A*, ida y vuelta.
- Botón **"Salir desde la base"**, capa de **pendiente** y una línea que dice qué tan real es cada capa.
- **Instalable (PWA):** manifiesto, service worker (guarda la interfaz y los datos de `public/data`) e iconos. Scripts `install` e `iniciar` (`.sh` y `.bat`) en la raíz.

**Archivos nuevos:** `app/src/lib/` → `eva.js`, `useEva.js`, `suit.js`, `seguridad.js`, `routeEvaluator.js`, `radiationLog.js`, `marsData.js`, `donki.js` y sus pruebas (`*.test.js`). `app/src/components/eva/` → `Watch.jsx`, `Hud.jsx`, `EvaPanel.jsx`, `SuitPanel.jsx`, `Arrow.jsx`, `shared.js`, `keys.js`, `eva.css`. `app/public/` → `manifest.webmanifest`, `sw.js`, `icons/`. Raíz → `install.*`, `iniciar.*`, `docs/` (documentos de investigación de Rumbo Marte).

**Archivos del equipo que se tocaron (poco):**

| Archivo | Cambio |
| --- | --- |
| `App.jsx` | Monta el hook de caminata y el panel derecho; botón "Salir desde la base"; capa de pendiente; en celular la página hace scroll y el mapa tiene alto fijo (antes podía quedar en 0 px). |
| `MapView.jsx` | Capa `slope`; dibuja el plan congelado (verde) y al astronauta (triángulo con su rumbo y color de estado). |
| `vite.config.js` | `envDir: '..'`: el `.env` del README está en la raíz y Vite lo buscaba en `app/`, así que `VITE_NASA_API_KEY` no llegaba. |
| `index.html`, `main.jsx` | Título, idioma `es`, manifiesto y registro del service worker (solo en `build`). |
| `package.json` | `vitest` y el script `npm test`. |

**Constantes unificadas** (antes cada módulo traía las suyas):

| Valor | Antes en Rumbo Marte | Ahora |
| --- | --- | --- |
| Pendiente máxima | 15° (evaluador, `seguridad`) y 30° (traje) | `CONST.MAX_SLOPE_DEG` (20°) en todos |
| Velocidad a pie | 2 km/h (evaluador), 4 km/h (simulador viejo) | `CONST.WALK_KMH` (2.7 km/h) |
| Radiación de superficie | 0.64 mSv/día fija | `dem.rad` del modelo del equipo (0.64 solo si falta `rad`) |
| Tormenta de polvo | τ 3.4 | τ 4.5: rojo en EVA (≥3), traje (≥4) y evaluador (≥4) |

**Pruebas:** `npm test` en `app/`: 18 pruebas (simulador, evaluador de rutas, traje y margen de regreso). Las del evaluador comprueban los números de la hoja con sus valores originales (2 km/h, 15°) y aparte que la app usa los del proyecto.

**Para el plan de migración (GeoTIFF):** la caminata solo necesita `w`, `h`, `cellM`, `elev`, `slope` y `lonLat()`. Si se quitan `rad`, `visible`, `sandRisk` o `baseCell`, sigue funcionando (hay una prueba para eso): usa la tasa medida por RAD, deja de avisar de comunicación o dunas y el único refugio es el punto de salida.

**Supuestos nuevos (marcados en el código):** tormenta solar ×8 y refugio al 15% de la dosis; O₂ de 8 h (AxEMU) con consumo según la pendiente (Minetti); batería de 900 Wh y 100 W; perclorato 0.5 %; aviso de tormenta de 30 min. El punto de salida se trata como hábitat o rover presurizado.

---

## 2026-11-14 18:04 — Plan de migración (sin cambios de código)

**Agente:** Grok

Nuevo `Agents/plan_de_migracion.md`: brecha entre el prototipo de Gale y el motor A* con GeoTIFF, archivos a refactorizar, módulos nuevos (`parser_tiff.mjs`, `normalizar.mjs`, `heuristica_astar.mjs`) y límites de memoria. Los puntos donde el md de arquitectura no fija una fórmula o contradice el código quedan escritos como supuestos. No se modificó código fuente.

---

## 2026-11-14 17:31 — Documentación del pivot global (A* + GeoTIFF)

**Agente:** Grok

Los documentos de descripción quedan alineados con el motor de hackathon: rutas A* en cualquier ventana de Marte, no solo en el cráter Gale.

**Capas de la heurística:** percloratos (Mars Odyssey GRS), radiación (Curiosity RAD y MGS MAG/ER, con elevación MOLA), temperatura (THEMIS), relieve (MOLA, obstáculo por pendiente mayor a 15–20°) e inercia térmica (THEMIS o TES).

**Procesamiento:** GeoTIFF pesados en módulos `.mjs`, librería `geotiff` (`npm install geotiff` en `app`), normalización de cada matriz a `[0, 1]` antes de los pesos del usuario, y lectura por teselas tras recorte y downsampling.

**Archivos:** `README.md`, `Agents/ARQUITECTURA.md`, `Agents/FEATURES_DISPONIBLES.md`, `Agents/featuresImplementar.md`, `Agents/contexto_datasets_nasa.md`.

El prototipo de Gale (fetches fijos y pesos fijos) queda descrito como línea base, no como arquitectura objetivo. No se tocó código.

---

## 2026-11-14 17:09 — Documentos del proyecto

**Agente:** Claude

Tres archivos nuevos en `Agents/`:

- `ARQUITECTURA.md`: cómo está armado el proyecto (carpetas, datos, scripts, código y cálculo de la ruta).
- `FEATURES_DISPONIBLES.md`: lo que ya funciona hoy.
- `featuresImplementar.md`: lo que falta por hacer (vacío por ahora).

---

## 2026-11-14 14:59 — Todos los factores normalizados de 0 a 1

**Agente:** Claude

**Antes:** cada factor tenía una escala inventada por nosotros (radiación ×8, dunas ×6, rugosidad ×4, comunicación ×2). El esfuerzo iba de 0 a ~5.

**Ahora:** todos van de **0 (ideal) a 1 (lo peor)** y se quitaron las escalas.

- Esfuerzo: 0 = bajada suave, 1 = subir a 20° (nuestro límite). Caminar en plano ≈ 0.12.
- Radiación, dunas, comunicación y rugosidad ya iban de 0 a 1; solo se quitó el multiplicador.

**Cómo leerlo:** costo de cada metro = 1 + Σ peso × riesgo. Con peso 1, lo peor de un factor hace que ese metro cueste **el doble**.

**Efecto en la comparación con Curiosity** (distancia media, con "Evitar dunas"):

|                     | Antes   | Ahora       |
| ------------------- | ------- | ----------- |
| Sol 1500, DEM 50 m  | 0.27 km | **0.18 km** |
| Sol 1500, DEM 200 m | 0.38 km | **0.25 km** |
| Sol 5073, DEM 50 m  | 1.04 km | **0.39 km** |
| Sol 5073, DEM 200 m | 0.38 km | 0.42 km     |

Sin dunas casi no cambia (solo cuenta el relieve).

---

## 2026-11-14 14:55 — Corregidos 2 errores en las distancias de Curiosity

**Agente:** Claude

En los datos de la NASA, dos soles tenían la distancia mal (**sol 1257 = 0 km** y **sol 3708 = 39.37 km**). Al cortar el recorrido en esos soles, la ruta de Curiosity salía vacía o completa. Ahora esos dos valores se descartan (`fetch-curiosity.mjs` y `curiosity-traverse.json`).

---

## 2026-11-14 14:27 — La arena ahora viene del USGS (base de datos global de dunas)

**Agente:** Claude

**Antes:** la arena era **estimada por nosotros** (zonas oscuras y lisas en la foto HiRISE). Solo cubría la zona de Curiosity.

**Ahora:** usamos los **campos de dunas oficiales del USGS** (Mars Global Digital Dune Database, 2007). Cubren **todo el cráter**:

- **1370-050**: incluye las dunas **Bagnold** (las que cruzó Curiosity), 425 km².
- **1376-059**: arco de dunas al sur, 414 km².

**Cómo se usa:** cada celda sabe qué parte cae dentro de un campo de dunas. Cruzar dunas **cuesta más**, pero **no está prohibido** (Curiosity las cruzó).

**Ojo:** el USGS marca el **contorno** del campo, no cada duna. Dentro también hay roca.

**Efecto en la comparación con Curiosity** (distancia media a su recorrido):

|                     | Sin dunas | Con dunas USGS |
| ------------------- | --------- | -------------- |
| Sol 1500, DEM 50 m  | 0.15 km   | 0.27 km        |
| Sol 5073, DEM 50 m  | 1.05 km   | 1.04 km        |
| Sol 5073, DEM 200 m | 1.09 km   | **0.38 km**    |

A 200 m (todo el cráter), evitar las dunas acerca mucho nuestra ruta a la de Curiosity.

**Quitado:** el mapa de arena estimado (`fetch-sand`, `gale50-sand.u8`).

---

## 2026-11-14 14:20 — Prueba: ¿THEMIS de noche sirve para detectar arena? → No (sin cambios en la página)

**Agente:** Claude

**Qué probamos:** el mosaico THEMIS-IR de noche (USGS, 100 m) en todo Gale, comparado con las dunas Bagnold que ya conocemos.

**Idea:** de noche la arena suelta se enfría más rápido que la roca → debería verse más **oscura**.

**Resultado:** pasa lo **contrario**. Las dunas Bagnold se ven **más tibias (claras)** que el terreno de alrededor:

- En dunas: valor medio **177** (escala 0–255).
- Fuera de dunas: valor medio **148**.
- Los rangos se mezclan mucho (dunas 122–240, resto 103–184).

**Por qué:** la arena de Bagnold es **gruesa y sin polvo**, y guarda bastante calor. El llano de alrededor está cubierto de **polvo fino**, que se enfría más. Además, USGS aclara que este mosaico es **solo visual** (valores estirados y mezclados), no temperatura real.

**Conclusión:** con THEMIS de noche no se puede decir "frío = arena". No lo agregamos.

---

## 2026-11-14 14:12 — ¿Por qué la ruta ahora se va por el otro lado?

**Agente:** Claude

**Qué se ve:** en la comparación con Curiosity, nuestra ruta (cian) ahora se va por el **lado este** de la línea recta, y Curiosity (rosa) por el **oeste**. Antes nuestra ruta también se iba por el oeste, cerca de Curiosity.

**Causa:** en el cambio de las 13:33 quitamos la **"ladera de lado"** (era un supuesto nuestro).

|                         | Antes (13:13)         | Ahora (13:33) |
| ----------------------- | --------------------- | ------------- |
| Subidas (esfuerzo)      | ✅                    | ✅            |
| Ladera de lado          | ✅ (supuesto nuestro) | ❌ quitada    |
| Pendiente > 20° bloquea | ✅                    | ✅            |
| Arena (si se activa)    | ✅                    | ✅            |

**Por qué cambia el lado:**

- En "solo relieve" el piso del cráter es casi plano, así que **los dos lados cuestan casi lo mismo**.
- Antes, la ladera de lado castigaba un poco el lado este (el terreno ahí está inclinado de lado) → la ruta prefería el oeste.
- Sin ese castigo, solo cuenta **cuánto se sube**: por el este se suben ~24 m menos → la ruta se va al este. Eso dice el marcador ①.
- Es una diferencia **muy pequeña** (24 m de subida en ~9 km): cualquier ajuste mínimo cambia el lado.

**Comprobado** (DEM 200 m, sin arena, Curiosity hasta el sol 1700):

- Antes: se desviaba al **oeste** (motivo: ladera de lado).
- Ahora: se desvía al **este** (motivo: "ir derecho sube 24 m más").
- Con el DEM de **50 m** sin arena pasa lo mismo: se va al **este** (por ahí se suben ~30 m menos).
- Con **"Evitar arena"** activado vuelve al **oeste**, cerca de Curiosity (a 200 m se desvía ~1 km para no cruzar ~1.1 km de dunas). **La arena es lo que empuja hacia el lado de Curiosity**, igual que en la realidad.

**Conclusión:** no es un error. Con solo relieve, el terreno no da una razón fuerte para ir por un lado u otro (unos 24–30 m de subida de diferencia). Para comparar con Curiosity conviene activar **"Evitar arena"**.

---

## 2026-11-14 13:33 — Limpieza de código (`e6113f2`)

**Agente:** Claude

- Quitada la **ortofoto** de la página.
- Quitada la **ladera de lado** (era un supuesto).
- La **sombra** ya no cuenta en la ruta; solo es una capa visual y se calcula solo si la miras.
- Borrado código que no se usaba.

## 2026-11-14 13:13 — Explicación de los giros (`ef3df2b`)

**Agente:** Claude

- Ahora es **clic en inicio + clic en destino** (antes: arrastrar).
- Cada giro tiene un **número** y una **frase** que dice por qué (pendiente, subida, arena…).
- Al tocar un número se ve en rojo el **camino recto que se descartó**.

## 2026-11-14 12:56 — Mejoras a la comparación con Curiosity (`3acafd5`)

**Agente:** Claude

- **Corte por sol:** comparar solo hasta cierto día de la misión.
- **DEM de 50 m** en la zona de Curiosity (más detalle).
- **Mapa de arena** estimado con la foto HiRISE (solo zona de Curiosity).

## 2026-11-14 12:33 — Comparación con Curiosity (`fa1fcec`)

**Agente:** Claude

- Casilla para ver el **recorrido real de Curiosity** (datos NASA/JPL).
- En ese modo nuestra ruta usa **solo el relieve**.
- Métricas: qué tan lejos queda nuestra ruta de la de Curiosity.

## 2026-11-14 12:22 — Opciones al final (`97bfc85`)

**Agente:** Claude

- Estación y actividad solar movidas a un desplegable **"Opciones"** al final.

## 2026-11-14 12:20 — Mapa parejo (`94d88de`)

**Agente:** Claude

- El mapa base por defecto es el **relieve** (la ortofoto solo cubría una parte).

## 2026-11-14 12:17 — Cráter completo (`b18da8e`)

**Agente:** Claude

- El mapa ahora cubre **todo el cráter Gale** (DEM de 200 m).
- La línea de vista con la base ya considera la **curvatura de Marte**.

## 2026-11-14 12:09 — Barra lateral más limpia (`8e9f071`)

**Agente:** Claude

- Letra más legible, secciones agrupadas, mapa y curva de temperatura plegables.

## 2026-11-14 12:00 — Interfaz más simple (`a438e22`)

**Agente:** Claude

- Pesos de la ruta **fijos** (sin sliders).
- Distancia, tiempo y elevación en una tarjeta **arriba a la derecha** del mapa.
- Etiqueta **"BASE"** en el triángulo.
