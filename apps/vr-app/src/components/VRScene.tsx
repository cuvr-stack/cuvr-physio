'use client';

import { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Sky, Environment } from '@react-three/drei';
import { XR, createXRStore } from '@react-three/xr';
import { TelemetryStreamer } from './TelemetryStreamer';
import { GameOrchestrator } from './GameOrchestrator';
import { MetricsHUD } from './MetricsHUD';
import { GamificationHUD } from './GamificationHUD';
import { HandVisualizer } from './HandVisualizer';
import { RepParticles } from './RepParticles';
import { ScorePopups } from './ScorePopup';
import { AchievementToasts } from './AchievementToast';
import { GamificationListener } from './GamificationListener';
import { useSessionStore } from '@/store/sessionStore';
import { useGameStore } from '@/store/gameStore';
import { useSocketContext } from './SocketProvider';

const xrStore = createXRStore({
  hand: { model: true },
  controller: { model: true },
});

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export default function VRScene() {
  const socket    = useSocketContext();
  const session   = useSessionStore((s) => s.session);
  const patientId = useSessionStore((s) => s.patientId);
  const score     = useSessionStore((s) => s.score);
  const currentRep= useSessionStore((s) => s.currentRep);
  const reset     = useSessionStore((s) => s.reset);
  const gameMode  = useGameStore((s) => s.mode);
  const [ending, setEnding] = useState(false);

  async function endSession() {
    if (!session || !patientId || ending) return;
    if (!confirm('End this session? Reps and score will be saved.')) return;

    setEnding(true);
    try {
      // Tell the API socket — this closes the AI coach ticker and
      // writes session_results / updates streaks / awards achievements.
      socket?.emit('session:end', {
        sessionId:     session.id,
        patientId,
        exerciseId:    session.exerciseId ?? 'general',
        score,
        repsCompleted: currentRep,
      });

      // Belt-and-braces: also hit the REST endpoint so the row is marked
      // completed even if the socket message dropped.
      try {
        await fetch(`${API_URL}/api/sessions/${session.id}/end`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ score, repsCompleted: currentRep }),
        });
      } catch {
        /* socket already handled it; non-fatal */
      }
    } finally {
      reset();          // wipes session + sessionReady flips back via page
      setEnding(false);
    }
  }

  return (
    <>
      {/* Socket event listener lives outside Canvas (no R3F context needed) */}
      <GamificationListener />

      {/* Live game HUD — DOM overlay, visible in desktop browser. */}
      <MetricsHUD />

      <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 10, display: 'flex', gap: 10 }}>
        <button
          onClick={() => xrStore.enterVR()}
          style={{
            padding: '12px 24px',
            background: '#4488ff',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: 16,
            fontWeight: 600,
          }}
        >
          Enter VR
        </button>

        {session && (
          <button
            onClick={endSession}
            disabled={ending}
            style={{
              padding: '12px 24px',
              background: ending ? '#7a3a3a' : '#ef4444',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: ending ? 'wait' : 'pointer',
              fontSize: 16,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            {ending ? 'Ending…' : 'End Session'}
          </button>
        )}
      </div>

      <Canvas camera={{ position: [0, 1.6, 3], fov: 75 }}>
        <XR store={xrStore}>
          {/* Zen Archer draws its own dusk dome, water, and lighting — skip global IBL/sky
              so hills, river, and sakura read as one cohesive garden. */}
          {gameMode !== 'archer' && (
            <>
              <Sky sunPosition={[100, 20, 100]} />
              <Environment preset="sunset" />
              <ambientLight intensity={0.5} />
              <directionalLight position={[5, 5, 5]} intensity={1} />
            </>
          )}

          {/* Hand tracking — drives store + renders wrist spheres + ROM arc */}
          <HandVisualizer />

          {/* Reach Cascade game — replaces the static targets */}
          <GameOrchestrator />

          {/* Gamification HUD — Zen Archer uses the bespoke glass HUD instead */}
          {gameMode !== 'archer' && <GamificationHUD />}

          {/* In-VR visual feedback */}
          <RepParticles />
          <ScorePopups />
          <AchievementToasts />

          {/* Telemetry streamer */}
          <TelemetryStreamer />

          {/* Default floor — hidden in Zen Archer (that mode owns grass + river banks). */}
          {gameMode !== 'archer' && (
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
              <planeGeometry args={[20, 20]} />
              <meshStandardMaterial color="#1a1a2e" />
            </mesh>
          )}
        </XR>
      </Canvas>
    </>
  );
}
