'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const ff = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface PatientStatus {
  id: string;
  status: 'active' | 'discharged' | string | null;
  discharged_at: string | null;
  discharged_reason: string | null;
}

/**
 * Header button: "Discharge" when active, "Reactivate" when discharged.
 * Opens a confirmation modal. After success, refreshes the server component.
 */
export function PatientLifecycleControls({ patient }: { patient: PatientStatus }) {
  const router = useRouter();
  const [open, setOpen]         = useState(false);
  const [reason, setReason]     = useState('');
  const [busy, setBusy]         = useState(false);
  const [err, setErr]           = useState<string | null>(null);

  const isDischarged = patient.status === 'discharged';

  async function discharge() {
    setBusy(true); setErr(null);
    try {
      const r = await fetch(`${API}/api/patients/${patient.id}/discharge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() || undefined }),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? `API ${r.status}`);
      setOpen(false); setReason('');
      router.refresh();
    } catch (e: any) {
      setErr(e?.message ?? 'Could not discharge.');
    } finally { setBusy(false); }
  }

  async function reactivate() {
    setBusy(true); setErr(null);
    try {
      const r = await fetch(`${API}/api/patients/${patient.id}/reactivate`, { method: 'POST' });
      if (!r.ok) throw new Error((await r.json()).error ?? `API ${r.status}`);
      setOpen(false);
      router.refresh();
    } catch (e: any) {
      setErr(e?.message ?? 'Could not reactivate.');
    } finally { setBusy(false); }
  }

  return (
    <>
      <button
        onClick={() => { setOpen(true); setErr(null); }}
        title={isDischarged ? 'Reactivate this patient' : 'Discharge this patient'}
        style={{
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '8px 14px',
          background: isDischarged
            ? 'rgba(16,185,129,0.1)'
            : 'rgba(245,158,11,0.1)',
          border: `1px solid ${isDischarged ? 'rgba(16,185,129,0.35)' : 'rgba(245,158,11,0.35)'}`,
          borderRadius: 8,
          color: isDischarged ? '#10b981' : '#f59e0b',
          fontSize: 11, fontWeight: 700, letterSpacing: 1,
          cursor: 'pointer', textTransform: 'uppercase',
          fontFamily: ff,
        }}
      >
        {isDischarged ? (
          <>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 12a9 9 0 0 0-15-6.7L3 8" /><path d="M3 3v5h5" />
            </svg>
            Reactivate
          </>
        ) : (
          <>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Discharge
          </>
        )}
      </button>

      {open && (
        <div
          onClick={() => !busy && setOpen(false)}
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
              width: 440, background: '#0f0f24',
              border: `1px solid ${isDischarged ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`,
              borderRadius: 16,
              padding: '24px 26px',
              boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
            }}
          >
            <h2 style={{ fontSize: 16, fontWeight: 800, color: '#fff', margin: '0 0 6px' }}>
              {isDischarged ? 'Reactivate patient?' : 'Discharge patient?'}
            </h2>
            <p style={{ fontSize: 12, color: '#aabbcc', margin: '0 0 18px', lineHeight: 1.55 }}>
              {isDischarged
                ? "The patient will return to your active list. Their session history is unchanged."
                : "The patient will be marked as discharged and any future scheduled appointments will be cancelled. Their session history is preserved and the patient can be reactivated later."}
            </p>

            {!isDischarged && (
              <div style={{ marginBottom: 16 }}>
                <label style={{
                  display: 'block', fontSize: 10, letterSpacing: 2, color: '#5577aa',
                  fontWeight: 600, textTransform: 'uppercase', marginBottom: 6,
                }}>
                  Reason <span style={{ color: '#334455', letterSpacing: 0 }}>(optional)</span>
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Treatment goals met, patient achieved full ROM and pain-free movement."
                  rows={3}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: '10px 12px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8, color: '#fff', fontSize: 13, outline: 'none',
                    fontFamily: ff, resize: 'none',
                  }}
                />
              </div>
            )}

            {err && (
              <div style={{
                fontSize: 12, color: '#fca5a5',
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 8, padding: '8px 12px', marginBottom: 14,
              }}>
                {err}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setOpen(false)}
                disabled={busy}
                style={{
                  flex: 1, padding: '11px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8, color: '#6688aa',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  fontFamily: ff,
                }}
              >
                Cancel
              </button>
              <button
                onClick={isDischarged ? reactivate : discharge}
                disabled={busy}
                style={{
                  flex: 2, padding: '11px',
                  background: busy
                    ? 'rgba(99,60,180,0.4)'
                    : isDischarged
                      ? 'linear-gradient(90deg, #10b981, #059669)'
                      : 'linear-gradient(90deg, #f59e0b, #d97706)',
                  border: 'none', borderRadius: 8,
                  color: '#fff', fontSize: 12, fontWeight: 700, letterSpacing: 0.5,
                  cursor: busy ? 'wait' : 'pointer',
                  fontFamily: ff,
                }}
              >
                {busy
                  ? (isDischarged ? 'Reactivating…' : 'Discharging…')
                  : (isDischarged ? 'Confirm Reactivate' : 'Confirm Discharge')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Top-of-page banner shown when the patient is currently discharged. */
export function DischargedBanner({ patient }: { patient: PatientStatus }) {
  if (patient.status !== 'discharged') return null;
  const dt = patient.discharged_at ? new Date(patient.discharged_at) : null;
  return (
    <div style={{
      background: 'rgba(245,158,11,0.08)',
      border: '1px solid rgba(245,158,11,0.25)',
      borderLeft: '3px solid #f59e0b',
      borderRadius: 10,
      padding: '12px 16px',
      marginBottom: 18,
      display: 'flex', alignItems: 'flex-start', gap: 12,
      fontFamily: ff,
    }}>
      <div style={{
        width: 26, height: 26, borderRadius: 7, flexShrink: 0,
        background: 'rgba(245,158,11,0.18)',
        border: '1px solid rgba(245,158,11,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#f59e0b',
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b', margin: 0 }}>
          Patient Discharged{dt ? ` · ${dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
        </p>
        <p style={{ fontSize: 11, color: '#aabbcc', margin: '3px 0 0', lineHeight: 1.5 }}>
          {patient.discharged_reason
            ? <><span style={{ color: '#6688aa' }}>Reason:</span> {patient.discharged_reason}</>
            : <span style={{ color: '#6688aa' }}>No reason recorded.</span>}
        </p>
      </div>
    </div>
  );
}
