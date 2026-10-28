import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Acceso a tablas mientras no existan tipos generados
 * (`database.types.ts` requiere un proyecto Supabase real).
 *
 * El cliente sin tipos devuelve filas `unknown`;
 * el mapeo a entidades de dominio se hace de forma
 * explícita con las funciones `a*` de cada repositorio.
 */
type Tabla = ReturnType<SupabaseClient['from']>;

export function tabla(cliente: SupabaseClient, nombre: string): Tabla {
  return cliente.from(nombre);
}
