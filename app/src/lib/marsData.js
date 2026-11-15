/**
 * Datos de referencia de Marte para Rumbo Marte.
 *
 * Cada valor indica de dónde sale (instrumento, misión o documento) y si es
 * una medición, un modelo o una norma. La app debe mostrar esa etiqueta para
 * no presentar un modelo como si fuera una medición.
 */
/** Sitio de referencia: Aeolis Palus, cráter Gale (aterrizaje de Curiosity). */
export const AEOLIS_PALUS = {
  name: 'Aeolis Palus (cráter Gale)',
  lat: -4.59,
  lon: 137.44,
  elevationKm: {
    value: -4.4,
    unit: 'km (MOLA)',
    kind: 'medido-orbita',
    source: 'MOLA / Hassler et al., Science 2013',
  },
};
/** Radiación medida por RAD (Curiosity). */
export const RADIATION = {
  surfaceAbsorbedMGyPerDay: {
    value: 0.21,
    unit: 'mGy/día',
    kind: 'medido-superficie',
    source: 'RAD/Curiosity, Hassler et al., Science 2013',
    note: 'Promedio de ~300 soles cerca del máximo del ciclo solar 24',
  },
  surfaceEquivalentMSvPerDay: {
    value: 0.64,
    unit: 'mSv/día',
    kind: 'medido-superficie',
    source: 'RAD/Curiosity, Hassler et al., Science 2013',
  },
  surfaceAbsorbedRangeMicroGyPerDay: {
    value: { min: 180, max: 225 },
    unit: 'µGy/día',
    kind: 'medido-superficie',
    source: 'RAD/Curiosity, Hassler et al., Science 2013',
    note: 'Varía con la presión atmosférica, la estación y la actividad solar',
  },
  cruiseEquivalentMSvPerDay: {
    value: 1.8,
    unit: 'mSv/día',
    kind: 'medido-superficie',
    source: 'RAD/MSL durante el crucero',
  },
  solarEventMay2024MicroGy: {
    value: 8100,
    unit: 'µGy en el evento',
    kind: 'medido-superficie',
    source: 'RAD/Curiosity, NASA/JPL (junio 2024)',
  },
};
/** Límites de NASA (NASA-STD-3001). */
export const DOSE_LIMITS = {
  careerMSv: {
    value: 600,
    unit: 'mSv',
    kind: 'norma',
    source: 'NASA-STD-3001',
  },
  perSolarEventMSv: {
    value: 250,
    unit: 'mSv',
    kind: 'norma',
    source: 'NASA-STD-3001',
  },
};
/** Clima de Gale medido por REMS (Curiosity). */
export const GALE_WEATHER = {
  pressureSeasonalPa: {
    value: { min: 700, max: 925 },
    unit: 'Pa',
    kind: 'medido-superficie',
    source: 'REMS/Curiosity (Remote Sensing 2025, 17(3):368)',
  },
  pressureDailySwingPa: {
    value: 60,
    unit: 'Pa (±)',
    kind: 'medido-superficie',
    source: 'REMS/Curiosity',
    note: 'Máximo 08–10 h, mínimo 16–18 h hora local',
  },
  airTempC: {
    value: { min: -87, max: 4 },
    unit: '°C',
    kind: 'medido-superficie',
    source: 'REMS/Curiosity',
  },
  groundTempC: {
    value: { min: -119, max: 20 },
    unit: '°C',
    kind: 'medido-superficie',
    source: 'REMS/Curiosity',
  },
  dustOpacityTau: {
    value: { min: 1, max: 8.5 },
    unit: 'tau',
    kind: 'medido-superficie',
    source: 'Curiosity, tormenta global 2018 (Viúdez-Moreiras et al. 2019)',
    note: '≈1 antes de la tormenta, ≈8.5 en su pico',
  },
};
/** Tolerancias del traje lunar (no es un dataset: documentos técnicos). */
export const SUIT_AXEMU = {
  maxEvaHours: {
    value: 8,
    unit: 'h',
    kind: 'norma',
    source: 'Axiom Space (AxEMU)',
  },
  backupOxygenMinutes: {
    value: 30,
    unit: 'min',
    kind: 'norma',
    source: 'Orbital Radar (Secondary Oxygen Pack)',
  },
  operatingPressurePsi: {
    value: 4.3,
    unit: 'psi',
    kind: 'norma',
    source: 'NASA xEMU PLSS (ICES 2023)',
  },
  externalTempC: {
    value: { min: -157, max: 121 },
    unit: '°C',
    kind: 'norma',
    source: 'NASA xEMU (2019)',
  },
};
/** Duración de un sol en días terrestres. */
export const SOL_IN_DAYS = 1.0275;
