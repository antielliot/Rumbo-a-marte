import { CONST } from './constants.js';
// seguridad.ts — lógica de rutas, margen de regreso y radiación
// ---------- Configuración (calibrar) ----------
export const LIMITES = {
  PENDIENTE_MAX_GRADOS: CONST.MAX_SLOPE_DEG, // mismo límite que A* (antes 15°)
  DIST_MAX_REFUGIO_M: 2000,
  MARGEN_CONSUMIBLES: 1.3, // 30% extra sobre el costo de regreso
};
export const PESOS = {
  DISTANCIA: 1,
  PENDIENTE: 50,
  TERRENO: 500,
  SIN_COMUNICACION: 300,
  EXPOSICION: 200,
};
// ---------- Restricciones duras ----------
export function segmentoValido(s) {
  return (s.pendienteGrados <= LIMITES.PENDIENTE_MAX_GRADOS &&
    s.o2RestanteL >= s.costoRegresoO2L * LIMITES.MARGEN_CONSUMIBLES &&
    s.bateriaRestanteWh >= s.costoRegresoBateriaWh * LIMITES.MARGEN_CONSUMIBLES &&
    s.distanciaRefugioM <= LIMITES.DIST_MAX_REFUGIO_M);
}
export function validarRuta(ruta) {
  const fallo = ruta.find(s => !segmentoValido(s));
  return fallo ? { valida: false, primerFallo: fallo.id } : { valida: true };
}
// ---------- Costo (entre rutas válidas) ----------
export function costoRuta(ruta) {
  return ruta.reduce((c, s) => c +
    s.distanciaM * PESOS.DISTANCIA +
    s.pendienteGrados * PESOS.PENDIENTE +
    s.riesgoTerreno * PESOS.TERRENO +
    (s.sinComunicacion ? PESOS.SIN_COMUNICACION : 0) +
    (s.expuesto ? PESOS.EXPOSICION : 0), 0);
}
export function elegirRuta(candidatas) {
  const validas = candidatas.filter(r => validarRuta(r).valida);
  if (validas.length === 0)
    return null;
  return validas.reduce((mejor, r) => (costoRuta(r) < costoRuta(mejor) ? r : mejor));
}
export function margenRegreso(o2RestanteL, costoRegresoO2L) {
  const ratio = costoRegresoO2L > 0 ? o2RestanteL / costoRegresoO2L : Infinity;
  const nivel = ratio >= 1.5 ? "verde" : ratio >= 1.3 ? "amarillo" : "rojo";
  return { ratio, nivel };
}
// ---------- Radiación ----------
export const RADIACION = {
  SUPERFICIE_mSv_DIA: 0.64,
  VIAJE_mSv_DIA: 1.84,
  LIMITE_CARRERA_mSv: 600,
  TASA_NORMAL_MAX_uGy_DIA: 225, // rango normal medido: 180–225 µGy/día
};
export function dosisMision(diasIda, diasSuperficie, diasRegreso) {
  const totalmSv = (diasIda + diasRegreso) * RADIACION.VIAJE_mSv_DIA +
    diasSuperficie * RADIACION.SUPERFICIE_mSv_DIA;
  return {
    totalmSv,
    porcentajeLimite: (totalmSv / RADIACION.LIMITE_CARRERA_mSv) * 100,
  };
}
// Alerta si la tasa supera el rango normal medido (posible SPE).
export function detectarSPE(lecturas, umbral = RADIACION.TASA_NORMAL_MAX_uGy_DIA) {
  const ultima = lecturas[lecturas.length - 1];
  return ultima !== undefined && ultima.tasa_uGy_dia > umbral;
}
// Dosis acumulada de la EVA integrando lecturas (resultado en µGy).
export function dosisEVA(lecturas) {
  let total = 0;
  for (let i = 1; i < lecturas.length; i++) {
    const dtDias = (lecturas[i].timestamp - lecturas[i - 1].timestamp) / 86_400_000;
    total += lecturas[i - 1].tasa_uGy_dia * dtDias;
  }
  return total;
}
