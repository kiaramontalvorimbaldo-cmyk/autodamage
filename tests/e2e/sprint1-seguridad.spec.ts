import { test, expect } from '@playwright/test';
for (const portal of ['/asegurado', '/perito', '/taller', '/admin', '/admin/personal'])
  test('debería proteger ' + portal + ' sin sesión', async ({ page }) => {
    await page.goto(portal);
    await expect(page).toHaveURL(/\/login/);
  });
test('debería evitar publicar accesos demo y contraseñas', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
  await expect(page.getByText('Copiar contraseña')).toHaveCount(0);
  await expect(page.getByText('Administrador Demo')).toHaveCount(0);
});
test('debería volver al inicio desde el registro', async ({ page }) => {
  await page.goto('/registro');
  await page.getByRole('link', { name: 'Volver al inicio' }).click();
  await expect(page).toHaveURL('/login');
});

test('debería renderizar con nonce distinto por petición', async ({ page }) => {
  const response = await page.goto('/login');
  const policy = response?.headers()['content-security-policy'];
  const nonce = policy?.match(/'nonce-([^']+)'/)?.[1];
  expect(nonce).toBeTruthy();
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
  const inlineNonces = await page
    .locator('script:not([src])')
    .evaluateAll((elements) => elements.map((element) => (element as HTMLScriptElement).nonce));
  expect(inlineNonces.length).toBeGreaterThan(0);
  expect(inlineNonces.every((value) => value === nonce)).toBe(true);
  const other = await page.request.get('/login');
  expect(other.headers()['content-security-policy']).not.toBe(policy);
});
