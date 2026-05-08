'use client';

import { useState } from 'react';
import { useSessionStore } from '@/store/sessionStore';
import { useGameStore, type GameMode } from '@/store/gameStore';
import { useSocketContext } from './SocketProvider';

const EXERCISE_TO_MODE: Record<string, GameMode> = {
  'shoulder-flexion':   'cascade',
  'elbow-extension':    'cascade',
  'cosmic-catch':       'cosmic-catch',
  'boxing-drills':      'boxing',
  'zen-archer':         'archer',
  'galactic-shield':    'galactic-shield',
  'knee-flexion':       'knee-flexion',
  'hip-abduction':      'hip-abduction',
  'cervical-stargazer': 'cervical',
};

// Lower-body exercises require strapping the controller to the affected ankle
// since Quest doesn't track feet — surface this in the UI when selected.
const LEG_EXERCISES = new Set(['knee-flexion', 'hip-abduction']);

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

// Default in-game target ROM (degrees) per exercise.
// Keep in sync with the markers placed in VRScene.
const TARGET_ROM_BY_EXERCISE: Record<string, number> = {
  'shoulder-flexion':   90,
  'elbow-extension':    120,
  'shoulder-abduction': 90,
  'knee-flexion':       110,
  'hip-abduction':      45,
  'cosmic-catch':       110,        // generous overhead reach
  'boxing-drills':      75,         // chest-height punch
  'zen-archer':         95,         // abduction + external rotation combined
  'galactic-shield':    100,        // multi-planar reach
  'cervical-stargazer': 60,         // cervical rotation/flexion in degrees
  'general':            90,
};

interface PatientLookup {
  id: string;
  name: string;
  condition: string;
  date_of_birth?: string | null;
  height_cm?: number | null;
  affected_side?: 'left' | 'right' | 'bilateral' | null;
}

interface Props {
  onReady: () => void;
}

export function SessionSetup({ onReady }: Props) {
  const [code, setCode] = useState('');
  const [exercise, setExercise] = useState('shoulder-flexion');
  const [patient, setPatient] = useState<PatientLookup | null>(null);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'code' | 'confirm' | 'vas'>('code');
  const [loading, setLoading] = useState(false);
  const [pain, setPain] = useState<number | null>(null);

  const setPatientId    = useSessionStore((s) => s.setPatientId);
  const setSession      = useSessionStore((s) => s.setSession);
  const setDemographics = useSessionStore((s) => s.setDemographics);
  const setMode         = useGameStore((s) => s.setMode);
  const socket          = useSocketContext();

  async function lookupCode() {
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/patients/code/${code.trim().toUpperCase()}`);
      if (!res.ok) {
        setError('Code not found. Check with your physiotherapist.');
        return;
      }
      const data: PatientLookup = await res.json();
      setPatient(data);
      setStep('confirm');
    } catch {
      setError('Could not connect to server. Check your network.');
    } finally {
      setLoading(false);
    }
  }

  async function startSession() {
    if (!patient) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/sessions/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: patient.id,
          exerciseId: exercise,
          pain_at_start: pain ?? undefined,
        }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`API ${res.status}${txt ? ' — ' + txt.slice(0, 120) : ''}`);
      }
      const session = await res.json();

      setPatientId(patient.id);
      setDemographics({
        dateOfBirth:  patient.date_of_birth ?? null,
        heightCm:     patient.height_cm ?? null,
        affectedSide: patient.affected_side ?? null,
      });
      // Pick the right game mode for this exercise — drives target generation
      setMode(EXERCISE_TO_MODE[exercise] ?? 'cascade');
      setSession(session);

      // Wake up the server-side ROM accumulator + AI coach.
      // Without this event the coach never starts ticking.
      const targetROM = TARGET_ROM_BY_EXERCISE[exercise] ?? 90;
      socket?.emit('session:start', {
        patientId: patient.id,
        exerciseId: exercise,
        sessionId: session.id,
        targetROM,
      });

      onReady();
    } catch (e: any) {
      console.error('[session-setup] start failed:', e);
      setError(e?.message?.includes('API ') ? e.message : 'Failed to start session. Try again.');
    } finally {
      setLoading(false);
    }
  }

  const containerStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(10,10,20,0.97)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
  };

  const cardStyle: React.CSSProperties = {
    background: '#12122a',
    border: '1px solid #2a2a4a',
    borderRadius: 16,
    padding: 40,
    width: 360,
    color: '#fff',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 16px',
    background: '#1a1a3a',
    border: '1px solid #3a3a5a',
    borderRadius: 8,
    color: '#fff',
    fontSize: 20,
    fontFamily: 'monospace',
    letterSpacing: 8,
    textTransform: 'uppercase',
    textAlign: 'center',
    outline: 'none',
    boxSizing: 'border-box',
  };

  const btnStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 0',
    background: '#4488ff',
    border: 'none',
    borderRadius: 8,
    color: '#fff',
    fontSize: 16,
    fontWeight: 600,
    cursor: loading ? 'not-allowed' : 'pointer',
    opacity: loading ? 0.6 : 1,
    marginTop: 12,
  };

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>CuVR Physio</h1>
        <p style={{ color: '#8888aa', fontSize: 13, marginBottom: 28 }}>
          {step === 'code' ? 'Enter your session code to begin'
            : step === 'confirm' ? 'Confirm your session details'
            : 'A quick check before we begin'}
        </p>

        {step === 'code' && (
          <>
            <label style={{ fontSize: 12, color: '#8888aa', display: 'block', marginBottom: 6 }}>
              SESSION CODE
            </label>
            <input
              style={inputStyle}
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
              onKeyDown={(e) => e.key === 'Enter' && code.length === 6 && lookupCode()}
            />
            {error && <p style={{ color: '#ff6666', fontSize: 13, marginTop: 8 }}>{error}</p>}
            <button
              style={btnStyle}
              onClick={lookupCode}
              disabled={loading || code.length !== 6}
            >
              {loading ? 'Looking up…' : 'Continue'}
            </button>
          </>
        )}

        {step === 'confirm' && patient && (
          <>
            <div style={{ background: '#1a1a3a', borderRadius: 10, padding: 16, marginBottom: 20 }}>
              <p style={{ fontSize: 18, fontWeight: 700 }}>{patient.name}</p>
              <p style={{ color: '#8888aa', fontSize: 13, marginTop: 2 }}>{patient.condition}</p>
            </div>

            <label style={{ fontSize: 12, color: '#8888aa', display: 'block', marginBottom: 6 }}>
              EXERCISE
            </label>
            <select
              value={exercise}
              onChange={(e) => setExercise(e.target.value)}
              style={{
                ...inputStyle,
                letterSpacing: 0,
                fontSize: 15,
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <option value="shoulder-flexion">Shoulder Flexion · Reach Cascade</option>
              <option value="elbow-extension">Elbow Extension · Reach Cascade</option>
              <option value="cosmic-catch">Cosmic Catch · Falling-target reach</option>
              <option value="boxing-drills">Boxing Drills · Bilateral rotator-cuff</option>
              <option value="zen-archer">Zen Archer · Rotator-cuff & scapular stability</option>
              <option value="galactic-shield">Galactic Shield · Multi-planar reach & reflex</option>
              <option value="knee-flexion">Knee Flexion · Seated heel-pull (lower limb)</option>
              <option value="hip-abduction">Hip Abduction · Lateral leg-lift (lower limb)</option>
              <option value="cervical-stargazer">Cervical Stargazer · Neck rotation & flexion</option>
            </select>

            {/* Setup tip when a leg mode is selected */}
            {LEG_EXERCISES.has(exercise) && (
              <div style={{
                marginTop: 12,
                background: 'rgba(34, 211, 238, 0.08)',
                border: '1px solid rgba(34, 211, 238, 0.3)',
                borderRadius: 8,
                padding: '10px 12px',
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
              }}>
                <span style={{ fontSize: 16, lineHeight: 1, marginTop: 1 }}>🦵</span>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#22d3ee', margin: '0 0 4px' }}>
                    Setup for lower-limb exercise
                  </p>
                  <p style={{ fontSize: 11, color: '#aabbcc', margin: 0, lineHeight: 1.55 }}>
                    Strap or hold the Quest controller against the affected leg's ankle.
                    Sit in a chair for knee flexion; stand for hip abduction (or sit if balance is a concern).
                  </p>
                </div>
              </div>
            )}

            {error && <p style={{ color: '#ff6666', fontSize: 13, marginTop: 8 }}>{error}</p>}

            <button style={btnStyle} onClick={() => setStep('vas')} disabled={loading}>
              Continue
            </button>
            <button
              style={{ ...btnStyle, background: 'transparent', border: '1px solid #3a3a5a', marginTop: 8 }}
              onClick={() => { setStep('code'); setPatient(null); setError(''); }}
            >
              Back
            </button>
          </>
        )}

        {step === 'vas' && patient && (
          <>
            <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
              How is your pain right now?
            </p>
            <p style={{ fontSize: 12, color: '#8888aa', marginBottom: 22 }}>
              0 = no pain · 10 = worst imaginable
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(11, 1fr)', gap: 4, marginBottom: 22 }}>
              {Array.from({ length: 11 }).map((_, i) => {
                const active = pain === i;
                const tint = i <= 3 ? '#10b981' : i <= 6 ? '#f59e0b' : '#ef4444';
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setPain(i)}
                    style={{
                      padding: '12px 0',
                      background: active ? tint : '#1a1a3a',
                      border: `1px solid ${active ? tint : '#3a3a5a'}`,
                      borderRadius: 6,
                      color: active ? '#fff' : '#8899aa',
                      fontSize: 14, fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {i}
                  </button>
                );
              })}
            </div>

            {error && <p style={{ color: '#ff6666', fontSize: 13, marginBottom: 8 }}>{error}</p>}

            <button style={btnStyle} onClick={startSession} disabled={loading}>
              {loading ? 'Starting…' : pain == null ? 'Skip & Start' : 'Start Session'}
            </button>
            <button
              style={{ ...btnStyle, background: 'transparent', border: '1px solid #3a3a5a', marginTop: 8 }}
              onClick={() => { setStep('confirm'); setPain(null); setError(''); }}
            >
              Back
            </button>
          </>
        )}
      </div>
    </div>
  );
}
