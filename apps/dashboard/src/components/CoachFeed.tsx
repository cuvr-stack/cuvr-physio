'use client';

import type { CoachDecision } from '@physio-vr/shared-types';

const ff = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const DELTA_STYLE: Record<CoachDecision['difficulty_delta'], { color: string; bg: string; label: string; icon: string }> = {
  increase: { color: '#10b981', bg: 'rgba(16,185,129,0.12)',  label: 'Push',  icon: '↑' },
  decrease: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  label: 'Ease',  icon: '↓' },
  hold:     { color: '#06b6d4', bg: 'rgba(6,182,212,0.12)',   label: 'Hold',  icon: '=' },
};

function timeAgo(ts: number) {
  const diff = (Date.now() - ts) / 1000;
  if (diff < 5)  return 'now';
  if (diff < 60) return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  return `${Math.round(diff / 3600)}h ago`;
}

export function CoachFeed({
  decisions,
  patientNameById,
}: {
  decisions: CoachDecision[];
  patientNameById: Record<string, string>;
}) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 14,
      fontFamily: ff,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 7,
          background: 'linear-gradient(135deg, rgba(139,92,246,0.3), rgba(6,182,212,0.3))',
          border: '1px solid rgba(139,92,246,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            <circle cx="12" cy="12" r="4" />
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#fff', margin: 0 }}>AI Coach</p>
          <p style={{ fontSize: 9, color: '#5577aa', margin: 0, letterSpacing: 0.5 }}>
            Live decisions · {decisions.length}
          </p>
        </div>
        <span style={{
          width: 7, height: 7, borderRadius: '50%',
          background: '#10b981',
          boxShadow: '0 0 6px #10b981',
        }} />
      </div>

      {/* Feed */}
      <div style={{ maxHeight: 'calc(100vh - 240px)', overflowY: 'auto' }}>
        {decisions.length === 0 ? (
          <div style={{ padding: '28px 16px', textAlign: 'center' }}>
            <p style={{ fontSize: 11, color: '#445566', margin: 0, lineHeight: 1.6 }}>
              The coach watches each live session and posts decisions every few seconds.
              Start a session to see it in action.
            </p>
          </div>
        ) : (
          decisions.map((d, i) => {
            const style = DELTA_STYLE[d.difficulty_delta];
            const name  = patientNameById[d.patientId] ?? d.patientId.slice(0, 8);
            return (
              <div key={`${d.ts}-${i}`} style={{
                padding: '12px 16px',
                borderBottom: i < decisions.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                animation: i === 0 ? 'coach-slide 0.4s ease-out' : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: 1,
                    padding: '2px 7px', borderRadius: 4,
                    background: style.bg, color: style.color,
                    border: `1px solid ${style.color}55`,
                    textTransform: 'uppercase',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}>
                    <span style={{ fontSize: 11 }}>{style.icon}</span>
                    {style.label}
                  </span>
                  <span style={{ fontSize: 10, color: '#445566', fontFamily: 'monospace' }}>
                    {name.length > 14 ? name.slice(0, 14) + '…' : name}
                  </span>
                  <span style={{ fontSize: 9, color: '#334455', marginLeft: 'auto' }}>
                    {timeAgo(d.ts)}
                  </span>
                </div>

                <p style={{
                  fontSize: 12, color: '#fff', margin: '0 0 6px',
                  lineHeight: 1.5, fontWeight: 500,
                }}>
                  “{d.message}”
                </p>

                <p style={{
                  fontSize: 10, color: '#6688aa', margin: 0,
                  lineHeight: 1.5, fontStyle: 'italic',
                }}>
                  {d.rationale}
                </p>

                {d.suggested_achievement && (
                  <div style={{
                    marginTop: 8, padding: '6px 10px',
                    background: 'rgba(245,158,11,0.1)',
                    border: '1px solid rgba(245,158,11,0.25)',
                    borderRadius: 6,
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    <span style={{ fontSize: 12 }}>🏆</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b', letterSpacing: 0.5 }}>
                      {d.suggested_achievement}
                    </span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <style>{`
        @keyframes coach-slide {
          0%   { opacity: 0; transform: translateY(-6px); background: rgba(139,92,246,0.08); }
          100% { opacity: 1; transform: translateY(0);    background: transparent; }
        }
      `}</style>
    </div>
  );
}
