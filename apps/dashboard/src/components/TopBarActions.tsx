'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase-browser';
import { MFASettings } from './MFASettings';

const ff = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

interface Notif {
  id: string;
  title: string;
  detail: string;
  time: string;          // ISO
  kind: 'appointment' | 'session' | 'system';
}

export function TopBarActions({
  initialFullName,
  initialClinic,
}: {
  initialFullName: string;
  initialClinic: string;
}) {
  const [openPanel, setOpenPanel] = useState<null | 'notif' | 'settings' | 'help'>(null);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  // ── Dismissal persistence (localStorage) ──────────────────────────────────
  // We can't delete the source rows (appointments / sessions are real data),
  // so "dismissed" lives client-side. Old IDs are pruned automatically below.
  const DISMISS_KEY = 'cuvr.dismissed_notifs.v1';
  const DISMISS_TTL_MS = 7 * 24 * 3600 * 1000; // 7 days

  function readDismissed(): Record<string, number> {
    if (typeof window === 'undefined') return {};
    try {
      const raw = localStorage.getItem(DISMISS_KEY);
      if (!raw) return {};
      const parsed: Record<string, number> = JSON.parse(raw);
      const now = Date.now();
      // prune anything older than TTL
      const fresh: Record<string, number> = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (now - v < DISMISS_TTL_MS) fresh[k] = v;
      }
      return fresh;
    } catch { return {}; }
  }
  function writeDismissed(map: Record<string, number>) {
    if (typeof window === 'undefined') return;
    try { localStorage.setItem(DISMISS_KEY, JSON.stringify(map)); } catch { /* quota */ }
  }
  function dismissOne(id: string) {
    const map = readDismissed();
    map[id] = Date.now();
    writeDismissed(map);
    setNotifs(prev => prev.filter(n => n.id !== id));
  }
  function dismissAll() {
    const map = readDismissed();
    const now = Date.now();
    for (const n of notifs) map[n.id] = now;
    writeDismissed(map);
    setNotifs([]);
    setUnread(0);
  }

  // Close any open panel on outside click
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpenPanel(null);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  // Load notifications: today's scheduled appointments + recently completed sessions
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
      const endOfDay   = new Date(); endOfDay.setHours(23, 59, 59, 999);

      const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

      // Today's appointments
      let appts: any[] = [];
      try {
        const r = await fetch(`${API}/api/appointments?physio_id=${user.id}&from=${startOfDay.toISOString()}&to=${endOfDay.toISOString()}`);
        if (r.ok) appts = await r.json();
      } catch { /* ignore */ }

      // Recently completed sessions (last 24h)
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      // Sessions has no physio_id — join through patients with an inner filter.
      const { data: sessions } = await supabase
        .from('sessions')
        .select('id, ended_at, reps_completed, status, patients!inner(name, physio_id), session_results(avg_rom, max_rom)')
        .eq('patients.physio_id', user.id)
        .eq('status', 'completed')
        .gte('ended_at', since)
        .order('ended_at', { ascending: false })
        .limit(5);

      const items: Notif[] = [];

      for (const a of appts.filter((x: any) => x.status === 'scheduled')) {
        items.push({
          id: `appt-${a.id}`,
          title: `Appointment with ${a.patients?.name ?? 'Patient'}`,
          detail: `${new Date(a.scheduled_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} · ${a.duration_min} min`,
          time: a.scheduled_at,
          kind: 'appointment',
        });
      }
      for (const s of (sessions ?? []) as any[]) {
        items.push({
          id: `sess-${s.id}`,
          title: `${s.patients?.name ?? 'Patient'} completed a session`,
          detail: `${s.reps_completed ?? 0} reps · ${s.session_results?.[0]?.avg_rom ?? 0}° avg ROM`,
          time: s.ended_at,
          kind: 'session',
        });
      }

      items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

      // Filter out anything the user has previously dismissed
      const dismissed = readDismissed();
      const visible = items.filter(it => !(it.id in dismissed));

      setNotifs(visible);
      setUnread(visible.length);
    })();
  }, []);

  function toggle(panel: 'notif' | 'settings' | 'help') {
    setOpenPanel(prev => (prev === panel ? null : panel));
    if (panel === 'notif') setUnread(0);
  }

  return (
    <div ref={wrapRef} style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative' }}>

      {/* Bell */}
      <IconButton
        active={openPanel === 'notif'}
        badge={unread}
        onClick={() => toggle('notif')}
        title="Notifications"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      </IconButton>

      {/* Gear */}
      <IconButton active={openPanel === 'settings'} onClick={() => toggle('settings')} title="Settings">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </IconButton>

      {/* Help */}
      <IconButton active={openPanel === 'help'} onClick={() => toggle('help')} title="Help">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </IconButton>

      {openPanel === 'notif'    && (
        <NotificationsPanel
          notifs={notifs}
          onDismiss={dismissOne}
          onClearAll={dismissAll}
        />
      )}
      {openPanel === 'settings' && <SettingsPanel  initialFullName={initialFullName} initialClinic={initialClinic} onClose={() => setOpenPanel(null)} />}
      {openPanel === 'help'     && <HelpPanel />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function IconButton({
  children, onClick, active, title, badge,
}: {
  children: React.ReactNode; onClick: () => void; active?: boolean; title?: string; badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        position: 'relative',
        width: 34, height: 34, borderRadius: 8,
        background: active ? 'rgba(139,92,246,0.18)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${active ? 'rgba(139,92,246,0.4)' : 'rgba(255,255,255,0.07)'}`,
        color: active ? '#a855f7' : '#6688aa',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.15s',
      }}
    >
      {children}
      {!!badge && badge > 0 && (
        <span style={{
          position: 'absolute', top: -3, right: -3,
          minWidth: 16, height: 16, padding: '0 4px',
          borderRadius: 8, background: '#ef4444',
          fontSize: 9, fontWeight: 800, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '2px solid #0a0a16', fontFamily: ff,
        }}>{badge > 9 ? '9+' : badge}</span>
      )}
    </button>
  );
}

// ─── Panels share a wrapper ──────────────────────────────────────────────────
const panelStyle: React.CSSProperties = {
  position: 'absolute', top: 'calc(100% + 10px)', right: 0,
  width: 340, background: '#0f0f24',
  border: '1px solid rgba(139,92,246,0.25)', borderRadius: 12,
  boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
  zIndex: 50, fontFamily: ff, overflow: 'hidden',
};

// ─── Notifications ───────────────────────────────────────────────────────────
function NotificationsPanel({
  notifs, onDismiss, onClearAll,
}: {
  notifs: Notif[];
  onDismiss: (id: string) => void;
  onClearAll: () => void;
}) {
  return (
    <div style={panelStyle}>
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10,
      }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', margin: 0 }}>Notifications</p>
          <p style={{ fontSize: 10, color: '#5577aa', margin: '2px 0 0' }}>
            {notifs.length > 0
              ? `${notifs.length} item${notifs.length !== 1 ? 's' : ''}`
              : 'Today\'s appointments and recent activity'}
          </p>
        </div>
        {notifs.length > 0 && (
          <button
            onClick={onClearAll}
            style={{
              fontSize: 10, fontWeight: 700, letterSpacing: 1.2,
              color: '#a855f7',
              background: 'rgba(139,92,246,0.1)',
              border: '1px solid rgba(139,92,246,0.25)',
              borderRadius: 6, padding: '5px 10px',
              cursor: 'pointer', textTransform: 'uppercase',
              fontFamily: ff,
            }}
          >
            Clear All
          </button>
        )}
      </div>
      <div style={{ maxHeight: 380, overflowY: 'auto' }}>
        {notifs.length === 0 ? (
          <div style={{ padding: '32px 16px 28px', textAlign: 'center' }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, margin: '0 auto 10px',
              background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <p style={{ fontSize: 12, color: '#aabbcc', margin: '0 0 4px', fontWeight: 600 }}>
              You're all caught up.
            </p>
            <p style={{ fontSize: 10, color: '#445566', margin: 0 }}>
              New appointments and completed sessions will appear here.
            </p>
          </div>
        ) : notifs.map(n => {
          const accent = n.kind === 'appointment' ? '#a855f7'
                       : n.kind === 'session'     ? '#10b981'
                       : '#06b6d4';
          return (
            <div key={n.id}
              className="notif-row"
              style={{
                display: 'flex', gap: 10, padding: '12px 16px',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                position: 'relative',
                transition: 'background 0.12s',
              }}
            >
              <div style={{
                width: 6, alignSelf: 'stretch', borderRadius: 3,
                background: accent, flexShrink: 0,
              }} />
              <div style={{ flex: 1, minWidth: 0, paddingRight: 22 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: '#fff', margin: '0 0 3px' }}>{n.title}</p>
                <p style={{ fontSize: 10, color: '#6688aa', margin: 0 }}>{n.detail}</p>
                <p style={{ fontSize: 9, color: '#334455', margin: '4px 0 0', letterSpacing: 0.5 }}>
                  {timeAgo(n.time)}
                </p>
              </div>
              <button
                onClick={() => onDismiss(n.id)}
                aria-label="Dismiss"
                title="Dismiss"
                className="notif-x"
                style={{
                  position: 'absolute', top: 10, right: 10,
                  width: 20, height: 20, borderRadius: 5,
                  background: 'transparent', border: 'none',
                  color: '#445566', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, lineHeight: 1, padding: 0,
                  transition: 'background 0.12s, color 0.12s',
                }}
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
      <style>{`
        .notif-row:hover { background: rgba(255,255,255,0.02); }
        .notif-x:hover {
          background: rgba(239,68,68,0.15) !important;
          color: #ef4444 !important;
        }
      `}</style>
    </div>
  );
}

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 0) {
    const ahead = -diff;
    if (ahead < 3600) return `In ${Math.round(ahead / 60)} min`;
    return `In ${Math.round(ahead / 3600)} h`;
  }
  if (diff < 60)   return 'Just now';
  if (diff < 3600) return `${Math.round(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)} h ago`;
  return `${Math.round(diff / 86400)} d ago`;
}

// ─── Settings ────────────────────────────────────────────────────────────────
function SettingsPanel({
  initialFullName, initialClinic, onClose,
}: { initialFullName: string; initialClinic: string; onClose: () => void; }) {
  const [fullName, setFullName] = useState(initialFullName);
  const [clinic,   setClinic]   = useState(initialClinic);
  const [saving, setSaving]     = useState(false);
  const [msg, setMsg]           = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setMsg(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName, clinic_name: clinic })
      .eq('id', user.id);
    setSaving(false);
    if (error) setMsg('Could not save: ' + error.message);
    else {
      setMsg('Saved ✓');
      setTimeout(() => { onClose(); window.location.reload(); }, 700);
    }
  }

  const label: React.CSSProperties = {
    display: 'block', fontSize: 9, letterSpacing: 2,
    color: '#5577aa', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6,
  };
  const input: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    padding: '10px 12px', background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
    color: '#fff', fontSize: 13, outline: 'none', fontFamily: ff,
  };

  return (
    <div style={panelStyle}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', margin: 0 }}>Settings</p>
        <p style={{ fontSize: 10, color: '#5577aa', margin: '2px 0 0' }}>Update your profile information</p>
      </div>
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14, maxHeight: 'calc(100vh - 180px)', overflowY: 'auto' }}>
        <div>
          <label style={label}>Full Name</label>
          <input style={input} value={fullName} onChange={e => setFullName(e.target.value)} />
        </div>
        <div>
          <label style={label}>Clinic Name</label>
          <input style={input} value={clinic} onChange={e => setClinic(e.target.value)} />
        </div>
        {msg && <p style={{ fontSize: 11, color: msg.startsWith('Saved') ? '#10b981' : '#ef4444', margin: 0 }}>{msg}</p>}
        <button onClick={save} disabled={saving} style={{
          padding: '11px', borderRadius: 8, border: 'none',
          background: saving ? 'rgba(99,60,180,0.4)' : 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
          color: '#fff', fontSize: 12, fontWeight: 700, letterSpacing: 0.5,
          cursor: saving ? 'wait' : 'pointer', fontFamily: ff,
        }}>
          {saving ? 'Saving…' : 'Save Changes'}
        </button>

        {/* Divider */}
        <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '4px 0 0' }} />

        {/* Security */}
        <p style={{ fontSize: 9, letterSpacing: 2, color: '#5577aa', fontWeight: 600, textTransform: 'uppercase', margin: '4px 0 0' }}>
          Security
        </p>
        <MFASettings />
      </div>
    </div>
  );
}

// ─── Help ────────────────────────────────────────────────────────────────────
function HelpPanel() {
  const items = [
    { k: 'Patients', v: 'Add and manage patients in the Patients tab. Each gets a unique session code for VR pairing.' },
    { k: 'VR Sessions', v: 'Live telemetry streams here while a patient is in headset. Reps, ROM, and pain alerts update in real time.' },
    { k: 'Schedule', v: 'Click any empty slot in the calendar to book. Click a booked slot to cancel, reschedule, or mark complete.' },
    { k: 'Reports', v: 'Open a patient\'s detail page and use Download Report for a printable PDF.' },
  ];
  return (
    <div style={panelStyle}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', margin: 0 }}>Quick Help</p>
        <p style={{ fontSize: 10, color: '#5577aa', margin: '2px 0 0' }}>How CUVR works</p>
      </div>
      <div style={{ padding: '6px 0', maxHeight: 360, overflowY: 'auto' }}>
        {items.map((it, i) => (
          <div key={i} style={{
            padding: '12px 16px',
            borderBottom: i < items.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
          }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#a855f7', margin: '0 0 4px', letterSpacing: 0.5 }}>{it.k}</p>
            <p style={{ fontSize: 11, color: '#8899aa', margin: 0, lineHeight: 1.55 }}>{it.v}</p>
          </div>
        ))}
        <div style={{ padding: '12px 16px' }}>
          <a href="mailto:support@cuvr.health" style={{
            display: 'block', textAlign: 'center', padding: '9px',
            background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.3)',
            borderRadius: 8, color: '#06b6d4', fontSize: 11, fontWeight: 700,
            textDecoration: 'none', letterSpacing: 1, textTransform: 'uppercase',
          }}>
            Contact Support
          </a>
        </div>
      </div>
    </div>
  );
}
