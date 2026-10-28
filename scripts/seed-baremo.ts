import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { loadEnvLocal, requireEnv } from './lib/load-env';

loadEnvLocal();

async function main() {
  const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

  type PiezaBaremo = {
    codigo_pieza: string;
    pieza_nombre: string;
    costo_repuesto_base: number;
    horas_mano_obra: number;
  };

  const baremoPath = resolve(process.cwd(), 'supabase/seed/baremo.json');
  const piezas = JSON.parse(readFileSync(baremoPath, 'utf8')) as PiezaBaremo[];

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const filas = piezas.map((p) => ({
    codigo_pieza: p.codigo_pieza,
    pieza_nombre: p.pieza_nombre,
    marca_vehiculo: 'GENERICO',
    costo_repuesto_base: p.costo_repuesto_base,
    horas_mano_obra: p.horas_mano_obra,
    costo_hora_mo: 30.0,
  }));

  const { error } = await supabase.from('baremo_mock').upsert(filas, {
    onConflict: 'codigo_pieza',
  });

  if (error) {
    console.error('Error al cargar el baremo:', error.message);
    process.exit(1);
  }

  console.log(`Baremo cargado correctamente: ${filas.length} piezas (upsert por codigo_pieza).`);
}

main().catch(console.error);
