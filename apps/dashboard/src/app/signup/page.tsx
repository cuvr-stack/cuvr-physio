'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-browser';

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  padding: '11px 14px 11px 40px',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8, color: '#fff', fontSize: 13,
  outline: 'none',
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 10, fontWeight: 600,
  letterSpacing: 2, color: '#5577aa', marginBottom: 6,
  textTransform: 'uppercase',
};

function InputIcon() {
  return (
    <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: '#5577aa' }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
      </svg>
    </span>
  );
}

export default function SignupPage() {
  const [form, setForm] = useState({ fullName: '', clinicName: '', email: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirmPassword) { setError('Passwords do not match.'); return; }
    if (form.password.length < 8) { setError('Password must be at least 8 characters.'); return; }

    setLoading(true);
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { full_name: form.fullName, clinic_name: form.clinicName } },
    });

    if (authError) { setError(authError.message); setLoading(false); return; }
    setDone(true);
    setLoading(false);
  }

  const pageStyle: React.CSSProperties = {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0d0b1e 0%, #0f1a2e 50%, #091a1a 100%)',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    position: 'relative', overflow: 'hidden',
  };

  if (done) {
    return (
      <main style={pageStyle}>
        <div style={{
          width: '100%', maxWidth: 400, textAlign: 'center',
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16, padding: '40px 36px', backdropFilter: 'blur(20px)',
        }}>
          <div style={{ fontSize: 44, marginBottom: 16 }}>✅</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 8 }}>Check your email</h2>
          <p style={{ fontSize: 13, color: '#6688aa', marginBottom: 24, lineHeight: 1.6 }}>
            We sent a confirmation link to <strong style={{ color: '#a78bfa' }}>{form.email}</strong>.
            Click it to activate your account, then sign in.
          </p>
          <Link href="/login" style={{
            display: 'block', padding: '12px',
            background: 'linear-gradient(90deg, #3b82f6, #8b5cf6, #06b6d4)',
            borderRadius: 8, color: '#fff', fontWeight: 600, fontSize: 14,
            textDecoration: 'none', textAlign: 'center',
          }}>
            Go to Sign In →
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      {/* Ambient glows */}
      <div style={{ position: 'absolute', top: '10%', left: '8%', width: 350, height: 350, background: 'radial-gradient(circle, rgba(120,60,200,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '15%', right: '8%', width: 300, height: 300, background: 'radial-gradient(circle, rgba(0,180,180,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />

      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 6 }}>
          <img src="/cuvr-logo.png" alt="CUVR Logo" style={{ width: 48, height: 24, objectFit: 'contain' }} />
          <span style={{ fontSize: 26, fontWeight: 800, letterSpacing: 2, color: '#fff' }}>
            CU<span style={{ color: '#a855f7' }}>VR</span>
          </span>
        </div>
        <p style={{ fontSize: 10, letterSpacing: 4, color: '#5577aa', fontWeight: 500, textTransform: 'uppercase' }}>
          Zenith Clinic Systems
        </p>
      </div>

      {/* Card */}
      <div style={{
        width: '100%', maxWidth: 420,
        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 16, padding: '32px 36px', backdropFilter: 'blur(20px)',
      }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#fff', margin: '0 0 4px' }}>Create Practitioner Account</h1>
        <p style={{ fontSize: 12, color: '#6688aa', margin: '0 0 24px' }}>Register to access the VR physiotherapy platform</p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={labelStyle}>Full Name</label>
            <div style={{ position: 'relative' }}>
              <InputIcon />
              <input type="text" required value={form.fullName} onChange={e => update('fullName', e.target.value)} placeholder="Dr. Sarah Ahmed" style={inputStyle}
                onFocus={e => e.target.style.borderColor = 'rgba(168,85,247,0.6)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Clinic Name <span style={{ color: '#334466', fontWeight: 400 }}>(optional)</span></label>
            <div style={{ position: 'relative' }}>
              <InputIcon />
              <input type="text" value={form.clinicName} onChange={e => update('clinicName', e.target.value)} placeholder="Al Noor Rehabilitation Centre" style={inputStyle}
                onFocus={e => e.target.style.borderColor = 'rgba(168,85,247,0.6)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Clinical Email</label>
            <div style={{ position: 'relative' }}>
              <InputIcon />
              <input type="email" required value={form.email} onChange={e => update('email', e.target.value)} placeholder="you@clinic.com" style={inputStyle}
                onFocus={e => e.target.style.borderColor = 'rgba(168,85,247,0.6)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Password</label>
            <div style={{ position: 'relative' }}>
              <InputIcon />
              <input type="password" required value={form.password} onChange={e => update('password', e.target.value)} placeholder="Min. 8 characters" style={inputStyle}
                onFocus={e => e.target.style.borderColor = 'rgba(168,85,247,0.6)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Confirm Password</label>
            <div style={{ position: 'relative' }}>
              <InputIcon />
              <input type="password" required value={form.confirmPassword} onChange={e => update('confirmPassword', e.target.value)} placeholder="••••••••" style={inputStyle}
                onFocus={e => e.target.style.borderColor = 'rgba(168,85,247,0.6)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
            </div>
          </div>

          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#fca5a5' }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} style={{
            padding: '13px', marginTop: 4,
            background: loading ? 'rgba(99,60,180,0.4)' : 'linear-gradient(90deg, #3b82f6, #8b5cf6, #06b6d4)',
            border: 'none', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer', letterSpacing: 0.5,
          }}>
            {loading ? 'Creating account…' : 'Create Account →'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: 12, color: '#445566', marginTop: 20 }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: '#06b6d4', textDecoration: 'none', fontWeight: 600 }}>Sign in</Link>
        </p>
      </div>

      {/* Footer */}
      <p style={{ marginTop: 24, fontSize: 11, color: '#223344', letterSpacing: 0.5 }}>
        © 2026 CUVR Spatial Systems. All sensors active.
      </p>
    </main>
  );
}
