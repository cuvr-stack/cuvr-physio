'use client';

import { useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import { useGameStore, targetsForMode } from '@/store/gameStore';
import type { GameMode } from '@/store/gameStore';
import { useSessionStore } from '@/store/sessionStore';
import { useSocketContext } from './SocketProvider';
import { TargetNode } from './TargetNode';
import { ZenArcher } from './ZenArcher';
import { GalacticShield } from './GalacticShield';
import { Stargazer } from './Stargazer';

/** Round size per mode. */
const TARGETS_PER_ROUND: Record<GameMode, number> = {
  cascade:           15,
  'cosmic-catch':    12,
  boxing:            16,
  archer:             8,           // slow shots; 8 ≈ 2-3 minutes
  'galactic-shield': 14,           // multi-planar; ~2-3 min round
  'knee-flexion':    12,           // controlled, slow tempo
  'hip-abduction':   12,           // controlled, slow tempo
  cervical:          12,           // hold-required gaze; ~2-3 min round
};

/** Per-target dwell time. Older patients get a longer window.
 *  Boxing has a tighter window for tempo; cosmic-catch uses gravity (no timeout). */
function targetTimeoutMsForAge(ageYears: number | null, mode: GameMode): number {
  if (mode === 'cosmic-catch')    return Number.MAX_SAFE_INTEGER;   // gravity ends it
  if (mode === 'archer')           return Number.MAX_SAFE_INTEGER;   // patient-paced
  if (mode === 'galactic-shield')  return Number.MAX_SAFE_INTEGER;   // bolt collision ends it
  if (mode === 'cervical')         return Number.MAX_SAFE_INTEGER;   // patient-paced gaze
  const base =
    mode === 'boxing'         ? 1800
    : mode === 'knee-flexion'  ? 4500    // slow controlled flex; generous window
    : mode === 'hip-abduction' ? 4500
    /* cascade */               : 3500;

  const factor =
    ageYears == null   ? 1
    : ageYears >= 75   ? 1.4
    : ageYears >= 65   ? 1.25
    : ageYears < 18    ? 0.85
                       : 1;
  return Math.round(base * factor);
}

export function GameOrchestrator() {
  const mode              = useGameStore((s) => s.mode);
  const state             = useGameStore((s) => s.state);
  const targets           = useGameStore((s) => s.targets);
  const activeTargetIndex = useGameStore((s) => s.activeTargetIndex);
  const countdownSeconds  = useGameStore((s) => s.countdownSeconds);
  const score             = useGameStore((s) => s.score);
  const successCount      = useGameStore((s) => s.successCount);
  const bestCombo         = useGameStore((s) => s.bestCombo);

  const startCountdown = useGameStore((s) => s.startCountdown);
  const tickCountdown  = useGameStore((s) => s.tickCountdown);
  const hitTargetAct   = useGameStore((s) => s.hitTarget);
  const missTargetAct  = useGameStore((s) => s.missTarget);
  const reset          = useGameStore((s) => s.reset);

  const session       = useSessionStore((s) => s.session);
  const patientId     = useSessionStore((s) => s.patientId);
  const demographics  = useSessionStore((s) => s.demographics);
  const incrementRep  = useSessionStore((s) => s.incrementRep);
  const currentROM    = useSessionStore((s) => s.currentROM);
  const socket        = useSocketContext();

  // ── Auto-start when session begins; reset when session clears ──
  useEffect(() => {
    if (session && state === 'idle') {
      const ageYears = demographics.dateOfBirth
        ? Math.floor((Date.now() - new Date(demographics.dateOfBirth).getTime()) / (365.25 * 86400000))
        : null;
      // Default target ROM by exercise — kept in sync with the API's TARGET_ROM_BY_EXERCISE.
      const initialTargetROM = 90;
      const count = TARGETS_PER_ROUND[mode];
      startCountdown(
        targetsForMode(mode, count, {
          heightCm:     demographics.heightCm,
          affectedSide: demographics.affectedSide,
          ageYears,
        }),
        initialTargetROM,
      );
    } else if (!session && state !== 'idle') {
      reset();
    }
  }, [session, state, startCountdown, reset]);

  // ── Countdown ticker ──
  useEffect(() => {
    if (state !== 'countdown') return;
    const id = setInterval(tickCountdown, 1000);
    return () => clearInterval(id);
  }, [state, tickCountdown]);

  // ── Target timeout watcher (age-aware) ──
  useFrame(() => {
    if (state !== 'playing') return;
    const active = targets[activeTargetIndex];
    if (!active || active.status !== 'active') return;
    const ageYears = demographics.dateOfBirth
      ? Math.floor((Date.now() - new Date(demographics.dateOfBirth).getTime()) / (365.25 * 86400000))
      : null;
    if (Date.now() - active.activatedAt > targetTimeoutMsForAge(ageYears, mode)) {
      missTargetAct(active.id);
    }
  });

  // ── Hit handler — also pipes through to backend (XP, achievements, AI coach) ──
  function handleHit(id: number, responseMs: number) {
    hitTargetAct(id, responseMs);
    incrementRep(currentROM);
    if (socket && session && patientId) {
      socket.emit('session:rep_complete', {
        sessionId: session.id,
        patientId,
        repCount: useSessionStore.getState().currentRep,
        rom: currentROM,
      });
    }
  }

  return (
    <>
      {/* Targets — modes that need a custom scene (Archer, Stargazer) own their
          own rendering; all others use the per-target sphere loop. */}
      {(state === 'playing' || state === 'round-end') && (
        mode === 'archer' ? (
          <ZenArcher
            targets={targets}
            activeTargetIndex={activeTargetIndex}
            onHit={handleHit}
            onMiss={(id) => missTargetAct(id)}
          />
        ) : mode === 'cervical' ? (
          <Stargazer
            targets={targets}
            activeTargetIndex={activeTargetIndex}
            onHit={handleHit}
            onMiss={(id) => missTargetAct(id)}
          />
        ) : (
          <>
            {targets.map((t) => (
              <TargetNode
                key={t.id}
                target={t}
                mode={mode}
                onHit={handleHit}
                onMiss={(id) => missTargetAct(id)}
              />
            ))}
            {/* Galactic Shield adds a starfield + per-hand shields on top of the threats */}
            {mode === 'galactic-shield' && state === 'playing' && <GalacticShield />}
          </>
        )
      )}

      {/* Countdown */}
      {state === 'countdown' && (
        <Text
          position={[0, 1.7, -1]}
          fontSize={0.55}
          color="#ff3aa0"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.01}
          outlineColor="#000"
        >
          {countdownSeconds > 0 ? String(countdownSeconds) : 'GO!'}
        </Text>
      )}

      {/* Round complete summary in 3D space */}
      {state === 'round-end' && (
        <group position={[0, 1.85, -1]}>
          <Text fontSize={0.16} color="#ffffff" anchorX="center" anchorY="middle" position={[0, 0.5, 0]}>
            ROUND COMPLETE
          </Text>
          <Text fontSize={0.12} color="#a855f7" anchorX="center" anchorY="middle" position={[0, 0.25, 0]}>
            {`Hits ${successCount} / ${TARGETS_PER_ROUND[mode]}`}
          </Text>
          <Text fontSize={0.11} color="#06b6d4" anchorX="center" anchorY="middle" position={[0, 0.05, 0]}>
            {`Score ${score.toLocaleString()}`}
          </Text>
          <Text fontSize={0.09} color="#f59e0b" anchorX="center" anchorY="middle" position={[0, -0.13, 0]}>
            {`Best Combo ×${bestCombo}`}
          </Text>
        </group>
      )}
    </>
  );
}
