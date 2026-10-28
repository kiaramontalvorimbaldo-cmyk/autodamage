const isDev = process.env.NODE_ENV === 'development';

/** La respuesta HTML usa un nonce nuevo; el valor estático protege recursos sin HTML. */
export function contentSecurityPolicy(nonce?: string, development = isDev): string {
  const scriptSrc = development
    ? "'self' 'unsafe-inline' 'unsafe-eval'"
    : "'self' https://cdn.jsdelivr.net" + (nonce ? " 'nonce-" + nonce + "' 'strict-dynamic'" : '');
  return [
    "default-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    'script-src ' + scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.supabase.co https://*.tile.openstreetmap.org https://unpkg.com",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://generativelanguage.googleapis.com",
    "worker-src 'self' blob:",
    "media-src 'self' blob:",
  ].join('; ');
}

export const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: contentSecurityPolicy(),
  },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(self), geolocation=(self), microphone=()',
  },
];
