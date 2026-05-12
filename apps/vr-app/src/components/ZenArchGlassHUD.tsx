'use client';

/**
 * Floating glassmorphism panels for Zen Archer — cyan / purple neon aesthetic
 * aligned with the Zen-Arch clinical mock (profile, session timer, bio sliders,
 * torso heat emphasis, smoothness sparkline).
 */

import type { MutableRefObject, ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard, Line, RoundedBox, Text } from '@react-three/drei';
import * as THREE from 'three';
import { useSessionStore } from '@/store/sessionStore';
import { useGameStore } from '@/store/gameStore';

export type ZenHudLive = {
  formScore: number;
  holdProgress: number;
  drawActive: boolean;
};

const GLASS_BG = '#0a1024';
const CYAN = '#22d3ee';
const VIOLET = '#8b5cf6';

function GlassPanel({
  children,
  width,
  height,
  position,
  renderOrder = 10,
}: {
  children: ReactNode;
  width: number;
  height: number;
  position: [number, number, number];
  renderOrder?: number;
}) {
  return (
    <group position={position}>
      <RoundedBox args={[width + 0.04, height + 0.04, 0.014]} radius={0.05} smoothness={4} position={[0, 0, -0.006]} renderOrder={renderOrder}>
        <meshStandardMaterial
          color={CYAN}
          emissive={CYAN}
          emissiveIntensity={0.35}
          transparent
          opacity={0.2}
          roughness={0.4}
          metalness={0.2}
          depthWrite={false}
        />
      </RoundedBox>
      <RoundedBox args={[width, height, 0.012]} radius={0.045} smoothness={4} renderOrder={renderOrder + 1}>
        <meshStandardMaterial
          color={GLASS_BG}
          emissive={VIOLET}
          emissiveIntensity={0.08}
          transparent
          opacity={0.42}
          roughness={0.55}
          metalness={0.15}
          depthWrite={false}
        />
      </RoundedBox>
      {children}
    </group>
  );
}

function CalibrationRing({ pct }: { pct: number }) {
  const outer = 0.14;
  const inner = 0.11;
  const sweep = Math.max(0.02, Math.min(1, pct)) * Math.PI * 2;
  const arc = useMemo(
    () => (
      <mesh rotation={[0, 0, -Math.PI / 2]} renderOrder={20}>
        <ringGeometry args={[inner, outer, 48, 1, 0, sweep]} />
        <meshBasicMaterial color={CYAN} transparent opacity={0.9} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    ),
    [sweep],
  );
  return (
    <group position={[-0.28, 0.12, 0.02]}>
      <mesh>
        <ringGeometry args={[inner, outer, 48]} />
        <meshBasicMaterial color="#1e1b4b" transparent opacity={0.85} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {arc}
      <Text position={[0, -0.22, 0.01]} fontSize={0.028} color="#93c5fd" anchorX="center" outlineWidth={0.003} outlineColor="#000">
        Calibration
      </Text>
      <Text position={[0, -0.255, 0.01]} fontSize={0.036} color="#ffffff" anchorX="center" outlineWidth={0.004} outlineColor="#000">
        {`${Math.round(pct * 100)}%`}
      </Text>
    </group>
  );
}

function CompassGauge({ liveRef }: { liveRef: MutableRefObject<ZenHudLive> }) {
  const needleRef = useRef<THREE.Group>(null);
  const arcStart = -Math.PI * 0.35;
  const arcLen = Math.PI * 0.7;

  useFrame((state) => {
    if (!needleRef.current) return;
    const t = state.clock.elapsedTime;
    const wobble = Math.sin(t * (liveRef.current.drawActive ? 2.4 : 0.9)) * 0.25;
    needleRef.current.rotation.z = wobble + liveRef.current.formScore * 1.1 - 0.55;
  });

  return (
    <group position={[0, -0.38, 0.02]}>
      <mesh>
        <ringGeometry args={[0.12, 0.135, 32]} />
        <meshBasicMaterial color={VIOLET} transparent opacity={0.65} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh rotation={[0, 0, arcStart]}>
        <ringGeometry args={[0.132, 0.148, 32, 1, 0, arcLen]} />
        <meshBasicMaterial color="#fbbf24" transparent opacity={0.75} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <group ref={needleRef} position={[0, 0, 0.02]}>
        <mesh>
          <planeGeometry args={[0.1, 0.022]} />
          <meshBasicMaterial color={CYAN} transparent opacity={0.95} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
        <mesh position={[0.048, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <coneGeometry args={[0.022, 0.065, 4]} />
          <meshStandardMaterial
            color={CYAN}
            emissive={CYAN}
            emissiveIntensity={0.85}
            metalness={0.25}
            roughness={0.35}
            depthWrite={false}
          />
        </mesh>
      </group>
    </group>
  );
}

function HudSlider({
  label,
  value10,
  y,
  trackW = 0.42,
}: {
  label: string;
  value10: number;
  y: number;
  trackW?: number;
}) {
  const t = Math.min(1, Math.max(0, value10 / 10));
  return (
    <group position={[0, y, 0.02]}>
      <Text position={[-trackW / 2, 0.045, 0]} fontSize={0.026} color="#a5b4fc" anchorX="left" outlineWidth={0.002} outlineColor="#000">
        {label}
      </Text>
      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[trackW, 0.028]} />
        <meshBasicMaterial color="#312e81" transparent opacity={0.9} depthWrite={false} />
      </mesh>
      <mesh position={[-trackW / 2 + 0.04 + t * (trackW * 0.84), 0, 0.002]}>
        <circleGeometry args={[0.022, 24]} />
        <meshStandardMaterial
          color={CYAN}
          emissive={CYAN}
          emissiveIntensity={0.9}
          metalness={0.2}
          roughness={0.3}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

function TorsoHeatMap({ affectedLeft }: { affectedLeft: boolean }) {
  const xSign = affectedLeft ? -1 : 1;
  return (
    <group position={[0, -0.05, 0.03]}>
      <mesh position={[0, 0.05, 0]}>
        <capsuleGeometry args={[0.12, 0.22, 6, 12]} />
        <meshStandardMaterial
          color="#1e3a5f"
          emissive="#0ea5e9"
          emissiveIntensity={0.12}
          transparent
          opacity={0.55}
          metalness={0.35}
          roughness={0.45}
        />
      </mesh>
      <mesh position={[xSign * 0.11, 0.14, 0.02]}>
        <sphereGeometry args={[0.055, 16, 16]} />
        <meshStandardMaterial
          color="#f97316"
          emissive="#ef4444"
          emissiveIntensity={0.85}
          transparent
          opacity={0.72}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[xSign * 0.2, 0.02, 0]} rotation={[0, 0, xSign * 0.4]}>
        <capsuleGeometry args={[0.035, 0.2, 4, 8]} />
        <meshStandardMaterial color="#2563eb" emissive="#38bdf8" emissiveIntensity={0.15} transparent opacity={0.45} />
      </mesh>
    </group>
  );
}

function SmoothnessGraph({ points }: { points: THREE.Vector3[] }) {
  if (points.length < 2) return null;
  return (
    <group position={[0, -0.06, 0.03]}>
      <Line points={points} color={CYAN} lineWidth={2} transparent opacity={0.95} />
      {points.map((p, i) => (
        <mesh key={i} position={[p.x, p.y, p.z + 0.004]}>
          <circleGeometry args={[0.012, 12]} />
          <meshBasicMaterial color={CYAN} transparent opacity={0.9} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

function formatElapsed(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

export function ZenArchGlassHUD({ liveRef }: { liveRef: MutableRefObject<ZenHudLive> }) {
  const patientName = useSessionStore((s) => s.patientDisplayName);
  const condition = useSessionStore((s) => s.patientConditionLabel);
  const painAtStart = useSessionStore((s) => s.painAtStart);
  const affectedSide = useSessionStore((s) => s.demographics.affectedSide);
  const currentROM = useSessionStore((s) => s.currentROM);
  const currentRep = useSessionStore((s) => s.currentRep);

  const gameState = useGameStore((s) => s.state);
  const startedAt = useGameStore((s) => s.startedAt);
  const targetROM = useGameStore((s) => s.currentTargetROM);

  const [elapsedMs, setElapsedMs] = useState(0);
  const [graphTick, setGraphTick] = useState(0);
  const [liveSnap, setLiveSnap] = useState<ZenHudLive>({ formScore: 1, holdProgress: 0, drawActive: false });
  const smoothHistory = useRef<number[]>([]);
  const pollAcc = useRef(0);

  const romLabel =
    affectedSide === 'left'
      ? 'Shoulder Abduction (Left)'
      : affectedSide === 'right'
        ? 'Shoulder Abduction (Right)'
        : 'Shoulder Abduction';

  const displayName = patientName ?? 'Patient';
  const sessionTitle = condition?.trim() ? `Session: ${condition}` : 'Session: Rehab';

  const lastTimerSec = useRef(-1);
  useEffect(() => {
    lastTimerSec.current = -1;
  }, [startedAt]);

  useFrame((_, dt) => {
    if (gameState === 'playing' && startedAt > 0) {
      const ms = Date.now() - startedAt;
      const sec = Math.floor(ms / 1000);
      if (sec !== lastTimerSec.current) {
        lastTimerSec.current = sec;
        setElapsedMs(ms);
      }
    }
    pollAcc.current += dt;
    if (pollAcc.current >= 0.1) {
      pollAcc.current = 0;
      const next = {
        formScore: liveRef.current.formScore,
        holdProgress: liveRef.current.holdProgress,
        drawActive: liveRef.current.drawActive,
      };
      setLiveSnap(next);
      smoothHistory.current.push(next.formScore);
      if (smoothHistory.current.length > 36) smoothHistory.current.shift();
      setGraphTick((x) => x + 1);
    }
  });

  const calibrationPct = Math.min(1, 0.72 + liveSnap.formScore * 0.26 + liveSnap.holdProgress * 0.02);

  const fatigueApprox = Math.min(
    10,
    Math.max(0, 2 + currentRep * 0.35 + Math.floor(elapsedMs / 60000) * 0.5 + (1 - liveSnap.formScore) * 2),
  );
  const painSlider = painAtStart ?? 3;

  const graphPoints = useMemo(() => {
    void graphTick;
    const hist = smoothHistory.current;
    const w = 0.44;
    const n = hist.length;
    if (n < 2) return [];
    return hist.map((y, i) => {
      const tx = (i / (n - 1 || 1)) * w - w / 2;
      const ty = y * 0.11 - 0.02;
      return new THREE.Vector3(tx, ty, 0);
    });
  }, [graphTick]);

  const smoothnessLabel = (6 + liveSnap.formScore * 4).toFixed(1);

  const hudVisible = gameState === 'playing' || gameState === 'countdown';
  if (!hudVisible) return null;

  const timerLabel = gameState === 'playing' && startedAt > 0 ? formatElapsed(elapsedMs) : '00:00';

  return (
    <>
      <Billboard position={[-1.05, 1.62, -1.15]} follow={true} lockY={false}>
        <GlassPanel width={0.72} height={1.05} position={[0, 0, 0]}>
          <Text position={[-0.2, 0.42, 0.03]} fontSize={0.05} color="#e0f2fe" anchorX="left" outlineWidth={0.004} outlineColor="#000">
            {displayName}
          </Text>
          <CalibrationRing pct={calibrationPct} />
          <Text position={[0.06, 0.28, 0.03]} fontSize={0.024} color="#93c5fd" anchorX="left" outlineWidth={0.002} outlineColor="#000">
            {romLabel}
          </Text>
          <Text position={[0.06, 0.22, 0.03]} fontSize={0.052} color="#ffffff" anchorX="left" outlineWidth={0.005} outlineColor="#000">
            {`${Math.round(currentROM)}° / ${Math.round(targetROM)}°`}
          </Text>
          <CompassGauge liveRef={liveRef} />
        </GlassPanel>
      </Billboard>

      <Billboard position={[1.12, 1.85, -1.12]} follow={true} lockY={false}>
        <GlassPanel width={0.78} height={0.55} position={[0, 0, 0]}>
          <Text position={[0, 0.19, 0.03]} fontSize={0.028} color="#c4b5fd" anchorX="center" maxWidth={0.72} textAlign="center" outlineWidth={0.002} outlineColor="#000">
            {sessionTitle}
          </Text>
          <Text position={[0, -0.02, 0.03]} fontSize={0.09} color="#ffffff" anchorX="center" outlineWidth={0.008} outlineColor="#000">
            {timerLabel}
          </Text>
          <HudSlider label={`Pain Index (${Math.round(painSlider)}/10)`} value10={painSlider} y={-0.18} />
          <HudSlider label={`Fatigue (${Math.round(fatigueApprox)}/10)`} value10={fatigueApprox} y={-0.33} />
        </GlassPanel>
      </Billboard>

      <Billboard position={[1.18, 0.95, -1.08]} follow={true} lockY={false}>
        <GlassPanel width={0.55} height={0.62} position={[0, 0, 0]}>
          <Text position={[0, 0.23, 0.03]} fontSize={0.026} color="#a5b4fc" anchorX="center" outlineWidth={0.002} outlineColor="#000">
            Focus region
          </Text>
          <TorsoHeatMap affectedLeft={affectedSide !== 'right'} />
        </GlassPanel>
      </Billboard>

      <Billboard position={[1.1, 0.22, -1.1]} follow={true} lockY={false}>
        <GlassPanel width={0.78} height={0.38} position={[0, 0, 0]}>
          <Text position={[-0.32, 0.12, 0.03]} fontSize={0.03} color="#67e8f9" anchorX="left" outlineWidth={0.003} outlineColor="#000">
            {`Smoothness Index: ${smoothnessLabel}/10`}
          </Text>
          <SmoothnessGraph points={graphPoints} />
        </GlassPanel>
      </Billboard>
    </>
  );
}
