/**
 * Bitácora de radiación por sol.
 * Misma lógica que la pestaña "Bitácora" de la hoja.
 */
import { DOSE_LIMITS, SOL_IN_DAYS } from './marsData.js';
export function summarizeLog(entries, careerLimitMSv = DOSE_LIMITS.careerMSv.value) {
  let cumulative = 0;
  return [...entries]
    .sort((a, b) => a.sol - b.sol)
    .map((entry) => {
    cumulative += entry.equivalentMSvPerDay * SOL_IN_DAYS;
    return {
      ...entry,
      cumulativeMSv: cumulative,
      percentOfCareerLimit: cumulative / careerLimitMSv,
      evaDoseMSv: entry.evaHours === undefined
        ? null
        : (entry.equivalentMSvPerDay / 24) * entry.evaHours,
    };
  });
}
