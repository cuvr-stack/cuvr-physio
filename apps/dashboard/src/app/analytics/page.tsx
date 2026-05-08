import Link from 'next/link';
import { Sidebar } from '@/components/Sidebar';
import { createClient } from '@/lib/supabase-server';

const ff = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const RANGES = [
  { key: '7',  label: '7d'  },
  { key: '30', label: '30d' },
  { key: '90', label: '90d' },
] as const;

const COND_PALETTE = ['#a855f7', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899'];

async function loadAnalytics(rangeDays: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const since   = new Date(Date.now() - rangeDays * 86400000);
  const sinceIso = since.toISOString();

  // Patients
  const { data: patients } = await supabase
    .from('patients')
    .select('id, name, condition')
    .eq('physio_id', user.id);

  // Sessions in range — filtered by THIS physio's patients (sessions has no physio_id)
  const patientIds = (patients ?? []).map(p => p.id);
  const { data: sessions } = patientIds.length > 0
    ? await supabase
        .from('sessions')
        .select('id, patient_id, status, started_at, ended_at, reps_completed, score, session_results(avg_rom, max_rom)')
        .in('patient_id', patientIds)
        .gte('started_at', sinceIso)
    : { data: [] };

  // Player stats (lifetime)
  const { data: stats } = await supabase
    .from('player_stats')
    .select('patient_id, xp, level, total_sessions, total_reps, best_rom, current_streak');

  // Appointments in range
  const { data: appts } = await supabase
    .from('appointments')
    .select('id, status, scheduled_at')
    .eq('physio_id', user.id)
    .gte('scheduled_at', sinceIso);

  // ── "Active patient" set — independent of the range filter so it always
  // matches /patients?filter=active. Defined as:
  //   sessions started in last 14d  ∪  appointments scheduled in next 14d.
  const now = new Date();
  const fourteenDaysAgo  = new Date(now.getTime() - 14 * 86400000).toISOString();
  const fourteenDaysAhead = new Date(now.getTime() + 14 * 86400000).toISOString();
  const twoHoursAgo = new Date(now.getTime() - 2 * 3600000).toISOString();

  const [recentSessionsRes, upcomingApptsRes] = await Promise.all([
    patientIds.length
      ? supabase
          .from('sessions')
          .select('patient_id, started_at, status')
          .in('patient_id', patientIds)
          .gte('started_at', fourteenDaysAgo)
      : Promise.resolve({ data: [] as any[] }),
    supabase
      .from('appointments')
      .select('patient_id, scheduled_at, status')
      .eq('physio_id', user.id)
      .eq('status', 'scheduled')
      .gte('scheduled_at', now.toISOString())
      .lte('scheduled_at', fourteenDaysAhead),
  ]);

  const activePatientIds = new Set<string>();
  for (const s of recentSessionsRes.data ?? []) {
    if (s.status !== 'active' || s.started_at >= twoHoursAgo) {
      activePatientIds.add(s.patient_id);
    }
  }
  for (const a of upcomingApptsRes.data ?? []) activePatientIds.add(a.patient_id);

  return {
    patients: patients ?? [],
    sessions: sessions ?? [],
    stats: stats ?? [],
    appts: appts ?? [],
    activePatientIds,
    since,
  };
}

export default async function AnalyticsPage({
  searchParams,
}: { searchParams?: Promise<{ range?: string }> }) {
  const sp = (await searchParams) ?? {};
  const rangeKey = (RANGES.find(r => r.key === sp.range)?.key ?? '30') as '7' | '30' | '90';
  const rangeDays = Number(rangeKey);

  const data = await loadAnalytics(rangeDays);

  if (!data) {
    return (
      <Shell>
        <p style={{ color: '#445566' }}>Sign in required.</p>
      </Shell>
    );
  }

  const { patients, sessions, stats, appts, activePatientIds, since } = data;

  // ── KPIs ────────────────────────────────────────────────────────────────────
  const completedSessions = sessions.filter((s: any) => s.status === 'completed');
  const totalReps = sessions.reduce((sum: number, s: any) => sum + (s.reps_completed ?? 0), 0);
  const avgROM = completedSessions.length
    ? Math.round(
        completedSessions.reduce((sum: number, s: any) => sum + (s.session_results?.[0]?.avg_rom ?? 0), 0)
        / completedSessions.length,
      )
    : 0;
  const avgScore = completedSessions.length
    ? Math.round(completedSessions.reduce((sum: number, s: any) => sum + (s.score ?? 0), 0) / completedSessions.length)
    : 0;

  // Appointment attendance
  const apptCompleted = appts.filter((a: any) => a.status === 'completed').length;
  const apptCancelled = appts.filter((a: any) => a.status === 'cancelled').length;
  const apptScheduled = appts.filter((a: any) => a.status === 'scheduled').length;
  const apptTotal = appts.length;
  const attendanceRate = apptCompleted + apptCancelled > 0
    ? Math.round((apptCompleted / (apptCompleted + apptCancelled)) * 100)
    : 0;

  // Active patient count = patients who had at least one session in range
  // The KPI uses the unified "active" definition computed in loadAnalytics —
  // sessions in last 14d ∪ upcoming appointments in next 14d. Always matches
  // the count shown on /patients?filter=active regardless of the range pill.
  const activePatients = activePatientIds.size;

  // ── Daily session count for chart ───────────────────────────────────────────
  const days = Math.min(rangeDays, 14); // chart capped to 14 bars
  const dailyBuckets: { date: Date; count: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    dailyBuckets.push({ date: d, count: 0 });
  }
  for (const s of sessions as any[]) {
    const sd = new Date(s.started_at); sd.setHours(0, 0, 0, 0);
    const bucket = dailyBuckets.find(b => b.date.getTime() === sd.getTime());
    if (bucket) bucket.count += 1;
  }
  const maxBucket = Math.max(1, ...dailyBuckets.map(b => b.count));

  // ── Sessions by condition ───────────────────────────────────────────────────
  const condMap = new Map<string, number>();
  for (const s of sessions as any[]) {
    const p = patients.find((p: any) => p.id === s.patient_id);
    if (!p) continue;
    condMap.set(p.condition, (condMap.get(p.condition) ?? 0) + 1);
  }
  const conditions = Array.from(condMap.entries())
    .map(([condition, count], i) => ({
      condition, count,
      color: COND_PALETTE[i % COND_PALETTE.length],
    }))
    .sort((a, b) => b.count - a.count);

  // ── Top patients ────────────────────────────────────────────────────────────
  const patientCount = new Map<string, number>();
  const patientReps  = new Map<string, number>();
  for (const s of sessions as any[]) {
    patientCount.set(s.patient_id, (patientCount.get(s.patient_id) ?? 0) + 1);
    patientReps.set(s.patient_id,  (patientReps.get(s.patient_id) ?? 0) + (s.reps_completed ?? 0));
  }
  const topPatients = patients
    .map((p: any) => {
      const stat = stats.find((st: any) => st.patient_id === p.id);
      return {
        ...p,
        sessions: patientCount.get(p.id) ?? 0,
        reps:     patientReps.get(p.id)  ?? 0,
        bestRom:  stat?.best_rom ?? 0,
        xp:       stat?.xp ?? 0,
      };
    })
    .sort((a: any, b: any) => b.sessions - a.sessions || b.reps - a.reps)
    .slice(0, 6);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <Shell>
      {/* Header w/ range pills */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '18px 28px', background: '#0a0a16',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#fff', margin: 0 }}>Analytics</h1>
          <p style={{ fontSize: 11, color: '#445566', margin: '3px 0 0' }}>
            Outcome metrics since {since.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} · {sessions.length} session{sessions.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 4 }}>
          {RANGES.map(r => (
            <Link key={r.key} href={`/analytics?range=${r.key}`} style={{
              padding: '7px 14px', borderRadius: 7,
              background: rangeKey === r.key ? 'rgba(139,92,246,0.2)' : 'transparent',
              color: rangeKey === r.key ? '#a855f7' : '#6688aa',
              fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase',
              textDecoration: 'none', fontFamily: ff,
            }}>
              {r.label}
            </Link>
          ))}
        </div>
      </header>

      <main style={{ flex: 1, padding: '24px 28px', overflowY: 'auto' }}>

        {/* KPI cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          <Kpi label="Total Sessions"   value={String(sessions.length)} sub={`${completedSessions.length} completed`} accent="#8b5cf6" />
          <Kpi label="Total Reps"       value={totalReps.toLocaleString()} sub="Across all patients"      accent="#06b6d4" />
          <Kpi label="Avg ROM"          value={`${avgROM}°`}             sub={`Avg score ${avgScore}`}     accent="#f59e0b" />
          <Kpi label="Active Patients"  value={String(activePatients)}    sub={`of ${patients.length} total`} accent="#10b981" href="/patients?filter=active" />
        </div>

        {/* Sessions per day */}
        <Section title="Daily Sessions" subtitle={`Last ${days} days`}>
          {dailyBuckets.every(b => b.count === 0) ? (
            <EmptyMsg text="No sessions recorded in this period." />
          ) : (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 160, padding: '0 8px' }}>
              {dailyBuckets.map((b, i) => {
                const h = (b.count / maxBucket) * 130;
                const isToday = b.date.toDateString() === new Date().toDateString();
                const dateLabel = b.date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
                return (
                  <div
                    key={i}
                    title={`${dateLabel} — ${b.count} session${b.count !== 1 ? 's' : ''}`}
                    style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, cursor: 'help' }}
                  >
                    <span style={{ fontSize: 10, color: '#6688aa', fontWeight: 600, height: 14 }}>
                      {b.count > 0 ? b.count : ''}
                    </span>
                    <div style={{
                      width: '100%', height: Math.max(2, h), borderRadius: '4px 4px 2px 2px',
                      background: b.count === 0
                        ? 'rgba(255,255,255,0.04)'
                        : isToday
                          ? 'linear-gradient(180deg, #06b6d4, #3b82f6)'
                          : 'linear-gradient(180deg, #a855f7, #6d28d9)',
                      boxShadow: b.count > 0 ? '0 0 12px rgba(139,92,246,0.25)' : 'none',
                    }} />
                    <span style={{
                      fontSize: 9, color: isToday ? '#a855f7' : '#445566',
                      fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase',
                    }}>
                      {b.date.toLocaleDateString('en-GB', { weekday: 'short' }).slice(0, 1)}
                    </span>
                    <span style={{ fontSize: 9, color: '#334455', marginTop: -4 }}>
                      {b.date.getDate()}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        {/* Two-col: condition breakdown + top patients */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>

          <Section title="Sessions by Condition" subtitle="Distribution across patient cohort">
            {conditions.length === 0 ? (
              <EmptyMsg text="No session data yet." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {conditions.map((c, i) => {
                  const pct = Math.round((c.count / sessions.length) * 100);
                  return (
                    <div key={i} title={`${c.condition} — ${c.count} session${c.count !== 1 ? 's' : ''} (${pct}%)`} style={{ cursor: 'help' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#fff' }}>{c.condition}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: c.color }}>
                          {c.count} <span style={{ color: '#445566', fontWeight: 500 }}>· {pct}%</span>
                        </span>
                      </div>
                      <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', width: `${pct}%`,
                          background: c.color, borderRadius: 4,
                          boxShadow: `0 0 8px ${c.color}66`,
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>

          <Section title="Top Patients" subtitle={`Most engaged in last ${rangeDays} days`}>
            {topPatients.every((p: any) => p.sessions === 0) ? (
              <EmptyMsg text="No patient activity in this period." />
            ) : (
              <div>
                {topPatients.map((p: any, i: number) => (
                  <Link key={p.id} href={`/patients/${p.id}`} style={{ textDecoration: 'none' }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 0',
                      borderBottom: i < topPatients.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                      cursor: 'pointer',
                    }}>
                      <div style={{
                        width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                        background: i === 0 ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.06)',
                        border: `1px solid ${i === 0 ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.08)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, fontWeight: 800, color: i === 0 ? '#f59e0b' : '#6688aa',
                      }}>{i + 1}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 12, fontWeight: 700, color: '#fff', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.name}
                        </p>
                        <p style={{ fontSize: 10, color: '#445566', margin: '2px 0 0' }}>{p.condition}</p>
                      </div>
                      <div style={{ display: 'flex', gap: 14, flexShrink: 0 }}>
                        <Stat label="Sessions" value={String(p.sessions)} />
                        <Stat label="Reps"     value={String(p.reps)} />
                        <Stat label="Best ROM" value={`${p.bestRom}°`} />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Section>
        </div>

        {/* Appointment outcomes */}
        <div style={{ marginTop: 16 }}>
          <Section title="Appointment Outcomes" subtitle={`${apptTotal} appointment${apptTotal !== 1 ? 's' : ''} in this period`}>
            {apptTotal === 0 ? (
              <EmptyMsg text="No appointments booked in this period." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Stacked horizontal bar */}
                <div style={{ display: 'flex', height: 14, borderRadius: 8, overflow: 'hidden', background: 'rgba(255,255,255,0.05)' }}>
                  {apptCompleted > 0 && (
                    <div style={{ width: `${(apptCompleted / apptTotal) * 100}%`, background: '#10b981' }} />
                  )}
                  {apptScheduled > 0 && (
                    <div style={{ width: `${(apptScheduled / apptTotal) * 100}%`, background: '#a855f7' }} />
                  )}
                  {apptCancelled > 0 && (
                    <div style={{ width: `${(apptCancelled / apptTotal) * 100}%`, background: '#ef4444' }} />
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                  <ApptStat color="#10b981" label="Completed" value={apptCompleted} pct={Math.round((apptCompleted/apptTotal)*100)} href="/schedule" />
                  <ApptStat color="#a855f7" label="Upcoming"  value={apptScheduled} pct={Math.round((apptScheduled/apptTotal)*100)} href="/schedule" />
                  <ApptStat color="#ef4444" label="Cancelled" value={apptCancelled} pct={Math.round((apptCancelled/apptTotal)*100)} href="/schedule" />
                  <ApptStat color="#06b6d4" label="Attendance Rate" value={`${attendanceRate}%`} pct={attendanceRate} hideCount
                    tooltip={`Calculated as Completed / (Completed + Cancelled) = ${apptCompleted} / ${apptCompleted + apptCancelled}`} />
                </div>
              </div>
            )}
          </Section>
        </div>
      </main>
    </Shell>
  );
}

// ─── Layout / helpers ────────────────────────────────────────────────────────
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', minHeight: '100vh', background: '#080812', fontFamily: ff,
    }}>
      <style>{`
        .kpi-link:hover  { border-color: rgba(139,92,246,0.45) !important; transform: translateY(-1px); }
        .appt-link:hover { border-color: rgba(139,92,246,0.4)  !important; background: rgba(139,92,246,0.06) !important; }
      `}</style>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section style={{
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 14, padding: 20,
    }}>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, color: '#fff', margin: 0 }}>{title}</h2>
        {subtitle && (
          <p style={{ fontSize: 10, color: '#445566', margin: '3px 0 0', letterSpacing: 0.5 }}>{subtitle}</p>
        )}
      </div>
      {children}
    </section>
  );
}

function Kpi({ label, value, sub, accent, href }: { label: string; value: string; sub: string; accent: string; href?: string }) {
  const inner = (
    <div style={{
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 14, padding: '18px 20px',
      borderTop: `2px solid ${accent}`,
      cursor: href ? 'pointer' : 'default',
      transition: 'border-color 0.15s, transform 0.15s',
      height: '100%', boxSizing: 'border-box',
    }}
      className={href ? 'kpi-link' : undefined}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <p style={{ fontSize: 9, letterSpacing: 2, color: '#5577aa', textTransform: 'uppercase', fontWeight: 600, margin: 0 }}>{label}</p>
        {href && (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#445566" strokeWidth="2.5">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        )}
      </div>
      <p style={{ fontSize: 26, fontWeight: 800, color: '#fff', margin: '0 0 4px', lineHeight: 1 }}>{value}</p>
      <p style={{ fontSize: 10, color: '#445566', margin: 0 }}>{sub}</p>
    </div>
  );
  if (href) return <Link href={href} style={{ textDecoration: 'none' }}>{inner}</Link>;
  return inner;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ textAlign: 'right' }}>
      <p style={{ fontSize: 8, letterSpacing: 1, color: '#445566', textTransform: 'uppercase', margin: 0, fontWeight: 600 }}>{label}</p>
      <p style={{ fontSize: 12, fontWeight: 700, color: '#fff', margin: '2px 0 0' }}>{value}</p>
    </div>
  );
}

function ApptStat({
  color, label, value, pct, hideCount, href, tooltip,
}: {
  color: string; label: string; value: number | string; pct: number;
  hideCount?: boolean; href?: string; tooltip?: string;
}) {
  const inner = (
    <div
      title={tooltip}
      className={href ? 'appt-link' : undefined}
      style={{
        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 10, padding: '12px 14px',
        cursor: href ? 'pointer' : tooltip ? 'help' : 'default',
        transition: 'border-color 0.15s, background 0.15s',
        height: '100%', boxSizing: 'border-box',
        position: 'relative',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
        <span style={{ fontSize: 9, letterSpacing: 1, color: '#5577aa', textTransform: 'uppercase', fontWeight: 600 }}>{label}</span>
        {href && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#445566" strokeWidth="2.5" style={{ marginLeft: 'auto' }}>
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        )}
      </div>
      <p style={{ fontSize: 18, fontWeight: 800, color: '#fff', margin: 0 }}>
        {value}
        {!hideCount && <span style={{ fontSize: 11, fontWeight: 600, color: '#445566', marginLeft: 6 }}>· {pct}%</span>}
      </p>
    </div>
  );
  if (href) return <Link href={href} style={{ textDecoration: 'none' }}>{inner}</Link>;
  return inner;
}

function EmptyMsg({ text }: { text: string }) {
  return (
    <p style={{ color: '#445566', fontSize: 12, textAlign: 'center', margin: 0, padding: '24px 0' }}>{text}</p>
  );
}
