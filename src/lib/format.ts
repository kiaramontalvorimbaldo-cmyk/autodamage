import { roundMoney } from '@/domain/money';
import type { Rol } from '@/domain/types';

/**
 * Utilidades de formato para la capa de presentación.
 */

const ETIQUETA_ROL: Record<Rol, string> = {
  ASEGURADO: 'Asegurado',
  PERITO: 'Perito',
  TALLER: 'Taller',
  ADMIN: 'Administrador',
};

/**
 * Normaliza un nombre propio: recorta, une palabras y capitaliza cada una.
 * "  kiara   montalvo " → "Kiara Montalvo".
 */
export function formatName(nombre: string | null | undefined): string {
  if (!nombre) return '';
  return nombre
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((palabra) => palabra.charAt(0).toLocaleUpperCase('es') + palabra.slice(1))
    .join(' ');
}

/** Convierte el rol interno en un texto legible ("ASEGURADO" → "Asegurado"). */
export function rolLabel(rol: string | null | undefined): string {
  if (!rol) return '';
  return ETIQUETA_ROL[rol as Rol] ?? rol;
}
export function formatCurrencyUsd(amount: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(roundMoney(amount));
}

export function formatIsoDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}
