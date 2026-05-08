'use client';

/**
 * Stargazer — cervical / neck-mobility game using gaze-based hit detection.
 *
 *   • Glowing star targets are placed at specific angles around the patient.
 *   • The patient turns their head to look at each star.
 *   • A "hit" requires the gaze cone to enter a tight angle around the target
 *     AND hold for ~0.6–0.9 s (age-tuned). The hold builds endurance and
 *     prevents speed-cheating with quick head flicks.
 *
 * Visual feedback during a rep:
 *   • Approaching the target → halo around the star grows + brightens
 *   • Locked on → golden progress sphere fills as hold time accumulates
 *   • Held long enough → star flashes gold, advances to next
 *
 * Real cervical ROM (head-rotation degrees from neutral) is computed at the
 * moment of hit and pushed into sessionStore.currentROM, so the existing
 * rep_complete pipeline reports a meaningful ROM number for SOAP notes.
 */

import { useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import type { Group, Mesh } from 'three';
import { useSessionStore } from '@/store/sessionStore';
import type { GameTarget } from '@/store/gameStore';

const LOCK_THRESHOLD = 0.97;     // dot product = ~14° cone for "locked on"
const HINT_THRESHOLD = 0.92;     //              = ~23° cone for "approaching"
const STAR_COUNT     = 380;
const FORWARD = new THREE.Vector3(0, 0, -1);     // assumed neutral gaze direction

function holdMsForAge(age: number | null): number {
  if (age == null) return 800;
  if (age < 18) return 900;          // youth: longer hold for control
  if (age >= 75) return 550;          // elderly: shorter — fatigue + tolerance
  if (age >= 65) return 650;
  return 800;
}

export function Stargazer({
  targets, activeTargetIndex, onHit, onMiss,
}: {
  targets: GameTarget[];
  activeTargetIndex: number;
  onHit:  (id: number, responseMs: number) => void;
  onMiss: (id: number) => void;
}) {
  const { camera } = useThree();
  const demographics = useSessionStore(s => s.demographics);

  const ageYears = demographics.dateOfBirth
    ? Math.floor((Date.now() - new Date(demographics.dateOfBirth).getTime()) / (365.25 * 86400000))
    : null;
  const holdMs = holdMsForAge(ageYears);

  const lockedSinceRef    = useRef<number | null>(null);
  const targetActivatedAt = useRef<number>(0);
  const [progress, setProgress] = useState(0);
  const [approach, setApproach] = useState(0);

  // Track activation time so we can report a real responseMs
  const activeId = targets[activeTargetIndex]?.id;
  if (activeId !== undefined && targetActivatedAt.current === 0) {
    targetActivatedAt.current = Date.now();
  }

  useFrame(() => {
    const active = targets[activeTargetIndex];
    if (!active || active.status !== 'active') {
      lockedSinceRef.current = null;
      if (progress !== 0) setProgress(0);
      if (approach !== 0) setApproach(0);
      targetActivatedAt.current = 0;
      return;
    }

    if (targetActivatedAt.current === 0) {
      targetActivatedAt.current = Date.now();
    }

    const headPos = camera.position.clone();
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);

    const targetWorld = new THREE.Vector3(...active.position);
    const targetDir   = targetWorld.sub(headPos).normalize();
    const dot         = forward.dot(targetDir);

    // Approach feedback (smoothed, no constant re-render storm)
    const newApproach = dot > HINT_THRESHOLD
      ? (dot - HINT_THRESHOLD) / (1 - HINT_THRESHOLD)
      : 0;
    if (Math.abs(newApproach - approach) > 0.04) setApproach(newApproach);

    // Lock + hold
    if (dot > LOCK_THRESHOLD) {
      if (lockedSinceRef.current == null) lockedSinceRef.current = Date.now();
      const heldFor = Date.now() - lockedSinceRef.current;
      const newProgress = Math.min(1, heldFor / holdMs);
      if (Math.abs(newProgress - progress) > 0.02) setProgress(newProgress);

      if (heldFor >= holdMs) {
        // ── REP COMPLETE ──
        // Real cervical ROM = angle between current gaze and neutral forward (-Z)
        const angleRad = Math.acos(Math.max(-1, Math.min(1, forward.dot(FORWARD))));
        const angleDeg = Math.round((angleRad * 180) / Math.PI);
        useSessionStore.getState().setROM(angleDeg);

        const responseMs = Date.now() - targetActivatedAt.current;
        onHit(active.id, responseMs);
        lockedSinceRef.current = null;
        targetActivatedAt.current = 0;
        setProgress(0);
        setApproach(0);
      }
    } else {
      lockedSinceRef.current = null;
      if (progress !== 0) setProgress(0);
    }
  });

  return (
    <group>
      <Skybox />
      <DistantStars />
      {targets.map((t, i) => (
        <CervicalStar
          key={t.id}
          target={t}
          isActive={t.status === 'active'}
          progress={i === activeTargetIndex ? progress : 0}
          approach={i === activeTargetIndex ? approach : 0}
        />
      ))}

      {/* Subtle "look-here" hint at the active target's direction */}
      {targets[activeTargetIndex]?.status === 'active' && (
        <DirectionHint targetPos={targets[activeTargetIndex].position} />
      )}
    </group>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function Skybox() {
  // Inverted dark blue sphere wrapping the player — gives a "night sky" backdrop
  // distinct from the daylight Sky that VRScene mounts otherwise.
  return (
    <mesh>
      <sphereGeometry args={[40, 32, 32]} />
      <meshBasicMaterial color="#080820" side={THREE.BackSide} depthWrite={false} />
    </mesh>
  );
}

function DistantStars() {
  const positions = useMemo(() => {
    const arr = new Float32Array(STAR_COUNT * 3);
    for (let i = 0; i < STAR_COUNT; i++) {
      const u = Math.random() * 2 - 1;
      const t = Math.random() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      const dist = 24 + Math.random() * 8;
      arr[i * 3 + 0] = r * Math.cos(t) * dist;
      arr[i * 3 + 1] = u * dist + 1.6;
      arr[i * 3 + 2] = r * Math.sin(t) * dist;
    }
    return arr;
  }, []);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={STAR_COUNT}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.14}
        color="#ffffff"
        transparent
        opacity={0.85}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

/** A single cervical target rendered as a glowing star with gaze-progress halos. */
function CervicalStar({
  target, isActive, progress, approach,
}: {
  target: GameTarget;
  isActive: boolean;
  progress: number;
  approach: number;
}) {
  const meshRef    = useRef<Mesh>(null);
  const haloRef    = useRef<Mesh>(null);
  const fillRef    = useRef<Mesh>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;

    if (meshRef.current) {
      if (isActive) {
        const pulse = 1 + Math.sin(t * 4) * 0.15;
        meshRef.current.scale.lerp(new THREE.Vector3(pulse, pulse, pulse), 0.3);
      } else if (target.status === 'hit' || target.status === 'missed') {
        meshRef.current.scale.lerp(new THREE.Vector3(0.001, 0.001, 0.001), 0.18);
      } else {
        meshRef.current.scale.lerp(new THREE.Vector3(0.5, 0.5, 0.5), 0.2);
      }
    }

    // Approach halo: bigger + brighter as you turn toward the target
    if (haloRef.current && isActive) {
      const haloScale = 1.1 + approach * 1.4;
      haloRef.current.scale.setScalar(haloScale);
      const m = haloRef.current.material as THREE.MeshBasicMaterial;
      m.opacity = 0.10 + approach * 0.35;
    }

    // Progress fill: gold sphere that grows as the hold accumulates
    if (fillRef.current) {
      if (isActive && progress > 0) {
        const s = 1 + progress * 1.2;
        fillRef.current.scale.setScalar(s);
        const m = fillRef.current.material as THREE.MeshBasicMaterial;
        m.opacity = 0.18 + progress * 0.55;
      } else {
        const m = fillRef.current.material as THREE.MeshBasicMaterial;
        m.opacity = 0;
      }
    }
  });

  const color =
    target.status === 'hit'    ? '#fbbf24'
    : target.status === 'missed' ? '#ef4444'
    : isActive                  ? '#22d3ee'
    :                             '#3a4a6a';

  return (
    <group position={target.position}>
      {/* Approach halo */}
      <mesh ref={haloRef}>
        <sphereGeometry args={[0.18, 24, 24]} />
        <meshBasicMaterial
          color={isActive ? '#22d3ee' : '#3a4a6a'}
          transparent opacity={0.0} depthWrite={false}
        />
      </mesh>

      {/* Gold progress sphere — grows with hold time */}
      <mesh ref={fillRef}>
        <sphereGeometry args={[0.20, 24, 24]} />
        <meshBasicMaterial color="#fbbf24" transparent opacity={0.0} depthWrite={false} />
      </mesh>

      {/* Star body */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.13, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isActive ? 1.6 : 0.4}
          metalness={0.1}
          roughness={0.4}
        />
      </mesh>
    </group>
  );
}

/**
 * A small floating arrow at the centre of vision pointing toward the active
 * target, so the patient knows which way to turn even when the star is
 * outside the current FOV.
 */
function DirectionHint({ targetPos }: { targetPos: [number, number, number] }) {
  const { camera } = useThree();
  const arrowRef = useRef<Group>(null);

  useFrame(() => {
    if (!arrowRef.current) return;

    const headPos = camera.position;
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);

    const targetWorld = new THREE.Vector3(...targetPos);
    const targetDir   = targetWorld.clone().sub(headPos).normalize();
    const dot         = forward.dot(targetDir);

    // Hide the hint when the patient is already looking near the target
    arrowRef.current.visible = dot < HINT_THRESHOLD;

    // Place the hint 1.2 m in front of the camera, but offset toward the target
    // by the projected lateral component, so it visually points the way.
    const cross = new THREE.Vector3().crossVectors(forward, targetDir);
    const sideOffset = cross.length() * Math.sign(cross.y || 0.001);
    const projectedOffset = targetDir.clone().sub(forward.clone().multiplyScalar(dot));
    projectedOffset.normalize().multiplyScalar(0.4);

    arrowRef.current.position.copy(headPos)
      .add(forward.clone().multiplyScalar(1.2))
      .add(projectedOffset);

    arrowRef.current.lookAt(targetWorld);

    // Suppress unused-var warning on sideOffset (kept for future tilt logic)
    void sideOffset;
  });

  return (
    <group ref={arrowRef}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.04, 0.14, 12]} />
        <meshBasicMaterial color="#22d3ee" transparent opacity={0.65} depthWrite={false} />
      </mesh>
      <Text
        position={[0, -0.12, 0]}
        fontSize={0.05}
        color="#22d3ee"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.005}
        outlineColor="#000"
      >
        Look here
      </Text>
    </group>
  );
}
