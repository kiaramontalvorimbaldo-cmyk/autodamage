'use client';

import { useEffect } from 'react';

/** Registro mínimo; el worker nunca almacena respuestas privadas. */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    void navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .catch(() => {
        // La aplicación sigue funcionando por red si el navegador no admite el registro.
      });
  }, []);
  return null;
}
