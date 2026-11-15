// Posición del Sol y sombras del terreno (geometría real a partir del DEM).
import { CONST } from './constants.js'

/** elev y az en radianes (az medido desde el norte hacia el este). Ls en grados, lt = hora solar local (0-24). */
export function sunPosition(latDeg, ls, lt) {
  const r = Math.PI / 180
  const dec = Math.asin(Math.sin(CONST.MARS_OBLIQUITY_DEG * r) * Math.sin(ls * r))
  const H = (lt - 12) * 15 * r
  const phi = latDeg * r
  const sinE = Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H)
  const elev = Math.asin(Math.max(-1, Math.min(1, sinE)))
  const cosE = Math.cos(elev)
  let az = 0
  if (cosE > 1e-6) {
    const sinAz = (-Math.cos(dec) * Math.sin(H)) / cosE
    const cosAz = (Math.sin(dec) - sinE * Math.sin(phi)) / (cosE * Math.cos(phi))
    az = Math.atan2(sinAz, cosAz)
  }
  return { elev, az }
}

/** 1 = en sombra (o noche), 0 = al sol, NaN = sin dato. */
export function shadeMap(dem, ls, lt) {
  const { w, h, n, elev, cellM } = dem
  const lat = (dem.latMin + dem.latMax) / 2
  const { elev: se, az } = sunPosition(lat, ls, lt)
  const out = new Float32Array(n)
  if (se <= 0) { // sol bajo el horizonte: todo en sombra
    for (let i = 0; i < n; i++) out[i] = Number.isNaN(elev[i]) ? NaN : 1
    return out
  }
  const tanE = Math.tan(se)
  const dx = Math.sin(az), dy = -Math.cos(az) // hacia el Sol en la malla (este = +x, norte = -y)
  let zmax = -Infinity
  for (let i = 0; i < n; i++) if (elev[i] > zmax) zmax = elev[i]
  const RMAX = 400
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x, z0 = elev[i]
      if (Number.isNaN(z0)) { out[i] = NaN; continue }
      let shadow = 0
      for (let r = 1; r <= RMAX; r++) {
        const xx = Math.round(x + dx * r), yy = Math.round(y + dy * r)
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) break
        const rise = r * cellM * tanE // altura del rayo solar sobre z0 a esta distancia
        if (z0 + rise > zmax) break // el rayo ya pasó por encima de todo el terreno
        if (elev[yy * w + xx] > z0 + rise) { shadow = 1; break }
      }
      out[i] = shadow
    }
  return out
}
