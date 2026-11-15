# CONTEXTO DEL PROYECTO: RUMBO MARTE (NASA SPACE APPS HACKATHON)

Soy estudiante de Ingeniería de Software y mi equipo participa en el NASA Space Apps Hackathon. Este documento resume el reto, lo que ya está construido y lo que falta, para que continúes desde aquí. Te adjunto rumbo-marte.zip con el código. Responde siempre en español.

## 1. LOS RETOS

### Reto A: Space Mission Design Game (primer reto que revisamos)
Crear un juego interactivo donde se diseña, gestiona y simula una misión espacial completa (individual o en equipos de hasta 4).
- Decisiones: objetivo de misión, nave, instrumentos, lanzador y órbita, con restricciones de presupuesto, masa, potencia, comunicaciones, datos y tiempo de vida.
- Cada decisión debe tener consecuencias (más instrumentos implican más masa, potencia, costo y datos).
- Debe haber simulación, evaluación y retroalimentación que explique POR QUÉ una misión funciona o falla.
- Opcionales: roles en equipo, escenarios, eventos aleatorios, dificultad, tablas de clasificación, informe final, modo libre.
- Recursos NASA dados: Design and Develop Science Missions (segmentos: lanzamiento, espacio, tierra, usuario), GMAT (herramienta de trayectorias), Concept Maturity Levels (JPL), Mission Design Lab, NASA Mission Viz, un juego de telescopios, CubeSat 101, reto VR de 2023 y juegos de la Agencia Espacial Canadiense.

### Reto B: Interplanetary Survival Guide: Martian Map (el que estamos priorizando)
Crear una vista integrada y en capas de un lugar o ruta en la superficie de Marte que combine datos de varias misiones de NASA y ayude a un astronauta a planear y realizar una caminata marciana con seguridad, haciendo ciencia en el camino.
- Entregable: un mapa, herramienta o interfaz que use un astronauta durante una exploración.
- Mínimo tres tipos de datos entre: óptico, térmico, espectral, topográfico, geofísico, atmosférico, radiación, químico.
- Prioridad: la seguridad del astronauta (por ejemplo, el ambiente de radiación de Marte, incluyendo clima espacial).
- Caso sugerido: Lower Mount Sharp (la ruta propuesta de Curiosity por el Monte Sharp, en el cráter Gale).
- Restricciones de hardware que dio el PDF para cualquier pantalla en un traje espacial:
  - Los guantes impiden usar pantalla táctil, así que debe haber botones físicos.
  - Las pantallas de cristal líquido común no aguantan el espacio. Opciones: pantallas emisivas de estado sólido (OLED y Micro-LED), electroluminiscentes (EL), fluorescentes de vacío (VFD), o LCD calentadas y presurizadas.
  - Cristal frontal de baja expansión térmica o zafiro sintético, para resistir cambios bruscos entre sombra helada y sol.
  - Sellos y pegamentos de baja emisión de gases, para no empañar visores ni cámaras.
  - Proyección en el casco (HUD).
- Antecedentes del PDF: las caminatas de Apolo usaban listas de papel en la muñeca; los astronautas de Artemis 3 usarán trajes con 4G.

## 2. DECISIÓN ACTUAL
Priorizamos el Reto B (Martian Map) con la app Rumbo Marte. Una idea para destacar en el Reto A, si se necesita, es entrenar el juicio del ingeniero (calibración de confianza, márgenes, presión de calendario, disidencia en equipo, simulación Monte Carlo para dar probabilidad de éxito en vez de éxito/fallo).

## 3. QUÉ ES RUMBO MARTE (estado del código entregado en el zip)
Stack: React + TypeScript (Vite) en el cliente, Node.js + Express + TypeScript en el servidor, Leaflet para el mapa, telemetría en vivo por SSE. Correr: npm install y luego npm run dev, abrir http://localhost:5173 (Node 18 o superior).

Funciones que YA existen y probé con un navegador sin pantalla (clics reales, sin errores de consola):
- Mapa 2D con relieve sombreado, referencias visuales, lugares y niebla de exploración (el mapa explorado crece al viajar).
- Reloj de astronauta (SVG) con hora solar local de Marte, coordenadas, elevación, pendiente, brújula y flecha al destino.
- Diseño de misión: instrumentos y batería con límites de masa, presupuesto y autonomía. Cada instrumento detecta un tipo de recurso distinto, así que el diseño cambia qué se ve.
- Recomendador y buscador de lugares con puntaje (popularidad, recursos detectables, acceso por energía, seguridad) y explicación en texto.
- Rutas con A* que evitan pendientes de más de 30 grados, con margen de energía del 20 por ciento e indicaciones por referencias visibles (línea de visión sobre el relieve).
- Simulador de la unidad (tiempo acelerado x240): gasta batería, descubre mapa, registra visitas.
- Exportación CSV y GeoJSON de los lugares.

Estructura del servidor (server/src): catalog.ts (instrumentos y reglas), dataset.ts (terreno y lugares), nav.ts (A*), vision.ts (línea de visión), rank.ts (recomendador), state.ts (visitas y niebla), sim.ts (simulador), index.ts (API). Cliente (client/src): App.tsx, MapView.tsx, Watch.tsx, render.ts, marsTime.ts, api.ts, types.ts, styles.css.

IMPORTANTE: los datos son simulados (terreno sintético, lugares inventados). No pude descargar datos reales de NASA desde mi entorno. Para usar datos reales hay que reemplazar el modelo de elevación y los lugares.

## 4. AJUSTE EN CURSO PARA EL RETO B

Ya escrito en el servidor (compila sin errores de tipos, NO probado en ejecución ni integrado al cliente):
- Nueva región demostrativa inspirada en el piedemonte del Monte Sharp: terreno que sube al sureste con terrazas estratificadas, una garganta, un escarpe con dos pasos, arena blanda y una montaña grande como referencia. Origen en latitud -5.2 y longitud 137.2.
- Nuevo módulo science.ts con siete capas: óptico, elevación, pendiente, térmico (cambia con la hora local), espectral (necesita espectrómetro), químico (perclorato tóxico; necesita analizador químico), radiación (con tormenta solar simulada que la multiplica por 8).
- Condiciones atmosféricas (temperatura, presión, viento, polvo, elevación del sol) y un estado de EVA en verde, ámbar o rojo con las razones, y refugio más cercano.
- Exposición a lo largo de la ruta (dosis de radiación, temperatura mínima, horas de noche) con avisos, integrada al puntaje de seguridad.
- Nuevo instrumento "Analizador químico". Cuatro instrumentos en total, con límites de masa 48 kg y presupuesto 130 M USD.
- Nuevos endpoints: /api/layers, /api/layer/:id, POST /api/env (tormenta solar, polvo, hora). El servidor también entregará el cliente compilado en una sola dirección (puerto 3001) para instalar.
- La telemetría ahora incluye condiciones, estado EVA, dosis acumulada y refugio cercano.

Pendiente en el cliente (aún no escrito):
1. Reloj rediseñado según el PDF: pantalla negra tipo OLED de alto contraste, SIN táctil, con 4 botones físicos (página, arriba, abajo, OK) y atajos de teclado; páginas de navegación, posición, seguridad y destinos.
2. Modo visor HUD a pantalla completa con flecha de rumbo, distancia, estado EVA, dosis y temperatura.
3. Selector de capas con leyenda y etiqueta "datos simulados, análogo a" (HiRISE, MOLA, THEMIS, CRISM, APXS/SAM, RAD); capas espectral y química bloqueadas si falta el instrumento.
4. Panel de seguridad con estado EVA, razones, dosis acumulada y controles para simular tormenta solar, tormenta de polvo y hora del día (amanecer, mediodía, atardecer, medianoche).
5. Instalable: PWA (manifiesto, service worker y iconos), scripts install.sh, install.bat e iniciar, y un INSTALAR.md.
6. README con cómo reemplazar por datos reales (MOLA, THEMIS, CRISM, RAD, REMS o MEDA) y puntos para la presentación (por qué OLED, botones físicos, HUD, vidrio de zafiro).
7. Pruebas con capturas: capas, tormenta solar, HUD y modo producción.

## 5. REGLAS DEL MODELO (por si hay que ajustarlas)
- Velocidad base 4 km/h, reducida por la pendiente; energía = tiempo x potencia + 6 Wh por km con factor de pendiente.
- Una ruta es "alcanzable" solo si cabe en el 80 por ciento de la batería.
- Pendientes de más de 30 grados no se cruzan.
- Rango de batería: 200 a 1200 Wh.
- Estado EVA rojo si la radiación es de 3 mSv por día o más, o hay tormenta de polvo fuerte, o la batería es menor al 10 por ciento.

## 6. QUÉ QUIERO DE TI EN ESTE CHAT
Retoma el trabajo desde la sección 4 y termina el cliente, el empaquetado instalable y el README. Antes de escribir código, dime qué archivos necesitas que te pegue o adjunte (por ejemplo App.tsx, Watch.tsx, MapView.tsx y types.ts).