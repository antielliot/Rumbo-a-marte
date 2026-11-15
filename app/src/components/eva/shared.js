// Piezas compartidas por el reloj, el HUD y los paneles de EVA.
export const STATUS = {
  verde: { word: 'VERDE', line: 'Caminata permitida' },
  ambar: { word: 'ÁMBAR', line: 'Precaución: revisa los avisos' },
  rojo: { word: 'ROJO', line: 'Suspender la caminata' },
}

export const fmtClock = (h) => `${String(Math.floor(h) % 24).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`
export const fmtLat = (lat) => `${Math.abs(lat).toFixed(4)}°${lat < 0 ? 'S' : 'N'}`
export const fmtLon = (lon) => `${Math.abs(lon).toFixed(4)}°${lon < 0 ? 'O' : 'E'}`
