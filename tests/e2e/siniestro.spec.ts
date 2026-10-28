import { expect, test } from '@playwright/test';

/**
 * Flujo móvil del asegurado: login → vehículo → siniestro → fotos → resultado.
 * Requiere DEV_ASEGURADO_PASSWORD y Supabase `dev` con usuarios seed.
 */
const EMAIL = process.env.DEV_ASEGURADO_EMAIL ?? 'asegurado@autodamage.test';
const PASSWORD = process.env.DEV_ASEGURADO_PASSWORD;

test.skip(!PASSWORD, 'Faltan credenciales DEV_ASEGURADO_PASSWORD');

test('flujo completo de nuevo siniestro con cámara falsa', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill(EMAIL);
  await page.getByLabel('Contraseña').fill(PASSWORD as string);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL('**/asegurado');

  const sufijo = Date.now();
  await page.request.post('/api/vehiculos', {
    data: {
      matricula: `TST${sufijo % 100000}`,
      marca: 'Test',
      modelo: 'Sedan',
      numero_poliza: `POL-${sufijo}`,
    },
  });

  await page.goto('/asegurado/nuevo-siniestro');
  await page
    .getByRole('button', { name: /Test Sedan/ })
    .first()
    .click();
  await page.getByRole('button', { name: 'Siguiente' }).click();

  await page.getByLabel('Fecha y hora del incidente').fill('2026-10-01T10:30');
  await page.getByLabel('Latitud').fill('-1.831239');
  await page.getByLabel('Longitud').fill('-78.183406');
  await page.getByRole('button', { name: 'Siguiente' }).click();

  await page.getByRole('button', { name: /activar cámara/i }).click();
  for (let i = 0; i < 3; i += 1) {
    await page.getByRole('button', { name: 'Capturar' }).click();
    await expect(page.getByAltText(`Captura ${i + 1}`)).toBeVisible();
  }
  await page.getByRole('button', { name: 'Siguiente' }).click();

  await page.getByRole('button', { name: 'Enviar siniestro' }).click();
  await page.waitForURL('**/asegurado/siniestros/**', { timeout: 15000 });
  await expect(page.getByRole('status').first()).toBeVisible();
});
