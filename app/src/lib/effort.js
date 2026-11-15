// Esfuerzo metabólico al caminar según el gradiente (subida / bajada).
// Polinomio de Minetti et al. (2002), J Appl Physiol 93:1039 — "Energy cost of walking and running at
// extreme uphill and downhill slopes". C(i) en J/kg/m, i = desnivel/distancia horizontal, válido |i| <= 0.45.
// VERIFICACIÓN: los coeficientes los tomamos de memoria (no pudimos abrir el PDF); son coherentes con valores
// publicados: -10% -> 1.13 (publicado ~1.1) y -45% -> 3.6 (publicado 3.92 ± 0.81).
// LÍMITE: medido en la Tierra (1 g) y sin traje; en Marte (0.38 g) y con traje el costo cambia.
import { CONST } from './constants.js'

export const effortJ = (i) => {
  const x = i < -0.45 ? -0.45 : i > 0.45 ? 0.45 : i
  return ((((280.5 * x - 58.7) * x - 76.8) * x + 51.9) * x + 19.6) * x + 2.5
}
const C0 = effortJ(0)
/** Esfuerzo relativo a caminar en plano (1 = plano, >1 subida, <1 bajada suave). */
export const effortRel = (i) => effortJ(i) / C0
// Lo más barato: bajada suave (~-15 %, ~0.37× el plano)
const EFFORT_REL_MIN = (() => {
  let m = Infinity
  for (let i = -0.45; i <= 0.45; i += 0.005) m = Math.min(m, effortRel(i))
  return m
})()
// Lo más caro permitido: subir a la pendiente máxima caminable (20°, ~5.4× el plano)
const EFFORT_REL_MAX = effortRel(Math.tan((CONST.MAX_SLOPE_DEG * Math.PI) / 180))
/** Esfuerzo normalizado 0..1: 0 = bajada suave (lo más fácil), 1 = subir a 20° (límite). Plano ≈ 0.12. */
export const effortRisk = (i) => Math.min(1, Math.max(0, (effortRel(i) - EFFORT_REL_MIN) / (EFFORT_REL_MAX - EFFORT_REL_MIN)))
