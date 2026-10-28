import type { Metadata, Viewport } from 'next';

// Cada documento debe recibir el nonce de su propia petición.
export const dynamic = 'force-dynamic';
import { Toaster } from 'sonner';
import { RegisterServiceWorker } from '@/components/pwa/register-service-worker';
import './globals.css';

export const metadata: Metadata = {
  title: 'AutoDamage AI — Triaje inteligente de siniestros',
  description:
    'PWA de triaje inteligente de siniestros vehiculares: captura fotos en vivo, la IA detecta piezas dañadas y el sistema asigna una ruta de atención.',
};

export const viewport: Viewport = {
  themeColor: '#2563eb',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <link rel="manifest" href="/manifest.webmanifest" />
        {children}
        <RegisterServiceWorker />
        <Toaster richColors closeButton position="top-center" />
      </body>
    </html>
  );
}
