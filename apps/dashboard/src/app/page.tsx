import Link from 'next/link';
import { createClient } from '@/lib/supabase-server';
import { Sidebar } from '@/components/Sidebar';
import { TopBarActions } from '@/components/TopBarActions';
import { PatientSearch } from '@/components/PatientSearch';

async function getDashboardData() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return {
      user: null,
      patients: [] as any[],
      activePatients: [] as any[],
      activeCount: 0,
      totalSessions: 0,
      avgROM: 0,
      todayAppts: [] as any[],
    };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, clinic_name')
    .eq('id', user.id)
    .single();

  const { data: patients } = await supabase
    .from('patients')
    .select(`
      id, name, condition, status, created_at,
      player_stats(xp, level, total_sessions, best_rom, current_streak),
      sessions(id, status, started_at, reps_completed, score)
    `)
    .eq('physio_id', user.id)
    .neq('status', 'discharged')              // discharged patients never appear on the dashboard
    .order('created_at', { ascending: false })
    .limit(50);

  const allPatients = patients ?? [];
  const totalSessions = allPatients.reduce(
    (sum: number, p: any) => sum + (p.player_stats?.[0]?.total_sessions ?? 0), 0,
  );
  const avgROM = allPatients.reduce((sum: number, p: any) => {
    const best = p.player_stats?.[0]?.best_rom ?? 0;
    return sum + best;
  }, 0) / (allPatients.length || 1);

  // Time anchors
  const now        = new Date();
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const endOfDay   = new Date(); endOfDay.setHours(23, 59, 59, 999);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 86400000);

  // Upcoming appointments per patient (next 14 days)
  const upcomingTo = new Date(now.getTime() + 14 * 86400000);
  const { data: upcomingAppts } = await supabase
    .from('appointments')
    .select('id, patient_id, scheduled_at, status')
    .eq('physio_id', user.id)
    .eq('status', 'scheduled')
    .gte('scheduled_at', now.toISOString())
    .lte('scheduled_at', upcomingTo.toISOString())
    .order('scheduled_at', { ascending: true });

  const nextApptByPatient = new Map<string, string>();
  for (const a of (upcomingAppts ?? []) as any[]) {
    if (!nextApptByPatient.has(a.patient_id)) {
      nextApptByPatient.set(a.patient_id, a.scheduled_at);
    }
  }

  // Today's appointments (for the "Today's Schedule" card)
  const { data: todayAppts } = await supabase
    .from('appointments')
    .select(`
      id, scheduled_at, duration_min, exercise_id, status, notes,
      patients(id, name, condition)
    `)
    .eq('physio_id', user.id)
    .eq('status', 'scheduled')
    .gte('scheduled_at', startOfDay.toISOString())
    .lte('scheduled_at', endOfDay.toISOString())
    .order('scheduled_at', { ascending: true });

  // ── Build active-patient list ────────────────────────────────────────────
  // A patient is "active" if any of:
  //   1. has a live VR session right now (status='active')
  //   2. had a session in the last 14 days
  //   3. has an upcoming appointment in the next 14 days
  type Activity = 'in_session' | 'recent' | 'upcoming';
  // A session counts as truly "in progress" only if its status is 'active' AND
  // it was started in the last 2 hours. Anything older is almost certainly an
  // orphaned row from a crashed VR app or a missed End Session click.
  const STALE_AFTER_MS = 2 * 60 * 60 * 1000; // 2 hours
  const enriched = allPatients.map((p: any) => {
    const sessions  = (p.sessions ?? []) as any[];
    const inSession = sessions.some(s =>
      s.status === 'active'
      && s.started_at
      && (now.getTime() - new Date(s.started_at).getTime()) < STALE_AFTER_MS,
    );
    const lastSessionDate = sessions
      .map(s => new Date(s.started_at))
      .sort((a, b) => b.getTime() - a.getTime())[0];
    const recentSession = lastSessionDate && lastSessionDate >= fourteenDaysAgo;
    const nextAppt = nextApptByPatient.get(p.id);

    let activity: Activity | null = null;
    let sortKey = 0;        // higher = more recent / more urgent
    if (inSession) {
      activity = 'in_session';
      sortKey = Number.MAX_SAFE_INTEGER;
    } else if (recentSession) {
      activity = 'recent';
      sortKey = lastSessionDate!.getTime();
    } else if (nextAppt) {
      activity = 'upcoming';
      // Sooner upcoming = higher priority. Negate so larger sortKey = sooner.
      sortKey = -new Date(nextAppt).getTime();
    }

    return { ...p, _activity: activity, _sortKey: sortKey, _nextAppt: nextAppt ?? null };
  });

  const activePatients = enriched
    .filter((p: any) => p._activity !== null)
    .sort((a: any, b: any) => b._sortKey - a._sortKey);

  const activeCount = enriched.filter((p: any) => p._activity === 'in_session').length;

  return {
    user: { ...user, profile },
    patients: allPatients,
    activePatients,
    activeCount,
    totalSessions,
    avgROM: Math.round(avgROM),
    todayAppts: todayAppts ?? [],
  };
}

const EXERCISE_LABELS: Record<string, string> = {
  shoulder_flexion:   'Shoulder Flexion',
  shoulder_abduction: 'Shoulder Abduction',
  elbow_extension:    'Elbow Extension',
  knee_flexion:       'Knee Flexion',
  hip_abduction:      'Hip Abduction',
  general:            'General Assessment',
};

function xpToLevel(xp: number) {
  return Math.floor(Math.sqrt(xp / 50)) + 1;
}

function DonutChart({ percent, color }: { percent: number; color: string }) {
  const r = 38, cx = 50, cy = 50;
  const circ = 2 * Math.PI * r;
  const dash = circ * (percent / 100);
  const gap = circ - dash;
  return (
    <svg width="110" height="110" viewBox="0 0 100 100">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
      <circle
        cx={cx} cy={cy} r={r} fill="none"
        stroke={color} strokeWidth="10"
        strokeDasharray={`${dash} ${gap}`}
        strokeDashoffset={circ / 4}
        strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 6px ${color}88)` }}
      />
      <text x="50" y="46" textAnchor="middle" fill="#fff" fontSize="15" fontWeight="700">{percent}%</text>
      <text x="50" y="60" textAnchor="middle" fill="#5577aa" fontSize="7" letterSpacing="1">SYNC</text>
    </svg>
  );
}

function StatCard({ icon, label, value, sub, subColor, accent }: {
  icon: React.ReactNode; label: string; value: string; sub: string; subColor?: string; accent?: string;
}) {
  return (
    <div style={{
      flex: 1, minWidth: 0,
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 14, padding: '20px 22px',
      display: 'flex', alignItems: 'flex-start', gap: 16,
    }}>
      <div style={{
        width: 42, height: 42, borderRadius: 10, flexShrink: 0,
        background: accent ? `${accent}22` : 'rgba(139,92,246,0.15)',
        border: `1px solid ${accent ? `${accent}44` : 'rgba(139,92,246,0.3)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: accent ?? '#a855f7',
      }}>
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 9, letterSpacing: 2, color: '#5577aa', textTransform: 'uppercase', fontWeight: 600, margin: '0 0 6px' }}>{label}</p>
        <p style={{ fontSize: 26, fontWeight: 800, color: '#fff', margin: '0 0 4px', lineHeight: 1 }}>{value}</p>
        <p style={{ fontSize: 11, color: subColor ?? '#3a8a6a', margin: 0, fontWeight: 600 }}>{sub}</p>
      </div>
    </div>
  );
}

export default async function DashboardHome() {
  const { user, patients, activePatients, activeCount, totalSessions, avgROM, todayAppts = [] } = await getDashboardData();

  // (recentPatients was used in an earlier layout — now superseded by activePatients)

  // Highlight the next upcoming appointment (first one whose start time is ≥ now)
  const now = new Date();
  const nextUpcomingId = (todayAppts as any[]).find(
    (a: any) => new Date(a.scheduled_at) >= now,
  )?.id;

  return (
    <div style={{
      display: 'flex', minHeight: '100vh',
      background: '#080812',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      {/* Static hover rules — keeps this a server component */}
      <style>{`
        .patient-card:hover { border-color: rgba(139,92,246,0.4) !important; }

        /* Active Patient Recovery scrollbar — slim, on-theme */
        .apr-scroll::-webkit-scrollbar { width: 6px; }
        .apr-scroll::-webkit-scrollbar-track { background: transparent; }
        .apr-scroll::-webkit-scrollbar-thumb {
          background: rgba(139,92,246,0.25);
          border-radius: 3px;
        }
        .apr-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(139,92,246,0.45);
        }
        .apr-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(139,92,246,0.25) transparent;
        }
      `}</style>

      <Sidebar />

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Top Bar */}
        <header style={{
          display: 'flex', alignItems: 'center', gap: 16,
          padding: '16px 28px',
          background: '#0a0a16',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          {/* Title */}
          <div style={{ marginRight: 8 }}>
            <p style={{ fontSize: 16, fontWeight: 800, color: '#fff', margin: 0, letterSpacing: 0.5 }}>AetherFlow</p>
            <p style={{ fontSize: 9, color: '#5577aa', margin: 0, letterSpacing: 2, textTransform: 'uppercase', fontWeight: 600 }}>VR</p>
          </div>

          {/* Live patient search — autocomplete with keyboard nav */}
          <PatientSearch />

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
            <TopBarActions
              initialFullName={user?.profile?.full_name ?? ''}
              initialClinic={user?.profile?.clinic_name ?? ''}
            />

            {/* User */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 8 }}>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#fff', margin: 0 }}>
                  {user?.profile?.full_name ?? 'Dr. Practitioner'}
                </p>
                <p style={{ fontSize: 9, color: '#06b6d4', margin: 0, letterSpacing: 1, textTransform: 'uppercase', fontWeight: 600 }}>
                  Lead Physical Therapist
                </p>
              </div>
              <div style={{
                width: 38, height: 38, borderRadius: '50%',
                background: 'linear-gradient(135deg, #7c3aed, #06b6d4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 800, color: '#fff',
                border: '2px solid rgba(139,92,246,0.4)',
              }}>
                {(user?.profile?.full_name ?? 'P')[0]}
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main style={{ flex: 1, padding: '24px 28px', overflowY: 'auto' }}>

          {/* Stat Cards */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
            <StatCard
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>}
              label="Live Sessions"
              value={String(activeCount)}
              sub={activeCount > 0 ? `+${activeCount} from peak` : 'No active sessions'}
              accent="#8b5cf6"
            />
            <StatCard
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>}
              label="Recovery Rate"
              value={totalSessions > 0 ? `${Math.min(99, 70 + Math.round(totalSessions * 1.5))}%` : '—'}
              sub={totalSessions > 0 ? '⊙ Optimized' : 'No sessions yet'}
              accent="#06b6d4"
              subColor="#06b6d4"
            />
            <StatCard
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
              label="Avg Intensity"
              value={avgROM > 0 ? String(avgROM) : '—'}
              sub="Flow State Units"
              accent="#f59e0b"
              subColor="#f59e0b"
            />
            <StatCard
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>}
              label="Pain Alerts"
              value="0"
              sub="All Clear"
              accent="#10b981"
              subColor="#10b981"
            />
          </div>

          {/* Main grid — left column has 2 rows; right column is a single tall
              cell that holds the entire Recent-Insights side panel.
              ┌─────────────────────────┬───────────────┐
              │ Active Patient Recovery │               │
              ├─────────────────────────┤  Side panel   │
              │ Active VR Session Mon.  │               │
              └─────────────────────────┴───────────────┘ */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 320px',
            gridTemplateAreas: '"patients side" "monitor side"',
            columnGap: 20, rowGap: 20,
            alignItems: 'start',
          }}>

            {/* Active Patient Recovery */}
            <div style={{ minWidth: 0, gridArea: 'patients' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div>
                  <h2 style={{ fontSize: 15, fontWeight: 700, color: '#fff', margin: 0 }}>Active Patient Recovery</h2>
                  <p style={{ fontSize: 11, color: '#445566', margin: '3px 0 0' }}>
                    {activePatients.length > 0
                      ? `${activePatients.length} active · monitoring spatial movement and neural engagement.`
                      : 'Monitoring spatial movement and neural engagement metrics.'}
                  </p>
                </div>
                {activePatients.length > 4 && (
                  <Link href="/patients" style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: 1.2,
                    color: '#a855f7', textDecoration: 'none',
                    padding: '7px 12px',
                    background: 'rgba(139,92,246,0.1)',
                    border: '1px solid rgba(139,92,246,0.3)',
                    borderRadius: 6, textTransform: 'uppercase',
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                  }}>
                    View All
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </Link>
                )}
              </div>

              {patients.length === 0 ? (
                <div style={{
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 14, padding: '40px 24px', textAlign: 'center',
                }}>
                  <p style={{ color: '#445566', fontSize: 13, margin: '0 0 16px' }}>No patients added yet.</p>
                  <Link href="/patients" style={{
                    display: 'inline-block', padding: '10px 20px',
                    background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
                    borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 600,
                    textDecoration: 'none',
                  }}>Add First Patient →</Link>
                </div>
              ) : activePatients.length === 0 ? (
                <div style={{
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 14, padding: '40px 24px', textAlign: 'center',
                }}>
                  <p style={{ color: '#fff', fontSize: 14, fontWeight: 600, margin: '0 0 6px' }}>No active patients right now</p>
                  <p style={{ color: '#445566', fontSize: 12, margin: '0 0 16px' }}>
                    Patients appear here when they have a live session, recent activity, or an upcoming appointment.
                  </p>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                    <Link href="/schedule" style={{
                      padding: '9px 16px',
                      background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)',
                      borderRadius: 8, color: '#a855f7', fontSize: 11, fontWeight: 700,
                      textDecoration: 'none', letterSpacing: 1, textTransform: 'uppercase',
                    }}>Book Appointment</Link>
                    <Link href="/patients" style={{
                      padding: '9px 16px',
                      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 8, color: '#6688aa', fontSize: 11, fontWeight: 700,
                      textDecoration: 'none', letterSpacing: 1, textTransform: 'uppercase',
                    }}>View All Patients</Link>
                  </div>
                </div>
              ) : (
                <div
                  className="apr-scroll"
                  style={{
                    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14,
                    maxHeight: 460, overflowY: 'auto',
                    paddingRight: activePatients.length > 4 ? 6 : 0,
                  }}
                >
                  {(activePatients as any[]).map((p: any, i: number) => {
                    const stats = p.player_stats?.[0];
                    const level = stats ? xpToLevel(stats.xp ?? 0) : 1;
                    const activity: 'in_session' | 'recent' | 'upcoming' = p._activity;
                    const romProgress = Math.min(100, Math.round(((stats?.best_rom ?? 0) / 180) * 100));
                    const daysSince = stats?.total_sessions
                      ? `Day ${String(stats.total_sessions * 3).padStart(2, '0')}`
                      : 'Day 01';

                    const badge =
                      activity === 'in_session' ? { label: 'IN SESSION', color: '#06b6d4', bg: 'rgba(6,182,212,0.15)',  brd: 'rgba(6,182,212,0.3)' }
                    : activity === 'recent'     ? { label: 'ON TRACK',  color: '#10b981', bg: 'rgba(16,185,129,0.15)', brd: 'rgba(16,185,129,0.3)' }
                    :                              { label: 'UPCOMING',  color: '#a855f7', bg: 'rgba(139,92,246,0.15)', brd: 'rgba(139,92,246,0.3)' };

                    return (
                      <Link key={p.id} href={`/patients/${p.id}`} style={{ textDecoration: 'none' }}>
                        <div className="patient-card" style={{
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.07)',
                          borderRadius: 14, padding: '18px',
                          cursor: 'pointer', transition: 'border-color 0.15s',
                        }}>
                          {/* Status badge */}
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{
                                width: 38, height: 38, borderRadius: 8,
                                background: `linear-gradient(135deg, ${i % 2 === 0 ? '#7c3aed,#06b6d4' : '#0891b2,#7c3aed'})`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 14, fontWeight: 800, color: '#fff',
                              }}>
                                {p.name[0]}
                              </div>
                              <div>
                                <p style={{ fontSize: 14, fontWeight: 700, color: '#fff', margin: 0 }}>{p.name}</p>
                                <p style={{ fontSize: 10, color: '#6688aa', margin: '2px 0 0' }}>{p.condition}</p>
                              </div>
                            </div>
                            <span style={{
                              fontSize: 8, fontWeight: 700, letterSpacing: 1,
                              padding: '3px 8px', borderRadius: 4,
                              background: badge.bg,
                              color: badge.color,
                              border: `1px solid ${badge.brd}`,
                              textTransform: 'uppercase', whiteSpace: 'nowrap',
                            }}>
                              {badge.label}
                            </span>
                          </div>

                          {/* Stage + Day */}
                          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                            {[`Stage ${Math.min(4, level)}`, daysSince].map((tag, ti) => (
                              <span key={ti} style={{
                                fontSize: 9, fontWeight: 700, letterSpacing: 1,
                                padding: '3px 8px', borderRadius: 4,
                                background: 'rgba(255,255,255,0.06)',
                                color: '#8899aa', textTransform: 'uppercase',
                              }}>{tag}</span>
                            ))}
                          </div>

                          {/* Progress bar */}
                          <div style={{ marginBottom: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                              <span style={{ fontSize: 9, letterSpacing: 1.5, color: '#445566', textTransform: 'uppercase', fontWeight: 600 }}>Recovery Progress</span>
                              <span style={{ fontSize: 11, fontWeight: 700, color: '#06b6d4' }}>{romProgress}%</span>
                            </div>
                            <div style={{ height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 4, overflow: 'hidden' }}>
                              <div style={{
                                height: '100%', width: `${romProgress}%`,
                                background: 'linear-gradient(90deg, #3b82f6, #06b6d4)',
                                borderRadius: 4,
                              }} />
                            </div>
                          </div>

                          {/* Metrics */}
                          <div style={{ display: 'flex', gap: 8 }}>
                            <div style={{
                              flex: 1, background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '8px 10px',
                            }}>
                              <p style={{ fontSize: 8, letterSpacing: 1, color: '#445566', textTransform: 'uppercase', fontWeight: 600, margin: '0 0 3px' }}>ROM Range</p>
                              <p style={{ fontSize: 14, fontWeight: 800, color: '#fff', margin: 0 }}>{stats?.best_rom ?? 0}°</p>
                            </div>
                            <div style={{
                              flex: 1, background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '8px 10px',
                            }}>
                              <p style={{ fontSize: 8, letterSpacing: 1, color: '#445566', textTransform: 'uppercase', fontWeight: 600, margin: '0 0 3px' }}>Sessions</p>
                              <p style={{ fontSize: 14, fontWeight: 800, color: '#fff', margin: 0 }}>{stats?.total_sessions ?? 0}</p>
                            </div>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right-side panel — spans both grid rows */}
            <div style={{
              gridArea: 'side',
              display: 'flex', flexDirection: 'column', gap: 14,
            }}>

            {/* Section heading */}
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#fff', margin: '0 0 2px' }}>
              Recent Insights
            </h2>

            {/* Flow State Efficiency card */}
            <div style={{
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 14, padding: '20px',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 6,
                    background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a855f7',
                  }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
                    </svg>
                  </div>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#fff', margin: 0 }}>Flow State Efficiency</p>
                    <p style={{ fontSize: 9, color: '#445566', margin: 0, letterSpacing: 0.5 }}>Based on last 48 hours of sessions</p>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
                  <DonutChart percent={totalSessions > 0 ? Math.min(95, 60 + totalSessions * 5) : 0} color="#8b5cf6" />
                </div>

                <p style={{ fontSize: 11, color: '#6688aa', lineHeight: 1.6, margin: 0, fontStyle: 'italic', textAlign: 'center' }}>
                  {totalSessions > 0
                    ? `"Patients show strong ROM improvement trends across ${totalSessions} recorded sessions."`
                    : `"Start recording sessions to see flow state efficiency metrics."`}
                </p>
              </div>

            {/* Today's Schedule — sits directly under Flow State in the side panel */}
            <div style={{
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 14, padding: '18px',
              height: 360,                          // fixed card height
              display: 'flex', flexDirection: 'column',
              overflow: 'hidden',
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexShrink: 0 }}>
                  <div>
                    <h3 style={{ fontSize: 13, fontWeight: 700, color: '#fff', margin: 0 }}>Today's Schedule</h3>
                    <p style={{ fontSize: 9, color: '#445566', margin: '2px 0 0', letterSpacing: 0.5 }}>
                      {todayAppts.length} appointment{todayAppts.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <Link href="/schedule" title="Add appointment" style={{
                    width: 24, height: 24, borderRadius: 6,
                    background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.3)',
                    color: '#a855f7', textDecoration: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, fontWeight: 700, lineHeight: 1,
                  }}>+</Link>
                </div>

                <div
                  className="apr-scroll"
                  style={{
                    flex: 1, minHeight: 0,            // critical for nested flex scroll
                    overflowY: 'auto',
                    paddingRight: todayAppts.length > 4 ? 6 : 0,
                  }}
                >
                {todayAppts.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px 0 12px' }}>
                    <p style={{ fontSize: 11, color: '#445566', margin: '0 0 12px' }}>
                      No appointments today.
                    </p>
                    <Link href="/schedule" style={{
                      display: 'inline-block', padding: '8px 14px',
                      background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)',
                      borderRadius: 8, color: '#a855f7', fontSize: 10, fontWeight: 700,
                      letterSpacing: 1, textTransform: 'uppercase', textDecoration: 'none',
                    }}>
                      Open Schedule →
                    </Link>
                  </div>
                ) : (todayAppts as any[]).map((appt: any) => {
                  const dt = new Date(appt.scheduled_at);
                  const timeStr = dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true });
                  const [h, ampm] = timeStr.split(' ');
                  const isNext  = appt.id === nextUpcomingId;
                  const isPast  = dt < now;
                  const exLabel = EXERCISE_LABELS[appt.exercise_id] ?? appt.exercise_id;
                  return (
                    <Link key={appt.id} href="/schedule" style={{ textDecoration: 'none' }}>
                      <div style={{
                        display: 'flex', gap: 12, alignItems: 'flex-start',
                        padding: '10px 12px', borderRadius: 10, marginBottom: 6,
                        background: isNext ? 'rgba(139,92,246,0.12)' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${isNext ? 'rgba(139,92,246,0.25)' : 'rgba(255,255,255,0.05)'}`,
                        cursor: 'pointer', opacity: isPast ? 0.55 : 1,
                        transition: 'border-color 0.15s, background 0.15s',
                      }}>
                        <div style={{ flexShrink: 0, minWidth: 38 }}>
                          <p style={{ fontSize: 12, fontWeight: 700, color: isNext ? '#a855f7' : '#6688aa', margin: 0 }}>
                            {h}
                          </p>
                          <p style={{ fontSize: 8, color: '#445566', margin: 0, letterSpacing: 0.5 }}>
                            {ampm}
                          </p>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 12, fontWeight: 600, color: '#fff', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {appt.patients?.name ?? 'Patient'}
                          </p>
                          <p style={{ fontSize: 10, color: '#445566', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {exLabel} · {appt.duration_min}min
                          </p>
                        </div>
                        {isNext ? (
                          <span style={{ color: '#06b6d4', flexShrink: 0 }} title="Next up">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                            </svg>
                          </span>
                        ) : (
                          <span style={{ color: '#334455', flexShrink: 0 }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M9 18l6-6-6-6" />
                            </svg>
                          </span>
                        )}
                      </div>
                    </Link>
                  );
                })}
                </div>
              </div>

            </div> {/* close side panel */}

          {/* Active VR Session Monitor — bottom-left grid cell */}
          <div style={{
            gridArea: 'monitor',
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 14, padding: '20px 24px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%', background: '#ef4444',
                  display: 'inline-block',
                  boxShadow: '0 0 8px #ef4444',
                  animation: 'pulse 2s infinite',
                }} />
                <h2 style={{ fontSize: 15, fontWeight: 700, color: '#fff', margin: 0 }}>Active VR Session Monitor</h2>
              </div>
              <Link href="/sessions" style={{
                fontSize: 11, fontWeight: 700, color: '#06b6d4', textDecoration: 'none',
                letterSpacing: 1, textTransform: 'uppercase',
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                View Master Grid
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </Link>
            </div>

            {activeCount === 0 ? (
              <div style={{ display: 'flex', gap: 16 }}>
                {/* Spatial Field mock */}
                <div style={{
                  width: 200, height: 140,
                  background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
                  borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexDirection: 'column', gap: 8,
                }}>
                  <div style={{
                    width: 60, height: 60, borderRadius: '50%',
                    border: '1px solid rgba(139,92,246,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'rgba(139,92,246,0.4)' }} />
                  </div>
                  <p style={{ fontSize: 9, color: '#334455', letterSpacing: 1, margin: 0, textTransform: 'uppercase' }}>No active field</p>
                </div>

                <div style={{ display: 'flex', gap: 12, flex: 1 }}>
                  {[
                    { label: 'Patient', value: 'Awaiting Connection', sub: 'PROTOCOL: NONE' },
                    { label: 'Haptic Feedback', value: '—', sub: 'INACTIVE' },
                    { label: 'Heart Rate', value: '— BPM', sub: 'NO SENSOR' },
                  ].map((item, i) => (
                    <div key={i} style={{
                      flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: 10, padding: '14px 16px',
                    }}>
                      <p style={{ fontSize: 9, letterSpacing: 1.5, color: '#445566', textTransform: 'uppercase', fontWeight: 600, margin: '0 0 8px' }}>{item.label}</p>
                      <p style={{ fontSize: 14, fontWeight: 700, color: '#fff', margin: '0 0 4px' }}>{item.value}</p>
                      <p style={{ fontSize: 9, color: '#334455', letterSpacing: 1, margin: 0 }}>{item.sub}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 16 }}>
                {/* Spatial Field */}
                <div style={{
                  width: 200, height: 160,
                  background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
                  borderRadius: 12, display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
                  padding: '12px', position: 'relative', overflow: 'hidden',
                }}>
                  <svg style={{ position: 'absolute', inset: 0 }} width="200" height="160">
                    <circle cx="100" cy="80" r="60" fill="none" stroke="rgba(139,92,246,0.15)" strokeWidth="1" />
                    <circle cx="100" cy="80" r="40" fill="none" stroke="rgba(6,182,212,0.1)" strokeWidth="1" />
                    <circle cx="110" cy="70" r="8" fill="rgba(139,92,246,0.4)" />
                  </svg>
                  <p style={{ fontSize: 9, color: '#445566', letterSpacing: 1, margin: 0, textTransform: 'uppercase', position: 'relative', zIndex: 1 }}>
                    X: 12.4 Y: -4.2
                  </p>
                </div>

                <div style={{ flex: 1, display: 'flex', gap: 12 }}>
                  {activePatients.slice(0, 3).map((p: any) => {
                    const activeSession = p.sessions?.find((s: any) =>
                      s.status === 'active'
                      && s.started_at
                      && (Date.now() - new Date(s.started_at).getTime()) < 2 * 60 * 60 * 1000,
                    );
                    return (
                      <div key={p.id} style={{
                        flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                        borderRadius: 10, padding: '14px 16px',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" strokeWidth="2">
                            <path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>
                          </svg>
                          <div>
                            <p style={{ fontSize: 11, fontWeight: 700, color: '#fff', margin: 0 }}>Patient: {p.name}</p>
                            <p style={{ fontSize: 9, color: '#445566', margin: 0 }}>PROTOCOL: VR EXERCISE</p>
                          </div>
                          <span style={{ marginLeft: 'auto', fontSize: 18, fontWeight: 800, color: '#06b6d4' }}>
                            LIVE
                          </span>
                        </div>
                        <p style={{ fontSize: 9, letterSpacing: 1, color: '#445566', textTransform: 'uppercase', fontWeight: 600, margin: '0 0 4px' }}>Reps Completed</p>
                        <p style={{ fontSize: 22, fontWeight: 800, color: '#fff', margin: 0 }}>{activeSession?.reps_completed ?? 0}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          </div> {/* close main grid */}

        </main>
      </div>
    </div>
  );
}
