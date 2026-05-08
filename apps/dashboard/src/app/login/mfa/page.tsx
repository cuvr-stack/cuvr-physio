'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';

export default function MFAChallengePage() {
  const router = useRouter();
  const [code, setCode]         = useState('');
  const [factorId, setFactorId] = useState<string | null>(null);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [bootstrapping, setBoot] = useState(true);

  // Find the user's verified TOTP factor
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error || !data) { setError('Could not load 2FA factor.'); setBoot(false); return; }

      const verified = data.totp.find(f => f.status === 'verified');
      if (!verified) {
        // No factor enabled — nothing to challenge, send them home.
        router.push('/');
        return;
      }
      setFactorId(verified.id);
      setBoot(false);
    })();
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setError('');
    setLoading(true);
    const supabase = createClient();

    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code: code.trim(),
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    router.push('/');
    router.refresh();
  }

  async function cancel() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <main style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0d0b1e 0%, #0f1a2e 50%, #091a1a 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      padding: 24,
    }}>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 8 }}>
          <img src="/cuvr-logo.png" alt="CUVR Logo" style={{ width: 52, height: 26, objectFit: 'contain' }} />
          <span style={{ fontSize: 28, fontWeight: 800, letterSpacing: 2, color: '#fff' }}>
            CU<span style={{ color: '#a855f7' }}>VR</span>
          </span>
        </div>
        <p style={{ fontSize: 11, letterSpacing: 4, color: '#5577aa', fontWeight: 500, textTransform: 'uppercase' }}>
          Two-Factor Verification
        </p>
      </div>

      <div style={{
        width: '100%', maxWidth: 420,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 16, padding: '36px 40px',
        backdropFilter: 'blur(20px)',
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12, margin: '0 auto 18px',
          background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a855f7',
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>

        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#fff', margin: '0 0 6px', textAlign: 'center' }}>
          Enter your 6-digit code
        </h1>
        <p style={{ fontSize: 12, color: '#6688aa', margin: '0 0 24px', textAlign: 'center' }}>
          Open your authenticator app to continue.
        </p>

        {bootstrapping ? (
          <p style={{ textAlign: 'center', color: '#445566', fontSize: 12 }}>Loading…</p>
        ) : (
          <form onSubmit={handleSubmit}>
            <input
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
              inputMode="numeric"
              autoComplete="one-time-code"
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '14px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10, color: '#fff',
                fontSize: 22, letterSpacing: 8, textAlign: 'center',
                fontFamily: 'monospace', outline: 'none',
              }}
              onFocus={e => e.currentTarget.style.borderColor = 'rgba(168,85,247,0.6)'}
              onBlur={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
            />

            {error && (
              <div style={{
                background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 8, padding: '10px 14px', marginTop: 14,
                fontSize: 13, color: '#fca5a5',
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || code.length !== 6}
              style={{
                width: '100%', marginTop: 20, padding: '13px',
                background: loading || code.length !== 6
                  ? 'rgba(99,60,180,0.4)'
                  : 'linear-gradient(90deg, #3b82f6, #8b5cf6, #06b6d4)',
                border: 'none', borderRadius: 8,
                color: '#fff', fontSize: 14, fontWeight: 700, letterSpacing: 0.5,
                cursor: loading ? 'wait' : code.length !== 6 ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Verifying…' : 'Verify & Continue'}
            </button>

            <button
              type="button"
              onClick={cancel}
              style={{
                width: '100%', marginTop: 10, padding: '11px',
                background: 'transparent', border: 'none',
                color: '#6688aa', fontSize: 12, cursor: 'pointer',
              }}
            >
              Cancel and sign out
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
