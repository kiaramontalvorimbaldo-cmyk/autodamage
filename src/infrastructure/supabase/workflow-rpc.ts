import type { SupabaseClient } from '@supabase/supabase-js';
import { getAdminClient } from './admin-client';
type WorkflowName =
  | 'registrar_dictamen_atomico'
  | 'avanzar_orden_atomico'
  | 'emitir_orden_atomico'
  | 'registrar_imagen_atomica'
  | 'entregar_ampliacion_atomica'
  | 'guardar_analisis_atomico'
  | 'fallar_analisis_reservado'
  | 'recuperar_analisis_detenido';
/** Adaptador hasta regenerar los tipos de Functions desde el proyecto remoto. */
export function workflowRpc(nombre: WorkflowName, args: Record<string, unknown>) {
  const cliente = getAdminClient() as unknown as SupabaseClient;
  return cliente.rpc(nombre, args);
}
