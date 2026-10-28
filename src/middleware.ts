import type { NextRequest } from 'next/server';
import { refreshSession } from '@/infrastructure/supabase/refresh-session';
export function middleware(request: NextRequest) {
  return refreshSession(request);
}
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|json|webmanifest)$).*)',
  ],
};
