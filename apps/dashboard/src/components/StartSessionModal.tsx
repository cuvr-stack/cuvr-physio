'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase-browser';

const ff = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

interface Patient {
  id: string;
  name: string;
  condition: string;
  session_code: string;
}

const COND_COLORS: Record<string, [string, string]> = {
  'Shoulder Impingement Syndrome': ['rgba(139,92,246,0.18)', '#a855f7'],
  'ACL Reconstruction':            ['rgba(6,182,212,0.18)',  '#06b6d4'],
  'Rotator Cuff Injury':           ['rgba(16,185,129,0.18)', '#10b981'],
  'Post-Op Mobility':              ['rgba(245,158,11,0.18)', '#f59e0b'],
  'Neural Pathway Calibration':    ['rgba(239,68,68,0.18)',  '#ef4444'],
};
function condColor(c: string): [string, string] {
  return COND_COLORS[c] ?? ['rgba(139,92,246,0.18)', '#8b5cf6'];
}

export function StartSessionModal({ onClose }: { onClose: () => void }) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [filter, setFilter]     = useState('');
  const [picked, setPicked]     = useState<Patient | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [copied, setCopied]     = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError('Not signed in.'); setLoading(false); return; }

      const { data, error: e } = await supabase
        .from('patients')
        .select('id, name, condition, session_code, status')
        .eq('physio_id', user.id)
        .order('name');

      if (e)  setError(e.message);
      // Don't offer to start sessions for discharged patients
      else    setPatients((data ?? []).filter((p: any) => (p.status ?? 'active') === 'active'));
      setLoading(false);
    })();
  }, []);

  async function copyCode() {
    if (!picked) return;
    try {
      await navigator.clipboard.writeText(picked.session_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* fall through */ }
  }

  const visible = filter
    ? patients.filter(p =>
        p.name.toLowerCase().includes(filter.toLowerCase()) ||
        p.session_code.toLowerCase().includes(filter.toLowerCase()),
      )
    : patients;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: ff,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 460, maxHeight: '80vh',
          background: '#0f0f24',
          border: '1px solid rgba(139,92,246,0.3)',
          borderRadius: 16,
          boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
        }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: '#fff', margin: '0 0 4px' }}>
              {picked ? 'Session Code' : 'Start New Session'}
            </h2>
            <p style={{ fontSize: 11, color: '#5577aa', margin: 0 }}>
              {picked
                ? 'Have the patient enter this code in their VR headset.'
                : 'Pick the patient who is starting their session.'}
            </p>
          </div>
          <button onClick={onClose} style={iconBtnStyle}>✕</button>
        </div>

        {/* Body */}
        {!picked ? (
          <>
            {/* Search */}
            <div style={{ padding: '12px 24px 0' }}>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#445566' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </span>
                <input
                  autoFocus
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Search by name or code…"
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: '10px 12px 10px 36px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8, color: '#fff', fontSize: 13, outline: 'none',
                    fontFamily: ff,
                  }}
                />
              </div>
            </div>

            {/* List */}
            <div style={{ overflowY: 'auto', padding: '12px 12px 16px' }}>
              {loading ? (
                <p style={{ color: '#445566', fontSize: 12, textAlign: 'center', padding: '24px 0' }}>
                  Loading patients…
                </p>
              ) : error ? (
                <p style={{ color: '#ef4444', fontSize: 12, textAlign: 'center', padding: '24px 0' }}>{error}</p>
              ) : visible.length === 0 ? (
                <p style={{ color: '#445566', fontSize: 12, textAlign: 'center', padding: '24px 0' }}>
                  {filter ? 'No matches.' : 'No patients yet.'}
                </p>
              ) : (
                visible.map((p) => {
                  const [bg, br] = condColor(p.condition);
                  return (
                    <button
                      key={p.id}
                      onClick={() => setPicked(p)}
                      className="ssm-row"
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        width: '100%',
                        padding: '10px 12px',
                        background: 'transparent',
                        border: '1px solid transparent',
                        borderRadius: 10,
                        cursor: 'pointer',
                        fontFamily: ff, color: '#fff',
                        textAlign: 'left',
                        transition: 'background 0.12s, border-color 0.12s',
                      }}
                    >
                      <div style={{
                        width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                        background: bg, border: `1px solid ${br}55`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 14, fontWeight: 800, color: br,
                      }}>
                        {p.name[0]}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 700, margin: 0, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {p.name}
                        </p>
                        <p style={{ fontSize: 10, margin: '2px 0 0', color: '#6688aa', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {p.condition}
                        </p>
                      </div>
                      <span style={{
                        fontFamily: 'monospace', fontSize: 12, fontWeight: 700,
                        letterSpacing: 2, color: br,
                      }}>
                        {p.session_code}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
            <style>{`
              .ssm-row:hover {
                background: rgba(139,92,246,0.08) !important;
                border-color: rgba(139,92,246,0.25) !important;
              }
            `}</style>
          </>
        ) : (
          /* Reveal step */
          <div style={{ padding: 24 }}>
            {/* Patient strip */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 10, padding: '10px 14px', marginBottom: 16,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                background: condColor(picked.condition)[0],
                border: `1px solid ${condColor(picked.condition)[1]}55`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 800, color: condColor(picked.condition)[1],
              }}>
                {picked.name[0]}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', margin: 0 }}>{picked.name}</p>
                <p style={{ fontSize: 10, color: '#6688aa', margin: '2px 0 0' }}>{picked.condition}</p>
              </div>
            </div>

            {/* Big code */}
            <div style={{
              background: 'linear-gradient(180deg, rgba(139,92,246,0.12), rgba(6,182,212,0.06))',
              border: '1px solid rgba(139,92,246,0.3)',
              borderRadius: 14, padding: '24px 16px',
              textAlign: 'center', marginBottom: 14,
            }}>
              <p style={{ fontSize: 9, letterSpacing: 3, color: '#5577aa', textTransform: 'uppercase', fontWeight: 600, margin: '0 0 12px' }}>
                Session Code
              </p>
              <p style={{
                fontFamily: 'monospace', fontSize: 38, fontWeight: 800,
                letterSpacing: 10, color: '#fff', margin: '0 0 6px',
                textShadow: '0 0 20px rgba(139,92,246,0.4)',
              }}>
                {picked.session_code}
              </p>
              <p style={{ fontSize: 10, color: '#445566', margin: 0, letterSpacing: 0.5 }}>
                Patient enters this in the VR app
              </p>
            </div>

            {/* Steps */}
            <ol style={{
              fontSize: 11, color: '#8899aa', margin: 0, padding: '0 0 0 18px',
              lineHeight: 1.8, marginBottom: 16,
            }}>
              <li>Hand the headset to the patient</li>
              <li>They open the VR app and enter the code above</li>
              <li>This dashboard's <strong style={{ color: '#a855f7' }}>VR Sessions</strong> tab shows live data once they tap Start</li>
            </ol>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setPicked(null)} style={{
                flex: 1, padding: '11px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8, color: '#6688aa', fontSize: 12, fontWeight: 700,
                cursor: 'pointer', fontFamily: ff,
              }}>
                ← Back
              </button>
              <button onClick={copyCode} style={{
                flex: 2, padding: '11px',
                background: copied
                  ? 'linear-gradient(90deg, #10b981, #059669)'
                  : 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
                border: 'none', borderRadius: 8,
                color: '#fff', fontSize: 12, fontWeight: 700, letterSpacing: 0.5,
                cursor: 'pointer', fontFamily: ff,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'background 0.2s',
              }}>
                {copied ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Copied
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                    Copy Code
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const iconBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none',
  color: '#445566', cursor: 'pointer',
  fontSize: 18, lineHeight: 1, padding: 0,
};
