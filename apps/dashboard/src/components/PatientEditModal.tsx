'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const ff = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface EditablePatient {
  id: string;
  name: string;
  condition: string;
  email?: string | null;
  date_of_birth?: string | null;
  height_cm?: number | null;
  affected_side?: 'left' | 'right' | 'bilateral' | string | null;
}

export function PatientEditButton({ patient }: { patient: EditablePatient }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Edit patient details"
        style={{
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '8px 14px',
          background: 'rgba(6,182,212,0.1)',
          border: '1px solid rgba(6,182,212,0.35)',
          borderRadius: 8, color: '#06b6d4',
          fontSize: 11, fontWeight: 700, letterSpacing: 1,
          cursor: 'pointer', textTransform: 'uppercase',
          fontFamily: ff,
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
        Edit
      </button>
      {open && <PatientEditModal patient={patient} onClose={() => setOpen(false)} />}
    </>
  );
}

function PatientEditModal({
  patient, onClose,
}: { patient: EditablePatient; onClose: () => void }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name:          patient.name ?? '',
    condition:     patient.condition ?? '',
    email:         patient.email ?? '',
    date_of_birth: patient.date_of_birth ? patient.date_of_birth.slice(0, 10) : '',
    height_cm:     patient.height_cm != null ? String(patient.height_cm) : '',
    affected_side: (patient.affected_side ?? '') as '' | 'left' | 'right' | 'bilateral',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setSaving(true);
    try {
      // Build a diff-style body — only include fields that actually changed,
      // converting empty strings to null so users can clear values.
      const body: Record<string, unknown> = {};
      const trim = (v: string) => v.trim();

      if (trim(form.name)      && trim(form.name)      !== patient.name)      body.name      = trim(form.name);
      if (trim(form.condition) && trim(form.condition) !== patient.condition) body.condition = trim(form.condition);

      if (trim(form.email) !== (patient.email ?? '')) {
        body.email = trim(form.email) || null;
      }
      if (form.date_of_birth !== (patient.date_of_birth?.slice(0, 10) ?? '')) {
        body.date_of_birth = form.date_of_birth || null;
      }
      if (form.height_cm !== (patient.height_cm != null ? String(patient.height_cm) : '')) {
        body.height_cm = form.height_cm ? Number(form.height_cm) : null;
      }
      if (form.affected_side !== (patient.affected_side ?? '')) {
        body.affected_side = form.affected_side || null;
      }

      if (Object.keys(body).length === 0) {
        onClose();
        return;
      }

      const res = await fetch(`${API}/api/patients/${patient.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? `API ${res.status}`);
      onClose();
      router.refresh();
    } catch (e: any) {
      setErr(e?.message ?? 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      onClick={() => !saving && onClose()}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: ff,
      }}
    >
      <form
        onSubmit={save}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 480, maxHeight: '90vh',
          background: '#0f0f24',
          border: '1px solid rgba(6,182,212,0.3)',
          borderRadius: 16,
          padding: '24px 26px',
          boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
          display: 'flex', flexDirection: 'column', gap: 14,
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: '#fff', margin: '0 0 4px' }}>
              Edit Patient
            </h2>
            <p style={{ fontSize: 11, color: '#5577aa', margin: 0 }}>
              Update profile information. Session code is auto-generated and not editable.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={{
              background: 'none', border: 'none', color: '#445566',
              cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 0,
            }}
          >
            ✕
          </button>
        </div>

        <Field label="Name *">
          <input
            required value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            style={inputSt}
          />
        </Field>

        <Field label="Condition *">
          <input
            required value={form.condition}
            onChange={(e) => setForm({ ...form, condition: e.target.value })}
            style={inputSt}
          />
        </Field>

        <Field label="Email">
          <input
            type="email" value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="patient@email.com"
            style={inputSt}
          />
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Date of Birth">
            <input
              type="date" value={form.date_of_birth}
              onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
              style={{ ...inputSt, colorScheme: 'dark' }}
            />
          </Field>
          <Field label="Height (cm)">
            <input
              type="number" min={50} max={250}
              value={form.height_cm}
              onChange={(e) => setForm({ ...form, height_cm: e.target.value })}
              placeholder="170"
              style={inputSt}
            />
          </Field>
        </div>

        <Field label="Affected Side">
          <select
            value={form.affected_side}
            onChange={(e) => setForm({ ...form, affected_side: e.target.value as '' | 'left' | 'right' | 'bilateral' })}
            style={{ ...inputSt, cursor: 'pointer' }}
          >
            <option value="">— Not specified —</option>
            <option value="left">Left</option>
            <option value="right">Right</option>
            <option value="bilateral">Bilateral</option>
          </select>
        </Field>

        {err && (
          <div style={{
            fontSize: 12, color: '#fca5a5',
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 8, padding: '8px 12px',
          }}>
            {err}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
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
            type="submit"
            disabled={saving}
            style={{
              flex: 2, padding: '11px',
              background: saving
                ? 'rgba(99,60,180,0.4)'
                : 'linear-gradient(90deg, #06b6d4, #3b82f6, #8b5cf6)',
              border: 'none', borderRadius: 8,
              color: '#fff', fontSize: 12, fontWeight: 700, letterSpacing: 0.5,
              cursor: saving ? 'wait' : 'pointer',
              fontFamily: ff,
            }}
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}

const inputSt: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  padding: '10px 12px',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8,
  color: '#fff', fontSize: 13, outline: 'none',
  fontFamily: ff,
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{
        display: 'block', fontSize: 9, letterSpacing: 2,
        color: '#5577aa', fontWeight: 600,
        textTransform: 'uppercase', marginBottom: 6,
      }}>
        {label}
      </label>
      {children}
    </div>
  );
}
