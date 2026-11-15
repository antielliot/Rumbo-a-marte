// Reloj de muñeca del traje: pantalla emisiva (tipo OLED) de alto contraste sobre negro, SIN táctil
// (los guantes no lo permiten). 4 botones físicos: PÁG, ▲, ▼, OK. Origen: Watch.tsx de Rumbo Marte.
import { useState } from 'react'
import { KEYMAP, useWatchKeys } from './keys'
import Arrow from './Arrow'
import { STATUS, fmtClock, fmtLat, fmtLon } from './shared'
import { cardinal } from '../../lib/eva'

const PAGES = [['nav', 'NAV'], ['pos', 'POS'], ['seg', 'SEG'], ['eva', 'EVA']]
const clamp = (i, n) => (n <= 0 ? 0 : Math.max(0, Math.min(n - 1, i)))
const cut = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s)

export default function Watch({ t, turns, mode, accel, controls, hudOpen, onHud }) {
  const [page, setPage] = useState('nav')
  const [cur, setCur] = useState({ nav: null, seg: 0, eva: 0 })
  const [pressed, setPressed] = useState(null)

  const actions = [
    { id: 'toggle', label: { idle: 'INICIAR EVA', running: 'PAUSAR', paused: 'REANUDAR', arrived: 'VOLVER', returned: 'SALIR OTRA VEZ' }[mode] },
    ...(t && t.s > 0 && mode !== 'idle' ? [{ id: 'shelter', label: 'IR AL REFUGIO' }] : []),
    { id: 'accel', label: `VELOCIDAD ×${accel}` },
    ...(mode !== 'idle' ? [{ id: 'end', label: 'TERMINAR EVA' }] : []),
  ]
  // giro que se muestra: el siguiente, salvo que se haya elegido otro con ▲▼
  const nextIdx = t?.nextTurn ? turns.findIndex((x) => x.n === t.nextTurn.n) : -1
  const turnIdx = clamp(cur.nav ?? (nextIdx >= 0 ? nextIdx : 0), turns.length)
  const reasons = t?.reasons ?? []

  function press(b) {
    setPressed(b)
    window.setTimeout(() => setPressed(null), 140)
    if (b === 'page') { setPage(PAGES[(PAGES.findIndex((x) => x[0] === page) + 1) % PAGES.length][0]); return }
    const d = b === 'up' ? -1 : b === 'down' ? 1 : 0
    if (page === 'nav') {
      if (d) setCur((c) => ({ ...c, nav: clamp(turnIdx + d, turns.length) }))
      else onHud()
    } else if (page === 'seg') {
      if (d) setCur((c) => ({ ...c, seg: clamp(c.seg + d, reasons.length) }))
      else if (t && !t.inShelter && mode !== 'idle') controls.goShelter()
    } else if (page === 'eva') {
      if (d) setCur((c) => ({ ...c, eva: clamp(c.eva + d, actions.length) }))
      else {
        const a = actions[clamp(cur.eva, actions.length)]
        if (a.id === 'toggle') { controls.toggle(); if (mode === 'idle') setPage('nav') }
        else if (a.id === 'shelter') { controls.goShelter(); setPage('nav') }
        else if (a.id === 'accel') controls.cycleAccel()
        else if (a.id === 'end') controls.end()
      }
    }
  }
  useWatchKeys(!hudOpen, press, (k) => {
    if (k === 'h' || k === 'H') { onHud(); return true }
    return false
  })

  const status = t?.status ?? 'verde'
  const hint = {
    nav: 'OK visor HUD · ▲▼ giros',
    pos: 'Posición desde el DEM',
    seg: t?.inShelter || mode === 'idle' ? '▲▼ avisos' : 'OK ir al refugio · ▲▼',
    eva: 'OK ejecutar · ▲▼ elegir',
  }[page]

  return (
    <div className="watch-wrap">
      <div className={`device st-${status}`}>
        <div className="bezel">
          {['up', 'down'].map((b) => (
            <button key={b} className={`hw hw-left hw-${b} ${pressed === b ? 'down' : ''}`} onClick={() => press(b)}
              aria-label={`Botón ${b === 'up' ? 'arriba' : 'abajo'} (tecla ${b === 'up' ? 'flecha arriba' : 'flecha abajo'} o ${KEYMAP[b].keys[1]})`}>
              <span>{KEYMAP[b].label}</span>
            </button>
          ))}
          {['page', 'ok'].map((b) => (
            <button key={b} className={`hw hw-right hw-${b} ${pressed === b ? 'down' : ''}`} onClick={() => press(b)}
              aria-label={b === 'page' ? 'Botón página (tecla P o 1)' : 'Botón OK (tecla Enter o 4)'}>
              <span>{KEYMAP[b].label}</span>
            </button>
          ))}
          <div className="screen" aria-live="polite" aria-label="Pantalla del reloj (no táctil)">
            <div className="scr-top">
              <span className={`led led-${status}`} />
              <span className="scr-page">{PAGES.find((x) => x[0] === page)[1]}</span>
              <span className="scr-hour">{t ? fmtClock(t.clock) : '--:--'}</span>
              <span className={`scr-bat ${t && t.battPct < 25 ? 'red' : ''}`}>{t ? Math.round(t.battPct) : '--'}%</span>
            </div>
            <div className="scr-body">
              {!t ? (
                <><p className="big dim">— —</p><p className="dim center">SIN RUTA</p><p className="dim center">Marca inicio y destino</p></>
              ) : page === 'nav' ? (
                <>
                  <div className="nav-arrow"><Arrow deg={t.goal.bearing - t.heading} size={34} color={t.dir < 0 ? '#ff453a' : '#ffb000'} /></div>
                  <p className="big">{t.goal.distKm.toFixed(1)}<small> km</small></p>
                  <p className="dim">{cardinal(t.goal.bearing)} {Math.round(t.goal.bearing)}° · ≈{Math.round(t.goal.etaMin)} min</p>
                  <p className="amber">{t.dir < 0 ? cut(`AL REFUGIO`, 24) : mode === 'idle' ? 'LISTO PARA SALIR' : 'AL DESTINO'}</p>
                  {turns.length > 0 && <p className="leg">{turnIdx + 1}/{turns.length} {cut(turns[turnIdx].text, 74)}</p>}
                </>
              ) : page === 'pos' ? (
                <>
                  <p className="row"><span className="dim">LAT</span><b>{fmtLat(t.lonlat[1])}</b></p>
                  <p className="row"><span className="dim">LON</span><b>{fmtLon(t.lonlat[0])}</b></p>
                  <p className="row"><span className="dim">ELEV</span><b>{Math.round(t.elev)} m</b></p>
                  <p className="row"><span className="dim">PEND · RUMBO</span><b>{t.slope.toFixed(0)}° · {Math.round(t.heading)}°</b></p>
                  <p className="row"><span className="dim">ENLACE BASE</span><b className={t.comm ? 'green' : 'amber'}>{t.comm ? 'CON VISTA' : 'SIN VISTA'}</b></p>
                  <p className="row"><span className="dim">SOL · EVA</span><b>{t.sol} · {t.hours.toFixed(1)} h</b></p>
                </>
              ) : page === 'seg' ? (
                <>
                  <p className={`eva-word ${status}`}>{STATUS[status].word}</p>
                  <p className="row"><span className="dim">RAD</span><b className={t.doseRate >= 3 ? 'red' : t.doseRate >= 1.5 ? 'amber' : ''}>{t.doseRate.toFixed(2)} mSv/d</b></p>
                  <p className="row"><span className="dim">DOSIS EVA</span><b>{t.doseMSv.toFixed(3)} mSv</b></p>
                  <p className="row"><span className="dim">TEMP AIRE</span><b>{t.airC === null ? '–' : `${t.airC.toFixed(0)} °C`}</b></p>
                  <p className="row"><span className="dim">O₂ · MARGEN</span><b className={t.margin.level === 'rojo' ? 'red' : t.margin.level === 'ambar' ? 'amber' : 'green'}>{t.o2LeftH.toFixed(1)} h · {t.margin.atStart ? 'SALIDA' : `${Math.min(99, t.margin.ratio).toFixed(1)}×`}</b></p>
                  <p className="row"><span className="dim">REFUGIO</span><b>{t.inShelter ? 'A CUBIERTO' : `${t.shelter.distKm.toFixed(1)} km ${cardinal(t.shelter.bearing)}`}</b></p>
                  {reasons.length > 0 && <p className={`leg ${reasons[clamp(cur.seg, reasons.length)].level === 'rojo' ? 'red' : 'amber'}`}>{clamp(cur.seg, reasons.length) + 1}/{reasons.length} {cut(reasons[clamp(cur.seg, reasons.length)].text, 74)}</p>}
                </>
              ) : (
                <ul className="dest">
                  {actions.map((a, k) => (
                    <li key={a.id} className={k === clamp(cur.eva, actions.length) ? 'cur' : ''}>
                      <span>{k === clamp(cur.eva, actions.length) ? '›' : ' '}{a.label}</span>
                    </li>
                  ))}
                  <li className="dim">{{ idle: 'Sin salir', running: 'En marcha', paused: 'En pausa', arrived: 'En el destino', returned: 'En la salida' }[mode]}</li>
                </ul>
              )}
            </div>
            <div className="scr-foot">{hint}</div>
            <div className="scr-dots" aria-hidden="true">{PAGES.map(([id]) => <i key={id} className={id === page ? 'on' : ''} />)}</div>
          </div>
        </div>
      </div>
      <p className="watch-caption">
        Sin pantalla táctil: usa los botones o el teclado. <kbd>P</kbd> página, <kbd>↑</kbd> <kbd>↓</kbd>, <kbd>Enter</kbd> OK, <kbd>H</kbd> visor HUD.
      </p>
    </div>
  )
}
