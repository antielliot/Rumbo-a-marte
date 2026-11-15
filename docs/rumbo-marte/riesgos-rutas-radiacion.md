# Rumbo Marte — Riesgos de misión, rutas y radiación

Documento de trabajo para el equipo de NASA Space Apps. Reúne la investigación y el código de esta conversación.

## Índice

1. Contexto del proyecto
2. De la Luna a Marte: cómo se consideran los riesgos
3. Rutas no óptimas: parámetros en riesgo
4. Radiación en Marte y diseño del traje
5. Funciones propuestas para Rumbo Marte
6. Código (TypeScript)
7. Notas de revisión y pendientes
8. Fuentes

---

## 1. Contexto del proyecto

- **App:** Rumbo Marte, para el reto NASA Space Apps "Interplanetary Survival Guide: Martian Map".
- **Stack:** React + TypeScript/Vite, Node + Express, Leaflet.
- **Requisitos clave del reto:** mapa en capas con al menos 3 tipos de datos, seguridad del astronauta primero, reloj de muñeca con botones físicos (sin pantalla táctil por los guantes), pantallas OLED/Micro-LED, visor HUD, caso de estudio Lower Mount Sharp.
- **Respaldo:** Space Mission Design Game.

**Idea guía de este documento:** el traje no puede resolver todos los riesgos, así que la app es parte del sistema de protección del astronauta (margen de regreso, dosis, refugios).

---

## 2. De la Luna a Marte: cómo se consideran los riesgos

La Luna funciona como campo de pruebas para Marte. Ahí se miden y se reducen los riesgos cuando la Tierra todavía está a unos días de distancia, antes de intentarlo a meses de distancia.

### 2.1 Estado del programa Artemis (noviembre 2026)

| Misión | Fecha | Objetivo |
|---|---|---|
| Artemis I | Nov 2022 | Vuelo sin tripulación de SLS + Orion |
| Artemis II | Abr 2026 (despegue 1 abr, amerizaje 10 abr) | Primer sobrevuelo lunar tripulado |
| Artemis III | Mediados/finales 2027 | Prueba de módulos de alunizaje (HLS) en órbita baja terrestre |
| Artemis IV | Principios 2028 | Primer alunizaje tripulado |

En febrero de 2026 NASA reestructuró el programa por gestión de riesgo: pasar de un sobrevuelo lunar directamente a un alunizaje se consideró un salto demasiado grande.

### 2.2 Cómo clasifica NASA los riesgos

Cinco categorías de peligro humano (Human Research Program):

1. Radiación espacial
2. Gravedad alterada
3. Aislamiento y confinamiento
4. Ambientes cerrados u hostiles
5. Distancia a la Tierra

Se vinculan con más de 30 riesgos de salud. Cada uno se califica en una **matriz 5×5 de probabilidad × consecuencia**, evaluada para misiones de referencia que van desde órbita baja corta hasta superficie lunar larga y Marte.

### 2.3 Cada factor en la Luna y en Marte

**Radiación (riesgo principal)**
- Un año en superficie lunar: ~100–120 mGy.
- Misión a Marte de ~3 años (tránsito + superficie): ~300–450 mGy.
- Las misiones largas a Marte podrían acercarse o superar el límite de NASA de 600 mSv, con mayor riesgo de cáncer y enfermedad cardiovascular y cerebrovascular.
- Mitigación: reducir el tiempo de tránsito, refugios contra tormentas solares, blindaje.

**Distancia y autonomía**
- Desde la Luna se vuelve en días; desde Marte no hay regreso rápido y la comunicación tiene minutos de retraso.
- La tripulación necesita sistemas a bordo para responder sola a anomalías ("independencia de la Tierra").
- Según tendencias históricas, es muy probable enfrentar algún problema de alta consecuencia.

**Salud médica acumulada**
- Modelos de NASA: al menos 1 en 90 de probabilidad de pérdida de vida en una misión de 730 días solo por riesgo médico (comparable al riesgo total del transbordador al final de su programa).

**Gravedad alterada**
- Afecta huesos, sistema cardiovascular, equilibrio y visión (síndrome SANS).
- La gravedad lunar y marciana son parciales; la Luna sirve para estudiar la adaptación.

**Aislamiento y ambiente**
- Estrés psicológico y dinámica de equipo; la guía de diseño pide cuartos individuales con aislamiento acústico.
- Polvo lunar: abrasivo, se adhiere a todo, daña trajes, sellos y pulmones.

### 2.4 Riesgos técnicos

- **Escudo térmico:** Artemis II se retrasó en parte por pérdida inesperada de material ("char loss") en el escudo de Orion tras Artemis I.
- **Módulo de alunizaje (HLS):** riesgos de desarrollo todavía altos.
- **Proveedores comerciales:** la explosión de un cohete de Blue Origin en mayo de 2026 generó dudas sobre los calendarios de Artemis III.

### 2.5 Lógica general

El riesgo se reduce paso a paso: ISS y análogos en Tierra → misiones lunares cortas → estancias lunares largas → Marte. Artemis II aportó datos de radiación de espacio profundo para compararlos con los del ISS y afinar los modelos de blindaje.

**Idea para el juego (respaldo):** cada decisión del jugador (ruta, tiempo de tránsito, blindaje, tamaño de tripulación, zona de aterrizaje) mueve barras de riesgo de las cinco categorías.

---

## 3. Rutas no óptimas: parámetros en riesgo

En Marte, que la ruta llegue no basta. El riesgo está en lo que consume y expone en el camino, y sobre todo en si el astronauta todavía puede regresar.

### 3.1 Parámetro central: margen de regreso

En Apolo existía el *walkback limit*: nunca alejarse más de lo que se puede caminar de vuelta con los consumibles restantes. Una ruta no óptima es válida mientras en **cada punto** se cumpla:

> consumibles restantes ≥ consumo estimado para volver al refugio + margen de seguridad

Una ruta puede llegar al destino y aun así violar esta condición a mitad del trayecto.

### 3.2 Parámetros que se degradan

**Consumibles del traje**
- Oxígeno: más distancia y esfuerzo, más consumo.
- Remoción de CO₂: filtros con capacidad limitada.
- Agua de enfriamiento: subir pendientes genera calor que hay que disipar.
- Batería: soporte vital, comunicación, reloj/HUD.
- Tiempo de EVA: normalmente 6–8 horas como máximo.

**Esfuerzo físico**
- Pendiente: subir cuesta varias veces más energía; bajar pendientes fuertes aumenta el riesgo de caída.
- Tipo de suelo: arena suelta y dunas cansan y pueden atascar un rover (así quedó atrapado Spirit).
- Fatiga acumulada: más errores al final de la ruta, justo cuando hay que volver.

**Terreno**
- Rocas afiladas: en Lower Mount Sharp dañaron las ruedas de Curiosity; en una bota o un traje el daño es más grave.
- Grietas, bordes de cráter, zonas inestables.
- Polvo: desgasta sellos, visores y articulaciones del traje.

**Ambiente**
- Tormentas de polvo: menos visibilidad y menos energía solar.
- Eventos solares (SPE): obligan a llegar rápido a un refugio. Importa la distancia al refugio más cercano en todo momento, no solo al destino.
- Luz y temperatura: si la ruta se alarga hasta el atardecer, la temperatura cae a decenas de grados bajo cero.

**Navegación y comunicación**
- Sin GPS: navegación por estima y puntos de referencia; el error se acumula con distancia y desviaciones.
- Línea de vista: cañones o colinas pueden cortar la comunicación con el hábitat o el satélite de relevo.

### 3.3 Enfoque de cálculo

- **Restricciones duras:** descartan la ruta (pendiente máxima, margen de O₂ y batería, distancia máxima a refugio).
- **Costos:** entre rutas válidas, eligen la menos riesgosa, no la más corta.

Una ruta más larga pero plana y con comunicación puede ganarle a una corta que cruza un cráter. El código está en la sección 6.

---

## 4. Radiación en Marte y diseño del traje

### 4.1 Datos de la hoja del equipo (instrumento RAD de Curiosity)

| Medida | Superficie (Gale) | Viaje |
|---|---|---|
| Dosis absorbida | 0.210 ± 0.040 mGy/día | 0.48 mGy/día |
| Dosis equivalente | ~0.64 mSv/día | ~1.84 mSv/día |

- Variación en superficie: 180–225 µGy/día por presión atmosférica, estaciones y actividad solar; pico de ~260 µGy/día durante un evento solar.
- Límites de NASA: 600 mSv de dosis efectiva en toda la carrera; la hoja usa 250 mSv por evento solar (ver sección 7).
- Misión 180 + 500 + 180 días: la hoja calcula ~968 mSv (~161% del límite), en línea con la estimación del equipo RAD de ~1.01 Sv.
- El traje casi no protege contra los rayos cósmicos: en Marte la radiación se gestiona con tiempo de EVA, dosímetro y refugio.

### 4.2 Por qué en Marte hay tanta radiación

En la Tierra hay dos escudos: el campo magnético global y una atmósfera gruesa (~1000 g/cm² sobre la cabeza). Marte perdió su campo magnético global hace miles de millones de años y su atmósfera es ~100 veces más delgada; en Gale la columna de aire es de ~20 g/cm².

Aun así Marte protege algo: el planeta tapa medio cielo y la atmósfera fragmenta parte de los iones pesados. Por eso la dosis baja de 0.48 a 0.21 mGy/día.

**Factor de calidad:** dosis equivalente ÷ absorbida da ~3.8 en el viaje y ~3.0 en superficie. Baja en Marte porque la atmósfera rompe los iones pesados (los más dañinos) en partículas más ligeras. El blindaje no solo reduce la cantidad de radiación, también cambia su tipo.

### 4.3 Tipos de radiación

| Tipo | Origen | Energía | ¿Se puede bloquear? | Riesgo |
|---|---|---|---|---|
| Rayos cósmicos galácticos (GCR) | Supernovas fuera del sistema solar: protones, helio, iones pesados (HZE) | Cientos de MeV a GeV | Muy poco; blindaje pesado y delgado puede empeorarlo | Crónico: cáncer, daño cardiovascular y al sistema nervioso |
| Eventos de partículas solares (SPE) | Ráfagas de protones del Sol, horas o días | Menor que GCR | Sí: 10–20 g/cm² de agua o polietileno | Agudo: síndrome de radiación |
| Secundaria del suelo | GCR chocando con el regolito | Neutrones y gamma | Parcial | Se suma a la dosis desde abajo |
| Ultravioleta | Sol, sin capa de ozono | Baja | Sí, fácil (visor y capas externas) | Bajo con traje |

Notas:
- Los GCR son más intensos en el mínimo solar, porque el viento solar los desvía menos.
- Un material pesado y delgado (p. ej. plomo) puede empeorar la dosis de GCR, porque genera una lluvia de neutrones y fragmentos secundarios.

### 4.4 Por qué un traje no puede blindar contra GCR

Blindaje de polietileno de ~10 g/cm² (~10 cm):

- Superficie corporal: ~2 m² = 20,000 cm²
- 20,000 cm² × 10 g/cm² = **~200 kg**
- Con gravedad marciana (0.38 g): equivale a cargar ~76 kg terrestres, además del traje.

Aun así los GCR solo bajan un porcentaje modesto. En EVA la radiación se gestiona con operaciones, no con el traje.

### 4.5 Cómo sería un traje realista contra radiación

1. **Blindaje selectivo:** proteger órganos sensibles (médula ósea en pelvis y columna, órganos digestivos, pulmones). El chaleco AstroRad voló en un maniquí en Artemis I para probar esta idea contra SPE.
2. **Materiales ricos en hidrógeno:** mejor blindaje por kilogramo. Se investigan UHMWPE y BNNT hidrogenados (el boro además absorbe neutrones).
3. **Agua del traje como escudo:** acomodar el agua de enfriamiento alrededor del torso.
4. **Dosímetro integrado:** tasa y dosis acumulada en tiempo real, con alerta ante un salto (señal de SPE).
5. **Refugio cercano:** hábitat, rover blindado o abrigo natural (acantilado, cueva, tubo de lava).

Los escudos activos (magnéticos o eléctricos) requieren demasiada energía y masa para un traje.

### 4.6 Otros requisitos del traje por el ambiente marciano

- **Presión:** ~0.6 kPa, menos del 1% de la terrestre y bajo el límite de Armstrong. El traje debe ser un recipiente presurizado completo.
- **Temperatura:** de ~20 °C de día a menos de −70 °C de noche; aislamiento y control térmico activo.
- **Polvo:** fino, abrasivo, electrostático, con percloratos tóxicos. No debe entrar al hábitat (*suitports*: el traje se queda afuera).
- **Atmósfera:** ~95% CO₂, sin oxígeno respirable.

---

## 5. Funciones propuestas para Rumbo Marte

**Reloj / HUD**
- Indicador de **margen de regreso** que cambia de color al acercarse al punto de no retorno.
- Dosis acumulada de la EVA y de la misión contra el límite.
- Alerta de SPE con distancia y tiempo al refugio más cercano.

**Mapa (capas)**
- Pendiente y tipo de terreno.
- Cobertura de comunicación (línea de vista).
- Refugios: hábitat, rovers y abrigos naturales (acantilados, cuevas).

**Cálculo de rutas**
- Restricciones duras por consumibles, pendiente y distancia a refugio.
- Costo que penaliza terreno riesgoso, zonas sin comunicación y tramos expuestos a radiación.

---

## 6. Código (TypeScript)

Módulo de referencia para la lógica de seguridad. Los valores de límites y pesos son ejemplos para calibrar.

```ts
// seguridad.ts — lógica de rutas, margen de regreso y radiación

// ---------- Tipos ----------

export interface Segmento {
  id: string;
  distanciaM: number;
  pendienteGrados: number;
  riesgoTerreno: number;          // 0 (seguro) a 1 (muy riesgoso)
  sinComunicacion: boolean;
  expuesto: boolean;              // sin abrigo natural cercano
  distanciaRefugioM: number;
  o2RestanteL: number;            // O2 estimado al llegar a este punto
  costoRegresoO2L: number;        // O2 para volver al refugio desde aquí
  bateriaRestanteWh: number;
  costoRegresoBateriaWh: number;
}

export type Ruta = Segmento[];

// ---------- Configuración (calibrar) ----------

export const LIMITES = {
  PENDIENTE_MAX_GRADOS: 15,
  DIST_MAX_REFUGIO_M: 2000,
  MARGEN_CONSUMIBLES: 1.3,        // 30% extra sobre el costo de regreso
};

export const PESOS = {
  DISTANCIA: 1,
  PENDIENTE: 50,
  TERRENO: 500,
  SIN_COMUNICACION: 300,
  EXPOSICION: 200,
};

// ---------- Restricciones duras ----------

export function segmentoValido(s: Segmento): boolean {
  return (
    s.pendienteGrados <= LIMITES.PENDIENTE_MAX_GRADOS &&
    s.o2RestanteL >= s.costoRegresoO2L * LIMITES.MARGEN_CONSUMIBLES &&
    s.bateriaRestanteWh >= s.costoRegresoBateriaWh * LIMITES.MARGEN_CONSUMIBLES &&
    s.distanciaRefugioM <= LIMITES.DIST_MAX_REFUGIO_M
  );
}

export function validarRuta(ruta: Ruta): { valida: boolean; primerFallo?: string } {
  const fallo = ruta.find(s => !segmentoValido(s));
  return fallo ? { valida: false, primerFallo: fallo.id } : { valida: true };
}

// ---------- Costo (entre rutas válidas) ----------

export function costoRuta(ruta: Ruta): number {
  return ruta.reduce(
    (c, s) =>
      c +
      s.distanciaM * PESOS.DISTANCIA +
      s.pendienteGrados * PESOS.PENDIENTE +
      s.riesgoTerreno * PESOS.TERRENO +
      (s.sinComunicacion ? PESOS.SIN_COMUNICACION : 0) +
      (s.expuesto ? PESOS.EXPOSICION : 0),
    0
  );
}

export function elegirRuta(candidatas: Ruta[]): Ruta | null {
  const validas = candidatas.filter(r => validarRuta(r).valida);
  if (validas.length === 0) return null;
  return validas.reduce((mejor, r) => (costoRuta(r) < costoRuta(mejor) ? r : mejor));
}

// ---------- Margen de regreso (para el reloj) ----------

export type NivelMargen = "verde" | "amarillo" | "rojo";

export function margenRegreso(o2RestanteL: number, costoRegresoO2L: number): {
  ratio: number;
  nivel: NivelMargen;
} {
  const ratio = costoRegresoO2L > 0 ? o2RestanteL / costoRegresoO2L : Infinity;
  const nivel: NivelMargen = ratio >= 1.5 ? "verde" : ratio >= 1.3 ? "amarillo" : "rojo";
  return { ratio, nivel };
}

// ---------- Radiación ----------

export const RADIACION = {
  SUPERFICIE_mSv_DIA: 0.64,
  VIAJE_mSv_DIA: 1.84,
  LIMITE_CARRERA_mSv: 600,
  TASA_NORMAL_MAX_uGy_DIA: 225,   // rango normal medido: 180–225 µGy/día
};

export function dosisMision(diasIda: number, diasSuperficie: number, diasRegreso: number) {
  const totalmSv =
    (diasIda + diasRegreso) * RADIACION.VIAJE_mSv_DIA +
    diasSuperficie * RADIACION.SUPERFICIE_mSv_DIA;
  return {
    totalmSv,
    porcentajeLimite: (totalmSv / RADIACION.LIMITE_CARRERA_mSv) * 100,
  };
}
// dosisMision(180, 500, 180) → ~982 mSv, ~164% del límite

export interface LecturaDosimetro {
  timestamp: number;              // ms
  tasa_uGy_dia: number;
}

// Alerta si la tasa supera el rango normal medido (posible SPE).
export function detectarSPE(
  lecturas: LecturaDosimetro[],
  umbral = RADIACION.TASA_NORMAL_MAX_uGy_DIA
): boolean {
  const ultima = lecturas[lecturas.length - 1];
  return ultima !== undefined && ultima.tasa_uGy_dia > umbral;
}

// Dosis acumulada de la EVA integrando lecturas (resultado en µGy).
export function dosisEVA(lecturas: LecturaDosimetro[]): number {
  let total = 0;
  for (let i = 1; i < lecturas.length; i++) {
    const dtDias = (lecturas[i].timestamp - lecturas[i - 1].timestamp) / 86_400_000;
    total += lecturas[i - 1].tasa_uGy_dia * dtDias;
  }
  return total;
}
```

---

## 7. Notas de revisión y pendientes

- **Cálculo de dosis de la misión:** con 1.84 mSv/día en el viaje, 360 × 1.84 ≈ 662 mSv + 500 × 0.64 = 320 mSv → **~982 mSv (~164%)**. Los 968 mSv de la hoja salen usando 1.8 mSv/día. Unificar el valor.
- **Límite por SPE:** en el estándar de NASA parece ser un límite de diseño de corto plazo para órganos formadores de sangre, en mGy-Eq, no una dosis efectiva en mSv como el de 600. Confirmar en NASA-STD-3001.
- **Umbral de SPE en el código:** 225 µGy/día es el tope del rango normal medido; ajustarlo para no generar falsas alarmas por variación estacional.
- **Calibrar** límites, pesos del costo y consumos de O₂/batería con datos reales del traje o supuestos documentados.

---

## 8. Fuentes

- [NBC News – NASA Artemis overhaul](https://www.nbcnews.com/science/space/nasa-artemis-moon-mission-overhaul-rcna260971)
- [CRS – Artemis (junio 2026)](https://www.everycrsreport.com/files/2026-06-25_IF11643_f42f123e3663b5d6aef757a78d6406c1af3dc8be.html)
- [CSIS – What Comes Next for Artemis?](https://www.csis.org/analysis/what-comes-next-artemis)
- [Starlust – Artemis III revised outline](https://starlust.org/artemis-iii-mission-revised-outline-nasa-takes-its-call-on-icps-major-questions-still-unanswered)
- [NASA NTRS – Human Health and Performance (Moon to Mars)](https://ntrs.nasa.gov/api/citations/20230015521/downloads/Human%20Health%20and%20Performance.pdf)
- [Red risks for a journey to the red planet (npj Microgravity)](https://ui.adsabs.harvard.edu/abs/2020npjMG...6...33P)
- [NASA NESC – Integrated Human Health Risk Assessment](https://ntrs.nasa.gov/api/citations/20220009899/downloads/F5.2_04_Valinia.pdf)
- [NASA NTRS – Moon 2 Mars Radiation Protection](https://ntrs.nasa.gov/citations/20250006168)
- Datos de radiación de la sección 4: hoja del equipo, basada en mediciones del instrumento RAD de Curiosity (Hassler et al., Science, 2014)
