/**
 * Umbrales y constantes del dominio.
 */
export const COSTO_LIMITE_VERDE_USD = 500; // el costo debe ser ESTRICTAMENTE menor
export const CONFIANZA_MINIMA = 0.6; // por debajo → ruta AMARILLA
export const GPS_DISTANCIA_MAX_M = 500; // se usa max(500, precision_gps_m)
export const EDAD_MAX_CAPTURA_MIN = 15; // captura vs. momento de recepción en servidor
export const HAMMING_MAX_DUPLICADO = 5; // bits de 64
export const FACTOR_PINTURA = 0.6; // fracción de horas de MO para PINTAR
export const MAX_IMAGENES = 5;
export const MAX_BYTES_IMAGEN = 1_500_000;
export const EXPIRACION_URL_FIRMADA_SEG = 3600; // 60 min
