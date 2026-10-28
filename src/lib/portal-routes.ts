import type { Rol } from '@/domain/types';
const RUTAS_PORTAL = ['/asegurado', '/perito', '/taller', '/admin'] as const;
const PORTAL_POR_ROL: Record<Rol, string> = {
  ASEGURADO: '/asegurado',
  PERITO: '/perito',
  TALLER: '/taller',
  ADMIN: '/admin',
};
export function esRol(value: unknown): value is Rol {
  return typeof value === 'string' && Object.hasOwn(PORTAL_POR_ROL, value);
}
export function portalPorRol(rol: Rol): string {
  return PORTAL_POR_ROL[rol];
}
export function esRutaProtegida(path: string): boolean {
  return RUTAS_PORTAL.some((ruta) => path === ruta || path.startsWith(ruta + '/'));
}
export function esRutaDelPortal(path: string, portal: string): boolean {
  return path === portal || path.startsWith(portal + '/');
}
