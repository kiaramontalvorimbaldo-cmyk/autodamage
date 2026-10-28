import Link from 'next/link';
import { obtenerPerfilActual } from '@/lib/perfil';
import { formatName, rolLabel } from '@/lib/format';

/**
 * Saludo del portal: muestra el nombre capitalizado del usuario y su rol legible.
 * Componente de servidor; si no hay sesión, indica cómo entrar.
 */
export async function SaludoPerfil() {
  const perfil = await obtenerPerfilActual();

  if (!perfil) {
    return (
      <p className="text-muted-foreground">
        No has iniciado sesión.{' '}
        <Link href="/login" className="text-primary underline">
          Ir al inicio de sesión
        </Link>
      </p>
    );
  }

  return (
    <div className="space-y-1">
      <h2 className="text-xl font-semibold">Hola, {formatName(perfil.nombre)}</h2>
      <p className="text-muted-foreground text-sm">Sesión de {rolLabel(perfil.rol)}</p>
    </div>
  );
}