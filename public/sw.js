/* global self, fetch, Response */
'use strict';

// No se usa Cache Storage: documentos, sesiones, API y fotos siempre van a la red.
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || event.request.mode !== 'navigate') return;
  event.respondWith(
    fetch(event.request).catch(
      () =>
        new Response(
          '<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sin conexión — AutoDamage AI</title><main><h1>Sin conexión</h1><p>Recupera la conexión a internet y vuelve a cargar la página para continuar.</p><p>Los datos del siniestro requieren una conexión segura con el servidor.</p></main></html>',
          {
            status: 503,
            headers: {
              'Content-Type': 'text/html; charset=utf-8',
              'Cache-Control': 'no-store',
              'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
            },
          },
        ),
    ),
  );
});
