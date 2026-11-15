// Hook del simulador de EVA. Al iniciar se CONGELA la ruta (A* se recalcula en App cuando cambia la hora,
// porque la radiación depende de la presión de la MCD; el astronauta sigue el plan con el que salió).
import { useEffect, useMemo, useRef, useState } from 'react'
import { initialState, readTelemetry, routeGeometry, step } from './eva.js'

export const ACCELS = [60, 240, 900]
const TICK_MS = 250

export function useEva({ dem, route, why, temp, ls, hour, onHour, flare, dustTau, tempElev }) {
  const [plan, setPlan] = useState(null) // { route, why, elev } congelado al iniciar
  const [st, setSt] = useState(() => initialState(hour))
  const [accel, setAccel] = useState(240)
  const [event, setEvent] = useState(null)

  // si cambia la malla (otro DEM), el plan ya no vale
  useEffect(() => { if (plan && dem && plan.elev !== dem.elev) { setPlan(null); setSt(initialState(hour)) } }, [dem?.elev]) // eslint-disable-line react-hooks/exhaustive-deps
  // con la caminata detenida, el reloj sigue al control de hora de la app
  useEffect(() => { setSt((s) => (s.mode === 'running' ? s : { ...s, clock: hour })) }, [hour])

  const active = plan ?? (route && dem && route.elev === dem.elev ? { route, why } : null)
  const geo = useMemo(() => (dem && active ? routeGeometry(dem, active.route, active.why) : null), [active?.route, active?.why, dem?.elev]) // eslint-disable-line react-hooks/exhaustive-deps
  const env = useMemo(() => ({ flare, dustTau, ls, temp, tempElev }), [flare, dustTau, ls, temp, tempElev])

  const ref = useRef({})
  useEffect(() => { ref.current = { dem, geo, env, accel, st } })

  useEffect(() => {
    if (st.mode !== 'running') return
    const id = setInterval(() => {
      const r = ref.current
      if (!r.dem || !r.geo) return
      const out = step(r.dem, r.geo, r.st, r.env, (TICK_MS / 1000) * r.accel / 3600)
      r.st = out.st
      setSt(out.st)
      if (out.event) setEvent({ text: out.event, at: Date.now() })
    }, TICK_MS)
    return () => clearInterval(id)
  }, [st.mode])

  // la hora de la app (MCD, radiación, sombras) sigue al reloj de la caminata, en pasos de 2 h
  useEffect(() => {
    if (st.mode !== 'running') return
    const h = (Math.floor(st.clock / 2) * 2) % 24
    if (h !== hour) onHour?.(h)
  }, [st.clock, st.mode]) // eslint-disable-line react-hooks/exhaustive-deps

  const t = useMemo(() => (dem && geo ? readTelemetry(dem, geo, st, env) : null), [dem, geo, st, env])

  const say = (text) => setEvent({ text, at: Date.now() })
  const controls = {
    canStart: !!active,
    /** Iniciar, pausar o reanudar según el estado. */
    toggle() {
      if (!active) return say('Primero marca inicio y destino en el mapa.')
      if (st.mode === 'idle') {
        setPlan({ route: active.route, why: active.why, elev: dem.elev })
        setSt({ ...initialState(hour), mode: 'running' })
        say('EVA iniciada. La ruta queda fija hasta que termines.')
      } else if (st.mode === 'running') setSt((s) => ({ ...s, mode: 'paused' }))
      else if (st.mode === 'paused') setSt((s) => ({ ...s, mode: 'running' }))
      else if (st.mode === 'arrived') setSt((s) => ({ ...s, mode: 'running', dir: -1 }))
      else if (st.mode === 'returned') setSt((s) => ({ ...s, mode: 'running', dir: 1, s: 0 }))
    },
    /** Dar media vuelta hacia el refugio (punto de salida) por el camino ya recorrido. */
    goShelter() {
      if (!plan || st.s <= 0) return
      setSt((s) => ({ ...s, mode: 'running', dir: -1 }))
      say('Regresando al refugio por el camino recorrido.')
    },
    cycleAccel() { setAccel((a) => ACCELS[(ACCELS.indexOf(a) + 1) % ACCELS.length]) },
    setAccel,
    end() { setPlan(null); setSt((s) => ({ ...initialState(hour), log: s.log, sol: s.sol, solAcc: s.solAcc })); say('EVA terminada.') },
  }
  return { t, st, plan, accel, event, controls, geo }
}
