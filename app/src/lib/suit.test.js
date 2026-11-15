import { describe, expect, it } from 'vitest';
import {
  evaluarTraje, latencia, AMBIENTES_EJEMPLO, TRAJE_LUNAR, TRAJE_MARCIANO, BIOMETRIA_EJEMPLO, REGRESO_EJEMPLO,
} from './suit.js';
import { margenRegreso } from './seguridad.js';

describe('evaluarTraje', () => {
  it('el traje lunar falla en Marte por enfriamiento (el sublimador necesita vacío)', () => {
    const r = evaluarTraje(AMBIENTES_EJEMPLO.marte, TRAJE_LUNAR, BIOMETRIA_EJEMPLO, REGRESO_EJEMPLO);
    expect(r.estado).toBe('rojo');
    expect(r.chequeos.find((c) => c.parametro === 'Enfriamiento')?.estado).toBe('rojo');
  });

  it('el concepto de traje marciano pasa en condiciones normales', () => {
    const r = evaluarTraje(AMBIENTES_EJEMPLO.marte, TRAJE_MARCIANO, BIOMETRIA_EJEMPLO, REGRESO_EJEMPLO);
    expect(r.estado).not.toBe('rojo');
  });

  it('con tormenta solar y el refugio más lejos que el aviso, queda en rojo', () => {
    const r = evaluarTraje({ ...AMBIENTES_EJEMPLO.marte, tormentaSolar: true }, TRAJE_MARCIANO, BIOMETRIA_EJEMPLO,
      { ...REGRESO_EJEMPLO, minutosAlRefugio: 40, minutosAvisoTormenta: 30 });
    expect(r.estado).toBe('rojo');
  });
});

describe('latencia y margen de regreso', () => {
  it('Marte a 1.5 UA obliga a operar de forma autónoma', () => {
    expect(latencia('marte', 1.5).modo).toBe('autonoma');
    expect(latencia('luna').modo).toBe('directa');
  });

  it('margenRegreso usa los niveles 1.5 y 1.3', () => {
    expect(margenRegreso(300, 100).nivel).toBe('verde');
    expect(margenRegreso(140, 100).nivel).toBe('amarillo');
    expect(margenRegreso(120, 100).nivel).toBe('rojo');
  });
});
