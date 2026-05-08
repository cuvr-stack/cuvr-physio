import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Paths reachable without an authenticated session at all
const PUBLIC_PATHS = ['/login', '/signup', '/forgot-password'];
// Path that requires a session but is the MFA step-up itself
const MFA_CHALLENGE_PATH = '/login/mfa';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;

  // ── Not signed in ──────────────────────────────────────────────────────────
  if (!user) {
    // Public pages allowed; everything else (including MFA challenge) bounces to login
    if (PUBLIC_PATHS.includes(pathname)) return response;
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // ── Signed in: figure out MFA state ───────────────────────────────────────
  const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const currentLevel = aalData?.currentLevel ?? 'aal1';
  const nextLevel    = aalData?.nextLevel    ?? 'aal1';

  // User has a verified factor but hasn't stepped up to AAL2 yet
  const needsMfaStepUp = nextLevel === 'aal2' && currentLevel !== 'aal2';

  if (needsMfaStepUp) {
    // Allow only the MFA challenge page (and signout via API routes if any)
    if (pathname === MFA_CHALLENGE_PATH) return response;
    // Force everything else to the challenge
    return NextResponse.redirect(new URL(MFA_CHALLENGE_PATH, request.url));
  }

  // Fully authenticated (AAL2 or no MFA factor) — block re-entry into auth pages
  if (pathname === '/login' || pathname === MFA_CHALLENGE_PATH) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
