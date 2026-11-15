// Visor HUD: lo que se proyectaría en el casco. Símbolos verdes de alto contraste, cinta de rumbo con
// referencias reales (cima del Monte Sharp desde el DEM, base, Curiosity), flecha y estado de seguridad.
// Origen: Hud.tsx de Rumbo Marte.
import { useEffect } from 'react'
import { useWatchKeys } from './keys'
import Arrow from './Arrow'
import { STATUS } from './shared'
import { bearing, cardinal, distM } from '../../lib/eva'

const SPAN = 120 // grados visibles en la cinta
const rel = (b, h) => ((b - h + 540) % 360) - 180

export default function Hud({ t, landmarks, onClose, onShelter }) {
  const red = t?.status === 'rojo' && !t.inShelter && t.mode !== 'idle'

  useWatchKeys(true, (b) => {
    if (b === 'ok') { if (red) onShelter(); else onClose() } else if (b === 'page') onClose()
  }, (k) => {
    if (k === 'Escape' || k === 'h' || k === 'H') { onClose(); return true }
    return false
  })

  useEffect(() => {
    document.activeElement?.blur?.() // OK (Enter) va al visor, no al último botón que se tocó en la página
    document.documentElement.requestFullscreen?.().catch(() => {})
    return () => { if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {}) }
  }, [])

  if (!t) return (
    <div className="hud" role="dialog" aria-label="Visor HUD del casco">
      <p className="hud-wait">Sin ruta. Marca inicio y destino en el mapa. <br />Esc para volver.</p>
    </div>
  )

  const h = t.heading
  const ticks = []
  for (let a = Math.ceil((h - SPAN / 2) / 5) * 5; a <= h + SPAN / 2; a += 5) {
    const x = 50 + (rel(a, h) / SPAN) * 100
    const n = ((a % 360) + 360) % 360
    const card = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SO', 270: 'O', 315: 'NO' }[n]
    ticks.push(<div key={a} className={`tick ${n % 10 === 0 ? 'major' : ''}`} style={{ left: `${x}%` }}>{card ? <b>{card}</b> : n % 30 === 0 ? <span>{n}</span> : null}</div>)
  }

  const marks = []
  if (t.mode !== 'idle' || t.s > 0) marks.push({ key: 'shelter', ll: t.shelter.lonlat, label: `REFUGIO ${t.shelter.distKm.toFixed(1)} km`, cls: 'shelter' })
  if (t.dir > 0) marks.push({ key: 'target', ll: t.end, label: `DESTINO ${t.goal.distKm.toFixed(1)} km`, cls: 'target' })
  for (const l of landmarks) {
    const d = distM(t.lonlat, l.lonlat)
    if (d > 150) marks.push({ key: l.id, ll: l.lonlat, label: `${l.name} ${(d / 1000).toFixed(1)} km`, cls: 'lm' })
  }
  const tapePx = Math.max(240, (typeof window === 'undefined' ? 1200 : window.innerWidth) * 0.84)
  const order = { target: 0, shelter: 1, lm: 2 }
  const rows = []
  const placed = marks
    .map((m) => { const b = bearing(t.lonlat, m.ll); const r = rel(b, h); const off = Math.abs(r) > SPAN / 2; return { ...m, r, off, x: off ? (r < 0 ? 0 : 100) : 50 + (r / SPAN) * 100 } })
    .sort((a, b) => order[a.cls] - order[b.cls])
    .map((m) => {
      const w = ((m.label.length + 3) * 7.4 * 100) / tapePx
      const span = m.off ? (m.r < 0 ? [m.x, m.x + w] : [m.x - w, m.x]) : [m.x - w / 2, m.x + w / 2]
      let row = rows.findIndex((list) => list.every(([a, b]) => span[1] < a - 1 || span[0] > b + 1))
      if (row === -1) { row = rows.length; rows.push([]) }
      rows[row].push(span)
      return { ...m, row }
    })
    .filter((m) => m.row < 4)

  const aim = red ? { ...t.shelter, label: 'AL REFUGIO: ' + t.shelter.name } : { bearing: t.goal.bearing, distKm: t.goal.distKm, label: t.dir < 0 ? `Al refugio: ${t.shelter.name}` : `Destino · ≈${Math.round(t.goal.etaMin)} min` }
  const s = STATUS[t.status]

  return (
    <div className={`hud ${red ? 'alarm' : ''}`} role="dialog" aria-label="Visor HUD del casco">
      <div className="hud-horizon" aria-hidden="true" />
      <div className="tape" aria-label={`Rumbo ${Math.round(h)} grados`}>
        {ticks}
        {placed.map((m) => (
          <div key={m.key} className={`mk ${m.cls} ${m.off ? 'off' : ''}`} style={{ left: `${m.x}%`, top: `${-16 - m.row * 20}px`, transform: m.off ? (m.r < 0 ? 'none' : 'translateX(-100%)') : 'translateX(-50%)' }}>
            <i>{m.off ? (m.r < 0 ? '◀' : '▶') : m.cls === 'lm' ? '△' : '▼'}</i><span>{m.label}</span>
          </div>
        ))}
        <div className="hdg">{String(Math.round(h) % 360).padStart(3, '0')}°</div>
      </div>

      <div className="hud-center">
        <div className={`hud-arrow ${red || t.dir < 0 ? 'red' : ''}`}><Arrow deg={aim.bearing - h} size={110} color={red || t.dir < 0 ? '#ff453a' : '#ffd166'} /></div>
        <p className="hud-dist">{aim.distKm.toFixed(1)} <small>km {cardinal(aim.bearing)}</small></p>
        <p className="hud-name">{aim.label}</p>
      </div>

      <div className={`hud-left st-${t.status}`}>
        <b>EVA {s.word}</b>
        <span>{t.reasons[0]?.text ?? s.line}</span>
      </div>
      <dl className="hud-right">
        <div><dt>RAD</dt><dd className={t.doseRate >= 3 ? 'red' : t.doseRate >= 1.5 ? 'amber' : ''}>{t.doseRate.toFixed(2)} mSv/d</dd></div>
        <div><dt>DOSIS</dt><dd>{t.doseMSv.toFixed(3)} mSv</dd></div>
        <div><dt>TEMP</dt><dd>{t.airC === null ? '–' : `${t.airC.toFixed(0)} °C`}</dd></div>
        <div><dt>O₂</dt><dd className={t.margin.level === 'rojo' ? 'red' : t.margin.level === 'ambar' ? 'amber' : ''}>{t.o2LeftH.toFixed(1)} h</dd></div>
        <div><dt>MARGEN</dt><dd className={t.margin.level === 'rojo' ? 'red' : t.margin.level === 'ambar' ? 'amber' : ''}>{t.margin.atStart ? 'SALIDA' : `${Math.min(99, t.margin.ratio).toFixed(1)}×`}</dd></div>
        <div><dt>ENLACE</dt><dd className={t.comm ? '' : 'amber'}>{t.comm ? 'BASE OK' : 'SIN VISTA'}</dd></div>
      </dl>

      <div className="hud-bottom">
        {red && <p className="hud-alarm">SUSPENDER EVA · OK: ir al refugio ({t.shelter.distKm.toFixed(1)} km al {cardinal(t.shelter.bearing)})</p>}
        {t.nextTurn && <p className="hud-leg">En {t.nextTurn.inKm.toFixed(1)} km · {t.nextTurn.text}</p>}
        <p className="hud-keys">{red ? 'OK refugio' : 'OK salir'} · PÁG o Esc: volver al reloj</p>
      </div>
    </div>
  )
}
