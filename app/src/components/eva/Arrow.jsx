// Flecha SVG del reloj y del HUD.
/** Flecha SVG que gira exactamente sobre su centro. */
export default function Arrow({ deg, size, color }) {
  return (
    <svg width={size} height={size} viewBox="-50 -50 100 100" style={{ transform: `rotate(${deg}deg)`, transition: 'transform 0.4s linear', overflow: 'visible' }} aria-hidden="true">
      <path d="M0,-46 L30,30 L0,14 L-30,30 Z" fill={color} />
    </svg>
  )
}
