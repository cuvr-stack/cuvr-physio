'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';
import { Sidebar } from '@/components/Sidebar';

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  padding: '10px 14px',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8, color: '#fff', fontSize: 13, outline: 'none',
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 10, fontWeight: 600,
  letterSpacing: 2, color: '#5577aa', marginBottom: 6, textTransform: 'uppercase',
};

interface PatientRow {
  id: string; name: string; condition: string;
  session_code: string; email: string | null; created_at: string;
  status?: 'active' | 'discharged' | string | null;
  date_of_birth?: string | null;
  height_cm?: number | null;
  affected_side?: 'left' | 'right' | 'bilateral' | null;
}

export default function PatientsPage() {
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '', condition: '', email: '',
    date_of_birth: '', height_cm: '',
    affected_side: '' as '' | 'left' | 'right' | 'bilateral',
  });
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [activeIds, setActiveIds] = useState<Set<string> | null>(null);
  const supabase = createClient();
  const searchParams = useSearchParams();
  const router = useRouter();
  const filter = searchParams.get('filter');                                  // 'active' (behaviour) | null
  const statusParam = (searchParams.get('status') ?? 'active') as 'all' | 'active' | 'discharged';

  function clearFilter() {
    // Preserve status, drop only the behavioural filter
    const sp = new URLSearchParams(searchParams.toString());
    sp.delete('filter');
    router.replace(`/patients${sp.toString() ? '?' + sp.toString() : ''}`);
  }

  function setStatus(s: 'all' | 'active' | 'discharged') {
    const sp = new URLSearchParams(searchParams.toString());
    if (s === 'active') sp.delete('status'); else sp.set('status', s);
    router.replace(`/patients${sp.toString() ? '?' + sp.toString() : ''}`);
  }

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('patients')
      .select('id, name, condition, session_code, email, created_at, status')
      .eq('physio_id', user.id)
      .order('created_at', { ascending: false });
    setPatients(data ?? []);
  }

  useEffect(() => { load(); }, []);

  // When filter=active, compute the set of patient IDs that count as "active":
  //   • had a session in the last 14 days, OR
  //   • have a scheduled appointment in the next 14 days,
  //   • OR have a non-stale active session right now.
  useEffect(() => {
    if (filter !== 'active') { setActiveIds(null); return; }

    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const now = new Date();
      const fourteenDaysAgo = new Date(now.getTime() - 14 * 86400000).toISOString();
      const fourteenDaysAhead = new Date(now.getTime() + 14 * 86400000).toISOString();
      const twoHoursAgo = new Date(now.getTime() - 2 * 3600000).toISOString();

      // Sessions has no physio_id — join through patients.
      const [{ data: recentSessions }, { data: upcoming }] = await Promise.all([
        supabase
          .from('sessions')
          .select('patient_id, started_at, status, patients!inner(physio_id)')
          .eq('patients.physio_id', user.id)
          .gte('started_at', fourteenDaysAgo),
        supabase
          .from('appointments')
          .select('patient_id, scheduled_at, status')
          .eq('physio_id', user.id)
          .eq('status', 'scheduled')
          .gte('scheduled_at', now.toISOString())
          .lte('scheduled_at', fourteenDaysAhead),
      ]);

      const ids = new Set<string>();
      for (const s of recentSessions ?? []) {
        // active rows are also OK as long as they're not stale
        if (s.status !== 'active' || s.started_at >= twoHoursAgo) {
          ids.add(s.patient_id);
        }
      }
      for (const a of upcoming ?? []) ids.add(a.patient_id);

      if (!cancelled) setActiveIds(ids);
    })();
    return () => { cancelled = true; };
  }, [filter]);

  async function handleAddPatient(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
    const body: Record<string, unknown> = {
      physio_id: user.id,
      name: form.name,
      condition: form.condition,
      email: form.email || undefined,
      date_of_birth: form.date_of_birth || undefined,
      height_cm: form.height_cm ? Number(form.height_cm) : undefined,
      affected_side: form.affected_side || undefined,
    };
    await fetch(`${apiUrl}/api/patients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setForm({
      name: '', condition: '', email: '',
      date_of_birth: '', height_cm: '', affected_side: '',
    });
    setShowForm(false);
    setSaving(false);
    await load();
  }

  const filtered = patients
    .filter((p) => {
      if (statusParam === 'all') return true;
      const s = p.status ?? 'active';                 // legacy rows default to active
      return s === statusParam;
    })
    .filter((p) => activeIds === null || activeIds.has(p.id))
    .filter((p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.condition.toLowerCase().includes(search.toLowerCase()),
    );

  const statusCounts = {
    all:        patients.length,
    active:     patients.filter(p => (p.status ?? 'active') === 'active').length,
    discharged: patients.filter(p => p.status === 'discharged').length,
  };

  return (
    <div style={{
      display: 'flex', minHeight: '100vh', background: '#080812',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      <Sidebar />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Top bar */}
        <header style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 28px',
          background: '#0a0a16', borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: '#fff', margin: 0, letterSpacing: 0.5 }}>Patients</h1>
            <p style={{ fontSize: 11, color: '#445566', margin: '3px 0 0' }}>{patients.length} registered · manage profiles & session codes</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 18px',
              background: showForm ? 'rgba(239,68,68,0.15)' : 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
              border: showForm ? '1px solid rgba(239,68,68,0.3)' : 'none',
              borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 700,
              cursor: 'pointer', letterSpacing: 0.5,
            }}
          >
            {showForm ? '✕ Cancel' : '+ Add Patient'}
          </button>
        </header>

        <main style={{ flex: 1, padding: '24px 28px', overflowY: 'auto' }}>

          {/* Add Patient Form */}
          {showForm && (
            <div style={{
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(139,92,246,0.25)',
              borderRadius: 14, padding: '24px', marginBottom: 24,
            }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: '#fff', margin: '0 0 20px', letterSpacing: 0.5 }}>New Patient</h2>
              <form onSubmit={handleAddPatient}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
                  <div>
                    <label style={labelStyle}>Full Name *</label>
                    <input
                      required value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="John Smith"
                      style={inputStyle}
                      onFocus={e => e.target.style.borderColor = 'rgba(168,85,247,0.6)'}
                      onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Condition *</label>
                    <input
                      required value={form.condition}
                      onChange={(e) => setForm({ ...form, condition: e.target.value })}
                      placeholder="Rotator cuff injury"
                      style={inputStyle}
                      onFocus={e => e.target.style.borderColor = 'rgba(168,85,247,0.6)'}
                      onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Email (optional)</label>
                    <input
                      type="email" value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="patient@email.com"
                      style={inputStyle}
                      onFocus={e => e.target.style.borderColor = 'rgba(168,85,247,0.6)'}
                      onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Date of Birth (optional)</label>
                    <input
                      type="date" value={form.date_of_birth}
                      onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
                      style={{ ...inputStyle, colorScheme: 'dark' }}
                      onFocus={e => e.target.style.borderColor = 'rgba(168,85,247,0.6)'}
                      onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Height (cm, optional)</label>
                    <input
                      type="number" min={50} max={250}
                      value={form.height_cm}
                      onChange={(e) => setForm({ ...form, height_cm: e.target.value })}
                      placeholder="170"
                      style={inputStyle}
                      onFocus={e => e.target.style.borderColor = 'rgba(168,85,247,0.6)'}
                      onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Affected Side (optional)</label>
                    <select
                      value={form.affected_side}
                      onChange={(e) => setForm({ ...form, affected_side: e.target.value as '' | 'left' | 'right' | 'bilateral' })}
                      style={{ ...inputStyle, cursor: 'pointer' }}
                      onFocus={e => e.target.style.borderColor = 'rgba(168,85,247,0.6)'}
                      onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                    >
                      <option value="">— Select —</option>
                      <option value="left">Left</option>
                      <option value="right">Right</option>
                      <option value="bilateral">Bilateral</option>
                    </select>
                  </div>
                </div>
                <button
                  type="submit" disabled={saving}
                  style={{
                    padding: '10px 24px',
                    background: saving ? 'rgba(99,60,180,0.4)' : 'linear-gradient(90deg, #3b82f6, #8b5cf6, #06b6d4)',
                    border: 'none', borderRadius: 8, color: '#fff',
                    fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
                  }}
                >
                  {saving ? 'Saving…' : 'Save Patient →'}
                </button>
              </form>
            </div>
          )}

          {/* Lifecycle status pills */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 14, padding: 4,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 10, width: 'fit-content',
          }}>
            {([
              { key: 'active',     label: 'Active',     count: statusCounts.active,     color: '#a855f7' },
              { key: 'discharged', label: 'Discharged', count: statusCounts.discharged, color: '#f59e0b' },
              { key: 'all',        label: 'All',        count: statusCounts.all,        color: '#06b6d4' },
            ] as const).map(opt => {
              const active = statusParam === opt.key;
              return (
                <button
                  key={opt.key}
                  onClick={() => setStatus(opt.key as 'all' | 'active' | 'discharged')}
                  style={{
                    padding: '7px 14px', borderRadius: 7,
                    background: active ? `${opt.color}22` : 'transparent',
                    border: active ? `1px solid ${opt.color}55` : '1px solid transparent',
                    color: active ? opt.color : '#6688aa',
                    fontSize: 11, fontWeight: 700, letterSpacing: 1,
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  {opt.label}
                  <span style={{
                    fontSize: 10, fontWeight: 700,
                    padding: '1px 6px', borderRadius: 4,
                    background: active ? `${opt.color}33` : 'rgba(255,255,255,0.06)',
                    color: active ? opt.color : '#445566',
                  }}>{opt.count}</span>
                </button>
              );
            })}
          </div>

          {/* Search + behavioural-active filter chip */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: 380 }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#445566' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </span>
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search patients..."
                style={{ ...inputStyle, paddingLeft: 36 }}
                onFocus={e => e.target.style.borderColor = 'rgba(168,85,247,0.6)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
              />
            </div>

            {filter === 'active' && (
              <button
                onClick={clearFilter}
                title="Clear filter"
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 12px',
                  background: 'rgba(16,185,129,0.12)',
                  border: '1px solid rgba(16,185,129,0.35)',
                  borderRadius: 8, color: '#10b981',
                  fontSize: 11, fontWeight: 700, letterSpacing: 1.2,
                  textTransform: 'uppercase', cursor: 'pointer',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981' }} />
                Active{activeIds ? ` · ${activeIds.size}` : ''}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginLeft: 2 }}>
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>

          {/* Patient List */}
          {filtered.length === 0 ? (
            <div style={{
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 14, padding: '60px 24px', textAlign: 'center',
            }}>
              <p style={{ color: '#445566', fontSize: 14, margin: '0 0 20px' }}>
                {patients.length === 0
                  ? 'No patients yet. Add your first patient.'
                  : statusParam === 'discharged' && statusCounts.discharged === 0
                    ? 'No discharged patients yet.'
                    : filter === 'active' && activeIds && activeIds.size === 0
                      ? 'No recently active patients in the last 14 days.'
                      : 'No results found.'}
              </p>
              {patients.length === 0 && (
                <button
                  onClick={() => setShowForm(true)}
                  style={{
                    padding: '10px 20px',
                    background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
                    border: 'none', borderRadius: 8, color: '#fff',
                    fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  + Add First Patient
                </button>
              )}
              {filter === 'active' && patients.length > 0 && (
                <button
                  onClick={clearFilter}
                  style={{
                    padding: '10px 20px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8, color: '#aabbcc',
                    fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  Show All Patients
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {filtered.map((p, i) => (
                <Link key={p.id} href={`/patients/${p.id}`} style={{ textDecoration: 'none' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: 12, padding: '16px 20px', cursor: 'pointer',
                    transition: 'border-color 0.15s',
                  }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(139,92,246,0.4)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                        background: `linear-gradient(135deg, ${['#7c3aed,#06b6d4', '#0891b2,#7c3aed', '#059669,#0891b2', '#d97706,#7c3aed'][i % 4]})`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 15, fontWeight: 800, color: '#fff',
                      }}>
                        {p.name[0]}
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <p style={{ fontSize: 14, fontWeight: 700, color: '#fff', margin: 0 }}>{p.name}</p>
                          {p.status === 'discharged' && (
                            <span style={{
                              fontSize: 8, fontWeight: 700, letterSpacing: 1.2,
                              padding: '2px 6px', borderRadius: 3,
                              background: 'rgba(245,158,11,0.15)',
                              color: '#f59e0b',
                              border: '1px solid rgba(245,158,11,0.3)',
                              textTransform: 'uppercase',
                            }}>Discharged</span>
                          )}
                        </div>
                        <p style={{ fontSize: 11, color: '#6688aa', margin: '2px 0 0' }}>{p.condition}</p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                      <div style={{ textAlign: 'center' }}>
                        <p style={{ fontSize: 9, letterSpacing: 1.5, color: '#445566', textTransform: 'uppercase', fontWeight: 600, margin: '0 0 3px' }}>Session Code</p>
                        <p style={{ fontSize: 14, fontWeight: 800, color: '#a855f7', letterSpacing: 4, margin: 0, fontFamily: 'monospace' }}>{p.session_code}</p>
                      </div>
                      {p.email && (
                        <div style={{ textAlign: 'right' }}>
                          <p style={{ fontSize: 9, letterSpacing: 1.5, color: '#445566', textTransform: 'uppercase', fontWeight: 600, margin: '0 0 3px' }}>Email</p>
                          <p style={{ fontSize: 11, color: '#6688aa', margin: 0 }}>{p.email}</p>
                        </div>
                      )}
                      <span style={{ color: '#334455' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M9 18l6-6-6-6"/>
                        </svg>
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
