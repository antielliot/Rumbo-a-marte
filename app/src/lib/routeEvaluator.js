/**
 * Evaluador de rutas según el clima de Marte.
 *
 * Misma lógica que la pestaña "Comparador de rutas" de la hoja.
 * Los umbrales marcados como "propuesto" o "supuesto" son decisiones del
 * equipo, no normas de NASA: déjalos configurables.
 */
import { RADIATION, SUIT_AXEMU } from './marsData.js';
import { CONST } from './constants.js';
export const DEFAULT_SETTINGS = {
  walkingSpeedKmh: CONST.WALK_KMH, // misma velocidad de marcha que el resto de la app (antes 2 km/h)
  speedPenaltyPerTau: 0.1,
  surfaceDoseMSvPerDay: RADIATION.surfaceEquivalentMSvPerDay.value,
  maxEvaHours: SUIT_AXEMU.maxEvaHours.value,
  safetyMarginHours: 1,
  tauShelterOnly: 4,
  tauNoGo: 6,
  maxShelterDistanceDustyKm: 1,
  maxSlopeDeg: CONST.MAX_SLOPE_DEG, // mismo límite que A* (antes 15°)
};
export const STATUS_LABEL = {
  viable: 'Viable',
  'regresar-por-aqui': 'Regresar por esta ruta',
  'cancelar-evento-solar': 'Cancelar: evento solar',
  'cancelar-polvo': 'Cancelar: polvo',
  'cancelar-lejos-del-refugio': 'Cancelar: lejos del refugio',
  'pendiente-excesiva': 'Pendiente excesiva',
  'excede-eva': 'Excede la EVA',
};
export function estimateHours(distanceKm, dustTau, s) {
  const effectiveSpeed = s.walkingSpeedKmh / (1 + s.speedPenaltyPerTau * dustTau);
  return distanceKm / effectiveSpeed;
}
export function estimateDoseMSv(hours, s) {
  // El traje casi no blinda contra rayos cósmicos: se usa la tasa de superficie.
  return (s.surfaceDoseMSvPerDay * hours) / 24;
}
export function evaluateRoutes(routes, conditions, settings = DEFAULT_SETTINGS) {
  if (routes.length === 0) {
    return { evaluations: [], recommended: null, reason: 'No hay rutas candidatas.' };
  }
  const closestShelter = Math.min(...routes.map((r) => r.maxDistanceToShelterKm));
  const evaluations = routes.map((route) => {
    const hours = estimateHours(route.distanceKm, conditions.dustTau, settings);
    const doseMSv = estimateDoseMSv(hours, settings);
    const fitsEva = hours <= settings.maxEvaHours - settings.safetyMarginHours;
    let status;
    if (conditions.solarEventActive) {
      status =
        route.maxDistanceToShelterKm === closestShelter
          ? 'regresar-por-aqui'
          : 'cancelar-evento-solar';
    }
    else if (conditions.dustTau >= settings.tauNoGo) {
      status = 'cancelar-polvo';
    }
    else if (conditions.dustTau >= settings.tauShelterOnly &&
      route.maxDistanceToShelterKm > settings.maxShelterDistanceDustyKm) {
      status = 'cancelar-lejos-del-refugio';
    }
    else if (route.maxSlopeDeg > settings.maxSlopeDeg) {
      status = 'pendiente-excesiva';
    }
    else if (!fitsEva) {
      status = 'excede-eva';
    }
    else {
      status = 'viable';
    }
    return { route, status, hours, doseMSv, fitsEva };
  });
  if (conditions.solarEventActive) {
    const back = evaluations.find((e) => e.status === 'regresar-por-aqui') ?? null;
    return {
      evaluations,
      recommended: back,
      reason: 'Evento solar activo: regresar por la ruta más cercana a un refugio.',
    };
  }
  const viable = evaluations
    .filter((e) => e.status === 'viable')
    .sort((a, b) => a.hours - b.hours);
  if (viable.length === 0) {
    return {
      evaluations,
      recommended: null,
      reason: 'Ninguna ruta es viable con las condiciones actuales: no salir.',
    };
  }
  return {
    evaluations,
    recommended: viable[0],
    reason: 'Ruta viable más corta en tiempo (y por lo tanto en dosis).',
  };
}
