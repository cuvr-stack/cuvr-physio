'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase-browser';

const ff = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

type Stage = 'idle' | 'enrolled' | 'enrolling-qr' | 'enrolling-verify';

export function MFASettings() {
  const [stage, setStage]   = useState<Stage>('idle');
  const [qrSvg, setQrSvg]   = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [verifiedFactorId, setVerifiedFactorId] = useState<string | null>(null);
  const [code, setCode]     = useState('');
  const [busy, setBusy]     = useState(false);
  const [msg, setMsg]       = useState<{ kind: 'err' | 'ok'; text: string } | null>(null);
  const [loading, setLoading] = useState(true);

  // On mount, check if a verified factor already exists
  useEffect(() => { refreshFactors(); }, []);

  async function refreshFactors() {
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) { setLoading(false); return; }
    const verified = data?.totp.find(f => f.status === 'verified');
    if (verified) {
      setStage('enrolled');
      setVerifiedFactorId(verified.id);
    } else {
      setStage('idle');
      setVerifiedFactorId(null);
    }
    setLoading(false);
  }

  // ── Begin enrollment ───────────────────────────────────────────────────────
  async function startEnroll() {
    setBusy(true); setMsg(null);
    const supabase = createClient();

    // Clean up any unverified factors (Supabase rejects duplicate enrolls)
    const { data: existing } = await supabase.auth.mfa.listFactors();
    for (const f of existing?.totp ?? []) {
      if (f.status !== 'verified') {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
    }

    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'Authenticator App',
    });
    setBusy(false);

    if (error || !data) {
      setMsg({ kind: 'err', text: error?.message ?? 'Could not start enrollment.' });
      return;
    }
    setQrSvg(data.totp.qr_code);
    setSecret(data.totp.secret);
    setFactorId(data.id);
    setStage('enrolling-qr');
  }

  // ── Verify the user-entered code to finish enrollment ─────────────────────
  async function verifyEnroll() {
    if (!factorId) return;
    setBusy(true); setMsg(null);
    const supabase = createClient();
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code: code.trim(),
    });
    setBusy(false);

    if (error) {
      setMsg({ kind: 'err', text: error.message });
      return;
    }
    setMsg({ kind: 'ok', text: 'Two-factor authentication enabled.' });
    setCode(''); setQrSvg(null); setSecret(null); setFactorId(null);
    await refreshFactors();
  }

  // ── Disable MFA ────────────────────────────────────────────────────────────
  async function disable() {
    if (!verifiedFactorId) return;
    if (!confirm('Disable two-factor authentication? Your account will be less secure.')) return;
    setBusy(true); setMsg(null);
    const supabase = createClient();
    const { error } = await supabase.auth.mfa.unenroll({ factorId: verifiedFactorId });
    setBusy(false);
    if (error) { setMsg({ kind: 'err', text: error.message }); return; }
    setMsg({ kind: 'ok', text: '2FA disabled.' });
    await refreshFactors();
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return <p style={{ fontSize: 11, color: '#445566', margin: 0 }}>Checking 2FA status…</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%',
          background: stage === 'enrolled' ? '#10b981' : '#445566',
          boxShadow: stage === 'enrolled' ? '0 0 8px #10b981' : 'none',
        }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>
          Two-Factor Authentication
        </span>
        <span style={{
          marginLeft: 'auto', fontSize: 9, fontWeight: 700, letterSpacing: 1.5,
          padding: '2px 8px', borderRadius: 4,
          background: stage === 'enrolled' ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.05)',
          color: stage === 'enrolled' ? '#10b981' : '#6688aa',
          border: `1px solid ${stage === 'enrolled' ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.1)'}`,
          textTransform: 'uppercase',
        }}>
          {stage === 'enrolled' ? 'Enabled' : 'Disabled'}
        </span>
      </div>

      <p style={{ fontSize: 10, color: '#445566', margin: 0, lineHeight: 1.55 }}>
        Adds a 6-digit code from your authenticator app on every sign in.
      </p>

      {/* Enrolled — show disable */}
      {stage === 'enrolled' && (
        <button onClick={disable} disabled={busy} style={btn('danger', busy)}>
          {busy ? 'Disabling…' : 'Disable 2FA'}
        </button>
      )}

      {/* Idle — show enable */}
      {stage === 'idle' && (
        <button onClick={startEnroll} disabled={busy} style={btn('primary', busy)}>
          {busy ? 'Starting…' : 'Enable 2FA'}
        </button>
      )}

      {/* QR shown */}
      {stage === 'enrolling-qr' && qrSvg && (
        <div style={{
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 10, padding: 14,
        }}>
          <p style={{ fontSize: 11, color: '#aabbcc', margin: '0 0 10px', lineHeight: 1.55 }}>
            <strong style={{ color: '#fff' }}>Step 1.</strong> Scan this QR with Google Authenticator,
            Authy, or 1Password.
          </p>
          <div style={{
            background: '#fff', borderRadius: 8, padding: 12,
            display: 'flex', justifyContent: 'center', alignItems: 'center',
          }}>
            <img
              src={qrSvg}
              alt="Scan with your authenticator app"
              style={{ width: 200, height: 200, display: 'block' }}
            />
          </div>
          {secret && (
            <details style={{ marginTop: 10 }}>
              <summary style={{ fontSize: 10, color: '#6688aa', cursor: 'pointer' }}>
                Can't scan? Enter manually
              </summary>
              <p style={{
                fontSize: 11, color: '#fff', fontFamily: 'monospace', letterSpacing: 1,
                background: 'rgba(0,0,0,0.3)', padding: '8px 10px', borderRadius: 6,
                margin: '6px 0 0', wordBreak: 'break-all',
              }}>
                {secret}
              </p>
            </details>
          )}
          <button
            onClick={() => setStage('enrolling-verify')}
            style={{ ...btn('primary', false), marginTop: 12 }}
          >
            I've added the account → Continue
          </button>
        </div>
      )}

      {/* Verify */}
      {stage === 'enrolling-verify' && (
        <div style={{
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 10, padding: 14,
        }}>
          <p style={{ fontSize: 11, color: '#aabbcc', margin: '0 0 10px', lineHeight: 1.55 }}>
            <strong style={{ color: '#fff' }}>Step 2.</strong> Enter the 6-digit code shown in your app.
          </p>
          <input
            autoFocus
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="123456"
            inputMode="numeric"
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '12px', background: 'rgba(0,0,0,0.3)',
              border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
              color: '#fff', fontSize: 18, letterSpacing: 6,
              textAlign: 'center', fontFamily: 'monospace', outline: 'none',
            }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button
              onClick={() => { setStage('idle'); setQrSvg(null); setSecret(null); setCode(''); }}
              style={{ ...btn('ghost', busy), flex: 1 }}
            >
              Cancel
            </button>
            <button
              onClick={verifyEnroll}
              disabled={busy || code.length !== 6}
              style={{ ...btn('primary', busy || code.length !== 6), flex: 2 }}
            >
              {busy ? 'Verifying…' : 'Verify & Enable'}
            </button>
          </div>
        </div>
      )}

      {msg && (
        <p style={{
          fontSize: 11, margin: 0,
          color: msg.kind === 'ok' ? '#10b981' : '#ef4444',
        }}>
          {msg.text}
        </p>
      )}
    </div>
  );
}

function btn(kind: 'primary' | 'danger' | 'ghost', disabled: boolean): React.CSSProperties {
  const base: React.CSSProperties = {
    padding: '10px', borderRadius: 8,
    fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
    cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: ff,
    border: '1px solid transparent', color: '#fff',
    transition: 'all 0.15s',
  };
  if (kind === 'primary') {
    return {
      ...base,
      background: disabled ? 'rgba(99,60,180,0.4)' : 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
      border: 'none',
    };
  }
  if (kind === 'danger') {
    return {
      ...base,
      background: disabled ? 'rgba(239,68,68,0.2)' : 'rgba(239,68,68,0.1)',
      borderColor: 'rgba(239,68,68,0.4)',
      color: '#ef4444',
    };
  }
  return {
    ...base,
    background: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.1)',
    color: '#6688aa',
  };
}
