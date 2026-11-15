// Temperatura real de la Mars Climate Database (LMD) en el centro de Gale, por estación (Ls) y hora local.
// Generado por `npm run fetch-mcd` -> public/data/gale-temp.json
export async function loadTemp() {
  const res = await fetch(`${import.meta.env.BASE_URL}data/gale-temp.json`)
  if (!res.ok) throw new Error('No se pudo cargar gale-temp.json (corre: npm run fetch-mcd)')
  return res.json()
}
export const kToC = (k) => k - 273.15
export const SEASONS = {
  0: 'Ls 0° (equinoccio, inicio primavera norte)',
  90: 'Ls 90° (solsticio, verano norte)',
  180: 'Ls 180° (equinoccio, inicio otoño norte)',
  270: 'Ls 270° (solsticio, verano sur)',
}
