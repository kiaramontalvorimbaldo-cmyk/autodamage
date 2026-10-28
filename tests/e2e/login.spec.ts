import { expect, test } from '@playwright/test';

test('muestra el formulario de inicio de sesión', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
  await expect(page.getByLabel('Correo electrónico')).toBeVisible();
  await expect(page.getByLabel('Contraseña')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
});

test('valida el correo electrónico en el cliente', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill('no-es-email');
  await page.getByLabel('Contraseña').fill('secreto123');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByText('El correo electrónico no es válido')).toBeVisible();
});
