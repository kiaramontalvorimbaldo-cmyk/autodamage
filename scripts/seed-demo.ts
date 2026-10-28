import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';
import { loadEnvLocal, requireEnv } from './lib/load-env';
import { calcularCostos, costoPieza, type EntradaBaremo } from '../src/domain/cost/cost';
import { triage } from '../src/domain/triage/triage';
import type { Accion, Severidad } from '../src/domain/types';

loadEnvLocal();

const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const RESET = process.argv.includes('--reset');

type UsuarioDemo = {
  email: string;
  password: string;
  nombre: string;
  rol: 'ASEGURADO' | 'PERITO' | 'TALLER' | 'ADMIN';
  numeroLicencia?: string;
  nombreTaller?: string;
};

const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? 'Demo123456!';

const usuarios: UsuarioDemo[] = [
  {
    email: 'asegurado@demo.com',
    password: DEMO_PASSWORD,
    nombre: 'Ana Asegurado Demo',
    rol: 'ASEGURADO',
  },
  {
    email: 'perito@demo.com',
    password: DEMO_PASSWORD,
    nombre: 'Carlos Perito Demo',
    rol: 'PERITO',
    numeroLicencia: 'LIC-DEMO-001',
  },
  {
    email: 'taller@demo.com',
    password: DEMO_PASSWORD,
    nombre: 'Taller El Freno Demo',
    rol: 'TALLER',
    nombreTaller: 'Taller El Freno Demo',
  },
  {
    email: 'admin@demo.com',
    password: DEMO_PASSWORD,
    nombre: 'Dana Admin Demo',
    rol: 'ADMIN',
  },
];

async function buscarIdPorEmail(email: string): Promise<string | null> {
  const { data } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
  const usuario = data?.users.find((u) => u.email === email);
  return usuario?.id ?? null;
}

async function asegurarBucketEvidencias(): Promise<void> {
  const { data: buckets } = await supabase.storage.listBuckets();
  const existe = buckets?.some((b) => b.name === 'evidencias');
  if (!existe) {
    console.log('  Creando bucket de storage "evidencias"...');
    await supabase.storage.createBucket('evidencias', { public: true });
  }
}

async function crearUsuariosDemo(): Promise<Record<string, string>> {
  const ids: Record<string, string> = {};

  for (const usuario of usuarios) {
    if (RESET) {
      const existingId = await buscarIdPorEmail(usuario.email);
      if (existingId) {
        await supabase.auth.admin.deleteUser(existingId);
      }
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email: usuario.email,
      password: usuario.password,
      email_confirm: true,
      user_metadata: { nombre_completo: usuario.nombre },
    });

    let userId = data?.user?.id ?? null;

    if (error) {
      if (error.message.includes('already registered') || error.status === 422) {
        userId = await buscarIdPorEmail(usuario.email);
        if (userId) {
          // Aseguramos que la contraseña y metadatos coincidan con la especificación
          await supabase.auth.admin.updateUserById(userId, {
            password: usuario.password,
            user_metadata: { nombre_completo: usuario.nombre },
          });
        }
      } else {
        console.error(`  Error creando ${usuario.email}: ${error.message}`);
        continue;
      }
    }

    if (!userId) {
      console.error(`  No se pudo obtener el id de ${usuario.email}`);
      continue;
    }

    await supabase.from('usuarios').update({ rol: usuario.rol }).eq('id', userId);

    if (usuario.rol === 'PERITO' && usuario.numeroLicencia) {
      await supabase
        .from('peritos')
        .upsert(
          { usuario_id: userId, numero_licencia: usuario.numeroLicencia, estado: 'ACTIVO' },
          { onConflict: 'usuario_id' },
        );
    }

    if (usuario.rol === 'TALLER' && usuario.nombreTaller) {
      await supabase
        .from('talleres')
        .upsert({ usuario_id: userId, nombre: usuario.nombreTaller, activo: true }, { onConflict: 'usuario_id' });
    }

    ids[usuario.rol] = userId;
    console.log(`  ${usuario.email} → rol ${usuario.rol} listo`);
  }

  return ids;
}

async function crearVehiculoDemo(aseguradoId: string): Promise<string> {
  const matricula = 'DEMO-001';
  const existing = await supabase.from('vehiculos').select('id').eq('matricula', matricula).maybeSingle();
  if (existing.data) {
    console.log(`  Vehículo ${matricula} ya existe`);
    return existing.data.id;
  }

  const { data, error } = await supabase
    .from('vehiculos')
    .insert({
      asegurado_id: aseguradoId,
      matricula,
      marca: 'Toyota',
      modelo: 'Corolla',
      numero_poliza: 'POL-DEMO-001',
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(`No se pudo crear el vehículo demo: ${error?.message ?? 'error desconocido'}`);
  }

  console.log(`  Vehículo ${matricula} creado`);
  return data.id;
}

async function generarImagenSvg(texto: string): Promise<Buffer> {
  const svg = `<svg width="1280" height="960" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#e5e7eb"/>
    <text x="50%" y="50%" font-family="Arial" font-size="48" fill="#374151" text-anchor="middle" dominant-baseline="middle">${texto}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 80 }).toBuffer();
}

async function subirImagen(siniestroId: string, imagenId: string, texto: string): Promise<string> {
  const buffer = await generarImagenSvg(texto);
  const camino = `${siniestroId}/${imagenId}.jpg`;

  const { error } = await supabase.storage.from('evidencias').upload(camino, buffer, {
    contentType: 'image/jpeg',
    upsert: true,
  });

  if (error) {
    throw new Error(`No se pudo subir imagen ${texto}: ${error.message}`);
  }

  return camino;
}

async function calcularDHash(imagen: Buffer): Promise<string> {
  const { data } = await sharp(imagen).grayscale().resize(9, 8, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  let bits = '';
  for (let fila = 0; fila < 8; fila += 1) {
    for (let columna = 0; columna < 8; columna += 1) {
      const indice = fila * 9 + columna;
      bits += data[indice] < data[indice + 1] ? '1' : '0';
    }
  }
  let hex = '';
  for (let nibble = 0; nibble < 16; nibble += 1) {
    const trozo = bits.slice(nibble * 4, nibble * 4 + 4);
    hex += parseInt(trozo, 2).toString(16).toUpperCase();
  }
  return hex;
}

type SiniestroDemo = {
  descripcion: string;
  latitud: number;
  longitud: number;
  fechaIncidente: string;
  piezas: Array<{ codigo: string; accion: Accion; confianza: number; bbox: [number, number, number, number] }>;
  severidad: Severidad;
  estructurales: { danoEstructural: boolean; airbags: boolean; perdidaTotal: boolean };
  confianzaGlobal: number;
};

const siniestrosDemo: SiniestroDemo[] = [
  {
    descripcion: '[DEMO] Ruta VERDE: Faro delantero izquierdo roto',
    latitud: 19.4326,
    longitud: -99.1332,
    fechaIncidente: new Date(Date.now() - 86400000 * 2).toISOString(),
    piezas: [
      { codigo: 'FARO_DEL_IZQ', accion: 'SUSTITUIR', confianza: 0.95, bbox: [100, 200, 400, 600] },
    ],
    severidad: 'LEVE',
    estructurales: { danoEstructural: false, airbags: false, perdidaTotal: false },
    confianzaGlobal: 0.95,
  },
  {
    descripcion: '[DEMO] Ruta AMARILLA: Puerta delantera derecha y espejo roto',
    latitud: 19.4326,
    longitud: -99.1332,
    fechaIncidente: new Date(Date.now() - 86400000 * 3).toISOString(),
    piezas: [
      { codigo: 'PUERTA_DEL_DER', accion: 'REPARAR', confianza: 0.85, bbox: [200, 100, 800, 900] },
      { codigo: 'ESPEJO_DER', accion: 'SUSTITUIR', confianza: 0.88, bbox: [300, 400, 500, 600] },
    ],
    severidad: 'MODERADO',
    estructurales: { danoEstructural: false, airbags: false, perdidaTotal: false },
    confianzaGlobal: 0.85,
  },
  {
    descripcion: '[DEMO] Ruta ROJA: Daño estructural severo con deformación',
    latitud: 19.4326,
    longitud: -99.1332,
    fechaIncidente: new Date(Date.now() - 86400000 * 1).toISOString(),
    piezas: [
      { codigo: 'CAPO', accion: 'SUSTITUIR', confianza: 0.95, bbox: [100, 100, 900, 700] },
    ],
    severidad: 'SEVERO',
    estructurales: { danoEstructural: true, airbags: false, perdidaTotal: false },
    confianzaGlobal: 0.93,
  },
];

const BAREMO_FALLBACK: Record<string, EntradaBaremo> = {
  PARAGOLPES_DEL: { costo_repuesto_base: 180, horas_mano_obra: 2.5, costo_hora_mo: 30 },
  PARAGOLPES_TRA: { costo_repuesto_base: 170, horas_mano_obra: 2.5, costo_hora_mo: 30 },
  FARO_DEL_IZQ: { costo_repuesto_base: 120, horas_mano_obra: 1.0, costo_hora_mo: 30 },
  FARO_DEL_DER: { costo_repuesto_base: 120, horas_mano_obra: 1.0, costo_hora_mo: 30 },
  FARO_TRA_IZQ: { costo_repuesto_base: 70, horas_mano_obra: 0.8, costo_hora_mo: 30 },
  FARO_TRA_DER: { costo_repuesto_base: 70, horas_mano_obra: 0.8, costo_hora_mo: 30 },
  CAPO: { costo_repuesto_base: 260, horas_mano_obra: 3.0, costo_hora_mo: 30 },
  GUARDABARRO_DEL_IZQ: { costo_repuesto_base: 140, horas_mano_obra: 2.0, costo_hora_mo: 30 },
  GUARDABARRO_DEL_DER: { costo_repuesto_base: 140, horas_mano_obra: 2.0, costo_hora_mo: 30 },
  PUERTA_DEL_IZQ: { costo_repuesto_base: 300, horas_mano_obra: 3.5, costo_hora_mo: 30 },
  PUERTA_DEL_DER: { costo_repuesto_base: 300, horas_mano_obra: 3.5, costo_hora_mo: 30 },
  PUERTA_TRA_IZQ: { costo_repuesto_base: 280, horas_mano_obra: 3.5, costo_hora_mo: 30 },
  PUERTA_TRA_DER: { costo_repuesto_base: 280, horas_mano_obra: 3.5, costo_hora_mo: 30 },
  PARABRISAS: { costo_repuesto_base: 220, horas_mano_obra: 2.0, costo_hora_mo: 30 },
  LUNETA_TRA: { costo_repuesto_base: 160, horas_mano_obra: 2.0, costo_hora_mo: 30 },
  ESPEJO_IZQ: { costo_repuesto_base: 60, horas_mano_obra: 0.5, costo_hora_mo: 30 },
  ESPEJO_DER: { costo_repuesto_base: 60, horas_mano_obra: 0.5, costo_hora_mo: 30 },
  PORTON_MALETERO: { costo_repuesto_base: 290, horas_mano_obra: 3.0, costo_hora_mo: 30 },
  PARRILLA: { costo_repuesto_base: 55, horas_mano_obra: 0.7, costo_hora_mo: 30 },
  TAPA_COMBUSTIBLE: { costo_repuesto_base: 25, horas_mano_obra: 0.4, costo_hora_mo: 30 },
};

async function obtenerMapaBaremo(): Promise<Map<string, EntradaBaremo>> {
  const { data } = await supabase
    .from('baremo_mock')
    .select('codigo_pieza, costo_repuesto_base, horas_mano_obra, costo_hora_mo');

  const mapa = new Map<string, EntradaBaremo>();
  if (data && data.length > 0) {
    for (const fila of data) {
      mapa.set(fila.codigo_pieza, {
        costo_repuesto_base: Number(fila.costo_repuesto_base),
        horas_mano_obra: Number(fila.horas_mano_obra),
        costo_hora_mo: Number(fila.costo_hora_mo),
      });
    }
  } else {
    for (const [k, v] of Object.entries(BAREMO_FALLBACK)) {
      mapa.set(k, v);
    }
  }
  return mapa;
}

async function crearSiniestroDemo(
  aseguradoId: string,
  vehiculoId: string,
  tallerUsuarioId: string,
  demo: SiniestroDemo,
  numeroSiniestro: number,
  baremoMap: Map<string, EntradaBaremo>,
): Promise<void> {
  const existing = await supabase
    .from('siniestros')
    .select('id')
    .eq('vehiculo_id', vehiculoId)
    .eq('descripcion', demo.descripcion)
    .maybeSingle();

  if (existing.data && !RESET) {
    console.log(`  Siniestro demo ${numeroSiniestro} ya existe (${existing.data.id.slice(0, 8)}), omitiendo`);
    return;
  }

  const { data: siniestro, error } = await supabase
    .from('siniestros')
    .insert({
      asegurado_id: aseguradoId,
      vehiculo_id: vehiculoId,
      descripcion: demo.descripcion,
      latitud: demo.latitud,
      longitud: demo.longitud,
      fecha_incidente: demo.fechaIncidente,
      estado: 'PENDIENTE',
      analisis_estado: 'NO_INICIADO',
      etiquetas: [],
    })
    .select('id')
    .single();

  if (error || !siniestro) {
    throw new Error(`No se pudo crear siniestro demo: ${error?.message ?? 'error desconocido'}`);
  }

  const siniestroId = siniestro.id;
  console.log(`  Siniestro ${numeroSiniestro} creado: ${siniestroId.slice(0, 8)}`);

  const imagenId = crypto.randomUUID();
  const storagePath = await subirImagen(siniestroId, imagenId, `Foto demo ${numeroSiniestro}`);
  const imagenBuffer = await generarImagenSvg(`Foto demo ${numeroSiniestro}`);
  const hash = await calcularDHash(imagenBuffer);

  await supabase.from('imagenes_siniestro').insert({
    id: imagenId,
    siniestro_id: siniestroId,
    storage_path: storagePath,
    hash_perceptual: hash,
    capturada_en: demo.fechaIncidente,
    latitud: demo.latitud,
    longitud: demo.longitud,
    orden: 0,
    rostros_difuminados: false,
  });

  const resCostos = calcularCostos(
    demo.piezas.map((p) => ({ codigo_pieza: p.codigo, accion: p.accion })),
    baremoMap,
  );

  const decision = triage({
    severidad: demo.severidad,
    estructurales: demo.estructurales,
    costoTotalUsd: resCostos.costoTotalUsd,
    verdictFraude: 'SIN_RIESGO',
    confianzaGlobal: demo.confianzaGlobal,
    iaDisponible: true,
    piezasValidas: resCostos.piezasValidas,
  });

  const { data: inspeccion, error: errorInspeccion } = await supabase
    .from('inspecciones_periciales')
    .insert({
      siniestro_id: siniestroId,
      tipo_inspeccion: decision.tipoInspeccion,
      verdict_fraude: 'SIN_RIESGO',
      indicadores_fraude: [],
      nivel_severidad: demo.severidad,
      costo_total_estimado: resCostos.costoTotalUsd,
      confianza_global: demo.confianzaGlobal,
      modelo_ia: 'mock',
      version_prompt: 'demo',
      respuesta_ia: null,
    })
    .select('id')
    .single();

  if (errorInspeccion || !inspeccion) {
    throw new Error(`No se pudo crear inspección: ${errorInspeccion?.message ?? 'error desconocido'}`);
  }

  for (let i = 0; i < demo.piezas.length; i += 1) {
    const pieza = demo.piezas[i];
    const entrada = baremoMap.get(pieza.codigo) ?? {
      costo_repuesto_base: 0,
      horas_mano_obra: 1,
      costo_hora_mo: 30,
    };
    const costo = costoPieza({ codigo_pieza: pieza.codigo, accion: pieza.accion }, entrada);
    await supabase.from('evaluacion_detallada_danos').insert({
      inspeccion_id: inspeccion.id,
      codigo_pieza: pieza.codigo,
      accion_requerida: pieza.accion,
      horas_mano_obra: entrada.horas_mano_obra,
      costo_pieza_estimado: costo,
      confianza: pieza.confianza,
      imagen_id: imagenId,
      bbox: pieza.bbox,
      aprobado_por_perito: true,
    });
  }

  await supabase
    .from('siniestros')
    .update({
      estado: decision.estado,
      ruta: decision.ruta,
      requiere_inspeccion_presencial: decision.requiereInspeccionPresencial,
      analisis_estado: 'COMPLETADO',
      etiquetas: decision.etiquetas,
    })
    .eq('id', siniestroId);

  await supabase.from('audit_log').insert({
    entidad: 'siniestro',
    entidad_id: siniestroId,
    accion: 'TRIAJE_DECIDIDO',
    actor_tipo: 'SISTEMA',
    datos: {
      ruta: decision.ruta,
      estado: decision.estado,
      tipoInspeccion: decision.tipoInspeccion,
      requierePresencial: decision.requiereInspeccionPresencial,
      razones: decision.razones,
      costoTotalUsd: resCostos.costoTotalUsd,
    },
  });

  if (decision.ruta === 'VERDE') {
    const { data: tallerDemo } = await supabase
      .from('talleres')
      .select('id')
      .eq('usuario_id', tallerUsuarioId)
      .maybeSingle();

    if (tallerDemo) {
      const { data: ordenExistente } = await supabase
        .from('ordenes_trabajo')
        .select('id')
        .eq('siniestro_id', siniestroId)
        .maybeSingle();

      if (!ordenExistente) {
        await supabase.from('ordenes_trabajo').insert({
          siniestro_id: siniestroId,
          taller_id: tallerDemo.id,
          estado: 'EMITIDA',
          monto_autorizado: resCostos.costoTotalUsd,
        });
        console.log(`  Orden de trabajo asignada a taller demo (${tallerDemo.id}) para siniestro ${numeroSiniestro} (VERDE)`);
      }
    }
  }

  console.log(`  Siniestro ${numeroSiniestro}: ruta=${decision.ruta}, estado=${decision.estado}, costo=${resCostos.costoTotalUsd}`);
}

async function main() {
  console.log('=== Seed de datos de demostración ===');
  if (RESET) console.log('Modo --reset: se eliminarán los datos demo anteriores');

  await asegurarBucketEvidencias();

  if (RESET) {
    const { data: demoClaims } = await supabase
      .from('siniestros')
      .select('id')
      .ilike('descripcion', '[DEMO]%');
    if (demoClaims && demoClaims.length > 0) {
      console.log(`  Eliminando ${demoClaims.length} siniestros demo anteriores...`);
      for (const dc of demoClaims) {
        await supabase.from('siniestros').delete().eq('id', dc.id);
      }
    }
  }

  console.log('\n[1/4] Creando usuarios demo...');
  const ids = await crearUsuariosDemo();

  console.log('\n[2/4] Creando vehículo demo...');
  const vehiculoId = await crearVehiculoDemo(ids.ASEGURADO);

  console.log('\n[3/4] Creando siniestros demo...');
  const baremoMap = await obtenerMapaBaremo();
  for (let i = 0; i < siniestrosDemo.length; i += 1) {
    await crearSiniestroDemo(ids.ASEGURADO, vehiculoId, ids.TALLER, siniestrosDemo[i], i + 1, baremoMap);
  }

  console.log('\n[4/4] Resumen de cuentas de prueba:');
  console.log(`  ASEGURADO:  asegurado@demo.com / ${DEMO_PASSWORD}`);
  console.log(`  PERITO:     perito@demo.com / ${DEMO_PASSWORD}`);
  console.log(`  TALLER:     taller@demo.com / ${DEMO_PASSWORD}`);
  console.log(`  ADMIN:      admin@demo.com / ${DEMO_PASSWORD}`);

  console.log('\nSeed de demostración completado con éxito.');
}

main().catch((error) => {
  console.error('Error fatal en seed-demo:', error);
  process.exit(1);
});
