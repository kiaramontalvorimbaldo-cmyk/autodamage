import { PortalShell } from '@/components/layout/portal-shell';
import { requirePortalUser } from '@/lib/auth/require-portal-user';
export default async function Layout({ children }: { children: React.ReactNode }) {
  const user = await requirePortalUser('PERITO');
  return (
    <PortalShell rol={user.rol} nombre={user.nombre}>
      {children}
    </PortalShell>
  );
}
