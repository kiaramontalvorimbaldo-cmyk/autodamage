import { expect, test } from '@playwright/test';

test('PWA: worker local, sin caché y aviso al perder conexión', async ({ page, request }) => {
  const respuesta = await request.get('/sw.js');
  expect(respuesta.ok()).toBeTruthy();
  expect(respuesta.headers()['cache-control']).toContain('no-store');
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  expect(await page.evaluate(async () => (await caches.keys()).length)).toBe(0);
  await page.context().setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Sin conexión', exact: true })).toBeVisible();
  expect(await page.evaluate(async () => (await caches.keys()).length)).toBe(0);
});
