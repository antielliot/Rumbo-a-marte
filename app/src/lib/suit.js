/**
 * suit.js — Evaluación del traje y de la caminata (EVA).
 *
 * Origen: suit.ts de Rumbo Marte (entrega). Al combinarlo con Mars Route se quitaron las rutas
 * Express: aquí todo corre en el navegador y el simulador de EVA (lib/eva.js) le pasa el ambiente
 * con los datos del DEM, el modelo de radiación y la Mars Climate Database.
 *
 * IMPORTANTE: los umbrales son valores de demostración para el hackathon, no
 * requisitos certificados. Ajústalos con NASA-STD-3001 y con datos reales
 * (RAD, REMS/MEDA, Mars Climate Database).
 */
import { CONST } from './constants.js';
// ───────────────────────────── Constantes ─────────────────────────────
export const GRAVEDAD = { luna: 0.166, marte: 0.38 };
/** Valores de demostración. Ajustar con NASA-STD-3001. */
export const UMBRALES = {
  margenAmbar: 0.25, // margen menor al 25 % → ámbar
  factorRegreso: 1.3, // consumibles ≥ costo de regreso × 1.3
  dosisDiariaRoja_mSv: 3, // regla actual de Rumbo Marte
  multiplicadorTormenta: 8, // regla actual de Rumbo Marte
  limiteCarrera_mSv: 600, // límite de carrera de NASA
  caidaPresionMaxPct: 10, // caída de presión tolerable antes de regresar
  tempContactoMinC: -120, // ejemplo: límite de contacto de guantes y botas
  tempContactoMaxC: 120,
  bufferTermicoC: 100, // a 100 °C del límite se considera margen completo
  co2CascoMax_mmHg: 8, // ejemplo: ajustar con la norma
  pesoAparenteMax_kg: 40, // ejemplo: peso que se puede cargar toda la caminata
  pendienteMax: CONST.MAX_SLOPE_DEG, // mismo límite que A* (antes 30°)
  tauRojo: 4, // tormenta de polvo fuerte
  percloratoAlertaPct: 0.3,
  fcMax: 170,
  tempCentralMaxC: 39,
  tempCentralMinC: 35.5,
  spo2MinPct: 92,
  // Penalizaciones cuando se usa tecnología lunar (dependiente del vacío) en Marte
  factorAislamientoSinVacio: 0.5,
  factorEnfriamientoSinVacio: 0.3,
};
const SEGUNDOS_LUZ_POR_UA = 499; // la luz tarda ~499 s en recorrer 1 UA
const LATENCIA_LUNA_IDA_S = 1.3;
// ───────────────────────────── Utilidades ─────────────────────────────
const redondear = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
function estadoDeMargen(margen) {
  if (margen < 0)
    return 'rojo';
  if (margen < UMBRALES.margenAmbar)
    return 'ambar';
  return 'verde';
}
const RANGO = { verde: 0, ambar: 1, rojo: 2 };
const peorEstado = (a, b) => (RANGO[a] >= RANGO[b] ? a : b);
/** Margen cuando el valor no debe superar el límite. */
const margenMax = (valor, limite) => (limite - valor) / limite;
/** Margen cuando lo disponible debe cubrir lo requerido. */
const margenCubre = (disponible, requerido) => disponible <= 0 ? -1 : (disponible - requerido) / disponible;
function chequeo(parametro, valor, limite, margen, razon, estadoMinimo = 'verde') {
  const m = redondear(margen);
  return {
    parametro,
    valor,
    limite,
    margen: m,
    estado: peorEstado(estadoDeMargen(m), estadoMinimo),
    razon,
  };
}
// ──────────────────────── Evaluación del traje ────────────────────────
export function evaluarTraje(ambiente, traje, bio, regreso) {
  const U = UMBRALES;
  const enMarte = ambiente.cuerpo === 'marte';
  const c = [];
  // 1. Radiación: tasa diaria, dosis acumulada y refugio ante tormenta solar
  const tasa = ambiente.tasaDosis_mSvDia * (ambiente.tormentaSolar ? U.multiplicadorTormenta : 1);
  c.push(chequeo('Radiación (tasa)', `${redondear(tasa)} mSv/día`, `< ${U.dosisDiariaRoja_mSv} mSv/día`, margenMax(tasa, U.dosisDiariaRoja_mSv), ambiente.tormentaSolar ? 'Tormenta solar en curso: la tasa se multiplica.' : 'Tasa normal de superficie.'));
  const acumulada = bio.dosisAcumulada_mSv + bio.dosisEva_mSv;
  c.push(chequeo('Radiación (acumulada)', `${redondear(acumulada, 1)} mSv`, `< ${U.limiteCarrera_mSv} mSv de carrera`, margenMax(acumulada, U.limiteCarrera_mSv), 'Dosis de carrera más la de esta caminata.'));
  if (ambiente.tormentaSolar) {
    c.push(chequeo('Refugio ante tormenta solar', `${regreso.minutosAlRefugio} min al refugio`, `≤ ${regreso.minutosAvisoTormenta} min de aviso`, margenCubre(regreso.minutosAvisoTormenta, regreso.minutosAlRefugio), 'El refugio debe alcanzarse antes de que lleguen las partículas.'));
  }
  // 2. Presión de operación: la fuga no debe superar la caída tolerable durante lo que queda de EVA
  const caidaTolerable = traje.presionOperacion_kPa * (U.caidaPresionMaxPct / 100);
  const caidaEsperada = traje.tasaFuga_kPaHora * traje.o2RestanteHoras;
  c.push(chequeo('Presión de operación', `${traje.presionOperacion_kPa} kPa, fuga ${traje.tasaFuga_kPaHora} kPa/h`, `caída < ${redondear(caidaTolerable)} kPa`, margenCubre(caidaTolerable, caidaEsperada), `Exterior a ${ambiente.presionPa} Pa: por debajo del límite de Armstrong (6300 Pa), el traje es obligatorio.`));
  // 3. Rango térmico: contacto de guantes y botas con el suelo
  let margenTermico = Math.min((ambiente.tempSueloC - U.tempContactoMinC) / U.bufferTermicoC, (U.tempContactoMaxC - ambiente.tempSueloC) / U.bufferTermicoC);
  let razonTermica = 'Margen respecto al límite de contacto de guantes y botas.';
  if (enMarte && !traje.aislamientoParaCO2) {
    margenTermico *= U.factorAislamientoSinVacio;
    razonTermica = 'En Marte el CO2 conduce calor y el aislamiento multicapa rinde menos.';
  }
  c.push(chequeo('Rango térmico', `suelo a ${ambiente.tempSueloC} °C`, `${U.tempContactoMinC} a ${U.tempContactoMaxC} °C`, Math.min(margenTermico, 1), razonTermica));
  // 4. Duración de EVA: oxígeno suficiente para volver con margen
  const o2Requerido = regreso.o2CostoRegresoHoras * U.factorRegreso;
  c.push(chequeo('Duración de EVA (O2)', `${traje.o2RestanteHoras} h de O2`, `≥ ${redondear(o2Requerido)} h para volver`, margenCubre(traje.o2RestanteHoras, o2Requerido), 'Oxígeno para regresar al refugio con 30 % de reserva.'));
  const bateriaRequerida = regreso.bateriaCostoRegreso_Wh * U.factorRegreso;
  c.push(chequeo('Batería para volver', `${traje.bateriaRestante_Wh} Wh`, `≥ ${redondear(bateriaRequerida)} Wh`, margenCubre(traje.bateriaRestante_Wh, bateriaRequerida), 'Soporte vital, radio y reloj hasta el refugio con 30 % de reserva.'));
  // 5. Enfriamiento: capacidad efectiva frente al calor metabólico
  let capacidad = traje.capacidadEnfriamiento_W;
  let razonFrio = 'Capacidad de rechazo de calor frente al esfuerzo actual.';
  if (enMarte && !traje.enfriamientoSinVacio) {
    capacidad *= U.factorEnfriamientoSinVacio;
    razonFrio = 'El sublimador necesita vacío; en Marte pierde la mayor parte de su capacidad.';
  }
  c.push(chequeo('Enfriamiento', `${bio.tasaMetabolica_W} W generados`, `≤ ${redondear(capacidad, 0)} W efectivos`, margenCubre(capacidad, bio.tasaMetabolica_W), razonFrio));
  // 6. Eliminación de CO2
  c.push(chequeo('Eliminación de CO2', `${traje.co2Casco_mmHg} mmHg en el casco`, `< ${U.co2CascoMax_mmHg} mmHg`, margenMax(traje.co2Casco_mmHg, U.co2CascoMax_mmHg), enMarte && !traje.co2SinVacio
    ? 'Los filtros se regeneran contra el vacío; con la atmósfera de Marte rinden menos.'
    : 'CO2 dentro del casco.', enMarte && !traje.co2SinVacio ? 'ambar' : 'verde'));
  // 7. Polvo mecánico: desgaste acumulado y tormenta de polvo
  c.push(chequeo('Polvo mecánico', `${traje.horasPolvoAcumuladas} h de uso, tau ${ambiente.opacidadPolvo}`, `< ${traje.vidaUtilPolvoHoras} h; tau < ${U.tauRojo}`, Math.min(margenMax(traje.horasPolvoAcumuladas, traje.vidaUtilPolvoHoras), margenMax(ambiente.opacidadPolvo, U.tauRojo)), 'Desgaste de sellos, visor y rodamientos; visibilidad en tormenta.'));
  // 8. Polvo químico: perclorato que podría entrar al hábitat
  c.push(chequeo('Polvo químico', `${ambiente.percloratoPct} % de perclorato`, traje.suitport ? 'suitport: el polvo queda afuera' : `< ${U.percloratoAlertaPct} % sin suitport`, traje.suitport ? 1 : margenMax(ambiente.percloratoPct, U.percloratoAlertaPct), traje.suitport
    ? 'La entrada trasera evita llevar polvo al hábitat.'
    : 'Sin suitport, el polvo tóxico puede entrar al hábitat al quitarse el traje.'));
  // 9. Gravedad y masa: peso aparente del traje
  const pesoAparente = traje.masaTierra_kg * GRAVEDAD[ambiente.cuerpo];
  c.push(chequeo('Gravedad y masa', `${redondear(pesoAparente, 1)} kg aparentes`, `≤ ${U.pesoAparenteMax_kg} kg`, margenMax(pesoAparente, U.pesoAparenteMax_kg), `Gravedad de ${GRAVEDAD[ambiente.cuerpo]} g.`));
  // 10. Monitoreo biométrico: el peor de frecuencia cardiaca, temperatura y saturación
  const margenBio = Math.min(margenMax(bio.frecuenciaCardiaca, U.fcMax), margenMax(bio.temperaturaCentralC, U.tempCentralMaxC) * 10, // escala: 1 °C ≈ margen completo
  (bio.temperaturaCentralC - U.tempCentralMinC) / 1, (bio.saturacionO2Pct - U.spo2MinPct) / (100 - U.spo2MinPct));
  c.push(chequeo('Monitoreo biométrico', `FC ${bio.frecuenciaCardiaca}, ${bio.temperaturaCentralC} °C, SpO2 ${bio.saturacionO2Pct} %`, `FC < ${U.fcMax}; ${U.tempCentralMinC}–${U.tempCentralMaxC} °C; SpO2 ≥ ${U.spo2MinPct} %`, Math.min(margenBio, 1), enMarte
    ? 'Con 4–24 min de retraso, las alertas deben generarse en el traje o la base.'
    : 'La Tierra puede vigilar casi en tiempo real.'));
  // 11. Ajuste y movilidad: pendiente que se puede caminar
  c.push(chequeo('Ajuste y movilidad', `${ambiente.pendienteGrados}° de pendiente`, `≤ ${U.pendienteMax}°`, margenMax(ambiente.pendienteGrados, U.pendienteMax), 'Pendientes fuertes aumentan esfuerzo, caídas y daño al traje.'));
  const peor = c.reduce((a, b) => (RANGO[b.estado] > RANGO[a.estado] || (b.estado === a.estado && b.margen < a.margen) ? b : a));
  return { estado: peor.estado, peor, chequeos: c };
}
export const PESOS_RUTA = { distancia: 1, pendiente: 0.2, terreno: 3, comunicacion: 2 };
/** Restricciones duras: si alguna falla en cualquier segmento, la ruta se descarta. */
export function rutaValida(segmentos, distMaxRefugio_km) {
  return segmentos.every(s => s.pendiente <= UMBRALES.pendienteMax &&
    s.o2Restante >= s.costoRegresoO2 * UMBRALES.factorRegreso &&
    s.bateriaRestante >= s.costoRegresoBateria * UMBRALES.factorRegreso &&
    s.distanciaRefugio <= distMaxRefugio_km);
}
/** Costo: entre rutas válidas se elige la menos riesgosa, no la más corta. */
export function costoRuta(segmentos) {
  return segmentos.reduce((total, s) => total
    + s.distancia * PESOS_RUTA.distancia
    + s.pendiente * PESOS_RUTA.pendiente
    + s.riesgoTerreno * PESOS_RUTA.terreno
    + (s.sinComunicacion ? PESOS_RUTA.comunicacion : 0), 0);
}
/**
 * Retraso de comunicación con la Tierra.
 * Marte está entre ~0.37 y ~2.67 UA de la Tierra: de ~3 a ~22 minutos por trayecto.
 */
export function latencia(cuerpo, distanciaTierraMarte_UA = 1.5) {
  const ida = cuerpo === 'luna'
    ? LATENCIA_LUNA_IDA_S
    : Math.min(Math.max(distanciaTierraMarte_UA, 0.37), 2.67) * SEGUNDOS_LUZ_POR_UA;
  const idaVuelta = ida * 2;
  let modo;
  let explicacion;
  if (idaVuelta <= 5) {
    modo = 'directa';
    explicacion = 'Se puede manejar un robot desde la Tierra casi en tiempo real.';
  }
  else if (idaVuelta <= 60) {
    modo = 'supervisada';
    explicacion = 'El robot ejecuta órdenes cortas y un humano corrige con retraso.';
  }
  else {
    modo = 'autonoma';
    explicacion = 'El robot debe decidir solo; desde la Tierra solo se envía un plan diario.';
  }
  return { cuerpo, idaSegundos: redondear(ida, 1), idaVueltaSegundos: redondear(idaVuelta, 1), modo, explicacion };
}
// ───────────────────────────── Ejemplos ─────────────────────────────
export const AMBIENTES_EJEMPLO = {
  // Polo sur lunar, terreno iluminado cerca de un cráter
  luna: {
    cuerpo: 'luna', presionPa: 0, tempSueloC: -100, tasaDosis_mSvDia: 1.4,
    tormentaSolar: false, opacidadPolvo: 0, percloratoPct: 0, pendienteGrados: 12,
  },
  // Piedemonte del Monte Sharp (cráter Gale), valores aproximados
  marte: {
    cuerpo: 'marte', presionPa: 750, tempSueloC: -60, tasaDosis_mSvDia: 0.6,
    tormentaSolar: false, opacidadPolvo: 0.6, percloratoPct: 0.5, pendienteGrados: 8,
  },
};
/** Traje de tipo lunar: tecnología que depende del vacío. Masa ilustrativa. */
export const TRAJE_LUNAR = {
  presionOperacion_kPa: 29.6, tasaFuga_kPaHora: 0.05, masaTierra_kg: 120,
  capacidadEnfriamiento_W: 500, o2RestanteHoras: 6, co2Casco_mmHg: 3,
  bateriaRestante_Wh: 900, horasPolvoAcumuladas: 20, vidaUtilPolvoHoras: 200,
  suitport: false, aislamientoParaCO2: false, enfriamientoSinVacio: false, co2SinVacio: false,
};
/** Concepto de traje marciano: más ligero y sin depender del vacío. Valores de ejemplo. */
export const TRAJE_MARCIANO = {
  ...TRAJE_LUNAR,
  masaTierra_kg: 75,
  suitport: true, aislamientoParaCO2: true, enfriamientoSinVacio: true, co2SinVacio: true,
};
export const BIOMETRIA_EJEMPLO = {
  frecuenciaCardiaca: 110, temperaturaCentralC: 37.2, saturacionO2Pct: 97,
  tasaMetabolica_W: 300, dosisAcumulada_mSv: 250, dosisEva_mSv: 0.3,
};
export const REGRESO_EJEMPLO = {
  o2CostoRegresoHoras: 2, bateriaCostoRegreso_Wh: 300, minutosAlRefugio: 40, minutosAvisoTormenta: 30,
};
