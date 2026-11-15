import { useEffect, useRef } from 'react'

// Los 4 botones físicos del reloj y sus atajos de teclado.
// En el traje real serían botones grandes, operables con guante. Aquí, el teclado los simula.
export const KEYMAP = {
  page: { label: 'PÁG', keys: ['p', '1'] },
  up: { label: '▲', keys: ['ArrowUp', '2'] },
  down: { label: '▼', keys: ['ArrowDown', '3'] },
  ok: { label: 'OK', keys: ['Enter', '4'] },
}

function isTyping(el) {
  const e = el
  if (!e || !e.tagName) return false
  const tag = e.tagName.toLowerCase()
  // casillas y botones de radio no son "escribir": los atajos del reloj siguen funcionando
  if (tag === 'input') return !['checkbox', 'radio', 'button', 'submit', 'reset'].includes(e.type)
  return tag === 'select' || tag === 'textarea' || e.isContentEditable
}

/** Escucha los atajos del reloj mientras `enabled` sea true. `extra` recibe otras teclas (H, Esc). */
export function useWatchKeys(enabled, onButton, extra) {
  const cb = useRef(onButton)
  const ex = useRef(extra)
  useEffect(() => { cb.current = onButton; ex.current = extra })
  useEffect(() => {
    if (!enabled) return
    const h = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return
      // Enter sobre un botón o enlace enfocado debe activar ese control, no el reloj.
      const tag = e.target?.tagName?.toLowerCase()
      if (e.key === 'Enter' && (tag === 'button' || tag === 'a')) return
      if (ex.current?.(e.key)) { e.preventDefault(); return; }
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key
      const b = Object.keys(KEYMAP).find((k) => KEYMAP[k].keys.includes(key))
      if (b) { e.preventDefault(); cb.current(b); }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [enabled])
}
