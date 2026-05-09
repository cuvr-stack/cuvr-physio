'use client';

import { useEffect, useState, useCallback } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { createClient } from '@/lib/supabase-browser';

// ── Types ──────────────────────────────────────────────────────────────────
interface Patient { id: string; name: string; condition: string; session_code: string; }
interface Appointment {
  id: string;
  scheduled_at: string;
  duration_min: number;
  exercise_id: string;
  status: 'scheduled' | 'cancelled' | 'completed';
  notes: string | null;
  patients: Patient;
}

// ── Constants ──────────────────────────────────────────────────────────────
const DAYS   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];
const TIME_SLOTS = [
  '08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30',
  '12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30',
  '16:00','16:30','17:00',
];
const EXERCISES = [
  { id: 'shoulder_flexion',   label: 'Shoulder Flexion' },
  { id: 'shoulder_abduction', label: 'Shoulder Abduction' },
  { id: 'elbow_extension',    label: 'Elbow Extension' },
  { id: 'knee_flexion',       label: 'Knee Flexion' },
  { id: 'hip_abduction',      label: 'Hip Abduction' },
  { id: 'general',            label: 'General Assessment' },
];
const DURATIONS = [15, 30, 45, 60, 90];

const COND_COLORS: Record<string, [string, string]> = {
  'Shoulder Impingement Syndrome': ['rgba(139,92,246,0.18)', '#a855f7'],
  'ACL Reconstruction':            ['rgba(6,182,212,0.18)',  '#06b6d4'],
  'Rotator Cuff Injury':           ['rgba(16,185,129,0.18)', '#10b981'],
  'Post-Op Mobility':              ['rgba(245,158,11,0.18)', '#f59e0b'],
  'Neural Pathway Calibration':    ['rgba(239,68,68,0.18)',  '#ef4444'],
};
function patientColor(condition: string): [string, string] {
  return COND_COLORS[condition] ?? ['rgba(139,92,246,0.18)', '#8b5cf6'];
}

// ── Past-slot guard ────────────────────────────────────────────────────────
function isSlotInPast(date: Date, time: string): boolean {
  const [h, m] = time.split(':').map(Number);
  const slotTime = new Date(date);
  slotTime.setHours(h, m, 0, 0);
  return slotTime < new Date();
}

// ── Shared style helpers ───────────────────────────────────────────────────
const ff = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const inputSt: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  padding: '10px 12px',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8, color: '#fff', fontSize: 13, outline: 'none', fontFamily: ff,
};
const labelSt: React.CSSProperties = {
  display: 'block', fontSize: 10, fontWeight: 600,
  letterSpacing: 2, color: '#5577aa', marginBottom: 6, textTransform: 'uppercase',
};

// ── Booking Modal ──────────────────────────────────────────────────────────
function BookingModal({
  slot, patients, onClose, onSave,
}: {
  slot: { date: Date; time: string } | null;
  patients: Patient[];
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
}) {
  const [patientId, setPatientId]   = useState(patients[0]?.id ?? '');
  const [exerciseId, setExerciseId] = useState('shoulder_flexion');
  const [duration, setDuration]     = useState(45);
  const [notes, setNotes]           = useState('');
  const [saving, setSaving]         = useState(false);

  if (!slot) return null;

  const dateLabel = slot.date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  async function handleSave() {
    if (!patientId || !slot) return;
    const [h, m] = slot.time.split(':').map(Number);
    const dt = new Date(slot.date);
    dt.setHours(h, m, 0, 0);
    if (dt < new Date()) {
      alert('Cannot book an appointment in the past.');
      return;
    }
    setSaving(true);
    await onSave({ patient_id: patientId, exercise_id: exerciseId, duration_min: duration, notes, scheduled_at: dt.toISOString() });
    setSaving(false);
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 440, background: '#0f0f24',
        border: '1px solid rgba(139,92,246,0.3)', borderRadius: 16,
        padding: '28px 28px 24px', fontFamily: ff,
        boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: '#fff', margin: '0 0 4px' }}>Book Appointment</h2>
            <p style={{ fontSize: 11, color: '#5577aa', margin: 0 }}>
              {dateLabel} · {slot.time}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#445566', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 0 }}>✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Patient */}
          <div>
            <label style={labelSt}>Patient</label>
            <select value={patientId} onChange={e => setPatientId(e.target.value)} style={{ ...inputSt }}>
              {patients.map(p => <option key={p.id} value={p.id}>{p.name} — {p.condition}</option>)}
            </select>
          </div>

          {/* Exercise */}
          <div>
            <label style={labelSt}>Exercise Protocol</label>
            <select value={exerciseId} onChange={e => setExerciseId(e.target.value)} style={{ ...inputSt }}>
              {EXERCISES.map(ex => <option key={ex.id} value={ex.id}>{ex.label}</option>)}
            </select>
          </div>

          {/* Duration */}
          <div>
            <label style={labelSt}>Duration</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {DURATIONS.map(d => (
                <button key={d} onClick={() => setDuration(d)} style={{
                  flex: 1, padding: '9px 0',
                  background: duration === d ? 'rgba(139,92,246,0.25)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${duration === d ? '#8b5cf6' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: 8, color: duration === d ? '#a855f7' : '#6688aa',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: ff,
                }}>{d}m</button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label style={labelSt}>Notes <span style={{ color: '#334455', fontWeight: 400 }}>(optional)</span></label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Pre-session instructions or goals…"
              rows={2}
              style={{ ...inputSt, resize: 'none' }}
            />
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '12px',
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8, color: '#6688aa', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: ff,
          }}>Cancel</button>
          <button onClick={handleSave} disabled={saving || !patientId} style={{
            flex: 2, padding: '12px',
            background: saving ? 'rgba(99,60,180,0.4)' : 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
            border: 'none', borderRadius: 8,
            color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'wait' : 'pointer', fontFamily: ff,
          }}>
            {saving ? 'Booking…' : 'Confirm Booking →'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Appointment Detail Modal ───────────────────────────────────────────────
function AppointmentModal({
  appt, onClose, onCancel, onReschedule, onComplete,
}: {
  appt: Appointment | null;
  onClose: () => void;
  onCancel: (id: string) => Promise<void>;
  onReschedule: (appt: Appointment) => void;
  onComplete: (id: string) => Promise<void>;
}) {
  const [loading, setLoading] = useState<string | null>(null);
  if (!appt) return null;

  const [bg, border] = patientColor(appt.patients.condition);
  const dt = new Date(appt.scheduled_at);
  const dateLabel = dt.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const timeLabel = dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const exLabel = EXERCISES.find(e => e.id === appt.exercise_id)?.label ?? appt.exercise_id;

  async function doCancel() {
    if (!appt) return;
    setLoading('cancel');
    await onCancel(appt.id);
    setLoading(null);
  }
  async function doComplete() {
    if (!appt) return;
    setLoading('complete');
    await onComplete(appt.id);
    setLoading(null);
  }

  const isCancelled  = appt.status === 'cancelled';
  const isCompleted  = appt.status === 'completed';
  const isScheduled  = appt.status === 'scheduled';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 420, background: '#0f0f24',
        border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16,
        padding: '24px 24px 20px', fontFamily: ff,
        boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
      }}>
        {/* Status badge + close */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase',
            padding: '4px 10px', borderRadius: 4,
            background: isCancelled ? 'rgba(239,68,68,0.15)' : isCompleted ? 'rgba(16,185,129,0.15)' : bg,
            color: isCancelled ? '#ef4444' : isCompleted ? '#10b981' : border,
            border: `1px solid ${isCancelled ? 'rgba(239,68,68,0.3)' : isCompleted ? 'rgba(16,185,129,0.3)' : border + '55'}`,
          }}>
            {appt.status}
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#445566', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 0 }}>✕</button>
        </div>

        {/* Patient */}
        <div style={{
          display: 'flex', gap: 12, alignItems: 'center',
          background: bg, border: `1px solid ${border}44`, borderRadius: 10,
          padding: '12px 14px', marginBottom: 18,
        }}>
          <div style={{
            width: 38, height: 38, borderRadius: 8, flexShrink: 0,
            background: border + '33', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, fontWeight: 800, color: border,
          }}>
            {appt.patients.name[0]}
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#fff', margin: '0 0 3px' }}>{appt.patients.name}</p>
            <p style={{ fontSize: 11, color: '#6688aa', margin: 0 }}>{appt.patients.condition}</p>
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <p style={{ fontSize: 9, color: '#445566', margin: '0 0 3px', letterSpacing: 1, textTransform: 'uppercase' }}>Code</p>
            <p style={{ fontSize: 14, fontWeight: 800, color: border, fontFamily: 'monospace', letterSpacing: 3, margin: 0 }}>{appt.patients.session_code}</p>
          </div>
        </div>

        {/* Details */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          {[
            { label: 'Date', value: dateLabel },
            { label: 'Time', value: timeLabel },
            { label: 'Duration', value: `${appt.duration_min} minutes` },
            { label: 'Protocol', value: exLabel },
          ].map(item => (
            <div key={item.label} style={{
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 8, padding: '10px 12px',
            }}>
              <p style={{ fontSize: 9, letterSpacing: 1.5, color: '#445566', textTransform: 'uppercase', fontWeight: 600, margin: '0 0 4px' }}>{item.label}</p>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#fff', margin: 0 }}>{item.value}</p>
            </div>
          ))}
        </div>

        {appt.notes && (
          <div style={{
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 8, padding: '10px 12px', marginBottom: 16,
          }}>
            <p style={{ fontSize: 9, letterSpacing: 1.5, color: '#445566', textTransform: 'uppercase', fontWeight: 600, margin: '0 0 5px' }}>Notes</p>
            <p style={{ fontSize: 12, color: '#aabbcc', margin: 0, lineHeight: 1.6 }}>{appt.notes}</p>
          </div>
        )}

        {/* Actions */}
        {isScheduled && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={doCancel} disabled={loading === 'cancel'} style={{
              flex: 1, padding: '11px',
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 8, color: '#ef4444', fontSize: 12, fontWeight: 700,
              cursor: loading ? 'wait' : 'pointer', fontFamily: ff,
            }}>
              {loading === 'cancel' ? 'Cancelling…' : '✕ Cancel'}
            </button>
            <button onClick={() => onReschedule(appt)} style={{
              flex: 1, padding: '11px',
              background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
              borderRadius: 8, color: '#f59e0b', fontSize: 12, fontWeight: 700,
              cursor: 'pointer', fontFamily: ff,
            }}>
              ↺ Reschedule
            </button>
            <button onClick={doComplete} disabled={loading === 'complete'} style={{
              flex: 1, padding: '11px',
              background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
              borderRadius: 8, color: '#10b981', fontSize: 12, fontWeight: 700,
              cursor: loading ? 'wait' : 'pointer', fontFamily: ff,
            }}>
              {loading === 'complete' ? '…' : '✓ Complete'}
            </button>
          </div>
        )}

        {!isScheduled && (
          <p style={{ textAlign: 'center', fontSize: 11, color: '#334455', margin: 0 }}>
            This appointment is {appt.status} — no further actions available.
          </p>
        )}
      </div>
    </div>
  );
}

// ── Reschedule Modal ───────────────────────────────────────────────────────
function RescheduleModal({
  appt, onClose, onSave,
}: {
  appt: Appointment | null;
  onClose: () => void;
  onSave: (id: string, scheduled_at: string, duration_min: number) => Promise<void>;
}) {
  const orig = appt ? new Date(appt.scheduled_at) : new Date();
  const toLocal = (d: Date) => {
    const off = d.getTimezoneOffset();
    return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
  };
  const minDt = toLocal(new Date());
  const [dt, setDt]           = useState(toLocal(orig));
  const [duration, setDuration] = useState(appt?.duration_min ?? 45);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);

  if (!appt) return null;

  const isPast = new Date(dt) < new Date();

  async function handleSave() {
    if (new Date(dt) < new Date()) {
      setError('Cannot reschedule to a past date or time.');
      return;
    }
    setError(null);
    setSaving(true);
    await onSave(appt!.id, new Date(dt).toISOString(), duration);
    setSaving(false);
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 60,
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 380, background: '#0f0f24',
        border: '1px solid rgba(245,158,11,0.3)', borderRadius: 16,
        padding: '26px 26px 22px', fontFamily: ff,
        boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: '#fff', margin: '0 0 3px' }}>Reschedule</h2>
            <p style={{ fontSize: 11, color: '#5577aa', margin: 0 }}>{appt.patients.name}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#445566', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 0 }}>✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={labelSt}>New Date & Time</label>
            <input
              type="datetime-local"
              value={dt}
              min={minDt}
              onChange={e => { setDt(e.target.value); setError(null); }}
              style={{ ...inputSt, colorScheme: 'dark' }}
            />
            {error && (
              <p style={{ fontSize: 11, color: '#ef4444', margin: '6px 0 0' }}>{error}</p>
            )}
          </div>
          <div>
            <label style={labelSt}>Duration</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {DURATIONS.map(d => (
                <button key={d} onClick={() => setDuration(d)} style={{
                  flex: 1, padding: '9px 0',
                  background: duration === d ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${duration === d ? '#f59e0b' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: 8, color: duration === d ? '#f59e0b' : '#6688aa',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: ff,
                }}>{d}m</button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '12px',
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8, color: '#6688aa', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: ff,
          }}>Cancel</button>
          <button onClick={handleSave} disabled={saving || isPast} style={{
            flex: 2, padding: '12px',
            background: saving || isPast ? 'rgba(180,120,0,0.4)' : 'linear-gradient(90deg, #f59e0b, #d97706)',
            border: 'none', borderRadius: 8,
            color: '#fff', fontSize: 13, fontWeight: 700,
            cursor: saving ? 'wait' : isPast ? 'not-allowed' : 'pointer',
            opacity: isPast ? 0.6 : 1,
            fontFamily: ff,
          }}>
            {saving ? 'Saving…' : '↺ Confirm Reschedule'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Schedule Page ─────────────────────────────────────────────────────
export default function SchedulePage() {
  const [patients, setPatients]         = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [weekOffset, setWeekOffset]     = useState(0);
  const [loading, setLoading]           = useState(true);
  const [loadError, setLoadError]       = useState<string | null>(null);

  // Modal state
  const [bookingSlot, setBookingSlot]       = useState<{ date: Date; time: string } | null>(null);
  const [selectedAppt, setSelectedAppt]     = useState<Appointment | null>(null);
  const [rescheduleAppt, setRescheduleAppt] = useState<Appointment | null>(null);

  const supabase = createClient();
  const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

  // Week dates
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay() + weekOffset * 7);
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  const weekFrom = weekDates[0].toISOString();
  const weekTo   = new Date(weekDates[6].getTime() + 86399999).toISOString();

  // Load data
  const loadAppointments = useCallback(async (physioId: string) => {
    const res = await fetch(`${API}/api/appointments?physio_id=${physioId}&from=${weekFrom}&to=${weekTo}`);
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`API ${res.status} ${res.statusText}${txt ? ' — ' + txt.slice(0, 120) : ''}`);
    }
    setAppointments(await res.json());
  }, [weekFrom, weekTo]);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      setLoading(true);
      setLoadError(null);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          if (!cancelled) setLoadError('Not signed in. Please sign in again.');
          return;
        }

        const { data: pats, error: patErr } = await supabase
          .from('patients')
          .select('id, name, condition, session_code, status')
          .eq('physio_id', user.id)
          .order('name');
        if (patErr) throw new Error(`Patients: ${patErr.message}`);
        // Only schedule appointments for active patients
        if (!cancelled) setPatients((pats ?? []).filter((p: any) => (p.status ?? 'active') === 'active'));

        await loadAppointments(user.id);
      } catch (e: any) {
        console.error('[schedule] load failed:', e);
        if (!cancelled) {
          setLoadError(
            e?.message?.includes('Failed to fetch')
              ? `Could not reach the API at ${API}. Is the server running?`
              : (e?.message ?? 'Could not load schedule.'),
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    init();
    return () => { cancelled = true; };
  }, [weekOffset]);

  // Helpers
  function getSlotAppts(date: Date, time: string): Appointment[] {
    return appointments.filter(a => {
      const d = new Date(a.scheduled_at);
      const dStr = d.toDateString();
      const tStr = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
      return dStr === date.toDateString() && tStr === time && a.status !== 'cancelled';
    });
  }

  function getDayAppts(date: Date): Appointment[] {
    return appointments.filter(a => {
      const d = new Date(a.scheduled_at);
      return d.toDateString() === date.toDateString() && a.status === 'scheduled';
    });
  }

  // Actions
  async function handleBook(formData: any) {
    if (new Date(formData.scheduled_at) < new Date()) {
      alert('Cannot book an appointment in the past.');
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const res = await fetch(`${API}/api/appointments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...formData, physio_id: user.id }),
    });
    if (res.ok) {
      const appt = await res.json();
      setAppointments(prev => [...prev, appt]);
    }
    setBookingSlot(null);
  }

  async function handleCancel(id: string) {
    const res = await fetch(`${API}/api/appointments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled' }),
    });
    if (res.ok) {
      const updated = await res.json();
      setAppointments(prev => prev.map(a => a.id === id ? updated : a));
    }
    setSelectedAppt(null);
  }

  async function handleComplete(id: string) {
    const res = await fetch(`${API}/api/appointments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    });
    if (res.ok) {
      const updated = await res.json();
      setAppointments(prev => prev.map(a => a.id === id ? updated : a));
    }
    setSelectedAppt(null);
  }

  async function handleReschedule(id: string, scheduled_at: string, duration_min: number) {
    const res = await fetch(`${API}/api/appointments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scheduled_at, duration_min }),
    });
    if (res.ok) {
      const updated = await res.json();
      setAppointments(prev => prev.map(a => a.id === id ? updated : a));
    }
    setRescheduleAppt(null);
  }

  const todayAppts = appointments.filter(a =>
    new Date(a.scheduled_at).toDateString() === now.toDateString() && a.status === 'scheduled'
  ).sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());

  const monthLabel = `${MONTHS[weekDates[0].getMonth()]} ${weekDates[0].getFullYear()}`;
  const scheduledCount = appointments.filter(a => a.status === 'scheduled').length;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#080812', fontFamily: ff }}>
      {/* Modals */}
      <BookingModal slot={bookingSlot} patients={patients} onClose={() => setBookingSlot(null)} onSave={handleBook} />
      <AppointmentModal
        appt={selectedAppt}
        onClose={() => setSelectedAppt(null)}
        onCancel={handleCancel}
        onComplete={handleComplete}
        onReschedule={(a) => { setSelectedAppt(null); setRescheduleAppt(a); }}
      />
      <RescheduleModal
        appt={rescheduleAppt}
        onClose={() => setRescheduleAppt(null)}
        onSave={handleReschedule}
      />

      <Sidebar />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <header style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 28px', background: '#0a0a16',
          borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0,
        }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: '#fff', margin: 0 }}>Schedule</h1>
            <p style={{ fontSize: 11, color: '#445566', margin: '3px 0 0' }}>
              {monthLabel} · {scheduledCount} upcoming appointment{scheduledCount !== 1 ? 's' : ''}
            </p>
          </div>
          {/* Week navigation */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={() => setWeekOffset(w => w - 1)} style={{
              width: 34, height: 34, borderRadius: 8,
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              color: '#6688aa', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>‹</button>
            <button onClick={() => setWeekOffset(0)} style={{
              padding: '7px 14px', borderRadius: 8,
              background: weekOffset === 0 ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${weekOffset === 0 ? 'rgba(139,92,246,0.4)' : 'rgba(255,255,255,0.08)'}`,
              color: weekOffset === 0 ? '#a855f7' : '#6688aa',
              cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: ff,
            }}>Today</button>
            <button onClick={() => setWeekOffset(w => w + 1)} style={{
              width: 34, height: 34, borderRadius: 8,
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              color: '#6688aa', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>›</button>
          </div>
        </header>

        <main style={{ flex: 1, padding: '20px 28px', overflowY: 'auto', display: 'flex', gap: 20 }}>

          {/* Calendar */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Day headers */}
            <div style={{
              display: 'grid', gridTemplateColumns: '56px repeat(7, 1fr)', gap: 0,
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '12px 12px 0 0', overflow: 'hidden',
            }}>
              <div style={{ padding: '12px 8px' }} />
              {weekDates.map((d, i) => {
                const isToday = d.toDateString() === now.toDateString();
                const dayApptCount = getDayAppts(d).length;
                return (
                  <div key={i} style={{
                    padding: '12px 8px', textAlign: 'center',
                    borderLeft: '1px solid rgba(255,255,255,0.05)',
                    background: isToday ? 'rgba(139,92,246,0.1)' : 'transparent',
                  }}>
                    <p style={{ fontSize: 9, letterSpacing: 2, color: isToday ? '#a855f7' : '#445566', textTransform: 'uppercase', fontWeight: 600, margin: '0 0 4px' }}>
                      {DAYS[d.getDay()]}
                    </p>
                    <p style={{ fontSize: 18, fontWeight: 800, color: isToday ? '#fff' : '#5577aa', margin: 0, lineHeight: 1 }}>
                      {d.getDate()}
                    </p>
                    {dayApptCount > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 3, marginTop: 4 }}>
                        {Array.from({ length: Math.min(dayApptCount, 3) }).map((_, di) => (
                          <div key={di} style={{ width: 4, height: 4, borderRadius: '50%', background: '#a855f7' }} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Time grid */}
            <div style={{
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '0 0 12px 12px', overflow: 'hidden', flex: 1,
            }}>
              <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 300px)' }}>
                {loading ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
                    <p style={{ color: '#334455', fontSize: 13 }}>Loading schedule…</p>
                  </div>
                ) : loadError ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 240, gap: 12, padding: 24, textAlign: 'center' }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 10,
                      background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444',
                    }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                    </div>
                    <p style={{ color: '#fff', fontSize: 13, fontWeight: 600, margin: 0 }}>Couldn't load schedule</p>
                    <p style={{ color: '#6688aa', fontSize: 11, margin: 0, maxWidth: 380, lineHeight: 1.55 }}>{loadError}</p>
                    <button
                      onClick={() => setWeekOffset(w => w)}
                      style={{
                        marginTop: 6, padding: '8px 16px',
                        background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)',
                        borderRadius: 8, color: '#a855f7', fontSize: 11, fontWeight: 700, letterSpacing: 1,
                        textTransform: 'uppercase', cursor: 'pointer',
                      }}
                    >
                      Retry
                    </button>
                  </div>
                ) : TIME_SLOTS.map((slot) => (
                  <div key={slot} style={{
                    display: 'grid',
                    gridTemplateColumns: '56px repeat(7, 1fr)',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    minHeight: 52,
                  }}>
                    {/* Time */}
                    <div style={{
                      padding: '6px 10px 6px 8px', fontSize: 9, color: '#334455',
                      fontWeight: 600, letterSpacing: 0.5, textAlign: 'right',
                      paddingTop: 10, borderRight: '1px solid rgba(255,255,255,0.04)',
                    }}>
                      {slot}
                    </div>

                    {/* Day cells */}
                    {weekDates.map((d, di) => {
                      const isToday = d.toDateString() === now.toDateString();
                      const slotAppts = getSlotAppts(d, slot);
                      const isPast    = isSlotInPast(d, slot);
                      const bookable  = !isPast && slotAppts.length === 0 && patients.length > 0;
                      return (
                        <div
                          key={di}
                          onClick={() => {
                            if (bookable) setBookingSlot({ date: d, time: slot });
                          }}
                          title={isPast && slotAppts.length === 0 ? 'Past time — cannot book' : undefined}
                          style={{
                            borderLeft: '1px solid rgba(255,255,255,0.04)',
                            padding: '3px 4px',
                            background: isPast && slotAppts.length === 0
                              ? 'repeating-linear-gradient(45deg, rgba(255,255,255,0.015) 0 6px, transparent 6px 12px)'
                              : isToday ? 'rgba(139,92,246,0.03)' : 'transparent',
                            cursor: bookable ? 'pointer' : isPast && slotAppts.length === 0 ? 'not-allowed' : 'default',
                            opacity: isPast && slotAppts.length === 0 ? 0.5 : 1,
                            transition: 'background 0.1s',
                          }}
                          onMouseEnter={e => {
                            if (bookable)
                              e.currentTarget.style.background = 'rgba(139,92,246,0.07)';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background = isPast && slotAppts.length === 0
                              ? 'repeating-linear-gradient(45deg, rgba(255,255,255,0.015) 0 6px, transparent 6px 12px)'
                              : isToday ? 'rgba(139,92,246,0.03)' : 'transparent';
                          }}
                        >
                          {slotAppts.map(appt => {
                            const [bg, border] = patientColor(appt.patients.condition);
                            const isCompleted = appt.status === 'completed';
                            return (
                              <div
                                key={appt.id}
                                onClick={e => { e.stopPropagation(); setSelectedAppt(appt); }}
                                style={{
                                  background: isCompleted ? 'rgba(16,185,129,0.1)' : bg,
                                  border: `1px solid ${isCompleted ? '#10b981' : border}`,
                                  borderRadius: 6, padding: '4px 7px', cursor: 'pointer',
                                  marginBottom: 2,
                                }}
                              >
                                <p style={{ fontSize: 9, fontWeight: 700, color: isCompleted ? '#10b981' : border, margin: '0 0 1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {appt.patients.name}
                                </p>
                                <p style={{ fontSize: 8, color: '#445566', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {appt.duration_min}min · {EXERCISES.find(e => e.id === appt.exercise_id)?.label.split(' ')[0]}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            <p style={{ fontSize: 10, color: '#2a3a4a', textAlign: 'center' }}>
              Click any empty slot to book · Click an appointment to manage
            </p>
          </div>

          {/* Right panel */}
          <div style={{ width: 252, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Today's appointments */}
            <div style={{
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 14, padding: 18,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h3 style={{ fontSize: 12, fontWeight: 700, color: '#fff', margin: 0 }}>Today</h3>
                <span style={{ fontSize: 10, color: '#445566' }}>
                  {now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </span>
              </div>
              {todayAppts.length === 0 ? (
                <p style={{ fontSize: 11, color: '#334455', margin: 0, padding: '12px 0', textAlign: 'center' }}>
                  No sessions today
                </p>
              ) : todayAppts.map(a => {
                const [bg, border] = patientColor(a.patients.condition);
                const t = new Date(a.scheduled_at);
                const timeStr = t.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
                return (
                  <div key={a.id}
                    onClick={() => setSelectedAppt(a)}
                    style={{
                      background: bg, border: `1px solid ${border}44`,
                      borderRadius: 8, padding: '10px 12px', marginBottom: 8, cursor: 'pointer',
                    }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#fff', margin: '0 0 2px' }}>{a.patients.name}</p>
                    <p style={{ fontSize: 10, color: '#6688aa', margin: '0 0 5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {EXERCISES.find(e => e.id === a.exercise_id)?.label}
                    </p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: border }}>{timeStr}</span>
                      <span style={{ fontSize: 10, color: '#334455' }}>· {a.duration_min}min</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* All patients */}
            <div style={{
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 14, padding: 18, flex: 1,
            }}>
              <h3 style={{ fontSize: 12, fontWeight: 700, color: '#fff', margin: '0 0 12px' }}>Patients</h3>
              {patients.length === 0 ? (
                <p style={{ fontSize: 11, color: '#334455', margin: 0 }}>No patients yet</p>
              ) : patients.map((p, i) => {
                const [bg, border] = patientColor(p.condition);
                return (
                  <div key={p.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 0',
                    borderBottom: i < patients.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                      background: bg, border: `1px solid ${border}66`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 800, color: border,
                    }}>
                      {p.name[0]}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 11, fontWeight: 600, color: '#fff', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</p>
                      <p style={{ fontSize: 9, color: '#445566', margin: '2px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.condition}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
