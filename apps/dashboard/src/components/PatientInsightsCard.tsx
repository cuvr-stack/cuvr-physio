'use client';

import { useEffect, useState } from 'react';

const ff = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type Trend = 'improving' | 'steady' | 'plateau' | 'regressing' | 'insufficient_data';
type Risk  = 'low' | 'moderate' | 'high' | 'unknown';

interface Insight {
  id: string;
  patient_id: string;
  generated_at: string;
  trend: Trend;
  risk_level: Risk;
  headline: string;
  summary: string;
  recommendation: string | null;
  evidence: string[];
  features: Record<string, unknown>;
  sessions_analyzed: number;
}

const TREND_STYLE: Record<Trend, { color: string; bg: string; icon: string; label: string }> = {
  improving:           { color: '#10b981', bg: 'rgba(16,185,129,0.12)', icon: '↗', label: 'Improving' },
  steady:              { color: '#06b6d4', bg: 'rgba(6,182,212,0.12)',  icon: '→', label: 'Steady' },
  plateau:             { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', icon: '═', label: 'Plateau' },
  regressing:          { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  icon: '↘', label: 'Regressing' },
  insufficient_data:   { color: '#6688aa', bg: 'rgba(255,255,255,0.06)', icon: '?', label: 'Not enough data' },
};

const RISK_STYLE: Record<Risk, { color: string; label: string }> = {
  low:      { color: '#10b981', label: 'Low' },
  moderate: { color: '#f59e0b', label: 'Moderate' },
  high:     { color: '#ef4444', label: 'High' },
  unknown:  { color: '#6688aa', label: 'Unknown' },
};

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.round(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)} h ago`;
  return `${Math.round(diff / 86400)} d ago`;
}

export function PatientInsightsCard({ patientId }: { patientId: string }) {
  const [insight, setInsight] = useState<Insight | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch(`${API}/api/patients/${patientId}/insights`);
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();
      setInsight(data ?? null);
    } catch (e: any) {
      setErr(e?.message ?? 'Could not load insights.');
    } finally { setLoading(false); }
  }
  async function refresh() {
    setRefreshing(true); setErr(null);
    try {
      const res = await fetch(`${API}/api/patients/${patientId}/insights/refresh`, { method: 'POST' });
      if (!res.ok) throw new Error((await res.json()).error ?? `API ${res.status}`);
      const data = await res.json();
      // The refresh endpoint returns the new insight directly — but generated_at
      // comes from the persist step which is fire-and-forget; refetch to get it.
      await load();
    } catch (e: any) {
      setErr(e?.message ?? 'Refresh failed.');
    } finally { setRefreshing(false); }
  }

  useEffect(() => { load(); /* eslint-disable-line */ }, [patientId]);

  const trendStyle = insight ? TREND_STYLE[insight.trend] : TREND_STYLE.steady;
  const riskStyle  = insight ? RISK_STYLE[insight.risk_level] : RISK_STYLE.unknown;

  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 14, padding: 20,
      marginBottom: 22,
      fontFamily: ff,
      position: 'relative',
    }}>
      {/* Heading */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: 'linear-gradient(135deg, rgba(139,92,246,0.3), rgba(6,182,212,0.3))',
            border: '1px solid rgba(139,92,246,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#a855f7',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              <circle cx="12" cy="12" r="4" />
            </svg>
          </div>
          <div>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: '#fff', margin: 0 }}>
              AI Coach Recommends
            </h2>
            <p style={{ fontSize: 10, color: '#5577aa', margin: '2px 0 0', letterSpacing: 0.5 }}>
              {insight
                ? `Based on ${insight.sessions_analyzed} session${insight.sessions_analyzed === 1 ? '' : 's'} · refreshed ${timeAgo(insight.generated_at)}`
                : 'Longitudinal pattern analysis'}
            </p>
          </div>
        </div>

        <button
          onClick={refresh}
          disabled={refreshing}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 12px',
            background: refreshing ? 'rgba(99,60,180,0.25)' : 'rgba(139,92,246,0.12)',
            border: '1px solid rgba(139,92,246,0.3)',
            borderRadius: 7,
            color: '#a855f7', fontSize: 10, fontWeight: 700, letterSpacing: 1,
            cursor: refreshing ? 'wait' : 'pointer', textTransform: 'uppercase',
            fontFamily: ff,
          }}
        >
          <svg
            width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }}
          >
            <path d="M21 12a9 9 0 1 1-9-9c2.5 0 4.78.95 6.5 2.5L21 8" /><path d="M21 3v5h-5" />
          </svg>
          {refreshing ? 'Analysing…' : 'Refresh'}
        </button>
        <style>{`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
      </div>

      {/* Body */}
      {loading ? (
        <p style={{ fontSize: 12, color: '#445566', margin: 0 }}>Loading insights…</p>
      ) : err ? (
        <p style={{ fontSize: 12, color: '#ef4444', margin: 0 }}>{err}</p>
      ) : !insight ? (
        <div style={{ padding: '14px 0' }}>
          <p style={{ fontSize: 12, color: '#aabbcc', margin: '0 0 8px' }}>
            No analysis yet. Click <strong style={{ color: '#a855f7' }}>Refresh</strong> to generate the first one.
          </p>
          <p style={{ fontSize: 10, color: '#445566', margin: 0 }}>
            Insights become more accurate after 3+ completed sessions and refresh automatically when each session ends.
          </p>
        </div>
      ) : (
        <>
          {/* Headline + badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: 1.5,
              padding: '3px 9px', borderRadius: 5,
              background: trendStyle.bg, color: trendStyle.color,
              border: `1px solid ${trendStyle.color}55`,
              textTransform: 'uppercase',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span style={{ fontSize: 11 }}>{trendStyle.icon}</span> {trendStyle.label}
            </span>

            {insight.risk_level !== 'unknown' && (
              <span style={{
                fontSize: 9, fontWeight: 700, letterSpacing: 1.5,
                padding: '3px 9px', borderRadius: 5,
                background: `${riskStyle.color}1f`, color: riskStyle.color,
                border: `1px solid ${riskStyle.color}55`,
                textTransform: 'uppercase',
              }}>
                Risk · {riskStyle.label}
              </span>
            )}
          </div>

          <p style={{ fontSize: 14, fontWeight: 700, color: '#fff', margin: '0 0 10px', lineHeight: 1.4 }}>
            {insight.headline}
          </p>

          <p style={{ fontSize: 12, color: '#aabbcc', margin: '0 0 14px', lineHeight: 1.6 }}>
            {insight.summary}
          </p>

          {insight.recommendation && (
            <div style={{
              background: 'rgba(139,92,246,0.08)',
              border: '1px solid rgba(139,92,246,0.25)',
              borderLeft: '3px solid #a855f7',
              borderRadius: 8, padding: '10px 14px',
              marginBottom: insight.evidence.length ? 14 : 0,
            }}>
              <p style={{ fontSize: 9, letterSpacing: 2, color: '#a855f7', textTransform: 'uppercase', fontWeight: 700, margin: '0 0 4px' }}>
                Suggested Next Step
              </p>
              <p style={{ fontSize: 12, color: '#fff', margin: 0, lineHeight: 1.55 }}>
                {insight.recommendation}
              </p>
            </div>
          )}

          {insight.evidence.length > 0 && (
            <details style={{ fontSize: 11, color: '#6688aa' }}>
              <summary style={{ cursor: 'pointer', fontSize: 10, letterSpacing: 1.5, color: '#5577aa', textTransform: 'uppercase', fontWeight: 600, marginBottom: 8 }}>
                Evidence ({insight.evidence.length})
              </summary>
              <ul style={{ margin: '8px 0 0', paddingLeft: 18, lineHeight: 1.7 }}>
                {insight.evidence.map((e, i) => (
                  <li key={i} style={{ marginBottom: 3 }}>{e}</li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </div>
  );
}
