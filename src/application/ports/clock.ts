/**
 * Puerto del reloj. El dominio recibe el "ahora" como parámetro
 * (nunca llama a Date.now() internamente).
 */
export interface Clock {
  ahora(): Date;
}

export const clockDelSistema: Clock = {
  ahora: () => new Date(),
};

/** Reloj inmutable para pruebas. */
export function clockFijo(instante: Date): Clock {
  return { ahora: () => instante };
}
