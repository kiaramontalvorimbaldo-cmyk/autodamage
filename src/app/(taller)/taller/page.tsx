import { SaludoPerfil } from '@/components/saludo-perfil';
import Link from 'next/link';

export default function TallerPage() {
  return (
    <section className="space-y-6">
      <SaludoPerfil />
      <Link
        href="/taller/ordenes"
        className="inline-block rounded-md bg-blue-600 px-4 py-2 text-sm text-white"
      >
        Ver órdenes de trabajo
      </Link>
    </section>
  );
}
