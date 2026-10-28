/**
 * Medición de rendimiento de las 5 acciones principales del asegurado.
 *
 * Uso:
 *   npx tsx scripts/medir-rendimiento.ts                 # http://localhost:3000
 *   npx tsx scripts/medir-rendimiento.ts http://localhost:3000 "Producción local"
 *
 * Mide, con Chrome real (Playwright, channel 'chrome', sin descargar browsers):
 *  - tiempo hasta que la pantalla muestra contenido o esqueleto (primera respuesta visual),
 *  - tiempo hasta `networkidle` (carga completa),
 *  - nº de peticiones del navegador a `supabase.co` (pestaña Network),
 *  - nº de peticiones del navegador a las rutas propias `/api/*`.
 *
 * El usuario de medición se crea con la service role key y se reutiliza.
 */
import { chromium, type BrowserContext, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import { loadEnvLocal, requireEnv } from './lib/load-env';

loadEnvLocal();

const BASE_URL = process.argv[2] ?? 'http://localhost:3000';
const ETIQUETA = process.argv[3] ?? 'servidor';
const REPETICIONES = Number(process.argv[4] ?? '5');

const EMAIL = 'medidor@autodamage.test';
const CONTRASENA = `Medidor-${randomBytes(8).toString('hex')}`;

type Accion = {
  nombre: string;
  ruta: string;
  /** Selector que debe aparecer para considerar la pantalla pintada. */
  listo: string;
};

const ACCIONES: Accion[] = [
  { nombre: 'Abrir inicio', ruta: '/asegurado', listo: 'main' },
  {
    nombre: 'Abrir "Reportar siniestro"',
    ruta: '/asegurado/nuevo-siniestro',
    listo: 'text=Reportar siniestro',
  },
  { nombre: 'Abrir "Mis vehículos"', ruta: '/asegurado/vehiculos', listo: 'main' },
  { nombre: 'Abrir "Mis siniestros"', ruta: '/asegurado/siniestros', listo: 'main' },
  { nombre: 'Crear vehículo', ruta: '/api/vehiculos', listo: 'json' },
];

type Muestra = {
  paints: number[];
  completos: number[];
  supabase: number;
  api: number;
};

async function asegurarUsuario(): Promise<void> {
  const supabase = createClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
  );

  const { data: creado, error } = await supabase.auth.admin.createUser({
    email: EMAIL,
    password: CONTRASENA,
    email_confirm: true,
    user_metadata: { nombre_completo: 'Usuario Medidor' },
  });

  if (!error && creado.user) return;

  const { data: lista } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existente = lista?.users.find((u) => u.email === EMAIL);
  if (!existente) {
    console.error(`No se pudo crear ni reutilizar el usuario de medición: ${error?.message}`);
    process.exit(1);
  }
  await supabase.auth.admin.updateUserById(existente.id, {
    password: CONTRASENA,
    email_confirm: true,
  });
  await supabase.from('usuarios').update({ rol: 'ASEGURADO' }).eq('id', existente.id);
}

async function iniciarSesion(context: BrowserContext): Promise<void> {
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Correo electrónico').fill(EMAIL);
  await page.getByLabel('Contraseña').fill(CONTRASENA);
  await page.getByRole('button', { name: /Entrar|Iniciar sesión/i }).click();
  await page.waitForURL('**/asegurado', { timeout: 30_000 });
  await page.close();
}

async function medir(context: BrowserContext, accion: Accion): Promise<Muestra[]> {
  const muestras: Muestra[] = [];

  for (let i = 0; i < REPETICIONES; i++) {
    const page: Page = await context.newPage();
    let supabase = 0;
    let api = 0;

    page.on('request', (req) => {
      const url = req.url();
      if (url.includes('supabase.co')) supabase += 1;
      else if (url.startsWith(BASE_URL) && url.includes('/api/')) api += 1;
    });

    const inicio = Date.now();
    let pintado = 0;
    if (accion.listo === 'json') {
      const respuesta = await page.request.post(`${BASE_URL}/api/vehiculos`, {
        data: {
          matricula: `MED${Date.now().toString().slice(-8)}`,
          marca: 'Toyota',
          modelo: 'Corolla',
          numero_poliza: `MED-POL-${Date.now()}`,
        },
      });
      pintado = Date.now() - inicio;
      await respuesta.dispose();
      // Una escritura no genera tráfico del navegador más allá de la propia llamada.
      api = 1;
    } else {
      await page.goto(`${BASE_URL}${accion.ruta}`, { waitUntil: 'commit' });
      await page
        .locator(accion.listo)
        .first()
        .waitFor({ state: 'visible', timeout: 60_000 });
      pintado = Date.now() - inicio;
    }

    await page.waitForLoadState('networkidle', { timeout: 60_000 }).catch(() => undefined);
    const completo = Date.now() - inicio;

    muestras.push({ paints: [pintado], completos: [completo], supabase, api });
    await page.close();
  }

  return muestras;
}

function mediana(valores: number[]): number {
  const ordenados = [...valores].sort((a, b) => a - b);
  const medio = Math.floor(ordenados.length / 2);
  return ordenados.length % 2 === 0
    ? Math.round((ordenados[medio - 1] + ordenados[medio]) / 2)
    : ordenados[medio];
}

async function main(): Promise<void> {
  await asegurarUsuario();

  const browser = await chromium.launch({ channel: 'chrome' });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await iniciarSesion(context);

  // Calentamiento: la primera carga de cada ruta incluye compilación (dev).
  for (const accion of ACCIONES) await medir(context, accion);

  const filas: {
    accion: string;
    pinta: number;
    completo: number;
    supabase: number;
    api: number;
  }[] = [];

  for (const accion of ACCIONES) {
    const muestras = await medir(context, accion);
    filas.push({
      accion: accion.nombre,
      pinta: mediana(muestras.flatMap((m) => m.paints)),
      completo: mediana(muestras.flatMap((m) => m.completos)),
      supabase: Math.round(
        muestras.reduce((acc, m) => acc + m.supabase, 0) / muestras.length,
      ),
      api: Math.round(muestras.reduce((acc, m) => acc + m.api, 0) / muestras.length),
    });
  }

  await browser.close();

  console.log(`\n### ${ETIQUETA} (${BASE_URL}) — mediana de ${REPETICIONES} repeticiones\n`);
  console.log('| Acción | Respuesta visual (ms) | Carga completa (ms) | Peticiones a supabase.co | Peticiones a /api/* |');
  console.log('| --- | ---: | ---: | ---: | ---: |');
  for (const fila of filas) {
    console.log(
      `| ${fila.accion} | ${fila.pinta} | ${fila.completo} | ${fila.supabase} | ${fila.api} |`,
    );
  }
  console.log('');
}

void main();