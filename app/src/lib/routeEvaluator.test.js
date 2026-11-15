import { describe, expect, it } from 'vitest';
import { evaluateRoutes, DEFAULT_SETTINGS } from './routeEvaluator.js';
import { CONST } from './constants.js';
import { summarizeLog } from './radiationLog.js';

// Mismas rutas de ejemplo que la hoja "Comparador de rutas".
// La hoja usa 2 km/h y 15°; la app usa las constantes del proyecto (CONST.WALK_KMH y CONST.MAX_SLOPE_DEG).
const HOJA = { ...DEFAULT_SETTINGS, walkingSpeedKmh: 2, maxSlopeDeg: 15 };
const routes = [
  { id: 'A', name: 'Directa por la llanura', distanceKm: 6, maxSlopeDeg: 8, maxDistanceToShelterKm: 3 },
  { id: 'B', name: 'Por la base de la pendiente', distanceKm: 7.5, maxSlopeDeg: 10, maxDistanceToShelterKm: 1 },
  { id: 'C', name: 'Atajo por la ladera', distanceKm: 4.5, maxSlopeDeg: 22, maxDistanceToShelterKm: 2.5 },
  { id: 'D', name: 'Bordeando refugios', distanceKm: 9, maxSlopeDeg: 6, maxDistanceToShelterKm: 0.8 },
];

describe('evaluateRoutes', () => {
  it('usa la velocidad y la pendiente máxima del proyecto', () => {
    expect(DEFAULT_SETTINGS.walkingSpeedKmh).toBe(CONST.WALK_KMH);
    expect(DEFAULT_SETTINGS.maxSlopeDeg).toBe(CONST.MAX_SLOPE_DEG);
    const r = evaluateRoutes(routes, { dustTau: 1, solarEventActive: false });
    expect(r.recommended?.hours).toBeCloseTo(6 / (CONST.WALK_KMH / 1.1), 5);
  });

  it('con cielo normal recomienda la ruta viable más corta', () => {
    const r = evaluateRoutes(routes, { dustTau: 1, solarEventActive: false }, HOJA);
    expect(r.recommended?.route.id).toBe('A');
    expect(r.evaluations.find((e) => e.route.id === 'C')?.status).toBe('pendiente-excesiva');
    expect(r.recommended?.hours).toBeCloseTo(3.3, 5);
    expect(r.recommended?.doseMSv).toBeCloseTo(0.088, 5);
  });

  it('con polvo alto cambia a una ruta cercana al refugio', () => {
    const r = evaluateRoutes(routes, { dustTau: 4.5, solarEventActive: false });
    expect(r.evaluations.find((e) => e.route.id === 'A')?.status).toBe('cancelar-lejos-del-refugio');
    expect(r.recommended?.route.id).toBe('B');
  });

  it('con tormenta no recomienda salir', () => {
    const r = evaluateRoutes(routes, { dustTau: 8.5, solarEventActive: false });
    expect(r.recommended).toBeNull();
  });

  it('con evento solar regresa por la ruta más cercana a un refugio', () => {
    const r = evaluateRoutes(routes, { dustTau: 1, solarEventActive: true });
    expect(r.recommended?.route.id).toBe('D');
    expect(r.recommended?.status).toBe('regresar-por-aqui');
  });
});

describe('summarizeLog', () => {
  it('acumula la dosis por sol y calcula el % del límite', () => {
    const [first, second] = summarizeLog([
      { sol: 1, condition: 'gcr-normal', equivalentMSvPerDay: 0.64 },
      { sol: 2, condition: 'gcr-normal', equivalentMSvPerDay: 0.64, evaHours: 6 },
    ]);
    expect(first.cumulativeMSv).toBeCloseTo(0.6576, 4);
    expect(second.cumulativeMSv).toBeCloseTo(1.3152, 4);
    expect(second.percentOfCareerLimit).toBeCloseTo(1.3152 / 600, 6);
    expect(second.evaDoseMSv).toBeCloseTo(0.16, 6);
  });
});
