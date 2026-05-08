'use client';

import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import type { TelemetryFrame, CoachDecision } from '@physio-vr/shared-types';
import { LiveSessionCard } from '@/components/LiveSessionCard';
import { Sidebar } from '@/components/Sidebar';
import { CoachFeed } from '@/components/CoachFeed';
import { createClient } from '@/lib/supabase-browser';

export default function SessionsPage() {
  const [frames, setFrames] = useState<Record<string, TelemetryFrame>>({});
  const [coachLog, setCoachLog] = useState<CoachDecision[]>([]);
  const [patientNames, setPatientNames] = useState<Record<string, string>>({});
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    let cancelled = false;
    const socket = io(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001', {
      transports: ['websocket'],
    });
    socketRef.current = socket;

    socket.on('telemetry:update', (frame: TelemetryFrame) => {
      setFrames((prev) => ({ ...prev, [frame.patientId]: frame }));
    });

    // Drop the cached frame so the live card disappears when a session ends.
    socket.on('session:end', (payload: { patientId: string; sessionId: string }) => {
      setFrames((prev) => {
        // Only clear if the frame we have matches the session that just ended
        const existing = prev[payload.patientId];
        if (!existing || existing.sessionId !== payload.sessionId) return prev;
        const next = { ...prev };
        delete next[payload.patientId];
        return next;
      });
    });

    socket.on('coach:decision', (decision: CoachDecision) => {
      setCoachLog((prev) => [decision, ...prev].slice(0, 30));
    });

    // Idle reaper: if no telemetry frame has arrived for a patient in the last
    // 8 seconds, treat the session as dead. Catches missed session:end events,
    // VR-app crashes, network drops, and any orphaned state on first load.
    const reaper = setInterval(() => {
      const cutoff = Date.now() - 8000;
      setFrames((prev) => {
        let changed = false;
        const next: typeof prev = {};
        for (const [pid, frame] of Object.entries(prev)) {
          if (frame.timestamp >= cutoff) {
            next[pid] = frame;
          } else {
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 2000);

    // Subscribe to every patient under this physio so we receive any
    // telemetry / coach broadcasts for them. The API uses socket.to(room) which
    // only delivers to subscribers — without this the page never sees a frame.
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      const { data: patients } = await supabase
        .from('patients')
        .select('id, name')
        .eq('physio_id', user.id);

      if (!patients || cancelled) return;

      const nameMap: Record<string, string> = {};
      for (const p of patients) {
        nameMap[p.id] = p.name;
        socket.emit('dashboard:subscribe', p.id);
      }
      setPatientNames(nameMap);
    })();

    return () => {
      cancelled = true;
      clearInterval(reaper);
      socket.disconnect();
    };
  }, []);

  const activeSessions = Object.values(frames);

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
            <h1 style={{ fontSize: 20, fontWeight: 800, color: '#fff', margin: 0, letterSpacing: 0.5 }}>VR Sessions</h1>
            <p style={{ fontSize: 11, color: '#445566', margin: '3px 0 0' }}>
              {activeSessions.length > 0 ? (
                <><span style={{ color: '#ef4444' }}>●</span> {activeSessions.length} active session{activeSessions.length !== 1 ? 's' : ''} — live telemetry</>
              ) : 'Awaiting VR headset connections'}
            </p>
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 14px',
            background: activeSessions.length > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${activeSessions.length > 0 ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.07)'}`,
            borderRadius: 8,
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%',
              background: activeSessions.length > 0 ? '#ef4444' : '#334455',
              display: 'inline-block',
              boxShadow: activeSessions.length > 0 ? '0 0 8px #ef4444' : 'none',
            }} />
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: activeSessions.length > 0 ? '#ef4444' : '#445566', textTransform: 'uppercase' }}>
              {activeSessions.length > 0 ? 'Live' : 'Standby'}
            </span>
          </div>
        </header>

        <main style={{ flex: 1, padding: '24px 28px', overflowY: 'auto' }}>
          {activeSessions.length === 0 ? (
            <div style={{
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 14, padding: '80px 24px', textAlign: 'center',
            }}>
              <div style={{
                width: 64, height: 64, borderRadius: 16, margin: '0 auto 20px',
                background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="1.5">
                  <path d="M2 8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8z"/>
                  <circle cx="9" cy="12" r="2"/><circle cx="15" cy="12" r="2"/>
                </svg>
              </div>
              <p style={{ color: '#fff', fontSize: 16, fontWeight: 700, margin: '0 0 8px' }}>No Active Sessions</p>
              <p style={{ color: '#445566', fontSize: 13, margin: 0, lineHeight: 1.6 }}>
                Start a VR session on the Meta Quest to see<br />live telemetry and movement data here.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16 }}>
                {activeSessions.map((frame) => (
                  <LiveSessionCard key={frame.patientId} frame={frame} />
                ))}
              </div>
              <div style={{ width: 320, flexShrink: 0, position: 'sticky', top: 0 }}>
                <CoachFeed
                  decisions={coachLog}
                  patientNameById={patientNames}
                />
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
