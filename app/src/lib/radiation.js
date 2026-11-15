// RADIACIÓN: modelo anclado en datos publicados de MSL/RAD (ver README). No es un mapa oficial.
//
// Fuente de los números de radiación:
//   Guo et al. (2018), "Dependence of the Martian radiation environment on atmospheric
//   depth: modelling and measurement", JGR. https://arxiv.org/abs/1712.06987
//   - Dosis medida por RAD en Gale (detector de plástico): ~220 uGy/día (rango 190-260).
//   - Factor de calidad medio <Q> = 3.05 ± 0.3 (Hassler et al. 2014)  ->  ~0.67 mSv/día (dosis equivalente).
//   - Gale: presión 700-950 Pa (columna 18.9-25.7 g/cm²); 840 Pa = 22.6 g/cm².
//   - HZETRN2015, Φ=500 MV: entre 700 y 950 Pa la dosis equivalente cambia ~126 uSv/día
//     (~19% del promedio)  ->  pendiente dosis-presión.
//   - Medido: la anticorrelación dosis-presión se debilita con la actividad solar:
//       -kappa = 0.28 - 2.9e-4·Φ  [uGy/día/Pa],  y se anula hacia Φ ≈ 900-1000 MV.
//
// SUPUESTOS NUESTROS (no del paper):
//   - Presión por altura con atmósfera isoterma: H = R·T/g con T = 210 K (supuesto).
//   - Extrapolación LINEAL dosis-presión fuera de 700-950 Pa (Gale está a ~-4.4 km, así que
//     las zonas altas del recorte, hasta ~+1 km, quedan fuera de lo medido). El paper deja
//     abierto si la relación lineal se extrapola.
//   - Sin efecto del relieve local ni albedo: a ~90° del cenit hay ~400 g/cm² de atmósfera,
//     así que bloquear el cielo bajo casi no cambia la dosis.
const G = 3.71 // m/s²
const R_GAS = 188.9 // J/(kg·K), CO2
const T_ATM = 210 // K (supuesto)
const H_SCALE = (R_GAS * T_ATM) / G // ~10.7 km

const REF = {
  elev: -4400, // m, altitud MOLA de Curiosity (~-4.4 km)
  pressure: 840, // Pa, presión de ejemplo en Gale (Guo 2018)
  doseEq: 0.67, // mSv/día = 220 uGy/día × <Q> 3.05
}
const SLOPE_PHI500 = 0.126 / 250 // mSv/día por Pa, de HZETRN2015 a Φ=500 MV (126 uSv/día en 250 Pa)

export const SOLAR = {
  min: { label: 'Mínimo solar (Φ≈200 MV)', phi: 200 },
  mid: { label: 'Medio (Φ≈500 MV)', phi: 500 },
  max: { label: 'Máximo (Φ≈900 MV)', phi: 900 },
}

const pressureAt = (h) => REF.pressure * Math.exp(-(h - REF.elev) / H_SCALE)
// el efecto de blindaje crece con poca actividad solar (ajuste lineal medido, ver arriba)
const solarScale = (phi) => Math.max(0, (0.28 - 2.9e-4 * phi) / (0.28 - 2.9e-4 * 500))

// Riesgo 0..1 en escala FÍSICA FIJA (no relativa a la zona): 0.60 mSv/día -> 0, 0.90 -> 1.
const RISK_LO = 0.6, RISK_HI = 0.9

// atm (opcional): presión real de la MCD en un punto { pressure: Pa, elev: m del punto }.
// Con ella la presión de cada celda sigue la estación y la hora; sin ella se usa la presión de referencia.
export function radiationFor(dem, phi = 500, atm = null) {
  const { n, elev } = dem
  const s = SLOPE_PHI500 * solarScale(phi)
  const press = atm ? (h) => atm.pressure * Math.exp(-(h - atm.elev) / H_SCALE) : pressureAt
  const rad = new Float32Array(n) // mSv/día (modelo)
  const radRisk = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    rad[i] = REF.doseEq + s * (REF.pressure - press(elev[i]))
    radRisk[i] = Math.min(1, Math.max(0, (rad[i] - RISK_LO) / (RISK_HI - RISK_LO)))
  }
  return { rad, radRisk }
}

export function simulate(dem) {
  return radiationFor(dem, 500)
}
