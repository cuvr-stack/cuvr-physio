'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-browser';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const idleNotice = searchParams.get('reason') === 'idle';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    // If account has 2FA enabled, step up to AAL2 before allowing access.
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') {
      router.push('/login/mfa');
      return;
    }

    router.push('/');
    router.refresh();
  }

  return (
    <main style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0d0b1e 0%, #0f1a2e 50%, #091a1a 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      position: 'relative',
      overflow: 'hidden',
    }}>

      {/* Ambient glow effects */}
      <div style={{
        position: 'absolute', top: '15%', left: '10%',
        width: 400, height: 400,
        background: 'radial-gradient(circle, rgba(120,60,200,0.15) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '20%', right: '10%',
        width: 350, height: 350,
        background: 'radial-gradient(circle, rgba(0,180,180,0.12) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Neural wave lines */}
      <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0.06, pointerEvents: 'none' }}>
        <path d="M-100,300 Q200,200 400,350 T900,280 T1400,320" stroke="#8855ff" strokeWidth="1.5" fill="none" />
        <path d="M-100,400 Q300,280 500,420 T1000,360 T1400,400" stroke="#00cccc" strokeWidth="1" fill="none" />
        <path d="M-100,200 Q150,150 350,250 T800,190 T1400,230" stroke="#8855ff" strokeWidth="0.8" fill="none" />
      </svg>

      {/* Side icons */}
      <div style={{ position: 'absolute', left: 60, top: '50%', transform: 'translateY(-50%)', opacity: 0.25 }}>
        <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="#aa66ff" strokeWidth="1.2">
          <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.44-4.14Z"/>
          <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.44-4.14Z"/>
        </svg>
      </div>
      <div style={{ position: 'absolute', right: 60, bottom: '30%', opacity: 0.2 }}>
        <svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="#00ccaa" strokeWidth="1.2">
          <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
          <path d="M2 20h4"/><line x1="6" y1="20" x2="6" y2="16"/>
        </svg>
      </div>

      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 8 }}>
          <img src="/cuvr-logo.png" alt="CUVR Logo" style={{ width: 52, height: 26, objectFit: 'contain' }} />
          <span style={{ fontSize: 28, fontWeight: 800, letterSpacing: 2, color: '#fff' }}>
            CU<span style={{ color: '#a855f7' }}>VR</span>
          </span>
        </div>
        <p style={{ fontSize: 11, letterSpacing: 4, color: '#5577aa', fontWeight: 500, textTransform: 'uppercase' }}>
          Zenith Clinic Systems
        </p>
      </div>

      {/* Card */}
      <div style={{
        width: '100%', maxWidth: 420,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 16,
        padding: '36px 40px',
        backdropFilter: 'blur(20px)',
      }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', margin: '0 0 6px' }}>
          Practitioner Portal
        </h1>
        <p style={{ fontSize: 13, color: '#6688aa', margin: '0 0 28px' }}>
          Authenticate to access VR recovery wings
        </p>

        {idleNotice && (
          <div style={{
            display: 'flex', gap: 10, alignItems: 'flex-start',
            background: 'rgba(245,158,11,0.1)',
            border: '1px solid rgba(245,158,11,0.3)',
            borderRadius: 8, padding: '11px 14px', marginBottom: 18,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}>
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
            <p style={{ fontSize: 12, color: '#f59e0b', margin: 0, lineHeight: 1.5 }}>
              You were signed out due to inactivity. Please sign in again to continue.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Email */}
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: 2, color: '#5577aa', marginBottom: 8, textTransform: 'uppercase' }}>
            Clinical Email
          </label>
          <div style={{ position: 'relative', marginBottom: 20 }}>
            <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#5577aa' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="dr.smith@zenithclinic.com"
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '12px 14px 12px 40px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8, color: '#fff', fontSize: 14,
                outline: 'none',
              }}
              onFocus={e => e.target.style.borderColor = 'rgba(168,85,247,0.6)'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
            />
          </div>

          {/* Password */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, color: '#5577aa', textTransform: 'uppercase' }}>
              Password
            </label>
            <Link href="/forgot-password" style={{ fontSize: 12, color: '#06b6d4', textDecoration: 'none' }}>
              recover key
            </Link>
          </div>
          <div style={{ position: 'relative', marginBottom: 24 }}>
            <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#5577aa' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••••••"
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '12px 14px 12px 40px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8, color: '#fff', fontSize: 14,
                outline: 'none',
              }}
              onFocus={e => e.target.style.borderColor = 'rgba(168,85,247,0.6)'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
            />
          </div>

          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 8, padding: '10px 14px', marginBottom: 16,
              fontSize: 13, color: '#fca5a5',
            }}>
              {error}
            </div>
          )}

          {/* Sign In button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '13px',
              background: loading ? 'rgba(99,60,180,0.5)' : 'linear-gradient(90deg, #3b82f6, #8b5cf6, #06b6d4)',
              border: 'none', borderRadius: 8,
              color: '#fff', fontSize: 15, fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              letterSpacing: 0.5,
            }}
          >
            {loading ? 'Authenticating…' : (
              <>
                Sign In
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </>
            )}
          </button>
        </form>

        {/* Warning banner */}
        <div style={{
          marginTop: 24,
          background: 'rgba(239,68,68,0.07)',
          border: '1px solid rgba(239,68,68,0.15)',
          borderRadius: 8, padding: '12px 14px',
          display: 'flex', gap: 10, alignItems: 'flex-start',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}>
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <p style={{ fontSize: 10, color: '#7a4444', letterSpacing: 0.5, lineHeight: 1.6, margin: 0, textTransform: 'uppercase' }}>
            Authorized personnel only. Access to this terminal is monitored by clinical compliance protocols. Unauthorized attempts will be logged.
          </p>
        </div>
      </div>

      {/* Footer */}
      <div style={{ marginTop: 28, textAlign: 'center' }}>
        <div style={{ display: 'flex', gap: 24, justifyContent: 'center', marginBottom: 10 }}>
          {['Privacy Protocol', 'System Status', 'Support'].map((item) => (
            <a key={item} href="#" style={{ fontSize: 11, letterSpacing: 1.5, color: '#334466', textDecoration: 'none', textTransform: 'uppercase' }}>
              {item}
            </a>
          ))}
        </div>
        <p style={{ fontSize: 11, color: '#223344', letterSpacing: 0.5 }}>
          © 2026 CUVR Spatial Systems. All sensors active.
        </p>
      </div>
    </main>
  );
}
