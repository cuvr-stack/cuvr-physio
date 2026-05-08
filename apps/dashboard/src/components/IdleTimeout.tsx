'use client';

/**
 * Idle auto-logout for clinical PHI exposure.
 *
 *  • Watches global activity (mouse, keyboard, scroll, touch).
 *  • Resets the timer on each event (throttled to 1Hz).
 *  • At T-warning, shows a confirm modal with a countdown.
 *  • At T, calls supabase.auth.signOut() and redirects to /login?reason=idle.
 *  • Multiple tabs share the "last activity" timestamp via localStorage,
 *    so being active in one tab keeps the others alive.
 *  • Skipped on auth pages (/login, /signup, /forgot-password, /login/mfa).
 *
 *  Tunable via .env.local:
 *      NEXT_PUBLIC_IDLE_TIMEOUT_MS   default 900000  (15 min)
 *      NEXT_PUBLIC_IDLE_WARNING_MS   default  30000  (30 s)
 */

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';

const IDLE_MS    = Number(process.env.NEXT_PUBLIC_IDLE_TIMEOUT_MS ?? 15 * 60 * 1000);
const WARNING_MS = Number(process.env.NEXT_PUBLIC_IDLE_WARNING_MS ?? 30 * 1000);
const ACTIVITY_KEY = 'cuvr.lastActivity.v1';

const ACTIVITY_EVENTS: (keyof DocumentEventMap)[] = [
  'mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'wheel',
];

const PUBLIC_PATHS = new Set(['/login', '/signup', '/forgot-password', '/login/mfa']);

const ff = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export function IdleTimeout() {
  const router = useRouter();
  const pathname = usePathname();
  const [warning, setWarning] = useState(false);
  const [countdown, setCountdown] = useState(Math.ceil(WARNING_MS / 1000));

  const lastActivityRef = useRef<number>(Date.now());
  const lastWriteRef    = useRef<number>(0);          // throttle for localStorage writes
  const tickerRef       = useRef<NodeJS.Timeout | null>(null);
  const signedOutRef    = useRef(false);

  const enabled = !PUBLIC_PATHS.has(pathname);

  function recordActivity() {
    const now = Date.now();
    lastActivityRef.current = now;
    // Throttle localStorage writes to once per second
    if (now - lastWriteRef.current > 1000) {
      lastWriteRef.current = now;
      try { localStorage.setItem(ACTIVITY_KEY, String(now)); } catch { /* quota / SSR */ }
    }
    if (warning) setWarning(false);
  }

  // ── Wire up activity listeners + cross-tab sync ──
  useEffect(() => {
    if (!enabled) return;

    // One-time visible breadcrumb so you can confirm the timer is armed.
    console.log(
      `[idle-timeout] armed for ${Math.round(IDLE_MS / 1000)}s, warning at ${Math.round(WARNING_MS / 1000)}s`,
    );

    const onActivity = () => recordActivity();
    for (const ev of ACTIVITY_EVENTS) document.addEventListener(ev, onActivity, { passive: true });

    const onStorage = (e: StorageEvent) => {
      if (e.key !== ACTIVITY_KEY || !e.newValue) return;
      const ts = Number(e.newValue);
      if (!Number.isFinite(ts)) return;
      // Another tab saw activity — pull our local timestamp forward and dismiss any warning
      if (ts > lastActivityRef.current) {
        lastActivityRef.current = ts;
        setWarning(false);
      }
    };
    window.addEventListener('storage', onStorage);

    // Seed from existing localStorage if newer (e.g. user opened a 2nd tab while active)
    try {
      const seeded = Number(localStorage.getItem(ACTIVITY_KEY));
      if (Number.isFinite(seeded) && seeded > lastActivityRef.current) {
        lastActivityRef.current = seeded;
      }
    } catch { /* ignore */ }

    return () => {
      for (const ev of ACTIVITY_EVENTS) document.removeEventListener(ev, onActivity);
      window.removeEventListener('storage', onStorage);
    };
  }, [enabled]);

  // ── Reset state when navigating to/from auth pages ──
  useEffect(() => {
    if (!enabled) {
      setWarning(false);
      // Note: keep signedOutRef.current as-is — we'll reset it when we re-enter
      // a protected page (below). That avoids racey re-fire during the redirect.
    } else {
      // We've entered a protected page → clear the "already signed out" flag
      // and treat the navigation itself as activity.
      signedOutRef.current = false;
      recordActivity();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // ── 1 Hz tick: check idle, drive countdown, sign out at T ──
  // Note: we DELIBERATELY do not include `warning` in the deps. The interval
  // reads the latest state via setState callbacks + setCountdown, so no stale
  // closure problem; including `warning` would tear down and rebuild the timer
  // on every toggle which causes a one-second jitter in the countdown.
  useEffect(() => {
    if (!enabled) return;

    tickerRef.current = setInterval(async () => {
      if (signedOutRef.current) return;

      const idleFor = Date.now() - lastActivityRef.current;

      if (idleFor >= IDLE_MS) {
        signedOutRef.current = true;
        if (tickerRef.current) clearInterval(tickerRef.current);
        try {
          const supabase = createClient();
          await supabase.auth.signOut();
        } catch { /* middleware will catch it on next nav */ }
        router.push('/login?reason=idle');
        router.refresh();
        return;
      }

      const msUntilTimeout = IDLE_MS - idleFor;
      if (msUntilTimeout <= WARNING_MS) {
        setWarning(true);
        setCountdown(Math.max(1, Math.ceil(msUntilTimeout / 1000)));
      } else {
        setWarning(prev => (prev ? false : prev));
      }
    }, 1000);

    return () => {
      if (tickerRef.current) clearInterval(tickerRef.current);
    };
  }, [enabled, router]);

  if (!enabled || !warning) return null;

  const pctRemaining = Math.max(0, Math.min(100, (countdown / Math.ceil(WARNING_MS / 1000)) * 100));

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: ff,
      }}
    >
      <div
        style={{
          width: 420, background: '#0f0f24',
          border: '1px solid rgba(245,158,11,0.4)',
          borderRadius: 16, padding: '26px 28px',
          boxShadow: '0 24px 80px rgba(0,0,0,0.65)',
        }}
      >
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 14 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10, flexShrink: 0,
            background: 'rgba(245,158,11,0.18)',
            border: '1px solid rgba(245,158,11,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#f59e0b',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: '#fff', margin: '0 0 4px' }}>
              Are you still there?
            </h2>
            <p style={{ fontSize: 12, color: '#aabbcc', margin: 0, lineHeight: 1.55 }}>
              You'll be signed out in <strong style={{ color: '#f59e0b' }}>{countdown}s</strong> for inactivity.
              Click the button to stay signed in.
            </p>
          </div>
        </div>

        {/* Countdown bar */}
        <div style={{
          height: 4, background: 'rgba(255,255,255,0.06)',
          borderRadius: 2, overflow: 'hidden', marginBottom: 18,
        }}>
          <div style={{
            height: '100%', width: `${pctRemaining}%`,
            background: 'linear-gradient(90deg, #f59e0b, #ef4444)',
            transition: 'width 1s linear',
          }} />
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={async () => {
              signedOutRef.current = true;
              try {
                const supabase = createClient();
                await supabase.auth.signOut();
              } catch { /* ignore */ }
              router.push('/login');
              router.refresh();
            }}
            style={{
              flex: 1, padding: '11px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8, color: '#aabbcc',
              fontSize: 12, fontWeight: 700, letterSpacing: 0.5,
              cursor: 'pointer', fontFamily: ff,
            }}
          >
            Sign out now
          </button>
          <button
            autoFocus
            onClick={recordActivity}
            style={{
              flex: 2, padding: '11px',
              background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
              border: 'none', borderRadius: 8,
              color: '#fff', fontSize: 12, fontWeight: 700, letterSpacing: 0.5,
              cursor: 'pointer', fontFamily: ff,
            }}
          >
            Stay signed in
          </button>
        </div>
      </div>
    </div>
  );
}
