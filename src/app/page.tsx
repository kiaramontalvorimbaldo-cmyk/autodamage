import { redirect } from 'next/navigation';

/**
 * Raíz de la app: redirige al login.
 * Si hay sesión, el middleware redirige al portal del rol.
 */
export default function HomePage() {
  redirect('/login');
}
