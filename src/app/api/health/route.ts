import { getAdminClient } from '@/infrastructure/supabase/admin-client';
export async function GET() {
  const start = performance.now();
  try {
    const { data, error } = await getAdminClient().rpc('ping');
    const ok = !error && data === 1;
    return Response.json(
      {
        status: ok ? 'ok' : 'error',
        db: ok ? 'ok' : 'error',
        time: Math.round(performance.now() - start),
      },
      { status: ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return Response.json(
      { status: 'error', db: 'error', time: Math.round(performance.now() - start) },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
