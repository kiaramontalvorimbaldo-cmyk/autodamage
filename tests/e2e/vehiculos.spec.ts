import { expect, test, type Page } from '@playwright/test';

/**
 * Usuario nuevo sin datos: registra un vehículo desde el inicio, lo ve en el
 * paso 1 del asistente, usa Atrás/Cancelar y lo edita o elimina en "Mis vehículos".
 *
 * Requisitos del entorno: proyecto de Supabase con el registro público habilitado
 * y **sin** confirmación de correo (Authentication → Providers → Email → Confirm email),
 * y un dominio de correo aceptado por el proyecto (`E2E_DOMINIO_CORREO`).
 * Ejecutar con `AI_PROVIDER=mock npm run test:e2e`.
 */
const CONTRASENA = process.env.E2E_NUEVO_USUARIO_PASSWORD;
const DOMINIO = process.env.E2E_DOMINIO_CORREO ?? 'example.com';

test.skip(
  !CONTRASENA,
  'Faltan credenciales E2E_NUEVO_USUARIO_PASSWORD (registro público sin confirmación de correo)',
);

/**
 * Espera a que React hidrate el formulario antes de interactuar: sin esto el
 * navegador hace el envío nativo (GET con los datos en la URL) en lugar de
 * llamar al manejador del formulario.
 */
async function esperarFormularioHidratado(page: Page) {
  await page.waitForLoadState('networkidle');
  await page.waitForFunction(() => {
    const form = document.querySelector('form');
    return Boolean(form && Object.keys(form).some((clave) => clave.startsWith('__reactProps')));
  });
}

test('usuario nuevo completa el flujo sin ayuda externa', async ({ page }) => {
  const sufijo = Date.now();
  const correo = `e2e-${sufijo}@${DOMINIO}`;
  const matricula = `E2E${String(sufijo % 1000000).padStart(6, '0')}`;

  // 1. Registro
  await page.goto('/registro');
  await esperarFormularioHidratado(page);
  await page.getByLabel('Nombre completo').fill('Kiara Montalvo');
  await page.getByLabel('Correo electrónico').fill(correo);
  await page.getByLabel('Contraseña').fill(CONTRASENA as string);
  await page.getByRole('button', { name: 'Registrarme' }).click();
  await page.waitForURL('**/asegurado');

  // 2. El inicio ofrece la guía porque aún no hay vehículos
  await expect(page.getByRole('heading', { name: 'Empieza por aquí' })).toBeVisible();
  await expect(page.getByText('1.')).toBeVisible();

  // 3. Registrar vehículo desde el inicio
  await page.getByRole('link', { name: 'Registrar vehículo' }).click();
  await page.waitForURL('**/asegurado/vehiculos/nuevo');
  await esperarFormularioHidratado(page);
  await page.getByLabel('Matrícula').fill(matricula.toLowerCase());
  await page.getByLabel('Marca').fill('Toyota');
  await page.getByLabel('Modelo').fill('Corolla');
  await page.getByLabel('Número de póliza').fill(`POL-${sufijo}`);
  await page.getByRole('button', { name: 'Registrar vehículo' }).click();
  await page.waitForURL('**/asegurado/vehiculos');
  await expect(page.getByRole('heading', { name: matricula })).toBeVisible();

  // 4. El vehículo aparece en el paso 1 del asistente
  await page.getByRole('link', { name: 'Reportar siniestro' }).first().click();
  await page.waitForURL('**/asegurado/nuevo-siniestro');
  await expect(page.getByRole('button', { name: new RegExp(matricula) })).toBeVisible();

  // 5. Atrás y Cancelar funcionan
  await page.getByRole('button', { name: /Toyota Corolla/ }).click();
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await expect(page.getByText('Paso 2 de 4: Detalles')).toBeVisible();
  await page.getByRole('button', { name: 'Atrás' }).click();
  await expect(page.getByText('Paso 1 de 4: Vehículo')).toBeVisible();

  await page.getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Seguir editando' }).click();

  // 6. Mis vehículos: editar
  await page.getByRole('link', { name: 'Mis vehículos' }).first().click();
  await page.waitForURL('**/asegurado/vehiculos');
  await page.getByRole('link', { name: 'Editar' }).first().click();
  await page.waitForURL('**/asegurado/vehiculos/*/editar');
  await esperarFormularioHidratado(page);
  await page.getByLabel('Modelo').fill('Corolla XLE');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await page.waitForURL('**/asegurado/vehiculos');
  await expect(page.getByText('Corolla XLE')).toBeVisible();

  // 7. Mis vehículos: eliminar con confirmación
  await page.getByRole('button', { name: 'Eliminar' }).first().click();
  await expect(page.getByRole('dialog')).toContainText('Eliminar vehículo');
  await page.getByRole('button', { name: 'Sí, eliminar' }).click();
  await expect(page.getByText('Aún no tienes vehículos')).toBeVisible();
});