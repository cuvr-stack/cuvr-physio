import type React from 'react';
import { notFound } from 'next/navigation';
// (Link no longer needed — BackButton handles navigation)
import { createClient } from '@/lib/supabase-server';
import { Sidebar } from '@/components/Sidebar';
import { BackButton } from '@/components/BackButton';
import { DownloadReportButton } from '@/components/DownloadReportButton';
import { PatientLifecycleControls, DischargedBanner } from '@/components/PatientLifecycleControls';
import { PatientEditButton } from '@/components/PatientEditModal';
import { PatientInsightsCard } from '@/components/PatientInsightsCard';
import { SoapNotes } from '@/components/SoapNotes';
import { ROMChart } from './ROMChart';
import { AchievementBadges } from './AchievementBadges';
import { SessionTable } from './SessionTable';

interface PageProps {
  params: { id: string };
}

function xpToLevel(xp: number) {
  return Math.floor(Math.sqrt(xp / 50)) + 1;
}

function xpProgressInLevel(xp: number) {
  const level = xpToLevel(xp);
  const floorXP = 50 * (level - 1) ** 2;
  const ceilXP = 50 * level ** 2;
  return { pct: Math.round(((xp - floorXP) / (ceilXP - floorXP)) * 100), current: xp - floorXP, required: ceilXP - floorXP };
}

export default async function PatientDetailPage({ params }: PageProps) {
  const supabase = await createClient();

  const [{ data: patient }, { data: stats }, { data: sessions }, { data: earnedAchievements }] =
    await Promise.all([
      supabase.from('patients').select('*').eq('id', params.id).single(),
      supabase.from('player_stats').select('*').eq('patient_id', params.id).single(),
      supabase
        .from('sessions')
        .select('id, exercise_id, started_at, ended_at, status, score, reps_completed, session_results(*)')
        .eq('patient_id', params.id)
        .eq('status', 'completed')
        .order('started_at', { ascending: true }),
      supabase
        .from('player_achievements')
        .select('earned_at, achievements(id, name, description, icon, xp_reward)')
        .eq('patient_id', params.id)
        .order('earned_at', { ascending: true }),
    ]);

  if (!patient) notFound();

  const level = stats ? xpToLevel(stats.xp) : 1;
  const progress = stats ? xpProgressInLevel(stats.xp) : { pct: 0 };

  // Shape sessions into chart data points
  type SessionResult = { avg_rom: number; max_rom: number; duration_seconds: number };
  type SessionRow = {
    id: string;
    exercise_id: string;
    started_at: string;
    ended_at: string | null;
    score: number;
    reps_completed: number;
    session_results: SessionResult[];
  };

  const chartData = (sessions as SessionRow[] ?? []).map((s) => {
    const result = s.session_results?.[0];
    return {
      date: new Date(s.started_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      dateISO: s.started_at,
      avgROM: result?.avg_rom ?? 0,
      maxROM: result?.max_rom ?? 0,
      reps: s.reps_completed,
      score: s.score,
      exercise: s.exercise_id,
      duration: result?.duration_seconds ?? 0,
    };
  });

  // Build report data object for PDF
  const reportData = {
    patient: {
      id: patient.id,
      name: patient.name,
      condition: patient.condition,
      session_code: patient.session_code,
      email: patient.email ?? null,
      created_at: patient.created_at,
    },
    stats: stats ?? null,
    sessions: chartData,
    achievements: (earnedAchievements ?? []).map((a: any) => ({
      icon: a.achievements?.icon ?? '🏆',
      name: a.achievements?.name ?? '',
      description: a.achievements?.description ?? '',
      earned_at: a.earned_at,
    })),
  };

  const ff = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  const card: React.CSSProperties = {
    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 14, padding: '20px 22px',
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#080812', fontFamily: ff }}>
      <Sidebar />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Top bar */}
        <header style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 28px', background: '#0a0a16',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <BackButton fallbackHref="/patients" label="Back" />
            <span style={{ color: '#334455' }}>/</span>
            <div>
              <h1 style={{ fontSize: 18, fontWeight: 800, color: '#fff', margin: 0 }}>{patient.name}</h1>
              <p style={{ fontSize: 11, color: '#445566', margin: '2px 0 0' }}>{patient.condition}</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <PatientEditButton patient={patient} />
            <PatientLifecycleControls patient={patient} />
            <DownloadReportButton data={reportData} />
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 9, letterSpacing: 2, color: '#445566', textTransform: 'uppercase', fontWeight: 600, margin: '0 0 4px' }}>VR Session Code</p>
              <p style={{ fontFamily: 'monospace', fontSize: 22, fontWeight: 800, color: '#a855f7', letterSpacing: 6, margin: 0 }}>
                {patient.session_code}
              </p>
            </div>
          </div>
        </header>

        <main style={{ flex: 1, padding: '24px 28px', overflowY: 'auto' }}>
          <DischargedBanner patient={patient} />

          {/* Demographics — only shown when at least one field is set */}
          {(patient.date_of_birth || patient.height_cm || patient.affected_side) && (
            <div style={{
              display: 'flex', gap: 14, alignItems: 'stretch',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 12, padding: '12px 16px', marginBottom: 18,
              flexWrap: 'wrap',
            }}>
              {patient.date_of_birth && (() => {
                const dob = new Date(patient.date_of_birth);
                const age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 86400000));
                return (
                  <DemoCell label="Age" value={`${age}`} sub={dob.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} accent="#06b6d4" />
                );
              })()}
              {patient.height_cm && (
                <DemoCell label="Height" value={`${patient.height_cm} cm`} sub="Used to scale targets" accent="#8b5cf6" />
              )}
              {patient.affected_side && (
                <DemoCell label="Affected Side" value={String(patient.affected_side).toUpperCase()} sub="Game lateralization" accent="#f59e0b" />
              )}
            </div>
          )}

          {/* Longitudinal AI insights — auto-refreshed after each session ends */}
          <PatientInsightsCard patientId={patient.id} />

          {/* Auto-drafted SOAP notes for each completed session */}
          <SoapNotes patientId={patient.id} />

          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
            {[
              { label: 'Level', value: `LVL ${level}`, sub: `${progress.pct}% to next`, color: '#3b82f6' },
              { label: 'Total Sessions', value: String(stats?.total_sessions ?? 0), sub: `${stats?.total_reps ?? 0} total reps`, color: '#8b5cf6' },
              { label: 'Best ROM', value: `${stats?.best_rom ?? 0}°`, sub: 'All-time max', color: '#10b981' },
              { label: 'Streak', value: String(stats?.current_streak ?? 0), sub: `Best: ${stats?.longest_streak ?? 0} days`, color: '#f59e0b' },
            ].map((s) => (
              <div key={s.label} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <p style={{ fontSize: 9, letterSpacing: 2, color: '#445566', textTransform: 'uppercase', fontWeight: 600, margin: 0 }}>{s.label}</p>
                <p style={{ fontSize: 26, fontWeight: 800, color: s.color, margin: 0, lineHeight: 1 }}>{s.value}</p>
                <p style={{ fontSize: 11, color: '#445566', margin: 0 }}>{s.sub}</p>
              </div>
            ))}
          </div>

          {/* ROM chart */}
          {chartData.length > 0 ? (
            <div style={{ ...card, marginBottom: 20 }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: '#fff', margin: '0 0 16px' }}>ROM Progress</h2>
              <ROMChart data={chartData} />
            </div>
          ) : (
            <div style={{ ...card, textAlign: 'center', padding: '40px 24px', marginBottom: 20 }}>
              <p style={{ color: '#445566', fontSize: 13 }}>No completed sessions yet. ROM progress will appear after the first session.</p>
            </div>
          )}

          {/* Achievements */}
          <div style={{ ...card, marginBottom: 20 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: '#fff', margin: '0 0 16px' }}>
              Achievements
              <span style={{ marginLeft: 10, fontSize: 11, fontWeight: 600, color: '#445566' }}>
                {earnedAchievements?.length ?? 0} earned
              </span>
            </h2>
            <AchievementBadges earned={(earnedAchievements ?? []) as any} />
          </div>

          {/* Session history */}
          {chartData.length > 0 && (
            <div style={card}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: '#fff', margin: '0 0 16px' }}>Session History</h2>
              <SessionTable sessions={chartData.slice().reverse()} />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function DemoCell({ label, value, sub, accent }: { label: string; value: string; sub: string; accent: string }) {
  return (
    <div style={{
      flex: '0 1 auto', minWidth: 140,
      padding: '8px 14px',
      borderLeft: `2px solid ${accent}55`,
    }}>
      <p style={{ fontSize: 9, letterSpacing: 2, color: accent, textTransform: 'uppercase', fontWeight: 700, margin: 0 }}>{label}</p>
      <p style={{ fontSize: 16, fontWeight: 800, color: '#fff', margin: '3px 0 2px', lineHeight: 1 }}>{value}</p>
      <p style={{ fontSize: 9, color: '#445566', margin: 0, letterSpacing: 0.5 }}>{sub}</p>
    </div>
  );
}
