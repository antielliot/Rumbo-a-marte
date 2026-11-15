// Descarga de la Mars Climate Database (LMD, v6.x) la temperatura en el centro de la zona de Gale,
// para 4 estaciones (Ls) x 12 horas locales. Escenario: "climatology ave solar".
// Uso: npm run fetch-mcd   (~1 min; hace 48 consultas con pausa de 1 s: la web es "para uso moderado")
// Fuente: https://www-mars.lmd.jussieu.fr/mcd_python/  (créditos: LMD/OU/IAA/ESA/CNES)
import { writeFileSync, readFileSync } from 'node:fs'

// centro del DEM descargado (corre antes `npm run fetch-dem`)
const { bbox } = JSON.parse(readFileSync(new URL('../public/data/gale-dem.json', import.meta.url)))
const LON = +((bbox[0] + bbox[2]) / 2).toFixed(3), LAT = +((bbox[1] + bbox[3]) / 2).toFixed(3)
const LS = [0, 90, 180, 270]
const LT = Array.from({ length: 12 }, (_, i) => i * 2)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function query(ls, lt) {
  const q = new URLSearchParams({
    datekeyhtml: '1', ls: String(ls), localtime: String(lt), latitude: String(LAT), longitude: String(LON),
    altitude: '2', zkey: '3', dust: '1', var1: 't', var2: 'tsurf', var3: 'ps', var4: 'none',
    hrkey: '1', averaging: 'off', zonmean: 'off', diumean: 'off', isfixedlt: 'off',
    animation: 'off', betatest: 'on', spacecraft: 'none',
  })
  const res = await fetch(`https://www-mars.lmd.jussieu.fr/mcd_python/cgi-bin/mcdcgi.py?${q}`, { signal: AbortSignal.timeout(60000) })
  const txt = await res.text()
  const air = txt.match(/^Temperature \(K\) \.+ *([-\d.]+)/m)?.[1]
  const surf = txt.match(/^Surface temperature \(K\) \.+ *([-\d.]+)/m)?.[1]
  const pres = txt.match(/^Surface pressure \(Pa\) \.+ *([-\d.]+)/m)?.[1]
  const ver = txt.match(/MCD_v[\d.]+/)?.[0]
  if (!air || !surf || !pres) throw new Error(`Respuesta inesperada para Ls=${ls} LT=${lt}: ${txt.slice(0, 200)}`)
  return { air: +air, surf: +surf, pres: +pres, ver }
}

const table = {}
let version
for (const ls of LS) {
  table[ls] = {}
  for (const lt of LT) {
    const r = await query(ls, lt)
    version = r.ver
    table[ls][lt] = { air: +r.air.toFixed(1), surf: +r.surf.toFixed(1), pres: +r.pres.toFixed(1) } // K, K, Pa
    await sleep(1000)
  }
  console.log('Ls', ls, 'ok')
}
writeFileSync(
  new URL('../public/data/gale-temp.json', import.meta.url),
  JSON.stringify({
    source: `Mars Climate Database ${version} (LMD), climatology average solar`,
    point: { lat: LAT, lon: LON }, airHeightM: 2, units: 'K (temperaturas), Pa (presión de superficie)', ls: LS, lt: LT, table,
  }),
)
console.log('OK gale-temp.json', version)
