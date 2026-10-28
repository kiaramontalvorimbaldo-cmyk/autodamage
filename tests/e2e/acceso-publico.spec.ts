import { expect, test } from '@playwright/test';

/**
 * Páginas públicas y redirección de usuarios sin sesión.
 * No requiere credenciales: sirve de red de seguridad para detectar errores
 * de JavaScript en el arranque de la aplicación.
 */
test('muestra el acceso público y protege el portal del asegurado', async ({ page }) => {
  const erroresDeConsola: string[] = [];
  page.on('pageerror', (e) => erroresDeConsola.push(e.message));

  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();

  await page.goto('/registro');
  await expect(page.getByRole('heading', { name: 'Crear cuenta' })).toBeVisible();

  await page.goto('/asegurado');
  await page.waitForURL('**/login');
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();

  expect(erroresDeConsola).toEqual([]);
});