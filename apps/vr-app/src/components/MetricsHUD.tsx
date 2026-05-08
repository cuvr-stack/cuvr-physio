'use client';

import { useEffect } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useSessionStore } from '@/store/sessionStore';
import { useLiveMetrics } from '@/hooks/useMetrics';

const ff = '"SF Mono", Menlo, Monaco, Consolas, monospace';

export function MetricsHUD() {
  const state          = useGameStore((s) => s.state);
  const score          = useGameStore((s) => s.score);
  const combo          = useGameStore((s) => s.combo);
  const successCount   = useGameStore((s) => s.successCount);
  const missCount      = useGameStore((s) => s.missCount);
  const lastResponseMs = useGameStore((s) => s.lastResponseTimeMs);
  const targetsTotal   = useGameStore((s) => s.targets.length);
  const activeIdx      = useGameStore((s) => s.activeTargetIndex);

  const currentROM = useSessionStore((s) => s.currentROM);
  const session    = useSessionStore((s) => s.session);
  const metrics    = useLiveMetrics();

  // Coach-pushed live state
  const challenge      = useGameStore((s) => s.challenge);
  const toasts         = useGameStore((s) => s.toasts);
  const dismissToast   = useGameStore((s) => s.dismissToast);
  const targetROM      = useGameStore((s) => s.currentTargetROM);

  // Auto-dismiss toasts after 4 seconds
  useEffect(() => {
    if (!toasts.length) return;
    const timers = toasts.map(t =>
      setTimeout(() => dismissToast(t.ts), 4000 - (Date.now() - t.ts)),
    );
    return () => { timers.forEach(clearTimeout); };
  }, [toasts, dismissToast]);

  // Hide the HUD outside an active session (setup screen is showing instead)
  if (!session) return null;

  const progress = targetsTotal > 0 ? Math.min(100, Math.round((activeIdx / targetsTotal) * 100)) : 0;

  return (
    <>
      {/* Top-left — score + combo */}
      <div style={{
        position: 'fixed', top: 90, left: 24, zIndex: 5,
        fontFamily: ff, color: '#fff',
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,58,160,0.35)',
        borderRadius: 12, padding: '14px 18px',
        boxShadow: '0 8px 30px rgba(255,58,160,0.15)',
        pointerEvents: 'none',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div>
            <p style={{ fontSize: 9, letterSpacing: 2, color: '#ff3aa0', margin: 0, fontWeight: 600 }}>SCORE</p>
            <p style={{ fontSize: 28, fontWeight: 800, margin: 0, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
              {score.toLocaleString()}
            </p>
          </div>
          <div style={{ width: 1, alignSelf: 'stretch', background: 'rgba(255,255,255,0.12)' }} />
          <div>
            <p style={{ fontSize: 9, letterSpacing: 2, color: '#06b6d4', margin: 0, fontWeight: 600 }}>COMBO</p>
            <p style={{
              fontSize: 24, fontWeight: 800, margin: 0, lineHeight: 1,
              color: combo >= 5 ? '#ffd166' : '#fff',
              textShadow: combo >= 5 ? '0 0 12px #ffd166' : 'none',
              fontVariantNumeric: 'tabular-nums',
            }}>
              ×{combo}
            </p>
          </div>
        </div>
        {/* Progress through round */}
        <div style={{
          marginTop: 12, height: 4, background: 'rgba(255,255,255,0.08)',
          borderRadius: 2, overflow: 'hidden',
        }}>
          <div style={{
            height: '100%', width: `${progress}%`,
            background: 'linear-gradient(90deg, #ff3aa0, #06b6d4)',
            transition: 'width 0.3s',
          }} />
        </div>
      </div>

      {/* Top-right — live motion metrics */}
      <div style={{
        position: 'fixed', top: 90, right: 24, zIndex: 5,
        fontFamily: ff, color: '#fff', fontSize: 11,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        border: '1px solid rgba(139,92,246,0.35)',
        borderRadius: 12, padding: '12px 16px',
        minWidth: 220,
        pointerEvents: 'none',
      }}>
        <Row label="PEAK VELOCITY" value={`${metrics.peakVelocity.toFixed(2)} m/s`} color="#a855f7" />
        <Row label="SMOOTHNESS"    value={`${Math.round(metrics.smoothness)}%`}    color="#06b6d4" />
        <Row label="EFFICIENCY"    value={`${Math.round(metrics.efficiency)}%`}    color="#10b981" />
        <Row label="ROM"           value={`${Math.round(currentROM)}° / ${targetROM}°`} color="#f59e0b" />
        <Row label="RESPONSE"      value={lastResponseMs ? `${lastResponseMs} ms` : '—'} color="#ec4899" last />
      </div>

      {/* Bottom-left — counters */}
      <div style={{
        position: 'fixed', bottom: 24, left: 24, zIndex: 5,
        fontFamily: ff, color: '#fff', fontSize: 11,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 10, padding: '10px 16px',
        display: 'flex', gap: 18, letterSpacing: 1.5,
        pointerEvents: 'none',
      }}>
        <Counter label="SUCCESS" value={successCount} color="#10b981" />
        <Counter label="MISS"    value={missCount}    color="#ef4444" />
      </div>

      {/* Active AI challenge — bottom-center banner during play */}
      {challenge && state === 'playing' && (
        <div style={{
          position: 'fixed', bottom: 70, left: '50%', transform: 'translateX(-50%)',
          zIndex: 5,
          fontFamily: ff,
          background: challenge.earned
            ? 'linear-gradient(90deg, rgba(16,185,129,0.18), rgba(6,182,212,0.18))'
            : 'rgba(15,15,36,0.85)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          border: `1px solid ${challenge.earned ? 'rgba(16,185,129,0.5)' : 'rgba(245,158,11,0.4)'}`,
          borderRadius: 12, padding: '10px 16px',
          maxWidth: 480,
          boxShadow: challenge.earned ? '0 0 24px rgba(16,185,129,0.35)' : '0 6px 22px rgba(0,0,0,0.4)',
          pointerEvents: 'none',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18 }}>{challenge.earned ? '🏆' : '🎯'}</span>
            <div>
              <p style={{ fontSize: 9, letterSpacing: 2, color: challenge.earned ? '#10b981' : '#f59e0b', margin: 0, fontWeight: 700 }}>
                {challenge.earned ? 'CHALLENGE EARNED' : "TODAY'S CHALLENGE"}
              </p>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', margin: '2px 0 0' }}>
                {challenge.title}
              </p>
              <p style={{ fontSize: 11, color: '#aabbcc', margin: '2px 0 0' }}>
                {challenge.description}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Coach toasts — top-center, auto-dismissed after 4s */}
      {toasts.length > 0 && (
        <div style={{
          position: 'fixed', top: 24, left: '50%', transform: 'translateX(-50%)',
          zIndex: 6, display: 'flex', flexDirection: 'column', gap: 8,
          pointerEvents: 'none', fontFamily: ff,
        }}>
          {toasts.map(t => {
            const tint = t.kind === 'target_up'   ? '#10b981'
                       : t.kind === 'target_down' ? '#f59e0b'
                       : t.kind === 'earned'      ? '#06b6d4'
                       : '#a855f7';
            return (
              <div key={t.ts} style={{
                background: 'rgba(15,15,36,0.92)',
                border: `1px solid ${tint}66`,
                borderRadius: 10, padding: '10px 16px',
                color: '#fff', fontSize: 12, fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 10,
                animation: 'coach-toast-in 0.25s ease-out',
                boxShadow: `0 4px 16px ${tint}33`,
              }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: tint, boxShadow: `0 0 8px ${tint}` }} />
                {t.text}
              </div>
            );
          })}
          <style>{`
            @keyframes coach-toast-in {
              from { opacity: 0; transform: translateY(-8px); }
              to   { opacity: 1; transform: translateY(0); }
            }
          `}</style>
        </div>
      )}

      {/* Round-end CTA banner */}
      {state === 'round-end' && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 6,
          fontFamily: ff, color: '#fff',
          background: 'rgba(15,15,36,0.92)',
          border: '1px solid rgba(139,92,246,0.4)',
          borderRadius: 12, padding: '14px 18px',
          maxWidth: 320,
        }}>
          <p style={{ fontSize: 11, letterSpacing: 2, color: '#a855f7', margin: '0 0 4px', fontWeight: 700 }}>
            ROUND COMPLETE
          </p>
          <p style={{ fontSize: 12, color: '#aabbcc', margin: 0, lineHeight: 1.55 }}>
            Hit <strong style={{ color: '#fff' }}>End Session</strong> when you're ready.
            Stats are saved to the patient's record.
          </p>
        </div>
      )}
    </>
  );
}

function Row({ label, value, color, last }: { label: string; value: string; color: string; last?: boolean }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      gap: 14, padding: '4px 0',
      borderBottom: last ? 'none' : '1px solid rgba(255,255,255,0.04)',
    }}>
      <span style={{ color, fontSize: 9, letterSpacing: 1.5, fontWeight: 600 }}>{label}</span>
      <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  );
}

function Counter({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}` }} />
      <span style={{ color, fontWeight: 600 }}>{label}</span>
      <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </span>
  );
}
